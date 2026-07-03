import { getReducedMotionBehavior, type ReducedMotionBehavior } from '../a11y/config'
import { prefersReducedMotion } from '../a11y/reduced-motion'
import { resolveEasing, type EasingInput } from '../physics/easing-registry'
import { easeInOutCubic, type Easing } from '../physics/easings'
import type { SpringOptions } from '../physics/spring'
import type { ToOptions } from '../physics/tween'
import type { Scheduler } from '../scheduler/scheduler'
import { getSharedScheduler } from '../scheduler/shared'
import { channelGroup, type ChannelGroup } from '../value/channel-group'
import { resolveValueType } from '../value/registry'
import type { ParsedValue, ValueType } from '../value/value-type'
import { warnOnce } from '../value/warn'
import { animatable, type Animatable, type AnimationHandle } from '../value/animatable'
import { waitFrames } from '../compose/wait'
import type { DelayFn } from '../compose/stagger-delay'
import { bindProperty, type PropertyBinding } from './bind-property'
import { bindStyle } from './bind-style'
import {
  fillOffsets,
  normalizeKeyframes,
  runKeyframeChain,
  type ChainConfig,
  type ChainOps,
  type KeyframeChain,
  type KeyframeInput,
  type NormalizedKeyframes,
} from './keyframes'
import { readAttribute, readStyle, toKebab, type StyleReader } from './read-style'
import { isHTMLElement, resolveTargets, type AnimatableElement, type AnimationTarget } from './resolve-target'
import {
  needsResolve,
  resolveValue,
  type Magnitude,
  type RelativeValue,
  type ResolvableValue,
  type ResolveContext,
  type ValueFn,
} from './resolve-value'
import {
  formatOrigin,
  formatTransform,
  ORIGIN_KEYS,
  TRANSFORM_KEYS,
  type OriginChannel,
  type OriginChannels,
  type TransformChannel,
  type TransformChannels,
} from './transform'
import { createMeasure } from './units'

type Channel = TransformChannel | OriginChannel | 'opacity'

/** A CSS value the registry path animates: a number or a CSS string. */
export type AnimateValue = number | string

/**
 * Keyframe waypoints. Each entry is a bare value, `null` (from-current at index 0,
 * a hold later), or an expressive `{ value, at, ease }` stop for per-segment
 * position and easing.
 */
export type AnimateKeyframes = ReadonlyArray<KeyframeInput<AnimateValue>>
export type NumericKeyframes = ReadonlyArray<KeyframeInput<number>>

/**
 * Any property key that is NOT one of the five numeric channels: a
 * CSSStyleDeclaration property (camelCase), a custom property, or an `attr:name`
 * key routed to setAttribute (SVG/element attributes - viewBox, r, points). A typo
 * like `{ opactiy: 1 }` does not compile. (CSSStyleDeclaration method names
 * type-check as keys - accepted noise.)
 */
export type AnimateProperty = Exclude<Extract<keyof CSSStyleDeclaration, string>, Channel> | `--${string}` | `attr:${string}`

/** A numeric-channel key: a transform/origin channel, opacity, or the autoAlpha alias (opacity + visibility). */
type NumericKey = Channel | 'autoAlpha'

export type { AnimationTarget } from './resolve-target'
export type { RelativeValue, ValueFn } from './resolve-value'

/** A numeric-channel target: absolute, keyframes, a relative string, or a per-target function. */
type ResolvableNumeric = number | NumericKeyframes | RelativeValue | ValueFn<number | NumericKeyframes | RelativeValue>
/** A registry-property target: absolute, keyframes, a relative string, or a per-target function. */
type ResolvableProperty =
  | AnimateValue
  | AnimateKeyframes
  | RelativeValue
  | ValueFn<AnimateValue | AnimateKeyframes | RelativeValue>

/**
 * The five channels stay numeric; everything else routes through the value-type
 * registry. Each value may also be a relative string (`'+=100'`) resolved against
 * the current value, or a per-target function `(index, element, count) => value`.
 * The keys are unchanged, so a typo like `{ opactiy: 1 }` still does not compile.
 */
export type AnimateTargets = Partial<Record<NumericKey, ResolvableNumeric>> &
  Partial<Record<AnimateProperty, ResolvableProperty>>

/** The absolute targets animateOne() consumes after the per-element pre-pass (no functions/relatives). */
type ResolvedTargets = Partial<Record<Channel, number | NumericKeyframes>> &
  Partial<Record<AnimateProperty, AnimateValue | AnimateKeyframes>>

/** A from-state numeric value: absolute, a relative string, or a per-target function (no keyframes - a from-state is one value). */
type FromNumeric = number | RelativeValue | ValueFn<number | RelativeValue>
/** A from-state registry value: absolute, a relative string, or a per-target function (no keyframes). */
type FromProperty = AnimateValue | RelativeValue | ValueFn<AnimateValue | RelativeValue>

/**
 * An entrance from-state: the same keys and value forms as a target (channels
 * plus arbitrary CSS properties; absolute, relative `'+='`, or a per-target
 * function), but a single value per key - a from-state is one point, not a
 * keyframe path. Resolved per element against the live value at the call.
 */
export type FromTargets = Partial<Record<NumericKey, FromNumeric>> & Partial<Record<AnimateProperty, FromProperty>>

/** The absolute from-state setStyle() teleports to, after per-element resolution. */
type ResolvedFrom = Partial<Record<NumericKey, number>> & Partial<Record<AnimateProperty, AnimateValue>>

export interface AnimateOptions extends Omit<SpringOptions, 'reducedMotion'> {
  /** ms - providing a duration switches to the tween escape hatch. */
  duration?: number
  easing?: EasingInput
  scheduler?: Scheduler
  /**
   * Per-target start delay. A number staggers each target by index*delay; a
   * `DelayFn` from `staggerDelay()` is an expressive wave (origin, grid, axis,
   * easing). On a single element it is just a flat lead-in.
   */
  delay?: number | DelayFn
  /** Element-level reduced-motion strategy - 'fade' keeps opacity AND colors animated. */
  reducedMotion?: ReducedMotionBehavior
  /**
   * Entrance from-state. Each key is set to its from-value SYNCHRONOUSLY at the
   * call (no flash, no manual setStyle), then animated to `targets`. With a
   * stagger `delay`, every element is parked at its from-state immediately and
   * holds it through its own delay, like a real entrance. Same value forms as a
   * target (absolute, relative `'+='`, per-target function), resolved per element
   * against the live value. Under reduced motion the from-set is skipped: the
   * element ends at `targets`, never stranded at the from-state. The `from()` and
   * `fromTo()` helpers are thin sugar over this option.
   */
  from?: FromTargets
  /** Fired once when the animation begins. */
  onStart?(this: object, handle: AnimationHandle): void
  /**
   * Per frame with the live numeric channel values (`{ x, y, scale, ... }`). Requesting it
   * runs the JS path (a per-frame tick), so it skips the WAAPI compositor fast path. Unlike a
   * single value's `onUpdate`, this is NOT change-guarded - it ticks every frame of the run
   * (a multi-channel object has no single "changed"); guard in the callback if you need to.
   */
  onUpdate?(this: object, values: Record<string, number>, handle: AnimationHandle): void
  /** Fired once when every channel settles (no channel was interrupted). */
  onComplete?(this: object, handle: AnimationHandle): void
  /** Fired once when a channel is superseded by a later animate(), or the handle is stopped. */
  onInterrupt?(this: object, handle: AnimationHandle): void
  /** The `this` receiver for the callbacks. Defaults to the handle. */
  scope?: object
}

