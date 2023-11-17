import { createActor } from "../actor"
import { Reactor, createReactor } from "../reactor"
import { createTopic } from "../topic"

const PingPongTopic = () => createTopic<string>()

const PingerActor = () =>
  createActor((sig) => {
    sig.on(PingPongTopic, (message) => {
      if (message === "pong") {
        sig.timeout(() => {
          sig.use(PingPongTopic).emit("ping")
        }, 75)
      }
    })
  })

const PongerActor = () =>
  createActor((sig) => {
    sig.on(PingPongTopic, (message) => {
      if (message === "ping") {
        sig.timeout(() => {
          sig.use(PingPongTopic).emit("pong")
        }, 75)
      }
    })
  })

const LoggerActor = () =>
  createActor((sig) => {
    sig.on(PingPongTopic, console.info)
  })

const RootActor = (reactor: Reactor) =>
  createActor((sig) => {
    sig.run(PingerActor)
    sig.run(PongerActor)
    sig.run(LoggerActor)
    sig.use(PingPongTopic).emit("ping")
    sig.timeout(() => void reactor.dispose(), 500)
  })

createReactor(RootActor)
