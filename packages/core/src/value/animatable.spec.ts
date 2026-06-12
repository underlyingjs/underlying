import { describe, expect, it, vi } from 'vitest'
import { linear } from '../physics/easings'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animatable } from './animatable'

function setup(initial = 0) {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const value = animatable(initial, { scheduler })
  return { driver, scheduler, value }
}

/** Drive frames until rest (or the time budget runs out). Returns last timestamp. */
function driveToRest(
  driver: ReturnType<typeof createManualDriver>,
  value: ReturnType<typeof animatable>,
  intervalMs = 16,
  maxMs = 60_000,
): number {
  let t = 0
  while (value.isAnimating() && t <= maxMs) {
    driver.frame(t)
    t += intervalMs
  }
  return t
}

describe('animatable', () => {
  it('starts at its initial value, idle', () => {
    const { driver, value } = setup(5)
    expect(value.get()).toBe(5)
    expect(value.velocity()).toBe(0)
    expect(value.isAnimating()).toBe(false)
    expect(driver.pendingCount()).toBe(0)
  })

  it('set() teleports: cancels the animation, resets velocity, emits change', () => {
    const { driver, value } = setup(0)
    const onChange = vi.fn()
    value.on('change', onChange)
    value.spring(100)
    driver.frame(0)
    driver.frame(32)

    value.set(7)
    expect(value.get()).toBe(7)
    expect(value.velocity()).toBe(0)
    expect(value.isAnimating()).toBe(false)
    expect(onChange).toHaveBeenLastCalledWith(7)
    expect(driver.pendingCount()).toBe(0)
  })

  it('spring settles exactly on its target and the loop goes back to sleep', async () => {
    const { driver, value } = setup(0)
    const onRest = vi.fn()
    value.on('rest', onRest)
    const handle = value.spring(100)

    const elapsed = driveToRest(driver, value)
    expect(elapsed).toBeLessThan(60_000)
    expect(value.get()).toBe(100) // exact snap, not approximately
    expect(value.velocity()).toBe(0)
    expect(onRest).toHaveBeenCalledTimes(1)
    expect(driver.pendingCount()).toBe(0)
    await handle.finished // resolves, never rejects
  })

  it('retargeting mid-flight inherits position and velocity exactly', () => {
    const { driver, value } = setup(0)
    value.spring(100)
    for (let t = 0; t <= 320; t += 16) driver.frame(t)
    const position = value.get()
    const velocity = value.velocity()
    expect(velocity).not.toBe(0)

    value.spring(-50)
    expect(value.get()).toBe(position)
    expect(value.velocity()).toBe(velocity)
  })

  it('retargeting produces no visible jump on the following frame', () => {
    const { driver, value } = setup(0)
    value.spring(100)
    for (let t = 0; t <= 320; t += 16) driver.frame(t)
    const position = value.get()
    const velocity = value.velocity()

    value.spring(-50)
    driver.frame(336)
    // One 16 ms frame later the value sits near its ballistic continuation.
    expect(Math.abs(value.get() - (position + velocity * 0.016))).toBeLessThan(5)
  })

  it('spring accepts an imposed initial velocity (drag handoff)', () => {
    const { driver, value } = setup(0)
    value.spring(100, { velocity: 1200 })
    expect(value.velocity()).toBe(1200)

    driver.frame(0)
    driver.frame(16)
    driver.frame(32)
    // ~1200 u/s over ~24 ms of rendered simulation (interpolated rendering
    // trails wall clock by one 8.33 ms timestep, by design).
    expect(value.get()).toBeGreaterThan(15)
  })

  it('the same input sequence produces the exact same trajectory', () => {
    const a = setup(0)
    const b = setup(0)
    const samplesA: number[] = []
    const samplesB: number[] = []
    a.value.on('change', (v) => samplesA.push(v))
    b.value.on('change', (v) => samplesB.push(v))

    a.value.spring(100, { velocity: 300 })
    b.value.spring(100, { velocity: 300 })
    for (let t = 0; t <= 480; t += 16) a.driver.frame(t)
    for (let t = 0; t <= 480; t += 16) b.driver.frame(t)

    expect(samplesA.length).toBeGreaterThan(10)
    expect(samplesA).toEqual(samplesB)
  })

  it('the trajectory does not depend on the frame rate (fixed timestep)', () => {
    const at120 = setup(0)
    const at60 = setup(0)
    at120.value.spring(100)
    at60.value.spring(100)

    for (let t = 0; t <= 480; t += 8) at120.driver.frame(t)
    for (let t = 0; t <= 480; t += 16) at60.driver.frame(t)

    expect(at120.value.get()).toBeCloseTo(at60.value.get(), 6)
    expect(at120.value.velocity()).toBeCloseTo(at60.value.velocity(), 6)
  })

  it('a stiff spring fed clamped giant deltas never explodes', () => {
    const { driver, value } = setup(0)
    const samples: number[] = []
    value.on('change', (v) => samples.push(v))
    value.spring(100, { stiffness: 5000, damping: 50 })

    let t = 0
    while (value.isAnimating() && t <= 200 * 600) {
      driver.frame(t) // 200 ms apart: the scheduler clamps each delta to 64 ms
      t += 200
    }

    expect(value.isAnimating()).toBe(false)
    expect(value.get()).toBe(100)
    for (const sample of samples) {
      expect(Number.isFinite(sample)).toBe(true)
      expect(Math.abs(sample)).toBeLessThan(500)
    }
  })

  it('stop() freezes in place, velocity stays readable, no rest event', () => {
    const { driver, value } = setup(0)
    const onRest = vi.fn()
    value.on('rest', onRest)
    value.spring(100)
    for (let t = 0; t <= 160; t += 16) driver.frame(t)
    const position = value.get()
    const velocity = value.velocity()
    expect(velocity).not.toBe(0)

    value.stop()
    expect(value.isAnimating()).toBe(false)
    expect(value.get()).toBe(position)
    expect(value.velocity()).toBe(velocity)
    expect(onRest).not.toHaveBeenCalled()
    expect(driver.pendingCount()).toBe(0)
  })

  it("a stale handle's stop() does not affect the current animation", async () => {
    const { value } = setup(0)
    const first = value.spring(100)
    value.spring(50)
    await first.finished // replaced -> resolved, not rejected

    first.stop()
    expect(value.isAnimating()).toBe(true)
  })

  it("'change' reports the current value on every frame the value moves", () => {
    const { driver, value } = setup(0)
    const onChange = vi.fn()
    value.on('change', onChange)
    value.spring(100)
    for (let t = 0; t <= 160; t += 16) driver.frame(t)

    expect(onChange.mock.calls.length).toBeGreaterThan(3)
    expect(onChange).toHaveBeenLastCalledWith(value.get())
  })

  it('two animatables share a single driver schedule per frame', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const x = animatable(0, { scheduler })
    const y = animatable(0, { scheduler })

    x.spring(100)
    y.spring(-100)
    expect(driver.scheduleCalls()).toBe(1)

    driver.frame(0)
    driver.frame(16)
    expect(driver.scheduleCalls()).toBe(3)
    expect(x.get()).toBeGreaterThan(0)
    expect(y.get()).toBeLessThan(0)
  })

  it('dispose() stops the animation and removes listeners', () => {
    const { driver, value } = setup(0)
    const onChange = vi.fn()
    value.on('change', onChange)
    value.spring(100)

    value.dispose()
    expect(value.isAnimating()).toBe(false)
    expect(driver.pendingCount()).toBe(0)
    driver.frame(0)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('decay glides to rest at approximately v0 * tau', () => {
    const { driver, value } = setup(0)
    value.decay({ velocity: 1000, timeConstant: 325 })

    driveToRest(driver, value)
    expect(value.isAnimating()).toBe(false)
    // Distance de glide discrète en Euler semi-implicite : v0 * (tau - h),
    // soit v0 * tau à un biais de h/tau ~ 2,6 % près - imperceptible, consigné.
    expect(value.get()).toBeCloseTo(1000 * (0.325 - 1 / 120), 0)
    expect(value.velocity()).toBe(0)
  })

  it('spring -> decay handoff inherits position and velocity exactly', () => {
    const { driver, value } = setup(0)
    value.spring(100)
    for (let t = 0; t <= 160; t += 16) driver.frame(t)
    const position = value.get()
    const velocity = value.velocity()
    expect(velocity).not.toBe(0)

    value.decay()
    expect(value.get()).toBe(position)
    expect(value.velocity()).toBe(velocity)

    driver.frame(176)
    expect(Math.abs(value.get() - (position + velocity * 0.016))).toBeLessThan(5)
  })

  it('decay -> spring handoff inherits position and velocity exactly', () => {
    const { driver, value } = setup(0)
    value.decay({ velocity: 1500 })
    for (let t = 0; t <= 160; t += 16) driver.frame(t)
    const position = value.get()
    const velocity = value.velocity()
    expect(velocity).toBeGreaterThan(0)

    value.spring(0)
    expect(value.get()).toBe(position)
    expect(value.velocity()).toBe(velocity)
  })

  it('decay clamps on a boundary like a rubber band and settles exactly on the edge', () => {
    const { driver, value } = setup(0)
    const samples: number[] = []
    value.on('change', (v) => samples.push(v))
    value.decay({ velocity: 2000, timeConstant: 500, max: 100 })

    driveToRest(driver, value)
    expect(value.get()).toBe(100) // snap exact sur la borne
    expect(Math.max(...samples)).toBeGreaterThan(100) // il a réellement débordé…
    expect(Math.max(...samples)).toBeLessThan(300) // …mais de façon bornée (rubber band)
  })

  it('to() follows its easing over its duration and settles exactly', () => {
    const { driver, value } = setup(0)
    const onRest = vi.fn()
    value.on('rest', onRest)
    value.to(100, { duration: 480, easing: linear })

    for (let t = 0; t <= 256; t += 16) driver.frame(t)
    expect(value.get()).toBeGreaterThan(40) // ~mi-parcours d'un tween linéaire
    expect(value.get()).toBeLessThan(60)

    for (let t = 272; t <= 640; t += 16) driver.frame(t)
    expect(value.isAnimating()).toBe(false)
    expect(value.get()).toBe(100)
    expect(onRest).toHaveBeenCalledTimes(1)
  })

  it('to() exposes a derived velocity and a spring can take over mid-tween', () => {
    const { driver, value } = setup(0)
    value.to(100, { duration: 1000, easing: linear })
    for (let t = 0; t <= 320; t += 16) driver.frame(t)
    expect(value.velocity()).toBeCloseTo(100, 3) // 100 unités en 1 s - dérivée lisible

    const position = value.get()
    const velocity = value.velocity()
    value.spring(0)
    expect(value.get()).toBe(position)
    expect(value.velocity()).toBe(velocity)
  })

  it('to() with zero duration settles on the first simulated step', () => {
    const { driver, value } = setup(0)
    value.to(100, { duration: 0 })
    driver.frame(0)
    driver.frame(16)
    expect(value.get()).toBe(100)
    expect(value.isAnimating()).toBe(false)
  })

  it('set() accepts a seeded velocity for external handoffs', () => {
    const { driver, value } = setup(0)
    value.set(50, { velocity: 800 })
    expect(value.get()).toBe(50)
    expect(value.velocity()).toBe(800)

    value.spring(100)
    expect(value.velocity()).toBe(800) // héritée par le spring
    driver.frame(0)
    driver.frame(16)
    expect(value.get()).toBeGreaterThan(50)
  })

  it('unsubscribing a listener is effective and idempotent', () => {
    const { driver, value } = setup(0)
    const onChange = vi.fn()
    const unsubscribe = value.on('change', onChange)
    unsubscribe()
    unsubscribe()

    value.spring(100)
    driver.frame(0)
    driver.frame(16)
    expect(onChange).not.toHaveBeenCalled()
  })
})
