import { draw, morph, morphCommands, motionPath } from '@underlying/svg'
import { button, h, slider, type Section } from '../showcase'

// Slow and slightly springy - easy to actually watch.
const GENTLE = { stiffness: 52, damping: 16 }
const SLOW_DRAW = { stiffness: 34, damping: 18 }

const FLIGHT_D = 'M 16 150 C 90 14, 152 14, 178 88 S 270 168, 306 40'
const PLANE_D = 'M -11 -7 L 13 0 L -11 7 L -4 0 Z'
const SIGN_D =
  'M 22 110 C 44 60 64 60 74 106 C 80 68 100 68 108 106 C 120 46 146 158 172 100 C 190 62 214 154 236 100 C 250 68 276 72 300 102'
const CIRCLE_D = 'M 160 30 C 196 30 224 58 224 92 C 224 126 196 154 160 154 C 124 154 96 126 96 92 C 96 58 124 30 160 30 Z'
const STAR_D = 'M 160 26 L 176 70 L 223 72 L 186 100 L 199 145 L 160 119 L 121 145 L 134 100 L 97 72 L 144 70 Z'
// A play triangle and a stop square - sharp corners on both, for the command morph.
const PLAY_D = 'M 130 48 L 130 132 L 208 90 Z'
const STOP_D = 'M 120 50 L 200 50 L 200 130 L 120 130 Z'

const canvas = (inner: string): HTMLDivElement => {
  const wrap = h('div', { class: 'svgdemo' })
  wrap.innerHTML = `<svg class="svgdemo__canvas" viewBox="0 0 320 180" aria-hidden="true">${inner}</svg>`
  return wrap
}

export const svgMotionPath: Section = {
  id: 'svg-motion-path',
  group: 'SVG',
  title: 'motionPath()',
  tagline: 'A paper plane flies the route - flick it and inertia lands it.',
  description: `
    <p>Here an <strong>object travels along a fixed path</strong>: the plane's progress is one live
    value, and the dashed line is the route. Press <strong>play</strong> for a gentle spring along it,
    or <strong>flick</strong> to throw it down the route on inertia and watch it glide to a stop -
    then drag <strong>scrub</strong> to place it by hand. <code>autoRotate</code> banks the plane along
    the tangent. A baked path tween cannot be flicked or interrupted; this is just an
    <code>Animatable</code>.</p>`,
  code: `import { motionPath } from '@underlying/svg'

const ride = motionPath(plane, '#route', { autoRotate: true })
ride.spring(1)     // fly to the end
ride.flick(1.1)    // throw it down the route; inertia lands it
ride.spring(0.4)   // retarget mid-flight, momentum kept`,
  run(ctx) {
    const wrap = canvas(`
      <path class="svgdemo__track" d="${FLIGHT_D}" fill="none" />
      <path class="svgdemo__plane" d="${PLANE_D}" />`)
    ctx.stage.append(wrap)
    const track = wrap.querySelector('.svgdemo__track') as unknown as SVGPathElement
    const plane = wrap.querySelector('.svgdemo__plane') as unknown as SVGPathElement

    const ride = motionPath(plane, track, { autoRotate: true })
    ctx.onCleanup(() => ride.revert())

    const scrub = slider('scrub', { min: 0, max: 100, value: 0, onInput: (v) => ride.set(v / 100) })
    ctx.controls.append(
      button('play', () => ride.spring(1, GENTLE)),
      button('flick', () => {
        ride.set(0)
        ride.flick(1.1)
      }),
      button('reset', () => ride.spring(0, GENTLE)),
      scrub,
    )
  },
}

