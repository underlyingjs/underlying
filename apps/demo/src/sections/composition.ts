import { animate, chain, stagger } from '@underlying/core'
import { button, h, type Section } from '../showcase'

export const composition: Section = {
  id: 'composition',
  group: 'Composition',
  title: 'Stagger & chain',
  tagline: 'Cascades by index, and strict one-after-another chains.',
  description: `
    <p><code>stagger</code> starts the same animation on each item, offset by a
    fixed delay - a cascade. <code>chain</code> runs steps strictly in order,
    each starting only when the previous one has rested. Both return a single
    handle: <code>finished</code> resolves at the end, <code>stop()</code> cancels
    the rest. Delays run on the frame clock, so a background tab pauses them too.</p>`,
  code: `import { animate, stagger, chain } from '@underlying/core'

stagger(dots, (dot) => animate(dot, { y: -26 }), 70)   // 70ms between each

chain([
  () => animate(bar1, { x: 180 }),
  () => animate(bar2, { x: 180 }),   // waits for bar1 to rest
  () => animate(bar3, { x: 180 }),
])`,
  api: `stagger<T>(items: T[], animation: (item: T, i: number) => AnimationHandle,
  delayMs?: number): AnimationHandle
chain(steps: Array<() => AnimationHandle>): AnimationHandle`,
  run(ctx) {
    const dotsRow = h('div', { style: 'display:flex;gap:9px;height:46px;align-items:flex-end' })
    const dots = Array.from({ length: 8 }, () => h('div', { class: 'obj obj--dot' }))
    for (const dot of dots) dotsRow.append(dot)

    const barsCol = h('div', { style: 'display:flex;flex-direction:column;gap:6px' })
    const bars = Array.from({ length: 3 }, () => h('div', { class: 'obj obj--bar', style: 'width:44px;height:10px' }))
    for (const bar of bars) barsCol.append(bar)

    ctx.stage.append(h('div', { style: 'display:flex;gap:40px;align-items:center' }, dotsRow, barsCol))

    ctx.controls.append(
      button('stagger', () =>
        chain([
          () => stagger(dots, (dot) => animate(dot, { y: -26 }, { stiffness: 380, damping: 13 }), 70),
          () => stagger(dots, (dot) => animate(dot, { y: 0 }, { stiffness: 380, damping: 13 }), 70),
        ]),
      ),
      button('chain', () =>
        chain([
          ...bars.map((bar) => () => animate(bar, { x: 120 }, { stiffness: 320, damping: 22 })),
          ...bars.slice().reverse().map((bar) => () => animate(bar, { x: 0 }, { stiffness: 320, damping: 22 })),
        ]),
      ),
    )
  },
  noReplay: true,
}
