import { animate } from '@underlying/core'
import { draggable } from '@underlying/gestures'
import { typewriter } from '@underlying/text'
import { button, h, type Section } from '../showcase'

// The docs site is vanilla, so these demos run the SAME primitive the adapter
// binds (animate / draggable / typewriter) - what you see is exactly what the
// hook, composable or directive produces, minus the framework glue shown in the
// code panel. The adapters map 1:1 onto the primitives; only the lifetime differs.

export const reactAdapter: Section = {
  id: 'adapter-react',
  group: 'Adapters',
  title: 'React',
  tagline: 'Hooks that bind a primitive to a ref, cleaned up on unmount.',
  description: `
    <p><code>@underlying/react</code> is a thin hook layer. <code>useAnimate</code>
    springs the ref'd element toward its targets and <em>retargets</em> the same live
    channels whenever they change on re-render - interruptible, velocity conserved,
    never a restart. Gesture, text and FLIP hooks each bind their primitive on mount
    and tear it down on unmount. Setup runs in a layout effect (no first-paint flash)
    and is SSR-safe. The demo below is the vanilla <code>animate()</code> the hook
    drives. Toggle it.</p>`,
  code: `import { useAnimate, useDraggable, useReveal } from '@underlying/react'

function Panel({ open }: { open: boolean }) {
  const ref = useAnimate<HTMLDivElement>({ x: open ? 0 : 320 })   // retargets on change
  return <aside ref={ref} className="panel" />
}

// gestures, text and FLIP are hooks too:
const drag = useDraggable<HTMLDivElement>({ axis: 'x' })
const line = useReveal<HTMLHeadingElement>({ by: 'word' })`,
  api: `useAnimate(targets, options?)   // reactive: retargets on every render
useDraggable(options?)   useTilt(options?)       useMagnetic(options?)
useDepth(options?)       useAmbient(options?)    useInteractive(options?)
useSplit(options?)       useReveal(options?)     useReorder(options?)
useTypewriter(text, options?)   useScramble(text, options?)
// each returns a RefObject<T | null>; attach it to your element`,
  run(ctx) {
    const track = h('div', { style: 'position:absolute;inset:18px;display:flex;align-items:center' })
    const box = h('div', { class: 'obj obj--chip' })
    track.append(box)
    ctx.stage.append(track)
    const span = (): number => Math.max(0, track.getBoundingClientRect().width - 52)
    let open = true
    ctx.controls.append(
      button('toggle panel', () => {
        open = !open
        animate(box, { x: open ? 0 : span() }, { stiffness: 260, damping: 26 })
      }),
    )
  },
}

export const vueAdapter: Section = {
  id: 'adapter-vue',
  group: 'Adapters',
  title: 'Vue',
  tagline: 'Composables that bind a primitive to a template ref.',
  description: `
    <p><code>@underlying/vue</code> mirrors the React surface as composables.
    <code>useAnimate</code> takes a ref, a getter or a plain object, and retargets
    when the reactive source changes; the rest bind a gesture, text or FLIP primitive
    on mount and dispose it on unmount. Everything is <code>onMounted</code>-scoped,
    so it is SSR-safe. The demo runs the vanilla <code>draggable()</code> that
    <code>useDraggable</code> binds - grab it and fling.</p>`,
  code: `<script setup lang="ts">
import { ref } from 'vue'
import { useAnimate, useDraggable } from '@underlying/vue'

const open = ref(true)
const panel = useAnimate<HTMLElement>(() => ({ x: open.value ? 0 : 320 }))
const handle = useDraggable<HTMLDivElement>({ axis: 'x' })
</script>

<template>
  <aside :ref="panel" class="panel" />
  <div :ref="handle" class="card" />
</template>`,
  api: `useAnimate(targets, options?)   // targets: Ref | getter | object
useDraggable(options?)   useTilt(options?)       useMagnetic(options?)
useDepth(options?)       useAmbient(options?)    useInteractive(options?)
useSplit(options?)       useReveal(options?)     useReorder(options?)
useTypewriter(text, options?)   useScramble(text, options?)
// each returns a Ref<T | null>; bind it with :ref in your template`,
  run(ctx) {
    const track = h('div', { style: 'position:absolute;inset:18px;display:flex;align-items:center' })
    const card = h('div', { class: 'obj obj--chip', style: 'cursor:grab' })
    track.append(card)
    ctx.stage.append(track)
    const handle = draggable(card, { axis: 'x' })
    ctx.onCleanup(() => handle.dispose())
  },
}

export const angularAdapter: Section = {
  id: 'adapter-angular',
  group: 'Adapters',
  title: 'Angular',
  tagline: 'Standalone directives that bind a primitive to your elements.',
  description: `
    <p><code>@underlying/angular</code> ships the same set as standalone directives -
    import <code>UNDERLYING_DIRECTIVES</code> and drop them into a template.
    <code>[uAnimate]</code> is signal-reactive: bind an expression and the host springs
    to each new value. Primitives are created <em>outside</em> the Angular zone (their
    frames never trip change detection) and are skipped during SSR. The demo runs the
    vanilla <code>typewriter()</code> that <code>[uTypewriter]</code> binds.</p>`,
  code: `import { Component, signal } from '@angular/core'
import { UNDERLYING_DIRECTIVES } from '@underlying/angular'

@Component({
  standalone: true,
  imports: [...UNDERLYING_DIRECTIVES],
  template: \`
    <aside uAnimate [uAnimate]="{ x: open() ? 0 : 320 }"></aside>
    <div uDraggable [uDraggable]="{ axis: 'x' }"></div>
    <h1 [uTypewriter]="'Physics-first.'"></h1>
  \`,
})
export class Panel {
  open = signal(true)
}`,
  api: `// selectors (import UNDERLYING_DIRECTIVES for all of them):
[uAnimate] [uAnimateOptions]     [uDraggable]   [uTilt]        [uMagnetic]
[uDepth]   [uAmbient]            [uInteractive] [uSplit]       [uReveal]
[uReorder] [uTypewriter] [uTypewriterOptions]  [uScramble] [uScrambleOptions]`,
  run(ctx) {
    const line = h('h2', {
      style: 'margin:0;font-size:26px;font-weight:600;color:var(--encre)',
      'aria-label': 'Physics-first motion.',
    })
    ctx.stage.append(h('div', { style: 'position:absolute;inset:18px;display:flex;align-items:center' }, line))
    const play = (): void => {
      const handle = typewriter(line, 'Physics-first motion.', { duration: 1400 })
      ctx.onCleanup(() => handle.stop())
    }
    play()
    ctx.controls.append(button('replay', () => { line.textContent = ''; play() }))
  },
}
