import { animate, prefersReducedMotion, setReducedMotionBehavior, setReducedMotionOverride } from '@underlying/core'
import { button, dropdown, h, toggle, type Section } from '../showcase'

export const reducedMotion: Section = {
  id: 'reduced-motion',
  group: 'Accessibility',
  title: 'Reduced motion',
  tagline: 'Respected with zero config - skip, fade, or allow.',
  description: `
    <p><code>prefers-reduced-motion</code> is honored out of the box: animations
    fast-forward to their exact rest state. The strategy is configurable -
    <strong>skip</strong> snaps everything, <strong>fade</strong> keeps opacity and
    colors animating while movement snaps (vestibular-safe), <strong>allow</strong>
    plays in full for essential motion. Toggle the simulation and compare: under
    <em>fade</em> the box's color still crossfades while its travel snaps.</p>`,
  code: `import { setReducedMotionBehavior, setReducedMotionOverride } from '@underlying/core'

setReducedMotionBehavior('fade')     // movement snaps, color still animates
setReducedMotionOverride(true)       // app-level toggle (null = follow the OS)

animate(box, { x: 160, backgroundColor: '#10b981' })`,
  api: `setReducedMotionBehavior('skip' | 'fade' | 'allow'): void
setReducedMotionOverride(value: boolean | null): void
prefersReducedMotion(): boolean`,
  run(ctx) {
    const box = h('div', { class: 'obj obj--chip' })
    const status = h('div', { class: 'demo__note' }, '')
    ctx.stage.append(h('div', { style: 'position:absolute;inset:18px;display:flex;align-items:center' }, box), status)

    const refresh = () => {
      status.textContent = `reduced-motion: ${prefersReducedMotion() ? 'ACTIVE' : 'inactive'}`
    }
    refresh()

    let out = false
    ctx.controls.append(
      toggle('simulate reduced-motion', (checked) => {
        setReducedMotionOverride(checked ? true : null)
        refresh()
      }),
      dropdown('strategy', [
        { value: 'skip', label: 'skip' },
        { value: 'fade', label: 'fade' },
        { value: 'allow', label: 'allow' },
      ], (value) => setReducedMotionBehavior(value as 'skip' | 'fade' | 'allow')),
      button('animate', () => {
        out = !out
        animate(box, out
          ? { x: 160, backgroundColor: '#10b981' }
          : { x: 0, backgroundColor: '#2952e8' })
      }),
    )

    // Leave the override cleared when navigating away.
    ctx.onCleanup(() => setReducedMotionOverride(null))
  },
  noReplay: true,
}
