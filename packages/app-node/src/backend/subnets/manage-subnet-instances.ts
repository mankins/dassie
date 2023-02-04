import type { EffectContext } from "@dassie/lib-reactive"

import { subnetBalanceMapStore } from "../balances/stores/subnet-balance-map"
import { configSignal } from "../config"
import { runPerSubnetEffects } from "../peer-protocol/run-per-subnet-effects"
import { peerTableStore } from "../peer-protocol/stores/peer-table"
import * as modules from "./modules"
import { activeSubnetsSignal } from "./signals/active-subnets"
import { subnetMapSignal } from "./signals/subnet-map"
import type { SubnetModule } from "./types/subnet-module"

export const manageSubnetInstances = async (sig: EffectContext) => {
  await Promise.all(sig.for(activeSubnetsSignal, runSubnetModule))
}

const runSubnetModule = async (sig: EffectContext, subnetId: string) => {
  const realm = sig.get(configSignal, (state) => state.realm)
  const subnetMap = sig.get(subnetMapSignal)
  const subnetBalanceMap = sig.use(subnetBalanceMapStore)

  const subnetState = subnetMap.get(subnetId)

  const createModule = (modules as Record<string, SubnetModule>)[subnetId]
  if (!createModule) {
    throw new Error(`Unknown subnet module '${subnetId}'`)
  }

  const instance = await createModule()

  if (realm !== instance.realm) {
    throw new Error("Subnet module is not compatible with realm")
  }

  if (subnetState?.initialPeers) {
    for (const peer of subnetState.initialPeers) {
      sig.use(peerTableStore).addPeer({
        subnetId,
        ...peer,
        nodePublicKey: Buffer.from(peer.nodePublicKey, "hex"),
        state: { id: "request-peering" },
      })
    }
  }

  /**
   * Instantiate aspects of the peer protocol that are specific to this subnet.
   */
  await sig.run(runPerSubnetEffects, {
    subnetId,
    subnetModule: instance,
  })

  // Keep track of balance
  subnetBalanceMap.setBalance(subnetId, instance.balance.read())
  const disposeBalanceListener = instance.balance.on((balance) => {
    subnetBalanceMap.setBalance(subnetId, balance)
  })

  sig.onCleanup(() => {
    disposeBalanceListener()
    subnetBalanceMap.clearBalance(subnetId)
    return instance.dispose()
  })
}
