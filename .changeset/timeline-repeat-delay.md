---
"@underlying/timeline": patch
---

`repeatDelay` now works. It was documented and exposed on `TimelineOptions`, but the loop only read `repeat`/`yoyo` and ignored it, so iterations restarted with no pause. The timeline now holds at the leg start for `repeatDelay` ms between iterations (matching core's playable). Also remove `paused` from `TimelineOptions`: the constructor always starts paused (you call `play()`), so the type no longer advertises an option it silently ignored.
