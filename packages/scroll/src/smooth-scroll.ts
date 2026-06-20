import type { SpringOptions } from '@underlying/core'
import { follow } from '@underlying/core/playback'
import type { ScrollControllerInternal } from './controller'
import { stiffnessFor } from './smooth'
import type { Disposable } from './types'

export interface SmoothScrollOptions {
  /** Catch-up time constant in seconds, mapped through stiffnessFor so the feel matches scrub/parallax. Default 0.1. */
  smooth?: number
  /** Direct spring override, merged after the stiffness default (an explicit spring wins). */
  spring?: SpringOptions
  /** Scales normalised wheel delta into virtual px. Default 1. */
  wheelMultiplier?: number
  /** Scales finger travel into virtual px on touchmove. Default 2. */
  touchMultiplier?: number
  /** Intercept Space/PageUp-Down/Home/End/Arrows and route them through the spring. Default true. */
  keyboard?: boolean
  /** Intercept touch with momentum. Default false - preventDefault on touchmove kills iOS native momentum / pull-to-refresh. */
  touch?: boolean
  /** Per moving-frame callback with the smoothed position and the spring's signed velocity. */
  onUpdate?(pos: number, velocity: number): void
}

export interface SmoothScroll extends Disposable {
  /** False under reduced motion (native scroll runs raw). */
  enabled(): boolean
  /** The spring's current aim, px. */
  target(): number
  /** Re-aim the spring (used by scroll-to/snap to share this one spring). */
  setTarget(pos: number, options?: { conserveVelocity?: boolean }): void
  /** The spring's instantaneous signed velocity, px/s. */
  velocity(): number
  /** Re-clamp the aim to maxScroll after a layout change. */
  refresh(): void
}

const LINE_PX = 16
// A native scroll diverging from the spring by more than this is the user (scrollbar,
// keyboard, anchor, find-in-page) - adopt it instead of fighting it.
const ADOPT_PX = 2

// The focused element, descending into open shadow roots (a web-component editor
// reports the shadow host as document.activeElement, not the inner editable).
const deepActiveElement = (): Element | null => {
  let el = document.activeElement
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement
  return el
}

const isFormField = (el: Element | null): boolean => {
  if (el === null) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (el as HTMLElement).isContentEditable === true
  )
}

/**
 * A document-level smooth-scroll engine. A single follow() spring owns a smoothed
 * scroll position and writes it into NATIVE scroll each moving frame (source.driveTo),
 * so the existing scrub/parallax/pin/velocity read the smoothed value with no change,
 * and the scrollbar, position:sticky, anchors and find-in-page keep working. Wheel,
 * touch (opt-in) and keyboard re-aim the spring; a user scroll the engine did not
 * drive is adopted rather than fought. Off under reduced motion (native scroll runs raw).
 */
