import {
  animatable,
  prefersReducedMotion,
  type Animatable,
  type AnimationHandle,
  type Scheduler,
  type SpringOptions,
} from '@underlying/core'
import {
  ensureState,
  invertAndSpring,
  isHTMLElement,
  measure,
  seizeVelocity,
  ZERO_VELOCITY,
  type Box,
  type FlipOptions,
  type Velocity,
} from './engine'
import { claimShared, publishShared } from './shared'

export type PresenceMode = 'sync' | 'wait' | 'pop'

/** A from-state (enter) or to-state (exit) for presence; only listed channels animate. */
export interface PresenceState {
  opacity?: number
  x?: number
  y?: number
  scale?: number
  scaleX?: number
  scaleY?: number
}

export interface FlipHandle {
  /** Resolves when the transition settles OR is interrupted (never hangs). */
  readonly finished: Promise<void>
  /** Freeze this transition in place. */
  stop(): void
}

export interface PresenceOptions extends FlipOptions {
  mode?: PresenceMode
  enter?: PresenceState
  exit?: PresenceState
  /** add(): insert the node before this child (controller-owned), so siblings FLIP. */
  before?: HTMLElement | null
  /** remove(): how to detach once the exit settles. Default () => node.remove(). */
  detach?: () => void
}

export interface FlipGroupOptions extends FlipOptions {
  /** Presence timing. Default 'sync'. */
  mode?: PresenceMode
  /** Enter-from state. Default { opacity: 0, y: 8 }. */
  enter?: PresenceState
  /** Exit-to state. Default { opacity: 0, y: 8 }. */
  exit?: PresenceState
  /** The tracked child set. Default the container's direct element children. */
  select?: (container: HTMLElement) => Iterable<HTMLElement>
  /** Shared-element box staleness bound (ms). Default 1000. */
  sharedTtlMs?: number
}

export interface FlipGroup {
  /** Auto-FLIP: bracket a layout edit; survivors spring to their new boxes. */
  flip(mutate?: () => void): FlipHandle
  /** Presence enter (and shared-element claim by data-flip-id). */
  add(node: HTMLElement, options?: PresenceOptions): FlipHandle
  /** Presence exit: keep the node mounted, then detach once the exit spring settles. */
  remove(node: HTMLElement, options?: PresenceOptions): FlipHandle
  /** Stop in-flight springs and drop per-node state. */
  dispose(): void
}

type Status = 'idle' | 'entering' | 'exiting'
interface Presence {
  readonly opacity: Animatable
  generation: number
  status: Status
}

const DEFAULT_STATE: PresenceState = { opacity: 0, y: 8 }
const SETTLED: FlipHandle = { finished: Promise.resolve(), stop() {} }

const childrenOf = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.children).filter(isHTMLElement)

