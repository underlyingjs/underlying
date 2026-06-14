import type { Scheduler } from '../scheduler/scheduler'
import { getSharedScheduler } from '../scheduler/shared'
import type { AnimationHandle } from '../value/animatable'

/** A deferred animation: called when its turn comes. */
export type AnimationStep = () => AnimationHandle

export interface StaggerOptions {
  scheduler?: Scheduler
}

// Delays run on the frame clock (clamped, batched into the single loop),
// never on setTimeout: a background tab pauses delays like everything else.
const wait = (ms: number, scheduler: Scheduler, onDone: () => void): (() => void) => {
  let elapsedMs = 0
  const unsubscribe = scheduler.subscribe(({ deltaMs }) => {
    elapsedMs += deltaMs
    if (elapsedMs >= ms) {
      unsubscribe()
      onDone()
    }
  })
  return unsubscribe
}

/**
 * Starts `animation` on each item, item i delayed by i * delayMs.
 * The returned handle aggregates them: `finished` resolves when every item
 * has rested; `stop` cancels pending starts and freezes running items.
 */
export function stagger<T>(
  items: readonly T[],
  animation: (item: T, index: number) => AnimationHandle,
  delayMs = 0,
  options: StaggerOptions = {},
): AnimationHandle {
  const scheduler = options.scheduler ?? getSharedScheduler()
  let stopped = false
  let remaining = items.length
  let resolveFinished = () => {}
  const finished =
    items.length === 0
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          resolveFinished = resolve
        })
  const cancelWaits: Array<() => void> = []
  const started: AnimationHandle[] = []

  const complete = () => {
    remaining -= 1
    if (remaining === 0) resolveFinished()
  }
  const start = (item: T, index: number) => {
    if (stopped) return
    const handle = animation(item, index)
    started.push(handle)
    void handle.finished.then(complete)
  }

  items.forEach((item, index) => {
    const delay = delayMs * index
    if (delay <= 0) start(item, index)
    else cancelWaits.push(wait(delay, scheduler, () => start(item, index)))
  })

  return {
    finished,
    stop: () => {
      if (stopped) return
      stopped = true
      for (const cancel of cancelWaits) cancel()
      for (const handle of started) handle.stop()
      resolveFinished()
    },
  }
}

/**
 * Runs steps one after another, each starting when the previous one rests.
 * `stop` freezes the current step and cancels the remaining ones.
 * `finished` resolves at the end (or on stop) - never rejects.
 *
 * The low-level ordered-handle primitive. For fluent, interruptible authoring
 * (verbs, overlap, pause/timeScale) use `sequence()` from `@underlying/core/playback`.
 */
export function chain(steps: readonly AnimationStep[]): AnimationHandle {
  let stopped = false
  let current: AnimationHandle | null = null
  let resolveFinished = () => {}
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve
  })

  void (async () => {
    for (const step of steps) {
      if (stopped) return
      current = step()
      await current.finished
    }
    resolveFinished()
  })()

  return {
    finished,
    stop: () => {
      if (stopped) return
      stopped = true
      current?.stop()
      resolveFinished()
    },
  }
}
