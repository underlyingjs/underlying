import { animatable, bindStyle, linear } from '@underlying/core'
import { playable } from '@underlying/core/playback'
import { createScroll } from '@underlying/scroll'
import { h, type Section } from '../showcase'

// A self-contained scroll container that lives inside one demo card: its own
// scroller drives the demo, so it never fights the docs page scroll.
function scroller(railClass = 'scroller__rail'): { box: HTMLElement; rail: HTMLElement } {
  const rail = h('div', { class: railClass })
  const box = h('div', { class: 'scroller' }, h('span', { class: 'scroller__hint' }, 'scroll inside'), rail)
  return { box, rail }
}

export const scrollScrub: Section = {
  id: 'scroll-scrub',
  group: 'Scroll',
  title: 'scrub()',
  tagline: 'Scroll position drives a seekable handle - locked, or with momentum.',
  description: `
    <p>Scroll is a <em>source</em>, not an engine. <code>@underlying/scroll</code>
    turns scroll into a normalized 0..1 and feeds it to the same seams the core
    already exposes. <code>scrub()</code> drives a seekable handle: with
    <code>smooth: false</code> it locks the playhead to the scroll frame-for-frame,
    reversible and deterministic; with a number it routes through
    <code>follow()</code>, so the motion trails the scroll by that many seconds with
    conserved velocity. Both markers read the same scroll - the top one is locked,
    the bottom one trails. Scroll and watch the gap open and close.</p>`,
  code: `import { createScroll } from '@underlying/scroll'
import { animatable, bindStyle, linear } from '@underlying/core'
import { playable } from '@underlying/core/playback'

const scroll = createScroll({ scroller })

// linear: scroll position maps straight to progress, no ease-in
const locked = playable(xa).to(168, { paused: true, easing: linear })
const trail = playable(xb).to(168, { paused: true, easing: linear })
scroll.scrub(locked, { smooth: false })   // tracks the scroll exactly
scroll.scrub(trail, { smooth: 0.16 })      // trails it by ~0.16s, momentum`,
  run(ctx) {
    const { box, rail } = scroller('scroller__rail scroller__rail--tall')
    const lockedChip = h('div', { class: 'obj scrubcmp__chip' })
    const trailChip = h('div', { class: 'obj scrubcmp__chip scrubcmp__chip--trail' })
    const stack = h('div', { class: 'scrubcmp' },
      h('div', { class: 'scrubcmp__lane' }, h('span', { class: 'scrubcmp__tag' }, 'locked'), h('div', { class: 'scrubcmp__rail' }, lockedChip)),
      h('div', { class: 'scrubcmp__lane' }, h('span', { class: 'scrubcmp__tag' }, 'momentum 0.16s'), h('div', { class: 'scrubcmp__rail' }, trailChip)),
    )
    rail.append(stack)
    ctx.stage.append(box)

    const scroll = createScroll({ scroller: box })
    const span = 168
    const xa = animatable(0)
    const xb = animatable(0)
    const ua = bindStyle(lockedChip, { x: xa })
    const ub = bindStyle(trailChip, { x: xb })
    const locked = playable(xa).to(span, { paused: true, easing: linear })
    const trail = playable(xb).to(span, { paused: true, easing: linear })
    const sa = scroll.scrub(locked, { smooth: false })
    const sb = scroll.scrub(trail, { smooth: 0.16 })
    ctx.onCleanup(() => {
      sa.dispose()
      sb.dispose()
      ua()
      ub()
      locked.stop()
      trail.stop()
      xa.dispose()
      xb.dispose()
      scroll.dispose()
    })
  },
}

export const scrollParallax: Section = {
  id: 'scroll-parallax',
  group: 'Scroll',
  title: 'parallax()',
  tagline: 'Map scroll progress to px on a bindStyle-ready value.',
  description: `
    <p><code>parallax()</code> returns an <code>Animatable</code> you hand straight
    to <code>bindStyle</code>: scroll progress lerps between the two
    <code>output</code> endpoints. Give layers opposing outputs and they drift at
    different rates, so a near layer overtakes a far one. The same value model the
    rest of the engine uses, so a parallax layer and a spring layer on one element
    serialize through the same transform. Scroll to part the layers.</p>`,
  code: `const scroll = createScroll({ scroller })

const far = scroll.parallax({ output: [-26, 26] })     // drifts down
const near = scroll.parallax({ output: [54, -54] })    // drifts up, faster
bindStyle(farDot, { y: far })
bindStyle(nearDot, { y: near })`,
  run(ctx) {
    const { box, rail } = scroller('scroller__rail scroller__rail--tall')
    const layers = h('div', { class: 'scroller__layers' })
    const far = h('div', { class: 'obj obj--dot scroller__layer scroller__layer--far' })
    const mid = h('div', { class: 'obj obj--dot scroller__layer scroller__layer--mid' })
    const near = h('div', { class: 'obj obj--chip scroller__layer scroller__layer--near' })
    layers.append(far, mid, near)
    rail.append(layers)
    ctx.stage.append(box)

    const scroll = createScroll({ scroller: box })
    const farV = scroll.parallax({ output: [-26, 26] })
    const midV = scroll.parallax({ output: [16, -16] })
    const nearV = scroll.parallax({ output: [54, -54] })
    const unbind = [
      bindStyle(far, { y: farV }),
      bindStyle(mid, { y: midV }),
      bindStyle(near, { y: nearV }),
    ]
    ctx.onCleanup(() => {
      for (const off of unbind) off()
      farV.dispose()
      midV.dispose()
      nearV.dispose()
      scroll.dispose()
    })
  },
}

