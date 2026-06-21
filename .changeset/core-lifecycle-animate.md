---
"@underlying/core": minor
---

`animate()` (the DOM aggregate) now accepts the lifecycle callbacks too (#67, part 2): `onStart`, `onUpdate` (the live numeric channel values object each frame), `onComplete` (every channel settled), `onInterrupt` (a channel superseded by a later `animate()`, or the handle stopped), and a `scope` (`this` receiver), plus the post-hoc `eventCallback()`. Requesting a callback runs the JS path so the per-frame `onUpdate` tick and the per-channel interrupt detection work; a callback-free `animate()` keeps the WAAPI compositor fast path. With part 1 this completes #67 across `animatable`, the playback handles, and `animate()` (the timeline package adopts the same hooks as a follow-up).
