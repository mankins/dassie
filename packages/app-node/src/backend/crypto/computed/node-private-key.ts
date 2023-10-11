import assert from "node:assert"

import { Reactor, createComputed } from "@dassie/lib-reactive"

import {
  DatabaseConfigStore,
  hasNodeIdentity,
} from "../../config/database-config"
import { parseEd25519PrivateKey } from "../../utils/pem"

export const NodePrivateKeySignal = (reactor: Reactor) =>
  createComputed(reactor.lifecycle, (sig) => {
    const config = sig.get(reactor.use(DatabaseConfigStore))

    assert(hasNodeIdentity(config), "Node identity is not configured")

    return parseEd25519PrivateKey(config.dassieKey)
  })
