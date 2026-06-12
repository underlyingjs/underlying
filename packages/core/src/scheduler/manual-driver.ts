import type { FrameDriver } from './driver'

/**
 * Test-only frame driver: frames are produced by calling `frame(timestampMs)`
 * manually, with full control over timestamps (and therefore deltas).
 * Not exported from the package entry point.
 */
export interface ManualDriver extends FrameDriver {
  /** Run all callbacks scheduled for the next frame, at the given timestamp. */
  frame(timestampMs: number): void
  /** Number of callbacks currently waiting for the next frame. */
  pendingCount(): number
  /** Total number of schedule() calls since creation (batching assertions). */
  scheduleCalls(): number
}

export function createManualDriver(): ManualDriver {
  let pending: Array<(timestampMs: number) => void> = []
  let calls = 0

  return {
    schedule(callback) {
      calls += 1
      pending.push(callback)
      return () => {
        pending = pending.filter((p) => p !== callback)
      }
    },
    frame(timestampMs) {
      const batch = pending
      pending = []
      for (const callback of batch) callback(timestampMs)
    },
    pendingCount: () => pending.length,
    scheduleCalls: () => calls,
  }
}
