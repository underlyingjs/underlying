import { draw, motionPath } from '@underlying/svg'
import { button, h, slider, type Section } from '../showcase'

// A wavy track and a comet that rides it; both live in the same SVG user space.
const TRACK_D = 'M 18 150 C 92 18, 150 18, 176 92 S 268 168, 304 44'
const SIGN_D = 'M 20 104 C 56 28, 92 28, 116 104 S 168 180, 196 104 S 268 28, 300 96'

export const svgMotionPath: Section = {
  id: 'svg-motion-path',
  group: 'SVG',
  title: 'motionPath()',
  tagline: 'Ride a path - then flick the rider down it and let physics settle it.',
  description: `
    <p>The progress along the path is a single live value, so this is not a baked
    path tween. Press <strong>play</strong> for a spring to the end; press
    <strong>flick</strong> to fling the comet down the track on inertia and watch it
    glide to a stop wherever momentum runs out - then grab the scrubber and it
    retargets from there. <code>autoRotate</code> keeps the nose pointed along the
    path. A timed path tween cannot be flicked or interrupted; this one is just an
    <code>Animatable</code>.</p>`,
  code: `import { motionPath } from '@underlying/svg'

const ride = motionPath(comet, '#track', { autoRotate: true })
ride.spring(1)     // travel to the end
ride.flick(1.9)    // fling it down the path; it decays to a stop
ride.spring(0.4)   // retarget mid-flight, velocity kept`,
  run(ctx) {
    const wrap = h('div', { class: 'svgdemo' })
    wrap.innerHTML = `<svg class="svgdemo__canvas" viewBox="0 0 320 180" aria-hidden="true">
      <path class="svgdemo__track" d="${TRACK_D}" fill="none" />
      <path class="svgdemo__rider" d="M -9 -7 L 9 0 L -9 7 Z" />
    </svg>`
    ctx.stage.append(wrap)
    const track = wrap.querySelector('.svgdemo__track') as unknown as SVGPathElement
    const rider = wrap.querySelector('.svgdemo__rider') as unknown as SVGPathElement

    const ride = motionPath(rider, track, { autoRotate: true })
    ctx.onCleanup(() => ride.revert())

    const scrub = slider('progress', { min: 0, max: 100, value: 0, onInput: (v) => ride.set(v / 100) })
    ctx.controls.append(
      button('play', () => ride.spring(1)),
      button('flick', () => {
        ride.set(0)
        ride.flick(1.9)
      }),
      button('reset', () => ride.spring(0)),
      scrub,
    )
  },
}

export const svgDraw: Section = {
  id: 'svg-draw',
  group: 'SVG',
  title: 'draw()',
  tagline: 'Draw a stroke on with a spring - and interrupt it mid-draw.',
  description: `
    <p>Stroke draw-on is a single fraction (0 hidden, 1 drawn) driven by a spring,
    so it eases in with a touch of overshoot rather than a linear wipe. Press
    <strong>draw</strong> and then <strong>erase</strong> while it is still drawing -
    it bends back from wherever it is, no restart. Same mechanism as GSAP's DrawSVG
    (<code>stroke-dasharray</code>/<code>offset</code>), but the fraction is live.</p>`,
  code: `import { draw } from '@underlying/svg'

const line = draw('#signature')
line.spring(1)   // draw it on (a little overshoot)
line.spring(0)   // erase - interruptible mid-draw`,
  run(ctx) {
    const wrap = h('div', { class: 'svgdemo' })
    wrap.innerHTML = `<svg class="svgdemo__canvas" viewBox="0 0 320 180" aria-hidden="true">
      <path class="svgdemo__sign" d="${SIGN_D}" fill="none" />
    </svg>`
    ctx.stage.append(wrap)
    const sign = wrap.querySelector('.svgdemo__sign') as unknown as SVGPathElement

    const line = draw(sign, { from: 1 }) // rest state: fully drawn
    ctx.onCleanup(() => line.revert())

    ctx.controls.append(
      button('draw', () => {
        line.set(0)
        line.spring(1)
      }),
      button('erase', () => line.spring(0)),
    )
  },
}
