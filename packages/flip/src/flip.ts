import { animatable, type Animatable, type Scheduler, type SpringOptions } from '@underlying/core'

export type FlipTargets = HTMLElement | Iterable<HTMLElement>

export interface FlipOptions extends SpringOptions {
  scheduler?: Scheduler
  /** Invert and animate size changes too (scale), not only position. Default true. */
  scale?: boolean
}

export interface FlipPlayOptions extends FlipOptions {
  /** The elements to animate from the snapshot boxes, matched by `data-flip-id`. */
  targets: FlipTargets
}

interface Box {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** A captured set of element boxes, keyed by `data-flip-id` (or the element itself). */
export interface FlipSnapshot {
  readonly boxes: ReadonlyMap<string | HTMLElement, Box>
}

interface FlipState {
  readonly x: Animatable
  readonly y: Animatable
  readonly sx: Animatable
  readonly sy: Animatable
}

interface Velocity {
  readonly x: number
  readonly y: number
  readonly sx: number
  readonly sy: number
}

const ZERO_VELOCITY: Velocity = { x: 0, y: 0, sx: 0, sy: 0 }

// FLIP owns the element's transform directly: the writes must be SYNCHRONOUS so
// the inverted box paints before the browser shows the new layout (no flash) -
// which is why this drives style.transform itself instead of bindStyle (whose
// flush is deferred to the render phase). One spring set per element, reused.
const states = new WeakMap<HTMLElement, FlipState>()

const toElements = (targets: FlipTargets): HTMLElement[] =>
  targets instanceof HTMLElement ? [targets] : Array.from(targets)

const measure = (element: HTMLElement): Box => {
  const r = element.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

const keyOf = (element: HTMLElement): string | HTMLElement => element.dataset.flipId ?? element

const writeTransform = (element: HTMLElement, x: number, y: number, sx: number, sy: number): void => {
  if (x === 0 && y === 0 && sx === 1 && sy === 1) {
    element.style.transform = ''
    return
  }
  const scale = sx === 1 && sy === 1 ? '' : ` scale(${sx}, ${sy})`
  element.style.transform = `translate3d(${x}px, ${y}px, 0)${scale}`
}

const ensureState = (element: HTMLElement, options: FlipOptions): FlipState => {
  let state = states.get(element)
  if (state === undefined) {
    const valueOptions = options.scheduler !== undefined ? { scheduler: options.scheduler } : {}
    const x = animatable(0, valueOptions)
    const y = animatable(0, valueOptions)
    const sx = animatable(1, valueOptions)
    const sy = animatable(1, valueOptions)
    const write = (): void => writeTransform(element, x.get(), y.get(), sx.get(), sy.get())
    x.on('change', write)
    y.on('change', write)
    sx.on('change', write)
    sy.on('change', write)
    element.style.transformOrigin = '0 0' // pin the top-left so scale and translate align
    state = { x, y, sx, sy }
    states.set(element, state)
  }
  return state
}

// Stop any in-flight spring and read its live velocity, so the next play carries
// the momentum instead of restarting (the interruptible handoff).
const seizeVelocity = (element: HTMLElement): Velocity => {
  const state = states.get(element)
  if (state === undefined) return ZERO_VELOCITY
  const velocity = { x: state.x.velocity(), y: state.y.velocity(), sx: state.sx.velocity(), sy: state.sy.velocity() }
  state.x.stop()
  state.y.stop()
  state.sx.stop()
  state.sy.stop()
  return velocity
}

// Invert (First minus the element's current natural box) and spring to identity.
const invertAndSpring = (element: HTMLElement, first: Box, velocity: Velocity, options: FlipOptions): void => {
  const useScale = options.scale !== false
  const last = measure(element)
  const dx = first.left - last.left
  const dy = first.top - last.top
  const sx = useScale && last.width > 0 ? first.width / last.width : 1
  const sy = useScale && last.height > 0 ? first.height / last.height : 1

  if (dx === 0 && dy === 0 && sx === 1 && sy === 1) {
    const existing = states.get(element)
    if (existing !== undefined) {
      existing.x.set(0)
      existing.y.set(0)
      existing.sx.set(1)
      existing.sy.set(1)
    }
    element.style.transform = ''
    return
  }

  const state = ensureState(element, options)
  writeTransform(element, dx, dy, sx, sy) // appear at First synchronously - no flash
  state.x.set(dx, { velocity: velocity.x })
  state.y.set(dy, { velocity: velocity.y })
  state.sx.set(sx, { velocity: velocity.sx })
  state.sy.set(sy, { velocity: velocity.sy })
  state.x.spring(0, options)
  state.y.spring(0, options)
  state.sx.spring(1, options)
  state.sy.spring(1, options)
}

/**
 * Physics-first FLIP. Measures each element's box (First), runs `mutate` to
 * change the DOM, measures again (Last), applies the inverse transform - both
 * position AND size - so nothing visibly jumps, then springs every element to
 * its new place. The play is a spring, not a baked tween: call flip() again
 * mid-flight and each element retargets from its live position and velocity, so
 * the motion bends into the new layout instead of restarting. That
 * interruptibility is the whole point.
 */
export function flip(targets: FlipTargets, mutate: () => void, options: FlipOptions = {}): void {
  const elements = toElements(targets)

  // First: current visual box (with any in-flight transform), plus the live
  // velocity of a running spring.
  const first = new Map<HTMLElement, Box>()
  const velocity = new Map<HTMLElement, Velocity>()
  for (const element of elements) {
    first.set(element, measure(element))
    velocity.set(element, seizeVelocity(element))
  }

  // Strip transforms so the Last measurement is the natural layout box.
  for (const element of elements) element.style.transform = ''

  mutate()

  for (const element of elements) {
    const box = first.get(element)
    if (box === undefined) continue
    invertAndSpring(element, box, velocity.get(element) ?? ZERO_VELOCITY, options)
  }
}

/**
 * Capture each target's box, keyed by its `data-flip-id` (or the element
 * itself). Pair with `play()` for shared-element / route transitions, where the
 * old elements and the new ones are different DOM nodes: snapshot the old set,
 * change the DOM, then play the new set from the captured boxes.
 */
export function snapshot(targets: FlipTargets): FlipSnapshot {
  const boxes = new Map<string | HTMLElement, Box>()
  for (const element of toElements(targets)) boxes.set(keyOf(element), measure(element))
  return { boxes }
}

/**
 * Animate each target from its matching box in the snapshot to its current
 * place - matched by `data-flip-id`. A target with no match in the snapshot is
 * left alone. Interruptible like `flip()`.
 */
export function play(snap: FlipSnapshot, options: FlipPlayOptions): void {
  for (const element of toElements(options.targets)) {
    const first = snap.boxes.get(keyOf(element))
    if (first === undefined) continue
    const velocity = seizeVelocity(element)
    element.style.transform = '' // ensure Last is the natural box
    invertAndSpring(element, first, velocity, options)
  }
}
