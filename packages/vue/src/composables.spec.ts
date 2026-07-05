// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  useAmbient,
  useAnimate,
  useDepth,
  useDraggable,
  useInteractive,
  useMagnetic,
  useReorder,
  useReveal,
  useScramble,
  useSplit,
  useTilt,
  useTypewriter,
} from './composables'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useDraggable', () => {
  const Box = defineComponent({
    setup() {
      const el = useDraggable<HTMLDivElement>({ axis: 'x' })
      return () => h('div', { ref: el })
    },
  })
  it('makes the element draggable on mount and restores it on unmount', () => {
    const wrapper = mount(Box)
    const div = wrapper.element as HTMLElement
    expect(div.style.touchAction).toBe('none') // draggable() drove the element
    wrapper.unmount()
    expect(div.style.touchAction).not.toBe('none') // disposed -> restored
  })
})

describe('useReorder', () => {
  const List = defineComponent({
    setup() {
      const el = useReorder<HTMLUListElement>()
      return () => h('ul', { ref: el }, [h('li', 'one'), h('li', 'two')])
    },
  })
  it('wires reorder on the list and cleans up on unmount', () => {
    const wrapper = mount(List)
    const item = wrapper.element.querySelector('li') as HTMLElement
    expect(item.style.touchAction).toBe('none')
    wrapper.unmount()
    expect(item.style.touchAction).not.toBe('none')
  })
})

describe('useSplit', () => {
  const Heading = defineComponent({
    setup() {
      const el = useSplit<HTMLParagraphElement>({ type: ['chars'] })
      return () => h('p', { ref: el }, 'hi there')
    },
  })
  it('splits the text on mount and reverts on unmount', () => {
    const wrapper = mount(Heading)
    const p = wrapper.element as HTMLElement
    expect(p.querySelectorAll('span').length).toBeGreaterThan(0)
    wrapper.unmount()
    expect(p.textContent).toBe('hi there')
  })
})

// The pointer gestures bind a transform to the element synchronously on mount
// (bindStyle writes the current values at bind time), so an inline `transform` is
// the observable proof the primitive drove the element. Disposal removes the
// listeners, which is not observable through the DOM, so we assert a clean unmount.
describe('useTilt', () => {
  const Card = defineComponent({
    setup() {
      const el = useTilt<HTMLDivElement>()
      return () => h('div', { ref: el })
    },
  })
  it('drives a transform on mount and disposes cleanly on unmount', () => {
    const wrapper = mount(Card)
    expect((wrapper.element as HTMLElement).style.transform).toContain('perspective')
    expect(() => wrapper.unmount()).not.toThrow()
  })
})

describe('useMagnetic', () => {
  const Button = defineComponent({
    setup() {
      const el = useMagnetic<HTMLButtonElement>()
      return () => h('button', { ref: el })
    },
  })
  it('drives a transform on mount and disposes cleanly on unmount', () => {
    const wrapper = mount(Button)
    expect((wrapper.element as HTMLElement).style.transform).toContain('translate3d')
    expect(() => wrapper.unmount()).not.toThrow()
  })
})

describe('useDepth', () => {
  const Layer = defineComponent({
    setup() {
      const el = useDepth<HTMLDivElement>()
      return () => h('div', { ref: el })
    },
  })
  it('drives a transform on mount and disposes cleanly on unmount', () => {
    const wrapper = mount(Layer)
    expect((wrapper.element as HTMLElement).style.transform).toContain('translate3d')
    expect(() => wrapper.unmount()).not.toThrow()
  })
})

describe('useAmbient', () => {
  const Blob = defineComponent({
    setup() {
      const el = useAmbient<HTMLDivElement>()
      return () => h('div', { ref: el })
    },
  })
  it('self-animates a transform on mount and disposes cleanly on unmount', () => {
    const wrapper = mount(Blob)
    expect((wrapper.element as HTMLElement).style.transform).not.toBe('') // breathe/drift bind the transform
    expect(() => wrapper.unmount()).not.toThrow()
  })
})

describe('useInteractive', () => {
  const Chip = defineComponent({
    setup() {
      const el = useInteractive<HTMLDivElement>({ hover: { scale: 1.1 } })
      return () => h('div', { ref: el })
    },
  })
  it('binds the hover channel on mount and disposes cleanly on unmount', () => {
    const wrapper = mount(Chip)
    expect((wrapper.element as HTMLElement).style.transform).toContain('scale') // rest value of the hover channel
    expect(() => wrapper.unmount()).not.toThrow()
  })
})

describe('useReveal', () => {
  const Headline = defineComponent({
    setup() {
      const el = useReveal<HTMLParagraphElement>({ by: 'words' })
      return () => h('p', { ref: el }, 'hi there')
    },
  })
  it('splits the text for the reveal on mount and reverts on unmount', () => {
    const wrapper = mount(Headline)
    const p = wrapper.element as HTMLElement
    expect(p.querySelectorAll('span').length).toBeGreaterThan(0)
    wrapper.unmount()
    expect(p.textContent).toBe('hi there')
  })
})

describe('useTypewriter', () => {
  const Line = defineComponent({
    setup() {
      const el = useTypewriter<HTMLSpanElement>('typed')
      return () => h('span', { ref: el })
    },
  })
  it('writes the text into the element on mount and settles it on unmount', () => {
    const wrapper = mount(Line)
    const el = wrapper.element as HTMLElement
    // The final text is the accessible name from the first frame (aria-label),
    // while the visible, still-typing text lives in an aria-hidden holder.
    expect(el.getAttribute('aria-label')).toBe('typed')
    expect(el.querySelector('span[aria-hidden="true"]')).not.toBeNull()
    wrapper.unmount() // stop() -> snaps to the final text
    expect(el.textContent).toBe('typed')
  })
})

describe('useScramble', () => {
  const Line = defineComponent({
    setup() {
      const el = useScramble<HTMLSpanElement>('decoded')
      return () => h('span', { ref: el })
    },
  })
  it('writes the text into the element on mount and settles it on unmount', () => {
    const wrapper = mount(Line)
    const el = wrapper.element as HTMLElement
    expect(el.getAttribute('aria-label')).toBe('decoded')
    expect(el.querySelector('span[aria-hidden="true"]')).not.toBeNull()
    wrapper.unmount() // stop() -> snaps to the final text
    expect(el.textContent).toBe('decoded')
  })
})

describe('useAnimate', () => {
  it('writes an inline transform for its targets and releases the inline styles on unmount', async () => {
    const wrapper = mount({
      setup() {
        const el = useAnimate<HTMLDivElement>(() => ({ x: 120 }))
        return () => h('div', { ref: el })
      },
    })
    await nextTick()
    const el = wrapper.element as HTMLElement
    expect(el.style.transform).toContain('translate3d') // the x target is written inline
    wrapper.unmount() // onBeforeUnmount -> releaseStyle removes the inline styles it wrote
    expect(el.style.transform).toBe('')
    expect(el.style.opacity).toBe('')
  })

  it('animates on mount, retargets when a reactive source changes, and releases on unmount', async () => {
    const wrapper = mount({
      setup() {
        const open = ref(false)
        const el = useAnimate<HTMLDivElement>(() => ({ opacity: open.value ? 0 : 1 }))
        return () => h('div', { ref: el, onClick: () => (open.value = !open.value) })
      },
    })
    await nextTick()
    await wrapper.trigger('click') // reactive change -> watchEffect re-runs -> retarget
    expect(() => wrapper.unmount()).not.toThrow() // releaseStyle
  })
})
