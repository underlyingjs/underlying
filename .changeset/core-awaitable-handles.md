---
"@underlying/core": minor
---

Awaitable handles + playhead queries (#70).

```ts
await animate(el, { x: 100 })          // resolves when it settles (or is interrupted)
await value.spring(100)                // every handle is thenable now
const h = playable(v).to(100, { duration: 400, repeat: 2 })
h.isActive()      // still running?
h.iteration()     // 0-based, advances each repeat
h.totalProgress() // 0..1 across the WHOLE run (all iterations + delays)
h.restart()       // replay from the top
```

**Thenable handles.** Every animation handle - `animate()`, `from()`/`fromTo()`,
`value.spring/to/decay/simulate`, `playable()`, `sequence()`, `stagger`/`chain` -
is now `PromiseLike<void>`, so `await handle` (or `await animate(...)`) resolves
when it settles or is interrupted (delegating to `finished`; never rejects). The
`finished` promise stays for explicit use.

**Playhead queries** on `PlaybackHandle`:

- `isActive()` - true while the run is progressing (not finished/stopped, not paused).
- `iteration()` - current 0-based iteration, advancing at each repeat boundary.
- `totalProgress()` - progress 0..1 across the whole run (initial delay + every
  iteration + repeat delays); falls back to the current iteration for an un-baked
  spring or an infinite repeat.
- `restart()` - replay from the start (skipping the initial delay).
- `startTime()` / `endTime()` - the run's initial delay and its total end time (ms);
  `endTime()` is `undefined` for an un-baked spring or an infinite repeat.
