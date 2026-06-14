---
"@underlying/core": minor
---

Add `sequence()` to `@underlying/core/playback` - the live, interruptible twin of `@underlying/timeline`.

Where a timeline records its physics into a seekable table (you scrub it), a sequence keeps every leg live. Legs run in authored order on a completion event - each starts when the previous one rests, or `overlap` ms after it starts (the cascade feel), with no master clock. Because every leg is a real spring, decay or tween, a value stays interruptible: retarget it mid-flight and the motion hands off with its velocity conserved, never a restart. It is deliberately not seekable - there is no `seek()`, `progress()` or `duration()`, which is exactly what `timeline()` is for.

The verbs mirror the timeline (minus positions): `spring`, `to`, `from`, `fromTo`, `decay`, `call`, `add`, `stagger`, plus `play`/`pause`/`resume`/`stop`/`timeScale`. Author with `from()`/`fromTo()` to make a run replayable - they reset the start each play.

```ts
import { sequence } from '@underlying/core/playback'

sequence()
  .spring(card.opacity, 1)
  .spring(avatar.scale, 1, { overlap: 80 })   // hands off mid-flight, velocity kept
  .play()
```

BREAKING: the low-level ordered-handle primitive previously exported as `sequence(steps)` from `@underlying/core` is renamed to `chain(steps)`, freeing the `sequence` name for the new builder. Change `import { sequence } from '@underlying/core'` to `import { chain } from '@underlying/core'`.
