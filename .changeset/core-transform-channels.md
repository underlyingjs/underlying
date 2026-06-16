---
"@underlying/core": minor
---

More transform channels. `animate()`, `setStyle()` and `bindStyle()` now drive `perspective`, `rotateX/Y/Z`, `skewX/Y`, `scaleX/Y`, and transform-origin (`originX/originY`) on top of the existing `x/y/scale/rotate/opacity`. Each is just another live `Animatable`, so a 3D card flip (`rotateY`) springs and stays interruptible like any value - retarget it mid-flip and it bends from its real velocity - and the pivot (`transform-origin`) is animatable too. A single canonical order in `formatTransform` keeps the WAAPI delegation and the binding byte-identical; transform-origin rides its own keyframe property. Note: `perspective` is the `perspective()` function on the element itself (set it rather than spring it from nothing), and `transform-style: preserve-3d` is a CSS mode you set on the scene.
