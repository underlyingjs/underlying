import { animatable, bindStyle, easeOutCubic, type Animatable } from '@underlying/core'
import { playable, sequence, type Sequence } from '@underlying/core/playback'
import { createScroll } from '@underlying/scroll'
import { timeline, type Timeline } from '@underlying/timeline'
import { button, h, slider, type DemoContext, type Section } from '../showcase'

interface Card {
  card: HTMLElement
  cardOp: Animatable
  cardS: Animatable
  avatarS: Animatable
  rowOps: Animatable[]
  rowYs: Animatable[]
}

// The shared profile card every demo on this page drives: an avatar, a name,
// two bios and a Follow button. Each channel is a plain animatable, so the same
// card can be revealed by a timeline (scrubbed) or a sequence (interrupted).
function profileCard(
  ctx: DemoContext,
  init: { cardOp: number; cardS: number; avatarS: number; rowOp: number; rowY: number },
): Card {
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

  const cardOp = animatable(init.cardOp)
  const cardS = animatable(init.cardS)
  const avatarS = animatable(init.avatarS)
  const rows = [name, sub, bio1, bio2, follow]
  const rowOps = rows.map(() => animatable(init.rowOp))
  const rowYs = rows.map(() => animatable(init.rowY))
  ctx.onCleanup(bindStyle(card, { opacity: cardOp, scale: cardS }))
  ctx.onCleanup(bindStyle(avatar, { scale: avatarS }))
  rows.forEach((r, i) => ctx.onCleanup(bindStyle(r, { opacity: rowOps[i]!, y: rowYs[i]! })))
  return { card, cardOp, cardS, avatarS, rowOps, rowYs }
}

// The reveal as ONE timeline (card fade+pop, avatar spring, staggered rows).
function revealCard(ctx: DemoContext): { card: HTMLElement; tl: Timeline } {
  const { card, cardOp, cardS, avatarS, rowOps, rowYs } = profileCard(ctx, {
    cardOp: 0,
    cardS: 0.95,
    avatarS: 0,
    rowOp: 0,
    rowY: 10,
  })

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
    // Sync the slider WHILE the timeline self-animates (mount / replay / reverse),
    // then let the rAF sleep - polling tl.progress() every frame forever pegs the CPU.
    let raf = 0
    let lastPct = -1
    let still = 0
    const sync = (): void => {
      raf = 0
      if (range !== null && document.activeElement !== range) {
        const pct = Math.round(tl.progress() * 100)
        if (pct !== lastPct) {
          lastPct = pct
          range.value = String(pct)
          if (valueOut !== null) valueOut.textContent = String(pct)
          still = 0
        } else {
          still += 1
        }
      }
      if (still < 12) raf = requestAnimationFrame(sync) // stop ~0.2s after it stops moving
    }
    const startSync = (): void => {
      still = 0
      lastPct = -1
      if (raf === 0) raf = requestAnimationFrame(sync)
    }
    ctx.onCleanup(() => {
      if (raf !== 0) cancelAnimationFrame(raf)
    })

    ctx.controls.append(
      button('replay', () => {
        tl.seek(0).play()
        startSync()
      }),
      button('reverse', () => {
        tl.reverse()
        startSync()
      }),
      scrubber,
    )
    // Show the card already revealed - no animation on mount, which would compete
    // with the visitor's first scroll. The replay button plays the reveal on demand.
    tl.progress(1)
    if (range !== null) range.value = '100'
    if (valueOut !== null) valueOut.textContent = '100'
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

// Smoothed pointer velocity in px/s over a ~50 ms window (mirrors the gestures demo).
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
  read(timeMs: number): number {
    return timeMs - this.lastTimeMs > 80 ? 0 : this.value
  }
}

interface Chip {
  el: HTMLElement
  x: Animatable
  y: Animatable
  vx: VelocityTracker
  vy: VelocityTracker
  dragging: boolean
  grabX: number
  grabY: number
}

