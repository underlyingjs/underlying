# @underlying/core

## 1.1.0-beta.0

## 1.0.0

- First stable release. Physics-first values - spring, decay, tween and bring-your-own `simulate()` - with full transform channels, the string-ease registry, opt-in playback, and reduced-motion built in. Leaving beta: the API is frozen and the @underlying suite now versions together.

## 0.1.0-beta.6

### Minor Changes

- c4dd1e9: Custom physics. Spring, decay, and tween were always presets over one primitive - a `Simulation`: an acceleration plus a rest condition over a (position, velocity) state. That primitive is now public. `value.simulate(simulation, options?)` drives any value with your own acceleration on the same fixed-timestep clock, fully interruptible and velocity-conserving like every other mode - bring gravity, a force field, a damped bounce, a pendulum. The `Simulation` and `SimulationState` types ship from the main entry; the low-level `stepSimulation` and `SIMULATION_TIMESTEP_S` ship from a new `@underlying/core/physics` subpath for fully manual loops (a canvas particle system, confetti, a 2D physics field) that are not bound to an Animatable. Nothing else changes; spring/decay/to are unchanged sugar over the same step.

## 0.1.0-beta.5

### Minor Changes

- a27ed4d: `easing` now accepts a named ease by string, not just a function. `ToOptions.easing` and `AnimateOptions.easing` take a function OR a string (`'power2.out'`, `'elastic.out(1, 0.3)'`), resolved at the tween and the WAAPI keyframe builder. A small registry (`registerEasing`) is the extension point - `@underlying/utils` fills it on import - and nothing is registered at module scope, so the primitives tree-shake graph stays untouched. An unknown name warns once and falls back to `easeInOutCubic`, never throws.

## 0.1.0-beta.4

### Minor Changes

- bf6b019: More transform channels. `animate()`, `setStyle()` and `bindStyle()` now drive `perspective`, `rotateX/Y/Z`, `skewX/Y`, `scaleX/Y`, and transform-origin (`originX/originY`) on top of the existing `x/y/scale/rotate/opacity`. Each is just another live `Animatable`, so a 3D card flip (`rotateY`) springs and stays interruptible like any value - retarget it mid-flip and it bends from its real velocity - and the pivot (`transform-origin`) is animatable too. A single canonical order in `formatTransform` keeps the WAAPI delegation and the binding byte-identical; transform-origin rides its own keyframe property. Note: `perspective` is the `perspective()` function on the element itself (set it rather than spring it from nothing), and `transform-style: preserve-3d` is a CSS mode you set on the scene.

## 0.1.0-beta.3

### Patch Changes

- ec2d1de: Docs: the unit-conversion fallback emits a one-time _console_ warning (it fires in every build), not a "dev" warning - corrected the README wording to match the always-on behavior.

## 0.1.0-beta.2

### Minor Changes

- 19501e6: Add `sequence()` to `@underlying/core/playback` - the live, interruptible twin of `@underlying/timeline`.

  Where a timeline records its physics into a seekable table (you scrub it), a sequence keeps every leg live. Legs run in authored order on a completion event - each starts when the previous one rests, or `overlap` ms after it starts (the cascade feel), with no master clock. Because every leg is a real spring, decay or tween, a value stays interruptible: retarget it mid-flight and the motion hands off with its velocity conserved, never a restart. It is deliberately not seekable - there is no `seek()`, `progress()` or `duration()`, which is exactly what `timeline()` is for.

  The verbs mirror the timeline (minus positions): `spring`, `to`, `from`, `fromTo`, `decay`, `call`, `add`, `stagger`, plus `play`/`pause`/`resume`/`stop`/`timeScale`. Author with `from()`/`fromTo()` to make a run replayable - they reset the start each play.

  ```ts
  import { sequence } from "@underlying/core/playback";

  sequence()
    .spring(card.opacity, 1)
    .spring(avatar.scale, 1, { overlap: 80 }) // hands off mid-flight, velocity kept
    .play();
  ```

  BREAKING: the low-level ordered-handle primitive previously exported as `sequence(steps)` from `@underlying/core` is renamed to `chain(steps)`, freeing the `sequence` name for the new builder. Change `import { sequence } from '@underlying/core'` to `import { chain } from '@underlying/core'`.

