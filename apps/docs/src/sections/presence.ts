import { flipGroup } from '@underlying/flip'
import { button, h, type Section } from '../showcase'

const LABELS = [
  'Deploy finished',
  'New comment from Mara',
  'Build #418 passed',
  'Invite accepted',
  'Payment received',
  'Backup complete',
]

export const presenceList: Section = {
  id: 'flip-presence',
  group: 'Drag & FLIP',
  title: 'flipGroup()',
  tagline: 'Add, remove and reorder a list - every change is physical, and survives spamming.',
  description: `
    <p><code>flipGroup()</code> wraps a container so add / remove / reorder are all
    springs on one engine. <strong>Add</strong> springs a row in; <strong>Shuffle</strong>
    auto-FLIPs every row to its new place (<code>group.flip(reorder)</code>); the
    <strong>&times;</strong> removes a row in <em>pop</em> mode - the gap closes
    instantly while the row springs out on top. Mash the buttons: each motion bends
    from its live velocity, never restarts. Held still under reduced motion.</p>`,
  code: `import { flipGroup } from '@underlying/flip'

const group = flipGroup(list)
group.add(row, { enter: { opacity: 0, y: -14 } })   // enter
group.flip(() => reorder(list))                     // auto-FLIP every survivor
group.remove(row, { mode: 'pop', exit: { x: 40 } }) // exit; the gap closes immediately`,
  api: `flipGroup(container, options?): FlipGroup
interface FlipGroup {
  flip(mutate?): FlipHandle            // auto-FLIP the survivors of a layout edit
  add(node, options?): FlipHandle      // enter (+ shared-element by data-flip-id)
  remove(node, options?): FlipHandle   // exit: keep mounted, detach once it settles
  dispose(): void
}
interface PresenceOptions { mode?: 'sync' | 'wait' | 'pop'; enter?: PresenceState; exit?: PresenceState }`,
  run(ctx) {
    const list = h('ul', { class: 'plist' })
    ctx.stage.append(list)
    const group = flipGroup(list, { stiffness: 340, damping: 30 })

    let n = 0
    const makeRow = (): HTMLElement => {
      const id = ++n
      const del = h('button', { class: 'plist__del' }, '×')
      del.setAttribute('aria-label', 'Dismiss')
      const row = h(
        'li',
        { class: 'plist__row' },
        h('span', { class: 'plist__dot' }),
        h('span', { class: 'plist__text' }, LABELS[id % LABELS.length]!),
        del,
      )
      del.addEventListener('click', () => group.remove(row, { mode: 'pop', exit: { opacity: 0, x: 40 } }))
      return row
    }
    const add = (): void => {
      const row = makeRow()
      list.append(row)
      group.add(row, { enter: { opacity: 0, y: -14 } })
    }
    for (let i = 0; i < 4; i++) add()

    const shuffle = (): void => {
      const kids = Array.from(list.children)
      for (let i = kids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = kids[i]!
        kids[i] = kids[j]!
        kids[j] = tmp
      }
      group.flip(() => kids.forEach((k) => list.append(k)))
    }

    ctx.controls.append(button('Add', add), button('Shuffle', shuffle))
    ctx.onCleanup(() => {
      group.dispose()
      list.remove()
    })
  },
}
