# @underlying/timeline

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

- First stable release. Seekable timelines with labels and relative positions; the master is a scrubbable handle that @underlying/scroll can drive. Leaving beta: the API is frozen and the @underlying suite now versions together.

## 0.1.0-beta.6

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

- ec2d1de: `repeatDelay` now works. It was documented and exposed on `TimelineOptions`, but the loop only read `repeat`/`yoyo` and ignored it, so iterations restarted with no pause. The timeline now holds at the leg start for `repeatDelay` ms between iterations (matching core's playable). Also remove `paused` from `TimelineOptions`: the constructor always starts paused (you call `play()`), so the type no longer advertises an option it silently ignored.
- Updated dependencies [ec2d1de]
  - @underlying/core@0.1.0-beta.3

## 0.1.0-beta.2

### Patch Changes

- Updated dependencies [19501e6]
  - @underlying/core@0.1.0-beta.2

## 0.1.0-beta.1

### Minor Changes

- f563fff: Initial beta of `@underlying/timeline`: seekable, scrubbable timelines composed over the playback layer. The master IS a `PlaybackHandle` (kind:'timeline', seekable:true), so `@underlying/scroll` scrubs a whole timeline with zero special-casing.

  - **Authoring** - `to` / `from` / `fromTo` / `spring` / `decay` / `add` (nest a timeline) / `stagger` / `call` / `label` / `shiftCursor`, all chainable. Sequential clips on one value chain from the prior exit, velocity conserved at the seam.
  - **Position grammar** - absolute ms, labels, `<` / `>` (prev clip start/end), `<N` / `>N`, `+=N` / `-=N` (timeline-end relative), `label+=N`.
  - **Seekable for every case** - tweens are seekable from birth; spring/decay children are baked once at build (a never-resting one throws); the whole timeline gets a finite `duration()` that is never undefined. `seek(t)` / `progress(p)` fan synchronously to every child.
  - **Live clock** - `play` / `pause` / `timeScale` / `reverse` on one rAF subscription via `timeScope`; `repeat` / `yoyo` loop the whole timeline.
  - Lazy build (resolve + bake on first touch), SSR-safe, deterministic under the manual driver, ~3 kB gzip with the core marked external.

  Composed timeline motion is **physics-shaped but baked** (a recorded spring trajectory, not an eased curve) - the price of a seekable, reversible master. For live, interruptible single-value physics, use `@underlying/core` and `@underlying/scroll`'s momentum scrub.
