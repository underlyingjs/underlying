---
"@underlying/core": minor
---

Declarative entrances on `animate()` (#41): `from()` and `fromTo()`.

```ts
import { from, fromTo, staggerDelay } from '@underlying/core'

from(card, { y: 24, opacity: 0 })                            // rises into its natural resting state
from('.card', { y: 24, opacity: 0 }, { delay: staggerDelay({ each: 60 }) }) // a cascaded entrance
fromTo(badge, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1 })         // both ends explicit
```

Animate _into_ a resting state instead of out of one, with no manual `setStyle`
first and no flash.

- **`from(target, fromState, options?)`** captures each element's current value per
  key as the to-state, sets the from-state synchronously in the call frame, then
  springs home. A set returns to _its own_ per-element resting values.
- **`fromTo(target, fromState, toState, options?)`** takes both ends explicitly -
  sugar over `animate(target, toState, { from })`. The to-state keeps full target
  parity (keyframes, relative `'+='`, per-target functions); the from-state is a
  single value per key.
- Both accept the same value forms and every `animate()` option. With a stagger
  `delay` (or `staggerDelay()`) each element is parked at its from-state
  immediately and holds it through its own delay, like a real entrance.
- Under reduced motion the from-set is skipped: the element settles at its target,
  never stranded at the from-state.

`animate()` also gains a `from` option carrying the same behavior; the helpers are
thin sugar over it.
