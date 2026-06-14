import { draggable, flip } from '@underlying/gestures'
import { button, h, type Section } from '../showcase'

export const dragPlayground: Section = {
  id: 'drag-playground',
  group: 'Drag & FLIP',
  title: 'draggable()',
  tagline: 'Fling it - the pointer velocity flows straight into the glide.',
  description: `
    <p>One call makes the card draggable. During the drag the offset follows your
    pointer; on release the velocity you gave it is handed into an inertial glide
    that rubber-bands at the panel edges - momentum preserved, never a jump.
    Spring-back and free modes are one option away, and the x/y offsets are plain
    animatables you can read or retarget.</p>`,
  code: `import { draggable } from '@underlying/gestures'

draggable(card, { bounds: panel, release: 'inertia' })  // grab, fling, glide`,
  run(ctx) {
    const field = h('div', { class: 'dragfield' })
    const card = h('div', { class: 'dragcard' }, 'drag me')
    field.append(card)
    ctx.stage.append(field)

    const drag = draggable(card, { bounds: field, release: 'inertia' })
    ctx.onCleanup(() => drag.dispose())
  },
  noReplay: true,
}

export const flipShuffle: Section = {
  id: 'flip-shuffle',
  group: 'Drag & FLIP',
  title: 'flip()',
  tagline: 'Physics-first FLIP - mash shuffle and it stays fluid.',
  description: `
    <p>Reorder the grid and the tiles spring to their new places - overshoot and
    all, because the play is a real spring, not a baked curve. The point is
    interruption: hit <strong>shuffle</strong> again while they are still moving
    and each tile retargets <em>from its live position and velocity</em>. The
    motion bends into the new layout instead of restarting - a baked FLIP can't
    do that. The whole choreography is <code>getBoundingClientRect</code> +
    <code>@underlying/core</code> springs.</p>`,
  code: `import { flip } from '@underlying/gestures'

shuffleBtn.onclick = () =>
  flip(tiles, () => reorder(grid), { stiffness: 320, damping: 26 })`,
  run(ctx) {
    const grid = h('div', { class: 'flipgrid' })
    const tiles = Array.from({ length: 9 }, (_, i) => h('div', { class: 'flipgrid__item' }, String(i + 1)))
    for (const tile of tiles) grid.append(tile)
    ctx.stage.append(grid)

    const shuffle = (): void => {
      flip(tiles, () => {
        for (const tile of [...tiles].sort(() => Math.random() - 0.5)) grid.append(tile)
      }, { stiffness: 320, damping: 26 })
    }
    ctx.controls.append(button('shuffle', shuffle))
  },
  noReplay: true,
}
