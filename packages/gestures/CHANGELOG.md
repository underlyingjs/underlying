# @underlying/gestures

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
