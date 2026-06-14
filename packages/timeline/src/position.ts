import { warnOnce } from './warn'

/**
 * Where a clip starts. A number is absolute ms from t=0; strings use the
 * relative grammar resolved against the insertion cursor, the previous clip,
 * labels, and the timeline end:
 *
 *   number            absolute ms (negative clamped to 0)
 *   '250'             absolute ms (numeric string)
 *   'label'           the label's resolved ms
 *   '<' | '>'         start / end of the most-recently-added clip ('>' is the default)
 *   '<N' | '>N'       prev start / end shifted by N ms (N may be negative: '<-100')
 *   '<+=N' | '>-=N'   same, explicit-sign form
 *   '+=N' | '-=N'     N ms relative to the timeline END
 *   'label+=N'        a label shifted by N ms
 */
export type Position = number | string

export interface ResolveContext {
  /** Insertion cursor (end of the last add / shiftCursor target). */
  cursorMs: number
  /** Start of the most-recently-added clip. */
  prevStartMs: number
  /** End of the most-recently-added clip. */
  prevEndMs: number
  /** Current timeline end (max child end); '+=' / '-=' are relative to this. */
  durationMs: number
  /** Resolved label times. */
  labels: ReadonlyMap<string, number>
}

const SIGNED_EQ = /^([+-])=(-?\d+(?:\.\d+)?)$/
const BARE_NUMBER = /^[+-]?\d+(?:\.\d+)?$/
const TRAILING_OFFSET = /[+-]=-?\d+(?:\.\d+)?$/

// Parse an offset token to ms: '+=100' -> 100, '-=50' -> -50, '-100' -> -100,
// '' -> 0, anything else -> NaN.
function parseOffset(token: string): number {
  if (token === '') return 0
  const eq = SIGNED_EQ.exec(token)
  if (eq !== null) return (eq[1] === '-' ? -1 : 1) * Number(eq[2])
  if (BARE_NUMBER.test(token)) return Number(token)
  return Number.NaN
}

const clamp0 = (ms: number): number => (ms < 0 ? 0 : ms)

/**
 * Resolve a Position to an absolute ms offset. Pure; the single source of truth
 * for the grammar. Never throws - a bad token warns once and falls back
 * (negative -> 0, unknown label -> the cursor).
 */
export function resolvePosition(position: Position, ctx: ResolveContext): number {
  if (typeof position === 'number') {
    if (position < 0) {
      warnOnce('timeline:negative-position', `position ${position} clamped to 0`)
      return 0
    }
    return position
  }

  const s = position.trim()
  if (s === '') return ctx.cursorMs

  const head = s[0]
  if (head === '<' || head === '>') {
    const base = head === '<' ? ctx.prevStartMs : ctx.prevEndMs
    const off = parseOffset(s.slice(1))
    if (Number.isNaN(off)) {
      warnOnce(`timeline:bad-position:${s}`, `unparseable position "${s}", using "${head}"`)
      return clamp0(base)
    }
    return clamp0(base + off)
  }

  if (s.startsWith('+=') || s.startsWith('-=')) {
    return clamp0(ctx.durationMs + parseOffset(s))
  }

  if (BARE_NUMBER.test(s)) {
    const n = Number(s)
    if (n < 0) {
      warnOnce('timeline:negative-position', `position ${s} clamped to 0`)
      return 0
    }
    return n
  }

  const offMatch = TRAILING_OFFSET.exec(s)
  const name = offMatch !== null ? s.slice(0, offMatch.index) : s
  const off = offMatch !== null ? parseOffset(offMatch[0]) : 0
  const base = ctx.labels.get(name)
  if (base === undefined) {
    warnOnce(`timeline:unknown-label:${name}`, `unknown label "${name}", using the cursor`)
    return clamp0(ctx.cursorMs + off)
  }
  return clamp0(base + off)
}
