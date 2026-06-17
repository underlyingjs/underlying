---
"@underlying/svg": minor
---

`morphCommands()` - a command-preserving morph. Where `morph()` resamples both outlines into a polyline (any two shapes, but corners soften), `morphCommands()` parses both `d` strings into cubic segments, subdivides the sparser shape with de Casteljau so anchors map to anchors (original corners stay sharp), aligns closed rings by rotation and winding so the shape settles into place instead of spinning, and interpolates each anchor and control - real curves with crisp corners. The fraction is the same live Animatable: spring it, scrub it, grab it mid-morph; `revert()` restores the original `d`. Elliptical arcs (`A`) are not supported - use `morph()` for those or for arbitrary shapes. It ships as a separate export, so it tree-shakes away when you only use `morph()`.
