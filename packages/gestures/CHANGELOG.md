# @underlying/gestures

## 1.2.0-beta.2

### Patch Changes

- @underlying/core@1.2.0-beta.2

## 1.2.0-beta.1

### Minor Changes

- 419d16c: `ambient()` - perpetual idle/ambient self-animation, so nothing on the page ever sits perfectly still (#58). One call makes an element subtly alive on live springs (never a baked keyframe loop):

  ```ts
  ambient(logo); // breathe + drift on by default
  ambient(hero, { breathe: { scale: 0.06 } }); // a slow breathing accent
  ```

  Four composable behaviors, each a perpetual physics simulation summed into one transform: `breathe` (a breathing sine on scale, optionally opacity), `drift` (a phase-offset orbital x/y Lissajous), `bob` (a gentle vertical float), and `wander` - the headline: pass an array and the group shares one field of slowly-roaming attractor points, so the elements wander as a living constellation when the pointer is idle and **bend into pointer-parallax with velocity conserved** when it moves, drifting back off after a moment of stillness:

  ```ts
  const field = ambient(dots, { wander: { radius: 50, parallax: 30 } });
  ```

  A per-element seed phase-offsets every behavior so a group never moves in lockstep, the whole field shares one pointer listener and one clock, and it is held completely still under `prefers-reduced-motion` (two-way) - self-motion still runs on touch, only the pointer-parallax half is fine-pointer-only. The composed `x` / `y` / `scale` / `opacity` are live values you can read and compose, like `depth()`.

### Patch Changes

- @underlying/core@1.2.0-beta.1

## 1.2.0-beta.0

### Patch Changes

- @underlying/core@1.2.0-beta.0

## 1.1.0

### Minor Changes

- 639ab9f: `cursor()` - a custom cursor that trails the real pointer with spring lag and flips to an active state over interactive targets. `cursor(options?)` drops a `<div class="cursor">` on the body (or drives one you pass), positions it with a follow spring so it lags slightly behind the pointer, and toggles `cursor--active` whenever the pointer is over a `targets` selector - links, buttons, whatever you name. The library only moves it; you give it its look through `.cursor` / `.cursor--active` CSS, so it stays a primitive rather than a theme. It rides the same shared pointer listener as `magnetic()` (one window listener for both) and starts where the cursor already is instead of swooping in from the origin. Off on touch and held hidden under reduced motion - the native cursor stays. The third of the pointer-reactive primitives.
- f7d1982: `depth()` - pointer-driven depth parallax. `depth(element, options?)` drifts a layer by a fraction of the pointer's offset from a frame centre, chased by a spring; stack several layers with ascending `shift` and they read as depth - a 2.5D effect through plain transforms, no 3D engine. Each layer is interruptible and eases home when the pointer leaves the window. Options: `shift` (travel in px at the frame edge; sign sets direction), `axis` (lock to one axis to spend one spring instead of two), `invert` (move with or against the pointer), `frame` (`'viewport'` or an element, re-read each move so a scrolled hero stays correct), `clamp`, `spring`. Like `draggable`'s `x` / `y`, the offset is exposed as live `Animatable`s. Layers share the same pointer listener as `magnetic()` and `cursor()`. Off on touch and held flat under reduced motion. The fourth of the pointer-reactive primitives - build a whole hero by calling it once per layer with rising `shift`.
- 321707e: `interactive()` - declarative hover / press state animations, the declarative side of the pointer set. `interactive(element, { hover, press })` names a `hover` and/or `press` target (any `bindStyle` channel - `scale`, `x`, `y`, `rotate`, `opacity`, ...) and the element springs to it on pointer-over or keyboard focus (hover) and while pressed or Enter/Space is held (press), springing back on release - interruptible, never a restart. Press wins over hover **per channel**, so a press that only nudges `y` keeps the hover `scale`. Keyboard parity (focus = hover, Enter/Space = press) and emulated-touch-hover filtering (a tap is a press, not a hover) are built in; `state()` reports `'rest'` / `'hover'` / `'press'`. Snaps instead of springing under reduced motion. Implements #50.
- 77e3c3f: `magnetic()` - a pointer-reactive magnetic pull. `magnetic(element, options?)` pulls an element toward the cursor once it comes within range, the element following a fraction of the cursor's offset chased by a spring, then springing home when the cursor leaves - interruptible, never a restart. Options for `radius` and `strength`. Like `draggable`'s `x` / `y`, the offset is exposed as live `Animatable`s (`m.x` / `m.y`). A shared window pointer listener keeps many magnetic elements cheap. Off on touch and held home under reduced motion. The second of the pointer-reactive primitives.
- 2aab60d: `quickTo()` - an imperative fast setter. `quickTo(element, channel, options?)` binds one (or two) of an element's transform channels to a spring once, then returns a plain function you call every frame to retarget it. Each call re-aims the spring in place without rebuilding it, so it stays cheap in a hot handler. Where `cursor()` and `magnetic()` wire their own input, `quickTo()` is the escape hatch - you bring the handler and the mapping, it brings the physics. Pass two channels together (`['x', 'y']`) to drive both through one `bindStyle` without the transform clobbering. The single-channel form exposes the live `value`, the pair form exposes `values`; options are `from` and `spring`. Under reduced motion the value snaps to its target instead of springing, so motion is removed but tracking stays. Closes the pointer-reactive set: `tilt`, `magnetic`, `cursor`, `depth`, and now the fast setter that drives them all.
- c521e0d: `tilt()` - a pointer-reactive 3D tilt. `tilt(element, options?)` maps the cursor's position over an element to two rotations a spring chases, so the card follows your cursor live and eases back to flat when you leave - interruptible, never a restart. Options for `max` degrees, `perspective`, a hover `scale` lift, and `reverse`. Like `draggable`'s `x` / `y`, the rotations are live `Animatable`s (`t.rotateX` / `t.rotateY`) you can read, bind elsewhere, or compose. Off on touch and held flat under reduced motion. The first of the pointer-reactive primitives.

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

### Minor Changes

- 321707e: `interactive()` - declarative hover / press state animations, the declarative side of the pointer set. `interactive(element, { hover, press })` names a `hover` and/or `press` target (any `bindStyle` channel - `scale`, `x`, `y`, `rotate`, `opacity`, ...) and the element springs to it on pointer-over or keyboard focus (hover) and while pressed or Enter/Space is held (press), springing back on release - interruptible, never a restart. Press wins over hover **per channel**, so a press that only nudges `y` keeps the hover `scale`. Keyboard parity (focus = hover, Enter/Space = press) and emulated-touch-hover filtering (a tap is a press, not a hover) are built in; `state()` reports `'rest'` / `'hover'` / `'press'`. Snaps instead of springing under reduced motion. Implements #50.

### Patch Changes

- @underlying/core@1.1.0-beta.3

## 1.1.0-beta.2

### Patch Changes

- @underlying/core@1.1.0-beta.2

## 1.1.0-beta.1

### Minor Changes

- 639ab9f: `cursor()` - a custom cursor that trails the real pointer with spring lag and flips to an active state over interactive targets. `cursor(options?)` drops a `<div class="cursor">` on the body (or drives one you pass), positions it with a follow spring so it lags slightly behind the pointer, and toggles `cursor--active` whenever the pointer is over a `targets` selector - links, buttons, whatever you name. The library only moves it; you give it its look through `.cursor` / `.cursor--active` CSS, so it stays a primitive rather than a theme. It rides the same shared pointer listener as `magnetic()` (one window listener for both) and starts where the cursor already is instead of swooping in from the origin. Off on touch and held hidden under reduced motion - the native cursor stays. The third of the pointer-reactive primitives.
- f7d1982: `depth()` - pointer-driven depth parallax. `depth(element, options?)` drifts a layer by a fraction of the pointer's offset from a frame centre, chased by a spring; stack several layers with ascending `shift` and they read as depth - a 2.5D effect through plain transforms, no 3D engine. Each layer is interruptible and eases home when the pointer leaves the window. Options: `shift` (travel in px at the frame edge; sign sets direction), `axis` (lock to one axis to spend one spring instead of two), `invert` (move with or against the pointer), `frame` (`'viewport'` or an element, re-read each move so a scrolled hero stays correct), `clamp`, `spring`. Like `draggable`'s `x` / `y`, the offset is exposed as live `Animatable`s. Layers share the same pointer listener as `magnetic()` and `cursor()`. Off on touch and held flat under reduced motion. The fourth of the pointer-reactive primitives - build a whole hero by calling it once per layer with rising `shift`.
- 77e3c3f: `magnetic()` - a pointer-reactive magnetic pull. `magnetic(element, options?)` pulls an element toward the cursor once it comes within range, the element following a fraction of the cursor's offset chased by a spring, then springing home when the cursor leaves - interruptible, never a restart. Options for `radius` and `strength`. Like `draggable`'s `x` / `y`, the offset is exposed as live `Animatable`s (`m.x` / `m.y`). A shared window pointer listener keeps many magnetic elements cheap. Off on touch and held home under reduced motion. The second of the pointer-reactive primitives.
- 2aab60d: `quickTo()` - an imperative fast setter. `quickTo(element, channel, options?)` binds one (or two) of an element's transform channels to a spring once, then returns a plain function you call every frame to retarget it. Each call re-aims the spring in place without rebuilding it, so it stays cheap in a hot handler. Where `cursor()` and `magnetic()` wire their own input, `quickTo()` is the escape hatch - you bring the handler and the mapping, it brings the physics. Pass two channels together (`['x', 'y']`) to drive both through one `bindStyle` without the transform clobbering. The single-channel form exposes the live `value`, the pair form exposes `values`; options are `from` and `spring`. Under reduced motion the value snaps to its target instead of springing, so motion is removed but tracking stays. Closes the pointer-reactive set: `tilt`, `magnetic`, `cursor`, `depth`, and now the fast setter that drives them all.
- c521e0d: `tilt()` - a pointer-reactive 3D tilt. `tilt(element, options?)` maps the cursor's position over an element to two rotations a spring chases, so the card follows your cursor live and eases back to flat when you leave - interruptible, never a restart. Options for `max` degrees, `perspective`, a hover `scale` lift, and `reverse`. Like `draggable`'s `x` / `y`, the rotations are live `Animatable`s (`t.rotateX` / `t.rotateY`) you can read, bind elsewhere, or compose. Off on touch and held flat under reduced motion. The first of the pointer-reactive primitives.

### Patch Changes

- @underlying/core@1.1.0-beta.1

## 1.1.0-beta.0

### Patch Changes

- @underlying/core@1.1.0-beta.0

## 1.0.0

- First stable release. `draggable()` (momentum snap, edge resistance, axis lock) and `observe()` (unified wheel/pointer/touch). Note: the translate-only `flip()` was removed - use `@underlying/flip`. Leaving beta: the API is frozen and the @underlying suite now versions together.

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