export function createSmoothScroll(
  controller: ScrollControllerInternal,
  options: SmoothScrollOptions = {},
): SmoothScroll {
  const { scheduler, policy, axis } = controller
  const vertical = axis === 'y'
  const source = controller.source
  const eventTarget: EventTarget = controller.root ?? window
  const wheelMultiplier = options.wheelMultiplier ?? 1
  const touchMultiplier = options.touchMultiplier ?? 2
  const useKeyboard = options.keyboard ?? true
  const useTouch = options.touch ?? false
  const springConfig = { stiffness: stiffnessFor(options.smooth ?? 0.1), ...(options.spring ?? {}) }

  const clampPos = (p: number): number => {
    const max = source.maxScroll()
    return p < 0 ? 0 : p > max ? max : p
  }

  const f = follow(source.scrollPos(), { scheduler, ...springConfig })
  let aim = source.scrollPos()
  let attached = false
  const offDrive = f.value.on('change', (v) => {
    source.driveTo(v)
    options.onUpdate?.(v, f.value.velocity())
  })

  // Re-aim the spring. conserveVelocity springs from the live state (the default,
  // for input + scroll-to re-aim); !conserveVelocity jumps (adoption).
  const setAim = (next: number, conserveVelocity = true): void => {
    aim = clampPos(next)
    if (!conserveVelocity) f.value.set(aim) // jump first so target() re-seeds from here
    f.target(aim)
  }

  // ---- input ----
  const onWheel = (event: WheelEvent): void => {
    if (!attached) return
    const raw = vertical ? event.deltaY : event.deltaX
    const unit = event.deltaMode === 1 ? LINE_PX : event.deltaMode === 2 ? source.viewportSize() : 1
    const next = clampPos(aim + raw * unit * wheelMultiplier)
    if (next === aim) return // at the limit this way: let the wheel chain to the page
    event.preventDefault()
    aim = next
    f.target(aim)
  }

  let touchCoord = 0
  let touchOther = 0
  let touchAim = 0
  let touchLastCoord = 0
  let touchLastTime = 0
  let touchVel = 0
  let axisOwned: boolean | null = null
  const mainOf = (t: Touch): number => (vertical ? t.clientY : t.clientX)
  const crossOf = (t: Touch): number => (vertical ? t.clientX : t.clientY)

  const onTouchStart = (event: TouchEvent): void => {
    if (!attached || event.touches.length !== 1) return
    const t = event.touches[0] as Touch
    touchCoord = touchLastCoord = mainOf(t)
    touchOther = crossOf(t)
    touchAim = aim
    touchLastTime = event.timeStamp
    touchVel = 0
    axisOwned = null
  }
  const onTouchMove = (event: TouchEvent): void => {
    if (!attached || event.touches.length !== 1) return
    const t = event.touches[0] as Touch
    const coord = mainOf(t)
    if (axisOwned === null) {
      const dMain = Math.abs(coord - touchCoord)
      const dCross = Math.abs(crossOf(t) - touchOther)
      if (dMain < 6 && dCross < 6) return
      axisOwned = dMain >= dCross // a cross-axis swipe is left to the browser
    }
    if (!axisOwned) return
    event.preventDefault()
    setAim(touchAim + (touchCoord - coord) * touchMultiplier) // finger up -> scroll down
    const dt = event.timeStamp - touchLastTime
    if (dt > 0) touchVel = (touchLastCoord - coord) / dt // px finger / ms
    touchLastCoord = coord
    touchLastTime = event.timeStamp
  }
  const onTouchEnd = (): void => {
    if (!attached) return
    if (axisOwned && Math.abs(touchVel) > 0.1) {
      setAim(aim + touchVel * touchMultiplier * 200) // project a ~200ms inertial glide
    }
    axisOwned = null
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!attached || event.defaultPrevented) return
    if (event.ctrlKey || event.metaKey || event.altKey) return // leave OS/browser shortcuts alone
    if (isFormField(deepActiveElement())) return
    // an element scroller only owns the keys while focus is inside it
    if (controller.root && !controller.root.contains(document.activeElement)) return
    const vp = source.viewportSize()
    const back = vertical ? 'ArrowUp' : 'ArrowLeft'
    const fwd = vertical ? 'ArrowDown' : 'ArrowRight'
    let next: number
    switch (event.key) {
      case fwd:
        next = aim + 40
        break
      case back:
        next = aim - 40
        break
      case 'PageDown':
        next = aim + vp * 0.9
        break
      case 'PageUp':
        next = aim - vp * 0.9
        break
      case ' ':
        next = aim + (event.shiftKey ? -vp : vp) * 0.9
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = source.maxScroll()
        break
      default:
        return
    }
    event.preventDefault()
    setAim(next)
  }

  // ---- adopt a user scroll the engine did not drive ----
  const offScroll = source.onScroll(() => {
    if (!attached) return
    const pos = source.scrollPos()
    if (Math.abs(pos - f.value.get()) <= ADOPT_PX) return
    // a divergence pinned at the reachable boundary is the native clamp echoing back a
    // slightly different max, not a user scroll - adopting it would snap once at the edge.
    const max = source.maxScroll()
    if ((pos <= 0 && aim <= 0) || (pos >= max && aim >= max)) return
    setAim(pos, false)
  })

  const attach = (): void => {
    if (attached) return
    attached = true
    aim = source.scrollPos()
    f.value.set(aim)
    f.target(aim) // sync the spring's aim so a later re-aim to the pre-detach target is not dropped
    eventTarget.addEventListener('wheel', onWheel as EventListener, { passive: false })
    if (useTouch) {
      eventTarget.addEventListener('touchstart', onTouchStart as EventListener, { passive: true })
      eventTarget.addEventListener('touchmove', onTouchMove as EventListener, { passive: false })
      eventTarget.addEventListener('touchend', onTouchEnd as EventListener, { passive: true })
    }
    if (useKeyboard) window.addEventListener('keydown', onKeyDown)
  }
  const detach = (): void => {
    if (!attached) return
    attached = false
    f.stop()
    eventTarget.removeEventListener('wheel', onWheel as EventListener)
    eventTarget.removeEventListener('touchstart', onTouchStart as EventListener)
    eventTarget.removeEventListener('touchmove', onTouchMove as EventListener)
    eventTarget.removeEventListener('touchend', onTouchEnd as EventListener)
    window.removeEventListener('keydown', onKeyDown)
  }

  if (!policy.reduced()) attach()
  const offPolicy = policy.onChange((reduced) => {
    if (reduced) detach()
    else attach()
  })

  return {
    enabled: () => attached,
    target: () => aim,
    setTarget(pos, opts) {
      if (!attached) {
        source.scrollTo(clampPos(pos)) // reduced motion: instant
        return
      }
      setAim(pos, opts?.conserveVelocity ?? true)
    },
    velocity: () => f.value.velocity(),
    refresh() {
      if (attached) setAim(aim) // never restart the spring while detached (reduced motion)
    },
    dispose() {
      detach()
      offPolicy()
      offScroll()
      offDrive()
      f.dispose()
    },
  }
}
