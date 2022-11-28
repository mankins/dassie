import { createSignal } from "@dassie/lib-reactive"

export interface SubnetState {
  subnetId: string
  config: unknown
  initialPeers: { nodeId: string; url: string }[]
}

export const subnetMapSignal = () =>
  createSignal<Map<string, SubnetState>>(new Map())
