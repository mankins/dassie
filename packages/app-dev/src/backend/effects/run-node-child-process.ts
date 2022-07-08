import colors from "picocolors"
import type { ViteDevServer } from "vite"
import type { ViteNodeServer } from "vite-node/server"

import { ChildProcess, Serializable, fork } from "node:child_process"
import type { Readable } from "node:stream"

import { byLine } from "@xen-ilp/lib-itergen-utils"
import {
  SerializableLogLine,
  createLogger,
  formatStack,
} from "@xen-ilp/lib-logger"
import type { EffectContext } from "@xen-ilp/lib-reactive"
import { UnreachableCaseError, assertDefined } from "@xen-ilp/lib-type-utils"

import RpcHost from "../../classes/rpc-host"
import { ClientRequest, schema } from "../../schemas/client-request"
import { logLineTopic } from "../topics/log-message"
import { createCliOnlyLogger } from "../utils/cli-only-logger"
import type { NodeDefinition } from "./run-nodes"

const logger = createLogger("xen:dev:run-node-child-process")

const VITE_NODE_BIN = new URL(
  "../../../node_modules/vite-node/vite-node.mjs",
  import.meta.url
).pathname
const RUNNER_MODULE = new URL("../runner.ts", import.meta.url).pathname

const handleChildError = (error: Error) => {
  logger.error("child process error")
  logger.logError(error)
}

interface RunNodeChildProcessProperties<T> {
  viteServer: ViteDevServer
  nodeServer: ViteNodeServer
  node: NodeDefinition<T>
}
export const runNodeChildProcess = async <T>(
  sig: EffectContext,
  { viteServer, nodeServer, node }: RunNodeChildProcessProperties<T>
) => {
  let child: ChildProcess | undefined

  const prefix = `◼ ${node.id}`
  const cliLogger = createCliOnlyLogger(prefix)

  const sendToChild = (message: Serializable) => {
    child?.send(message)
  }

  const handleChildExit = (code: number | null) => {
    if (code === 0) {
      logger.info(`${colors.green(`child exited`)}`)
    } else {
      logger.error(`child exited with code: ${code ?? "unknown"}`)
    }
    child = undefined
  }

  const handleChildMessage = (message: unknown) => {
    rpcHost.handleMessage(message).catch((error) => logger.logError(error))
  }

  const handleChildRequest = async (request: ClientRequest) => {
    switch (request.method) {
      case "fetchModule":
        return nodeServer.fetchModule(...request.params)
      case "resolveId":
        return nodeServer.resolveId(
          request.params[0],
          request.params[1] === null ? undefined : request.params[1]
        )
      default:
        throw new UnreachableCaseError(request)
    }
  }

  const rpcHost = new RpcHost(schema, handleChildRequest, sendToChild)

  const processLog = async (input: Readable) => {
    for await (const line of byLine(input)) {
      try {
        // Suppress annoying node debugger spam
        if (
          line.startsWith("Debugger listening on ") ||
          line === "For help, see: https://nodejs.org/en/docs/inspector" ||
          line === "Debugger attached."
        )
          continue

        const logLine = JSON.parse(line) as SerializableLogLine
        sig.reactor.emit(logLineTopic, {
          node: node.id,
          ...logLine,
          error: logLine.error ? formatStack(logLine.error) : undefined,
        })
        if (process.env["XEN_LOG_TO_CLI"] === "true") {
          cliLogger.info(
            `${logLine.component} ${
              logLine.error ? formatStack(logLine.error) : logLine.message
            }`,
            logLine.data
          )
        }
      } catch {
        sig.reactor.emit(logLineTopic, {
          node: node.id,
          component: "raw",
          message: line,
          date: new Date().toISOString(),
          level: "info",
        })
        if (process.env["XEN_LOG_TO_CLI"] === "true") {
          cliLogger.info(line)
        }
      }
    }
  }

  const resolvedEntryPoint = await nodeServer.resolveId(RUNNER_MODULE)

  if (!resolvedEntryPoint) {
    throw new Error(`${RUNNER_MODULE} not resolvable`)
  }

  logger.debug("launching child...", { node: node.id })
  child = fork(VITE_NODE_BIN, [resolvedEntryPoint.id], {
    detached: false,
    silent: true,
    execArgv: ["--enable-source-maps"],
    env: {
      FORCE_COLOR: "1",
      ...process.env,
      XEN_LOG_FORMATTER: "json",
      XEN_CONFIG: JSON.stringify(node.config),
      XEN_DEV_ROOT: viteServer.config.root,
      XEN_DEV_BASE: viteServer.config.base,
      XEN_DEV_ENTRY: node.entry ?? "src/index.ts",
    },
  })
  child.addListener("error", handleChildError)
  child.addListener("exit", handleChildExit)
  child.addListener("message", handleChildMessage)

  assertDefined(child.stdout)
  assertDefined(child.stderr)

  processLog(child.stdout).catch((error) => logger.logError(error))
  processLog(child.stderr).catch((error) => logger.logError(error))

  sig.onCleanup(() => {
    if (child) {
      child.removeListener("exit", handleChildExit)
      child.removeListener("message", handleChildMessage)

      child.kill("SIGINT")
    }
  })

  // Wait for first message from child to indicate it is ready
  await new Promise((resolve) => child?.once("message", resolve))
}
