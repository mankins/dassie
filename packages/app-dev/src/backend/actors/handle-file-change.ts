import chalk from "chalk"

import { posix } from "node:path"

import { Reactor, createActor, createTopic } from "@dassie/lib-reactive"

import { LogsStore } from "../../common/stores/logs"
import { vite as logger } from "../logger/instances"
import { PeeringStateStore } from "../stores/peering-state"
import { ViteNodeServer } from "../unconstructables/vite-node-server"
import { ViteServer } from "../unconstructables/vite-server"

export function getShortName(file: string, root: string): string {
  return file.startsWith(root + "/") ? posix.relative(root, file) : file
}

export const FileChangeTopic = () => createTopic()

export const HandleFileChangeActor = (reactor: Reactor) => {
  const viteServer = reactor.use(ViteServer)
  const viteNodeServer = reactor.use(ViteNodeServer)

  return createActor((sig) => {
    const onFileChange = (file: string) => {
      const { config, moduleGraph } = viteServer
      const shortFile = getShortName(file, config.root)

      // The cache in vite-node doesn't correctly invalidate, so we need to clear it on each file change.
      // It still helps a lot with performance because we are compiling the code once and then re-using it for every running process.
      viteNodeServer.fetchCache = new Map()

      const mods = moduleGraph.getModulesByFile(file)

      if (mods && mods.size > 0) {
        sig.use(LogsStore).clear()
        sig.use(PeeringStateStore).clear()
        logger.info(`${chalk.green(`change`)} ${chalk.dim(shortFile)}`)

        sig.use(FileChangeTopic).emit(undefined)
      }
    }

    viteServer.watcher.on("change", onFileChange)

    sig.onCleanup(() => {
      viteServer.watcher.off("change", onFileChange)
    })
  })
}
