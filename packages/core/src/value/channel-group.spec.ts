import { describe, expect, it, vi } from 'vitest'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { channelGroup } from './channel-group'
import type { ChannelMeta, ParsedValue, ValueType } from './value-type'

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  return { driver, scheduler }
}

/** Drive 16ms frames until nothing is pending (or a frame budget is hit). */
function driveToRest(driver: ReturnType<typeof createManualDriver>, maxFrames = 2000) {
  let t = 0
  for (let i = 0; i < maxFrames && driver.pendingCount() > 0; i++) {
    t += 16
    driver.frame(t)
  }
}

const parsed = (channels: number[], shape = 's'): ParsedValue => ({ channels, shape })

/** A 2-channel value type with controllable metas and a format-call counter. */
function makeType(metas: ChannelMeta[]): { type: ValueType; formatCalls: () => number } {
  let calls = 0
  return {
    formatCalls: () => calls,
    type: {
      parse: () => null,
      format: (channels) => {
        calls += 1
        return channels.join(',')
      },
      channels: () => metas,
    },
  }
}

describe('channelGroup', () => {
  it('springs every channel on the fixed timestep and rests each one exactly', () => {
    const { driver, scheduler } = setup()
    const { type } = makeType([{ precision: 4 }, { precision: 4 }])
    const group = channelGroup(type, parsed([0, 0]), { scheduler })

    group.spring(parsed([100, -40]))
    driveToRest(driver)

    expect(group.channels[0]?.get()).toBe(100)
    expect(group.channels[1]?.get()).toBe(-40)
    expect(group.isAnimating()).toBe(false)
  })

  it('lets channel meta override the library default and a per-call option override the meta', () => {
    // Absurdly loose meta tolerances: the spring qualifies as "rested" on the
    // first simulated step, so it snaps to target. Separate schedulers keep the
    // sleep/wake clocks independent. The first frame only establishes the clock
    // (delta 0); the second carries a real delta that advances the simulation.
    const { type } = makeType([{ precision: 4, restDelta: 1e9, restSpeed: 1e9 }])

    const loose = setup()
    const looseGroup = channelGroup(type, parsed([0]), { scheduler: loose.scheduler })
    looseGroup.spring(parsed([100]))
    loose.driver.frame(0)
    loose.driver.frame(16)
    expect(looseGroup.channels[0]?.get()).toBe(100) // meta beat the tight default
    expect(looseGroup.isAnimating()).toBe(false)

    const tight = setup()
    const tightGroup = channelGroup(type, parsed([0]), { scheduler: tight.scheduler })
    tightGroup.spring(parsed([100]), { restDelta: 0.01, restSpeed: 0.1 })
    tight.driver.frame(0)
    tight.driver.frame(16)
    expect(tightGroup.isAnimating()).toBe(true) // per-call option beat the meta
    expect(tightGroup.channels[0]?.get()).not.toBe(100)
  })

  it('rebases position AND velocity on every channel in one step', () => {
    const { scheduler } = setup()
    const { type } = makeType([{ precision: 4 }, { precision: 4 }])
    const group = channelGroup(type, parsed([240, 10]), { scheduler })
    group.set(parsed([240, 10]), { velocity: 100 })

    group.rebase(0.5, 's2')

    expect(group.shape).toBe('s2')
    expect(group.channels[0]?.get()).toBe(120)
    expect(group.channels[0]?.velocity()).toBe(50)
    expect(group.channels[1]?.get()).toBe(5)
    expect(group.channels[1]?.velocity()).toBe(50)
  })

  it('aggregate finished resolves when the last channel rests, then the loop sleeps', async () => {
    const { driver, scheduler } = setup()
    const { type } = makeType([{ precision: 4 }, { precision: 4 }])
    const group = channelGroup(type, parsed([0, 0]), { scheduler })

    const handle = group.spring(parsed([100, 50]))
    driveToRest(driver)
    await handle.finished // resolves once both channels have rested

    expect(group.channels[0]?.get()).toBe(100)
    expect(group.channels[1]?.get()).toBe(50)
    expect(driver.pendingCount()).toBe(0)
  })

  it('stop freezes every channel in place', () => {
    const { driver, scheduler } = setup()
    const { type } = makeType([{ precision: 4 }, { precision: 4 }])
    const group = channelGroup(type, parsed([0, 0]), { scheduler })

    group.spring(parsed([100, 100]))
    driver.frame(16)
    driver.frame(32)
    group.stop()
    const frozen0 = group.channels[0]?.get()

    driver.frame(48)
    expect(group.channels[0]?.get()).toBe(frozen0)
    expect(group.isAnimating()).toBe(false)
  })

  it('caches format between changes and recomputes after one', () => {
    const { driver, scheduler } = setup()
    const { type, formatCalls } = makeType([{ precision: 4 }])
    const group = channelGroup(type, parsed([0]), { scheduler })

    group.format()
    group.format()
    expect(formatCalls()).toBe(1) // cached

    group.spring(parsed([100]))
    driver.frame(16)
    driver.frame(32) // a channel moved -> cache invalidated
    group.format()
    expect(formatCalls()).toBe(2)
  })

  it('disposing stops writing and clears listeners', () => {
    const { scheduler } = setup()
    const { type } = makeType([{ precision: 4 }])
    const group = channelGroup(type, parsed([0]), { scheduler })
    const listener = vi.fn()
    group.onChange(listener)

    group.dispose()
    group.set(parsed([50]))
    expect(listener).not.toHaveBeenCalled()
  })
})
