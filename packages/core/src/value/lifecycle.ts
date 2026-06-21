// The animation lifecycle surface, shared by animatable, the playback handles, and
// animate(). Callbacks ride the existing options object; physics builders never see
// them (their option types stay lifecycle-blind), and a small per-run registry fans
// the events. A handle also exposes eventCallback() to attach/replace them post-hoc.

/** The lifecycle moments a run can emit. `repeat`/`reverseComplete` are playback-only. */
export type LifecycleEvent = 'start' | 'update' | 'complete' | 'interrupt' | 'repeat' | 'reverseComplete'

export interface LifecycleCallbacks<H = unknown> {
  /** Fired once when the run begins (after any delay). Also fires on the reduced/instant path. */
  onStart?(this: object, handle: H): void
  /** Per frame with the live value. A number on animatable/playable; the values object on animate(). */
  onUpdate?(this: object, value: number, handle: H): void
  /** Natural settle to rest. Never fires for an Infinity-repeat run. Fires on the reduced/instant path. */
  onComplete?(this: object, handle: H): void
  /** Replaced, stopped, teleported, or disposed mid-flight. Never fires on the reduced/instant path. */
  onInterrupt?(this: object, handle: H): void
  /** Playable only: an iteration boundary (the iteration index is the run's repeat count so far). */
  onRepeat?(this: object, handle: H): void
  /** Playable only: a reversed leg reached its start. */
  onReverseComplete?(this: object, handle: H): void
  /** The `this` receiver for every callback. Defaults to the handle. */
  scope?: object
}

const EVENT_TO_KEY: Record<LifecycleEvent, keyof LifecycleCallbacks> = {
  start: 'onStart',
  update: 'onUpdate',
  complete: 'onComplete',
  interrupt: 'onInterrupt',
  repeat: 'onRepeat',
  reverseComplete: 'onReverseComplete',
}

export interface LifecycleRegistry<H> {
  /** Load the callbacks (and scope) from an options bag. Ignores a missing/empty bag. */
  seed(callbacks: LifecycleCallbacks<H> | undefined): void
  /** Attach or (with null) clear one event's callback - the post-hoc eventCallback path. Last writer wins. */
  set(event: LifecycleEvent, fn: ((handle: H) => void) | null): void
  /** True if anyone is listening for this event (lets callers skip work, e.g. force the JS path for `update`). */
  has(event: LifecycleEvent): boolean
  /** Invoke the event's callback with the configured scope (`update` also passes the value). */
  fire(event: LifecycleEvent, handle: H, value?: number): void
}

// deno-lint-ignore no-explicit-any
type AnyFn = (...args: any[]) => void

export function lifecycleRegistry<H>(): LifecycleRegistry<H> {
  const fns: Partial<Record<LifecycleEvent, AnyFn>> = {}
  let scope: object | undefined

  return {
    seed(callbacks) {
      if (callbacks === undefined) return
      if (callbacks.scope !== undefined) scope = callbacks.scope
      for (const event of Object.keys(EVENT_TO_KEY) as LifecycleEvent[]) {
        const fn = callbacks[EVENT_TO_KEY[event]]
        if (typeof fn === 'function') fns[event] = fn as AnyFn
      }
    },
    set(event, fn) {
      if (fn === null) delete fns[event]
      else fns[event] = fn as AnyFn
    },
    has(event) {
      return fns[event] !== undefined
    },
    fire(event, handle, value) {
      const fn = fns[event]
      if (fn === undefined) return
      const receiver = scope ?? (handle as object)
      if (event === 'update') fn.call(receiver, value, handle)
      else fn.call(receiver, handle)
    },
  }
}
