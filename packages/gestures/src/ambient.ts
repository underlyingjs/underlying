import {
  animatable,
  bindStyle,
  getSharedScheduler,
  onReducedMotionChange,
  prefersReducedMotion,
  type Animatable,
  type Scheduler,
  type SpringOptions,
  type StyleBindings,
} from '@underlying/core'
import {
  SIMULATION_TIMESTEP_S,
  stepSimulation,
  type Simulation,
  type SimulationState,
} from '@underlying/core/physics'
import { onPointerMove } from './pointer-source'

export interface BreatheOptions {
  /** Peak scale delta around 1 (0.02 -> 0.98..1.02). Default 0.02. */
  scale?: number
  /** Peak DIM around 1 (oscillates in [1-opacity, 1], never brighter). Default 0 (off, channel unbound). */
  opacity?: number
  /** Seconds per full breath. Default 4. */
  period?: number
  /** Phase in turns [0,1); default derived from the per-element seed. */
  phase?: number
}

export interface DriftOptions {
  /** Travel in px. Default 6. */
  amplitude?: number | { x: number; y: number }
  /** Seconds per cycle. Default { x: 9, y: 11 } (an open, non-repeating Lissajous). */
  period?: number | { x: number; y: number }
  /** Restrict to one axis. Default 'both'. */
  axis?: 'both' | 'x' | 'y'
  /** Phase in turns [0,1); y runs a quarter-turn ahead so the pair orbits. Default from the seed. */
  phase?: number
}

export interface BobOptions {
  /** Vertical float in px. Default 8. */
  amplitude?: number
  /** Seconds per cycle. Default 5. */
  period?: number
  /** Phase in turns [0,1); default from the seed. */
  phase?: number
}

export interface WanderOptions {
  /** Px the attractor roams from home when idle. Default 40. */
  radius?: number
  /** Seconds for the shared attractor to drift. Default 12. */
  attractorPeriod?: number
  /** Px travel at the frame edge when the pointer is active. Default 24. */
  parallax?: number
  /** Parallax WITH the pointer instead of against it. Default false. */
  invert?: boolean
  /** The pointer-normalization frame, like depth(). Default 'viewport'. */
  frame?: 'viewport' | HTMLElement
  /** Ms of pointer stillness before reverting to wander. Default 2000. */
  idleAfter?: number
  /** The single chase + recapture spring (slow, heavy). Default { stiffness: 40 }. */
  spring?: SpringOptions
}

export interface AmbientOptions {
  /** Breathing sine on scale (and optionally opacity). Default ON. */
  breathe?: boolean | BreatheOptions
  /** Phase-offset orbital x/y drift. Default ON. */
  drift?: boolean | DriftOptions
  /** Gentle vertical bob. Default OFF (it would double-write y with drift). */
  bob?: boolean | BobOptions
  /** Wander toward shared attractors when idle, recapture to pointer-parallax on movement. Default OFF. */
  wander?: boolean | WanderOptions
  /** Base phase seed [0,1); a group adds index*golden. Default an auto golden-ratio counter. */
  seed?: number
  /** 'pause' (default) holds everything at rest under reduced motion; 'allow' keeps it running. */
  reducedMotion?: 'pause' | 'allow'
  /** Frame loop; defaults to the shared rAF loop. Tests inject a manual one. */
  scheduler?: Scheduler
}

export interface Ambient {
  /** Live composed x offset (px). Constant 0 if no behavior writes x. */
  readonly x: Animatable
  /** Live composed y offset (px). */
  readonly y: Animatable
  /** Live composed scale around 1. Constant 1 if breathe is off. */
  readonly scale: Animatable
  /** Live composed opacity around 1. Constant 1 (unbound) unless breathe.opacity > 0. */
  readonly opacity: Animatable
  /** Release this element: unbind, dispose its channels, drop it from the field. */
  dispose(): void
}

export interface AmbientGroup {
  readonly items: readonly Ambient[]
  /** Tear down the whole field: every element, the loop, the pointer + policy listeners. */
  dispose(): void
}

