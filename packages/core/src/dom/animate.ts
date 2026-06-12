import { getReducedMotionBehavior, type ReducedMotionBehavior } from '../a11y/config'
import { prefersReducedMotion } from '../a11y/reduced-motion'
import { easeInOutCubic, type Easing } from '../physics/easings'
import type { SpringOptions } from '../physics/spring'
import type { ToOptions } from '../physics/tween'
import type { Scheduler } from '../scheduler/scheduler'
import { getSharedScheduler } from '../scheduler/shared'
import { animatable, type Animatable, type AnimationHandle } from '../value/animatable'
import { bindStyle, type StyleBindings } from './bind-style'
import { formatTransform, type TransformChannels } from './transform'

type Channel = keyof StyleBindings

export type AnimateTargets = Partial<Record<Channel, number>>

export interface AnimateOptions extends Omit<SpringOptions, 'reducedMotion'> {
  /** ms - providing a duration switches to the tween escape hatch. */
  duration?: number
  easing?: Easing
  scheduler?: Scheduler
  /** Element-level reduced-motion strategy - 'fade' keeps opacity animated. */
  reducedMotion?: ReducedMotionBehavior
}

// First touch of a channel starts from its CSS-neutral value; afterwards the
// cached animatable carries the real state across calls - that is what makes
// a second animate() an interruption instead of a parallel animation.
const INITIAL: Record<Channel, number> = { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }

const TRANSFORM_CHANNELS: ReadonlyArray<Channel> = ['x', 'y', 'scale', 'rotate']

/** The slice of a WAAPI Animation the delegation relies on (testable shape). */
interface DelegatedAnimation {
  currentTime: CSSNumberish | null
  onfinish: (() => void) | null
  cancel(): void
}

interface DelegatedTween {
  animation: DelegatedAnimation
  channels: Map<Channel, { from: number; to: number }>
  durationMs: number
  easing: Easing
  finish: () => void
}

interface ElementEntry {
  values: Partial<Record<Channel, Animatable>>
  disposeBinding: () => void
  scheduler: Scheduler
  delegated: DelegatedTween | null
}

const registry = new WeakMap<HTMLElement, ElementEntry>()

const supportsWaapi = (element: HTMLElement): boolean =>
  typeof element.animate === 'function' &&
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('animation-timing-function', 'linear(0, 1)')

// Arbitrary easing functions ride to the compositor as a sampled linear().
const EASING_SAMPLES = 16
const toLinearEasing = (easing: Easing): string => {
  const stops: string[] = []
  for (let i = 0; i <= EASING_SAMPLES; i++) stops.push(String(easing(i / EASING_SAMPLES)))
  return `linear(${stops.join(', ')})`
}

/**
 * Take control back from the compositor: evaluate the curve at currentTime -
 * position AND derivative - seed the animatables with both, cancel WAAPI.
 * No DOM readback, no precision loss: the math was ours all along.
 */
const reclaim = (entry: ElementEntry): void => {
  const delegated = entry.delegated
  if (delegated === null) return
  entry.delegated = null

  const elapsedMs = Math.min(
    Number(delegated.animation.currentTime ?? delegated.durationMs),
    delegated.durationMs,
  )
  const progress = delegated.durationMs <= 0 ? 1 : elapsedMs / delegated.durationMs
  const window = 0.01
  const p1 = Math.min(1, progress + window)
  const p0 = Math.max(0, progress - window)
  const slope = (delegated.easing(p1) - delegated.easing(p0)) / (p1 - p0)

  for (const [channel, range] of delegated.channels) {
    const value = entry.values[channel]
    if (value === undefined) continue
    const span = range.to - range.from
    value.set(range.from + span * delegated.easing(progress), {
      velocity: (span * slope) / (delegated.durationMs / 1000),
    })
  }
  delegated.animation.cancel()
  delegated.finish()
}

const ensureChannel = (entry: ElementEntry, channel: Channel): { value: Animatable; created: boolean } => {
  const existing = entry.values[channel]
  if (existing !== undefined) return { value: existing, created: false }
  const value = animatable(INITIAL[channel], { scheduler: entry.scheduler })
  entry.values[channel] = value
  return { value, created: true }
}

const rebind = (entry: ElementEntry, element: HTMLElement): void => {
  entry.disposeBinding()
  entry.disposeBinding = bindStyle(element, entry.values, { scheduler: entry.scheduler })
}