/**
 * True if any lifecycle callback was requested - then the numeric path stays on the JS loop.
 * Even onStart/onComplete/scope opt out of WAAPI: the compositor reclaim path resolves
 * `finished` on a supersede the same as on a settle, so it cannot tell onComplete (settle)
 * from onInterrupt (supersede). The JS path can - each child handle reports its own interrupt -
 * so honoring the onComplete contract (never fires on a supersede) means owning every frame.
 */
const hasLifecycle = (o: AnimateOptions): boolean =>
  o.onStart !== undefined ||
  o.onUpdate !== undefined ||
  o.onComplete !== undefined ||
  o.onInterrupt !== undefined ||
  o.scope !== undefined

// First touch of a channel starts from its CSS-neutral value; afterwards the
// cached animatable carries the real state across calls - that is what makes
// a second animate() an interruption instead of a parallel animation.
const INITIAL: Record<Channel, number> = {
  perspective: 0,
  x: 0,
  y: 0,
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  rotate: 0,
  skewX: 0,
  skewY: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  originX: 50,
  originY: 50,
  opacity: 1,
}

const TRANSFORM_CHANNELS: ReadonlyArray<Channel> = TRANSFORM_KEYS
const NUMERIC_CHANNELS = new Set<string>([...TRANSFORM_KEYS, ...ORIGIN_KEYS, 'opacity'])

/** The slice of a WAAPI Animation the delegation relies on (testable shape). */
export interface DelegatedAnimation {
  currentTime: CSSNumberish | null
  onfinish: (() => void) | null
  cancel(): void
  // Optional members the playback layer drives; the two-field call sites here are unaffected.
  playbackRate?: number
  pause?(): void
  play?(): void
}

/** Internal handle the playback layer maps controls onto. Not re-exported from the package entry. */
export interface DelegatedControls {
  readonly animation: DelegatedAnimation
  readonly durationMs: number
}

interface DelegatedTween {
  animation: DelegatedAnimation
  /** Per-channel frame arrays, all of length n (the keyframe count). */
  channels: Map<Channel, number[]>
  n: number
  durationMs: number
  easing: Easing
  finish: () => void
}

interface GroupEntry {
  group: ChannelGroup
  binding: PropertyBinding
  /** 'attr' groups clean up via removeAttribute; 'style' via style.removeProperty. */
  target: PropTarget
  /** The bare DOM name written (an attribute name, or the style property). */
  name: string
}

/** Where a registry-property group writes: an inline style property or an element attribute. */
type PropTarget = 'style' | 'attr'
const ATTR_PREFIX = 'attr:'
const isAttrKey = (key: string): boolean => key.startsWith(ATTR_PREFIX)
/** The bare DOM name behind a target key ('attr:r' -> 'r'; a style key is itself). */
const bareName = (key: string): string => (key.startsWith(ATTR_PREFIX) ? key.slice(ATTR_PREFIX.length) : key)

interface ElementEntry {
  values: Partial<Record<Channel, Animatable>>
  disposeBinding: () => void
  scheduler: Scheduler
  delegated: DelegatedTween | null
  groups: Map<string, GroupEntry>
  /** Per-key running keyframe chains, so a new animate() on that key can interrupt them. */
  chains: Map<string, () => void>
  /** Bumped on every animation intent on this element, so a pending staggered start can tell it was superseded. */
  generation: number
  /** Once autoAlpha touched this element, its opacity write also toggles visibility. */
  autoAlpha: boolean
}

/** Mark a new animation intent on the element and return the fresh generation token. */
const markIntent = (entry: ElementEntry): number => (entry.generation += 1)

const registry = new WeakMap<AnimatableElement, ElementEntry>()