const H = SIMULATION_TIMESTEP_S
const TWO_PI = Math.PI * 2
const GOLDEN = 0.618033988749895
let seedCounter = 0

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)
const clamp1 = (n: number): number => (n < -1 ? -1 : n > 1 ? 1 : n)
const wrap1 = (n: number): number => ((n % 1) + 1) % 1

// A perpetual unit oscillator: stepped forever it traces value(t) = sin(w*t + phi)
// at amplitude 1 (symplectic Euler is energy-bounded, so it neither grows nor decays).
interface Stepper {
  sim: Simulation
  prev: SimulationState
  curr: SimulationState
}
function makeOsc(periodS: number, phaseTurns: number): Stepper {
  // Clamp the period off zero: a degenerate 0 would divide to Infinity and poison
  // the channel with a permanent NaN, and a sub-~0.07s period would break the
  // symplectic step's stability bound (w*H < 2) and blow up.
  const w = TWO_PI / Math.max(periodS, 8 * H)
  const phi = TWO_PI * phaseTurns
  const w2 = w * w
  const state: SimulationState = { position: Math.sin(phi), velocity: w * Math.cos(phi) }
  return { sim: { acceleration: (pos) => -w2 * pos, rest: () => null }, prev: state, curr: state }
}

// A damped spring whose `aim` is reassigned in place each frame: the (pos,vel) state
// survives the re-aim, so it BENDS toward a new target with velocity conserved -
// the physics-first recapture, written inline (springSimulation is not exported).
interface Spring extends Stepper {
  aim: number
}
function makeSpring(stiffness: number, damping: number, mass: number): Spring {
  const state: SimulationState = { position: 0, velocity: 0 }
  const spring: Spring = {
    sim: { acceleration: () => 0, rest: () => null },
    prev: state,
    curr: state,
    aim: 0,
  }
  spring.sim = {
    acceleration: (pos, vel) => (-stiffness * (pos - spring.aim) - damping * vel) / mass,
    rest: () => null,
  }
  return spring
}

const step = (s: Stepper): void => {
  s.prev = s.curr
  s.curr = stepSimulation(s.sim, s.curr, H)
}
// Interpolate a stepper's [position, velocity] by the accumulator's sub-step alpha.
const interp = (s: Stepper, alpha: number): [number, number] => [
  s.prev.position + (s.curr.position - s.prev.position) * alpha,
  s.prev.velocity + (s.curr.velocity - s.prev.velocity) * alpha,
]

interface BreatheConfig {
  period: number
  scaleAmt: number
  opacityAmt: number
  phase: number | undefined
}
interface DriftConfig {
  px: number
  py: number
  ampX: number
  ampY: number
  useX: boolean
  useY: boolean
  phase: number | undefined
}
interface BobConfig {
  period: number
  amp: number
  phase: number | undefined
}
interface WanderConfig {
  stiffness: number
  damping: number
  mass: number
  radius: number
  parallax: number
  sign: number
  frame: 'viewport' | HTMLElement
  idleAfter: number
  attractorPeriod: number
}

function resolveBreathe(v: boolean | BreatheOptions | undefined): BreatheConfig | null {
  if (v === false) return null
  const o = v === true || v === undefined ? {} : v
  return { period: o.period ?? 4, scaleAmt: o.scale ?? 0.02, opacityAmt: o.opacity ?? 0, phase: o.phase }
}
function resolveDrift(v: boolean | DriftOptions | undefined): DriftConfig | null {
  if (v === false) return null
  const o = v === true || v === undefined ? {} : v
  const axis = o.axis ?? 'both'
  const amp = o.amplitude ?? 6
  const period = o.period ?? { x: 9, y: 11 }
  return {
    ampX: typeof amp === 'number' ? amp : amp.x,
    ampY: typeof amp === 'number' ? amp : amp.y,
    px: typeof period === 'number' ? period : period.x,
    py: typeof period === 'number' ? period : period.y,
    useX: axis !== 'y',
    useY: axis !== 'x',
    phase: o.phase,
  }
}
function resolveBob(v: boolean | BobOptions | undefined): BobConfig | null {
  if (v === undefined || v === false) return null
  const o = v === true ? {} : v
  return { period: o.period ?? 5, amp: o.amplitude ?? 8, phase: o.phase }
}
function resolveWander(v: boolean | WanderOptions | undefined): WanderConfig | null {
  if (v === undefined || v === false) return null
  const o = v === true ? {} : v
  const stiffness = o.spring?.stiffness ?? 40
  const mass = o.spring?.mass ?? 1
  return {
    stiffness,
    mass,
    damping: o.spring?.damping ?? 2 * Math.sqrt(stiffness * mass),
    radius: o.radius ?? 40,
    parallax: o.parallax ?? 24,
    sign: o.invert ? 1 : -1,
    frame: o.frame ?? 'viewport',
    idleAfter: o.idleAfter ?? 2000,
    attractorPeriod: o.attractorPeriod ?? 12,
  }
}

