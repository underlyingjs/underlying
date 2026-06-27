import '@underlying/utils/register' // registers wiggle / shake / slow / rough by string
import { animate, setStyle, type EasingInput } from '@underlying/core'
import { customEase, rough } from '@underlying/utils'
import { button, h, type Section } from '../showcase'

export const proceduralEases: Section = {
  id: 'procedural-eases',
  group: 'Value model',
  title: 'Custom & procedural eases',
  tagline: 'A design-tool curve verbatim, plus a real shake, a seeded glitch, a slow middle.',
  description: `
    <p>Beyond the named families, <code>@underlying/utils</code> builds eases from a curve
    or generates them. <strong>shake</strong> / <strong>wiggle</strong> are a real damped
    oscillator - the value overshoots then settles, like a struck string, not a canned sine.
    <strong>rough</strong> is a seeded glitch: the same seed draws the same flicker every
    time, so it is SSR-stable. <strong>slow</strong> lingers through the middle.
    <strong>design curve</strong> takes a path exported from a design tool and uses it
    verbatim - <code>customEase('M0,0 C0.4,0 0.2,1 1,1')</code> - no DOM, no hand re-tuning.</p>`,
  code: `import '@underlying/utils/register'
import { customEase, rough } from '@underlying/utils'
import { animate } from '@underlying/core'

animate(card, { x: 0, opacity: 1 }, { duration: 1000, easing: 'shake(6)' })
animate(card, { opacity: 1 }, { easing: rough({ seed: 7, taper: 'out' }) })
animate(panel, { y: 0 }, { easing: customEase('M0,0 C0.4,0 0.2,1 1,1') })`,
  api: `customEase(source: string | Array<[x, y]>): Easing   // an SVG path or points, verbatim, DOM-free
wiggle(count?, { decay?, wave? }): Easing             // a damped oscillator; shake = a buzzier preset
rough({ points?, amplitude?, seed?, taper?, smooth?, base? }): Easing   // seeded, reproducible glitch
slow(linearRatio?, power?): Easing                    // fast in, slow middle, fast out
// string forms: 'wiggle(6)', 'shake(8)', 'slow(0.75, 0.85)', 'rough(24, 0.3, 7)'`,
  run(ctx) {
    const card = h('div', { class: 'ease__card' }, 'shake(6)')
    ctx.stage.append(card)

    const play = (label: string, easing: EasingInput): void => {
      card.textContent = label
      setStyle(card, { x: -132, opacity: 0 })
      animate(card, { x: 0, opacity: 1 }, { duration: 1000, easing })
    }

    ctx.controls.append(
      button('shake', () => play('shake(6)', 'shake(6)')),
      button('wiggle', () => play('wiggle(4)', 'wiggle(4)')),
      button('slow', () => play('slow', 'slow(0.7, 0.85)')),
      button('rough', () => play('rough', rough({ seed: 7, taper: 'out', amplitude: 0.35 }))),
      button('design curve', () => play('customEase', customEase('M0,0 C0.4,0 0.2,1 1,1'))),
    )
  },
}