const supportsWaapi = (element: AnimatableElement): boolean =>
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
 * position AND derivative, per segment - seed the animatables with both, cancel
 * WAAPI. No DOM readback, no precision loss: the math was ours all along. With
 * n keyframes the progress maps onto an even segment grid; n = 2 degenerates to
 * a single segment (the original two-keyframe reclaim).
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
  const segments = delegated.n - 1
  const s = progress * segments
  const index = Math.min(Math.floor(s), segments - 1)
  const t = s - index
  const window = 0.01
  const t1 = Math.min(1, t + window)
  const t0 = Math.max(0, t - window)
  const slope = (delegated.easing(t1) - delegated.easing(t0)) / (t1 - t0)
  const segmentDurationS = delegated.durationMs / 1000 / segments
  // A reversed delegated tween (playbackRate < 0) hands back a negated velocity;
  // the forward path defaults to 1, so existing reclaims are byte-identical.
  const rateSign = Math.sign(delegated.animation.playbackRate ?? 1) || 1

  for (const [channel, frames] of delegated.channels) {
    const value = entry.values[channel]
    if (value === undefined) continue
    const from = frames[index] ?? 0
    const to = frames[index + 1] ?? from
    const span = to - from
    value.set(from + span * delegated.easing(t), { velocity: ((span * slope) / segmentDurationS) * rateSign })
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

const rebind = (entry: ElementEntry, element: AnimatableElement): void => {
  entry.disposeBinding()
  entry.disposeBinding = bindStyle(element, entry.values, { scheduler: entry.scheduler, autoAlpha: entry.autoAlpha })
}

type NumericNorm = { teleport: number | undefined; waypoints: number[] }

const delegateMultiKeyframe = (
  entry: ElementEntry,
  element: AnimatableElement,
  scalars: Array<[Channel, number]>,
  keyframeNorms: Array<[Channel, NumericNorm]>,
  durationMs: number,
  easing: Easing,
): AnimationHandle => {
  const channels = new Map<Channel, number[]>()
  let newChannel = false
  for (const [channel, target] of scalars) {
    const { value, created } = ensureChannel(entry, channel)
    newChannel ||= created
    channels.set(channel, [value.get(), target])
  }
  for (const [channel, norm] of keyframeNorms) {
    const { value, created } = ensureChannel(entry, channel)
    newChannel ||= created
    channels.set(channel, norm.teleport !== undefined ? [norm.teleport, ...norm.waypoints] : [value.get(), ...norm.waypoints])
  }
  if (newChannel) rebind(entry, element)

  const n = [...channels.values()][0]?.length ?? 2

  // A transform / transform-origin keyframe overrides the whole property, so
  // carry the untouched channels of that group along as constants every frame.
  const animatedKeys = [...channels.keys()]
  const carry = (group: ReadonlyArray<Channel>): void => {
    for (const channel of group) {
      const value = entry.values[channel]
      if (value !== undefined && !channels.has(channel)) {
        channels.set(channel, new Array<number>(n).fill(value.get()))
      }
    }
  }
  if (animatedKeys.some((c) => c !== 'opacity' && c !== 'originX' && c !== 'originY')) carry(TRANSFORM_CHANNELS)
  if (animatedKeys.some((c) => c === 'originX' || c === 'originY')) carry(ORIGIN_KEYS)

  const linearEasing = toLinearEasing(easing)
  const keyframes: Record<string, string>[] = []
  for (let i = 0; i < n; i++) {
    const frame: Record<string, string> = {}
    const transform: TransformChannels = {}
    const origin: OriginChannels = {}
    for (const [channel, frames] of channels) {
      const value = frames[i] ?? 0
      if (channel === 'opacity') frame['opacity'] = String(value)
      else if (channel === 'originX' || channel === 'originY') origin[channel] = value
      else transform[channel] = value
    }
    if (Object.keys(transform).length > 0) frame['transform'] = formatTransform(transform)
    if (Object.keys(origin).length > 0) frame['transformOrigin'] = formatOrigin(origin)
    // Multi-keyframe: the easing rides each keyframe but the last - WAAPI applies
    // a keyframe's easing across the interval to the next one (so the JS reclaim
    // and the compositor agree on per-segment timing).
    if (n > 2 && i < n - 1) frame['easing'] = linearEasing
    keyframes.push(frame)
  }

  let resolveFinished = () => {}
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve
  })

  // Two keyframes: a single segment, easing at the animation level - the
  // original delegation shape.
  const options: Record<string, unknown> = { duration: durationMs, fill: 'forwards' }
  if (n === 2) options['easing'] = linearEasing
  const animation = element.animate(keyframes, options) as unknown as DelegatedAnimation
  const tween: DelegatedTween = { animation, channels, n, durationMs, easing, finish: resolveFinished }
  entry.delegated = tween

  animation.onfinish = () => {
    if (entry.delegated !== tween) return
    entry.delegated = null
    for (const [channel, frames] of channels) entry.values[channel]?.set(frames[frames.length - 1] ?? 0)
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

const RESOLVED: AnimationHandle = { finished: Promise.resolve(), stop: () => {} }

// Forwards its children's interrupt up as ONE interrupt, so an outer lifecycle
// owner (multi-target withLifecycle, where each child IS an aggregate) can tell a
// supersede from a settle. The single-channel case returns the bare handle, which
// already carries eventCallback.
const aggregate = (handles: AnimationHandle[]): AnimationHandle => {
  if (handles.length === 0) return RESOLVED
  if (handles.length === 1) return handles[0]!
  let onInterrupt: ((h: AnimationHandle) => void) | null = null
  let fired = false
  const fireInterrupt = (): void => {
    if (fired) return
    fired = true
    onInterrupt?.(handle)
  }
  for (const child of handles) child.eventCallback?.('interrupt', fireInterrupt)
  const handle: AnimationHandle = {
    finished: Promise.all(handles.map((child) => child.finished)).then(() => undefined),
    stop: () => {
      for (const child of handles) child.stop()
    },
    eventCallback(event, fn) {
      if (event === 'interrupt') onInterrupt = fn ?? null
      return handle
    },
  }
  return handle
}

/**
 * Wrap the aggregate with lifecycle callbacks. onStart fires synchronously; onUpdate
 * ticks the live numeric values each frame (not change-guarded - see AnimateOptions);
 * the FIRST child interrupted fires onInterrupt, else onComplete fires at settle. Every
 * child reports its own interrupt: a numeric channel IS an animatable, and the keyframe
 * chain and registry-property group each forward their interrupt through eventCallback,
 * so a superseded color or keyframe channel reads as onInterrupt, never a false onComplete.
 * post-hoc eventCallback handles start/complete/interrupt; onUpdate must be passed at the
 * call (it decides the JS path up front), and repeat/reverseComplete are playback-only.
 */
const withLifecycle = (
  base: AnimationHandle,
  children: AnimationHandle[],
  options: AnimateOptions,
  readValues: () => Record<string, number>,
  scheduler: Scheduler,
): AnimationHandle => {
  const scope = options.scope
  let onStart = options.onStart
  let onUpdate = options.onUpdate
  let onComplete = options.onComplete
  let onInterrupt = options.onInterrupt
  let ended = false
  let unsubUpdate: (() => void) | null = null
  let handle: AnimationHandle
  const finishUpdate = (): void => {
    unsubUpdate?.()
    unsubUpdate = null
  }
  const end = (cb: ((this: object, handle: AnimationHandle) => void) | undefined): void => {
    if (ended) return
    ended = true
    finishUpdate()
    cb?.call(scope ?? handle, handle)
  }

  for (const child of children) child.eventCallback?.('interrupt', () => end(onInterrupt))
  void base.finished.then(() => end(onComplete))

  handle = {
    finished: base.finished,
    stop: () => base.stop(), // interrupts the children -> their interrupt fires onInterrupt above
    eventCallback(event, fn) {
      const cb = fn ?? undefined
      if (event === 'start') onStart = cb as AnimateOptions['onStart']
      else if (event === 'complete') onComplete = cb as AnimateOptions['onComplete']
      else if (event === 'interrupt') onInterrupt = cb as AnimateOptions['onInterrupt']
      return handle
    },
  }

  if (onUpdate !== undefined) {
    unsubUpdate = scheduler.subscribe(() => {
      if (ended) {
        finishUpdate()
        return
      }
      onUpdate?.call(scope ?? handle, readValues(), handle)
    })
  }
  onStart?.call(scope ?? handle, handle)
  return handle
}

const springOptionsFrom = (options: AnimateOptions): SpringOptions => {
  const spring: SpringOptions = { reducedMotion: 'allow' }
  if (options.stiffness !== undefined) spring.stiffness = options.stiffness
  if (options.damping !== undefined) spring.damping = options.damping
  if (options.mass !== undefined) spring.mass = options.mass
  if (options.velocity !== undefined) spring.velocity = options.velocity
  if (options.restDelta !== undefined) spring.restDelta = options.restDelta
  if (options.restSpeed !== undefined) spring.restSpeed = options.restSpeed
  return spring
}

/** Stop a running keyframe chain on this key (a new motion is taking over). */
const interruptKey = (entry: ElementEntry, key: string): void => {
  const interrupt = entry.chains.get(key)
  if (interrupt !== undefined) {
    entry.chains.delete(key)
    interrupt()
  }
}

/** Register a chain so the next animate() on its key can interrupt it, and self-clean on completion. */
const startChain = (entry: ElementEntry, key: string, chain: KeyframeChain): AnimationHandle => {
  entry.chains.set(key, chain.interrupt)
  void chain.handle.finished.then(() => {
    if (entry.chains.get(key) === chain.interrupt) entry.chains.delete(key)
  })
  return chain.handle
}

/** The motion for one scalar numeric target - the original per-channel decision. */
const startNumericScalar = (
  value: Animatable,
  target: number,
  channel: Channel,
  options: AnimateOptions,
  behavior: ReducedMotionBehavior,
  reduced: boolean,
): AnimationHandle => {
  if (reduced) {
    if (behavior === 'fade' && channel === 'opacity') {
      return value.to(target, { duration: 250, reducedMotion: 'allow' })
    }
    return value.spring(target, { reducedMotion: 'skip' })
  }
  if (options.duration !== undefined) {
    const toOptions: ToOptions =
      options.easing === undefined
        ? { duration: options.duration, reducedMotion: 'allow' }
        : { duration: options.duration, easing: options.easing, reducedMotion: 'allow' }
    return value.to(target, toOptions)
  }
  return value.spring(target, springOptionsFrom(options))
}

/** Start the right motion on a group given the element-side reduced-motion decision. */
const startGroupMotion = (
  group: ChannelGroup,
  target: ParsedValue,
  type: ValueType,
  options: AnimateOptions,
  behavior: ReducedMotionBehavior,
  reduced: boolean,
): AnimationHandle => {
  if (reduced) {
    // Colors (non-spatial) keep crossfading under 'fade'; everything spatial snaps.
    if (behavior === 'fade' && type.spatial === false) {
      return group.to(target, { duration: 250, reducedMotion: 'allow' })
    }
    return group.spring(target, { reducedMotion: 'skip' })
  }
  if (options.duration !== undefined) {
    const toOptions: ToOptions =
      options.easing === undefined
        ? { duration: options.duration, reducedMotion: 'allow' }
        : { duration: options.duration, easing: options.easing, reducedMotion: 'allow' }
    return group.to(target, toOptions)
  }
  return group.spring(target, springOptionsFrom(options))
}

/** Create a cold group, start its motion BEFORE binding (so a skip settle rides the synchronous bind write), then store it. */
const installGroup = (
  entry: ElementEntry,
  element: AnimatableElement,
  property: string,
  type: ValueType,
  start: ParsedValue,
  startMotion: (group: ChannelGroup) => AnimationHandle,
  target: PropTarget = 'style',
): AnimationHandle => {
  const name = target === 'attr' ? bareName(property) : property
  const group = channelGroup(type, start, { scheduler: entry.scheduler })
  const handle = startMotion(group)
  const binding = bindProperty(element, name, group, { scheduler: entry.scheduler, target })
  entry.groups.set(property, { group, binding, target, name })
  return handle
}

/** Write a literal value, dropping any group on the property. Resolves immediately, no warning. */
const writeLiteral = (
  entry: ElementEntry,
  element: AnimatableElement,
  property: string,
  value: AnimateValue,
  target: PropTarget = 'style',
): AnimationHandle => {
  const existing = entry.groups.get(property)
  if (existing !== undefined) {
    existing.binding.dispose()
    existing.group.dispose()
    entry.groups.delete(property)
  }
  if (target === 'attr') element.setAttribute(bareName(property), String(value))
  else element.style.setProperty(toKebab(property), String(value))
  return RESOLVED
}

/** Drop a property's group: cannot decompose the target, write it literally and warn. */
const snapLiteral = (
  entry: ElementEntry,
  element: AnimatableElement,
  property: string,
  value: AnimateValue,
  target: PropTarget = 'style',
): AnimationHandle => {
  warnOnce(`snap:${property}`, `cannot animate "${property}" to "${String(value)}"; snapped`)
  return writeLiteral(entry, element, property, value, target)
}

const animateProperty = (
  entry: ElementEntry,
  element: AnimatableElement,
  property: string,
  value: AnimateValue,
  read: StyleReader,
  options: AnimateOptions,
  behavior: ReducedMotionBehavior,
  reduced: boolean,
  channel: PropTarget = 'style',
): AnimationHandle => {
  const name = bareName(property)
  const type = resolveValueType(name)
  const begin = (group: ChannelGroup, target: ParsedValue): AnimationHandle =>
    startGroupMotion(group, target, type, options, behavior, reduced)
  const existing = entry.groups.get(property)

  if (existing !== undefined) {
    const group = existing.group
    // A keyword target (e.g. 'none') resolves against the live shape.
    const target = type.parse(value) ?? type.reconcile?.(String(value), group.shape) ?? null
    if (target === null) return snapLiteral(entry, element, property, value, channel)
    if (target.shape === group.shape) return begin(group, target)
    const multiplier = type.convert?.(group.shape, target.shape, createMeasure(element, name, read)) ?? null
    if (multiplier !== null) {
      group.rebase(multiplier, target.shape)
      return begin(group, target)
    }
    // Shape mismatch with no conversion (e.g. 1 shadow -> 2): snap, recreate at target.
    existing.binding.dispose()
    existing.group.dispose()
    entry.groups.delete(property)
    warnOnce(`snap:${property}`, `"${name}" changed shape (${group.shape} -> ${target.shape}); snapped`)
    return installGroup(entry, element, property, type, target, () => RESOLVED, channel)
  }

  // Cold start.
  const raw = read.get(name)
  const parsedTarget = type.parse(value)
  if (parsedTarget === null) {
    // Keyword target: synthesize against the current computed shape.
    const current = type.parse(raw)
    if (current !== null && type.reconcile !== undefined) {
      const recon = type.reconcile(String(value), current.shape)
      if (recon !== null)
        return installGroup(entry, element, property, type, current, (group) => begin(group, recon), channel)
    }
    return snapLiteral(entry, element, property, value, channel)
  }
  const target = parsedTarget

  const current = type.reconcile?.(raw, target.shape) ?? type.parse(raw)
  if (current !== null && current.shape === target.shape) {
    return installGroup(entry, element, property, type, current, (group) => begin(group, target), channel)
  }
  if (current !== null) {
    const multiplier = type.convert?.(current.shape, target.shape, createMeasure(element, name, read)) ?? null
    if (multiplier !== null) {
      return installGroup(
        entry,
        element,
        property,
        type,
        current,
        (group) => {
          group.rebase(multiplier, target.shape)
          return begin(group, target)
        },
        channel,
      )
    }
  }
  // No resolvable start value (computed 'auto', detached parent, ...): snap to target.
  warnOnce(`snap:${property}`, `cannot resolve a start for "${name}" (computed "${raw}"); snapped to target`)
  return installGroup(entry, element, property, type, target, () => RESOLVED, channel)
}

/**
 * Per-segment tween timings from a normalized keyframe result: variable segment
 * durations from explicit `at` positions and per-segment easings from explicit
 * `ease`. Both are tween-only - positions need a duration; per-segment easing is
 * carried regardless (the chain applies it only on the tween branch).
 */
const segmentTimings = (
  normalized: NormalizedKeyframes<unknown>,
  duration: number | undefined,
): Pick<ChainConfig, 'segmentDurations' | 'segmentEasings'> => {
  const { waypoints, offsets, eases } = normalized
  const out: Pick<ChainConfig, 'segmentDurations' | 'segmentEasings'> = {}
  if (eases.some((e) => e !== undefined)) {
    out.segmentEasings = eases.map((e) => (e !== undefined ? resolveEasing(e) : undefined))
  }
  if (duration !== undefined && offsets.some((o) => o !== undefined)) {
    const arrivals = fillOffsets(waypoints.length, offsets)
    const durations: number[] = []
    let prev = 0
    for (const arrival of arrivals) {
      durations.push(Math.max(0, arrival - prev) * duration)
      prev = arrival
    }
    out.segmentDurations = durations
  }
  return out
}

/** True if any waypoint carries an explicit position or per-segment easing (the expressive form). */
const hasKeyframeMeta = (normalized: NormalizedKeyframes<unknown>): boolean =>
  normalized.offsets.some((o) => o !== undefined) || normalized.eases.some((e) => e !== undefined)

const animatePropertyKeyframes = (
  entry: ElementEntry,
  element: AnimatableElement,
  property: string,
  frames: AnimateKeyframes,
  read: StyleReader,
  options: AnimateOptions,
  reduced: boolean,
  channel: PropTarget = 'style',
): AnimationHandle => {
  const name = bareName(property)
  const type = resolveValueType(name)
  const normalized = normalizeKeyframes<AnimateValue>(frames)
  if (normalized === null) return RESOLVED
  const last = normalized.waypoints[normalized.waypoints.length - 1] ?? ''

  // Every non-null entry - the explicit keyframe-0 lead AND every waypoint -
  // must parse to one common shape (same unit, same template).
  const rawEntries: AnimateValue[] =
    normalized.teleport !== undefined ? [normalized.teleport, ...normalized.waypoints] : [...normalized.waypoints]
  const parsedEntries: ParsedValue[] = []
  for (const raw of rawEntries) {
    const parsed = type.parse(raw)
    if (parsed === null) return snapLiteral(entry, element, property, last, channel)
    parsedEntries.push(parsed)
  }
  const first = parsedEntries[0]
  if (first === undefined) return RESOLVED
  const shape = first.shape
  if (parsedEntries.some((parsed) => parsed.shape !== shape)) {
    warnOnce(`keyframe-shape:${property}`, `"${name}" keyframes mix units/shapes; snapped to the last`)
    return writeLiteral(entry, element, property, last, channel)
  }

  const teleport = normalized.teleport !== undefined ? parsedEntries[0] : undefined
  const waypoints = normalized.teleport !== undefined ? parsedEntries.slice(1) : parsedEntries

  const buildChain = (group: ChannelGroup): AnimationHandle => {
    const ops: ChainOps<ParsedValue> = {
      teleport: (target) => group.set(target),
      spring: (target) => group.spring(target, springOptionsFrom(options)),
      tween: (target, ms, easing) => group.to(target, { duration: ms, easing, reducedMotion: 'allow' }),
      settle: (target) => group.spring(target, { reducedMotion: 'skip' }),
    }
    const chain = runKeyframeChain({ teleport, waypoints }, ops, {
      ...(options.duration !== undefined ? { duration: options.duration } : {}),
      easing: resolveEasing(options.easing ?? easeInOutCubic),
      reduced,
      ...segmentTimings(normalized, options.duration),
    })
    return startChain(entry, property, chain)
  }

  // Reuse a warm group of the matching shape; otherwise (re)create at a start.
  const existing = entry.groups.get(property)
  if (existing !== undefined && existing.group.shape === shape) {
    return buildChain(existing.group)
  }
  if (existing !== undefined) {
    existing.binding.dispose()
    existing.group.dispose()
    entry.groups.delete(property)
  }
  let start = teleport
  if (start === undefined) {
    const raw = read.get(name)
    const current = type.reconcile?.(raw, shape) ?? type.parse(raw)
    start = current !== null && current.shape === shape ? current : first
  }
  return installGroup(entry, element, property, type, start, buildChain, channel)
}

/**
 * Internal seam for @underlying/core/playback: the live WAAPI animation an
 * element's delegated tween rides, so playback can map pause/seek/timeScale/
 * reverse onto native compositor controls. Returns null on the JS path. NOT
 * exported from the package entry (index.ts).
 */
export function __getDelegated(element: AnimatableElement): DelegatedControls | null {
  const delegated = registry.get(element)?.delegated
  if (delegated === null || delegated === undefined) return null
  return { animation: delegated.animation, durationMs: delegated.durationMs }
}

const ensureEntry = (element: AnimatableElement, scheduler: Scheduler | undefined): ElementEntry => {
  let entry = registry.get(element)
  if (entry === undefined) {
    entry = {
      values: {},
      disposeBinding: () => {},
      scheduler: scheduler ?? getSharedScheduler(),
      delegated: null,
      groups: new Map(),
      chains: new Map(),
      generation: 0,
      autoAlpha: false,
    }
    registry.set(element, entry)
  }
  return entry
}

/**
 * The numeric channels: delegate an eligible duration tween (scalar or uniform
 * multi-keyframe) to the compositor, else run on the rAF loop. Delegation needs
 * a duration, WAAPI with linear() support, no other numeric channel mid-physics
 * (a transform-ownership conflict), and a single frame count across channels.
 */
const handleNumeric = (
  entry: ElementEntry,
  element: AnimatableElement,
  scalars: Array<[Channel, number]>,
  keyframes: Array<[Channel, NumericKeyframes]>,
  options: AnimateOptions,
  behavior: ReducedMotionBehavior,
  reduced: boolean,
): AnimationHandle[] => {
  // Any lifecycle callback opts out of WAAPI delegation onto the per-channel JS handles:
  // onUpdate ticks them each frame, onInterrupt reads a child's interrupt, and even
  // onStart/onComplete need it - the compositor reclaim cannot tell a settle from a
  // supersede, so onComplete would fire on both (see hasLifecycle).
  // autoAlpha opts out too: its visibility toggle rides the JS opacity write, which
  // the compositor path skips.
  if (!reduced && options.duration !== undefined && supportsWaapi(element) && !hasLifecycle(options) && !entry.autoAlpha) {
    const midPhysics = Object.values(entry.values).some((value) => value !== undefined && value.isAnimating())
    if (!midPhysics) {
      // Frame counts WITHOUT side effects: scalar = 2, keyframe = 1 + waypoints.
      const lengths = new Set<number>()
      for (const _ of scalars) lengths.add(2)
      const norms: Array<[Channel, NumericNorm]> = []
      let expressive = false
      for (const [channel, frames] of keyframes) {
        const norm = normalizeKeyframes<number>(frames)
        if (norm === null) continue
        // Per-segment positions/easings vary per channel; WAAPI shares one offset/
        // easing per keyframe row across all properties, so route the whole set to
        // the JS path (which applies them per channel) rather than delegate.
        if (hasKeyframeMeta(norm)) expressive = true
        norms.push([channel, norm])
        lengths.add(1 + norm.waypoints.length)
      }
      if (!expressive && lengths.size === 1 && scalars.length + norms.length > 0) {
        return [delegateMultiKeyframe(entry, element, scalars, norms, options.duration, resolveEasing(options.easing ?? easeInOutCubic))]
      }
    }
  }
  return animateNumericJs(entry, element, scalars, keyframes, options, behavior, reduced)
}

/**
 * The numeric path on the rAF loop: scalar channels spring or tween; keyframe
 * channels run a chained-spring / piecewise-tween sequence. Used whenever
 * delegation is ineligible (springs, reduced motion, mixed frame counts, a
 * channel mid-physics, or no WAAPI).
 */
const animateNumericJs = (
  entry: ElementEntry,
  element: AnimatableElement,
  scalars: Array<[Channel, number]>,
  keyframes: Array<[Channel, NumericKeyframes]>,
  options: AnimateOptions,
  behavior: ReducedMotionBehavior,
  reduced: boolean,
): AnimationHandle[] => {
  let newChannel = false
  const prepared: Array<{ value: Animatable; channel: Channel; frames: NumericKeyframes }> = []
  const handles: AnimationHandle[] = []

  for (const [channel, target] of scalars) {
    const { value, created } = ensureChannel(entry, channel)
    newChannel ||= created
    handles.push(startNumericScalar(value, target, channel, options, behavior, reduced))
  }
  for (const [channel, frames] of keyframes) {
    const { value, created } = ensureChannel(entry, channel)
    newChannel ||= created
    prepared.push({ value, channel, frames })
  }

  // Rebind once before starting chains so a reduced-motion settle on a freshly
  // created channel rides the first flush.
  if (newChannel) rebind(entry, element)

  for (const { value, channel, frames } of prepared) {
    const normalized = normalizeKeyframes(frames)
    if (normalized === null) continue
    const ops: ChainOps<number> = {
      teleport: (v) => value.set(v),
      spring: (v) => value.spring(v, springOptionsFrom(options)),
      tween: (v, ms, easing) => value.to(v, { duration: ms, easing, reducedMotion: 'allow' }),
      settle: (v) => value.spring(v, { reducedMotion: 'skip' }),
    }
    const chain = runKeyframeChain(normalized, ops, {
      ...(options.duration !== undefined ? { duration: options.duration } : {}),
      easing: resolveEasing(options.easing ?? easeInOutCubic),
      reduced,
      ...segmentTimings(normalized, options.duration),
    })
    handles.push(startChain(entry, channel, chain))
  }
  return handles
}

/**
 * Spring (default) or tween the style channels of ONE element with ALREADY
 * RESOLVED targets (no functions/relatives - the public animate() does the
 * per-element pre-pass). The five numeric channels keep their compositor fast
 * path; any other CSS property routes through the value-type registry. Repeated
 * calls retarget the same underlying values - never a jump.
 */
function animateOne(element: AnimatableElement, targets: AnimateTargets, options: AnimateOptions): AnimationHandle {
  const entry = ensureEntry(element, options.scheduler)
  markIntent(entry) // a fresh intent supersedes any still-waiting staggered start on this element
  // Any new call on the element interrupts a delegated tween first.
  reclaim(entry)

  const behavior = options.reducedMotion ?? getReducedMotionBehavior()
  const reduced = behavior !== 'allow' && prefersReducedMotion()

  const numericScalars: Array<[Channel, number]> = []
  const numericKeyframes: Array<[Channel, NumericKeyframes]> = []
  const scalarProperties: Array<[string, AnimateValue]> = []
  const keyframeProperties: Array<[string, AnimateKeyframes]> = []
  const attrScalars: Array<[string, AnimateValue]> = []
  const attrKeyframes: Array<[string, AnimateKeyframes]> = []
  let autoAlpha = false
  let plainOpacity = false
  for (const key of Object.keys(targets)) {
    const value = (targets as Record<string, AnimateValue | AnimateKeyframes | undefined>)[key]
    if (value === undefined) continue
    // A new motion on a key takes over any keyframe chain still running there.
    interruptKey(entry, key)
    if (key === 'autoAlpha') {
      // An alias of the opacity channel that also toggles visibility (handled at the bind).
      autoAlpha = true
      interruptKey(entry, 'opacity')
      if (Array.isArray(value)) numericKeyframes.push(['opacity', value as NumericKeyframes])
      else numericScalars.push(['opacity', value as number])
    } else if (NUMERIC_CHANNELS.has(key)) {
      if (key === 'opacity') plainOpacity = true
      if (Array.isArray(value)) numericKeyframes.push([key as Channel, value as NumericKeyframes])
      else numericScalars.push([key as Channel, value as number])
    } else if (key === 'transform') {
      warnOnce('transform', 'animate x/y/scale/rotate instead of the transform shorthand')
    } else if (isAttrKey(key)) {
      if (Array.isArray(value)) attrKeyframes.push([key, value as AnimateKeyframes])
      else attrScalars.push([key, value as AnimateValue])
    } else if (Array.isArray(value)) {
      keyframeProperties.push([key, value as AnimateKeyframes])
    } else {
      scalarProperties.push([key, value as AnimateValue])
    }
  }
  // The visibility link follows the latest opacity intent: autoAlpha turns it on,
  // a plain opacity animation turns it off (and reveals) so it never leaks onto
  // an unrelated later opacity tween. Latched BEFORE the numeric path so the flag
  // is right when a fresh opacity channel binds (and gates WAAPI delegation).
  const opacityExisted = entry.values.opacity !== undefined
  const unlinkAutoAlpha = plainOpacity && !autoAlpha && entry.autoAlpha
  if (autoAlpha) entry.autoAlpha = true
  else if (plainOpacity) entry.autoAlpha = false

  const handles: AnimationHandle[] = []
  if (numericScalars.length > 0 || numericKeyframes.length > 0) {
    handles.push(...handleNumeric(entry, element, numericScalars, numericKeyframes, options, behavior, reduced))
    if (unlinkAutoAlpha) element.style.visibility = '' // drop the hidden state we may have set
    // Refresh the binding to apply/remove the visibility toggle - but only when
    // handleNumeric did not already rebind a freshly created opacity channel.
    if ((autoAlpha || unlinkAutoAlpha) && opacityExisted) rebind(entry, element)
  }
  if (scalarProperties.length > 0 || keyframeProperties.length > 0) {
    const read = readStyle(element)
    for (const [property, value] of scalarProperties) {
      handles.push(animateProperty(entry, element, property, value, read, options, behavior, reduced))
    }
    for (const [property, frames] of keyframeProperties) {
      handles.push(animatePropertyKeyframes(entry, element, property, frames, read, options, reduced))
    }
  }
  if (attrScalars.length > 0 || attrKeyframes.length > 0) {
    const read = readAttribute(element)
    for (const [property, value] of attrScalars) {
      handles.push(animateProperty(entry, element, property, value, read, options, behavior, reduced, 'attr'))
    }
    for (const [property, frames] of attrKeyframes) {
      handles.push(animatePropertyKeyframes(entry, element, property, frames, read, options, reduced, 'attr'))
    }
  }
  const base = aggregate(handles)
  if (!hasLifecycle(options)) return base
  const readValues = (): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const [key, value] of Object.entries(entry.values)) if (value !== undefined) out[key] = value.get()
    return out
  }
  return withLifecycle(base, handles, options, readValues, entry.scheduler)
}

