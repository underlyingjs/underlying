import '@underlying/utils/register' // registers the named eases so strings resolve
import { animate, setStyle } from '@underlying/core'
import { button, h, type Section } from '../showcase'

export const namedEases: Section = {
  id: 'named-eases',
  group: 'Value model',
  title: 'Named eases',
  tagline: 'Paste a named ease by string - the card enters with that exact curve.',
  description: `
    <p>For <em>baked</em> motion (a timed tween, a scrubbable timeline) you still want named
    eases. <code>@underlying/utils</code> brings the full set - <code>power1-4</code>,
    <code>back</code>, <code>elastic</code>, <code>bounce</code>, <code>steps</code>,
    <code>cubicBezier</code> - resolvable by string after
    <code>import '@underlying/utils/register'</code>. Pick one and the card replays its
    entrance with that curve: see <code>back</code> overshoot, <code>elastic</code> wobble,
    <code>bounce</code> land. (For <em>live</em> motion a spring already gives you this,
    physically - this layer is for ports and timelines.)</p>`,
  code: `import '@underlying/utils/register'
import { animate } from '@underlying/core'

animate(card, { x: 0, opacity: 1 }, { duration: 900, easing: 'elastic.out(1, 0.6)' })
animate(card, { y: 0 }, { duration: 600, easing: 'back.out(2)' })`,
  api: `interface EaseFamily { in: Easing; out: Easing; inOut: Easing }   // Easing = (t: number) => number
// fixed: power1-4 (= quad/cubic/quart/quint), sine, expo, circ, bounce, none (linear)
// configurable: back(overshoot?), elastic(amplitude?, period?), steps(count), cubicBezier(x1, y1, x2, y2)
registerEases(): void   // run by the '@underlying/utils/register' entry; resolves the names by string`,
  run(ctx) {
    const card = h('div', { class: 'ease__card' }, 'power2.out')
    ctx.stage.append(card)

    const play = (name: string): void => {
      card.textContent = name.replace(/\(.*\)/, '') // short label, no params - fits one line
      setStyle(card, { x: -132, opacity: 0 })
      animate(card, { x: 0, opacity: 1 }, { duration: 900, easing: name })
    }

    ctx.controls.append(
      button('power2.out', () => play('power2.out')),
      button('back.out', () => play('back.out(2)')),
      button('elastic.out', () => play('elastic.out(1, 0.6)')),
      button('bounce.out', () => play('bounce.out')),
    )
  },
}
