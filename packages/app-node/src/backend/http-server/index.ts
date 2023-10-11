import { createActor } from "@dassie/lib-reactive"

import { HasTlsSignal } from "../config/computed/has-tls"
import { ServeFrontendActor } from "./serve-frontend"
import { ServeHttpActor } from "./serve-http"
import { ServeHttpsActor } from "./serve-https"
import { ServeRestApiActor } from "./serve-rest-api"

export const HttpServerActor = () =>
  createActor((sig) => {
    const hasTls = sig.get(HasTlsSignal)
    sig.run(ServeHttpActor)

    if (hasTls) {
      sig.run(ServeHttpsActor)
      sig.run(ServeRestApiActor)
      sig.run(ServeFrontendActor)
    }
  })
