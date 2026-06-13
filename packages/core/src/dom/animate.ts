import { getReducedMotionBehavior, type ReducedMotionBehavior } from '../a11y/config'
import { prefersReducedMotion } from '../a11y/reduced-motion'
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
import { bindProperty, type PropertyBinding } from './bind-property'
import { bindStyle } from './bind-style'
import { normalizeKeyframes, runKeyframeChain, type ChainOps, type KeyframeChain } from './keyframes'
import { readStyle, toKebab, type StyleReader } from './read-style'
import { formatTransform, type TransformChannels } from './transform'
import { createMeasure } from './units'

type Channel = 'x' | 'y' | 'scale' | 'rotate' | 'opacity'

/** A CSS value the registry path animates: a number or a CSS string. */
export type AnimateValue = number | string

/** Keyframe waypoints. A null is only valid at index 0, meaning "from the current value". */
export type AnimateKeyframes = ReadonlyArray<AnimateValue | null>
export type NumericKeyframes = ReadonlyArray<number | null>

/**
 * Any property key that is NOT one of the five numeric channels: a
 * CSSStyleDeclaration property (camelCase) or a custom property. A typo like
 * `{ opactiy: 1 }` does not compile. (CSSStyleDeclaration method names type-check
 * as keys - accepted noise.)
 */
export type AnimateProperty = Exclude<Extract<keyof CSSStyleDeclaration, string>, Channel> | `--${string}`

/** The five channels stay numeric; everything else routes through the value-type registry. */
export type AnimateTargets = Partial<Record<Channel, number | NumericKeyframes>> &
  Partial<Record<AnimateProperty, AnimateValue | AnimateKeyframes>>

export interface AnimateOptions extends Omit<SpringOptions, 'reducedMotion'> {
  /** ms - providing a duration switches to the tween escape hatch. */
  duration?: number
  easing?: Easing
  scheduler?: Scheduler
  /** Element-level reduced-motion strategy - 'fade' keeps opacity AND colors animated. */
  reducedMotion?: ReducedMotionBehavior
}

// First touch of a channel starts from its CSS-neutral value; afterwards the
// cached animatable carries the real state across calls - that is what makes
// a second animate() an interruption instead of a parallel animation.
const INITIAL: Record<Channel, number> = { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }

const TRANSFORM_CHANNELS: ReadonlyArray<Channel> = ['x', 'y', 'scale', 'rotate']
const NUMERIC_CHANNELS = new Set<string>(['x', 'y', 'scale', 'rotate', 'opacity'])

/** The slice of a WAAPI Animation the delegation relies on (testable shape). */
interface DelegatedAnimation {
  currentTime: CSSNumberish | null
  onfinish: (() => void) | null
  cancel(): void
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
}

interface ElementEntry {
  values: Partial<Record<Channel, Animatable>>
  disposeBinding: () => void
  scheduler: Scheduler
  delegated: DelegatedTween | null
  groups: Map<string, GroupEntry>
  /** Per-key running keyframe chains, so a new animate() on that key can interrupt them. */
  chains: Map<string, () => void>
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

