import { createSignal } from "@dassie/lib-reactive"

import type { EndpointInfo } from "../../ilp-connector/functions/send-packet"
import { NodeId } from "../../peer-protocol/types/node-id"
import PrefixMap from "../utils/prefix-map"

export type RoutingInfo = FixedDestinationRoutingInfo | PeerRoutingInfo

export interface FixedDestinationRoutingInfo {
  type: "fixed"
  destination: EndpointInfo
}

export interface PeerRoutingInfo {
  type: "peer"
  firstHopOptions: NodeId[]
  distance: number
}

export const routingTableSignal = () =>
  createSignal(new PrefixMap<RoutingInfo>())
