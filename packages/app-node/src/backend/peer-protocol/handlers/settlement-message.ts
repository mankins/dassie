import { Reactor } from "@dassie/lib-reactive"

import { ManageSettlementSchemeInstancesActor } from "../../settlement-schemes/manage-settlement-scheme-instances"
import type { PeerMessageHandler } from "../actors/handle-peer-message"

export const HandleSettlementMessage = ((reactor: Reactor) => {
  const settlementSchemeManager = reactor.use(
    ManageSettlementSchemeInstancesActor,
  )

  return ({
    message: {
      sender,
      content: {
        value: {
          value: { settlementSchemeId: settlementSchemeId, message },
        },
      },
    },
  }) => {
    const settlementSchemeActor =
      settlementSchemeManager.get(settlementSchemeId)

    if (!settlementSchemeActor) return

    settlementSchemeActor.api.handleMessage.tell({
      peerId: sender,
      message,
    })
  }
}) satisfies PeerMessageHandler<"settlementMessage">
