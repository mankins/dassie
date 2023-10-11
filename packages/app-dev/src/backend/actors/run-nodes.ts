import { ViteDevServer } from "vite"
import { ViteNodeServer } from "vite-node/server"

import { setTimeout } from "node:timers/promises"

import { Reactor, createActor, createMapped } from "@dassie/lib-reactive"

import { RunnerEnvironment } from "../../common/types/runner-environment"
import { DEBUG_RPC_PORT } from "../constants/ports"
import { children as logger } from "../logger/instances"
import { DebugScopesSignal } from "../signals/debug-scopes"
import { ActiveNodesStore } from "../stores/active-nodes"
import { EnvironmentSettingsStore } from "../stores/environment-settings"
import { generateNodeConfig } from "../utils/generate-node-config"
import { prefillDatabase } from "../utils/prefill-database"
import { prepareDataDirectory } from "../utils/prepare-data-directory"
import {
  type CertificateInfo,
  validateCertificates,
} from "../utils/validate-certificates"
import { FileChangeTopic } from "./handle-file-change"
import { RunChildProcessActor } from "./run-child-process"

// Amount of time to wait between starting each node process
const NODE_STARTUP_INTERVAL = 500

export interface NodeDefinition<T> {
  id: string
  port: number
  debugPort: number
  peers: string[]
  config: T
  url: string
  entry?: string
}

export interface RunNodesParameters {
  viteServer: ViteDevServer
  viteNodeServer: ViteNodeServer
}
export const RunNodesActor = () =>
  createActor(
    async (sig, { viteServer, viteNodeServer }: RunNodesParameters) => {
      // Restart all nodes when a source code file changes
      sig.subscribe(FileChangeTopic)

      logger.debug("starting node processes")

      const NodeActors = (reactor: Reactor) =>
        createMapped(
          reactor.lifecycle,
          reactor.use(ActiveNodesStore),
          (nodeId) =>
            createActor(async (sig) => {
              const environmentSettings = sig.get(EnvironmentSettingsStore)
              const node = generateNodeConfig(nodeId, environmentSettings)

              // Generate TLS certificates
              {
                const neededCertificates: CertificateInfo[] = [
                  {
                    commonName: `${node.id}.localhost`,
                    certificatePath: node.tlsWebCertFile,
                    keyPath: node.tlsWebKeyFile,
                  },
                ]

                await validateCertificates({
                  id: node.id,
                  certificates: neededCertificates,
                })
              }

              // Prepare data directory with database
              {
                const { dataPath } = node

                await prepareDataDirectory(dataPath)
                await prefillDatabase(node)
              }

              const debugScopes = sig.get(DebugScopesSignal)
              await sig.run(RunChildProcessActor, {
                nodeServer: viteNodeServer,
                id: node.id,
                environment: {
                  FORCE_COLOR: "1",
                  ...process.env,
                  DEBUG: debugScopes,
                  DEBUG_HIDE_DATE: "1",
                  DASSIE_BOOTSTRAP_NODES: JSON.stringify(node.bootstrapNodes),
                  DASSIE_STATE_DIRECTORY: node.dataPath,
                  DASSIE_IPC_SOCKET_PATH: node.ipcSocketPath,
                  DASSIE_DEV_ROOT: viteServer.config.root,
                  DASSIE_DEV_BASE: viteServer.config.base,
                  DASSIE_DEV_ENTRY: node.entry,
                  DASSIE_DEV_RPC_URL: `wss://dev-rpc.localhost:${DEBUG_RPC_PORT}`,
                  DASSIE_DEV_NODE_ID: node.id,
                } satisfies RunnerEnvironment,
                extraArguments: [`--inspect-port=${node.debugPort}`],
              })

              await setTimeout(NODE_STARTUP_INTERVAL)
            }),
        )

      await sig.runMapSequential(NodeActors)
    },
  )
