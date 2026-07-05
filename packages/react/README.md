# @underlying/react

The React adapter for [underlying](https://github.com/underlyingjs/underlying) - hooks that bind `animate()`, gestures, text effects and FLIP to a ref, with automatic teardown on unmount.

Each hook returns a ref; attach it to your element. The primitive is created on mount and disposed on unmount - no `useEffect` plumbing, no manual `dispose()`.

## Install

```sh
npm i @underlying/react
```

React 18 or 19 (peer). The core packages (`@underlying/core`, `gestures`, `text`, `flip`) come along as dependencies.

## Use

```tsx
import { useAnimate, useDraggable, useTilt, useReveal, useReorder } from '@underlying/react'

function Panel({ open }: { open: boolean }) {
  const panel = useAnimate<HTMLDivElement>({ x: open ? 240 : 0 }, { stiffness: 320 })
  const handle = useDraggable<HTMLDivElement>({ axis: 'x' })
  const title = useReveal<HTMLHeadingElement>({ by: 'words' })

  return (
    <div ref={panel}>
      <h2 ref={title}>A masked, word-by-word reveal</h2>
      <div ref={handle} className="grabber" />
    </div>
  )
}
```

## Hooks

| Hook | Wraps | Notes |
| --- | --- | --- |
| `useAnimate(targets, options?)` | `animate()` | **Reactive** - retargets the same live channels whenever `targets` changes. |
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

Options are read at mount (the primitives read them once), except `useAnimate`, which retargets reactively when `targets` changes. Everything cleans itself up when the component unmounts.

## License

MIT