export function flipGroup(container: HTMLElement, groupOptions: FlipGroupOptions = {}): FlipGroup {
  const mode0 = groupOptions.mode ?? 'sync'
  const enter0 = groupOptions.enter ?? DEFAULT_STATE
  const exit0 = groupOptions.exit ?? DEFAULT_STATE
  const select = groupOptions.select ?? childrenOf
  const ttl = groupOptions.sharedTtlMs ?? 1000

  // The spring + engine options forwarded to every motion (scheduler, scale, the
  // spring config) - never the group-only keys, never an explicit undefined.
  const engineOptions: FlipOptions = {}
  for (const key of ['stiffness', 'damping', 'mass', 'scheduler', 'scale'] as const) {
    const value = (groupOptions as Record<string, unknown>)[key]
    if (value !== undefined) (engineOptions as Record<string, unknown>)[key] = value
  }
  const springOptions = (): SpringOptions & { scheduler?: Scheduler } => {
    const o: SpringOptions & { scheduler?: Scheduler } = {}
    for (const key of ['stiffness', 'damping', 'mass', 'scheduler'] as const) {
      const value = (groupOptions as Record<string, unknown>)[key]
      if (value !== undefined) (o as Record<string, unknown>)[key] = value
    }
    return o
  }
  const schedOpt = engineOptions.scheduler !== undefined ? { scheduler: engineOptions.scheduler } : {}

  const states = new WeakMap<HTMLElement, Presence>()
  const live = new Set<HTMLElement>() // nodes with presence state, for dispose
  const pendingExits = new Set<Promise<void>>()

  // A node mid enter/exit owns its presence springs; flip()/pop must NOT seize them
  // (that would drop the presence run's onComplete and strand its detach / status).
  const isIdle = (node: HTMLElement): boolean => {
    const ps = states.get(node)
    return ps === undefined || ps.status === 'idle'
  }

  const presenceOf = (node: HTMLElement): Presence => {
    let ps = states.get(node)
    if (ps === undefined) {
      const opacity = animatable(1, schedOpt)
      opacity.on('change', () => {
        const v = opacity.get()
        node.style.opacity = v >= 1 ? '' : `${v}` // clear inline residue at rest
      })
      ps = { opacity, generation: 0, status: 'idle' }
      states.set(node, ps)
      live.add(node)
    }
    return ps
  }

  // The (channel, from, rest) triples a PresenceState touches. opacity is on the
  // presence value; x/y/scale on the SAME transform spring set flip() uses, so an
  // enter/exit and a reorder compose through one synchronous writer.
  const channelsFor = (node: HTMLElement, ps: Presence, state: PresenceState) => {
    const st = ensureState(node, engineOptions)
    const out: Array<{ ch: Animatable; value: number; rest: number }> = []
    if (state.opacity !== undefined) out.push({ ch: ps.opacity, value: state.opacity, rest: 1 })
    if (state.x !== undefined) out.push({ ch: st.x, value: state.x, rest: 0 })
    if (state.y !== undefined) out.push({ ch: st.y, value: state.y, rest: 0 })
    if (state.scale !== undefined) {
      out.push({ ch: st.sx, value: state.scale, rest: 1 }, { ch: st.sy, value: state.scale, rest: 1 })
    }
    if (state.scaleX !== undefined) out.push({ ch: st.sx, value: state.scaleX, rest: 1 })
    if (state.scaleY !== undefined) out.push({ ch: st.sy, value: state.scaleY, rest: 1 })
    return out
  }

  // Spring a set of channels to per-channel targets, calling onAllDone exactly once
  // when they all settle (generation-guarded). remaining is set BEFORE any spring
  // starts so the synchronous reduced-motion path (onComplete fires inline) counts down right.
  const runSprings = (
    ps: Presence,
    gen: number,
    items: Array<{ ch: Animatable; target: number }>,
    onAllDone: () => void,
  ): FlipHandle => {
    if (items.length === 0) {
      onAllDone()
      return SETTLED
    }
    let remaining = items.length
    const onOne = (): void => {
      if (ps.generation !== gen) return
      if (--remaining === 0) onAllDone()
    }
    const handles: AnimationHandle[] = []
    for (const item of items) {
      handles.push(item.ch.spring(item.target, { ...springOptions(), onComplete: onOne }))
    }
    return {
      finished: Promise.all(handles.map((h) => h.finished)).then(() => undefined),
      stop: () => handles.forEach((h) => h.stop()),
    }
  }

  const finishDetach = (node: HTMLElement, detach: () => void): void => {
    const ps = states.get(node)
    if (ps !== undefined) ps.status = 'idle'
    detach()
    // Drop the per-node state so churn does not grow live/states without bound; a
    // later re-mount + add() re-initializes cleanly.
    live.delete(node)
    states.delete(node)
  }

  // pop: take the exiting node out of layout flow (pinned where it sits) so the
  // rest reflows immediately, and FLIP the siblings to close the gap.
  const pinAndReflow = (node: HTMLElement): void => {
    const first = new Map<HTMLElement, Box>()
    for (const sib of select(container)) {
      if (sib === node || !isIdle(sib)) continue // never seize another in-flight presence node
      first.set(sib, measure(sib))
    }
    const velocities = new Map<HTMLElement, Velocity>()
    for (const sib of first.keys()) velocities.set(sib, seizeVelocity(sib))
    for (const sib of first.keys()) sib.style.transform = '' // so each Last is the natural box
    const nodeBox = node.getBoundingClientRect()
    const containerBox = container.getBoundingClientRect()
    const cs = getComputedStyle(container)
    if (cs.position === 'static') container.style.position = 'relative'
    const borderLeft = parseFloat(cs.borderLeftWidth) || 0
    const borderTop = parseFloat(cs.borderTopWidth) || 0
    node.style.position = 'absolute'
    node.style.boxSizing = 'border-box' // the pinned size is the measured border-box rect
    node.style.margin = '0'
    node.style.left = `${nodeBox.left - containerBox.left - borderLeft + container.scrollLeft}px`
    node.style.top = `${nodeBox.top - containerBox.top - borderTop + container.scrollTop}px`
    node.style.width = `${nodeBox.width}px`
    node.style.height = `${nodeBox.height}px`
    for (const [sib, box] of first) invertAndSpring(sib, box, velocities.get(sib) ?? ZERO_VELOCITY, engineOptions)
  }

  const runEnter = (node: HTMLElement, ps: Presence, gen: number, state: PresenceState): FlipHandle => {
    const channels = channelsFor(node, ps, state)
    for (const c of channels) c.ch.set(c.value) // appear at the from-state synchronously - no flash
    return runSprings(ps, gen, channels.map((c) => ({ ch: c.ch, target: c.rest })), () => {
      ps.status = 'idle'
    })
  }

  const reAddToRest = (node: HTMLElement, ps: Presence, gen: number): FlipHandle => {
    const st = ensureState(node, engineOptions)
    // retarget the presence channels to rest FROM their live state, so it bends
    return runSprings(
      ps,
      gen,
      [
        { ch: ps.opacity, target: 1 },
        { ch: st.x, target: 0 },
        { ch: st.y, target: 0 },
        { ch: st.sx, target: 1 },
        { ch: st.sy, target: 1 },
      ],
      () => {
        ps.status = 'idle'
      },
    )
  }

  const handle: FlipGroup = {
    flip(mutate) {
      // Only idle survivors: an exiting/entering node belongs to remove()/add().
      const tracked = [...select(container)].filter(isIdle)
      const first = new Map<HTMLElement, Box>()
      const velocities = new Map<HTMLElement, Velocity>()
      for (const el of tracked) {
        first.set(el, measure(el))
        velocities.set(el, seizeVelocity(el))
      }
      for (const el of tracked) el.style.transform = ''
      mutate?.()

      const handles: AnimationHandle[] = []
      for (const el of select(container)) {
        const box = first.get(el)
        if (box === undefined) continue // a brand-new node is an add(), not a survivor
        handles.push(...invertAndSpring(el, box, velocities.get(el) ?? ZERO_VELOCITY, engineOptions))
      }
      return {
        finished: Promise.all(handles.map((h) => h.finished)).then(() => undefined),
        stop: () => handles.forEach((h) => h.stop()),
      }
    },

    add(node, options = {}) {
      const ps = presenceOf(node)
      const gen = ++ps.generation
      const mode = options.mode ?? mode0

      if (ps.status === 'exiting') {
        ps.status = 'entering'
        return reAddToRest(node, ps, gen)
      }
      ps.status = 'entering'

      if (options.before !== undefined) container.insertBefore(node, options.before)

      const sharedId = node.dataset.flipId
      if (sharedId !== undefined) {
        const box = claimShared(sharedId)
        if (box !== null) {
          ps.opacity.set(1)
          const handles = invertAndSpring(node, box, seizeVelocity(node), engineOptions)
          const finished = Promise.all(handles.map((h) => h.finished)).then(() => undefined)
          void finished.then(() => {
            if (ps.generation === gen) ps.status = 'idle'
          })
          return { finished, stop: () => handles.forEach((h) => h.stop()) }
        }
      }

      const state = options.enter ?? enter0
      if (mode === 'wait' && pendingExits.size > 0) {
        // Hold hidden until the in-flight exits settle, then enter. The held state
        // forces an opacity channel (so the node is invisible during the wait); the
        // deferred enter must run from THAT state so the forced opacity springs back.
        const held: PresenceState = { ...state, opacity: state.opacity ?? 0 }
        for (const c of channelsFor(node, ps, held)) c.ch.set(c.value)
        let started: FlipHandle = SETTLED
        let cancelled = false
        const finished = Promise.all([...pendingExits]).then(() => {
          if (cancelled || ps.generation !== gen) return
          started = runEnter(node, ps, gen, held)
          return started.finished
        })
        return {
          finished,
          stop: () => {
            cancelled = true
            started.stop()
          },
        }
      }
      return runEnter(node, ps, gen, state)
    },

    remove(node, options = {}) {
      const ps = presenceOf(node)
      const gen = ++ps.generation
      ps.status = 'exiting'
      const mode = options.mode ?? mode0
      const exit = options.exit ?? exit0
      const detach = options.detach ?? (() => node.remove())

      const sharedId = node.dataset.flipId
      if (sharedId !== undefined) publishShared(sharedId, measure(node), ttl)

      if (mode === 'pop' && !prefersReducedMotion()) pinAndReflow(node)

      const channels = channelsFor(node, ps, exit)
      const result = runSprings(ps, gen, channels.map((c) => ({ ch: c.ch, target: c.value })), () => {
        finishDetach(node, detach)
      })
      const tracked = result.finished
      pendingExits.add(tracked)
      void tracked.then(() => pendingExits.delete(tracked))
      return result
    },

    dispose() {
      for (const node of live) {
        const ps = states.get(node)
        if (ps === undefined) continue
        ps.generation++ // invalidate any pending detach
        ps.opacity.stop()
        const st = ensureState(node, engineOptions)
        st.x.stop()
        st.y.stop()
        st.sx.stop()
        st.sy.stop()
      }
      live.clear()
      pendingExits.clear()
    },
  }

  return handle
}
