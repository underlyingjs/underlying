# @underlying/vue

The Vue adapter for [underlying](https://github.com/underlyingjs/underlying) - composables that bind `animate()`, gestures, text effects and FLIP to a template ref, with automatic teardown on unmount.

Each composable returns a ref; bind it with `:ref`. The primitive is created on mount and disposed on unmount - no `onMounted` / `onBeforeUnmount` plumbing.

## Install

```sh
npm i @underlying/vue
```

Vue 3.4 or newer (peer). The core packages (`@underlying/core`, `gestures`, `text`, `flip`) come along as dependencies.

## Use

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useAnimate, useDraggable, useTilt, useReveal, useReorder } from '@underlying/vue'

const open = ref(false)
const panel = useAnimate<HTMLDivElement>(() => ({ x: open.value ? 240 : 0 }), { stiffness: 320 })
const card = useTilt<HTMLDivElement>()
const title = useReveal<HTMLHeadingElement>({ by: 'words' })
</script>

<template>
  <div :ref="panel">
    <h2 :ref="title">A masked, word-by-word reveal</h2>
    <div :ref="card" class="card" />
  </div>
</template>
```

## Composables

| Composable | Wraps | Notes |
| --- | --- | --- |
| `useAnimate(targets, options?)` | `animate()` | **Reactive** - `targets` is a ref / getter / object; retargets when it changes. |
| `useDraggable(options?)` | `draggable()` | Momentum-aware dragging. |
| `useTilt(options?)` | `tilt()` | 3D card tilt toward the pointer. |
| `useMagnetic(options?)` | `magnetic()` | Magnetic pull within a radius. |
| `useDepth(options?)` | `depth()` | Pointer-driven 2.5D parallax. |
| `useAmbient(options?)` | `ambient()` | Perpetual idle self-animation. |
| `useInteractive(options?)` | `interactive()` | Declarative hover / press states, keyboard-aware. |
| `useSplit(options?)` | `split()` | Split text into lines / words / chars. |
| `useReveal(options?)` | `reveal()` | Masked per-piece reveal. |
| `useTypewriter(text, options?)` | `typewriter()` | Typewriter effect. |
| `useScramble(text, options?)` | `scramble()` | Scramble-in effect. |
| `useReorder(options?)` | `reorder()` | Drag-to-reorder the ref'd container's children. |

Options are read at mount, except `useAnimate`, which retargets reactively when its `targets` source changes. Everything cleans itself up when the component unmounts.

## License

MIT