export const svgDraw: Section = {
  id: 'svg-draw',
  group: 'SVG',
  title: 'draw()',
  tagline: 'A signature draws itself - and you can interrupt it mid-stroke.',
  description: `
    <p>No object moves here: the <strong>line itself appears</strong>, drawn on as a single fraction
    (0 hidden, 1 drawn) driven by a slow spring. Press <strong>sign</strong> to watch the stroke trace
    out, then <strong>erase</strong> while it is still drawing - it bends back from wherever it reached,
    no restart. The stroke-dasharray/offset draw technique (<code>stroke-dasharray</code>/<code>offset</code>),
    but the fraction is live.</p>`,
  code: `import { draw } from '@underlying/svg'

const line = draw('#signature')
line.spring(1)   // draw it on
line.spring(0)   // erase - interruptible mid-stroke`,
  run(ctx) {
    const wrap = canvas(`<path class="svgdemo__sign" d="${SIGN_D}" fill="none" />`)
    ctx.stage.append(wrap)
    const sign = wrap.querySelector('.svgdemo__sign') as unknown as SVGPathElement

    const line = draw(sign, { from: 1 }) // rest state: fully drawn
    ctx.onCleanup(() => line.revert())

    ctx.controls.append(
      button('sign', () => {
        line.set(0)
        line.spring(1, SLOW_DRAW)
      }),
      button('erase', () => line.spring(0, SLOW_DRAW)),
    )
  },
}

export const svgMorph: Section = {
  id: 'svg-morph',
  group: 'SVG',
  title: 'morph()',
  tagline: 'One shape becomes another - and the morph is a value you can scrub.',
  description: `
    <p>A circle <strong>turns into a star</strong> and back. Both outlines are resampled into points
    and interpolated, so <em>any</em> two shapes morph - no matching the path commands by hand. The
    morph fraction is a live <code>Animatable</code>: press <strong>to star</strong> / <strong>to
    circle</strong> for a spring, or drag <strong>scrub</strong> to hold it halfway. Grab it mid-morph
    and it retargets - a baked shape tween cannot.</p>`,
  code: `import { morph } from '@underlying/svg'

const m = morph(blob, starPathData, { closed: true })
m.spring(1)   // morph to the star
m.spring(0)   // morph back - interruptible`,
  run(ctx) {
    const wrap = canvas(`<path class="svgdemo__morph" d="${CIRCLE_D}" />`)
    ctx.stage.append(wrap)
    const shape = wrap.querySelector('.svgdemo__morph') as unknown as SVGPathElement

    const m = morph(shape, STAR_D, { closed: true, samples: 80 })
    ctx.onCleanup(() => m.revert())

    const scrub = slider('scrub', { min: 0, max: 100, value: 0, onInput: (v) => m.set(v / 100) })
    ctx.controls.append(
      button('to star', () => m.spring(1, GENTLE)),
      button('to circle', () => m.spring(0, GENTLE)),
      scrub,
    )
  },
}

export const svgMorphSharp: Section = {
  id: 'svg-morph-sharp',
  group: 'SVG',
  title: 'morphCommands()',
  tagline: 'Command-preserving morph - every corner stays razor-sharp.',
  description: `
    <p>Where <code>morph()</code> resamples both outlines into points (any two shapes, but corners
    soften), <code>morphCommands()</code> parses the path commands, subdivides the sparser shape so
    anchors map to anchors, aligns the rings, and interpolates each curve - so a <strong>play
    triangle becomes a stop square</strong> with every corner crisp the whole way across. Same live
    fraction: spring it, or drag <strong>scrub</strong> to hold it halfway, interruptible.</p>`,
  code: `import { morphCommands } from '@underlying/svg'

const m = morphCommands(icon, stopSquareData)
m.spring(1)   // play -> stop, corners stay sharp
m.spring(0)   // back - interruptible`,
  run(ctx) {
    const wrap = canvas(`<path class="svgdemo__morph" d="${PLAY_D}" />`)
    ctx.stage.append(wrap)
    const shape = wrap.querySelector('.svgdemo__morph') as unknown as SVGPathElement

    const m = morphCommands(shape, STOP_D)
    ctx.onCleanup(() => m.revert())

    const scrub = slider('scrub', { min: 0, max: 100, value: 0, onInput: (v) => m.set(v / 100) })
    ctx.controls.append(
      button('to stop', () => m.spring(1, GENTLE)),
      button('to play', () => m.spring(0, GENTLE)),
      scrub,
    )
  },
}
