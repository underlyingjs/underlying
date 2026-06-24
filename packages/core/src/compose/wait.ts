import type { Scheduler } from '../scheduler/scheduler'

/**
 * A delay on the frame clock (clamped, batched into the single loop), never on
 * setTimeout: a background tab pauses the delay like everything else. Returns an
 * unsubscribe that cancels a still-pending wait. Shared by stagger() and the
 * animate() delay wave so there is ONE frame-clock delay implementation.
 */
export const waitFrames = (ms: number, scheduler: Scheduler, onDone: () => void): (() => void) => {
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
