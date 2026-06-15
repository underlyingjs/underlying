---
"@underlying/svg": minor
---

Initial beta of `@underlying/svg`: SVG path animation - MotionPath and DrawSVG - on the live physics of `@underlying/core`. No new engine: it samples the path with the native `getPointAtLength`/`getTotalLength` and drives core's `animatable`, so the progress of both is a single interruptible value rather than a baked tween.

- `motionPath(element, path, options)` rides an element along a path. Progress `t` is a live `Animatable`, so you can spring it, `flick()` it down the path and let inertia settle it, or retarget it mid-flight with velocity conserved - things a baked path tween cannot do. `autoRotate` turns the element to face along the tangent, and `.t` composes straight into `scroll.scrub` or a timeline.
- `draw(path, options)` draws a stroke on (0 hidden, 1 drawn) via stroke-dasharray/offset, with the fraction a live `Animatable` too - it can overshoot, and you can interrupt it mid-draw. `revert()` restores the original dash properties.
- Layered, one implementation: `bindPath`/`bindDraw` (bring your own driver) and `samplePath` (low-level geometry) underneath; an `{ to }` option gives the GSAP-familiar one-call form that still springs under the hood.

Reduced motion is inherited from core (the driver auto-degrades to a jump). ~1.1 kB gzip on top of core. MorphSVG is intentionally out of this first cut.
