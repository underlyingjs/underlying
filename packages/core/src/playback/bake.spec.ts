import { afterEach, describe, expect, it, vi } from 'vitest'
import { createManualDriver, type ManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animatable } from '../value/animatable'
import { __resetWarnings } from '../value/warn'
import { playable } from './playable'

function setup(initial = 0) {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const value = animatable(initial, { scheduler })
  return { driver, scheduler, value, pv: playable(value, { scheduler }) }
}

function pumpMs(driver: ManualDriver, from: number, toMs: number): number {
  let t = from
  for (; t <= toMs; t += 16) driver.frame(t)
  return t
}

function driveUntil(driver: ManualDriver, from: number, predicate: () => boolean, maxMs = 20_000): number {
  let t = from
  while (!predicate() && t - from <= maxMs) {
    driver.frame(t)
    t += 16
  }
  return t
}

afterEach(() => {
  __resetWarnings()
  vi.restoreAllMocks()
})

describe('bake', () => {
  it('turns a settling spring seekable; seeks are exact and idempotent', () => {
    const { value, pv } = setup(0)
    const h = pv.spring(100, { paused: true })
    expect(h.seekable).toBe(false)

    expect(h.bake()).toBe(true)
    expect(h.seekable).toBe(true)
    const dur = h.duration()
    expect(dur).toBeGreaterThan(0)

    h.seek(dur! / 2)
    const mid = value.get()
    h.seek(dur! / 2)
    expect(value.get()).toBe(mid) // idempotent

    h.seek(dur!)
    expect(value.get()).toBe(100) // exact rest snap
  })

  it('is idempotent and a no-op on an already-baked or tween handle', () => {
    const { pv } = setup(0)
    const baked = pv.spring(100, { paused: true })
    baked.bake()
    expect(baked.bake()).toBe(true) // already baked

    const tween = pv.to(100, { duration: 300, paused: true })
    expect(tween.bake()).toBe(true) // tweens are already seekable
    expect(tween.kind).toBe('timeline')
  })

  it('a baked seek matches the live trajectory it sampled', () => {
    const target = 100
    const baked = setup(0)
    const h = baked.pv.spring(target, { paused: true })
    h.bake()

    for (const toMs of [96, 208, 304]) {
      const live = setup(0)
      live.value.spring(target)
      pumpMs(live.driver, 0, toMs)
      h.seek(toMs)
      expect(baked.value.get()).toBeCloseTo(live.value.get(), 6)
    }
  })

  it('fails and warns once when the motion never rests', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { pv } = setup(0)
    const h = pv.spring(100, { damping: 0, paused: true })

    expect(h.bake({ maxDurationMs: 2000 })).toBe(false)
    expect(h.seekable).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('a baked handle reverses by replaying the table backward to the start', () => {
    const { driver, value, pv } = setup(0)
    const h = pv.spring(100, { paused: true })
    h.bake()
    const dur = h.duration()!

    h.seek(dur)
    expect(value.get()).toBe(100)
    h.reverse()
    h.play()
    driveUntil(driver, 0, () => value.get() <= 0.5)
    expect(value.get()).toBeCloseTo(0, 6) // bounce, replayed backward, lands at the launch
  })

  it('baking mid-flight hands off without a jump and still rests on target', () => {
    const { driver, value, pv } = setup(0)
    const h = pv.spring(100)
    const t = driveUntil(driver, 0, () => value.get() > 40)
    const before = value.get()

    expect(h.bake()).toBe(true)
    expect(value.get()).toBe(before) // bake itself does not move the value

    pumpMs(driver, t, t + 5000)
    expect(value.get()).toBe(100) // the sampled table carries it the rest of the way
  })
})