interface Member {
  out: { x: Animatable; y: Animatable; scale: Animatable; opacity: Animatable }
  unbind: () => void
  breathe: Stepper | null
  driftX: Stepper | null
  driftY: Stepper | null
  bob: Stepper | null
  wanderX: Spring | null
  wanderY: Spring | null
  attractor: number
  // A slow rotating epicycle (quarter-turn-offset oscillator pair) around the shared
  // attractor, so several members on one attractor orbit it independently.
  epiX: Stepper | null
  epiY: Stepper | null
}

const isSingle = (t: HTMLElement | ArrayLike<HTMLElement>): t is HTMLElement =>
  (t as HTMLElement).nodeType === 1

export function ambient(element: HTMLElement, options?: AmbientOptions): Ambient
export function ambient(elements: ArrayLike<HTMLElement>, options?: AmbientOptions): AmbientGroup
export function ambient(
  target: HTMLElement | ArrayLike<HTMLElement>,
  options: AmbientOptions = {},
): Ambient | AmbientGroup {
  const single = isSingle(target)
  const elements: HTMLElement[] = single ? [target] : Array.from(target)

  const breatheC = resolveBreathe(options.breathe)
  const driftC = resolveDrift(options.drift)
  const bobC = resolveBob(options.bob)
  const wanderC = resolveWander(options.wander)
  const hasMotion = breatheC !== null || driftC !== null || bobC !== null || wanderC !== null

  const scheduler = options.scheduler ?? getSharedScheduler()
  const schedOpt = { scheduler }
  const baseSeed = options.seed ?? (seedCounter = wrap1(seedCounter + GOLDEN))
  const allowReduced = options.reducedMotion === 'allow'

  // Shared slowly-roaming attractors (one small pool for the whole field).
  const attractorCount = wanderC ? Math.min(3, Math.max(1, elements.length)) : 0
  const attractors: Array<{ x: Stepper; y: Stepper }> = []
  for (let i = 0; i < attractorCount; i++) {
    const ph = wrap1(i * GOLDEN)
    attractors.push({
      x: makeOsc(wanderC!.attractorPeriod, ph),
      y: makeOsc(wanderC!.attractorPeriod * 1.3, wrap1(ph + 0.25)),
    })
  }

  const members: Member[] = elements.map((el, i) => {
    const seed = wrap1(baseSeed + i * GOLDEN)
    const out = {
      x: animatable(0, schedOpt),
      y: animatable(0, schedOpt),
      scale: animatable(1, schedOpt),
      opacity: animatable(1, schedOpt),
    }
    const driftPhase = driftC?.phase ?? wrap1(seed + 0.13)
    const epiSeed = wrap1(seed + 0.61)
    const m: Member = {
      out,
      unbind: () => {},
      breathe:
        breatheC && (breatheC.scaleAmt > 0 || breatheC.opacityAmt > 0)
          ? makeOsc(breatheC.period, breatheC.phase ?? seed)
          : null,
      driftX: driftC && driftC.useX ? makeOsc(driftC.px, driftPhase) : null,
      driftY: driftC && driftC.useY ? makeOsc(driftC.py, wrap1(driftPhase + 0.25)) : null,
      bob: bobC ? makeOsc(bobC.period, bobC.phase ?? wrap1(seed + 0.37)) : null,
      wanderX: wanderC ? makeSpring(wanderC.stiffness, wanderC.damping, wanderC.mass) : null,
      wanderY: wanderC ? makeSpring(wanderC.stiffness, wanderC.damping, wanderC.mass) : null,
      attractor: attractorCount > 0 ? i % attractorCount : 0,
      epiX: wanderC ? makeOsc(wanderC.attractorPeriod * 0.6, epiSeed) : null,
      epiY: wanderC ? makeOsc(wanderC.attractorPeriod * 0.6, wrap1(epiSeed + 0.25)) : null,
    }
    // Bind only the channels a behavior writes; the rest stay constant Animatables.
    const channels: StyleBindings = {}
    if (m.breathe && breatheC && breatheC.scaleAmt > 0) channels.scale = out.scale
    if (m.breathe && breatheC && breatheC.opacityAmt > 0) channels.opacity = out.opacity
    if (m.driftX || m.wanderX) channels.x = out.x
    if (m.driftY || m.bob || m.wanderY) channels.y = out.y
    m.unbind = bindStyle(el, channels, schedOpt)
    return m
  })

  // Field state for the idle/active handoff (one shared pointer subscription).
  let nowMs = 0
  let lastMoveAtMs = -Infinity
  let pointerKnown = false
  let pointerX = 0
  let pointerY = 0

  const normalize = (frame: 'viewport' | HTMLElement): { nx: number; ny: number } | null => {
    let halfW: number
    let halfH: number
    let cx: number
    let cy: number
    if (frame === 'viewport') {
      halfW = window.innerWidth / 2
      halfH = window.innerHeight / 2
      if (halfW === 0 || halfH === 0) return null
      cx = halfW
      cy = halfH
    } else {
      const r = frame.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return null
      halfW = r.width / 2
      halfH = r.height / 2
      cx = r.left + halfW
      cy = r.top + halfH
    }
    return { nx: clamp1((pointerX - cx) / halfW), ny: clamp1((pointerY - cy) / halfH) }
  }

  const compose = (m: Member, alpha: number): void => {
    if (m.breathe && breatheC) {
      const [u, uv] = interp(m.breathe, alpha)
      if (breatheC.scaleAmt > 0) {
        m.out.scale.drive({ position: 1 + breatheC.scaleAmt * u, velocity: breatheC.scaleAmt * uv })
      }
      if (breatheC.opacityAmt > 0) {
        m.out.opacity.drive({
          position: clamp01(1 - breatheC.opacityAmt * 0.5 * (1 + u)),
          velocity: -breatheC.opacityAmt * 0.5 * uv,
        })
      }
    }
    if (m.driftX || m.wanderX) {
      let p = 0
      let v = 0
      if (m.driftX && driftC) {
        const [dp, dv] = interp(m.driftX, alpha)
        p += driftC.ampX * dp
        v += driftC.ampX * dv
      }
      if (m.wanderX) {
        const [wp, wv] = interp(m.wanderX, alpha)
        p += wp
        v += wv
      }
      m.out.x.drive({ position: p, velocity: v })
    }
    if (m.driftY || m.bob || m.wanderY) {
      let p = 0
      let v = 0
      if (m.driftY && driftC) {
        const [dp, dv] = interp(m.driftY, alpha)
        p += driftC.ampY * dp
        v += driftC.ampY * dv
      }
      if (m.bob && bobC) {
        const [bp, bv] = interp(m.bob, alpha)
        p += bobC.amp * bp
        v += bobC.amp * bv
      }
      if (m.wanderY) {
        const [wp, wv] = interp(m.wanderY, alpha)
        p += wp
        v += wv
      }
      m.out.y.drive({ position: p, velocity: v })
    }
  }

  let accumulatorS = 0
  const onFrame = ({ deltaMs }: { deltaMs: number }): void => {
    nowMs += deltaMs

    // Aim the wander springs for this frame: active -> pointer parallax, idle -> the
    // assigned roaming attractor. Only the aim changes; the spring state persists, so
    // a flip BENDS the element with velocity conserved (the recapture).
    if (wanderC) {
      const active = pointerKnown && nowMs - lastMoveAtMs < wanderC.idleAfter
      const parallax = active ? normalize(wanderC.frame) : null
      for (const m of members) {
        if (parallax) {
          m.wanderX!.aim = wanderC.sign * parallax.nx * wanderC.parallax
          m.wanderY!.aim = wanderC.sign * parallax.ny * wanderC.parallax
        } else {
          const a = attractors[m.attractor]!
          const epiR = 0.3 * wanderC.radius
          m.wanderX!.aim = a.x.curr.position * wanderC.radius + epiR * m.epiX!.curr.position
          m.wanderY!.aim = a.y.curr.position * wanderC.radius + epiR * m.epiY!.curr.position
        }
      }
    }

    accumulatorS += deltaMs / 1000
    while (accumulatorS >= H) {
      accumulatorS -= H
      for (const a of attractors) {
        step(a.x)
        step(a.y)
      }
      for (const m of members) {
        if (m.breathe) step(m.breathe)
        if (m.driftX) step(m.driftX)
        if (m.driftY) step(m.driftY)
        if (m.bob) step(m.bob)
        if (m.epiX) step(m.epiX)
        if (m.epiY) step(m.epiY)
        if (m.wanderX) step(m.wanderX)
        if (m.wanderY) step(m.wanderY)
      }
    }
    const alpha = accumulatorS / H
    for (const m of members) compose(m, alpha)
  }

  let unsubscribe: (() => void) | null = null
  let disposed = false
  const startLoop = (): void => {
    if (!unsubscribe && !disposed && hasMotion && members.length > 0) {
      unsubscribe = scheduler.subscribe(onFrame)
    }
  }
  const stopLoop = (): void => {
    unsubscribe?.()
    unsubscribe = null
  }
  const driveRest = (): void => {
    for (const m of members) {
      if (m.breathe && breatheC && breatheC.scaleAmt > 0) m.out.scale.drive({ position: 1, velocity: 0 })
      if (breatheC && breatheC.opacityAmt > 0) m.out.opacity.drive({ position: 1, velocity: 0 })
      if (m.driftX || m.wanderX) m.out.x.drive({ position: 0, velocity: 0 })
      if (m.driftY || m.bob || m.wanderY) m.out.y.drive({ position: 0, velocity: 0 })
    }
  }

  // The shared pointer source (one window listener) and the leave-to-idle hook,
  // only when wander is enabled.
  let offPointer: (() => void) | null = null
  let onLeave: (() => void) | null = null
  if (wanderC) {
    // No pointer warm-start: ambient idles (wander) until the first move, then the
    // first onPointerMove arms the idle timer and the field bends into parallax.
    offPointer = onPointerMove((x, y) => {
      pointerX = x
      pointerY = y
      pointerKnown = true
      lastMoveAtMs = nowMs
    })
    onLeave = (): void => {
      lastMoveAtMs = nowMs - wanderC.idleAfter // force wander next frame
    }
    document.addEventListener('mouseleave', onLeave)
  }

  const offPolicy = onReducedMotionChange((reduced) => {
    if (allowReduced) return
    if (reduced) {
      stopLoop()
      driveRest()
    } else {
      startLoop()
    }
  })

  if (prefersReducedMotion() && !allowReduced) driveRest()
  else startLoop()

  const disposeOutputs = (m: Member): void => {
    m.unbind()
    m.out.x.dispose()
    m.out.y.dispose()
    m.out.scale.dispose()
    m.out.opacity.dispose()
  }

  const teardown = (): void => {
    if (disposed) return
    disposed = true
    stopLoop()
    offPointer?.()
    if (onLeave) document.removeEventListener('mouseleave', onLeave)
    offPolicy()
    for (const m of members) disposeOutputs(m)
    members.length = 0
  }

  const toAmbient = (m: Member): Ambient => ({
    x: m.out.x,
    y: m.out.y,
    scale: m.out.scale,
    opacity: m.out.opacity,
    dispose() {
      const i = members.indexOf(m)
      if (i === -1) return
      members.splice(i, 1)
      disposeOutputs(m)
      if (members.length === 0) teardown()
    },
  })

  if (single) {
    const item = toAmbient(members[0]!)
    return { ...item, dispose: teardown }
  }
  return { items: members.map(toAmbient), dispose: teardown }
}
