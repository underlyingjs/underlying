import { animatable, animate, bindStyle, type Simulation } from '@underlying/core'
import { button, h, slider, type Section } from '../showcase'

export const gettingStarted: Section = {
  id: 'getting-started',
  group: 'Getting started',
  title: 'animate()',
  tagline: 'One call. Springs by default. Every value interruptible.',
  description: `
    <p><code>animate(element, targets)</code> is the whole entry point. The five
    transform/opacity channels (<code>x</code>, <code>y</code>, <code>scale</code>,
    <code>rotate</code>, <code>opacity</code>) ride a compositor-friendly fast
    path; any other CSS property routes through the value model. No durations, no
    easing guesswork - physics drives the motion. Click to toggle.</p>`,
  code: `import { animate } from '@underlying/core'

animate(box, { x: 120, scale: 1.3, rotate: 12 })   // springs by default
animate(box, { x: 0, scale: 1, rotate: 0 })        // retarget: velocity conserved`,
  api: `animate(el: HTMLElement, targets: AnimateTargets, options?: AnimateOptions): AnimationHandle`,
  run(ctx) {
    const box = h('div', { class: 'obj obj--chip' })
    ctx.stage.append(box)
    let out = false
    ctx.controls.append(
      button('animate', () => {
        out = !out
        animate(box, out ? { x: 110, scale: 1.35, rotate: 12 } : { x: 0, scale: 1, rotate: 0 })
      }),
    )
  },
}

export const springs: Section = {
  id: 'springs',
  group: 'Core concepts',
  title: 'Springs',
  tagline: 'Stiffness and damping, not duration and bezier.',
  description: `
    <p>The default motion is a spring. Tune <code>stiffness</code> and
    <code>damping</code> and click anywhere in the track - the chip springs to the
    pointer. A deterministic fixed-timestep simulation means the trajectory is the
    same at 60, 120, or 144 Hz.</p>`,
  code: `import { animate } from '@underlying/core'

track.addEventListener('pointerdown', (event) => {
  const x = event.clientX - track.getBoundingClientRect().left - 26
  animate(chip, { x }, { stiffness: 170, damping: 14 })
})`,
  api: `interface SpringOptions { stiffness?: number; damping?: number; mass?: number;
  velocity?: number; restDelta?: number; restSpeed?: number }`,
  run(ctx) {
    const track = h('div', { style: 'position:absolute;inset:18px;display:flex;align-items:center;cursor:crosshair' })
    const chip = h('div', { class: 'obj obj--chip' })
    track.append(chip)
    ctx.stage.append(track)
    let stiffness = 170
    let damping = 14
    track.addEventListener('pointerdown', (event) => {
      const x = event.clientX - track.getBoundingClientRect().left - 26
      animate(chip, { x: Math.max(0, x) }, { stiffness, damping })
    })
    ctx.controls.append(
      slider('stiffness', { min: 20, max: 600, value: stiffness, onInput: (v) => (stiffness = v) }),
      slider('damping', { min: 2, max: 60, value: damping, onInput: (v) => (damping = v) }),
    )
  },
}

export const interruption: Section = {
  id: 'interruption',
  group: 'Core concepts',
  title: 'Interruption',
  tagline: 'Retarget mid-flight - velocity is conserved, never a jump.',
  description: `
    <p>Every animated value knows its position <em>and its velocity</em>. A second
    <code>animate()</code> call retargets the same underlying value from exactly
    where it is, carrying its momentum - not a parallel animation, not a restart.
    Spam the buttons mid-flight: the motion stays continuous.</p>`,
  code: `import { animate } from '@underlying/core'

animate(chip, { x: 240 })   // launch
animate(chip, { x: 0 })     // interrupt: continues from the live velocity`,
  api: `// a repeat animate() retargets the same value; the handle never rejects
interface AnimationHandle { readonly finished: Promise<void>; stop(): void }`,
  run(ctx) {
    const track = h('div', { style: 'position:absolute;inset:18px;display:flex;align-items:center' })
    const chip = h('div', { class: 'obj obj--chip' })
    track.append(chip)
    ctx.stage.append(track)
    const span = () => Math.max(0, track.getBoundingClientRect().width - 52)
    ctx.controls.append(
      button('left', () => animate(chip, { x: 0 }, { stiffness: 120, damping: 12 })),
      button('right', () => animate(chip, { x: span() }, { stiffness: 120, damping: 12 })),
    )
  },
}

