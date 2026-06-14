import { animatable, bindStyle, type Animatable, type DecayOptions, type Scheduler, type SpringOptions } from '@underlying/core'
import { VelocityTracker } from './velocity'

export type DragAxis = 'x' | 'y' | 'both'
export type DragRelease = 'inertia' | 'spring' | 'free'
/** Either an element to stay inside (re-measured on each grab) or explicit offset ranges (px). */
export type DragBounds = HTMLElement | { x?: [number, number]; y?: [number, number] }

export interface DraggableOptions {
  /** Which axes move. Default 'both'. */
  axis?: DragAxis
  /** Constrain the drag. Re-measured on each grab. */
  bounds?: DragBounds
  /** On release: 'inertia' (glide + rubber-band at the bounds, default), 'spring' (back to the origin), 'free' (stay put). */
  release?: DragRelease
  /** Spring tuning for release: 'spring'. */
  spring?: SpringOptions
  /** Decay tuning for release: 'inertia'. */
  decay?: DecayOptions
  scheduler?: Scheduler
  onStart?: () => void
  onEnd?: (velocity: { x: number; y: number }) => void
}

export interface Draggable {
  /** The translateX offset (px) - a live Animatable: read it, retarget it, bind it. */
  readonly x: Animatable
  /** The translateY offset (px). */
  readonly y: Animatable
  /** Remove the listeners, restore touch-action, dispose the values. */
  dispose(): void
}

/**
 * Make an element draggable. During the drag the offset teleports to the pointer
 * while a velocity tracker watches; on release that pointer velocity is handed
 * straight into a spring or an inertial glide - momentum preserved in one
 * argument, never a jump. The x/y offsets are plain Animatables, so you can
 * retarget or read them like any other value.
 */
export function draggable(element: HTMLElement, options: DraggableOptions = {}): Draggable {
  const axis = options.axis ?? 'both'
  const useX = axis !== 'y'
  const useY = axis !== 'x'
  const release = options.release ?? 'inertia'
  const valueOptions = options.scheduler !== undefined ? { scheduler: options.scheduler } : {}

  const x = animatable(0, valueOptions)
  const y = animatable(0, valueOptions)
  const unbind = bindStyle(element, { x, y }, valueOptions)

  const previousTouchAction = element.style.touchAction
  element.style.touchAction = 'none'

  const vx = new VelocityTracker()
  const vy = new VelocityTracker()
  let dragging = false
  let startX = 0
  let startY = 0
  let grabClientX = 0
  let grabClientY = 0
  let rangeX: [number, number] | null = null
  let rangeY: [number, number] | null = null

  const measureBounds = (): void => {
    rangeX = null
    rangeY = null
    const bounds = options.bounds
    if (bounds === undefined) return
    if (bounds instanceof HTMLElement) {
      const self = element.getBoundingClientRect()
      const box = bounds.getBoundingClientRect()
      const naturalLeft = self.left - x.get()
      const naturalTop = self.top - y.get()
      rangeX = [box.left - naturalLeft, box.right - self.width - naturalLeft]
      rangeY = [box.top - naturalTop, box.bottom - self.height - naturalTop]
    } else {
      if (bounds.x !== undefined) rangeX = bounds.x
      if (bounds.y !== undefined) rangeY = bounds.y
    }
  }

  const onDown = (event: PointerEvent): void => {
    dragging = true
    try {
      element.setPointerCapture(event.pointerId)
    } catch {
      // setPointerCapture throws without an active pointer (synthetic events, older engines).
    }
    x.stop()
    y.stop()
    startX = x.get()
    startY = y.get()
    grabClientX = event.clientX
    grabClientY = event.clientY
    measureBounds()
    if (useX) vx.start(x.get(), event.timeStamp)
    if (useY) vy.start(y.get(), event.timeStamp)
    options.onStart?.()
  }

  const onMove = (event: PointerEvent): void => {
    if (!dragging) return
    if (useX) {
      const nx = startX + (event.clientX - grabClientX)
      x.set(nx)
      vx.sample(nx, event.timeStamp)
    }
    if (useY) {
      const ny = startY + (event.clientY - grabClientY)
      y.set(ny)
      vy.sample(ny, event.timeStamp)
    }
  }

  const releaseAxis = (value: Animatable, velocity: number, range: [number, number] | null): void => {
    if (release === 'free') return
    if (release === 'spring') {
      value.spring(0, { ...options.spring, velocity })
      return
    }
    const decayOptions: DecayOptions = { ...options.decay, velocity }
    if (range !== null) {
      decayOptions.min = range[0]
      decayOptions.max = range[1]
    }
    value.decay(decayOptions)
  }

  const onUp = (event: PointerEvent): void => {
    if (!dragging) return
    dragging = false
    const releaseVx = useX ? vx.read(event.timeStamp) : 0
    const releaseVy = useY ? vy.read(event.timeStamp) : 0
    if (useX) releaseAxis(x, releaseVx, rangeX)
    if (useY) releaseAxis(y, releaseVy, rangeY)
    options.onEnd?.({ x: releaseVx, y: releaseVy })
  }

  element.addEventListener('pointerdown', onDown)
  element.addEventListener('pointermove', onMove)
  element.addEventListener('pointerup', onUp)
  element.addEventListener('pointercancel', onUp)

  return {
    x,
    y,
    dispose() {
      element.removeEventListener('pointerdown', onDown)
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerup', onUp)
      element.removeEventListener('pointercancel', onUp)
      element.style.touchAction = previousTouchAction
      unbind()
      x.dispose()
      y.dispose()
    },
  }
}
