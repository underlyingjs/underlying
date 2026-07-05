# @underlying/angular

## 1.2.0-beta.9

### Patch Changes

- @underlying/core@1.2.0-beta.9
- @underlying/flip@1.2.0-beta.9
- @underlying/gestures@1.2.0-beta.9
- @underlying/scroll@1.2.0-beta.9
- @underlying/text@1.2.0-beta.9

## 1.2.0-beta.8

### Patch Changes

- @underlying/core@1.2.0-beta.8
- @underlying/flip@1.2.0-beta.8
- @underlying/gestures@1.2.0-beta.8
- @underlying/scroll@1.2.0-beta.8
- @underlying/text@1.2.0-beta.8

## 1.2.0-beta.7

### Minor Changes

- 26a0a77: New package: `@underlying/angular` - the Angular adapter (#39, Angular first).

  Standalone directives that bind the underlying primitives to your elements, with
  automatic teardown on destroy (via `DestroyRef`) - no manual `dispose()` in
  `ngOnDestroy`.

  ```ts
  import { UNDERLYING_DIRECTIVES } from '@underlying/angular'

  @Component({ imports: [...UNDERLYING_DIRECTIVES], template: `
    <div uAnimate [uAnimate]="{ x: open() ? 200 : 0 }"></div>   <!-- reactive: springs on signal change -->
    <div uDraggable [uDraggable]="{ axis: 'x' }"></div>
    <div uTilt uMagnetic uInteractive></div>
    <h1 uReveal>Masked reveal</h1>
    <ul uReorder [uReorder]="{ handle: '.grip' }">…</ul>
  `})
  ```

  - **`uAnimate`** springs the host toward a bound targets object; when the signal
    changes it retargets the same live channels (interruptible, velocity conserved).
  - **Gestures**: `uDraggable`, `uTilt`, `uMagnetic`, `uDepth`, `uAmbient`,
    `uInteractive`.
  - **Text**: `uSplit`, `uReveal`, `uTypewriter`, `uScramble`.
  - **FLIP**: `uReorder` (drag-to-reorder the host's children).

  Each directive reads its options from an input and cleans up when the element is
  destroyed. Built and shipped in the Angular Package Format (partial-Ivy) via
  ng-packagr; Angular 19/20 peer. React and Vue adapters follow.

### Patch Changes

- @underlying/core@1.2.0-beta.7
- @underlying/flip@1.2.0-beta.7
- @underlying/gestures@1.2.0-beta.7
- @underlying/scroll@1.2.0-beta.7
- @underlying/text@1.2.0-beta.7
