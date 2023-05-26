import { createSignal } from "@dassie/lib-reactive"

import type { IlpDestinationInfo } from "../send-outgoing-packets"
import PrefixMap from "../utils/prefix-map"

export const globalIlpRoutingTableSignal = () =>
  createSignal(new PrefixMap<IlpDestinationInfo>())
