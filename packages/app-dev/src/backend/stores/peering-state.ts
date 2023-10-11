import { createStore } from "@dassie/lib-reactive"

export const PeeringStateStore = () =>
  createStore({} as Record<string, string[]>, {
    updateNodePeers: (nodeId: string, peers: string[]) => (state) => ({
      ...state,
      [nodeId]: peers,
    }),
  })
