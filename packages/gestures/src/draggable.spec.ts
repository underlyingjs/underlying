// @vitest-environment jsdom
import { createScheduler } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { describe, expect, it } from 'vitest'
import { draggable } from './draggable'

const pointer = (type: string, clientX: number, clientY: number, timeStamp?: number): MouseEvent => {
  const event = new MouseEvent(type, { clientX, clientY, bubbles: true })
  // jsdom auto-stamps each event microseconds apart, which makes any
  // velocity-dependent assertion flaky; let a test pin the clock.
  if (timeStamp !== undefined) Object.defineProperty(event, 'timeStamp', { value: timeStamp })
  return event
}

describe('draggable', () => {
  it('exposes x/y animatables and sets/restores touch-action', () => {
    const el = document.createElement('div')
    const drag = draggable(el)
    expect(typeof drag.x.get).toBe('function')
    expect(typeof drag.y.velocity).toBe('function')
    expect(el.style.touchAction).toBe('none')
    drag.dispose()
    expect(el.style.touchAction).not.toBe('none') // restored (jsdom reports '' as undefined)
  })

  it('moves the value by the pointer delta during a drag', () => {
    const el = document.createElement('div')
    const drag = draggable(el, { release: 'free' })
    el.dispatchEvent(pointer('pointerdown', 0, 0))
    el.dispatchEvent(pointer('pointermove', 40, 25))
    expect(drag.x.get()).toBe(40)
    expect(drag.y.get()).toBe(25)
    drag.dispose()
  })

  it('axis lock leaves the other axis untouched', () => {
    const el = document.createElement('div')
    const drag = draggable(el, { axis: 'x', release: 'free' })
    el.dispatchEvent(pointer('pointerdown', 0, 0))
    el.dispatchEvent(pointer('pointermove', 30, 30))
    expect(drag.x.get()).toBe(30)
    expect(drag.y.get()).toBe(0)
    drag.dispose()
  })

  it('release: spring starts an animation back toward the origin', () => {
    const el = document.createElement('div')
    const drag = draggable(el, { release: 'spring' })
    el.dispatchEvent(pointer('pointerdown', 0, 0))
    el.dispatchEvent(pointer('pointermove', 60, 0))
    expect(drag.x.get()).toBe(60)
    el.dispatchEvent(pointer('pointerup', 60, 0))
    expect(drag.x.isAnimating()).toBe(true) // springing home
    drag.dispose()
  })

  it('release: free leaves the value where it was dropped', () => {
    const el = document.createElement('div')
    const drag = draggable(el, { release: 'free' })
    el.dispatchEvent(pointer('pointerdown', 0, 0))
    el.dispatchEvent(pointer('pointermove', 60, 0))
    el.dispatchEvent(pointer('pointerup', 60, 0))
    expect(drag.x.isAnimating()).toBe(false)
    expect(drag.x.get()).toBe(60)
    drag.dispose()
  })

  it('lockAxis commits to the dominant direction (x)', () => {
    const el = document.createElement('div')
    const drag = draggable(el, { lockAxis: true, release: 'free' })
    el.dispatchEvent(pointer('pointerdown', 0, 0))
    el.dispatchEvent(pointer('pointermove', 20, 8)) // dominant x, clears the threshold
    el.dispatchEvent(pointer('pointermove', 40, 30))
    expect(drag.x.get()).toBe(40)
    expect(drag.y.get()).toBe(0) // locked out
    drag.dispose()
  })

  it('lockAxis can lock to y', () => {
    const el = document.createElement('div')
    const drag = draggable(el, { lockAxis: true, release: 'free' })
    el.dispatchEvent(pointer('pointerdown', 0, 0))
    el.dispatchEvent(pointer('pointermove', 8, 20)) // dominant y
    el.dispatchEvent(pointer('pointermove', 30, 40))
    expect(drag.y.get()).toBe(40)
    expect(drag.x.get()).toBe(0)
    drag.dispose()
  })

  it('lockAxis undoes a sub-threshold wobble and never releases the off-axis', () => {
    const el = document.createElement('div')
    const drag = draggable(el, { lockAxis: true }) // default inertia release
    el.dispatchEvent(pointer('pointerdown', 0, 0))
    el.dispatchEvent(pointer('pointermove', 3, 4)) // both under the threshold: a wobble
    el.dispatchEvent(pointer('pointermove', 30, 6)) // locks to x; the off-axis is reset
    expect(drag.y.get()).toBe(0) // wobble undone, not stranded at 4
    el.dispatchEvent(pointer('pointerup', 30, 6))
    expect(drag.y.isAnimating()).toBe(false) // ignored axis never animates on release
    drag.dispose()
  })

  it('liveSnap snaps the value to the grid while dragging', () => {
    const el = document.createElement('div')
    const drag = draggable(el, { snap: { x: 50 }, liveSnap: true, release: 'free' })
    el.dispatchEvent(pointer('pointerdown', 0, 0))
    el.dispatchEvent(pointer('pointermove', 38, 0)) // nearest 50-grid -> 50
    expect(drag.x.get()).toBe(50)
    el.dispatchEvent(pointer('pointermove', 12, 0)) // nearest -> 0
    expect(drag.x.get()).toBe(0)
    drag.dispose()
  })

  it('snap on release springs to the nearest snap point', () => {
    const el = document.createElement('div')
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const drag = draggable(el, { snap: { x: [0, 100, 200] }, scheduler })
    el.dispatchEvent(pointer('pointerdown', 0, 0, 0))
    el.dispatchEvent(pointer('pointermove', 90, 0, 10))
    el.dispatchEvent(pointer('pointerup', 90, 0, 200)) // 190ms gap: a gentle release, velocity reads 0
    expect(drag.x.isAnimating()).toBe(true) // springing to a snap point
    for (let t = 0; t <= 4000; t += 16) driver.frame(t)
    expect(drag.x.get()).toBeCloseTo(100, 0) // no momentum -> nearest to 90
    drag.dispose()
  })

  it('a hard flick snaps further on momentum', () => {
    const el = document.createElement('div')
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const drag = draggable(el, { snap: { x: [0, 100, 200, 300] }, scheduler })
    el.dispatchEvent(pointer('pointerdown', 0, 0, 0))
    el.dispatchEvent(pointer('pointermove', 60, 0, 16)) // 60px in 16ms -> a fast flick
    el.dispatchEvent(pointer('pointerup', 60, 0, 16)) // released mid-motion
    for (let t = 0; t <= 4000; t += 16) driver.frame(t)
    expect(drag.x.get()).toBeGreaterThan(100) // momentum projected past the nearest stop
    drag.dispose()
  })

  it('edgeResistance rubber-bands past the bounds during the drag', () => {
    const el = document.createElement('div')
    const drag = draggable(el, { bounds: { x: [0, 100] }, edgeResistance: 0.5, release: 'free' })
    el.dispatchEvent(pointer('pointerdown', 0, 0))
    el.dispatchEvent(pointer('pointermove', 200, 0)) // 100 past the max
    expect(drag.x.get()).toBe(150) // 100 + 100 * (1 - 0.5)
    drag.dispose()
  })

  it('edgeResistance 1 is a hard wall; 0 lets the drag pass freely', () => {
    const wall = document.createElement('div')
    const hard = draggable(wall, { bounds: { x: [0, 100] }, edgeResistance: 1, release: 'free' })
    wall.dispatchEvent(pointer('pointerdown', 0, 0))
    wall.dispatchEvent(pointer('pointermove', 200, 0))
    expect(hard.x.get()).toBe(100) // cannot pass
    hard.dispose()

    const free = document.createElement('div')
    const loose = draggable(free, { bounds: { x: [0, 100] }, release: 'free' }) // edgeResistance defaults to 0
    free.dispatchEvent(pointer('pointerdown', 0, 0))
    free.dispatchEvent(pointer('pointermove', 200, 0))
    expect(loose.x.get()).toBe(200) // free during the drag (back-compat)
    loose.dispose()
  })
})
