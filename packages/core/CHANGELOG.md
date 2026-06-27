# @underlying/core

## 1.2.0-beta.0

## 1.1.0

### Minor Changes

- 7733826: Authoring ergonomics for real apps (#52): expressive stagger, multi-target `animate()`, relative and per-target function values, and a responsive teardown layer.

  - **`staggerDelay(options)`** builds a delay schedule `(index, total) => ms` you pass to `stagger()` or to `animate()`'s new `delay` option. Choose the wave origin (`start` / `end` / `center` / `edges` / `random` / a specific index), propagate across a 2D grid by cell distance (`grid: { cols }`), restrict to an axis, and redistribute the spacing through an easing. `random` is deterministic from a `seed`. The plain `stagger(items, fn, delayMs)` and the linear default are unchanged.
  - **Multi-target `animate()`** now accepts an element, an array, a `NodeList`, or a CSS selector string and returns ONE handle for the whole set. Single-element calls keep their exact original fast path (and the WAAPI compositor path).
  - **Relative and function values**: a target can be `'+=100'` / `'-=40'` / `'*=2'` resolved against the live value (so a re-fire retargets from the in-flight position, physics-first), or a per-target function `(index, element, count) => value`. Relatives compose on numeric channels and single-magnitude length/number properties (unit preserved).
  - **`responsive(query | { reducedMotion }, setup)`** runs a setup when a media query starts matching and its returned teardown when it stops - the reduced-motion form reuses the app-level override. SSR-safe and client-only.
  - **`region(setup?)`** is a teardown boundary: scope-bound `animate` / `stagger` / `responsive` / `setStyle` plus `add` / `track`, and a single `revert()` that stops the animations, removes the media listeners, and releases the inline styles - the mount/unmount seam for framework adapters.

  Also exported: `resolveTargets`, `staggerDelays`, and the `DelayFn` / `StaggerOrigin` / `StaggerGrid` / `StaggerAxis` / `StaggerDelayOptions` / `AnimationTarget` / `RelativeValue` / `ValueFn` / `ResponsiveSetup` / `Region` types.

- 786aca7: `animate()` (the DOM aggregate) now accepts the lifecycle callbacks too (#67, part 2): `onStart`, `onUpdate` (the live numeric channel values object each frame), `onComplete` (every channel settled), `onInterrupt` (a channel superseded by a later `animate()`, or the handle stopped), and a `scope` (`this` receiver), plus the post-hoc `eventCallback()`. Requesting a callback runs the JS path so the per-frame `onUpdate` tick and the per-channel interrupt detection work; a callback-free `animate()` keeps the WAAPI compositor fast path. With part 1 this completes #67 across `animatable`, the playback handles, and `animate()` (the timeline package adopts the same hooks as a follow-up).
- cf994f5: Animation lifecycle callbacks on the imperative value and the playback handles (#67, part 1). `spring`/`to`/`decay`/`simulate` and `playable(...)`'s `spring`/`to`/`decay` now accept `onStart`, `onUpdate` (the live value each frame), `onComplete` (natural settle), `onInterrupt` (replaced / stopped / teleported / disposed mid-flight), and - on playback - `onRepeat` (each iteration boundary) and `onReverseComplete` (a reversed leg reaching its start), plus an optional `scope` (the `this` receiver). The callbacks ride the same options object; the physics builders never see them, so the physics option types stay lifecycle-blind. The handle also gains a post-hoc `eventCallback(event, fn | null)` to attach or replace a callback after creation (optional - present on the handles that carry a lifecycle). Under reduced motion a run still fires `onStart` then `onComplete`; an `Infinity`-repeat run never completes. `finished` and `stop()` are unchanged. `animate()` (the DOM aggregate) follows in part 2.
- 3f85820: Live value templating (#68): compose several independent live values into one reactive CSS string, written to any property each frame.

  `template` is a tagged template whose interpolations are live sources - an `animatable`, a `follow()`, a scroll/pointer spring - and whose literals carry the units, so it reads byte-for-byte like the CSS it emits:

  ```ts
  const blur = follow(0),
    glow = follow(1);
  bindTemplate(hero, "filter", template`blur(${blur}px) brightness(${glow})`);
  bindTemplate(sheen, "--sheen", template`${angle}deg`);
  ```

  `bindTemplate(element, property, template, options?)` writes the composed string to any CSS property (including a `--custom` one) through the same change-gated render phase as `animate()`: one write per frame when several sources change together, byte-deduplicated so a value jittering below its precision writes nothing, and quiet at rest. It returns a `() => void` disposer that tears down every source subscription (and drops straight into `region.add(...)`); it is a read-only projection and never disposes its sources. There is also a function escape hatch for computed projections: `bindTemplate(el, 'transform', [x, y], (px, py) => \`translate3d(${px}px, ${py}px, 0)\`)`, arity-typed to the sources.

  Numeric slots round to 4 decimals by default (matching the value model), configurable via `precision`. SSR-safe: `template` is pure in-memory assembly and the module touches no browser global at import.

## 1.1.0-beta.4

### Minor Changes

- 7733826: Authoring ergonomics for real apps (#52): expressive stagger, multi-target `animate()`, relative and per-target function values, and a responsive teardown layer.

  - **`staggerDelay(options)`** builds a delay schedule `(index, total) => ms` you pass to `stagger()` or to `animate()`'s new `delay` option. Choose the wave origin (`start` / `end` / `center` / `edges` / `random` / a specific index), propagate across a 2D grid by cell distance (`grid: { cols }`), restrict to an axis, and redistribute the spacing through an easing. `random` is deterministic from a `seed`. The plain `stagger(items, fn, delayMs)` and the linear default are unchanged.
  - **Multi-target `animate()`** now accepts an element, an array, a `NodeList`, or a CSS selector string and returns ONE handle for the whole set. Single-element calls keep their exact original fast path (and the WAAPI compositor path).
  - **Relative and function values**: a target can be `'+=100'` / `'-=40'` / `'*=2'` resolved against the live value (so a re-fire retargets from the in-flight position, physics-first), or a per-target function `(index, element, count) => value`. Relatives compose on numeric channels and single-magnitude length/number properties (unit preserved).
  - **`responsive(query | { reducedMotion }, setup)`** runs a setup when a media query starts matching and its returned teardown when it stops - the reduced-motion form reuses the app-level override. SSR-safe and client-only.
  - **`region(setup?)`** is a teardown boundary: scope-bound `animate` / `stagger` / `responsive` / `setStyle` plus `add` / `track`, and a single `revert()` that stops the animations, removes the media listeners, and releases the inline styles - the mount/unmount seam for framework adapters.

  Also exported: `resolveTargets`, `staggerDelays`, and the `DelayFn` / `StaggerOrigin` / `StaggerGrid` / `StaggerAxis` / `StaggerDelayOptions` / `AnimationTarget` / `RelativeValue` / `ValueFn` / `ResponsiveSetup` / `Region` types.

- 786aca7: `animate()` (the DOM aggregate) now accepts the lifecycle callbacks too (#67, part 2): `onStart`, `onUpdate` (the live numeric channel values object each frame), `onComplete` (every channel settled), `onInterrupt` (a channel superseded by a later `animate()`, or the handle stopped), and a `scope` (`this` receiver), plus the post-hoc `eventCallback()`. Requesting a callback runs the JS path so the per-frame `onUpdate` tick and the per-channel interrupt detection work; a callback-free `animate()` keeps the WAAPI compositor fast path. With part 1 this completes #67 across `animatable`, the playback handles, and `animate()` (the timeline package adopts the same hooks as a follow-up).
- cf994f5: Animation lifecycle callbacks on the imperative value and the playback handles (#67, part 1). `spring`/`to`/`decay`/`simulate` and `playable(...)`'s `spring`/`to`/`decay` now accept `onStart`, `onUpdate` (the live value each frame), `onComplete` (natural settle), `onInterrupt` (replaced / stopped / teleported / disposed mid-flight), and - on playback - `onRepeat` (each iteration boundary) and `onReverseComplete` (a reversed leg reaching its start), plus an optional `scope` (the `this` receiver). The callbacks ride the same options object; the physics builders never see them, so the physics option types stay lifecycle-blind. The handle also gains a post-hoc `eventCallback(event, fn | null)` to attach or replace a callback after creation (optional - present on the handles that carry a lifecycle). Under reduced motion a run still fires `onStart` then `onComplete`; an `Infinity`-repeat run never completes. `finished` and `stop()` are unchanged. `animate()` (the DOM aggregate) follows in part 2.
- 3f85820: Live value templating (#68): compose several independent live values into one reactive CSS string, written to any property each frame.

  `template` is a tagged template whose interpolations are live sources - an `animatable`, a `follow()`, a scroll/pointer spring - and whose literals carry the units, so it reads byte-for-byte like the CSS it emits:

  ```ts
  const blur = follow(0),
    glow = follow(1);
  bindTemplate(hero, "filter", template`blur(${blur}px) brightness(${glow})`);
  bindTemplate(sheen, "--sheen", template`${angle}deg`);
  ```

  `bindTemplate(element, property, template, options?)` writes the composed string to any CSS property (including a `--custom` one) through the same change-gated render phase as `animate()`: one write per frame when several sources change together, byte-deduplicated so a value jittering below its precision writes nothing, and quiet at rest. It returns a `() => void` disposer that tears down every source subscription (and drops straight into `region.add(...)`); it is a read-only projection and never disposes its sources. There is also a function escape hatch for computed projections: `bindTemplate(el, 'transform', [x, y], (px, py) => \`translate3d(${px}px, ${py}px, 0)\`)`, arity-typed to the sources.

  Numeric slots round to 4 decimals by default (matching the value model), configurable via `precision`. SSR-safe: `template` is pure in-memory assembly and the module touches no browser global at import.

## 1.1.0-beta.3

## 1.1.0-beta.2

## 1.1.0-beta.1

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