// A registry property's current value as ONE magnitude plus a re-emitter that
// preserves its unit/template - only for single-channel value types (length,
// number). Multi-channel (color, shadow) returns undefined; a relative there
// degrades to the operand (resolveValue warns).
const readMagnitude = (element: AnimatableElement, entry: ElementEntry | undefined, key: string): Magnitude | undefined => {
  const warm = entry?.groups.get(key)
  if (warm !== undefined) {
    if (warm.group.channels.length !== 1) return undefined
    const channel = warm.group.channels[0]!
    const { type, shape } = warm.group
    return { value: channel.get(), reformat: (next) => type.format([next], shape) }
  }
  const name = bareName(key)
  const type = resolveValueType(name)
  // Attributes read via getAttribute; style properties via computed style.
  const raw = isAttrKey(key) ? (element.getAttribute(name) ?? '').trim() : readStyle(element).get(name)
  const parsed = type.parse(raw)
  if (parsed === null || parsed.channels.length !== 1) return undefined
  return { value: parsed.channels[0]!, reformat: (next) => type.format([next], parsed.shape) }
}

/** The per-element resolution context: live channel reads plus the single-magnitude registry reader. */
const resolveContextFor = (element: AnimatableElement, index: number, total: number): ResolveContext => {
  const entry = registry.get(element)
  return {
    index,
    element,
    total,
    readNumeric: (key) => {
      const channel = key === 'autoAlpha' ? 'opacity' : key
      if (!NUMERIC_CHANNELS.has(channel)) return undefined
      const value = entry?.values[channel as Channel]
      return value !== undefined ? value.get() : INITIAL[channel as Channel]
    },
    readMagnitude: (key) => readMagnitude(element, entry, key),
  }
}

