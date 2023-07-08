import { createActor } from "@dassie/lib-reactive"

import type { PerSettlementSchemeParameters } from "../settlement-schemes/manage-settlement-scheme-instances"
import { handlePeerMessage } from "./actors/handle-peer-message"
import { sendPeerMessage } from "./actors/send-peer-message"
import { discoverNodes } from "./discover-nodes"
import { forwardLinkStateUpdate } from "./forward-link-state-update"
import { maintainOwnNodeTableEntry } from "./maintain-own-node-table-entry"
import { maintainPeeringRelationships } from "./maintain-peering-relationships"
import { queueBootstrapNodes } from "./queue-bootstrap-node"
import { registerPeerHttpHandler } from "./register-peer-http-handler"
import { runPerPeerActors } from "./run-per-peer-actors"
import { sendHeartbeats } from "./send-heartbeats"

export const speakPeerProtocol = () =>
  createActor(async (sig) => {
    sig.run(handlePeerMessage)
    sig.run(sendPeerMessage)

    // Handle incoming Dassie messages via HTTP
    sig.run(registerPeerHttpHandler)

    await sig.run(maintainOwnNodeTableEntry)
    sig.run(maintainPeeringRelationships)

    sig.run(sendHeartbeats)
    sig.run(forwardLinkStateUpdate)
    sig.run(discoverNodes)

    sig.runMap(runPerPeerActors)
  })

/**
 * Some actors are specific to each settlement scheme so we export this helper which is called from the settlement scheme instantiation code.
 */
export const speakPeerProtocolPerSettlementScheme = () =>
  createActor((sig, parameters: PerSettlementSchemeParameters) => {
    sig.run(queueBootstrapNodes, parameters)
  })