// Gravity plus a damped floor: the ball accelerates down, the floor pushes back
// and bleeds energy on each contact, until it settles. No spring or decay draws
// an accelerating fall followed by a decaying bounce - this is custom physics.
const FLOOR = 150
const gravityBounce = (floor: number): Simulation => {
  const g = 2600 // gravity, px/s^2
  const k = 9000 // floor stiffness (stiffer = less squash)
  const c = 20 // floor damping -> energy lost per bounce
  const restPos = floor + g / k // gravity holds it a hair into the floor
  return {
    acceleration: (pos, vel) => (pos > floor ? g - k * (pos - floor) - c * vel : g),
    rest: (pos, vel) => (pos >= floor && Math.abs(vel) < 3 && Math.abs(pos - restPos) < 1.5 ? restPos : null),
  }
}

export const customPhysics: Section = {
  id: 'custom-physics',
  group: 'Core concepts',
  title: 'Custom physics',
  tagline: 'Bring your own acceleration - the same engine runs it.',
  description: `
    <p>Spring, decay, and tween are presets over one primitive: a
    <code>Simulation</code> - an acceleration plus a rest condition.
    <code>value.simulate(yourSimulation)</code> runs anything on the same
    fixed-timestep clock, fully interruptible. Drop both: the left ball
    <em>springs</em> to the floor and eases gently to a stop - a spring
    decelerates into its target and never passes it, so it cannot bounce. The
    right falls under <em>gravity</em>, slams in, and bounces, energy lost each
    time - an accelerating fall and a decaying bounce no spring can draw. Same
    engine, your physics.</p>`,
  code: `import { animatable } from '@underlying/core'

// your acceleration, your rest condition
const bounce = {
  acceleration: (pos, vel) => pos > floor ? G - K * (pos - floor) - C * vel : G,
  rest: (pos, vel) => pos >= floor && Math.abs(vel) < 3 ? floor : null,
}
y.simulate(bounce)            // the same engine behind spring/decay/to`,
  api: `interface Simulation {
  acceleration(position: number, velocity: number): number   // units/s^2
  rest(position: number, velocity: number): number | null    // settled pos, or null while moving
}
value.simulate(simulation: Simulation, options?: { velocity?: number }): AnimationHandle`,
  run(ctx) {
    const lane = (tag: string): { col: HTMLElement; ball: HTMLElement } => {
      const ball = h('div', { class: 'obj obj--dot dropdemo__ball' })
      const court = h('div', { class: 'dropdemo__court' }, ball, h('i', { class: 'dropdemo__floor' }))
      const col = h('div', { class: 'dropdemo__lane' }, court, h('span', { class: 'dropdemo__tag' }, tag))
      return { col, ball }
    }
    const a = lane('spring')
    const b = lane('gravity')
    ctx.stage.append(h('div', { class: 'dropdemo' }, a.col, b.col))

    const yA = animatable(FLOOR)
    const yB = animatable(FLOOR)
    const unbind = [bindStyle(a.ball, { y: yA }), bindStyle(b.ball, { y: yB })]
    const drop = (): void => {
      yA.set(0)
      yB.set(0)
      yA.spring(FLOOR, { stiffness: 120, damping: 22 }) // critically damped: eases gently to a stop, no overshoot
      yB.simulate(gravityBounce(FLOOR))
    }
    ctx.controls.append(button('drop', drop))
    ctx.onCleanup(() => {
      for (const off of unbind) off()
      yA.dispose()
      yB.dispose()
    })
  },
}
