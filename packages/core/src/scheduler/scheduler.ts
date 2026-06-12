import type { CancelFrame, FrameDriver } from './driver'

export interface FrameInfo {
  /** Time since the previous frame, in ms. 0 on the first frame after a wake. */
  deltaMs: number
  /** Driver timestamp of this frame, in ms. */
  timestampMs: number
}

export type FrameCallback = (frame: FrameInfo) => void

/**
 * 'update' (default) runs simulations; 'render' runs DOM writes, after every
 * update of the same tick. A render subscription made during the update phase
 * still runs this tick - that is what lets bindings batch all style writes
 * produced by a frame into a single flush.
 */
export type FramePhase = 'update' | 'render'

export interface Scheduler {
  /** Register a per-frame callback. Starts the loop if it was sleeping. */
  subscribe(callback: FrameCallback, phase?: FramePhase): () => void
  isRunning(): boolean
}

/**
 * Upper bound on the delta fed to subscribers. After a freeze (inactive tab,
 * GC pause, breakpoint) the lost time is dropped, never replayed: physics
 * must not teleport.
 */
export const MAX_FRAME_DELTA_MS = 64

export function createScheduler(driver: FrameDriver): Scheduler {
  const updateSubscribers = new Set<FrameCallback>()
  const renderSubscribers = new Set<FrameCallback>()
  let cancelFrame: CancelFrame | null = null
  let lastTimestampMs: number | null = null
  let running = false
  let inTick = false

  const count = () => updateSubscribers.size + renderSubscribers.size

  const stop = () => {
    cancelFrame?.()
    cancelFrame = null
    lastTimestampMs = null
    running = false
  }

  // Snapshot: subscriptions made during a phase start at that phase's next
  // run. The membership check skips callbacks removed earlier in the tick.
  const runPhase = (subscribers: Set<FrameCallback>, frame: FrameInfo) => {
    for (const callback of [...subscribers]) {
      if (subscribers.has(callback)) callback(frame)
    }
  }

  const tick = (timestampMs: number) => {
    const deltaMs =
      lastTimestampMs === null
        ? 0
        : Math.min(timestampMs - lastTimestampMs, MAX_FRAME_DELTA_MS)
    lastTimestampMs = timestampMs
    const frame: FrameInfo = { deltaMs, timestampMs }

    inTick = true
    runPhase(updateSubscribers, frame)
    runPhase(renderSubscribers, frame) // snapshot after updates: same-tick flushes
    inTick = false

    if (count() > 0) {
      cancelFrame = driver.schedule(tick)
    } else {
      cancelFrame = null
      stop()
    }
  }

  return {
    subscribe(callback, phase = 'update') {
      const subscribers = phase === 'render' ? renderSubscribers : updateSubscribers
      subscribers.add(callback)
      if (!running) {
        running = true
        cancelFrame = driver.schedule(tick)
      }
      return () => {
        subscribers.delete(callback)
        // Mid-tick, the loop decides for itself at the end of the tick.
        if (count() === 0 && running && !inTick) stop()
      }
    },
    isRunning: () => running,
  }
}
