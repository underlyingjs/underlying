import { describe, expect, it } from 'vitest'
import { createManualDriver, type ManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animatable } from '../value/animatable'
import { decaySimulation } from './decay'
import { simulationMotion } from './motion'
import { MAX_STEPS_PER_FRAME, record, sampledMotion } from './sampled'
import { SIMULATION_TIMESTEP_S } from './simulation'
import { springSimulation, type SpringOptions } from './spring'

const spring =
  (target: number, options: SpringOptions = {}) =>
  () =>
    simulationMotion(springSimulation(target, options))

/** Pump a live value to an absolute wall time (ms must be a multiple of 16). */
function pumpTo(driver: ManualDriver, toMs: number): void {
  for (let t = 0; t <= toMs; t += 16) driver.frame(t)
}

function liveValue(initial: number): { driver: ManualDriver; value: ReturnType<typeof animatable> } {
  const driver = createManualDriver()
  return { driver, value: animatable(initial, { scheduler: createScheduler(driver) }) }
}

describe('record', () => {
  it('discovers a finite duration for a damped spring and snaps exactly at rest', () => {
    const traj = record(spring(100), { position: 0, velocity: 0 })
    expect(traj).not.toBeNull()
    expect(traj!.durationS).toBeGreaterThan(0)
    expect(traj!.durationS).toBeLessThan(5)
    expect(traj!.sample(traj!.durationS).position).toBe(100)
  })

  it('returns null when the motion never rests (undamped spring)', () => {
    const traj = record(spring(100, { damping: 0 }), { position: 0, velocity: 0 }, { maxSteps: 5000 })
    expect(traj).toBeNull()
  })

  it('sample(t) matches a live animatable pumped to wall-time t', () => {
    const target = 100
    const traj = record(spring(target), { position: 0, velocity: 0 })!
    for (const toMs of [96, 208, 304, 400, 608]) {
      const { driver, value } = liveValue(0)
      value.spring(target)
      pumpTo(driver, toMs)
      const s = traj.sample(toMs / 1000)
      expect(s.position).toBeCloseTo(value.get(), 6)
      expect(s.velocity).toBeCloseTo(value.velocity(), 6)
    }
  })

  it('reconstructs identically whatever the checkpoint stride', () => {
    const target = 250
    const dense = record(spring(target), { position: 0, velocity: 0 }, { checkpointStride: 1 })!
    const sparse = record(spring(target), { position: 0, velocity: 0 }, { checkpointStride: 64 })!
    for (const toMs of [50, 150, 350, 700]) {
      expect(dense.sample(toMs / 1000).position).toBeCloseTo(sparse.sample(toMs / 1000).position, 9)
    }
  })

  it('rebuilds a stateful decay per cold seek so the latched edge re-forms', () => {
    const make = () => simulationMotion(decaySimulation({ velocity: 2000, timeConstant: 500, max: 100 }))
    const traj = record(make, { position: 0, velocity: 2000 }, { stateful: true })!
    // The glide overshoots the boundary then rubber-bands back to land exactly on it.
    expect(traj.sample(traj.durationS).position).toBe(100)

    // A live decay pumped past the crossing matches the rebuilt mid-flight sample.
    const midMs = 16 * Math.floor((traj.durationS * 1000 * 0.5) / 16)
    const { driver, value } = liveValue(0)
    value.decay({ velocity: 2000, timeConstant: 500, max: 100 })
    pumpTo(driver, midMs)
    expect(traj.sample(midMs / 1000).position).toBeCloseTo(value.get(), 4)
  })
})

describe('sampledMotion', () => {
  it('seeks the playhead and continues stepping from there', () => {
    const traj = record(spring(100), { position: 0, velocity: 0 })!
    const motion = sampledMotion(traj)
    expect(motion.durationS).toBe(traj.durationS)

    const half = traj.durationS / 2
    const mid = motion.seek(half)
    expect(mid.position).toBeCloseTo(traj.sample(half).position, 9)

    const next = motion.step({ position: mid.position, velocity: mid.velocity }, SIMULATION_TIMESTEP_S)
    expect(next.position).toBeCloseTo(traj.sample(half + SIMULATION_TIMESTEP_S).position, 9)
  })

  it('rests once the playhead reaches the duration', () => {
    const traj = record(spring(100), { position: 0, velocity: 0 })!
    const motion = sampledMotion(traj)
    expect(motion.rest(motion.seek(traj.durationS / 2))).toBeNull()
    expect(motion.rest(motion.seek(traj.durationS))).toBe(100)
  })

  it('exposes the per-frame step guardrail', () => {
    expect(MAX_STEPS_PER_FRAME).toBe(240)
  })
})