## 0.1.0-beta.1

### Minor Changes

- 68b1a7a: Initial beta of `@underlying/scroll`: scroll-driven animation on the physics core. Scroll is a source, not an engine - the package owns the three browser concerns the core refuses (IntersectionObserver, one passive scroll/resize listener, `getBoundingClientRect`), normalizes scroll to `0..1`, and fans it onto existing core seams. No physics is re-implemented.

  - **`scrub()`** - drive a seekable handle from scroll. `smooth: false` locks the playhead frame-for-frame (reversible, deterministic); a number routes through `follow()` for a momentum trail with conserved velocity. A live spring is `bake()`d once at link time.
  - **`parallax()`** - map a range's progress to px on a `bindStyle`-ready `Animatable`.
  - **`pin()`** - spacer wrap + `position: fixed` across a range, gated on `raw()` crossings; exposes its own child `Track` for nested scrubs.
  - **`snap()`** - opt-in momentum snap on scroll-idle, directional and spring-settled; acts only on release, never scroll-jacking.
  - **`trigger()`** - enter/leave via one `IntersectionObserver`, crossing direction read from the entry geometry, toggleActions-style verbs.
  - **`track()`** - the raw `0..1` primitive every builder composes from.

  The offset grammar is the `[element edge] [viewport edge]` offset model. Reduced motion is one centralized policy (momentum scrub collapses to locked, parallax disabled, momentum snap instant), re-routed live on preference change. Lazy and SSR-safe: nothing touches browser globals at import, and a manual scroll source mirrors the core's manual driver for deterministic tests. About 4 kB gzip with the core marked external.

  `@underlying/core` gains a test-only `@underlying/core/testing` subpath (re-exports the manual frame driver) and exports `getSharedScheduler`, so scroll shares the one rAF loop.

- cbdb2ec: Extended value model: `animate()` now drives any CSS property (and custom properties), not just the five transform/opacity channels. Values decompose into scalar channels through a lazily-seeded value-type registry and reformat to CSS each frame.

  - **Lengths & units** - `width: '50%'` from a computed px start converts with a single measurement, rebasing position **and** velocity; unconvertible/unparseable values snap with a one-time dev warning, never a throw.
  - **Colors** - hex (`#rgb`/`#rrggbb`/`#rrggbbaa`), `rgb()/rgba()`, `hsl()`, and named colors, mixed in gamma-2.0 (approximate linear-light) space; non-spatial, so they keep crossfading under reduced-motion `fade`.
  - **Composite values** - `box-shadow`, `filter`, etc. via a generic complex type with kind-stable token realignment (absorbs Chromium's color-first computed order) and `none`/unset zero-equivalent synthesis.
  - **Keyframes** - `{ x: [0, 120, 80] }`: chained springs without a duration, an evenly-split piecewise tween with one (WAAPI multi-keyframe when eligible, with piecewise reclaim).
  - **`setStyle` / `releaseStyle`** - coherent teleport with gesture-velocity handoff, and an explicit uncache hatch.
  - **`registerValueType`** - the public extension point for custom property descriptors.

  Numeric channels keep their exact fast path and compositor delegation. A transforms-only import tree-shakes the entire value model away (CI probe: ~2.3 kB gzip); the full surface is ~10.5 kB gzip.

## 0.1.0-beta.0

### Minor Changes

- Initial beta release. Physics-first animatable values: interruptible springs with velocity conservation on retarget, bounded inertial decay (rubber-band edges), duration/easing escape hatch sampled on the same fixed-timestep clock. Single-rAF scheduler with update/render phases, direct-to-style DOM bindings, stagger and sequence composition, prefers-reduced-motion support active by default (skip/fade strategies, app-level override), opportunistic WAAPI delegation for eligible tweens with lossless control handback.
