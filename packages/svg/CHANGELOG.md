# @underlying/svg

## 0.1.0-beta.3

### Patch Changes

- Updated dependencies [a27ed4d]
  - @underlying/core@0.1.0-beta.5

## 0.1.0-beta.2

### Patch Changes

- Updated dependencies [bf6b019]
  - @underlying/core@0.1.0-beta.4

## 0.1.0-beta.1

### Minor Changes

- d4206da: Initial beta of `@underlying/svg`: SVG path animation - ride a path, draw a stroke, and morph - on the live physics of `@underlying/core`. No new engine: it samples paths with the native `getPointAtLength`/`getTotalLength` and drives core's `animatable`, so the progress of each is a single interruptible value rather than a baked tween.

  - `motionPath(element, path, options)` rides an element along a path. Progress `t` is a live `Animatable`, so you can spring it, `flick()` it down the path and let inertia settle it, or retarget it mid-flight with velocity conserved - things a baked path tween cannot do. `autoRotate` turns the element to face along the tangent, and `.t` composes straight into `scroll.scrub` or a timeline.
  - `draw(path, options)` draws a stroke on (0 hidden, 1 drawn) via stroke-dasharray/offset, with the fraction a live `Animatable` too - it can overshoot, and you can interrupt it mid-draw. `revert()` restores the original dash properties.
  - `morph(element, target, options)` turns one path into another. Both outlines are resampled into points along their length and interpolated, so any two shapes morph (no matching the path commands by hand), and the morph fraction is a live `Animatable` you can scrub or grab mid-morph.
  - Layered, one implementation: `bindPath`/`bindDraw` (bring your own driver) and `samplePath` (low-level geometry) underneath; an `{ to }` option gives a familiar one-call form that still springs under the hood.

  Reduced motion is inherited from core (the driver auto-degrades to a jump). ~1.6 kB gzip on top of core. The morph resamples and interpolates outlines (any two shapes); a full command-preserving morph - sharp-corner fidelity, `shapeIndex` - is future work.

### Patch Changes

- Updated dependencies [ec2d1de]
  - @underlying/core@0.1.0-beta.3
