---
"@underlying/gestures": minor
---

`interactive()` - declarative hover / press state animations, the declarative side of the pointer set. `interactive(element, { hover, press })` names a `hover` and/or `press` target (any `bindStyle` channel - `scale`, `x`, `y`, `rotate`, `opacity`, ...) and the element springs to it on pointer-over or keyboard focus (hover) and while pressed or Enter/Space is held (press), springing back on release - interruptible, never a restart. Press wins over hover **per channel**, so a press that only nudges `y` keeps the hover `scale`. Keyboard parity (focus = hover, Enter/Space = press) and emulated-touch-hover filtering (a tap is a press, not a hover) are built in; `state()` reports `'rest'` / `'hover'` / `'press'`. Snaps instead of springing under reduced motion. Implements #50.