/** Resolve every target value for one element (functions, relatives, keyframe chaining) to absolutes. */
const resolveTargetsFor = (
  element: AnimatableElement,
  targets: AnimateTargets,
  index: number,
  total: number,
): ResolvedTargets => {
  const ctx = resolveContextFor(element, index, total)
  const out: Record<string, AnimateValue | AnimateKeyframes> = {}
  for (const key of Object.keys(targets)) {
    const raw = (targets as Record<string, ResolvableValue | undefined>)[key]
    if (raw === undefined) continue
    out[key] = resolveValue(key, raw, ctx)
  }
  return out as ResolvedTargets
}

/** Resolve a from-state for one element to absolute teleport values (functions/relatives against the live value). */
const resolveFromFor = (element: AnimatableElement, from: FromTargets, index: number, total: number): ResolvedFrom =>
  // A from-state is scalar-only, so the resolved shape never carries keyframe arrays.
  resolveTargetsFor(element, from as AnimateTargets, index, total) as ResolvedFrom

/**
 * Capture one element's NATURAL (current) value for each given key, synchronously
 * - the to-state `from()` animates back to. A numeric channel reads its live
 * animatable value (mid-flight if interrupted) or the CSS-neutral INITIAL when
 * untouched; any other property reads computed/inline style. Must run BEFORE the
 * from-set moves the element, so the captured value is the real resting state.
 */
