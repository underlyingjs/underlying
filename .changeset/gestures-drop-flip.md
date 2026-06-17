---
"@underlying/gestures": minor
---

Remove the translate-only `flip()` from `@underlying/gestures`. Layout and shared-element transitions belong to `@underlying/flip`, which inverts position **and** size and springs to identity, interruptibly. Import `flip` from `@underlying/flip` instead - the gestures package now focuses on `draggable()` and `observe()`.
