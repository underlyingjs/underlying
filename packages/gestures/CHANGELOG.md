# @underlying/gestures

## 0.1.0-beta.6

### Minor Changes

- 95db229: Draggable snap, axis lock, edge resistance, and a unified Observer. `draggable()` gains four options: `snap` (per-axis targets - an increment, explicit stops, or a resolver) that on release projects where the flick's momentum would land and springs to the nearest target, so a gentle drag steps one and a hard flick skips several; `liveSnap` to snap while dragging instead; `edgeResistance` (0..1) to rubber-band the pull past the bounds during the drag (0 = free, 1 = a hard wall); and `lockAxis` to commit to the dominant direction once a `'both'` drag clears a few pixels. New `observe()` unifies wheel, trackpad, pointer, and touch into one normalized stream - per-event deltas, accumulated totals, smoothed velocity, a dominant axis - fed to directional callbacks (`onUp`/`onDown`/`onLeft`/`onRight`), a catch-all `onChange`, the raw `onWheel`/`onDrag`/`onPress`/`onRelease`, and a debounced `onStop`, with a tolerance dead-zone, a `dragMinimum`, an axis filter, and `preventDefault`. It is the seam under scroll-jacking, swipe nav, and design-tool number scrubbing; Pointer Events cover mouse, touch, and pen so a drag works the same on every device. A draggable with none of the new options behaves exactly as before.

### Patch Changes

- Updated dependencies [c4dd1e9]
  - @underlying/core@0.1.0-beta.6

## 0.1.0-beta.5

### Patch Changes

- Updated dependencies [a27ed4d]
  - @underlying/core@0.1.0-beta.5

## 0.1.0-beta.4

### Patch Changes

- Updated dependencies [bf6b019]
  - @underlying/core@0.1.0-beta.4

## 0.1.0-beta.3

### Patch Changes

- Updated dependencies [ec2d1de]
  - @underlying/core@0.1.0-beta.3

## 0.1.0-beta.2

### Patch Changes

- ab29bac: Republish for provenance. `0.1.0-beta.1` was published by hand during the package bootstrap, so - unlike the rest of the family - it shipped without a SLSA provenance attestation. It installs correctly (its `@underlying/core` dependency is a resolved version, not a raw `workspace:*`), so it is not deprecated: this release is the same surface, rebuilt and published by CI over OIDC so it carries provenance like core, scroll, timeline and text.

## 0.1.0-beta.1

### Minor Changes

- e06302f: Initial beta of `@underlying/gestures`: drag, fling, and interruptible FLIP, all on the live physics of `@underlying/core`.

  - `draggable(element, options)` makes an element draggable and hands the pointer's velocity straight into the release - an inertial glide (with rubber-band bounds) or a spring back to the origin, momentum preserved in one argument, never a jump. Axis lock, bounds (an element to stay inside, or explicit ranges, re-measured on each grab), and the x/y offsets exposed as live `Animatable`s you can read or retarget.
  - `flip(targets, mutate, options)` is FLIP done physics-first: measure, run your DOM mutation, invert so nothing jumps, then spring - not a baked tween - to the new layout. Because the play is a spring, calling `flip()` again mid-flight retargets from the live position AND velocity: the motion bends into the new layout instead of restarting. That interruptibility is what a baked FLIP cannot do.

  ~1.5 kB gzip on top of core. Built entirely on `@underlying/core`'s value layer (animatables, springs, decay) - no new engine.
