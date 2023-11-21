import chalk from "chalk"
import { ModuleNode } from "vite"

import { posix } from "node:path"

import { Reactor, createActor, createTopic } from "@dassie/lib-reactive"

import { LogsStore } from "../../common/stores/logs"
import { NODE_ENTRYPOINT } from "../constants/entrypoints"
import { vite as logger } from "../logger/instances"
import { PeeringStateStore } from "../stores/peering-state"
import { ViteNodeServer } from "../unconstructables/vite-node-server"
import { ViteServer } from "../unconstructables/vite-server"

export function getShortName(file: string, root: string): string {
  return file.startsWith(root + "/") ? posix.relative(root, file) : file
}

export const FileChangeTopic = () => createTopic()

const isWithinBoundary = (
  node: ModuleNode,
  traversedModules: Set<ModuleNode>,
  boundaryModules: Set<ModuleNode>,
): boolean => {
  if (traversedModules.has(node)) {
    return false
  }
  traversedModules.add(node)

  for (const importer of node.importers) {
    if (boundaryModules.has(importer)) {
      return true
    }
    if (isWithinBoundary(importer, traversedModules, boundaryModules)) {
      return true
    }
  }

  return false
}

export const HandleFileChangeActor = (reactor: Reactor) => {
  const viteServer = reactor.use(ViteServer)
  const viteNodeServer = reactor.use(ViteNodeServer)
  const logsStore = reactor.use(LogsStore)
  const peeringStateStore = reactor.use(PeeringStateStore)
  const fileChangeTopic = reactor.use(FileChangeTopic)

  return createActor((sig) => {
    const onFileChange = (file: string) => {
      const { config, moduleGraph } = viteServer
      const shortFile = getShortName(file, config.root)

      // The cache in vite-node doesn't correctly invalidate, so we need to clear it on each file change.
      // It still helps a lot with performance because we are compiling the code once and then re-using it for every running process.
      viteNodeServer.fetchCache = new Map()

      const boundaryModules = moduleGraph.getModulesByFile(NODE_ENTRYPOINT)
      const changedModules = moduleGraph.getModulesByFile(file)

      if (!boundaryModules || !changedModules) return

      const traversedModules = new Set<ModuleNode>()
      for (const module of changedModules) {
        if (isWithinBoundary(module, traversedModules, boundaryModules)) {
          logsStore.clear()
          peeringStateStore.clear()
          logger.info(`${chalk.green(`change`)} ${chalk.dim(shortFile)}`)
          fileChangeTopic.emit(undefined)
        }
      }
    }

    viteServer.watcher.on("change", onFileChange)

    sig.onCleanup(() => {
      viteServer.watcher.off("change", onFileChange)
    })
  })
}
