import { defaultSelector } from "./actor-context"
import {
  ReactiveSelector,
  ReactiveSource,
  defaultComparator,
} from "./internal/reactive"
import { Reactor } from "./reactor"
import { Factory } from "./types/factory"
import { ReactiveContext } from "./types/reactive-context"
import { StatefulContext } from "./types/stateful-context"

export class ReactiveContextImplementation<TBase extends object>
  implements StatefulContext<TBase>, ReactiveContext
{
  constructor(
    /**
     * A reference to the current reactor.
     *
     * @remarks
     *
     * If you want to pass something to an external component to allow that component to interact with the reactive system, you can use this reference.
     */
    readonly reactor: Reactor<TBase>,

    /**
     * A function which allows tracked reads of signals.
     */
    readonly _get: <TState>(signal: ReactiveSource<TState>) => TState,
  ) {}

  readAndTrack<TState, TSelection>(
    signalFactory:
      | Factory<ReactiveSource<TState>, TBase>
      | ReactiveSource<TState>,
    // Based on the overloaded function signature, the selector parameter may be omitted iff TMessage equals TSelection.
    // Therefore this cast is safe.
    selector: (state: TState) => TSelection = defaultSelector as unknown as (
      state: TState,
    ) => TSelection,
    comparator: (a: TSelection, b: TSelection) => boolean = defaultComparator,
  ) {
    const signal =
      typeof signalFactory === "function"
        ? this.reactor.use(signalFactory)
        : signalFactory

    if (selector === defaultSelector && comparator === defaultComparator) {
      return this._get(signal)
    } else {
      const intermediateSignal = new ReactiveSelector(
        signal,
        selector,
        comparator,
      )
      return this._get(intermediateSignal)
    }
  }

  readKeysAndTrack<TState, TKeys extends keyof TState>(
    signal: Factory<ReactiveSource<TState>, TBase> | ReactiveSource<TState>,
    keys: readonly TKeys[],
  ): Pick<TState, TKeys> {
    return this.readAndTrack(
      signal,
      (state) => {
        const result = {} as Pick<TState, TKeys>
        for (const key of keys) {
          result[key] = state[key]
        }
        return result
      },
      (a, b) => {
        for (const key of keys) {
          if (a[key] !== b[key]) {
            return false
          }
        }
        return true
      },
    )
  }

  read<TState>(
    signalFactory:
      | Factory<ReactiveSource<TState>, TBase>
      | ReactiveSource<TState>,
  ): TState {
    const signal =
      typeof signalFactory === "function"
        ? this.reactor.use(signalFactory)
        : signalFactory

    return signal.read()
  }
}
