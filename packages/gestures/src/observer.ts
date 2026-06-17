import { VelocityTracker } from './velocity'

export type ObserverInput = 'wheel' | 'pointer' | 'touch'

/** The normalized movement reported to every Observer callback. */
export interface ObserverState {
  /** This event's movement on each axis (px; wheel is normalized to px). */
  deltaX: number
  deltaY: number
  /** Movement accumulated since the gesture engaged (a press, or the first wheel after a stop). */
  totalX: number
  totalY: number
  /** Smoothed velocity (px/s) on each axis. */
  velocityX: number
  velocityY: number
  /** Dominant axis of the accumulated movement, or null before it engages. */
  axis: 'x' | 'y' | null
  /** True while a pointer drag is in progress. */
  isDragging: boolean
  /** The DOM event behind this report. */
  event: Event
}

export interface ObserverOptions {
  /** What to listen on. Default the window. */
  target?: HTMLElement | Window
  /** Which inputs to unify. Default all three (pointer and touch share the pointer drag). */
  type?: readonly ObserverInput[]
  /** Minimum accumulated distance (px) before anything fires - a dead zone. Default 0. */
  tolerance?: number
  /** Before a press becomes a drag, this many px of travel. Default 0. */
  dragMinimum?: number
  /** Scale wheel deltas. Default 1. */
  wheelSpeed?: number
  /** Report only this axis (the other is zeroed). Default both. */
  axis?: 'x' | 'y'
  /** preventDefault handled events (the wheel listener becomes non-passive). Default false. */
  preventDefault?: boolean
  onPress?(state: ObserverState): void
  onRelease?(state: ObserverState): void
  onDrag?(state: ObserverState): void
  onWheel?(state: ObserverState): void
  /** Any engaged movement, from any input. */
  onChange?(state: ObserverState): void
  onUp?(state: ObserverState): void
  onDown?(state: ObserverState): void
  onLeft?(state: ObserverState): void
  onRight?(state: ObserverState): void
  /** Movement settled (debounced after the last event). */
  onStop?(state: ObserverState): void
}

export interface Observer {
  enable(): void
  disable(): void
  dispose(): void
  readonly isEnabled: boolean
}

// Lines/pages wheel deltas to px, and the settle debounce.
const LINE_HEIGHT = 16
const PAGE_HEIGHT = 800
const STOP_DELAY_MS = 140

/**
 * One unified read of wheel, pointer, and touch: normalized deltas, accumulated
 * totals, smoothed velocity, and a dominant axis - fed to directional callbacks
 * (up/down/left/right), a catch-all onChange, the raw onWheel/onDrag, and a
 * debounced onStop. The single seam under scroll-jacking, swipe detection, and
 * custom wheel/drag gestures. Pointer Events cover mouse, touch, and pen, so a
 * drag works the same on every device.
 */
