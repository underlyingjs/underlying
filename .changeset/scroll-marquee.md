---
"@underlying/scroll": minor
---

`marquee()` - a seamless looping ticker. `marquee(track, options?)` clones a track's children just enough to fill the container, drifts the strip at a constant speed, and wraps at exactly one content period (measured to include the inter-set gap) so there is no visible seam. Hand it `scroll.velocity()` and it speeds up and reverses with the scroll - the agency ticker. It's a standalone export (no scroll controller needed) that optionally takes a signed-px/s `Animatable` for the coupling. Options: `speed`, `direction`, `axis`, `velocity`, `velocityFactor`, `pauseOnHover` (eases the drift to a stop via a spring, and back on leave), `spring`. The loop sleeps while the container is off-screen (IntersectionObserver) and sits still under reduced motion; clones are `aria-hidden` + `inert`, and `dispose()` removes them and restores the element. The container needs `overflow: hidden`.
