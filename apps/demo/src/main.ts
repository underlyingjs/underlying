import {
  animatable,
  animate,
  bindStyle,
  onReducedMotionChange,
  prefersReducedMotion,
  sequence,
  setReducedMotionBehavior,
  setReducedMotionOverride,
  stagger,
  type ReducedMotionBehavior,
} from '@underlying/core'

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const stage = byId<HTMLDivElement>('stage')
const ball = byId<HTMLDivElement>('ball')
const targetMark = byId<HTMLDivElement>('target')
const hud = byId<HTMLDivElement>('hud')
const stiffnessInput = byId<HTMLInputElement>('stiffness')
const dampingInput = byId<HTMLInputElement>('damping')
const stiffnessValue = byId<HTMLSpanElement>('stiffness-value')
const dampingValue = byId<HTMLSpanElement>('damping-value')
const releaseModeSelect = byId<HTMLSelectElement>('release-mode')
const rmBehaviorSelect = byId<HTMLSelectElement>('rm-behavior')
const rmSimulateInput = byId<HTMLInputElement>('rm-simulate')
const dots = [...document.querySelectorAll<HTMLSpanElement>('#dots span')]
const bars = [byId<HTMLDivElement>('bar-1'), byId<HTMLDivElement>('bar-2'), byId<HTMLDivElement>('bar-3')]
const tweenCard = byId<HTMLDivElement>('tween-card')

const BALL_RADIUS = 32

// La balle : animatables nus + binding direct au style
const x = animatable(window.innerWidth / 2)
const y = animatable(window.innerHeight / 2)
bindStyle(ball, { x, y })

const springParams = () => ({
  stiffness: Number(stiffnessInput.value),
  damping: Number(dampingInput.value),
})

const updateControlLabels = () => {
  stiffnessValue.textContent = stiffnessInput.value
  dampingValue.textContent = dampingInput.value
}
updateControlLabels()
stiffnessInput.addEventListener('input', updateControlLabels)
dampingInput.addEventListener('input', updateControlLabels)

rmBehaviorSelect.addEventListener('change', () => {
  setReducedMotionBehavior(rmBehaviorSelect.value as ReducedMotionBehavior)
})

// Force la préférence au niveau app - pas besoin de toucher aux réglages OS
// pour éprouver le comportement reduced-motion.
rmSimulateInput.addEventListener('change', () => {
  setReducedMotionOverride(rmSimulateInput.checked ? true : null)
})

/** Smoothed pointer velocity in px/s over a ~50 ms window. */
class VelocityTracker {
  private value = 0
  private lastPosition = 0
  private lastTimeMs = 0

  start(position: number, timeMs: number): void {
    this.value = 0
    this.lastPosition = position
    this.lastTimeMs = timeMs
  }

  sample(position: number, timeMs: number): void {
    const dt = (timeMs - this.lastTimeMs) / 1000
    if (dt <= 0) return
    const instantaneous = (position - this.lastPosition) / dt
    const alpha = 1 - Math.exp(-dt / 0.05)
    this.value += (instantaneous - this.value) * alpha
    this.lastPosition = position
    this.lastTimeMs = timeMs
  }

  /** A finger held still before release reads as zero. */
  read(timeMs: number): number {
    return timeMs - this.lastTimeMs > 80 ? 0 : this.value
  }
}

const velocityX = new VelocityTracker()
const velocityY = new VelocityTracker()

let dragging = false
let grabOffsetX = 0
let grabOffsetY = 0
let restTarget = { x: x.get(), y: y.get() }

