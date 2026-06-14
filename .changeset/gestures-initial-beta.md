---
"@underlying/gestures": minor
---

Initial beta of `@underlying/gestures`: drag, fling, and interruptible FLIP, all on the live physics of `@underlying/core`.

- `draggable(element, options)` makes an element draggable and hands the pointer's velocity straight into the release - an inertial glide (with rubber-band bounds) or a spring back to the origin, momentum preserved in one argument, never a jump. Axis lock, bounds (an element to stay inside, or explicit ranges, re-measured on each grab), and the x/y offsets exposed as live `Animatable`s you can read or retarget.
- `flip(targets, mutate, options)` is FLIP done physics-first: measure, run your DOM mutation, invert so nothing jumps, then spring - not a baked tween - to the new layout. Because the play is a spring, calling `flip()` again mid-flight retargets from the live position AND velocity: the motion bends into the new layout instead of restarting. That interruptibility is what a baked FLIP cannot do.

~1.5 kB gzip on top of core. Built entirely on `@underlying/core`'s value layer (animatables, springs, decay) - no new engine.
