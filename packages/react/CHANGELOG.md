# @underlying/react

## 1.2.0-beta.8

### Minor Changes

- cd41fdf: New package: `@underlying/react` - the React adapter (#39). Hooks that bind the
  underlying primitives to a ref, with automatic teardown on unmount.

  ```tsx
  import {
    useAnimate,
    useDraggable,
    useTilt,
    useReveal,
    useReorder,
  } from "@underlying/react";

  function Card({ open }: { open: boolean }) {
    const box = useAnimate<HTMLDivElement>({ x: open ? 200 : 0 }); // reactive: springs on prop change
    const card = useTilt<HTMLDivElement>();
    return (
      <div ref={box}>
        <div ref={card} className="card" />
      </div>
    );
  }
  ```

  Each hook returns a ref you attach to your element; the primitive is created on
  mount and disposed on unmount.

  - **`useAnimate(targets, options?)`** springs the element toward `targets` and
    retargets the same live channels whenever `targets` changes (interruptible,
    velocity conserved).
  - **Gestures**: `useDraggable`, `useTilt`, `useMagnetic`, `useDepth`, `useAmbient`,
    `useInteractive`.
  - **Text**: `useSplit`, `useReveal`, `useTypewriter(text)`, `useScramble(text)`.
  - **FLIP**: `useReorder`.

  React 18/19 peer. The core packages come along as dependencies. (Vue adapter follows.)

### Patch Changes

- @underlying/core@1.2.0-beta.8
- @underlying/flip@1.2.0-beta.8
- @underlying/gestures@1.2.0-beta.8
- @underlying/text@1.2.0-beta.8
