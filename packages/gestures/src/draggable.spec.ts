// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { draggable } from './draggable'

const pointer = (type: string, clientX: number, clientY: number): MouseEvent =>
  new MouseEvent(type, { clientX, clientY, bubbles: true })

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
})
