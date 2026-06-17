<div align="center">

# @underlying/flip

**Layout and shared-element transitions, physics-first.**

</div>

Animate an element from its old place to its new one - both position and size - by measuring its box before and after a DOM change and springing the difference away. The play is a real spring, so it is interruptible: change the layout again mid-flight and each element retargets from its live position and velocity, bending into the new layout instead of restarting. Built on [`@underlying/core`](https://github.com/underlyingjs/underlying/tree/main/packages/core); 0.86 kB gzip on top of it (full surface, core marked external).

```bash
npm install @underlying/core @underlying/flip
```

## Layout: `flip(targets, mutate)`

Wrap any DOM change. `flip` measures First, runs your mutation, measures Last, applies the inverse transform so nothing jumps, then springs to identity.

```ts
import { flip } from '@underlying/flip'

// reorder, filter, resize - the tiles spring to their new places
flip(tiles, () => grid.append(...reordered), { stiffness: 320, damping: 26 })

// position AND size: a grid <-> list toggle resizes every tile smoothly
flip(tiles, () => grid.classList.toggle('list'))
```

By default it inverts position and size (translate + scale, pinned to the top-left). Pass `{ scale: false }` for position-only FLIP - the element translates from old place to new but is never scaled, so its box keeps its natural dimensions throughout. Use it when the size does not change, or when a child should not be squashed by a parent's scale:

```ts
// reorder a list: the rows move, but each row keeps its own height
flip(rows, () => list.prepend(rows[2]), { scale: false, stiffness: 320, damping: 26 })
```

## Shared element: `snapshot()` + `play()`

When the old and new elements are different DOM nodes (a thumbnail expanding into a detail view, a route change), capture the old set, change the DOM, then play the new set from the captured boxes - matched by `data-flip-id`.

```ts
import { snapshot, play } from '@underlying/flip'

const state = snapshot(thumbnails)   // data-flip-id on each
// ... navigate / re-render: the detail view mounts ...
play(state, { targets: detailEls, stiffness: 260, damping: 24 })
```

A target with no matching key in the snapshot is left alone.

## Interruption

Every `flip()` / `play()` retargets from the live spring, velocity conserved - press the button again while the tiles are still moving and the motion redirects, never restarts. That is the whole point.

## Options and types

`FlipTargets` is what every entry point accepts: a single `HTMLElement` or any `Iterable<HTMLElement>` (an array, a `NodeList`, a `Set`).

```ts
type FlipTargets = HTMLElement | Iterable<HTMLElement>
```

`FlipOptions` extends the core `SpringOptions` (`stiffness`, `damping`, `mass`, ...) - those tune the spring that carries each element home - plus two flip-specific fields:

```ts
interface FlipOptions extends SpringOptions {
  scale?: boolean      // invert size too (scale), not only position. Default true.
  scheduler?: Scheduler
}
```

`play()` takes a `FlipPlayOptions` instead: the same `FlipOptions`, with the new elements to animate passed in as `targets` (matched to the snapshot by `data-flip-id`).

```ts
interface FlipPlayOptions extends FlipOptions {
  targets: FlipTargets   // the new elements to play from the captured boxes
}
```

`snapshot()` returns a `FlipSnapshot`: an opaque, read-only capture of each target's box, keyed by its `data-flip-id` (or the element itself when no id is set). Hold it across the DOM change, then hand it to `play()`.

```ts
interface FlipSnapshot {
  readonly boxes: ReadonlyMap<string | HTMLElement, Box>
}
```

## License

MIT (c) underlyi.ng
