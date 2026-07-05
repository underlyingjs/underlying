# @underlying/svg

## 1.2.1

### Patch Changes

- @underlying/core@1.2.1

## 1.2.0

### Minor Changes

- e236e15: Harden `morphCommands()` past the v1 pipeline (#46). No API change - the same
  command-preserving morph, now robust on shapes it used to reject or handle poorly.

  - **Arcs.** Elliptical arc commands (`A`/`a`) convert to cubic beziers (endpoint
    -> center, split into <=90 degree segments) instead of throwing. The flag-aware
    parser also reads packed arc flags (`A5 5 0 0110 10`).
  - **Arc-length subdivision.** When matching two shapes' segment counts, the sparser
    one is split by ARC LENGTH at each segment's arc-length midpoint, not by chord at
    the parametric midpoint - so a curvy segment that folds back is divided fairly.
  - **Normalized correspondence.** Closed rings are aligned (rotation + winding) on
    centroid/scale-normalized anchors, so a large difference in size or position no
    longer swamps the rotational match and spin/inside-out flips it.
  - **Similarity subpath matching.** Multi-piece shapes pair each subpath to its most
    similar counterpart (centroid + area), not by authoring order. Surplus pieces
    collapse to / grow from their own centroid point, so an extra piece shrinks away
    or appears cleanly instead of being padded with an unrelated shape.

  As-rigid-as-possible interpolation is still deferred; `morph()` (resampling) remains
  the fallback for arbitrary shapes where corner preservation does not matter.

### Patch Changes

- Updated dependencies [fb77271]
- Updated dependencies [7aafc87]
- Updated dependencies [5bebad9]
  - @underlying/core@1.2.0

## 1.2.0-beta.8

### Patch Changes

- @underlying/core@1.2.0-beta.8

## 1.2.0-beta.7

### Patch Changes

- @underlying/core@1.2.0-beta.7

## 1.2.0-beta.6

### Patch Changes

- @underlying/core@1.2.0-beta.6

## 1.2.0-beta.5

### Patch Changes

- Updated dependencies [fb77271]
  - @underlying/core@1.2.0-beta.5

## 1.2.0-beta.4

### Minor Changes

- e236e15: Harden `morphCommands()` past the v1 pipeline (#46). No API change - the same
  command-preserving morph, now robust on shapes it used to reject or handle poorly.

  - **Arcs.** Elliptical arc commands (`A`/`a`) convert to cubic beziers (endpoint
    -> center, split into <=90 degree segments) instead of throwing. The flag-aware
    parser also reads packed arc flags (`A5 5 0 0110 10`).
  - **Arc-length subdivision.** When matching two shapes' segment counts, the sparser
    one is split by ARC LENGTH at each segment's arc-length midpoint, not by chord at
    the parametric midpoint - so a curvy segment that folds back is divided fairly.
  - **Normalized correspondence.** Closed rings are aligned (rotation + winding) on
    centroid/scale-normalized anchors, so a large difference in size or position no
    longer swamps the rotational match and spin/inside-out flips it.
  - **Similarity subpath matching.** Multi-piece shapes pair each subpath to its most
    similar counterpart (centroid + area), not by authoring order. Surplus pieces
    collapse to / grow from their own centroid point, so an extra piece shrinks away
    or appears cleanly instead of being padded with an unrelated shape.

  As-rigid-as-possible interpolation is still deferred; `morph()` (resampling) remains
  the fallback for arbitrary shapes where corner preservation does not matter.

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

- First stable release. `motionPath()`, `draw()`, `morph()` and command-preserving `morphCommands()` - each progress a live value you can flick, interrupt or scrub. Leaving beta: the API is frozen and the @underlying suite now versions together.

## 0.1.0-beta.5

### Minor Changes

- ff461d9: `morphCommands()` - a command-preserving morph. Where `morph()` resamples both outlines into a polyline (any two shapes, but corners soften), `morphCommands()` parses both `d` strings into cubic segments, subdivides the sparser shape with de Casteljau so anchors map to anchors (original corners stay sharp), aligns closed rings by rotation and winding so the shape settles into place instead of spinning, and interpolates each anchor and control - real curves with crisp corners. The fraction is the same live Animatable: spring it, scrub it, grab it mid-morph; `revert()` restores the original `d`. Elliptical arcs (`A`) are not supported - use `morph()` for those or for arbitrary shapes. It ships as a separate export, so it tree-shakes away when you only use `morph()`.

## 0.1.0-beta.4

### Patch Changes

- Updated dependencies [c4dd1e9]
  - @underlying/core@0.1.0-beta.6

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
