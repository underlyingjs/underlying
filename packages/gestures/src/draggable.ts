import { animatable, bindStyle, type Animatable, type DecayOptions, type Scheduler, type SpringOptions } from '@underlying/core'
import { VelocityTracker } from './velocity'

export type DragAxis = 'x' | 'y' | 'both'
export type DragRelease = 'inertia' | 'spring' | 'free'
/** Either an element to stay inside (re-measured on each grab) or explicit offset ranges (px). */
export type DragBounds = HTMLElement | { x?: [number, number]; y?: [number, number] }
/** Snap targets for an axis: an increment (grid), explicit stops, or a resolver. */
export type SnapTo = number | readonly number[] | ((value: number) => number)

export interface DraggableOptions {
  /** Which axes move. Default 'both'. */
  axis?: DragAxis
  /**
   * With `axis: 'both'`, commit to the dominant direction once the drag clears a
   * few pixels and ignore the other axis for the rest of that drag.
   */
  lockAxis?: boolean
  /** Constrain the drag. Re-measured on each grab. */
  bounds?: DragBounds
  /** Snap targets per axis (an increment, explicit stops, or a resolver). */
  snap?: { x?: SnapTo; y?: SnapTo }
  /** Snap while dragging, not only on release - the element jumps between targets. Default false. */
  liveSnap?: boolean
  /** Rubber-band resistance (0..1) when dragged past the bounds. 0 = free (default), 1 = a hard wall. */
  edgeResistance?: number
  /** On release: 'inertia' (glide + rubber-band at the bounds, default), 'spring' (back to the origin), 'free' (stay put). */
  release?: DragRelease
  /** Spring tuning for release: 'spring', snap, and the rubber-band back inside the bounds. */
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

// Pixels of travel before a lockAxis drag commits to its dominant direction.
const LOCK_THRESHOLD = 6

/** Snap a value to the nearest target: an increment, the closest of an array, or a resolver. */
function resolveSnap(to: SnapTo, value: number): number {
  if (typeof to === 'function') return to(value)
  if (typeof to === 'number') return to === 0 ? value : Math.round(value / to) * to
  let best = value
  let bestDistance = Number.POSITIVE_INFINITY
  for (const stop of to) {
    const distance = Math.abs(stop - value)
    if (distance < bestDistance) {
      bestDistance = distance
      best = stop
    }
  }
  return best
}

/**
 * Make an element draggable. During the drag the offset teleports to the pointer
 * while a velocity tracker watches; on release that pointer velocity is handed
 * straight into a spring, an inertial glide, or a momentum-aware snap - momentum
 * preserved in one argument, never a jump. The x/y offsets are plain Animatables,
 * so you can retarget or read them like any other value.
 */
export function draggable(element: HTMLElement, options: DraggableOptions = {}): Draggable {
  const axis = options.axis ?? 'both'
  const useX = axis !== 'y'
  const useY = axis !== 'x'
  const release = options.release ?? 'inertia'
  const lockAxis = options.lockAxis ?? false
  const liveSnap = options.liveSnap ?? false
  const edgeResistance = options.edgeResistance ?? 0
  const snapX = options.snap?.x
  const snapY = options.snap?.y
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
  let lockedAxis: 'x' | 'y' | null = null

  const clampRange = (value: number, range: [number, number] | null): number =>
    range === null ? value : value < range[0] ? range[0] : value > range[1] ? range[1] : value

  // Rubber-band past the bounds while dragging: the overshoot is scaled down by
  // edgeResistance (0 = free, 1 = a hard wall). Release springs it back inside.
  const resist = (value: number, range: [number, number] | null): number => {
    if (range === null || edgeResistance <= 0) return value
    const [min, max] = range
    if (value < min) return min - (min - value) * (1 - edgeResistance)
    if (value > max) return max + (value - max) * (1 - edgeResistance)
    return value
  }

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
    lockedAxis = null
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

  // Move one axis: velocity tracks the true pointer position; the displayed value
  // takes the edge resistance, then the live snap if any.
  const moveAxis = (
    value: Animatable,
    tracker: VelocityTracker,
    raw: number,
    range: [number, number] | null,
    snapTo: SnapTo | undefined,
    timeStamp: number,
  ): void => {
    let next = resist(raw, range)
    if (liveSnap && snapTo !== undefined) next = clampRange(resolveSnap(snapTo, next), range)
    value.set(next)
    tracker.sample(raw, timeStamp)
  }

  const onMove = (event: PointerEvent): void => {
    if (!dragging) return
    const dx = event.clientX - grabClientX
    const dy = event.clientY - grabClientY
    // Dynamic axis lock: commit to the dominant direction once it clears the
    // threshold, and undo any sub-threshold wobble on the axis we now ignore.
    if (lockAxis && lockedAxis === null && axis === 'both' && (Math.abs(dx) > LOCK_THRESHOLD || Math.abs(dy) > LOCK_THRESHOLD)) {
      lockedAxis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
      if (lockedAxis === 'x') y.set(startY)
      else x.set(startX)
    }
    if (useX && lockedAxis !== 'y') moveAxis(x, vx, startX + dx, rangeX, snapX, event.timeStamp)
    if (useY && lockedAxis !== 'x') moveAxis(y, vy, startY + dy, rangeY, snapY, event.timeStamp)
  }

  const releaseAxis = (
    value: Animatable,
    velocity: number,
    range: [number, number] | null,
    snapTo: SnapTo | undefined,
  ): void => {
    // Momentum-aware snap: project where the inertia would land, snap that, spring there.
    if (snapTo !== undefined && !liveSnap) {
      const tau = (options.decay?.timeConstant ?? 325) / 1000
      const projected = clampRange(value.get() + velocity * tau, range)
      value.spring(resolveSnap(snapTo, projected), { ...options.spring, velocity })
      return
    }
    // Already snapping live: settle exactly on the nearest target.
    if (snapTo !== undefined) {
      value.spring(clampRange(resolveSnap(snapTo, value.get()), range), { ...options.spring })
      return
    }
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
    // Honor the lock on release too: never read velocity from or animate the
    // ignored axis (which the move path already froze at its grab origin).
    const useReleaseX = useX && lockedAxis !== 'y'
    const useReleaseY = useY && lockedAxis !== 'x'
    const releaseVx = useReleaseX ? vx.read(event.timeStamp) : 0
    const releaseVy = useReleaseY ? vy.read(event.timeStamp) : 0
    if (useReleaseX) releaseAxis(x, releaseVx, rangeX, snapX)
    if (useReleaseY) releaseAxis(y, releaseVy, rangeY, snapY)
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
