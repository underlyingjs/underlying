import {
  bindStyle,
  onReducedMotionChange,
  prefersReducedMotion,
  type Scheduler,
  type SpringOptions,
  type StyleBindings,
} from '@underlying/core'
import { follow, type Follow } from '@underlying/core/playback'

/** A target state: any `bindStyle` channel (`scale`, `x`, `y`, `rotate`, `opacity`, ...) mapped to the value to spring to. */
export type InteractiveState = Partial<Record<keyof StyleBindings, number>>

export interface InteractiveOptions {
  /** Sprung while the pointer is over the element or it holds keyboard focus. */
  hover?: InteractiveState
  /** Sprung while the element is pressed (pointer held) or Enter/Space is held. Wins over hover per channel. */
  press?: InteractiveState
  /** The spring for every channel. */
  spring?: SpringOptions
  /** Frame loop; defaults to the shared rAF loop. Tests inject a manual one. */
  scheduler?: Scheduler
}

export type InteractiveStateName = 'rest' | 'hover' | 'press'

export interface Interactive {
  /** The current state: `'rest'`, `'hover'`, or `'press'`. */
  state(): InteractiveStateName
  /** Remove the listeners, unbind the transform, release the springs. */
  dispose(): void
}

type Channel = keyof StyleBindings

// The identity value a channel returns to at rest, so an undriven element shows no transform.
const restOf = (ch: Channel): number =>
  ch === 'scale' || ch === 'scaleX' || ch === 'scaleY' || ch === 'opacity'
    ? 1
    : ch === 'originX' || ch === 'originY'
      ? 50
      : 0

/**
 * Declarative hover / press state animations. Define a `hover` and/or `press` target
 * and the element springs to it on pointer-over or keyboard focus (hover) and while
 * pressed or Enter/Space is held (press), springing back on release - interruptible,
 * never a restart. Press wins over hover per channel, so a press that only moves `y`
 * keeps the hover `scale`. Keyboard parity (focus = hover, Enter/Space = press) and
 * emulated-touch-hover filtering are built in. Snaps instead of springing under reduced motion.
 */
export function interactive(element: HTMLElement, options: InteractiveOptions = {}): Interactive {
  const hover = options.hover ?? {}
  const press = options.press ?? {}
  const scheduler = options.scheduler
  const followOptions = scheduler ? { ...options.spring, scheduler } : { ...options.spring }
  const bindOptions = scheduler ? { scheduler } : undefined

  const channels = [...new Set([...Object.keys(hover), ...Object.keys(press)])] as Channel[]
  const follows = new Map<Channel, Follow>()
  const bindings: StyleBindings = {}
  for (const ch of channels) {
    const f = follow(restOf(ch), followOptions)
    follows.set(ch, f)
    bindings[ch] = f.value
  }
  const unbind = bindStyle(element, bindings, bindOptions)

  let hovering = false
  let pressing = false
  let reduced = prefersReducedMotion()
  let lastPointerType = ''
  // Focus maps to hover only on a hover-capable device - else a touch tap (which gives
  // and keeps focus) would leave the element stuck in the hover state.
  const canHover =
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function' ||
    window.matchMedia('(hover: hover)').matches
  const tag = element.tagName
  const nativeActivatable =
    tag === 'BUTTON' ||
    tag === 'SUMMARY' ||
    tag === 'SELECT' ||
    tag === 'TEXTAREA' ||
    tag === 'INPUT' ||
    (tag === 'A' && element.hasAttribute('href'))

  const apply = (): void => {
    for (const ch of channels) {
      const target =
        pressing && press[ch] !== undefined
          ? (press[ch] as number)
          : hovering && hover[ch] !== undefined
            ? (hover[ch] as number)
            : restOf(ch)
      const f = follows.get(ch) as Follow
      if (reduced) {
        f.value.set(target) // snap: state without motion
        f.target(target) // sync the aim for when motion returns...
        f.stop() // ...then stop, so the loop never wakes for a no-op frame
      } else {
        f.target(target)
      }
    }
  }

  // ---- pointer (touch-hover filtered) ----
  const onEnter = (event: PointerEvent): void => {
    lastPointerType = event.pointerType
    if (event.pointerType === 'touch') return // a tap is a press, not a hover
    hovering = true
    apply()
  }
  const onLeave = (): void => {
    hovering = false
    pressing = false // dragged off counts as release
    apply()
  }
  const onDown = (event: PointerEvent): void => {
    lastPointerType = event.pointerType
    pressing = true
    apply()
  }
  const onUp = (): void => {
    pressing = false
    apply()
  }

  // ---- keyboard parity ----
  const onFocus = (): void => {
    if (!canHover || lastPointerType === 'touch') return // touch tap keeps focus; don't stick hover
    hovering = true
    apply()
  }
  const onBlur = (): void => {
    hovering = false
    pressing = false
    apply()
  }
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return
    if (event.key === ' ' && !nativeActivatable) event.preventDefault() // stop a custom button scrolling the page
    pressing = true
    apply()
  }
  const onKeyUp = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    pressing = false
    apply()
  }

  element.addEventListener('pointerenter', onEnter)
  element.addEventListener('pointerleave', onLeave)
  element.addEventListener('pointerdown', onDown)
  element.addEventListener('pointerup', onUp)
  element.addEventListener('pointercancel', onUp)
  element.addEventListener('focus', onFocus)
  element.addEventListener('blur', onBlur)
  element.addEventListener('keydown', onKeyDown)
  element.addEventListener('keyup', onKeyUp)

  const offPolicy = onReducedMotionChange((isReduced) => {
    reduced = isReduced
    apply() // re-settle the current state in the new mode
  })

  return {
    state: () => (pressing ? 'press' : hovering ? 'hover' : 'rest'),
    dispose() {
      element.removeEventListener('pointerenter', onEnter)
      element.removeEventListener('pointerleave', onLeave)
      element.removeEventListener('pointerdown', onDown)
      element.removeEventListener('pointerup', onUp)
      element.removeEventListener('pointercancel', onUp)
      element.removeEventListener('focus', onFocus)
      element.removeEventListener('blur', onBlur)
      element.removeEventListener('keydown', onKeyDown)
      element.removeEventListener('keyup', onKeyUp)
      offPolicy()
      unbind()
      for (const f of follows.values()) f.dispose()
    },
  }
}