export const scrollTrigger: Section = {
  id: 'scroll-trigger',
  group: 'Scroll',
  title: 'trigger()',
  tagline: 'Enter/leave callbacks via IntersectionObserver, never rect-polling.',
  description: `
    <p><code>trigger()</code> watches an element with one
    <code>IntersectionObserver</code> and reads the crossing direction from the
    entry geometry, so it knows enter from enter-back and leave from leave-back.
    Here each card springs in as it enters and settles back as it leaves upward -
    the callbacks just retarget animatables, so the motion stays interruptible.
    Scroll down and back up.</p>`,
  code: `const scroll = createScroll({ scroller })

scroll.trigger(card, {
  onEnter: () => { opacity.spring(1); y.spring(0) },
  onLeaveBack: () => { opacity.spring(0.12); y.spring(20) },
})`,
  run(ctx) {
    const { box, rail } = scroller('scroller__rail scroller__rail--list')
    ctx.stage.append(box)
    const scroll = createScroll({ scroller: box })
    const offs: Array<() => void> = []

    for (let i = 0; i < 5; i += 1) {
      const card = h('div', { class: 'obj obj--card scroller__item' }, h('span', { class: 'scroller__num' }, String(i + 1)))
      rail.append(card)
      const opacity = animatable(0.12)
      const y = animatable(20)
      offs.push(bindStyle(card, { opacity, y }))
      const trig = scroll.trigger(card, {
        onEnter: () => {
          opacity.spring(1)
          y.spring(0)
        },
        onLeaveBack: () => {
          opacity.spring(0.12)
          y.spring(20)
        },
      })
      offs.push(() => trig.dispose(), () => opacity.dispose(), () => y.dispose())
    }
    ctx.onCleanup(() => {
      for (const off of offs) off()
      scroll.dispose()
    })
  },
}

export const scrollSnap: Section = {
  id: 'scroll-snap',
  group: 'Scroll',
  title: 'snap()',
  tagline: 'Spring to the nearest stop once the scroll goes idle.',
  description: `
    <p>Opt-in momentum snap (CSS scroll-snap stays the default elsewhere). When the
    scroll stops, <code>snap()</code> springs to the next stop <em>in the direction
    you were scrolling</em> - here the next item edge - critically damped so it
    settles without a harsh bounce. Direction matters: a small nudge up snaps up,
    not back down. Never scroll-jacking: it only acts on release. Scroll the list a
    little either way and let go.</p>`,
  code: `const scroll = createScroll({ scroller })
const item = 92

scroll.snap({
  to: (p, direction) => {                               // next item edge, in the scroll direction
    const max = scroller.scrollHeight - scroller.clientHeight
    const i = (p * max) / item
    return ((direction > 0 ? Math.ceil(i) : Math.floor(i)) * item) / max
  },
  onSnap: (p) => { status.textContent = 'snapped' },
})`,
  run(ctx) {
    const { box, rail } = scroller('scroller__rail scroller__rail--flush')
    const item = 92
    for (let i = 0; i < 6; i += 1) {
      rail.append(h('div', { class: 'snapitem' }, h('span', { class: 'snapitem__n' }, String(i + 1))))
    }
    const status = h('span', { class: 'snapstatus' }, 'scroll, then release')
    ctx.stage.append(h('div', { class: 'scrollcol' }, box, status))

    const scroll = createScroll({ scroller: box })
    // Next item edge in the travel direction (ceil downward, floor upward), so an
    // up-nudge snaps up instead of falling back to the nearest edge below.
    const stop = (p: number, direction: 1 | -1): number => {
      const max = box.scrollHeight - box.clientHeight
      if (max <= 0) return p
      const i = (p * max) / item
      return ((direction > 0 ? Math.ceil(i) : Math.floor(i)) * item) / max
    }
    scroll.snap({
      to: stop,
      spring: { stiffness: 90 },
      onSnap: (p) => {
        const max = box.scrollHeight - box.clientHeight
        status.textContent = `snapped to ${Math.round((p * max) / item) + 1}`
      },
    })
    ctx.onCleanup(() => scroll.dispose())
  },
}

export const scrollTrack: Section = {
  id: 'scroll-track',
  group: 'Scroll',
  title: 'track()',
  tagline: 'The raw 0..1 primitive every builder composes from.',
  description: `
    <p>Under the sugar is one value: a <code>Track</code> is normalized progress
    over a range, deduped so it only fires when the clamped value moves. Read
    <code>progress()</code> synchronously or subscribe with <code>on()</code>; hand
    it to <code>scrub({ track })</code> to nest animations, or just render the
    number. Everything above - scrub, parallax, pin, snap - is built on it.</p>`,
  code: `const scroll = createScroll({ scroller })

const t = scroll.track()              // whole-scroller progress
t.on((p) => {
  fill.style.transform = \`scaleX(\${p})\`
  label.textContent = \`\${Math.round(p * 100)}%\`
})`,
  run(ctx) {
    const { box, rail } = scroller('scroller__rail scroller__rail--tall')
    rail.append(h('div', { class: 'scroller__filler' }))

    const fill = h('div', { class: 'meter__fill' })
    const label = h('span', { class: 'meter__label' }, '0%')
    const meter = h('div', { class: 'meter' }, h('div', { class: 'meter__track' }, fill), label)
    ctx.stage.append(h('div', { class: 'scrollcol' }, box, meter))

    const scroll = createScroll({ scroller: box })
    const t = scroll.track()
    t.on((p) => {
      fill.style.transform = `scaleX(${p})`
      label.textContent = `${Math.round(p * 100)}%`
    })
    ctx.onCleanup(() => scroll.dispose())
  },
}
