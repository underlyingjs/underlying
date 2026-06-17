// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { observe } from './observer'

const pointer = (type: string, clientX: number, clientY: number): MouseEvent =>
  new MouseEvent(type, { clientX, clientY, bubbles: true })

// jsdom does not always construct WheelEvent; build a plain event with the fields we read.
const wheel = (deltaX: number, deltaY: number, deltaMode = 0): WheelEvent => {
  const event = new Event('wheel', { bubbles: true, cancelable: true }) as WheelEvent
  Object.defineProperty(event, 'deltaX', { value: deltaX })
  Object.defineProperty(event, 'deltaY', { value: deltaY })
  Object.defineProperty(event, 'deltaMode', { value: deltaMode })
  return event
}

describe('observe', () => {
  it('a wheel event fires onWheel, onChange and the direction with normalized deltas', () => {
    const el = document.createElement('div')
    const onWheel = vi.fn()
    const onChange = vi.fn()
    const onDown = vi.fn()
    const obs = observe({ target: el, type: ['wheel'], onWheel, onChange, onDown })
    el.dispatchEvent(wheel(0, 50))
    expect(onWheel).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onDown).toHaveBeenCalledTimes(1)
    const state = onChange.mock.calls[0]![0]
    expect(state.deltaY).toBe(50)
    expect(state.totalY).toBe(50)
    expect(state.axis).toBe('y')
    obs.dispose()
  })

  it('line-mode wheel deltas are scaled to px', () => {
    const el = document.createElement('div')
    const onChange = vi.fn()
    const obs = observe({ target: el, type: ['wheel'], onChange })
    el.dispatchEvent(wheel(0, 3, 1)) // 3 lines -> 48px
    expect(onChange.mock.calls[0]![0].deltaY).toBe(48)
    obs.dispose()
  })

  it('tolerance gates until the accumulated movement clears the dead zone', () => {
    const el = document.createElement('div')
    const onChange = vi.fn()
    const obs = observe({ target: el, type: ['wheel'], tolerance: 100, onChange })
    el.dispatchEvent(wheel(0, 40)) // total 40 < 100
    expect(onChange).not.toHaveBeenCalled()
    el.dispatchEvent(wheel(0, 70)) // total 110 >= 100
    expect(onChange).toHaveBeenCalledTimes(1)
    obs.dispose()
  })

  it('a pointer drag reports per-event deltas and isDragging', () => {
    const el = document.createElement('div')
    const onPress = vi.fn()
    const onDrag = vi.fn()
    const onRelease = vi.fn()
    const obs = observe({ target: el, type: ['pointer'], onPress, onDrag, onRelease })
    el.dispatchEvent(pointer('pointerdown', 0, 0))
    expect(onPress).toHaveBeenCalledTimes(1)
    el.dispatchEvent(pointer('pointermove', 30, 10))
    expect(onDrag).toHaveBeenCalledTimes(1)
    const state = onDrag.mock.calls[0]![0]
    expect(state.deltaX).toBe(30)
    expect(state.deltaY).toBe(10)
    expect(state.isDragging).toBe(true)
    el.dispatchEvent(pointer('pointerup', 30, 10))
    expect(onRelease).toHaveBeenCalledTimes(1)
    obs.dispose()
  })

  it('axis: x reports only horizontal movement', () => {
    const el = document.createElement('div')
    const onChange = vi.fn()
    const obs = observe({ target: el, type: ['wheel'], axis: 'x', onChange })
    el.dispatchEvent(wheel(20, 50))
    const state = onChange.mock.calls[0]![0]
    expect(state.deltaX).toBe(20)
    expect(state.deltaY).toBe(0)
    obs.dispose()
  })

  it('disable() stops listening; dispose() is idempotent', () => {
    const el = document.createElement('div')
    const onChange = vi.fn()
    const obs = observe({ target: el, type: ['wheel'], onChange })
    obs.disable()
    el.dispatchEvent(wheel(0, 50))
    expect(onChange).not.toHaveBeenCalled()
    expect(obs.isEnabled).toBe(false)
    obs.dispose()
    obs.dispose()
  })

  it('onWheel sees the folded totals, not the previous event', () => {
    const el = document.createElement('div')
    const onWheel = vi.fn()
    const obs = observe({ target: el, type: ['wheel'], onWheel })
    el.dispatchEvent(wheel(0, 50))
    expect(onWheel.mock.calls[0]![0].totalY).toBe(50) // current event folded in, not 0
    obs.dispose()
  })

  it('wheel velocity keeps its sign across gesture boundaries', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    const vels: number[] = []
    const obs = observe({ target: el, type: ['wheel'], onChange: (s) => vels.push(s.velocityY) })
    const at = (deltaY: number, t: number): WheelEvent => {
      const event = wheel(0, deltaY)
      Object.defineProperty(event, 'timeStamp', { value: t })
      return event
    }
    el.dispatchEvent(at(50, 100)) // gesture 1: scroll down
    el.dispatchEvent(at(50, 116))
    el.dispatchEvent(at(50, 132))
    vi.advanceTimersByTime(200) // settle -> onStop re-anchors the trackers
    el.dispatchEvent(at(50, 1000)) // gesture 2: scroll down again, much later
    el.dispatchEvent(at(50, 1016))
    expect(vels[vels.length - 1]).toBeGreaterThan(0) // still positive (was negative before the fix)
    obs.dispose()
    vi.useRealTimers()
  })

  it('onStop fires once after movement settles', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    const onStop = vi.fn()
    const obs = observe({ target: el, type: ['wheel'], onStop })
    el.dispatchEvent(wheel(0, 50))
    expect(onStop).not.toHaveBeenCalled()
    vi.advanceTimersByTime(250)
    expect(onStop).toHaveBeenCalledTimes(1)
    obs.dispose()
    vi.useRealTimers()
  })
})
