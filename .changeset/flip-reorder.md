---
"@underlying/flip": minor
---

`reorder()` - drag-to-reorder for lists and grids (#69).

```ts
import { reorder } from '@underlying/flip'

const list = reorder(container, {
  axis: 'y',              // 'y' (default) | 'x' | 'both' (a wrapping grid)
  handle: '.grip',        // optional: only start a drag from this element
  onReorder: ({ item, from, to, order }) => save(order),
})
```

Drag an item (or its `handle`) and the displaced siblings FLIP-animate to their new
slots; on drop the dragged item springs into place. Built on `flip()`: each reorder
measures the siblings, mutates the DOM order, and springs them, while the dragged
item is kept under the pointer across the mutation. `onReorder` reports every order
change (each live swap and the drop). `axis` supports vertical / horizontal lists
and 2D grids. Physics-first and interruptible - grab another item mid-settle.

`moveItem()` and `computeTargetIndex()` (the pure geometry behind it) are exported
too. `reorder()` tree-shakes out of the `flip()`/`play()`/`snapshot()` path.
