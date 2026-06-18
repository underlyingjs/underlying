---
"@underlying/scroll": minor
---

`scroll.velocity()` - scroll speed as one live value. It exposes how fast the scroller is moving (px/s, signed) as a `bindStyle`-ready `Animatable`, smoothed through a spring so it ramps and eases back to rest the moment you stop. Map it to a few degrees of `skewY`, a scale, or a blur, and the content leans with your scroll speed and snaps upright when you stop - the velocity-reactive lean. Physics-first: a fresh flick mid-relax re-aims the spring with velocity conserved, never a restart; held at rest under reduced motion.
