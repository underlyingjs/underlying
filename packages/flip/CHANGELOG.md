# @underlying/flip

## 1.2.0-beta.7

### Patch Changes

- @underlying/core@1.2.0-beta.7

## 1.2.0-beta.6

### Minor Changes

- 1760eaf: `reorder()` - drag-to-reorder for lists and grids (#69).

  ```ts
  import { reorder } from "@underlying/flip";

  const list = reorder(container, {
    axis: "y", // 'y' (default) | 'x' | 'both' (a wrapping grid)
    handle: ".grip", // optional: only start a drag from this element
    onReorder: ({ item, from, to, order }) => save(order),
  });
  ```

  Drag an item (or its `handle`) and the displaced siblings FLIP-animate to their new
  slots; on drop the dragged item springs into place. Built on `flip()`: each reorder
  measures the siblings, mutates the DOM order, and springs them, while the dragged
  item is kept under the pointer across the mutation. `onReorder` reports every order
  change (each live swap and the drop). `axis` supports vertical / horizontal lists
  and 2D grids. Physics-first and interruptible - grab another item mid-settle.

  `moveItem()` and `computeTargetIndex()` (the pure geometry behind it) are exported
  too. `reorder()` tree-shakes out of the `flip()`/`play()`/`snapshot()` path.

### Patch Changes

- @underlying/core@1.2.0-beta.6

## 1.2.0-beta.5

### Patch Changes

- Updated dependencies [fb77271]
  - @underlying/core@1.2.0-beta.5

## 1.2.0-beta.4

### Patch Changes

- @underlying/core@1.2.0-beta.4

## 1.2.0-beta.3

### Patch Changes

- Updated dependencies [7aafc87]
- Updated dependencies [5bebad9]
  - @underlying/core@1.2.0-beta.3

## 1.2.0-beta.2

### Patch Changes

- @underlying/core@1.2.0-beta.2

## 1.2.0-beta.1

### Minor Changes

- 2f6f36e: `flipGroup()` - automatic layout, shared-element, and enter/exit transitions for a container, all on the interruptible flip spring (#55):

  ```ts
  const group = flipGroup(list);

  group.flip(() => reorder(list)); // auto-FLIP: every survivor springs to its new box
  group.add(row); // enter
  group.remove(row, { mode: "pop" }); // exit: the gap closes instantly while the row springs out on top
  ```

  - **Auto-FLIP** - `group.flip(mutate)` brackets a layout edit and springs every affected child from its old box to its new one, so a reorder/insert/resize animates with one call, no manual snapshot.
  - **Presence (enter / exit)** - `add()` springs a new node in; `remove()` keeps the node mounted until its exit spring settles, then detaches it. Modes: `sync` (overlap), `wait` (the enter holds until the exit finishes), `pop` (the exiting node leaves layout flow so the rest reflows immediately while it animates out). A re-add mid-exit retargets the live springs and cancels the removal - it bends back, never restarts.
  - **Shared-element** - two nodes that share a `data-flip-id` animate one from the other's box across mount/unmount and across containers, so a thumbnail flies into a detail hero with no crossfade.

  Held still under reduced motion (it settles straight to the final layout, no jump). The existing `flip()` / `snapshot()` / `play()` are unchanged, and a consumer that imports only those still tree-shakes the controller away.

### Patch Changes

- @underlying/core@1.2.0-beta.1

## 1.2.0-beta.0

### Patch Changes

- @underlying/core@1.2.0-beta.0

## 1.1.0

### Patch Changes

- Updated dependencies [7733826]
- Updated dependencies [786aca7]
- Updated dependencies [cf994f5]
- Updated dependencies [3f85820]
  - @underlying/core@1.1.0

## 1.1.0-beta.4

### Patch Changes

- Updated dependencies [7733826]
- Updated dependencies [786aca7]
- Updated dependencies [cf994f5]
- Updated dependencies [3f85820]
  - @underlying/core@1.1.0-beta.4

## 1.1.0-beta.3

### Patch Changes

- @underlying/core@1.1.0-beta.3

## 1.1.0-beta.2

### Patch Changes

- @underlying/core@1.1.0-beta.2

## 1.1.0-beta.1

### Patch Changes

- @underlying/core@1.1.0-beta.1

## 1.1.0-beta.0

### Patch Changes

- @underlying/core@1.1.0-beta.0

## 1.0.0

- First stable release. `flip()` inverts position and size in one pass and springs to identity, interruptibly; `snapshot()`/`play()` for shared-element transitions. Leaving beta: the API is frozen and the @underlying suite now versions together.

## 0.1.0-beta.1

### Minor Changes

- b88136b: Initial beta of `@underlying/flip`: layout and shared-element transitions on the live physics of `@underlying/core`. `flip(targets, mutate)` measures each element's box before and after a DOM change and springs it from old to new - both position AND size (translate + scale, pinned to the top-left) - so nothing jumps. `snapshot(targets)` + `play(snapshot, { targets })` do the same across two different DOM states matched by `data-flip-id`, for shared-element and route transitions. The play is a spring, not a baked tween: call it again mid-flight and each element retargets from its live position and velocity, so the motion bends into the new layout instead of restarting. About 0.9 kB gzip on top of core.
