---
"@underlying/gestures": minor
---

`magnetic()` - a pointer-reactive magnetic pull. `magnetic(element, options?)` pulls an element toward the cursor once it comes within range, the element following a fraction of the cursor's offset chased by a spring, then springing home when the cursor leaves - interruptible, never a restart. Options for `radius` and `strength`. Like `draggable`'s `x` / `y`, the offset is exposed as live `Animatable`s (`m.x` / `m.y`). A shared window pointer listener keeps many magnetic elements cheap. Off on touch and held home under reduced motion. The second of the pointer-reactive primitives.
