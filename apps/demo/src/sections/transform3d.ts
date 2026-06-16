import { animate, setStyle } from '@underlying/core'
import { button, h, type Section } from '../showcase'

export const flip3d: Section = {
  id: 'transform-flip',
  group: 'Value model',
  title: '3D transforms',
  tagline: 'A flip card you would actually ship - and rotateY is live.',
  description: `
    <p>A real flip card: a profile on the front, its numbers on the back. It turns on
    <code>rotateY</code> - and because that is a live spring, <strong>press flip again
    mid-turn</strong> and the card bends back from its real velocity instead of queueing or
    restarting. The transform set now goes past x/y/scale/rotate: <code>rotateX/Y/Z</code>,
    <code>skewX/Y</code>, <code>scaleX/Y</code>, <code>perspective</code> - each just
    another interruptible <code>Animatable</code>.</p>`,
  code: `import { animate } from '@underlying/core'

// the scene holds the CSS perspective; the card is transform-style: preserve-3d
animate(card, { rotateY: 180 })   // a live spring - flip again mid-turn, it bends back`,
  run(ctx) {
    const card = h(
      'div',
      { class: 'flip__card' },
      h(
        'div',
        { class: 'flip__face flip__face--front' },
        h('div', { class: 'flip__avatar' }),
        h('div', { class: 'flip__name' }, 'Lina Mercier'),
        h('div', { class: 'flip__role' }, 'Design produit'),
      ),
      h(
        'div',
        { class: 'flip__face flip__face--back' },
        h('div', { class: 'flip__stat' }, '1.2k'),
        h('div', { class: 'flip__statlabel' }, 'abonnes  ·  48 projets'),
      ),
    )
    ctx.stage.append(h('div', { class: 'flip__scene' }, card))

    let flipped = false
    ctx.controls.append(
      button('flip', () => {
        flipped = !flipped
        animate(card, { rotateY: flipped ? 180 : 0 })
      }),
    )
  },
}

export const menuOrigin: Section = {
  id: 'transform-origin',
  group: 'Value model',
  title: 'transform-origin',
  tagline: 'A menu grows out of its button - because the pivot is anchored.',
  description: `
    <p>transform-origin is what makes a menu open <em>from its button</em> instead of
    blooming out of thin air. The panel scales in from <code>scale: 0</code>: with the
    origin in the <strong>corner</strong> it grows down out of the trigger (right); with the
    origin at the <strong>center</strong> it balloons from its own middle (wrong). The pivot
    is a live value too - <code>originX</code> / <code>originY</code> percentages.</p>`,
  code: `import { animate, setStyle } from '@underlying/core'

setStyle(menu, { originX: 0, originY: 0, scale: 0 })  // anchored to the corner, collapsed
animate(menu, { scale: 1, opacity: 1 })               // grows out of the button`,
  run(ctx) {
    const panel = h(
      'div',
      { class: 'menu__panel' },
      h('div', { class: 'menu__item' }, 'Profil'),
      h('div', { class: 'menu__item' }, 'Reglages'),
      h('div', { class: 'menu__item' }, 'Quitter'),
    )
    const menu = h(
      'div',
      { class: 'menu' },
      h('div', { class: 'menu__trigger' }, h('span', {}, 'Compte'), h('span', { class: 'menu__caret' }, '▾')),
      panel,
    )
    ctx.stage.append(menu)
    setStyle(panel, { scale: 0, opacity: 0 })

    // Slow + a touch springy so the growth direction is unmissable: the corner
    // pivot keeps the panel glued to the button, the centre pivot balloons it
    // from its own middle (detached). The end state is the same on purpose -
    // origin is about where it grows FROM.
    const GROW = { stiffness: 32, damping: 13 }
    const openFrom = (originX: number, originY: number): void => {
      setStyle(panel, { originX, originY, scale: 0, opacity: 0 })
      animate(panel, { scale: 1, opacity: 1 }, GROW)
    }
    ctx.controls.append(
      button('depuis le coin', () => openFrom(0, 0)),
      button('depuis le centre', () => openFrom(50, 50)),
      button('fermer', () => animate(panel, { scale: 0, opacity: 0 }, GROW)),
    )
  },
}