const captureNatural = (element: AnimatableElement, keys: string[]): ResolvedTargets => {
  const entry = registry.get(element)
  const read = readStyle(element)
  const out: Record<string, AnimateValue> = {}
  for (const key of keys) {
    const channel = key === 'autoAlpha' ? 'opacity' : key
    if (NUMERIC_CHANNELS.has(channel)) {
      const value = entry?.values[channel as Channel]
      out[key] = value !== undefined ? value.get() : INITIAL[channel as Channel]
    } else if (isAttrKey(key)) {
      out[key] = element.getAttribute(bareName(key)) ?? ''
    } else {
      out[key] = read.get(key)
    }
  }
  return out as ResolvedTargets
}

/** True if any target value needs per-element resolution (a function, or a relative string incl. inside keyframes). */
const hasResolvable = (targets: AnimateTargets): boolean => {
  for (const key of Object.keys(targets)) {
    if (needsResolve((targets as Record<string, unknown>)[key])) return true
  }
  return false
}

// Reclaim any delegated WAAPI tween FIRST (so a relative/function reads the true
// mid-flight position, not a stale pre-tween value), then resolve this element's
// targets and start them. Resolution happens at the element's START time.
const startResolved = (
  element: AnimatableElement,
  targets: AnimateTargets,
  index: number,
  total: number,
  options: AnimateOptions,
): AnimationHandle => {
  const existing = registry.get(element)
  if (existing != null && existing.delegated !== null) reclaim(existing)
  const resolved = resolveTargetsFor(element, targets, index, total)
  return animateOne(element, resolved, options)
}

