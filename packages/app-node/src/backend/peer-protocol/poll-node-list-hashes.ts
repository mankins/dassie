import { enableMapSet, produce } from "immer"
import pMap from "p-map"

import { Reactor, createActor } from "@dassie/lib-reactive"

import { DassieActorContext } from "../base/types/dassie-base"
import { EnvironmentConfigSignal } from "../config/environment-config"
import { SendPeerMessageActor } from "./actors/send-peer-message"
import { NODE_LIST_HASH_POLLING_INTERVAL } from "./constants/timings"
import { BootstrapNodeListHashesSignal } from "./signals/bootstrap-node-list-hashes"
import { NodeId } from "./types/node-id"

enableMapSet()

const NODE_LIST_POLLING_CONCURRENCY = 5

export const PollNodeListHashesActor = (reactor: Reactor) => {
  const loadNodeListHash = async (sourceNodeId: NodeId) => {
    const response = await reactor.use(SendPeerMessageActor).api.send.ask({
      destination: sourceNodeId,
      message: {
        type: "nodeListHashRequest",
        value: {},
      },
    })

    return response?.hash
  }

  const bootstrapNodeListHashesSignal = reactor.use(
    BootstrapNodeListHashesSignal,
  )

  return createActor(async (sig: DassieActorContext) => {
    const { bootstrapNodes } = sig.readKeysAndTrack(EnvironmentConfigSignal, [
      "bootstrapNodes",
    ])

    async function queryNodeListHashes() {
      const nodeListHashes = await pMap(
        bootstrapNodes.map(({ id }) => id),
        loadNodeListHash,
        {
          concurrency: NODE_LIST_POLLING_CONCURRENCY,
        },
      )

      for (const [nodeIndex, nodeListHash] of nodeListHashes.entries()) {
        if (nodeListHash == null) {
          continue
        }

        bootstrapNodeListHashesSignal.update(
          produce((draft) => {
            draft.set(bootstrapNodes[nodeIndex]!.id, nodeListHash)
          }),
        )
      }
    }

    const task = sig.task({
      handler: queryNodeListHashes,
      interval: NODE_LIST_HASH_POLLING_INTERVAL,
    })
    await task.execute()
    task.schedule()
  })
}
