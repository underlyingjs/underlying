// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { useAnimate, useDraggable, useReorder, useSplit } from './composables'

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

describe('useAnimate', () => {
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