// Start one element's motion after a frame-clock delay, as ONE handle: finished
// resolves when the post-delay inner settles or the wait is cancelled; stop cancels
// a pending wait then freezes a started run; interrupt is forwarded so a superseded
// or stopped deferred element reads as onInterrupt. The targets are resolved at
// START time (after the wait), off the live value. A later animate() on this element
// (a supersede during the wait) bumps the generation, so the stale start is dropped.
const deferredStart = (
  element: AnimatableElement,
  targets: AnimateTargets,
  options: AnimateOptions,
  index: number,
  total: number,
  delayMs: number,
  scheduler: Scheduler,
): AnimationHandle => {
  const entry = ensureEntry(element, options.scheduler)
  const scheduledGen = markIntent(entry) // claim the element; a later intent bumps past this token
  let inner: AnimationHandle | null = null
  let cancelled = false
  let onInterrupt: ((h: AnimationHandle) => void) | null = null
  let resolveFinished = (): void => {}
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve
  })
  const cancelWait = waitFrames(delayMs, scheduler, () => {
    if (cancelled) return
    // Superseded during the wait: do NOT clobber the newer animation - report the
    // interrupt and settle, so the set reads onInterrupt instead of a false complete.
    if (entry.generation !== scheduledGen) {
      cancelled = true
      onInterrupt?.(handle)
      resolveFinished()
      return
    }
    inner = startResolved(element, targets, index, total, options)
    inner.eventCallback?.('interrupt', () => onInterrupt?.(handle))
    void inner.finished.then(resolveFinished)
  })
  const handle: AnimationHandle = {
    finished,
    stop: () => {
      if (cancelled) return
      cancelled = true
      cancelWait()
      if (inner !== null) inner.stop()
      else onInterrupt?.(handle)
      resolveFinished()
    },
    eventCallback(event, fn) {
      if (event === 'interrupt') onInterrupt = fn ?? null
      return handle
    },
  }
  return handle
}

/** Strip the set-level options (delay, lifecycle) so each animateOne() sees only its own element's motion options. */
const perElementOptions = (options: AnimateOptions): AnimateOptions => {
  const out: AnimateOptions = { ...options }
  delete out.delay
  delete out.from
  delete out.onStart
  delete out.onUpdate
  delete out.onComplete
  delete out.onInterrupt
  delete out.scope
  return out
}

/**
 * Imperative escape hatch: spring (default) or tween style channels. The target
 * is one element, an array, a NodeList, or a CSS selector - one handle drives the
 * whole set. Each value may be a relative string (`'+=100'`, resolved against the
 * live value) or a per-target function `(index, element, count)`. `delay` staggers
 * the starts (a number, or a `staggerDelay()` wave). The five numeric channels
 * keep their compositor fast path; everything else routes through the value
 * registry. Repeated calls retarget the same underlying values - never a jump.
 *
 * Multi-target lifecycle is set-level: `onComplete` fires when the WHOLE set has
 * settled, `onInterrupt` when the first element is interrupted, `onUpdate` reports
 * the first element's channels.
 */
export function animate(target: AnimatableElement, targets: AnimateTargets, options?: AnimateOptions): AnimationHandle
export function animate(target: AnimationTarget, targets: AnimateTargets, options?: AnimateOptions): AnimationHandle
export function animate(target: AnimationTarget, targets: AnimateTargets, options: AnimateOptions = {}): AnimationHandle {
  // Fast path: one element, no delay, no function/relative - today's exact behavior
  // (lifecycle included), with no per-element pre-pass allocation. isHTMLElement is
  // SSR-safe (a bare `instanceof HTMLElement` throws server-side).
  if (isHTMLElement(target) && options.delay === undefined && options.from === undefined && !hasResolvable(targets)) {
    return animateOne(target, targets, options)
  }

  const elements = resolveTargets(target)
  if (elements.length === 0) return RESOLVED
  const total = elements.length
  const scheduler = options.scheduler ?? getSharedScheduler()
  const behavior = options.reducedMotion ?? getReducedMotionBehavior()
  const reduced = behavior !== 'allow' && prefersReducedMotion()
  const fromValues = options.from
  const delayOf: DelayFn | null =
    options.delay === undefined
      ? null
      : typeof options.delay === 'function'
        ? options.delay
        : (index) => (options.delay as number) * index
  const optionsForOne = perElementOptions(options)

  const children = elements.map((element, index) => {
    // Immediate-render the from-state synchronously, here in the call frame, for
    // EVERY element - so a staggered element is parked at its from-state and holds
    // it through its own delay before deferredStart runs. Skipped under reduced
    // motion, where the run settles straight to the to-state (no stranded from).
    if (fromValues !== undefined && !reduced) {
      // Pass the resolved scheduler so the from-set binds the element to the SAME
      // clock the animation runs on - else setStyle defaults to the shared
      // scheduler and the spring, on the injected one, never drives the channel.
      setStyle(element, resolveFromFor(element, fromValues, index, total), { scheduler })
    }
    const d = delayOf !== null ? delayOf(index, total) : 0
    if (d <= 0) return startResolved(element, targets, index, total, optionsForOne)
    return deferredStart(element, targets, optionsForOne, index, total, d, scheduler)
  })

  const base = aggregate(children)
  if (!hasLifecycle(options)) return base
  const first = registry.get(elements[0]!)
  const readValues = (): Record<string, number> => {
    const out: Record<string, number> = {}
    if (first !== undefined) {
      for (const [key, value] of Object.entries(first.values)) if (value !== undefined) out[key] = value.get()
    }
    return out
  }
  return withLifecycle(base, children, options, readValues, scheduler)
}

