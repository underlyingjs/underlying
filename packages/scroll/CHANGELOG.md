# @underlying/scroll

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

### Minor Changes

- 23bc99b: `marquee()` - a seamless looping ticker. `marquee(track, options?)` clones a track's children just enough to fill the container, drifts the strip at a constant speed, and wraps at exactly one content period (measured to include the inter-set gap) so there is no visible seam. Hand it `scroll.velocity()` and it speeds up and reverses with the scroll - the agency ticker. It's a standalone export (no scroll controller needed) that optionally takes a signed-px/s `Animatable` for the coupling. Options: `speed`, `direction`, `axis`, `velocity`, `velocityFactor`, `pauseOnHover` (eases the drift to a stop via a spring, and back on leave), `spring`. The loop sleeps while the container is off-screen (IntersectionObserver) and sits still under reduced motion; clones are `aria-hidden` + `inert`, and `dispose()` removes them and restores the element. The container needs `overflow: hidden`.

### Patch Changes

- @underlying/core@1.1.0-beta.2

## 1.1.0-beta.1

### Minor Changes

- 2285b24: Smooth scroll - a document-level inertia engine. Pass `{ smooth: true }` to `createScroll` (or call `controller.smooth()`) and a spring takes over the scroll: wheel, touch (opt-in) and keyboard re-aim it and it glides to rest instead of stopping dead. It drives **native** scroll - no transform, no content wrapper - so the scrollbar, in-page anchors, `position: sticky` and find-in-page keep working, and every existing effect (`scrub`, `parallax`, `velocity`, `pin`, `snap`, `scrollTo`) reads the smoothed position with no change. Physics-first: one `follow()` spring owns the smoothed position (the same `stiffnessFor` mapping as scrub/parallax), interruptible by a real flick. `scrollTo` and `snap` route through that one spring when smooth is active, so there's never more than one writer of native scroll. A user scroll the engine did not drive (scrollbar, anchor, keyboard) is adopted rather than fought. Options: `smooth` (catch-up seconds), `spring`, `wheelMultiplier`, `touchMultiplier`, `keyboard` (default on, never steals a form field), `touch` (default off - intercepting touchmove kills iOS native momentum). Off under reduced motion - native scroll runs raw. The `ScrollSource` contract gains `driveTo(pos)` for the synchronous engine write.

### Patch Changes

- @underlying/core@1.1.0-beta.1

## 1.1.0-beta.0

### Minor Changes

- 083d845: `scroll.velocity()` - scroll speed as one live value. It exposes how fast the scroller is moving (px/s, signed) as a `bindStyle`-ready `Animatable`, smoothed through a spring so it ramps and eases back to rest the moment you stop. Map it to a few degrees of `skewY`, a scale, or a blur, and the content leans with your scroll speed and snaps upright when you stop - the velocity-reactive lean. Physics-first: a fresh flick mid-relax re-aims the spring with velocity conserved, never a restart; held at rest under reduced motion.

### Patch Changes

- @underlying/core@1.1.0-beta.0

## 1.0.0

- First stable release. Scroll as a source: `scrub()`, `parallax()`, `pin()`, `trigger()`, `snap()`, and a spring-driven `scrollTo()`, all on one rAF loop. Leaving beta: the API is frozen and the @underlying suite now versions together.

## 0.1.0-beta.8

### Patch Changes

- Updated dependencies [c4dd1e9]
  - @underlying/core@0.1.0-beta.6

## 0.1.0-beta.7

### Minor Changes

- 50930a6: Programmatic scroll, scroll-spy, and dev markers. `scroll.scrollTo(target, options)` springs the scroller to an absolute position or an element brought into view - it runs on the same `follow()` spring as the momentum scrub, so a `scrollTo` issued mid-flight re-aims the spring already in motion with velocity conserved (no restart jolt), and one from rest starts fresh. `offset` clears a sticky header, `align` picks the edge pair to settle on, reduced motion (and `immediate`) jump instantly, and it returns a `{ finished, cancel }` handle. `trigger()` gains `toggleClass` - a string on the element, or `{ className, targets }` to light other elements (the scroll-spy primitive, e.g. the nav link for the section in view); the class is stripped on dispose so nothing stays lit. `markers()` draws a dev overlay: a solid line on the element's start/end edges (they travel with the content) and a dashed line at each scroller position they fire against, for the window or an element scroller on either axis. Dev-only; switch it off for production.

## 0.1.0-beta.6

### Patch Changes

- Updated dependencies [a27ed4d]
  - @underlying/core@0.1.0-beta.5

## 0.1.0-beta.5

### Patch Changes

- Updated dependencies [bf6b019]
  - @underlying/core@0.1.0-beta.4

## 0.1.0-beta.4

### Patch Changes

- Updated dependencies [ec2d1de]
  - @underlying/core@0.1.0-beta.3

## 0.1.0-beta.3

### Patch Changes

- Updated dependencies [19501e6]
  - @underlying/core@0.1.0-beta.2

## 0.1.0-beta.2

### Patch Changes

- c16dd30: Republish. `0.1.0-beta.1` shipped with an unresolved `workspace:*` spec for its `@underlying/core` dependency (it was published with `npm`, which does not rewrite the workspace protocol, instead of `pnpm`), so installing it from the registry failed. This release ships the resolved dependency range plus the package README and LICENSE. `0.1.0-beta.1` is deprecated.

## 0.1.0-beta.1

### Minor Changes

- 68b1a7a: Initial beta of `@underlying/scroll`: scroll-driven animation on the physics core. Scroll is a source, not an engine - the package owns the three browser concerns the core refuses (IntersectionObserver, one passive scroll/resize listener, `getBoundingClientRect`), normalizes scroll to `0..1`, and fans it onto existing core seams. No physics is re-implemented.

  - **`scrub()`** - drive a seekable handle from scroll. `smooth: false` locks the playhead frame-for-frame (reversible, deterministic); a number routes through `follow()` for a momentum trail with conserved velocity. A live spring is `bake()`d once at link time.
  - **`parallax()`** - map a range's progress to px on a `bindStyle`-ready `Animatable`.
  - **`pin()`** - spacer wrap + `position: fixed` across a range, gated on `raw()` crossings; exposes its own child `Track` for nested scrubs.
  - **`snap()`** - opt-in momentum snap on scroll-idle, directional and spring-settled; acts only on release, never scroll-jacking.
  - **`trigger()`** - enter/leave via one `IntersectionObserver`, crossing direction read from the entry geometry, `toggleActions` verbs.
  - **`track()`** - the raw `0..1` primitive every builder composes from.

  The offset grammar is the `[element edge] [viewport edge]` offset model. Reduced motion is one centralized policy (momentum scrub collapses to locked, parallax disabled, momentum snap instant), re-routed live on preference change. Lazy and SSR-safe: nothing touches browser globals at import, and a manual scroll source mirrors the core's manual driver for deterministic tests. About 4 kB gzip with the core marked external.

  `@underlying/core` gains a test-only `@underlying/core/testing` subpath (re-exports the manual frame driver) and exports `getSharedScheduler`, so scroll shares the one rAF loop.

### Patch Changes

- Updated dependencies [68b1a7a]
- Updated dependencies [cbdb2ec]
  - @underlying/core@0.1.0-beta.1
