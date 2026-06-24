import { animate, region, setStyle, staggerDelay, type StaggerOrigin } from '@underlying/core'
import { button, h, type Section } from '../showcase'

// ---- Expressive stagger: a center-out grid reveal -------------------------

export const staggerGrid: Section = {
  id: 'authoring-stagger-grid',
  group: 'Authoring',
  title: 'staggerDelay()',
  tagline: 'A wave with an origin, a 2D grid, an axis, and an easing - one line for a gallery entrance.',
  description: `
    <p>The signature portfolio gallery reveal: a grid of cards that ripples in from
    the <em>center</em> as you scroll to it. <code>staggerDelay()</code> turns the
    item index and count into a delay - choose the origin (start / end / center /
    edges / random / a specific index), propagate across a 2D grid by cell distance,
    restrict to an axis, and redistribute through an easing. Pick an origin, then
    replay.</p>`,
  code: `import { animate, staggerDelay } from '@underlying/core'

animate('.card', { opacity: [0, 1], scale: [0.6, 1] }, {
  duration: 520,
  delay: staggerDelay({ each: 55, from: 'center', grid: { cols: 5 }, ease: 'power2.out' }),
})`,
  api: `staggerDelay(options?: {
  each?: number; from?: 'start'|'end'|'center'|'edges'|'random'|number
  start?: number; grid?: { cols: number; rows?: number }; axis?: 'x'|'y'; ease?; seed?
}): (index: number, total: number) => number`,
  run(ctx) {
    const COLS = 5
    const cells = Array.from({ length: 20 }, () => h('div', { class: 'gridcell' }))
    const grid = h('div', { class: 'authgrid' }, ...cells)
    ctx.stage.append(grid)

    const replay = (from: StaggerOrigin): void => {
      for (const cell of cells) setStyle(cell, { opacity: 0, scale: 0.5 })
      animate(
        cells,
        { opacity: 1, scale: 1 },
        { duration: 520, delay: staggerDelay({ each: 55, from, grid: { cols: COLS }, ease: 'power2.out' }) },
      )
    }
    ctx.onCleanup(() => animate(cells, { opacity: 1, scale: 1 }, { duration: 0 }))
    replay('center')

    for (const origin of ['center', 'edges', 'start', 'end', 'random'] as const) {
      ctx.controls.append(button(origin, () => replay(origin)))
    }
  },
}

// ---- Multi-target: a nav hover wave ---------------------------------------

export const hoverWave: Section = {
  id: 'authoring-hover-wave',
  group: 'Authoring',
  title: 'Multi-target animate()',
  tagline: 'One call, one handle for a whole set - a hover ripple that radiates from the pointer.',
  description: `
    <p>Pass an array, a <code>NodeList</code>, or a selector string and one
    <code>animate()</code> drives the whole set, returning a single interruptible
    handle. Here a nav row lifts in a wave that starts at the link you hover and
    radiates outward (<code>from: index</code>); leaving settles it back, live, no
    restart. The recognizable agency-nav micro-interaction in two calls.</p>`,
  code: `// one handle for the whole row, wave origin = the hovered index
links.forEach((link, i) => link.addEventListener('pointerenter', () =>
  animate(links, { y: -10 }, { delay: staggerDelay({ each: 28, from: i }), stiffness: 420 })))

row.addEventListener('pointerleave', () => animate(links, { y: 0 }))`,
  api: `animate(target: HTMLElement | HTMLElement[] | NodeList | string,
  targets, options?): AnimationHandle   // one handle for the set`,
  run(ctx) {
    const labels = ['Work', 'Studio', 'Process', 'Journal', 'Contact']
    const links = labels.map((label) => h('a', { class: 'navlink', href: '#' }, label))
    const row = h('nav', { class: 'navrow' }, ...links)
    ctx.stage.append(row)

    links.forEach((link, i) => {
      link.addEventListener('pointerenter', () =>
        animate(links, { y: -10 }, { delay: staggerDelay({ each: 28, from: i }), stiffness: 420, damping: 18 }),
      )
      link.addEventListener('click', (event) => event.preventDefault())
    })
    row.addEventListener('pointerleave', () => animate(links, { y: 0 }, { stiffness: 420, damping: 26 }))
    ctx.onCleanup(() => animate(links, { y: 0 }, { duration: 0 }))
  },
}

// ---- Relative + function values: a card fan-out ---------------------------

