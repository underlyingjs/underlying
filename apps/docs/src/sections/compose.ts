import { bindTemplate, prefersReducedMotion, template } from '@underlying/core'
import { follow } from '@underlying/core/playback'
import { h, type Section } from '../showcase'

export const composedStyles: Section = {
  id: 'compose-template',
  group: 'Composed styles',
  title: 'bindTemplate() & template()',
  tagline: 'Compose several live springs into one CSS string, written to any property each frame.',
  description: `
    <p>The award-style hero treatment: a card whose <code>filter</code> and a
    <code>--sheen</code> custom property are each driven by several independent
    springs. <code>template</code> reads byte-for-byte like the CSS it emits - the
    interpolations are live values (an <code>animatable</code>, a <code>follow()</code>),
    the literals carry the units. <code>bindTemplate</code> writes the composed
    string to any property through the same change-gated render phase as
    <code>animate()</code> - one write per frame, quiet at rest. Move the cursor:
    the card focuses and brightens toward it, the sheen sweeps with it.</p>`,
  code: `import { bindTemplate, template } from '@underlying/core'
import { follow } from '@underlying/core/playback'

const blur = follow(8), glow = follow(0.85), angle = follow(0)

bindTemplate(hero, 'filter', template\`blur(\${blur}px) brightness(\${glow})\`)
bindTemplate(sheen, '--sheen', template\`\${angle}deg\`)

hero.addEventListener('pointermove', (e) => {
  const { proximity, nx } = measure(e)   // 0..1 from cursor to center
  blur.target((1 - proximity) * 8)       // sharp at the center
  glow.target(0.85 + proximity * 0.5)    // brighter near the cursor
  angle.target(nx * 360)                 // sheen sweeps with pointer x
})`,
  api: `template\`...\${source}...\`: StyleTemplate      // source = animatable | follow()
bindTemplate(el, property, template, options?): () => void
bindTemplate(el, property, sources[], (...nums) => string, options?): () => void`,
  run(ctx) {
    const sheen = h('div', { class: 'composehero__sheen' })
    const label = h('div', { class: 'composehero__label' }, 'hover to focus')
    const hero = h('div', { class: 'composehero' }, sheen, label)
    ctx.stage.append(hero)

    // A pointer-coupled source is not time-driven, so honor reduced motion by
    // holding the hero sharp and bright with no live wiring.
    if (prefersReducedMotion()) {
      hero.style.filter = 'blur(0px) brightness(1.1)'
      return
    }

    const blur = follow(8, { stiffness: 140, damping: 22 })
    const glow = follow(0.85, { stiffness: 140, damping: 22 })
    const angle = follow(0, { stiffness: 90, damping: 20 })

    ctx.onCleanup(bindTemplate(hero, 'filter', template`blur(${blur}px) brightness(${glow})`))
    ctx.onCleanup(bindTemplate(sheen, '--sheen', template`${angle}deg`))
    ctx.onCleanup(() => {
      blur.dispose()
      glow.dispose()
      angle.dispose()
    })

    hero.addEventListener('pointermove', (event) => {
      const rect = hero.getBoundingClientRect()
      const nx = (event.clientX - rect.left) / rect.width
      const ny = (event.clientY - rect.top) / rect.height
      const dist = Math.min(1, Math.hypot(nx - 0.5, ny - 0.5) / 0.5)
      const proximity = 1 - dist
      blur.target(dist * 8) // sharp at the center, blurred toward the edges
      glow.target(0.85 + proximity * 0.5) // brighter near the cursor
      angle.target(nx * 360) // sheen sweeps with pointer x
    })
    hero.addEventListener('pointerleave', () => {
      blur.target(8)
      glow.target(0.85)
    })
  },
}
