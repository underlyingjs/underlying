import {
  animatable,
  type Animatable,
  type AnimationHandle,
  type Scheduler,
  type SpringOptions,
} from '@underlying/core'

export type FlipTargets = HTMLElement | Iterable<HTMLElement>

export interface FlipOptions extends SpringOptions {
  scheduler?: Scheduler
  /** Invert and animate size changes too (scale), not only position. Default true. */
  scale?: boolean
}

export interface Box {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

interface FlipState {
  readonly x: Animatable
  readonly y: Animatable
  readonly sx: Animatable
  readonly sy: Animatable
}

export interface Velocity {
  readonly x: number
  readonly y: number
  readonly sx: number
  readonly sy: number
}

export const ZERO_VELOCITY: Velocity = { x: 0, y: 0, sx: 0, sy: 0 }

/** SSR-safe element check - a bare `instanceof HTMLElement` throws with no DOM. */
export const isHTMLElement = (value: unknown): value is HTMLElement =>
  typeof HTMLElement !== 'undefined' && value instanceof HTMLElement

// FLIP owns the element's transform directly: the writes must be SYNCHRONOUS so
// the inverted box paints before the browser shows the new layout (no flash) -
// which is why this drives style.transform itself instead of bindStyle (whose
// flush is deferred to the render phase). One spring set per element, reused.
// Shared by flip() and flipGroup() through this ONE module-level map, so a flip
// after a presence enter seizes the enter's live velocity instead of restarting.
export const states = new WeakMap<HTMLElement, FlipState>()

export const toElements = (targets: FlipTargets): HTMLElement[] =>
  isHTMLElement(targets) ? [targets] : Array.from(targets)

export const measure = (element: HTMLElement): Box => {
  const r = element.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

export const keyOf = (element: HTMLElement): string | HTMLElement => element.dataset.flipId ?? element

export const writeTransform = (element: HTMLElement, x: number, y: number, sx: number, sy: number): void => {
  if (x === 0 && y === 0 && sx === 1 && sy === 1) {
    element.style.transform = ''
    return
  }
  const scale = sx === 1 && sy === 1 ? '' : ` scale(${sx}, ${sy})`
  element.style.transform = `translate3d(${x}px, ${y}px, 0)${scale}`
}

export const ensureState = (element: HTMLElement, options: FlipOptions): FlipState => {
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
export const seizeVelocity = (element: HTMLElement): Velocity => {
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
// Returns the spring handles (empty when there is no delta), so a caller can await
// their `finished`; flip()/play() ignore the return.
export const invertAndSpring = (
  element: HTMLElement,
  first: Box,
  velocity: Velocity,
  options: FlipOptions,
): AnimationHandle[] => {
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
    return []
  }

  const state = ensureState(element, options)
  writeTransform(element, dx, dy, sx, sy) // appear at First synchronously - no flash
  state.x.set(dx, { velocity: velocity.x })
  state.y.set(dy, { velocity: velocity.y })
  state.sx.set(sx, { velocity: velocity.sx })
  state.sy.set(sy, { velocity: velocity.sy })
  return [
    state.x.spring(0, options),
    state.y.spring(0, options),
    state.sx.spring(1, options),
    state.sy.spring(1, options),
  ]
}