export const relativeFanout: Section = {
  id: 'authoring-relative-function',
  group: 'Authoring',
  title: 'Relative & function values',
  tagline: 'Per-index function values fan a deck; a relative target nudges from the live value.',
  description: `
    <p>A value can be a <em>function</em> of the item - <code>(index, element,
    count)</code> - so a deck fans out with one call, each card placed by its index.
    And a <em>relative</em> target like <code>'+=120'</code> resolves against the
    current value, so a Nudge button springs from wherever each card is right now,
    interrupt-safe on repeated clicks. Both stay physics-first.</p>`,
  code: `// per-index fan-out
animate(cards, {
  x: (i, _el, n) => (i - (n - 1) / 2) * 46,
  rotate: (i, _el, n) => (i - (n - 1) / 2) * 6,
}, { stiffness: 260, damping: 20 })

// relative nudge: springs from the live position
animate(cards, { x: '+=120' })`,
  api: `type ValueFn<V> = (index: number, element: HTMLElement, total: number) => V
// '+=100' | '-=100' | '*=2' resolve against the current value`,
  run(ctx) {
    const cards = Array.from({ length: 5 }, (_, i) => h('div', { class: 'fancard' }, String(i + 1)))
    const deck = h('div', { class: 'fandeck' }, ...cards)
    ctx.stage.append(deck)

    const fan = (): void =>
      void animate(
        cards,
        { x: (i, _el, n) => (i - (n - 1) / 2) * 46, rotate: (i, _el, n) => (i - (n - 1) / 2) * 6 },
        { stiffness: 260, damping: 20 },
      )
    const gather = (): void => void animate(cards, { x: 0, rotate: 0 }, { stiffness: 260, damping: 22 })
    const nudge = (): void => void animate(cards, { x: '+=70' }, { stiffness: 320, damping: 18 })

    ctx.onCleanup(() => animate(cards, { x: 0, rotate: 0 }, { duration: 0 }))
    ctx.controls.append(button('fan out', fan), button('nudge +70', nudge), button('gather', gather))
  },
}

// ---- Region + responsive: the framework teardown seam ---------------------

export const regionTeardown: Section = {
  id: 'authoring-region',
  group: 'Authoring',
  title: 'region() & responsive()',
  tagline: 'Mount a scene, revert it all at once - the seam a framework adapter mounts on.',
  description: `
    <p>A <code>region()</code> collects everything created inside it - animations,
    a <code>responsive()</code> breakpoint setup - and <code>revert()</code> undoes
    it all at once: stops the motion, removes the media listeners, releases the
    inline styles. That is exactly the mount/unmount lifetime a React, Vue, or Svelte
    adapter needs. Mount the scene, watch the live log, then unmount.</p>`,
  code: `const scene = region((r) => {
  r.animate('.panel', { opacity: [0, 1], y: ['16px', '0px'] }, { delay: staggerDelay({ each: 90 }) })
  r.responsive('(min-width: 720px)', () => {
    const h = r.animate('.sidebar', { x: ['-40px', '0px'] })
    return () => h.stop()
  })
})

// on unmount - stops everything, removes listeners, releases styles
scene.revert()`,
  api: `region(setup?): { animate; stagger; responsive; setStyle; add; track; revert }
responsive(query | { reducedMotion }, setup): () => void`,
  run(ctx) {
    const panels = Array.from({ length: 4 }, () => h('div', { class: 'panel' }))
    const stageRow = h('div', { class: 'panelrow' }, ...panels)
    const logEl = h('ul', { class: 'authlog' })
    ctx.stage.append(h('div', { class: 'authwrap' }, stageRow, logEl))

    const log = (text: string, kind: string): void => {
      logEl.prepend(h('li', { class: `authline authline--${kind}` }, text))
      while (logEl.children.length > 6) logEl.lastChild?.remove()
    }

    let scene: ReturnType<typeof region> | null = null
    const mount = (): void => {
      if (scene !== null) return
      for (const panel of panels) setStyle(panel, { opacity: 0, y: 16 })
      scene = region((r) => {
        r.animate(panels, { opacity: 1, y: 0 }, { delay: staggerDelay({ each: 90 }), stiffness: 320, damping: 24 })
        log('mounted scene + staggered reveal', 'mount')
        r.responsive('(min-width: 720px)', ({ matches }) => {
          log(`responsive active (>=720px: ${matches})`, 'resp')
          return () => log('responsive torn down', 'resp')
        })
        r.add(() => log('cleanup ran', 'revert'))
      })
    }
    const unmount = (): void => {
      if (scene === null) return
      scene.revert() // stops animations, removes the media listener, releases styles
      scene = null
      log('reverted: stopped + released', 'revert')
    }
    ctx.onCleanup(() => {
      unmount()
      animate(panels, { opacity: 1, y: 0 }, { duration: 0 })
    })
    ctx.controls.append(button('mount', mount), button('unmount', unmount))
  },
}
