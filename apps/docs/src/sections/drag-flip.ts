import { flip } from '@underlying/flip'
import { draggable } from '@underlying/gestures'
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
  api: `draggable(el: HTMLElement, options?: DraggableOptions): Draggable
interface DraggableOptions {
  axis?: 'x' | 'y' | 'both'; lockAxis?: boolean
  bounds?: HTMLElement | { x?: [number, number]; y?: [number, number] }
  snap?: { x?: SnapTo; y?: SnapTo }; liveSnap?: boolean; edgeResistance?: number
  release?: 'inertia' | 'spring' | 'free'  // default 'inertia'
  spring?: SpringOptions; decay?: DecayOptions
  onStart?(): void; onEnd?(velocity: { x: number; y: number }): void
}
interface Draggable { readonly x: Animatable; readonly y: Animatable; dispose(): void }`,
  run(ctx) {
    const field = h('div', { class: 'dragfield' })
    const card = h('div', { class: 'dragcard' }, 'drag me')
    field.append(card)
    ctx.stage.append(field)

    const drag = draggable(card, { bounds: field, release: 'inertia' })
    ctx.onCleanup(() => drag.dispose())
  },
}

const FLIP_SHADES = ['--sapin', '--sous-bois', '--lichen', '--mousse']

export const flipShuffle: Section = {
  id: 'flip-shuffle',
  group: 'Drag & FLIP',
  title: 'flip()',
  tagline: 'Measure, mutate, then spring position AND size - fluid even mid-flight.',
  description: `
    <p><code>@underlying/flip</code> measures each tile's box before and after a
    DOM change, then springs it from old to new - <em>both position and size</em>,
    overshoot and all, because the play is a real spring, not a baked curve.
    <strong>Shuffle</strong> reorders them; <strong>grid / list</strong> resizes
    them. The point is interruption: press a button again while they are still
    moving and each tile retargets <em>from its live position and velocity</em>,
    so the motion bends into the new layout instead of restarting.</p>`,
  code: `import { flip } from '@underlying/flip'

// wrap any DOM change - flip measures First/Last and springs position + size
flip(tiles, () => reorder(grid), { stiffness: 320, damping: 26 })
flip(tiles, () => grid.classList.toggle('list'), { stiffness: 300, damping: 28 })`,
  api: `flip(targets: FlipTargets, mutate: () => void, options?: FlipOptions): void
type FlipTargets = HTMLElement | Iterable<HTMLElement>
interface FlipOptions extends SpringOptions {
  scale?: boolean      // invert size too, not only position. Default true
  scheduler?: Scheduler
}`,
  run(ctx) {
    const grid = h('div', { class: 'flipgrid' })
    const tiles = Array.from({ length: 9 }, (_, i) =>
      h('div', { class: 'flipgrid__item', style: `background: var(${FLIP_SHADES[i % FLIP_SHADES.length] ?? '--sapin'})` }),
    )
    for (const tile of tiles) grid.append(tile)
    ctx.stage.append(grid)

    const shuffle = (): void => {
      flip(tiles, () => {
        for (const tile of [...tiles].sort(() => Math.random() - 0.5)) grid.append(tile)
      }, { stiffness: 320, damping: 26 })
    }
    let list = false
    const toggleView = (): void => {
      flip(tiles, () => {
        list = !list
        grid.classList.toggle('flipgrid--list', list)
      }, { stiffness: 300, damping: 28 })
    }
    ctx.controls.append(button('shuffle', shuffle), button('grid / list', toggleView))
  },
}
