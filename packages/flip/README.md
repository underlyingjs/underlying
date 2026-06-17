<div align="center">

# @underlying/flip

**Layout and shared-element transitions, physics-first.**

</div>

Animate an element from its old place to its new one - both position and size - by measuring its box before and after a DOM change and springing the difference away. The play is a real spring, so it is interruptible: change the layout again mid-flight and each element retargets from its live position and velocity, bending into the new layout instead of restarting. Built on [`@underlying/core`](https://github.com/underlyingjs/underlying/tree/main/packages/core); about 0.9 kB gzip on top of it.

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

By default it inverts position and size (translate + scale, pinned to the top-left). Pass `{ scale: false }` for position only.

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

## Options

`FlipOptions` extends the core `SpringOptions` (`stiffness`, `damping`, `mass`, ...) plus `scale?: boolean` and `scheduler?`.

## License

MIT (c) underlyi.ng