const delegateTween = (
  entry: ElementEntry,
  element: HTMLElement,
  targets: AnimateTargets,
  durationMs: number,
  easing: Easing,
): AnimationHandle => {
  const channels = new Map<Channel, { from: number; to: number }>()
  let newChannel = false
  for (const channel of Object.keys(targets) as Channel[]) {
    const target = targets[channel]
    if (target === undefined) continue
    const { value, created } = ensureChannel(entry, channel)
    newChannel ||= created
    channels.set(channel, { from: value.get(), to: target })
  }
  if (newChannel) rebind(entry, element)

  // A transform keyframe overrides the whole property: carry the untouched
  // transform channels along as constants.
  if ([...channels.keys()].some((channel) => channel !== 'opacity')) {
    for (const channel of TRANSFORM_CHANNELS) {
      const value = entry.values[channel]
      if (value !== undefined && !channels.has(channel)) {
        channels.set(channel, { from: value.get(), to: value.get() })
      }
    }
  }

  const buildFrame = (pick: (range: { from: number; to: number }) => number): Record<string, string> => {
    const frame: Record<string, string> = {}
    const transform: TransformChannels = {}
    for (const [channel, range] of channels) {
      if (channel === 'opacity') frame['opacity'] = String(pick(range))
      else transform[channel] = pick(range)
    }
    if (Object.keys(transform).length > 0) frame['transform'] = formatTransform(transform)
    return frame
  }

  let resolveFinished = () => {}
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve
  })

  // Narrowed to the testable slice - DOM's Animation.onfinish signature
  // (event parameter, this-typing) is irrelevant here.
  const animation = element.animate(
    [buildFrame((range) => range.from), buildFrame((range) => range.to)],
    { duration: durationMs, easing: toLinearEasing(easing), fill: 'forwards' },
  ) as unknown as DelegatedAnimation
  const tween: DelegatedTween = { animation, channels, durationMs, easing, finish: resolveFinished }
  entry.delegated = tween

  animation.onfinish = () => {
    if (entry.delegated !== tween) return
    entry.delegated = null
    for (const [channel, range] of channels) entry.values[channel]?.set(range.to)
    // Cancel only after the next render flush wrote the committed values -
    // cancelling first would flash the pre-animation inline style.
    const unsubscribe = entry.scheduler.subscribe(() => {
      unsubscribe()
      animation.cancel()
    }, 'render')
    resolveFinished()
  }

  return {
    finished,
    stop: () => {
      if (entry.delegated === tween) reclaim(entry)
    },
  }
}

/**
 * Imperative escape hatch: spring (default) or tween the supported style
 * channels of an element. Repeated calls on the same element retarget the
 * same underlying animatables - velocity is conserved, never a jump.
 * Duration tweens ride the compositor (WAAPI) when that is free to do.
 */
export function animate(
  element: HTMLElement,
  targets: AnimateTargets,
  options: AnimateOptions = {},
): AnimationHandle {
  let entry = registry.get(element)
  if (entry === undefined) {
    entry = {
      values: {},
      disposeBinding: () => {},
      scheduler: options.scheduler ?? getSharedScheduler(),
      delegated: null,
    }
    registry.set(element, entry)
  }
  // Any new call on the element interrupts a delegated tween first.
  reclaim(entry)

  const behavior = options.reducedMotion ?? getReducedMotionBehavior()
  const reduced = behavior !== 'allow' && prefersReducedMotion()

  if (!reduced && options.duration !== undefined && supportsWaapi(element)) {
    const anyAnimating = Object.values(entry.values).some(
      (value) => value !== undefined && value.isAnimating(),
    )
    if (!anyAnimating) {
      return delegateTween(entry, element, targets, options.duration, options.easing ?? easeInOutCubic)
    }
  }

  const handles: AnimationHandle[] = []
  let newChannel = false
  for (const channel of Object.keys(targets) as Channel[]) {
    const target = targets[channel]
    if (target === undefined) continue
    const { value, created } = ensureChannel(entry, channel)
    newChannel ||= created
    if (reduced) {
      // 'fade' keeps opacity animated (vestibular-safe); movement snaps.
      if (behavior === 'fade' && channel === 'opacity') {
        handles.push(value.to(target, { duration: 250, reducedMotion: 'allow' }))
      } else {
        handles.push(value.spring(target, { reducedMotion: 'skip' }))
      }
    } else if (options.duration !== undefined) {
      // The reduced-motion decision is made here, element-side - the value
      // must not re-apply it ('allow' downstream).
      const toOptions: ToOptions =
        options.easing === undefined
          ? { duration: options.duration, reducedMotion: 'allow' }
          : { duration: options.duration, easing: options.easing, reducedMotion: 'allow' }
      handles.push(value.to(target, toOptions))
    } else {
      handles.push(value.spring(target, { ...options, reducedMotion: 'allow' }))
    }
  }

  if (newChannel) rebind(entry, element)

  return {
    finished: Promise.all(handles.map((handle) => handle.finished)).then(() => undefined),
    stop: () => {
      for (const handle of handles) handle.stop()
    },
  }
}
