import { createLogger } from "@xen-ilp/lib-logger"
import type { EffectContext } from "@xen-ilp/lib-reactive"

import { outgoingPeerMessageBufferTopic } from "../peer-protocol/send-peer-messages"
import { peerMessage } from "./peer-schema"
import { nodeTableStore, updateNode } from "./stores/node-table"
import { peerTableStore } from "./stores/peer-table"

const logger = createLogger("xen:node:forward-link-state-update")

const COUNTER_THRESHOLD = 3
const MAX_RETRANSMIT_CHECK_INTERVAL = 200

export const forwardLinkStateUpdate = (sig: EffectContext) => {
  const nodes = sig.get(nodeTableStore)
  const peers = sig.get(peerTableStore)

  for (const node of nodes.values()) {
    if (
      node.updateReceivedCounter < COUNTER_THRESHOLD &&
      node.scheduledRetransmitTime < Date.now()
    ) {
      // Set scheduled retransmit time to be infinitely far in the future so we don't retransmit the same update again.
      sig.emit(
        nodeTableStore,
        updateNode(node.nodeId, {
          scheduledRetransmitTime: Number.POSITIVE_INFINITY,
        })
      )

      const message = peerMessage.serialize({
        linkStateUpdate: {
          bytes: node.lastLinkStateUpdate,
        },
      })

      if (!message.success) {
        throw new Error("Failed to serialize link state update message", {
          cause: message.failure,
        })
      }

      for (const peer of peers.values()) {
        if (peer.nodeId === node.nodeId) continue

        logger.debug("retransmit link state update", {
          from: node.nodeId,
          to: peer.nodeId,
        })

        // Retransmit the link state update
        sig.emit(outgoingPeerMessageBufferTopic, {
          destination: peer.nodeId,
          message: message.value,
        })
      }
    }
  }

  sig.timeout(sig.wake.bind(sig), MAX_RETRANSMIT_CHECK_INTERVAL)
}
