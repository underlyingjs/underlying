// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { useAnimate, useDraggable, useReorder, useSplit } from './hooks'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useDraggable', () => {
  function Box() {
    const ref = useDraggable<HTMLDivElement>({ axis: 'x' })
    return <div ref={ref} data-testid="box" />
  }
  it('makes the element draggable on mount and restores it on unmount', () => {
    const { getByTestId, unmount } = render(<Box />)
    const box = getByTestId('box')
    expect(box.style.touchAction).toBe('none') // draggable() drove the element
    unmount()
    expect(box.style.touchAction).not.toBe('none') // disposed -> restored
  })
})

describe('useReorder', () => {
  function List() {
    const ref = useReorder<HTMLUListElement>()
    return (
      <ul ref={ref} data-testid="list">
        <li>one</li>
        <li>two</li>
      </ul>
    )
  }
  it('wires reorder on the list and cleans up on unmount', () => {
    const { getByTestId, unmount } = render(<List />)
    const item = getByTestId('list').querySelector('li') as HTMLElement
    expect(item.style.touchAction).toBe('none')
    unmount()
    expect(item.style.touchAction).not.toBe('none')
  })
})

describe('useSplit', () => {
  function Heading() {
    const ref = useSplit<HTMLParagraphElement>({ type: ['chars'] })
    return (
      <p ref={ref} data-testid="p">
        hi there
      </p>
    )
  }
  it('splits the text on mount and reverts on unmount', () => {
    const { getByTestId, unmount } = render(<Heading />)
    const p = getByTestId('p')
    expect(p.querySelectorAll('span').length).toBeGreaterThan(0)
    unmount()
    expect(p.textContent).toBe('hi there')
  })
})

describe('useAnimate', () => {
  function Toggler() {
    const [open, setOpen] = useState(false)
    const ref = useAnimate<HTMLDivElement>({ opacity: open ? 0 : 1 })
    return <div ref={ref} data-testid="a" onClick={() => setOpen((o) => !o)} />
  }
  it('animates on mount, retargets on state change, and releases on unmount without throwing', () => {
    expect(() => {
      const { getByTestId, unmount } = render(<Toggler />)
      getByTestId('a').click() // state change -> re-render -> retarget
      unmount() // releaseStyle
    }).not.toThrow()
  })
})
