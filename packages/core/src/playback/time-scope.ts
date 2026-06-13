import {
  MAX_FRAME_DELTA_MS,
  type FrameCallback,
  type FrameInfo,
  type FramePhase,
  type Scheduler,
} from '../scheduler/scheduler'
import { getSharedScheduler } from '../scheduler/shared'

/**
 * A Scheduler that wraps a parent and scales the time its members see. This is
 * the pause / timeScale mechanism: the integrator behind every member still
 * only ever steps by SIMULATION_TIMESTEP_S, so timeScale changes how many
 * steps a wall-frame consumes, never the step size. The 60/120/144 Hz
 * convergence the physics asserts is therefore structurally untouched.
 *
 * The scope subscribes the parent once per phase and fans a single shared
 * FrameInfo to its members (no per-member parent subscription). On pause() it
 * drops the parent subscription so the rAF loop sleeps.
 */
export interface TimeScope extends Scheduler {
  /** Freeze: drop the parent subscription so the loop can sleep. Resumable. */
  pause(): void
  /** Resume real time, re-subscribing the parent. No-op if not paused. */
  resume(): void
  isPaused(): boolean
  /** Time dilation. 0 stops integration but stays subscribed (unlike pause). */
  setTimeScale(rate: number): void
  getTimeScale(): number
  /** Drop the parent subscription and forget all members. */
  dispose(): void
}

export interface TimeScopeOptions {
  /** Parent scheduler; defaults to the shared rAF loop. */
  scheduler?: Scheduler
  /** Initial time scale. Default 1. */
  timeScale?: number
  /** Start paused (no parent subscription). Default false. */
  paused?: boolean
}

export function timeScope(options: TimeScopeOptions = {}): TimeScope {
  const parent = options.scheduler ?? getSharedScheduler()
  let timeScale = options.timeScale ?? 1
  let paused = options.paused ?? false

  const members: Record<FramePhase, Set<FrameCallback>> = { update: new Set(), render: new Set() }
  const detach: Record<FramePhase, (() => void) | null> = { update: null, render: null }

  // Scale the delta, then re-clamp: the real scheduler clamps BEFORE us, so a
  // scale-up could otherwise push past the freeze guard and teleport.
  const fan = (phase: FramePhase) => (frame: FrameInfo) => {
    const scaled = Math.min(frame.deltaMs * timeScale, MAX_FRAME_DELTA_MS)
    const shared: FrameInfo = { deltaMs: scaled, timestampMs: frame.timestampMs }
    const set = members[phase]
    for (const callback of [...set]) if (set.has(callback)) callback(shared)
  }

  const attach = (phase: FramePhase) => {
    if (!paused && detach[phase] === null && members[phase].size > 0) {
      detach[phase] = parent.subscribe(fan(phase), phase)
    }
  }
  const detachPhase = (phase: FramePhase) => {
    detach[phase]?.()
    detach[phase] = null
  }
  const detachAll = () => {
    detachPhase('update')
    detachPhase('render')
  }
  const attachAll = () => {
    attach('update')
    attach('render')
  }

  return {
    subscribe(callback, phase = 'update') {
      members[phase].add(callback)
      attach(phase)
      return () => {
        members[phase].delete(callback)
        if (members[phase].size === 0) detachPhase(phase)
      }
    },
    isRunning: () => detach.update !== null || detach.render !== null,
    pause() {
      if (paused) return
      paused = true
      detachAll()
    },
    resume() {
      if (!paused) return
      paused = false
      attachAll()
    },
    isPaused: () => paused,
    setTimeScale(rate) {
      timeScale = rate
    },
    getTimeScale: () => timeScale,
    dispose() {
      detachAll()
      members.update.clear()
      members.render.clear()
    },
  }
}
