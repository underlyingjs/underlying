import { animate } from '@underlying/core'
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
