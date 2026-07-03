import { animate, filter } from '@underlying/core'
import { button, h, type Section } from '../showcase'

// ---------------------------------------------------------------------------

export const lengthsUnits: Section = {
  id: 'lengths-units',
  group: 'Value model',
  title: 'Lengths & units',
  tagline: 'Animate width, height, padding... with px <-> % conversion.',
  description: `
    <p>Beyond the five transform channels, <code>animate()</code> drives any CSS
    length. Targets in a different unit than the current value (<code>240px</code>
    retargeted to <code>50%</code>) are converted with a <strong>single
    measurement</strong> at the start - position <em>and</em> velocity are rebased,
    so the spring keeps its momentum across the unit change. The animation then
    runs in the target unit, staying responsive.</p>`,
  code: `import { animate } from '@underlying/core'

animate(box, { width: '60%' })           // springs in % space
animate(box, { width: '180px' })         // retarget: % -> px, velocity rebased
animate(box, { width: '100%' }, { stiffness: 220, damping: 18 })`,
  api: `type AnimateValue = number | string
animate(el, { width: AnimateValue, height?: AnimateValue, /* ... */ }, options?)`,
  run(ctx) {
    const wrap = h('div', { style: 'width:100%;display:flex;flex-direction:column;gap:10px' })
    const box = h('div', { class: 'obj obj--bar' })
    box.style.width = '30%'
    const readout = h('div', { style: 'font-size:12px;color:var(--lichen)' }, 'width: 30%')
    box.addEventListener('transitionend', () => {})
    wrap.append(box, readout)
    ctx.stage.append(wrap)

    const go = (width: string) => {
      readout.textContent = `width: ${width}`
      animate(box, { width }, { stiffness: 200, damping: 20 })
    }
    ctx.controls.append(
      button('30%', () => go('30%')),
      button('60%', () => go('60%')),
      button('100%', () => go('100%')),
      button('180px', () => go('180px')),
    )
  },
}

// ---------------------------------------------------------------------------

export const colors: Section = {
  id: 'colors',
  group: 'Value model',
  title: 'Colors',
  tagline: 'Hex, rgb(), hsl(), and named colors - mixed in gamma-2.0 space.',
  description: `
    <p>Every color property animates: <code>backgroundColor</code>,
    <code>color</code>, <code>borderColor</code>, <code>fill</code>... Inputs parse
    from hex, <code>rgb()</code>, <code>hsl()</code>, or CSS named colors and
    interpolate in approximate linear-light space, so the midpoint never goes
    muddy. Colors are <em>non-spatial</em>: under reduced-motion <code>fade</code>
    they keep crossfading while movement snaps. A <strong>damped spring</strong>
    keeps the crossfade clean - colors shouldn't overshoot the way motion does.</p>`,
  code: `import { animate } from '@underlying/core'

// non-spatial: a damped spring crossfades cleanly, no overshoot
const fade = { stiffness: 200, damping: 30 }
animate(swatch, { backgroundColor: '#10b981' }, fade)
animate(swatch, { backgroundColor: 'rebeccapurple' }, fade)`,
  api: `animate(el, { backgroundColor: string }, options?): AnimationHandle`,
  run(ctx) {
    const swatch = h('div', { class: 'obj obj--swatch' })
    ctx.stage.append(swatch)
    // Damped (no overshoot) - a spring on a colour shouldn't bounce.
    const fade = { stiffness: 200, damping: 30 }
    const palette = [
      { value: '#10b981', label: 'emerald' },
      { value: 'rebeccapurple', label: 'rebeccapurple' },
      { value: 'hsl(8, 90%, 60%)', label: 'coral' },
      { value: '#f6c453', label: 'amber' },
      { value: '#2952e8', label: 'blue' },
    ]
    for (const color of palette) {
      ctx.controls.append(button(color.label, () => animate(swatch, { backgroundColor: color.value }, fade)))
    }
  },
}

// ---------------------------------------------------------------------------

export const composite: Section = {
  id: 'composite',
  group: 'Value model',
  title: 'Composite values',
  tagline: 'box-shadow, filter - numbers and embedded colors, even from none.',
  description: `
    <p>Composite properties decompose into their numbers <em>and</em> embedded
    colors, each driven by its own spring. <code>box-shadow</code> and
    <code>filter</code> animate from a real value or from <code>none</code> (a
    transparent zero-equivalent is synthesized). Token realignment absorbs the
    browser's color-first computed order, so a hover-elevation just works.</p>`,
  code: `import { animate } from '@underlying/core'

animate(card, { boxShadow: '0px 18px 40px rgba(41, 82, 232, 0.45)' })
animate(card, { boxShadow: 'none' })          // back to the zero-equivalent`,
  api: `// the generic "complex" value type: numbers + colors + literal text`,
  run(ctx) {
    const card = h('div', { class: 'obj obj--card' })
    ctx.stage.append(card)
    const shadows = [
      { label: 'flat', value: 'none' },
      { label: 'raised', value: '0px 8px 18px rgba(0, 0, 0, 0.45)' },
      { label: 'floating', value: '0px 18px 40px rgba(0, 0, 0, 0.55)' },
      { label: 'glow', value: '0px 0px 32px rgba(122, 162, 255, 0.7)' },
    ]
    for (const shadow of shadows) {
      ctx.controls.append(button(shadow.label, () => animate(card, { boxShadow: shadow.value })))
    }
  },
}

// ---------------------------------------------------------------------------