export function observe(options: ObserverOptions = {}): Observer {
  const target: EventTarget = options.target ?? window
  const types = options.type ?? ['wheel', 'pointer', 'touch']
  const wantsWheel = types.includes('wheel')
  const wantsDrag = types.includes('pointer') || types.includes('touch')
  const tolerance = options.tolerance ?? 0
  const dragMinimum = options.dragMinimum ?? 0
  const wheelSpeed = options.wheelSpeed ?? 1
  const onlyAxis = options.axis
  const preventDefault = options.preventDefault ?? false

  const vx = new VelocityTracker()
  const vy = new VelocityTracker()
  let totalX = 0
  let totalY = 0
  let engaged = false
  let velocityAnchored = false // the trackers are seeded for the current gesture
  let dragging = false
  let pressX = 0
  let pressY = 0
  let lastX = 0
  let lastY = 0
  let stopTimer: ReturnType<typeof setTimeout> | null = null
  let enabled = false

  const state = (event: Event, deltaX: number, deltaY: number): ObserverState => ({
    deltaX,
    deltaY,
    totalX,
    totalY,
    velocityX: vx.read(event.timeStamp),
    velocityY: vy.read(event.timeStamp),
    axis: !engaged ? null : Math.abs(totalX) >= Math.abs(totalY) ? 'x' : 'y',
    isDragging: dragging,
    event,
  })

  const scheduleStop = (event: Event): void => {
    if (stopTimer !== null) clearTimeout(stopTimer)
    stopTimer = setTimeout(() => {
      stopTimer = null
      options.onStop?.(state(event, 0, 0))
      engaged = false
      velocityAnchored = false // the next gesture re-seeds its own velocity
      totalX = 0
      totalY = 0
    }, STOP_DELAY_MS)
  }

  // Fold one delta into the accumulators, gate on tolerance, then fan out.
  const report = (event: Event, rawDeltaX: number, rawDeltaY: number): void => {
    const deltaX = onlyAxis === 'y' ? 0 : rawDeltaX
    const deltaY = onlyAxis === 'x' ? 0 : rawDeltaY
    // Seed the trackers on the gesture's first event (wheel has no press to do
    // it), so velocity is measured between successive events, never from page
    // load or a stale prior gesture - which would flip its sign.
    if (!velocityAnchored) {
      vx.start(totalX, event.timeStamp)
      vy.start(totalY, event.timeStamp)
      velocityAnchored = true
    }
    totalX += deltaX
    totalY += deltaY
    vx.sample(totalX, event.timeStamp)
    vy.sample(totalY, event.timeStamp)
    if (!engaged && Math.abs(totalX) < tolerance && Math.abs(totalY) < tolerance) return // dead zone
    engaged = true
    const s = state(event, deltaX, deltaY)
    options.onChange?.(s)
    if (deltaX > 0) options.onRight?.(s)
    else if (deltaX < 0) options.onLeft?.(s)
    if (deltaY > 0) options.onDown?.(s)
    else if (deltaY < 0) options.onUp?.(s)
    scheduleStop(event)
  }

  const onWheelEvent = (event: WheelEvent): void => {
    if (preventDefault) event.preventDefault()
    const scale = event.deltaMode === 1 ? LINE_HEIGHT : event.deltaMode === 2 ? PAGE_HEIGHT : 1
    const deltaX = event.deltaX * scale * wheelSpeed
    const deltaY = event.deltaY * scale * wheelSpeed
    report(event, deltaX, deltaY) // fold first so the raw hook sees current totals + velocity
    options.onWheel?.(state(event, deltaX, deltaY))
  }

  const onPointerDown = (event: PointerEvent): void => {
    dragging = true
    pressX = lastX = event.clientX
    pressY = lastY = event.clientY
    totalX = 0
    totalY = 0
    engaged = tolerance <= 0 && dragMinimum <= 0
    velocityAnchored = false // report() seeds the trackers on the first move
    if (stopTimer !== null) {
      clearTimeout(stopTimer)
      stopTimer = null
    }
    try {
      ;(event.target as Element).setPointerCapture?.(event.pointerId)
    } catch {
      // no active pointer (synthetic events); ignore
    }
    options.onPress?.(state(event, 0, 0))
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging) return
    const deltaX = event.clientX - lastX
    const deltaY = event.clientY - lastY
    lastX = event.clientX
    lastY = event.clientY
    // Hold fire until the press has traveled dragMinimum px.
    if (!engaged && dragMinimum > 0 && Math.hypot(event.clientX - pressX, event.clientY - pressY) < dragMinimum) {
      totalX += onlyAxis === 'y' ? 0 : deltaX
      totalY += onlyAxis === 'x' ? 0 : deltaY
      return
    }
    report(event, deltaX, deltaY) // fold first so the raw hook sees current totals + velocity
    options.onDrag?.(state(event, deltaX, deltaY))
  }

  const onPointerUp = (event: PointerEvent): void => {
    if (!dragging) return
    dragging = false
    options.onRelease?.(state(event, 0, 0))
  }

  const add = (): void => {
    if (wantsWheel) target.addEventListener('wheel', onWheelEvent as EventListener, { passive: !preventDefault })
    if (wantsDrag) {
      target.addEventListener('pointerdown', onPointerDown as EventListener)
      target.addEventListener('pointermove', onPointerMove as EventListener)
      target.addEventListener('pointerup', onPointerUp as EventListener)
      target.addEventListener('pointercancel', onPointerUp as EventListener)
    }
  }

  const remove = (): void => {
    target.removeEventListener('wheel', onWheelEvent as EventListener)
    target.removeEventListener('pointerdown', onPointerDown as EventListener)
    target.removeEventListener('pointermove', onPointerMove as EventListener)
    target.removeEventListener('pointerup', onPointerUp as EventListener)
    target.removeEventListener('pointercancel', onPointerUp as EventListener)
  }

  const observer: Observer = {
    enable() {
      if (enabled) return
      enabled = true
      add()
    },
    disable() {
      if (!enabled) return
      enabled = false
      remove()
      if (stopTimer !== null) {
        clearTimeout(stopTimer)
        stopTimer = null
      }
      dragging = false
      engaged = false
      velocityAnchored = false
      totalX = 0
      totalY = 0
    },
    dispose() {
      observer.disable()
    },
    get isEnabled() {
      return enabled
    },
  }
  observer.enable()
  return observer
}
