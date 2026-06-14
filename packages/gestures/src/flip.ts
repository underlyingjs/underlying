import { animatable, type Animatable, type Scheduler, type SpringOptions } from '@underlying/core'

export interface FlipOptions extends SpringOptions {
  scheduler?: Scheduler
}

export type FlipTargets = HTMLElement | Iterable<HTMLElement>

interface FlipState {
  x: Animatable
  y: Animatable
}

// FLIP owns the element's transform directly (synchronous, so we can measure the
// natural box between writes). One state per element; the spring drives the
// offset back to identity and writes the transform on every change.
const states = new WeakMap<HTMLElement, FlipState>()

const toElements = (targets: FlipTargets): HTMLElement[] =>
  targets instanceof HTMLElement ? [targets] : Array.from(targets)

const writeTransform = (element: HTMLElement, dx: number, dy: number): void => {
  element.style.transform = dx === 0 && dy === 0 ? '' : `translate3d(${dx}px, ${dy}px, 0)`
}

const ensureState = (element: HTMLElement, options: FlipOptions): FlipState => {
  let state = states.get(element)
  if (state === undefined) {
    const valueOptions = options.scheduler !== undefined ? { scheduler: options.scheduler } : {}
    const x = animatable(0, valueOptions)
    const y = animatable(0, valueOptions)
    const write = (): void => writeTransform(element, x.get(), y.get())
    x.on('change', write)
    y.on('change', write)
    state = { x, y }
    states.set(element, state)
  }
  return state
}

/**
 * Physics-first FLIP. Measures each element's box (First), runs `mutate` to
 * change the DOM, measures again (Last), applies the inverse transform so
 * nothing visibly jumps, then springs every element to its new place. The play
 * is a spring, not a baked tween - so calling flip() again mid-flight retargets
 * from the live position AND velocity: the motion bends into the new layout,
 * never a restart. That interruptibility is the whole point.
 */
export function flip(targets: FlipTargets, mutate: () => void, options: FlipOptions = {}): void {
  const elements = toElements(targets)

  // First: current visual box (includes any in-flight transform). Stop the
  // running spring so our direct transform writes below are not overwritten,
  // but keep its velocity to carry the momentum into the new layout.
  const first = new Map<HTMLElement, DOMRect>()
  const velocity = new Map<HTMLElement, { x: number; y: number }>()
  for (const element of elements) {
    first.set(element, element.getBoundingClientRect())
    const state = states.get(element)
    if (state !== undefined) {
      state.x.stop()
      state.y.stop()
      velocity.set(element, { x: state.x.velocity(), y: state.y.velocity() })
    } else {
      velocity.set(element, { x: 0, y: 0 })
    }
  }

  // Strip transforms so the Last measurement is the natural layout box.
  for (const element of elements) element.style.transform = ''

  mutate()

  // Last: natural box after the mutation.
  const last = new Map<HTMLElement, DOMRect>()
  for (const element of elements) last.set(element, element.getBoundingClientRect())

  // Invert + spring to identity, velocity conserved.
  for (const element of elements) {
    const f = first.get(element)
    const l = last.get(element)
    if (f === undefined || l === undefined) continue
    const dx = f.left - l.left
    const dy = f.top - l.top
    if (dx === 0 && dy === 0) {
      const existing = states.get(element)
      if (existing !== undefined) {
        existing.x.set(0)
        existing.y.set(0)
      }
      element.style.transform = ''
      continue
    }
    const state = ensureState(element, options)
    const seed = velocity.get(element) ?? { x: 0, y: 0 }
    writeTransform(element, dx, dy) // appear at First synchronously - no flash
    state.x.set(dx, { velocity: seed.x })
    state.y.set(dy, { velocity: seed.y })
    state.x.spring(0, options)
    state.y.spring(0, options)
  }
}
