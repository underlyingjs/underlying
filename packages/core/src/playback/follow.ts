import { simulationMotion } from '../physics/motion'
import { SIMULATION_TIMESTEP_S, type SimulationState } from '../physics/simulation'
import { springSimulation, type SpringOptions } from '../physics/spring'
import type { Scheduler } from '../scheduler/scheduler'
import { getSharedScheduler } from '../scheduler/shared'
import { animatable, type Animatable } from '../value/animatable'

export interface FollowOptions extends SpringOptions {
  /** The scheduler to run on; defaults to the shared rAF loop. */
  scheduler?: Scheduler
}

export interface Follow {
  /** The tracking value: read get()/velocity(), subscribe on('change'). */
  readonly value: Animatable
  /** Re-aim the spring at a moving target. Velocity is conserved; NO Motion rebuild. */
  target(next: number): void
  /** Freeze the spring in place. */
  stop(): void
  /** Stop and release the value and the frame subscription. */
  dispose(): void
}

const H = SIMULATION_TIMESTEP_S

/**
 * A value that springs toward a moving target: the momentum-scrub seam for
 * scroll. The default config is critically damped, so a scrub never overshoots.
 * target() mutates the spring's aim in place rather than rebuilding the Motion,
 * so a per-frame scroll handler allocates nothing after construction.
 */
export function follow(initial: number, options: FollowOptions = {}): Follow {
  const scheduler = options.scheduler ?? getSharedScheduler()
  const value = animatable(initial, { scheduler })

  const stiffness = options.stiffness ?? 100
  const mass = options.mass ?? 1
  // Critically damped unless the caller overrides: monotonic, no overshoot.
  const damping = options.damping ?? 2 * Math.sqrt(stiffness * mass)
  const sim = springSimulation(initial, { ...options, stiffness, damping, mass })
  const motion = simulationMotion(sim)

  let lastTarget = initial
  let prev: SimulationState = { position: initial, velocity: 0 }
  let curr: SimulationState = prev
  let accumulatorS = 0
  let unsubscribe: (() => void) | null = null
  let disposed = false

  const onFrame = ({ deltaMs }: { deltaMs: number }) => {
    accumulatorS += deltaMs / 1000
    while (accumulatorS >= H) {
      accumulatorS -= H
      prev = curr
      curr = motion.step(curr, H)
      const rested = motion.rest(curr)
      if (rested !== null) {
        value.drive({ position: rested, velocity: 0 })
        unsubscribe?.()
        unsubscribe = null
        return
      }
    }
    const alpha = accumulatorS / H
    value.drive({
      position: prev.position + (curr.position - prev.position) * alpha,
      velocity: prev.velocity + (curr.velocity - prev.velocity) * alpha,
    })
  }

  const ensureRunning = () => {
    if (unsubscribe === null && !disposed) unsubscribe = scheduler.subscribe(onFrame)
  }

  return {
    value,
    target(next) {
      if (next === lastTarget) return
      lastTarget = next
      sim.retarget(next) // in place: no springSimulation/simulationMotion allocation
      // Re-seed from the value's live state so velocity is conserved across the re-aim.
      curr = { position: value.get(), velocity: value.velocity() }
      prev = curr
      accumulatorS = 0
      ensureRunning()
    },
    stop() {
      unsubscribe?.()
      unsubscribe = null
    },
    dispose() {
      disposed = true
      unsubscribe?.()
      unsubscribe = null
      value.dispose()
    },
  }
}