export const keyframes: Section = {
  id: 'keyframes',
  group: 'Value model',
  title: 'Keyframes',
  tagline: 'A list of waypoints - chained springs, or an even piecewise tween.',
  description: `
    <p>An array target moves through each waypoint. <strong>Without a
    duration</strong> the waypoints are chained springs: settle at each, then
    retarget - the honest physics of springing through a list.
    <strong>With a duration</strong> they become an evenly-split piecewise tween
    that rides the compositor (WAAPI multi-keyframe) when eligible. A leading
    <code>null</code> means "from the current value".</p>`,
  code: `import { animate } from '@underlying/core'

animate(chip, { x: [0, 160, 80, 140] })                 // chained springs
animate(chip, { x: [0, 160, 80, 140] }, { duration: 900 }) // piecewise tween`,
  api: `type AnimateKeyframes = ReadonlyArray<number | string | null>
animate(el, { x: [0, 160, 80] }, options?)`,
  run(ctx) {
    const chip = h('div', { class: 'obj obj--chip' })
    ctx.stage.append(h('div', { style: 'position:relative;width:100%;height:60px;display:flex;align-items:center' }, chip))
    ctx.controls.append(
      button('spring chain', () => animate(chip, { x: [0, 180, 60, 140] })),
      button('duration 900ms', () => animate(chip, { x: [0, 180, 60, 140] }, { duration: 900 })),
      button('reset', () => animate(chip, { x: 0 })),
    )
  },
}

// ---------------------------------------------------------------------------

export const expressiveKeyframes: Section = {
  id: 'expressive-keyframes',
  group: 'Value model',
  title: 'Expressive keyframes',
  tagline: 'Per-segment position and easing, plus null holds - one waypoint list, full control.',
  description: `
    <p>A keyframe entry can be a <code>{ value, at, ease }</code> stop instead of a
    bare value. <code>at</code> places the waypoint at a fraction of the duration,
    <code>ease</code> sets that segment's easing, and a <code>null</code> mid-array
    <em>holds</em> the previous value (a dwell). Here a chip darts out fast, lingers,
    then eases back - the shaped move a hand-tuned entrance needs.</p>`,
  code: `import { animate } from '@underlying/core'

animate(chip, {
  x: [0, { value: 200, at: 0.2, ease: 'power3.out' }, null, 40],
}, { duration: 1200 })  // dart out, hold, ease back`,
  api: `type KeyframeStop = { value: number | string | null; at?: number; ease?: Easing | string }
// null mid-array = hold the previous value`,
  run(ctx) {
    const chip = h('div', { class: 'obj obj--chip' })
    ctx.stage.append(h('div', { style: 'position:relative;width:100%;height:60px;display:flex;align-items:center' }, chip))
    const play = (): void =>
      void animate(chip, { x: [0, { value: 220, at: 0.22, ease: 'power3.out' }, null, 40] }, { duration: 1200 })
    ctx.onCleanup(() => animate(chip, { x: 0 }, { duration: 0 }))
    ctx.controls.append(button('play', play), button('reset', () => animate(chip, { x: 0 })))
  },
}

// ---------------------------------------------------------------------------

export const channels: Section = {
  id: 'filter-attr-autoalpha',
  group: 'Value model',
  title: 'Filters, attributes, autoAlpha',
  tagline: 'Animate CSS filters, SVG attributes, and opacity-with-visibility - all one handle.',
  description: `
    <p>Three named surfaces over the same engine. <code>filter()</code> builds a
    typed, canonical-order filter string. An <code>attr:</code> key animates an
    element or SVG attribute (here a circle's <code>r</code> and <code>fill</code>)
    through <code>setAttribute</code>. <code>autoAlpha</code> fades opacity and flips
    <code>visibility</code> at 0, so a hidden element stops catching the pointer.</p>`,
  code: `import { animate, filter } from '@underlying/core'

animate(hero, { filter: filter({ blur: 6, saturate: 1.4 }) })
animate(circle, { 'attr:r': [30, 52], 'attr:fill': '#ff5470' })
animate(card, { autoAlpha: 0 })  // opacity 0 AND visibility:hidden`,
  api: `filter(spec): string           // { blur, brightness, hueRotate, dropShadow, ... }
animate(el, { 'attr:name': value })  // setAttribute (SVG viewBox / r / points)
animate(el, { autoAlpha: 0 })        // opacity + visibility`,
  run(ctx) {
    const wrap = h('div', { style: 'display:flex;gap:28px;align-items:center;flex-wrap:wrap' })
    wrap.innerHTML =
      '<svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle class="uc-circle" cx="60" cy="60" r="30" fill="#5b8cff" /></svg>'
    const tile = h('div', { class: 'obj', style: 'width:120px;height:120px;border-radius:16px;background:#5b8cff' })
    wrap.append(tile)
    ctx.stage.append(wrap)
    const circle = wrap.querySelector('.uc-circle') as SVGElement

    ctx.onCleanup(() => {
      animate(tile, { filter: filter({}), autoAlpha: 1 }, { duration: 0 })
      animate(circle, { 'attr:r': 30, 'attr:fill': '#5b8cff' }, { duration: 0 })
    })
    ctx.controls.append(
      button('filter', () => animate(tile, { filter: filter({ blur: 6, saturate: 1.5 }) })),
      button('attr morph', () => animate(circle, { 'attr:r': [30, 52], 'attr:fill': '#ff5470' })),
      button('autoAlpha 0', () => animate(tile, { autoAlpha: 0 })),
      button('reset', () => {
        animate(tile, { filter: filter({}), autoAlpha: 1 })
        animate(circle, { 'attr:r': 30, 'attr:fill': '#5b8cff' })
      }),
    )
  },
}
