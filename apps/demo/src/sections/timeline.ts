import { animatable, bindStyle, easeOutCubic } from '@underlying/core'
import { playable } from '@underlying/core/playback'
import { createScroll } from '@underlying/scroll'
import { timeline, type Timeline } from '@underlying/timeline'
import { button, h, slider, type DemoContext, type Section } from '../showcase'

// The shared piece both demos drive: a profile card whose entrance is one
// timeline (card fade+pop, avatar spring, then a staggered name/bio/button).
function revealCard(ctx: DemoContext): { card: HTMLElement; tl: Timeline } {
  const avatar = h('div', { class: 'tlcard__avatar' })
  const name = h('div', { class: 'tlcard__name' }, 'Lina Mercier')
  const sub = h('div', { class: 'tlcard__sub' }, '@lina · springs only')
  const bio1 = h('div', { class: 'tlcard__text' }, 'Designs calm interfaces.')
  const bio2 = h('div', { class: 'tlcard__text' }, 'Everything moves on physics.')
  const follow = h('div', { class: 'tlcard__follow' }, 'Follow')
  const card = h('div', { class: 'tlcard' },
    h('div', { class: 'tlcard__head' }, avatar, h('div', { class: 'tlcard__id' }, name, sub)),
    bio1,
    bio2,
    follow,
  )

  const cardOp = animatable(0)
  const cardS = animatable(0.95)
  const avatarS = animatable(0)
  const rows = [name, sub, bio1, bio2, follow]
  const rowOps = rows.map(() => animatable(0))
  const rowYs = rows.map(() => animatable(10))
  ctx.onCleanup(bindStyle(card, { opacity: cardOp, scale: cardS }))
  ctx.onCleanup(bindStyle(avatar, { scale: avatarS }))
  rows.forEach((r, i) => ctx.onCleanup(bindStyle(r, { opacity: rowOps[i]!, y: rowYs[i]! })))

  const tl = timeline()
    .to(cardOp, 1, { at: 0, duration: 220, easing: easeOutCubic })
    .spring(cardS, 1, { at: '<', stiffness: 300, damping: 18 })
    .spring(avatarS, 1, { at: 120, stiffness: 280, damping: 13 })
    .stagger(rowOps, (o) => playable(o).to(1, { paused: true, duration: 260 }), { each: 70, at: '<+=80' })
    .stagger(rowYs, (y) => playable(y).spring(0, { paused: true, stiffness: 240, damping: 20 }), { each: 70, at: '<' })
  ctx.onCleanup(() => tl.stop())
  return { card, tl }
}

export const timelineChoreograph: Section = {
  id: 'timeline-reveal',
  group: 'Timeline',
  title: 'timeline()',
  tagline: 'Orchestrate a card entrance - then scrub the whole reveal.',
  description: `
    <p>A single animation you have already seen. A timeline is the <em>arrangement</em>:
    each verb drops a clip at a position, and the master plays or scrubs all of them as
    one. Here the card pops in, the avatar springs <code>&lt;</code> (with it), then the
    name, bio and button cascade in with a <code>stagger</code>. Drag the scrubber to run
    the whole reveal forward and backward; press <strong>replay</strong> to play it. Every
    moving thing on screen is this one timeline - nothing is a CSS animation.</p>`,
  code: `import { timeline } from '@underlying/timeline'

const tl = timeline()
  .to(card.opacity, 1, { duration: 220 })                // the card fades in
  .spring(card.scale, 1, { at: '<' })                    // ...with a subtle pop
  .spring(avatar.scale, 1, { at: 120 })                  // the avatar springs in
  .stagger(rows, (o) => playable(o).to(1, { paused: true }), { each: 70, at: '<+=80' }) // cascade

scrubber.addEventListener('input', () => tl.progress(scrubber.valueAsNumber / 100))`,
  run(ctx) {
    const { card, tl } = revealCard(ctx)
    ctx.stage.append(card)

    const scrubber = slider('progress', { min: 0, max: 100, value: 0, onInput: (v) => tl.progress(v / 100) })
    const range = scrubber.querySelector('input')
    const valueOut = scrubber.querySelector('.field__value')
    let raf = 0
    const tick = (): void => {
      if (range !== null && document.activeElement !== range) {
        const pct = String(Math.round(tl.progress() * 100))
        range.value = pct
        if (valueOut !== null) valueOut.textContent = pct
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    ctx.onCleanup(() => cancelAnimationFrame(raf))

    ctx.controls.append(button('replay', () => tl.seek(0).play()), button('reverse', () => tl.reverse()), scrubber)
    tl.play() // reveal on mount, rather than showing an empty stage
  },
  noReplay: true,
}

export const timelineScroll: Section = {
  id: 'timeline-scroll',
  group: 'Timeline',
  title: 'scroll x timeline',
  tagline: 'The master is a seekable handle, so scroll scrubs the whole timeline.',
  description: `
    <p>This is why the master <em>is</em> a <code>PlaybackHandle</code>. The same card
    reveal, but instead of a slider, scroll drives it: <code>@underlying/scroll</code>'s
    <code>scrub()</code> binds the timeline with zero special-casing (no bake at bind, no
    throw) and calls <code>progress(p)</code> as you scroll. Scroll the panel down and the
    card assembles; scroll back up and it disassembles - frame-exact, reversible. The same
    move pins a whole choreographed scene to the page scroll.</p>`,
  code: `import { createScroll } from '@underlying/scroll'

const scroll = createScroll({ scroller })
const tl = timeline().to(card.opacity, 1).spring(avatar.scale, 1, { at: '<' }) /* ... */

scroll.scrub(tl)   // locked: scroll position -> tl.progress(p), no special-casing`,
  run(ctx) {
    const { card, tl } = revealCard(ctx)
    const rail = h('div', { class: 'scroller__rail scroller__rail--tall' }, h('div', { class: 'tlsticky' }, card))
    const box = h('div', { class: 'scroller scroller--card' }, h('span', { class: 'scroller__hint' }, 'scroll inside'), rail)
    ctx.stage.append(box)

    const scroll = createScroll({ scroller: box })
    scroll.scrub(tl) // smooth:false (default): frame-exact, reversible
    ctx.onCleanup(() => scroll.dispose())
  },
  noReplay: true,
}
