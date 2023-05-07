import type { ConditionalKeys } from "type-fest"

import { isObject } from "@dassie/lib-type-utils"

import type { ActorContext } from "./context"
import { FactoryNameSymbol } from "./reactor"
import { type Signal, createSignal } from "./signal"

export type Behavior<TReturn = unknown, TProperties = unknown> = (
  sig: ActorContext,
  properties: TProperties
) => TReturn

export const ActorSymbol = Symbol("das:reactive:actor")

export type MessageHandler = (message: never) => unknown

export type MessageHandlerRecord = Record<string, MessageHandler>

export type InferActorMessageType<
  TInstance,
  TMethod extends string & keyof TInstance
> = TInstance[TMethod] extends (message: infer TMessage) => unknown
  ? TMessage
  : never

export type InferActorReturnType<
  TInstance,
  TMethod extends string & keyof TInstance
> = TInstance[TMethod] extends (...parameters: never[]) => infer TReturn
  ? TReturn
  : never

export type Actor<TInstance, TProperties = undefined> = Signal<
  Awaited<TInstance> | undefined
> & {
  /**
   * Marks this object as a value.
   */
  [ActorSymbol]: true

  /**
   * Whether the actor is currently instantiated inside of a reactor.
   */
  isRunning: boolean

  /**
   * The result of the most recent succesful execution of the actor.
   *
   * Note that this is the raw result which may be a promise. If you want to get the resolved value, use `actor.read()`.
   *
   * If the actor hasn't run yet, the result will be undefined.
   * If the actor throws an error, the result will be a rejected promise which is represented by a Promise<never> type.
   */
  result: TInstance | undefined | Promise<never>

  /**
   * The function that initializes the actor. Used internally. You should call reactor.run() or sig.run() if you want to start the actor.
   */
  behavior: Behavior<TInstance, TProperties>

  /**
   * Fire-and-forget message to the actor. The message will be delivered asynchronously and any return value will be ignored.
   *
   * @param message - The message to send to the actor.
   */
  tell: <
    TMethod extends string & ConditionalKeys<Awaited<TInstance>, MessageHandler>
  >(
    this: void,
    method: TMethod,
    message: InferActorMessageType<Awaited<TInstance>, TMethod>
  ) => void

  /**
   * Asynchronously message the actor and receive a response as a promise.
   *
   * @param message - The message to send to the actor.
   * @returns A promise that will resolve with the response from the actor.
   */
  ask: <
    TMethod extends string & ConditionalKeys<Awaited<TInstance>, MessageHandler>
  >(
    this: void,
    method: TMethod,
    message: InferActorMessageType<Awaited<TInstance>, TMethod>
  ) => Promise<InferActorReturnType<Awaited<TInstance>, TMethod>>
}

type CreateActorSignature = <TInstance, TProperties = undefined>(
  behavior: Behavior<TInstance, TProperties>
) => Actor<TInstance, TProperties>

export const createActor: CreateActorSignature = <
  TInstance,
  TProperties = undefined
>(
  behavior: Behavior<TInstance, TProperties>
): Actor<TInstance, TProperties> => {
  const signal = createSignal<Awaited<TInstance> | undefined>(undefined)
  const actor: Actor<TInstance, TProperties> = {
    ...signal,
    [ActorSymbol]: true,
    isRunning: false,
    result: undefined,
    behavior,
    tell: (method, message) => {
      const handler = signal.read()?.[method]

      if (handler) {
        try {
          const result = (handler as (parameter: typeof message) => unknown)(
            message
          )

          if (
            isObject(result) &&
            "catch" in result &&
            typeof result["catch"] === "function"
          ) {
            ;(result as unknown as Promise<unknown>).catch((error: unknown) => {
              console.error("error in actor", {
                error,
                actor: actor[FactoryNameSymbol],
              })
            })
          }
        } catch (error: unknown) {
          console.error("error in actor", {
            error,
            actor: actor[FactoryNameSymbol],
          })
        }

        return
      }

      const removeListener = signal.on((handlerRecord) => {
        const handler = handlerRecord?.[method]
        if (handler) {
          try {
            const result = (handler as (parameter: typeof message) => unknown)(
              message
            )

            if (
              isObject(result) &&
              "catch" in result &&
              typeof result["catch"] === "function"
            ) {
              ;(result as unknown as Promise<unknown>).catch(
                (error: unknown) => {
                  console.error("error in actor", {
                    error,
                    actor: actor[FactoryNameSymbol],
                  })
                }
              )
            }

            return
          } catch (error: unknown) {
            console.error("error in actor", {
              error,
              actor: actor[FactoryNameSymbol],
            })
          } finally {
            removeListener()
          }
        }
      })
    },
    ask: (method, message) => {
      const handler = signal.read()?.[method]

      return new Promise((resolve, reject) => {
        if (handler) {
          resolve(
            (
              handler as (
                parameter: typeof message
              ) => InferActorReturnType<Awaited<TInstance>, typeof method>
            )(message)
          )
          return
        }

        const removeListener = signal.on((handlerRecord) => {
          const handler = handlerRecord?.[method]

          if (handler) {
            try {
              resolve(
                (
                  handler as (
                    parameter: typeof message
                  ) => InferActorReturnType<Awaited<TInstance>, typeof method>
                )(message)
              )
            } catch (error) {
              reject(error)
            } finally {
              removeListener()
            }
          }
        })
      })
    },
  }

  return actor
}

export const isActor = (
  object: unknown
): object is Actor<MessageHandlerRecord, unknown> =>
  isObject(object) && object[ActorSymbol] === true
