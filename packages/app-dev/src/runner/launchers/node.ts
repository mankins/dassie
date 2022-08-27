import { rootEffect as nodeRootEffect } from "@dassie/app-node"
import { createLogger } from "@dassie/lib-logger"
import { EffectContext, createReactor } from "@dassie/lib-reactive"

import { handleShutdownSignals } from "../../common/effects/handle-shutdown-signals"
import { runDebugRpcServer } from "../effects/debug-rpc-server"
import { forwardLogs } from "../effects/forward-logs"
import { forwardPeerTraffic } from "../effects/forward-peer-traffic"

export const logger = createLogger("das:dev:launcher:node")

const rootEffect = async (sig: EffectContext) => {
  sig.run(handleShutdownSignals)
  sig.run(forwardLogs)
  sig.run(forwardPeerTraffic)
  await sig.run(nodeRootEffect)
  sig.run(runDebugRpcServer)
}

createReactor(rootEffect)
