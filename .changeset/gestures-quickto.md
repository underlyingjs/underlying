---
"@underlying/gestures": minor
---

`quickTo()` - an imperative fast setter. `quickTo(element, channel, options?)` binds one (or two) of an element's transform channels to a spring once, then returns a plain function you call every frame to retarget it. Each call re-aims the spring in place without rebuilding it, so it stays cheap in a hot handler. Where `cursor()` and `magnetic()` wire their own input, `quickTo()` is the escape hatch - you bring the handler and the mapping, it brings the physics. Pass two channels together (`['x', 'y']`) to drive both through one `bindStyle` without the transform clobbering. The single-channel form exposes the live `value`, the pair form exposes `values`; options are `from` and `spring`. Under reduced motion the value snaps to its target instead of springing, so motion is removed but tracking stays. Closes the pointer-reactive set: `tilt`, `magnetic`, `cursor`, `depth`, and now the fast setter that drives them all.