const showTarget = (targetX: number, targetY: number) => {
  targetMark.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`
  targetMark.style.opacity = '1'
}

const springTo = (targetX: number, targetY: number, withVelocityX?: number, withVelocityY?: number) => {
  restTarget = { x: targetX, y: targetY }
  showTarget(targetX, targetY)
  const params = springParams()
  x.spring(targetX, withVelocityX === undefined ? params : { ...params, velocity: withVelocityX })
  y.spring(targetY, withVelocityY === undefined ? params : { ...params, velocity: withVelocityY })
}

const glideFrom = (withVelocityX: number, withVelocityY: number) => {
  targetMark.style.opacity = '0'
  // Inertie bornée : les bords du viewport sont des frontières rubber-band.
  x.decay({ velocity: withVelocityX, min: BALL_RADIUS, max: window.innerWidth - BALL_RADIUS })
  y.decay({ velocity: withVelocityY, min: BALL_RADIUS, max: window.innerHeight - BALL_RADIUS })
}

ball.addEventListener('pointerdown', (event) => {
  event.stopPropagation()
  dragging = true
  ball.classList.add('dragging')
  ball.setPointerCapture(event.pointerId)
  grabOffsetX = event.clientX - x.get()
  grabOffsetY = event.clientY - y.get()
  x.stop()
  y.stop()
  velocityX.start(x.get(), event.timeStamp)
  velocityY.start(y.get(), event.timeStamp)
})

ball.addEventListener('pointermove', (event) => {
  if (!dragging) return
  const nextX = event.clientX - grabOffsetX
  const nextY = event.clientY - grabOffsetY
  x.set(nextX)
  y.set(nextY)
  velocityX.sample(nextX, event.timeStamp)
  velocityY.sample(nextY, event.timeStamp)
})

ball.addEventListener('pointerup', (event) => {
  if (!dragging) return
  dragging = false
  ball.classList.remove('dragging')
  const vx = velocityX.read(event.timeStamp)
  const vy = velocityY.read(event.timeStamp)
  // Handoff : le mouvement de sortie hérite de la vélocité du geste.
  if (releaseModeSelect.value === 'inertie') glideFrom(vx, vy)
  else springTo(restTarget.x, restTarget.y, vx, vy)
})

// Clic n'importe où : nouveau target - même en plein glide d'inertie, le
// spring interrupteur hérite de la vélocité courante (handoff decay -> spring).
stage.addEventListener('pointerdown', (event) => {
  springTo(event.clientX, event.clientY)
})

// Panel : composition (stagger, sequence) et tween WAAPI

// stagger : cascade de springs, 80 ms entre chaque départ - montée puis descente.
const wave = (offsetY: number) =>
  stagger(dots, (dot) => animate(dot, { y: offsetY }, { stiffness: 380, damping: 13 }), 80)

byId<HTMLButtonElement>('run-stagger').addEventListener('click', () => {
  sequence([() => wave(-26), () => wave(0)])
})

// sequence : strictement l'une APRÈS l'autre - 1, 2, 3 sortent, puis 3, 2, 1 reviennent.
const slide = (bar: HTMLDivElement, to: number) => () =>
  animate(bar, { x: to }, { stiffness: 320, damping: 22 })

byId<HTMLButtonElement>('run-sequence').addEventListener('click', () => {
  sequence([
    slide(bars[0]!, 180),
    slide(bars[1]!, 180),
    slide(bars[2]!, 180),
    slide(bars[2]!, 0),
    slide(bars[1]!, 0),
    slide(bars[0]!, 0),
  ])
})

// Tween à durée : délégué au compositor (WAAPI + linear()) quand le
// navigateur le permet - sinon fallback rAF, comportement identique.
// 900 ms pour laisser le temps de l'interrompre en plein vol.
let tweenOut = false
byId<HTMLButtonElement>('run-tween').addEventListener('click', () => {
  tweenOut = !tweenOut
  animate(tweenCard, { x: tweenOut ? 186 : 0 }, { duration: 900 })
})

// HUD
const updateHud = () => {
  const reduced = prefersReducedMotion()
  const source = rmSimulateInput.checked ? 'simulé' : 'OS'
  hud.textContent =
    `position ${Math.round(x.get())}, ${Math.round(y.get())}  |  ` +
    `vélocité ${Math.round(x.velocity())}, ${Math.round(y.velocity())} px/s\n` +
    `reduced-motion effectif : ${reduced ? 'ACTIF' : 'inactif'} (${source})  |  stratégie : ${rmBehaviorSelect.value}`
}
onReducedMotionChange(updateHud)
rmBehaviorSelect.addEventListener('change', updateHud)
x.on('change', updateHud)
y.on('change', updateHud)
updateHud()
