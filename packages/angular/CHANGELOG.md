# @underlying/angular

## 1.2.1

### Patch Changes

- 543776b: Harden the framework adapters and keep the package family on a single core.

  **SSR-safe Angular.** The standalone directives now create their primitives with
  `NgZone.runOutsideAngular` - their animation frames and pointer listeners no longer
  trigger change detection - and skip the work entirely off the browser, so they no
  longer run during server-side rendering (Angular Universal).

  **No first-paint flash in React.** The DOM-mutating hooks (`useSplit`, `useReveal`,
  and the initial `useAnimate` positioning) now run in a layout effect, so the element
  is in place before the browser paints, falling back to a passive effect during SSR.

  **One shared core.** Inter-package dependencies are now caret ranges instead of exact
  pins, so installing an adapter alongside a direct `@underlying/core` dependency
  dedupes to a single core - one rAF loop, one style registry - instead of risking two.

  Also: `useTypewriter` / `useScramble` (and the `uTypewriter` / `uScramble` directives)
  now document that their text is read once on mount, a one-shot entrance; each adapter
  ships a `LICENSE`, a `./package.json` export and a gzip size budget; and
  `@underlying/angular` drops an unused `@underlying/scroll` dependency.

  - @underlying/core@1.2.1
  - @underlying/flip@1.2.1
  - @underlying/gestures@1.2.1
  - @underlying/text@1.2.1

## 1.2.0

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

- Updated dependencies [fb77271]
- Updated dependencies [7aafc87]
- Updated dependencies [5bebad9]
- Updated dependencies [1760eaf]
- Updated dependencies [2f6f36e]
- Updated dependencies [419d16c]
- Updated dependencies [d99e408]
  - @underlying/core@1.2.0
  - @underlying/flip@1.2.0
  - @underlying/gestures@1.2.0
  - @underlying/text@1.2.0
  - @underlying/scroll@1.2.0

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
