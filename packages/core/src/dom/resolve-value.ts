import { warnOnce } from '../value/warn'
import type { AnimateKeyframes, AnimateValue } from './animate'

/**
 * A target resolved against the current value. The numeric channels accept the
 * precise literal form (unitless); a registry property accepts the same plus a
 * unit (e.g. '+=40px'), which type-checks as a plain string and is detected at
 * runtime. '*=' scales.
 */
export type RelativeValue = `+=${number}` | `-=${number}` | `*=${number}`

/** A per-target value: receives the item's index, its element, and the set count. */
export type ValueFn<V> = (index: number, element: HTMLElement, total: number) => V

/** A single magnitude read from a registry property, plus how to re-emit it preserving the unit/template. */
export interface Magnitude {
  readonly value: number
  reformat(next: number): string
}

export interface ResolveContext {
  readonly index: number
  readonly element: HTMLElement
  readonly total: number
  /** Current value of a numeric channel (caller bakes in the INITIAL fallback); undefined if `key` is not a numeric channel. */
  readNumeric(key: string): number | undefined
  /** Current single magnitude of a registry property + a re-emitter; undefined if not resolvable or multi-channel. */
  readMagnitude(key: string): Magnitude | undefined
}

// A relative operand may carry a unit on a registry property (width:'+=40px');
// the unit is informational - the result is re-emitted in the property's CURRENT
// unit/template. Numeric channels are unitless.
const RELATIVE = /^([+\-*])=(-?\d*\.?\d+)[a-z%]*$/i

const parseRelative = (s: string): { op: '+' | '-' | '*'; operand: number } | null => {
  const match = RELATIVE.exec(s)
  if (match === null) return null
  return { op: match[1] as '+' | '-' | '*', operand: Number(match[2]) }
}

const applyRelative = (cur: number, op: '+' | '-' | '*', operand: number): number =>
  op === '+' ? cur + operand : op === '-' ? cur - operand : cur * operand

/** True if a raw value needs per-element resolution (a function, or a relative string incl. inside keyframes). */
export const needsResolve = (raw: unknown): boolean => {
  if (typeof raw === 'function') return true
  if (typeof raw === 'string') return RELATIVE.test(raw)
  if (Array.isArray(raw)) return raw.some((waypoint) => typeof waypoint === 'string' && RELATIVE.test(waypoint))
  return false
}

const resolveScalar = (key: string, value: AnimateValue, ctx: ResolveContext): AnimateValue => {
  if (typeof value !== 'string') return value
  const rel = parseRelative(value)
  if (rel === null) return value
  const num = ctx.readNumeric(key)
  if (num !== undefined) return applyRelative(num, rel.op, rel.operand)
  const mag = ctx.readMagnitude(key)
  if (mag !== undefined) return mag.reformat(applyRelative(mag.value, rel.op, rel.operand))
  warnOnce(`relative:${key}`, `relative "${value}" on "${key}" is not decomposable; used ${rel.operand}`)
  return rel.operand
}

const resolveKeyframes = (key: string, frames: AnimateKeyframes, ctx: ResolveContext): AnimateKeyframes => {
  // Relatives chain against the prior resolved waypoint (index 0 against the current value).
  // One running magnitude serves both numeric channels and single-magnitude registry
  // properties; the magnitude reader is fetched only when a relative is present (it reads
  // computed style). An absolute waypoint re-seeds the chain so a following relative is correct.
  const numeric = ctx.readNumeric(key)
  const mag =
    numeric === undefined && frames.some((waypoint) => typeof waypoint === 'string' && parseRelative(waypoint) !== null)
      ? ctx.readMagnitude(key)
      : undefined
  let running: number | undefined = numeric ?? mag?.value
  return frames.map((waypoint) => {
    if (waypoint === null) return null
    if (typeof waypoint === 'number') {
      running = waypoint
      return waypoint
    }
    const rel = parseRelative(waypoint)
    if (rel === null) {
      const seed = Number.parseFloat(waypoint)
      running = Number.isFinite(seed) ? seed : undefined
      return waypoint
    }
    if (running === undefined) {
      warnOnce(`relative:${key}`, `relative "${waypoint}" on "${key}" keyframe is not decomposable; used ${rel.operand}`)
      return rel.operand
    }
    running = applyRelative(running, rel.op, rel.operand)
    return mag !== undefined ? mag.reformat(running) : running
  })
}

/** A value before per-target resolution: an absolute value/keyframes, a relative string, or a function returning any of those. */
export type ResolvableValue =
  | AnimateValue
  | AnimateKeyframes
  | RelativeValue
  | ValueFn<AnimateValue | AnimateKeyframes | RelativeValue>

/**
 * Resolve a possibly function/relative/keyframe value to an absolute value or
 * keyframe array for one element. A function is evaluated first (it may return a
 * relative string or a keyframe array, which re-enter resolution); relatives read
 * the LIVE cached value through `ctx`, so a re-fire retargets from the in-flight
 * position. Pure; never throws.
 */
export function resolveValue(key: string, raw: ResolvableValue, ctx: ResolveContext): AnimateValue | AnimateKeyframes {
  const value = typeof raw === 'function' ? raw(ctx.index, ctx.element, ctx.total) : raw
  if (Array.isArray(value)) return resolveKeyframes(key, value, ctx)
  return resolveScalar(key, value as AnimateValue, ctx)
}
