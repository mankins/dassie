import {
  BadRequestFailure,
  UnauthorizedFailure,
  assertAcceptHeader,
  assertContentTypeHeader,
  createBinaryResponse,
  createHandler,
  parseBody,
} from "@dassie/lib-http-server"
import { createActor } from "@dassie/lib-reactive"
import { isFailure } from "@dassie/lib-type-utils"

import { HttpsRouterServiceActor } from "../http-server/serve-https"
import { peerProtocol as logger } from "../logger/instances"
import {
  HandlePeerMessageActor,
  IncomingPeerMessageTopic,
} from "./actors/handle-peer-message"
import { ALLOW_ANONYMOUS_USAGE } from "./constants/anonymous-messages"
import { DASSIE_MESSAGE_CONTENT_TYPE } from "./constants/content-type"
import { AuthenticatePeerMessage } from "./functions/authenticate-peer-message"
import { peerMessage as peerMessageSchema } from "./peer-schema"
import { NodeTableStore } from "./stores/node-table"

export const RegisterPeerHttpHandlerActor = () =>
  createActor((sig) => {
    const router = sig.get(HttpsRouterServiceActor)
    const authenticatePeerMessage = sig.use(AuthenticatePeerMessage)
    const nodeTableStore = sig.use(NodeTableStore)

    if (!router) return

    router.post(
      "/peer",
      createHandler(async (request) => {
        {
          const result = assertAcceptHeader(
            request,
            DASSIE_MESSAGE_CONTENT_TYPE,
          )
          if (isFailure(result)) return result
        }
        {
          const result = assertContentTypeHeader(
            request,
            DASSIE_MESSAGE_CONTENT_TYPE,
          )
          if (isFailure(result)) return result
        }

        const body = await parseBody(request)

        if (isFailure(body)) return body

        const parseResult = peerMessageSchema.parse(body)

        if (isFailure(parseResult)) {
          logger.debug("error while parsing incoming dassie message", {
            error: parseResult,
            body,
          })
          return new BadRequestFailure(`Bad Request, failed to parse message`)
        }

        if (parseResult.value.version !== 0) {
          logger.debug("incoming dassie message has unknown version", {
            version: parseResult.value.version,
            body,
          })
          return new BadRequestFailure(`Bad Request, unsupported version`)
        }

        const senderNode = nodeTableStore.read().get(parseResult.value.sender)

        const isAuthenticated = authenticatePeerMessage(
          parseResult.value,
          senderNode,
        )

        // Only certain messages are allowed to be sent anonymously
        if (
          !isAuthenticated &&
          !ALLOW_ANONYMOUS_USAGE.includes(parseResult.value.content.value.type)
        ) {
          logger.debug(
            "incoming dassie message is not authenticated, ignoring",
            {
              message: parseResult.value,
              body,
            },
          )
          return new UnauthorizedFailure(
            "Incoming Dassie message is not authenticated",
          )
        }

        sig.use(IncomingPeerMessageTopic).emit({
          message: parseResult.value,
          authenticated: isAuthenticated,
          peerState: senderNode?.peerState,
          asUint8Array: body,
        })

        const responseMessage = await sig
          .use(HandlePeerMessageActor)
          .api.handle.ask({
            message: parseResult.value,
            authenticated: isAuthenticated,
            peerState: senderNode?.peerState,
            asUint8Array: body,
          })

        return createBinaryResponse(responseMessage, {
          contentType: "application/dassie-peer-response",
        })
      }),
    )
  })
