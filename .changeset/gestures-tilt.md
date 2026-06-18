---
"@underlying/gestures": minor
---

`tilt()` - a pointer-reactive 3D tilt. `tilt(element, options?)` maps the cursor's position over an element to two rotations a spring chases, so the card follows your cursor live and eases back to flat when you leave - interruptible, never a restart. Options for `max` degrees, `perspective`, a hover `scale` lift, and `reverse`. Like `draggable`'s `x` / `y`, the rotations are live `Animatable`s (`t.rotateX` / `t.rotateY`) you can read, bind elsewhere, or compose. Off on touch and held flat under reduced motion. The first of the pointer-reactive primitives.
