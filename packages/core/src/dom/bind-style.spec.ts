// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animatable } from '../value/animatable'
import { bindStyle } from './bind-style'

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const element = document.createElement('div')
  return { driver, scheduler, element }
}

/** Records every style property assignment made after this call. */
function recordStyleWrites(element: HTMLElement): Array<[string, string]> {
  const writes: Array<[string, string]> = []
  const style = element.style
  Object.defineProperty(element, 'style', {
    value: new Proxy(style, {
      set(target, property, value) {
        writes.push([String(property), String(value)])
        return Reflect.set(target, property, value)
      },
    }),
  })
  return writes
}

describe('bindStyle', () => {
  it('applies the current values synchronously at bind time', () => {
    const { scheduler, element } = setup()
    const x = animatable(10, { scheduler })
    const y = animatable(20, { scheduler })
    const opacity = animatable(0.5, { scheduler })
    bindStyle(element, { x, y, opacity }, { scheduler })

    expect(element.style.transform).toBe('translate3d(10px, 20px, 0)')
    expect(element.style.opacity).toBe('0.5')
  })

  it('formats scale and rotate channels', () => {
    const { scheduler, element } = setup()
    const scale = animatable(2, { scheduler })
    const rotate = animatable(45, { scheduler })
    bindStyle(element, { scale, rotate }, { scheduler })

    expect(element.style.transform).toBe('scale(2) rotate(45deg)')
  })

  it('writes the transform once per frame even when x and y both move', () => {
    const { driver, scheduler, element } = setup()
    const x = animatable(0, { scheduler })
    const y = animatable(0, { scheduler })
    bindStyle(element, { x, y }, { scheduler })
    const writes = recordStyleWrites(element)

    x.spring(100)
    y.spring(50)
    driver.frame(0) // delta 0 : rien ne bouge, rien n'est écrit
    driver.frame(16)
    driver.frame(32)

    const transforms = writes.filter(([property]) => property === 'transform')
    expect(transforms.length).toBe(2)
    expect(transforms.at(-1)?.[1]).toBe(`translate3d(${x.get()}px, ${y.get()}px, 0)`)
  })

  it('does not rewrite opacity when only transform channels move', () => {
    const { driver, scheduler, element } = setup()
    const x = animatable(0, { scheduler })
    const opacity = animatable(1, { scheduler })
    bindStyle(element, { x, opacity }, { scheduler })
    const writes = recordStyleWrites(element)

    x.spring(100)
    driver.frame(0)
    driver.frame(16)

    expect(writes.some(([property]) => property === 'transform')).toBe(true)
    expect(writes.some(([property]) => property === 'opacity')).toBe(false)
  })

  it('never writes a transform when only opacity is bound', () => {
    const { driver, scheduler, element } = setup()
    const opacity = animatable(1, { scheduler })
    bindStyle(element, { opacity }, { scheduler })

    opacity.spring(0)
    driver.frame(0)
    driver.frame(16)

    expect(element.style.transform).toBe('')
  })

  it('flushes a set() made outside any animation on the next frame, then sleeps', () => {
    const { driver, scheduler, element } = setup()
    const x = animatable(0, { scheduler })
    bindStyle(element, { x }, { scheduler })

    x.set(50)
    expect(driver.pendingCount()).toBe(1) // le binding a réveillé la boucle

    driver.frame(0)
    expect(element.style.transform).toBe('translate3d(50px, 0px, 0)')
    expect(driver.pendingCount()).toBe(0) // flush one-shot : la boucle se rendort
  })

  it('dispose stops writing and schedules nothing further', () => {
    const { driver, scheduler, element } = setup()
    const x = animatable(0, { scheduler })
    const dispose = bindStyle(element, { x }, { scheduler })
    dispose()

    x.set(50)
    expect(driver.pendingCount()).toBe(0)

    x.spring(100)
    driver.frame(0)
    driver.frame(16)
    expect(element.style.transform).toBe('translate3d(0px, 0px, 0)') // figé à la valeur du bind
  })
})
