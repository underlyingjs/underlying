import type { Animatable } from '@underlying/core'
import type { PlaybackHandle } from '@underlying/core/playback'
import { resolvePosition, type Position, type ResolveContext } from './position'

/**
 * One authored operation. Clips carry either a pre-built handle (`add`), a
 * deferred value-clip builder (`to`/`from`/`spring`/...), or a `call` marker.
 * Labels and cursor moves are interleaved so forward refs resolve to the cursor.
 */
export interface ClipIntent {
  at?: Position
  /** The animatable this clip drives (value-clips only); enables seam chaining. */
  value?: Animatable
  /** Build the child given the value's state at this clip's start (prior exit, or live). */
  makeFrom?: (position: number, velocity: number) => PlaybackHandle
  /** A pre-built handle handed to add(). */
  handle?: PlaybackHandle
  /** A zero-duration side-effect marker. */
  call?: () => void
}

export type StaggerFrom = 'start' | 'end' | 'center' | number

export type Op =
  | { op: 'clip'; clip: ClipIntent }
  | { op: 'label'; name: string; at: Position }
  | { op: 'cursor'; at: Position }
  | { op: 'stagger'; handles: readonly PlaybackHandle[]; each: number; from: StaggerFrom; at?: Position }

export interface Entry {
  /** The seekable child (null for call markers). */
  handle: PlaybackHandle | null
  call: (() => void) | null
  /** The driven value (null for call markers and opaque add()/nested handles). */
  value: Animatable | null
  startMs: number
  /** child.duration() - a single iteration. */
  iterationMs: number
  /** Total footprint (== iterationMs until repeats land). */
  spanMs: number
  endMs: number
}

export interface BuildResult {
  entries: Entry[]
  durationMs: number
  labels: Map<string, number>
}

export interface BuildOptions {
  maxBakeMs: number
  defaultGap: number
}

// Force a physics child finite-and-seekable by baking it once; a never-resting
// one throws at build (loud, at authoring) rather than warning per frame.
function ensureSeekable(handle: PlaybackHandle, maxBakeMs: number): void {
  if (handle.seekable || handle.kind !== 'physics') return
  if (!handle.bake({ maxDurationMs: maxBakeMs })) {
    throw new Error(
      `@underlying/timeline: a spring/decay clip never rests within ${maxBakeMs}ms; give it damping or a bounded target`,
    )
  }
}

// Ripple order for a stagger item: distance (in `each` units) from the anchor.
function staggerOrder(index: number, count: number, from: StaggerFrom): number {
  if (from === 'start') return index
  if (from === 'end') return count - 1 - index
  const anchor = from === 'center' ? (count - 1) / 2 : from
  return Math.abs(index - anchor)
}

/**
 * Resolve intents into a frozen, sorted schedule. A single forward pass: each
 * clip's position resolves against the durations of already-built prior clips,
 * and each value-clip captures its start state from the prior same-value clip's
 * exit (so sequential clips on one value chain, velocity conserved). Physics
 * children are baked once here to stay seekable; a never-resting one throws.
 */
export function build(ops: readonly Op[], options: BuildOptions): BuildResult {
  const labels = new Map<string, number>()
  const lastByValue = new Map<Animatable, { position: number; velocity: number }>()
  const entries: Entry[] = []
  let cursorMs = 0
  let prevStartMs = 0
  let prevEndMs = 0
  let durationMs = 0

  const ctx = (): ResolveContext => ({ cursorMs, prevStartMs, prevEndMs, durationMs, labels })
  const advance = (startMs: number, spanMs: number): void => {
    prevStartMs = startMs
    prevEndMs = startMs + spanMs
    cursorMs = Math.max(cursorMs, startMs + spanMs)
    durationMs = Math.max(durationMs, startMs + spanMs)
  }

  for (const o of ops) {
    if (o.op === 'label') {
      labels.set(o.name, resolvePosition(o.at, ctx()))
      continue
    }
    if (o.op === 'cursor') {
      cursorMs = resolvePosition(o.at, ctx())
      continue
    }

    if (o.op === 'stagger') {
      const base = o.at === undefined ? cursorMs + options.defaultGap : resolvePosition(o.at, ctx())
      let maxEnd = base
      o.handles.forEach((handle, i) => {
        ensureSeekable(handle, options.maxBakeMs)
        const startMs = base + o.each * staggerOrder(i, o.handles.length, o.from)
        const iterationMs = handle.duration() ?? 0
        entries.push({ handle, call: null, value: null, startMs, iterationMs, spanMs: iterationMs, endMs: startMs + iterationMs })
        maxEnd = Math.max(maxEnd, startMs + iterationMs)
      })
      prevStartMs = base
      prevEndMs = maxEnd
      cursorMs = Math.max(cursorMs, maxEnd)
      durationMs = Math.max(durationMs, maxEnd)
      continue
    }

    const clip = o.clip
    const startMs = clip.at === undefined ? cursorMs + options.defaultGap : resolvePosition(clip.at, ctx())

    if (clip.call !== undefined) {
      entries.push({ handle: null, call: clip.call, value: null, startMs, iterationMs: 0, spanMs: 0, endMs: startMs })
      advance(startMs, 0)
      continue
    }

    let handle: PlaybackHandle
    if (clip.handle !== undefined) {
      handle = clip.handle
    } else if (clip.makeFrom !== undefined && clip.value !== undefined) {
      const prior = lastByValue.get(clip.value)
      const fromPos = prior?.position ?? clip.value.get()
      const fromVel = prior?.velocity ?? clip.value.velocity()
      handle = clip.makeFrom(fromPos, fromVel)
    } else {
      continue // malformed clip; skip defensively
    }
    ensureSeekable(handle, options.maxBakeMs)

    const iterationMs = handle.duration() ?? 0
    // Drive the child to its end to capture exit state for the next same-value clip.
    if (clip.value !== undefined) {
      handle.seek(iterationMs)
      lastByValue.set(clip.value, { position: clip.value.get(), velocity: clip.value.velocity() })
    }
    const spanMs = iterationMs
    entries.push({ handle, call: null, value: clip.value ?? null, startMs, iterationMs, spanMs, endMs: startMs + spanMs })
    advance(startMs, spanMs)
  }

  // Stable sort by start (insertion order on ties) => later-starting clip writes
  // last on a shared value (last-write-wins, matching drive()'s position write).
  entries.sort((a, b) => a.startMs - b.startMs)
  return { entries, durationMs, labels }
}
