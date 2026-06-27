// @vitest-environment jsdom
import { createScheduler, setReducedMotionOverride } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { flipGroup } from './group'

const rect = (left: number, top: number, w = 10, h = 10): DOMRect =>
  ({ left, top, right: left + w, bottom: top + h, width: w, height: h, x: left, y: top, toJSON: () => ({}) }) as DOMRect

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const container = document.createElement('div')
  container.getBoundingClientRect = () => rect(0, 0, 300, 300)
  document.body.append(container)
  return { driver, scheduler, container }
}

// A child with a mutable bounding box (jsdom has no layout).
function child(container: HTMLElement, left: number, top: number, w = 10, h = 10) {
  const el = document.createElement('div')
  let box = rect(left, top, w, h)
  el.getBoundingClientRect = () => box
  container.append(el)
  return { el, set: (b: DOMRect): void => void (box = b) }
}

const settle = (driver: ReturnType<typeof createManualDriver>, from = 0, to = 8000): void => {
  for (let t = from; t <= to; t += 16) driver.frame(t)
}

afterEach(() => setReducedMotionOverride(null))

describe('flipGroup', () => {
  it('auto-FLIP springs each survivor from its old box', () => {
    const { driver, scheduler, container } = setup()
    const a = child(container, 0, 0)
    const b = child(container, 100, 0)
    const group = flipGroup(container, { scheduler, stiffness: 300, damping: 26 })

    group.flip(() => {
      a.set(rect(100, 0)) // swap
      b.set(rect(0, 0))
    })
    expect(a.el.style.transform).toBe('translate3d(-100px, 0px, 0)') // First(0) - Last(100)
    expect(b.el.style.transform).toBe('translate3d(100px, 0px, 0)')
    settle(driver)
    expect(a.el.style.transform).toBe('')
    expect(b.el.style.transform).toBe('')
  })

  it('enter appears at the from-state synchronously, then springs to rest', () => {
    const { driver, scheduler, container } = setup()
    const c = child(container, 0, 0)
    const group = flipGroup(container, { scheduler, stiffness: 300, damping: 26 })

    group.add(c.el, { enter: { opacity: 0, y: 8 } })
    expect(c.el.style.opacity).toBe('0') // appeared faded
    expect(c.el.style.transform).toContain('8px') // and offset
    settle(driver)
    expect(c.el.style.opacity).toBe('') // cleared at rest (>= 1)
    expect(c.el.style.transform).toBe('')
  })

  it('exit keeps the node mounted, then detaches once the spring settles', () => {
    const { driver, scheduler, container } = setup()
    const c = child(container, 0, 0)
    const group = flipGroup(container, { scheduler, stiffness: 300, damping: 26 })
    let detached = 0

    group.remove(c.el, {
      exit: { opacity: 0 },
      detach: () => {
        detached++
        c.el.remove()
      },
    })
    expect(c.el.isConnected).toBe(true) // still mounted during the exit
    expect(detached).toBe(0)
    settle(driver)
    expect(detached).toBe(1)
    expect(c.el.isConnected).toBe(false)
  })

  it('a re-add mid-exit cancels the detach and bends back to rest', () => {
    const { driver, scheduler, container } = setup()
    const c = child(container, 0, 0)
    const group = flipGroup(container, { scheduler, stiffness: 120, damping: 20 })
    let detached = 0

    group.remove(c.el, {
      exit: { opacity: 0 },
      detach: () => {
        detached++
        c.el.remove()
      },
    })
    settle(driver, 0, 160) // mid-fade
    expect(Number(c.el.style.opacity)).toBeGreaterThan(0)
    expect(Number(c.el.style.opacity)).toBeLessThan(1)

    group.add(c.el) // re-add: retargets the live exit springs to rest
    settle(driver, 176, 8000)
    expect(detached).toBe(0) // detach was suppressed (onInterrupt, not onComplete)
    expect(c.el.isConnected).toBe(true)
    expect(c.el.style.opacity).toBe('') // back to 1
  })

  it('reduced motion: the exit detaches synchronously, the enter lands at rest', () => {
    setReducedMotionOverride(true)
    const { scheduler, container } = setup()
    const c = child(container, 0, 0)
    const group = flipGroup(container, { scheduler })
    let detached = 0

    group.remove(c.el, {
      exit: { opacity: 0 },
      detach: () => {
        detached++
        c.el.remove()
      },
    })
    expect(detached).toBe(1) // settleInstantly fired onComplete inline, no frames
    expect(c.el.isConnected).toBe(false)

    const d = child(container, 0, 0)
    group.add(d.el, { enter: { opacity: 0, y: 8 } })
    expect(d.el.style.transform).toBe('') // landed at rest immediately
    expect(d.el.style.opacity).toBe('')
  })

  it('pop pins the exiting node out of flow and FLIPs the siblings to close the gap', () => {
    const { driver, scheduler, container } = setup()
    const a = child(container, 0, 0)
    const b = document.createElement('div')
    // b sits below a, and moves up once a is pinned out of flow
    b.getBoundingClientRect = () => (a.el.style.position === 'absolute' ? rect(0, 0) : rect(0, 100))
    container.append(b)
    const group = flipGroup(container, { scheduler, stiffness: 300, damping: 26 })

    group.remove(a.el, { mode: 'pop', exit: { opacity: 0 }, detach: () => a.el.remove() })
    expect(a.el.style.position).toBe('absolute')
    expect(a.el.style.width).toBe('10px')
    expect(b.style.transform).toContain('100px') // b FLIPs up to close the gap, immediately
    settle(driver)
    expect(a.el.isConnected).toBe(false)
    expect(b.style.transform).toBe('')
  })

  it('shared-element: a new node flies from an exiting node box across groups', () => {
    const { driver, scheduler } = setup()
    const containerA = document.createElement('div')
    const containerB = document.createElement('div')
    document.body.append(containerA, containerB)
    const oldEl = document.createElement('div')
    oldEl.dataset.flipId = 'hero'
    oldEl.getBoundingClientRect = () => rect(200, 100, 40, 40)
    containerA.append(oldEl)
    const groupA = flipGroup(containerA, { scheduler, stiffness: 300, damping: 26 })
    const groupB = flipGroup(containerB, { scheduler, stiffness: 300, damping: 26 })

    groupA.remove(oldEl, { exit: { opacity: 0 }, detach: () => oldEl.remove() }) // publishes the box
    const newEl = document.createElement('div')
    newEl.dataset.flipId = 'hero'
    newEl.getBoundingClientRect = () => rect(0, 0, 80, 80)
    containerB.append(newEl)

    groupB.add(newEl) // claims the box and flies from it
    expect(newEl.style.transform).toBe('translate3d(200px, 100px, 0) scale(0.5, 0.5)')
    settle(driver)
    expect(newEl.style.transform).toBe('')
  })

  it('wait holds the enter at the from-state until the exit settles', async () => {
    const { driver, scheduler, container } = setup()
    const a = child(container, 0, 0)
    const group = flipGroup(container, { scheduler, mode: 'wait', stiffness: 300, damping: 26 })

    const exitHandle = group.remove(a.el, { exit: { opacity: 0 }, detach: () => a.el.remove() })
    const b = child(container, 0, 0)
    group.add(b.el, { enter: { opacity: 0, y: 8 } })
    expect(b.el.style.opacity).toBe('0') // held at the from-state, not entering yet

    settle(driver) // drive the exit to settle
    await exitHandle.finished
    await Promise.resolve() // let the wait .then start b's enter
    expect(a.el.isConnected).toBe(false)

    settle(driver, 8016, 16000) // drive b's enter
    expect(b.el.style.opacity).toBe('') // b finally entered
    expect(b.el.style.transform).toBe('')
  })

  it('a flip() during an in-flight exit does not strand the exiting node', () => {
    const { driver, scheduler, container } = setup()
    const a = child(container, 0, 0)
    const b = child(container, 0, 100)
    const group = flipGroup(container, { scheduler, stiffness: 200, damping: 24 })
    let detached = 0

    group.remove(a.el, { exit: { opacity: 0, y: 8 }, detach: () => ((detached++), a.el.remove()) })
    settle(driver, 0, 80) // mid-exit, the node is still mounted
    group.flip(() => b.set(rect(0, 0))) // an unrelated reorder must not seize a's exit channels
    settle(driver, 96, 8000)
    expect(detached).toBe(1) // the exit still completed and detached
    expect(a.el.isConnected).toBe(false)
  })

  it('wait with a custom enter that omits opacity still ends up visible', async () => {
    const { driver, scheduler, container } = setup()
    const a = child(container, 0, 0)
    const group = flipGroup(container, { scheduler, mode: 'wait', stiffness: 300, damping: 26 })

    const exitHandle = group.remove(a.el, { exit: { opacity: 0 }, detach: () => a.el.remove() })
    const b = child(container, 0, 0)
    group.add(b.el, { enter: { y: 10 } }) // no opacity in the enter state
    expect(b.el.style.opacity).toBe('0') // held hidden during the wait

    settle(driver)
    await exitHandle.finished
    await Promise.resolve()
    settle(driver, 8016, 16000)
    expect(b.el.style.opacity).toBe('') // sprang back to 1, not stuck hidden
    expect(b.el.style.transform).toBe('')
  })

  it('dispose freezes in-flight springs', () => {
    const { driver, scheduler, container } = setup()
    const c = child(container, 0, 0)
    const group = flipGroup(container, { scheduler, stiffness: 120, damping: 20 })

    group.add(c.el, { enter: { opacity: 0, y: 8 } })
    settle(driver, 0, 80) // mid-enter
    const frozen = c.el.style.opacity
    group.dispose()
    settle(driver, 96, 8000)
    expect(c.el.style.opacity).toBe(frozen) // frozen, no further motion
  })
})