  for (const [channel, frames] of delegated.channels) {
    const value = entry.values[channel]
    if (value === undefined) continue
    const from = frames[index] ?? 0
    const to = frames[index + 1] ?? from
    const span = to - from
    value.set(from + span * delegated.easing(t), { velocity: (span * slope) / segmentDurationS })
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

type NumericNorm = { teleport: number | undefined; waypoints: number[] }

const delegateMultiKeyframe = (
  entry: ElementEntry,
  element: HTMLElement,
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

  // A transform keyframe overrides the whole property: carry the untouched
  // transform channels along as constants across every frame.
  if ([...channels.keys()].some((channel) => channel !== 'opacity')) {
    for (const channel of TRANSFORM_CHANNELS) {
      const value = entry.values[channel]
      if (value !== undefined && !channels.has(channel)) {
        channels.set(channel, new Array<number>(n).fill(value.get()))
      }
    }
  }

  const linearEasing = toLinearEasing(easing)
  const keyframes: Record<string, string>[] = []
  for (let i = 0; i < n; i++) {
    const frame: Record<string, string> = {}
    const transform: TransformChannels = {}
    for (const [channel, frames] of channels) {
      const value = frames[i] ?? 0
      if (channel === 'opacity') frame['opacity'] = String(value)
      else transform[channel] = value
    }
    if (Object.keys(transform).length > 0) frame['transform'] = formatTransform(transform)
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

const aggregate = (handles: AnimationHandle[]): AnimationHandle => {
  if (handles.length === 0) return RESOLVED
  if (handles.length === 1) return handles[0]!
  return {
    finished: Promise.all(handles.map((handle) => handle.finished)).then(() => undefined),
    stop: () => {
      for (const handle of handles) handle.stop()
    },
  }
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
  element: HTMLElement,
  property: string,
  type: ValueType,
  start: ParsedValue,
  startMotion: (group: ChannelGroup) => AnimationHandle,
): AnimationHandle => {
  const group = channelGroup(type, start, { scheduler: entry.scheduler })
  const handle = startMotion(group)
  const binding = bindProperty(element, property, group, { scheduler: entry.scheduler })
  entry.groups.set(property, { group, binding })
  return handle
}

/** Write a literal value, dropping any group on the property. Resolves immediately, no warning. */
const writeLiteral = (
  entry: ElementEntry,
  element: HTMLElement,
  property: string,
  value: AnimateValue,
): AnimationHandle => {
  const existing = entry.groups.get(property)
  if (existing !== undefined) {
    existing.binding.dispose()
    existing.group.dispose()
    entry.groups.delete(property)
  }
  element.style.setProperty(toKebab(property), String(value))
  return RESOLVED
}

/** Drop a property's group: cannot decompose the target, write it literally and warn. */
const snapLiteral = (
  entry: ElementEntry,
  element: HTMLElement,
  property: string,
  value: AnimateValue,
): AnimationHandle => {
  warnOnce(`snap:${property}`, `cannot animate "${property}" to "${String(value)}"; snapped`)
  return writeLiteral(entry, element, property, value)
}

const animateProperty = (
  entry: ElementEntry,
  element: HTMLElement,
  property: string,
  value: AnimateValue,
  read: StyleReader,
  options: AnimateOptions,
  behavior: ReducedMotionBehavior,
  reduced: boolean,
): AnimationHandle => {
  const type = resolveValueType(property)
  const begin = (group: ChannelGroup, target: ParsedValue): AnimationHandle =>
    startGroupMotion(group, target, type, options, behavior, reduced)
  const existing = entry.groups.get(property)

  if (existing !== undefined) {
    const group = existing.group
    // A keyword target (e.g. 'none') resolves against the live shape.
    const target = type.parse(value) ?? type.reconcile?.(String(value), group.shape) ?? null
    if (target === null) return snapLiteral(entry, element, property, value)
    if (target.shape === group.shape) return begin(group, target)
    const multiplier = type.convert?.(group.shape, target.shape, createMeasure(element, property, read)) ?? null
    if (multiplier !== null) {
      group.rebase(multiplier, target.shape)
      return begin(group, target)
    }
    // Shape mismatch with no conversion (e.g. 1 shadow -> 2): snap, recreate at target.
    existing.binding.dispose()
    existing.group.dispose()
    entry.groups.delete(property)
    warnOnce(`snap:${property}`, `"${property}" changed shape (${group.shape} -> ${target.shape}); snapped`)
    return installGroup(entry, element, property, type, target, () => RESOLVED)
  }

  // Cold start.
  const raw = read.get(property)
  const parsedTarget = type.parse(value)
  if (parsedTarget === null) {
    // Keyword target: synthesize against the current computed shape.
    const current = type.parse(raw)
    if (current !== null && type.reconcile !== undefined) {
      const recon = type.reconcile(String(value), current.shape)
      if (recon !== null) return installGroup(entry, element, property, type, current, (group) => begin(group, recon))
    }
    return snapLiteral(entry, element, property, value)
  }
  const target = parsedTarget

  const current = type.reconcile?.(raw, target.shape) ?? type.parse(raw)
  if (current !== null && current.shape === target.shape) {
    return installGroup(entry, element, property, type, current, (group) => begin(group, target))
  }
  if (current !== null) {
    const multiplier = type.convert?.(current.shape, target.shape, createMeasure(element, property, read)) ?? null
    if (multiplier !== null) {
      return installGroup(entry, element, property, type, current, (group) => {
        group.rebase(multiplier, target.shape)
        return begin(group, target)
      })
    }
  }
  // No resolvable start value (computed 'auto', detached parent, ...): snap to target.
  warnOnce(`snap:${property}`, `cannot resolve a start for "${property}" (computed "${raw}"); snapped to target`)
  return installGroup(entry, element, property, type, target, () => RESOLVED)
}

const animatePropertyKeyframes = (
  entry: ElementEntry,
  element: HTMLElement,
  property: string,
  frames: AnimateKeyframes,
  read: StyleReader,
  options: AnimateOptions,
  reduced: boolean,
): AnimationHandle => {
  const type = resolveValueType(property)
  const normalized = normalizeKeyframes<AnimateValue>(frames)
  if (normalized === null) return RESOLVED
  if (normalized.droppedNull) {
    warnOnce(`keyframe-null:${property}`, `null is only valid at keyframe 0 for "${property}"; later nulls dropped`)
  }
  const last = normalized.waypoints[normalized.waypoints.length - 1] ?? ''

  // Every non-null entry - the explicit keyframe-0 lead AND every waypoint -
  // must parse to one common shape (same unit, same template).
  const rawEntries: AnimateValue[] =
    normalized.teleport !== undefined ? [normalized.teleport, ...normalized.waypoints] : [...normalized.waypoints]
  const parsedEntries: ParsedValue[] = []
  for (const raw of rawEntries) {
    const parsed = type.parse(raw)
    if (parsed === null) return snapLiteral(entry, element, property, last)
    parsedEntries.push(parsed)
  }
  const first = parsedEntries[0]
  if (first === undefined) return RESOLVED
  const shape = first.shape
  if (parsedEntries.some((parsed) => parsed.shape !== shape)) {
    warnOnce(`keyframe-shape:${property}`, `"${property}" keyframes mix units/shapes; snapped to the last`)
    return writeLiteral(entry, element, property, last)
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
      easing: options.easing ?? easeInOutCubic,
      reduced,
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
    const raw = read.get(property)
    const current = type.reconcile?.(raw, shape) ?? type.parse(raw)
    start = current !== null && current.shape === shape ? current : first
  }
  return installGroup(entry, element, property, type, start, buildChain)
}

const ensureEntry = (element: HTMLElement, scheduler: Scheduler | undefined): ElementEntry => {
  let entry = registry.get(element)
  if (entry === undefined) {
    entry = {
      values: {},
      disposeBinding: () => {},
      scheduler: scheduler ?? getSharedScheduler(),
      delegated: null,
      groups: new Map(),
      chains: new Map(),
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
  element: HTMLElement,
  scalars: Array<[Channel, number]>,
  keyframes: Array<[Channel, NumericKeyframes]>,
  options: AnimateOptions,
  behavior: ReducedMotionBehavior,
  reduced: boolean,
): AnimationHandle => {
  if (!reduced && options.duration !== undefined && supportsWaapi(element)) {
    const midPhysics = Object.values(entry.values).some((value) => value !== undefined && value.isAnimating())
    if (!midPhysics) {
      // Frame counts WITHOUT side effects: scalar = 2, keyframe = 1 + waypoints.
      const lengths = new Set<number>()
      for (const _ of scalars) lengths.add(2)
      const norms: Array<[Channel, NumericNorm]> = []
      for (const [channel, frames] of keyframes) {
        const norm = normalizeKeyframes<number>(frames)
        if (norm === null) continue
        norms.push([channel, norm])
        lengths.add(1 + norm.waypoints.length)
      }
      if (lengths.size === 1 && scalars.length + norms.length > 0) {
        return delegateMultiKeyframe(entry, element, scalars, norms, options.duration, options.easing ?? easeInOutCubic)
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
  element: HTMLElement,
  scalars: Array<[Channel, number]>,
  keyframes: Array<[Channel, NumericKeyframes]>,
  options: AnimateOptions,
  behavior: ReducedMotionBehavior,
  reduced: boolean,
): AnimationHandle => {
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
      easing: options.easing ?? easeInOutCubic,
      reduced,
    })
    handles.push(startChain(entry, channel, chain))
  }
  return aggregate(handles)
}

/**
 * Imperative escape hatch: spring (default) or tween the style channels of an
 * element. The five numeric channels (x/y/scale/rotate/opacity) keep their
 * compositor-eligible fast path; any other CSS property (and custom properties)
 * routes through the value-type registry - parsed once into scalar channels,
 * each an interruptible spring with conserved velocity. Repeated calls retarget
 * the same underlying values - never a jump.
 */
export function animate(
  element: HTMLElement,
  targets: AnimateTargets,
  options: AnimateOptions = {},
): AnimationHandle {
  const entry = ensureEntry(element, options.scheduler)
  // Any new call on the element interrupts a delegated tween first.
  reclaim(entry)

  const behavior = options.reducedMotion ?? getReducedMotionBehavior()
  const reduced = behavior !== 'allow' && prefersReducedMotion()

  const numericScalars: Array<[Channel, number]> = []
  const numericKeyframes: Array<[Channel, NumericKeyframes]> = []
  const scalarProperties: Array<[string, AnimateValue]> = []
  const keyframeProperties: Array<[string, AnimateKeyframes]> = []
  for (const key of Object.keys(targets)) {
    const value = (targets as Record<string, AnimateValue | AnimateKeyframes | undefined>)[key]
    if (value === undefined) continue
    // A new motion on a key takes over any keyframe chain still running there.
    interruptKey(entry, key)
    if (NUMERIC_CHANNELS.has(key)) {
      if (Array.isArray(value)) numericKeyframes.push([key as Channel, value as NumericKeyframes])
      else numericScalars.push([key as Channel, value as number])
    } else if (key === 'transform') {
      warnOnce('transform', 'animate x/y/scale/rotate instead of the transform shorthand')
    } else if (Array.isArray(value)) {
      keyframeProperties.push([key, value as AnimateKeyframes])
    } else {
      scalarProperties.push([key, value as AnimateValue])
    }
  }

  const handles: AnimationHandle[] = []
  if (numericScalars.length > 0 || numericKeyframes.length > 0) {
    handles.push(handleNumeric(entry, element, numericScalars, numericKeyframes, options, behavior, reduced))
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
  return aggregate(handles)
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
  element: HTMLElement,
  property: string,
  value: AnimateValue,
  velocity: number | undefined,
): void => {
  const type = resolveValueType(property)
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
    writeLiteral(entry, element, property, value)
    return
  }
  const group = channelGroup(type, parsed, { scheduler: entry.scheduler })
  if (velocity !== undefined) group.set(parsed, { velocity })
  const binding = bindProperty(element, property, group, { scheduler: entry.scheduler })
  entry.groups.set(property, { group, binding })
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
  element: HTMLElement,
  targets: Partial<Record<Channel, number>> & Partial<Record<AnimateProperty, AnimateValue>>,
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
  for (const key of Object.keys(targets)) {
    const value = (targets as Record<string, AnimateValue | undefined>)[key]
    if (value === undefined) continue
    interruptKey(entry, key)
    if (NUMERIC_CHANNELS.has(key)) {
      const { value: channel, created } = ensureChannel(entry, key as Channel)
      newChannel ||= created
      channel.set(value as number, velocity !== undefined ? { velocity } : undefined)
    } else if (key !== 'transform') {
      setStyleProperty(entry, element, key, value, velocity)
    }
  }
  if (newChannel) rebind(entry, element)
}

/**
 * Forget the element: reclaim any delegated tween, dispose every channel, group,
 * and binding, remove the inline styles we wrote. The next animate() starts cold
 * (re-reads computed style). The sanctioned uncache hatch after an external
 * style write. Idempotent; an unknown element is a no-op.
 */
export function releaseStyle(element: HTMLElement): void {
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
  }

  for (const [property, { group, binding }] of entry.groups) {
    binding.dispose()
    group.dispose()
    element.style.removeProperty(toKebab(property))
  }
  entry.groups.clear()
  registry.delete(element)
}
