---
"@underlying/gestures": minor
---

`cursor()` - a custom cursor that trails the real pointer with spring lag and flips to an active state over interactive targets. `cursor(options?)` drops a `<div class="cursor">` on the body (or drives one you pass), positions it with a follow spring so it lags slightly behind the pointer, and toggles `cursor--active` whenever the pointer is over a `targets` selector - links, buttons, whatever you name. The library only moves it; you give it its look through `.cursor` / `.cursor--active` CSS, so it stays a primitive rather than a theme. It rides the same shared pointer listener as `magnetic()` (one window listener for both) and starts where the cursor already is instead of swooping in from the origin. Off on touch and held hidden under reduced motion - the native cursor stays. The third of the pointer-reactive primitives.