export const sequenceInterrupt: Section = {
  id: 'sequence-interrupt',
  group: 'Timeline',
  title: 'sequence()',
  tagline: 'Fling the pieces, then gather them - the live twin you interrupt by hand.',
  description: `
    <p>Five chips, one live formation. Grab any chip and <strong>fling</strong> it:
    it leaves on the exact velocity your hand gave it and glides to a stop - your hand
    is the interruption. Then hit <strong>gather</strong> and a <code>sequence()</code>
    (from <code>@underlying/core/playback</code>) sweeps them back into a row, one after
    another, overshooting into place. Grab one <em>while</em> it gathers and it pops out
    to follow you - the sequence yields, because every chip is a live spring, not a baked
    frame. That is the difference from a timeline: you do not scrub this, you interrupt it.</p>`,
  code: `import { sequence } from '@underlying/core/playback'

// fling: on release, the glide inherits the pointer's velocity (bounded by the edges)
chip.x.decay({ velocity: releaseVx, min: 0, max: width })

// gather: a live cascade you can grab mid-flight
const gather = () => sequence()
  .spring(a.x, homeAx).spring(a.y, homeAy, { overlap: 0 })
  .spring(b.x, homeBx, { overlap: 70 })   // 70 ms after the previous leg starts
  /* ...the rest of the row... */ .play()`,
  run(ctx) {
    const CHIP = 40
    const N = 5
    const field = h('div', { style: 'position:absolute;inset:0;touch-action:none' })
    ctx.stage.append(field)

    const chips: Chip[] = Array.from({ length: N }, () => {
      const el = h('div', {
        class: 'obj obj--chip',
        style: `position:absolute;left:0;top:0;width:${CHIP}px;height:${CHIP}px;cursor:grab;touch-action:none`,
      })
      field.append(el)
      const chip: Chip = {
        el,
        x: animatable(0),
        y: animatable(0),
        vx: new VelocityTracker(),
        vy: new VelocityTracker(),
        dragging: false,
        grabX: 0,
        grabY: 0,
      }
      ctx.onCleanup(bindStyle(el, { x: chip.x, y: chip.y }))
      return chip
    })

    const homeOf = (i: number): { x: number; y: number } => {
      const r = field.getBoundingClientRect()
      const gap = 12
      const totalW = N * CHIP + (N - 1) * gap
      return { x: (r.width - totalW) / 2 + i * (CHIP + gap), y: r.height / 2 - CHIP / 2 }
    }

    // gather: one live sequence, a 70 ms cascade home. Grabbing a chip stop()s it.
    let current: Sequence | null = null
    const gather = (): void => {
      current?.stop()
      const s = sequence()
      chips.forEach((c, i) => {
        c.x.stop() // kill any in-flight glide so the sequence can take the value over cleanly
        c.y.stop()
        const home = homeOf(i)
        s.spring(c.x, home.x, { overlap: i === 0 ? 0 : 70, stiffness: 260, damping: 16 })
        s.spring(c.y, home.y, { overlap: 0, stiffness: 260, damping: 16 })
      })
      current = s
      s.play()
    }
    // scatter (for non-draggers): fling each chip on bounded inertia, like a flick.
    const scatter = (): void => {
      current?.stop()
      const r = field.getBoundingClientRect()
      chips.forEach((c, i) => {
        c.x.stop()
        c.y.stop()
        c.x.decay({ velocity: (i - (N - 1) / 2) * 540, min: 0, max: r.width - CHIP })
        c.y.decay({ velocity: i % 2 === 0 ? -780 : 780, min: 0, max: r.height - CHIP })
      })
    }

    for (const c of chips) {
      c.el.addEventListener('pointerdown', (e) => {
        current?.stop() // grabbing yields the gather cascade
        c.x.stop()
        c.y.stop()
        c.dragging = true
        c.el.setPointerCapture(e.pointerId)
        c.el.style.cursor = 'grabbing'
        const box = field.getBoundingClientRect()
        c.grabX = e.clientX - box.left - c.x.get()
        c.grabY = e.clientY - box.top - c.y.get()
        c.vx.start(c.x.get(), e.timeStamp)
        c.vy.start(c.y.get(), e.timeStamp)
      })
      c.el.addEventListener('pointermove', (e) => {
        if (!c.dragging) return
        const box = field.getBoundingClientRect()
        const nx = e.clientX - box.left - c.grabX
        const ny = e.clientY - box.top - c.grabY
        c.x.set(nx)
        c.y.set(ny)
        c.vx.sample(nx, e.timeStamp)
        c.vy.sample(ny, e.timeStamp)
      })
      c.el.addEventListener('pointerup', (e) => {
        if (!c.dragging) return
        c.dragging = false
        c.el.style.cursor = 'grab'
        const box = field.getBoundingClientRect()
        // release into a glide that inherits the fling velocity, bounded by the edges
        c.x.decay({ velocity: c.vx.read(e.timeStamp), min: 0, max: box.width - CHIP })
        c.y.decay({ velocity: c.vy.read(e.timeStamp), min: 0, max: box.height - CHIP })
      })
    }
    ctx.onCleanup(() => current?.stop())

    // Place the chips in their row statically - no deal-in animation on mount, which
    // would run below the fold and compete with the visitor's first scroll.
    chips.forEach((c, i) => {
      const home = homeOf(i)
      c.x.set(home.x)
      c.y.set(home.y)
    })

    ctx.controls.append(button('scatter', scatter), button('gather', gather))
  },
  noReplay: true,
}
