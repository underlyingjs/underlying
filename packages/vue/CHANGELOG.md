# @underlying/vue

## 1.2.0

### Minor Changes

- c54e4c4: New package: `@underlying/vue` - the Vue adapter (#39). Composables that bind the
  underlying primitives to a template ref, with automatic teardown on unmount.

  ```vue
  <script setup lang="ts">
  import { ref } from "vue";
  import { useAnimate, useDraggable, useReveal } from "@underlying/vue";

  const open = ref(false);
  const panel = useAnimate<HTMLDivElement>(() => ({ x: open.value ? 240 : 0 })); // reactive
  const handle = useDraggable<HTMLDivElement>({ axis: "x" });
  const title = useReveal<HTMLHeadingElement>({ by: "words" });
  </script>

  <template>
    <div :ref="panel">
      <h2 :ref="title">Reveal</h2>
      <div :ref="handle" />
    </div>
  </template>
  ```

  Each composable returns a ref you bind with `:ref`; the primitive is created on
  mount and disposed on unmount.

  - **`useAnimate(targets, options?)`** springs the element toward `targets` (a ref,
    getter, or plain object) and retargets the same live channels whenever the reactive
    source changes (interruptible, velocity conserved), via `watchEffect`.
  - **Gestures**: `useDraggable`, `useTilt`, `useMagnetic`, `useDepth`, `useAmbient`,
    `useInteractive`.
  - **Text**: `useSplit`, `useReveal`, `useTypewriter(text)`, `useScramble(text)`.
  - **FLIP**: `useReorder`.

  Vue 3.4+ peer. Completes the Angular / React / Vue adapter set.

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
