<p align="center">
  <img alt="underlying" src="https://underlyi.ng/wordmark-sapin.svg" width="280" />
</p>

<p align="center">
  <strong>Drag, fling and interruptible FLIP - on live physics.</strong>
</p>

<p align="center">
  <a href="https://underlyi.ng"><img alt="docs" src="https://img.shields.io/badge/docs-underlyi.ng-1C3426" /></a>
  <img alt="gestures gzip" src="https://img.shields.io/badge/gestures-~1.5%20kB%20gzip-1C3426" />
  <img alt="built on" src="https://img.shields.io/badge/built%20on-%40underlying%2Fcore-1C3426" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-1C3426" />
</p>

> Beta. The API may still move before 1.0.

Pointer gestures and layout transitions for [`@underlying/core`](https://github.com/underlyingjs/underlying/tree/main/packages/core). The hard part of both is the handoff: at release a gesture's velocity must flow into the motion seamlessly, and a layout transition you interrupt must keep its momentum. Because every value in core carries its velocity, both are one argument away.

```sh
npm install @underlying/gestures @underlying/core
```

## `draggable()`

Make an element draggable. During the drag the offset teleports to the pointer while a tracker watches; on release the pointer velocity is handed straight into a spring or an inertial glide - the chip flies on the momentum you gave it, never a jump.

```ts
import { draggable } from '@underlying/gestures'

const drag = draggable(card, {
  axis: 'both',          // 'x' | 'y' | 'both'
  bounds: viewport,      // an element to stay inside, or { x: [min, max], y: [min, max] }
  release: 'inertia',    // 'inertia' (glide + rubber-band) | 'spring' (back to origin) | 'free'
})

drag.x // an Animatable - read it, retarget it, bind it elsewhere
drag.dispose()
```

The x/y offsets are plain `Animatable`s, so a drag composes with everything else: spring one to a snap point, feed it into a `follow()`, read its velocity.

## `flip()`

FLIP done physics-first. Measure the elements, mutate the DOM however you like, and they spring to their new places - overshoot and all, because the play is a real spring, not a baked curve.

```ts
import { flip } from '@underlying/gestures'

flip(grid.children, () => {
  shuffle(grid)          // reorder, resize, add or remove nodes
}, { stiffness: 320, damping: 26 })
```

The point is interruption: call `flip()` again while items are still moving and each one retargets **from its live position and velocity**. The motion bends into the new layout instead of restarting - something a baked FLIP can't do. Mash a shuffle button and watch it stay fluid.

## License

MIT (c) underlyi.ng