/**
 * Entrance: animate each target element FROM `fromValues` INTO its natural
 * (current) state, with no manual setStyle first. Each element's current value is
 * captured per key as its own to-state (so a set animates to PER-element naturals),
 * the from-state is set synchronously (no flash, held through any stagger delay),
 * then the element springs/tweens back. One aggregate handle drives the whole set.
 *
 * Same options as `animate()` - `delay`/`staggerDelay()`, lifecycle, spring config,
 * reduced motion (under which each element ends at its natural state, not the
 * from-state). If an element is mid-animation, the captured to is its live value,
 * so the hand-off has no jump. From-values take the same forms as a target
 * (absolute, relative `'+='`, per-target function), resolved against the live value.
 */
export function from(target: AnimationTarget, fromValues: FromTargets, options: AnimateOptions = {}): AnimationHandle {
  const elements = resolveTargets(target)
  if (elements.length === 0) return RESOLVED
  const keys = Object.keys(fromValues)
  // Capture the natural to-state NOW, per element, before animate() sets the
  // from-state. The to is handed to animate() as a per-target function that just
  // returns the pre-captured constant, so its start-time resolution is exact.
  const captured = elements.map((element) => captureNatural(element, keys))
  const to: AnimateTargets = {}
  for (const key of keys) {
    ;(to as Record<string, ValueFn<AnimateValue | AnimateKeyframes>>)[key] = (index) =>
      (captured[index] as Record<string, AnimateValue | AnimateKeyframes>)[key]!
  }
  // Pass the resolved element array (a stable snapshot) so animate() does not
  // re-query a selector and capture/animate a different set.
  return animate(elements, to, { ...options, from: fromValues })
}

/**
 * Animate each target element FROM an explicit `fromValues` TO an explicit
 * `toValues`. The from-state is set synchronously (no flash, held through any
 * stagger delay), then the element animates to the to-state. Thin sugar over
 * `animate(target, toValues, { ...options, from: fromValues })`: `toValues` keep
 * full target parity (keyframes, relatives, per-target functions); `fromValues`
 * are a single per-key state. Shares every `animate()` option (stagger, lifecycle,
 * spring config, reduced motion - under which it settles straight to `toValues`).
 */
export function fromTo(
  target: AnimationTarget,
  fromValues: FromTargets,
  toValues: AnimateTargets,
  options: AnimateOptions = {},
): AnimationHandle {
  return animate(target, toValues, { ...options, from: fromValues })
}

export interface SetStyleOptions {
  /**
   * Seed a velocity (channel-unit/s) along with the values - gesture handoffs.
   * Broadcast to every channel of every touched property; exact for
   * single-channel values, which is the gesture case.
   */
  velocity?: number
  scheduler?: Scheduler
}

/** Teleport a registry property, coherently with the channel state, writing synchronously. */
const setStyleProperty = (
  entry: ElementEntry,
  element: AnimatableElement,
  property: string,
  value: AnimateValue,
  velocity: number | undefined,
  target: PropTarget = 'style',
): void => {
  const name = bareName(property)
  const type = resolveValueType(name)
  const existing = entry.groups.get(property)
  if (existing !== undefined) {
    // Fast path: the incoming value parses into the live shape - update channel
    // values against the compiled template, no rebuild (the pointermove case).
    const parsed = type.parse(value) ?? type.reconcile?.(String(value), existing.group.shape) ?? null
    if (parsed !== null && parsed.shape === existing.group.shape) {
      existing.group.set(parsed, velocity !== undefined ? { velocity } : {})
      existing.binding.flushNow()
      return
    }
    // Shape change: teleport by recreating at the new value.
    existing.binding.dispose()
    existing.group.dispose()
    entry.groups.delete(property)
  }
  const parsed = type.parse(value)
  if (parsed === null) {
    writeLiteral(entry, element, property, value, target)
    return
  }
  const group = channelGroup(type, parsed, { scheduler: entry.scheduler })
  if (velocity !== undefined) group.set(parsed, { velocity })
  const binding = bindProperty(element, name, group, { scheduler: entry.scheduler, target })
  entry.groups.set(property, { group, binding, target, name })
  binding.flushNow()
}

/**
 * Teleport: cancel animations on the touched properties only, write the style,
 * and keep the registry channel state coherent - unlike a raw element.style
 * write, which desyncs the cache. Seed a velocity for a following spring/decay
 * to inherit (the drag-release handoff). Registry properties write synchronously
 * (zero-latency scrubbing); numeric channels reflect on the next frame.
 */
export function setStyle(
  element: AnimatableElement,
  targets: Partial<Record<NumericKey, number>> & Partial<Record<AnimateProperty, AnimateValue>>,
  options: SetStyleOptions = {},
): void {
  const entry = ensureEntry(element, options.scheduler)
  // Reclaim only if a delegated tween owns a touched numeric channel.
  if (entry.delegated !== null) {
    const owned = Object.keys(targets).some(
      (key) => NUMERIC_CHANNELS.has(key) && entry.delegated?.channels.has(key as Channel) === true,
    )
    if (owned) reclaim(entry)
  }
  const velocity = options.velocity
  let newChannel = false
  let autoAlpha = false
  let plainOpacity = false
  for (const key of Object.keys(targets)) {
    const value = (targets as Record<string, AnimateValue | undefined>)[key]
    if (value === undefined) continue
    interruptKey(entry, key)
    if (key === 'autoAlpha') {
      autoAlpha = true
      interruptKey(entry, 'opacity')
      const { value: channel, created } = ensureChannel(entry, 'opacity')
      newChannel ||= created
      channel.set(value as number, velocity !== undefined ? { velocity } : undefined)
    } else if (NUMERIC_CHANNELS.has(key)) {
      if (key === 'opacity') plainOpacity = true
      const { value: channel, created } = ensureChannel(entry, key as Channel)
      newChannel ||= created
      channel.set(value as number, velocity !== undefined ? { velocity } : undefined)
    } else if (isAttrKey(key)) {
      setStyleProperty(entry, element, key, value, velocity, 'attr')
    } else if (key !== 'transform') {
      setStyleProperty(entry, element, key, value, velocity)
    }
  }
  const unlinkAutoAlpha = plainOpacity && !autoAlpha && entry.autoAlpha
  if (autoAlpha) entry.autoAlpha = true
  else if (plainOpacity) entry.autoAlpha = false
  if (unlinkAutoAlpha) element.style.visibility = ''
  if (newChannel || autoAlpha || unlinkAutoAlpha) rebind(entry, element)
}

/**
 * Forget the element: reclaim any delegated tween, dispose every channel, group,
 * and binding, remove the inline styles we wrote. The next animate() starts cold
 * (re-reads computed style). The sanctioned uncache hatch after an external
 * style write. Idempotent; an unknown element is a no-op.
 */
export function releaseStyle(element: AnimatableElement): void {
  const entry = registry.get(element)
  if (entry === undefined) return
  reclaim(entry)
  for (const interrupt of [...entry.chains.values()]) interrupt()
  entry.chains.clear()

  for (const value of Object.values(entry.values)) value?.dispose()
  entry.disposeBinding()
  if (Object.keys(entry.values).length > 0) {
    element.style.removeProperty('transform')
    element.style.removeProperty('opacity')
    if (entry.autoAlpha) element.style.removeProperty('visibility')
  }

  for (const { group, binding, target, name } of entry.groups.values()) {
    binding.dispose()
    group.dispose()
    if (target === 'attr') element.removeAttribute(name)
    else element.style.removeProperty(toKebab(name))
  }
  entry.groups.clear()
  registry.delete(element)
}
