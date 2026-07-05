// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
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
} from './hooks'

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

// The pointer gestures all bind a transform to the element synchronously on mount
// (bindStyle writes the current values at bind time), so an inline `transform` is
// the observable proof the primitive drove the element. Disposal removes the
// listeners; that is not observable through the DOM, so we assert unmount is clean.
describe('useTilt', () => {
  function Card() {
    const ref = useTilt<HTMLDivElement>()
    return <div ref={ref} data-testid="card" />
  }
  it('drives a transform on mount and disposes cleanly on unmount', () => {
    const { getByTestId, unmount } = render(<Card />)
    const card = getByTestId('card')
    expect(card.style.transform).toContain('perspective')
    expect(() => unmount()).not.toThrow()
  })
})

describe('useMagnetic', () => {
  function Button() {
    const ref = useMagnetic<HTMLButtonElement>()
    return <button ref={ref} data-testid="btn" />
  }
  it('drives a transform on mount and disposes cleanly on unmount', () => {
    const { getByTestId, unmount } = render(<Button />)
    const btn = getByTestId('btn')
    expect(btn.style.transform).toContain('translate3d')
    expect(() => unmount()).not.toThrow()
  })
})

describe('useDepth', () => {
  function Layer() {
    const ref = useDepth<HTMLDivElement>()
    return <div ref={ref} data-testid="layer" />
  }
  it('drives a transform on mount and disposes cleanly on unmount', () => {
    const { getByTestId, unmount } = render(<Layer />)
    const layer = getByTestId('layer')
    expect(layer.style.transform).toContain('translate3d')
    expect(() => unmount()).not.toThrow()
  })
})

describe('useAmbient', () => {
  function Blob() {
    const ref = useAmbient<HTMLDivElement>()
    return <div ref={ref} data-testid="blob" />
  }
  it('self-animates a transform on mount and disposes cleanly on unmount', () => {
    const { getByTestId, unmount } = render(<Blob />)
    const blob = getByTestId('blob')
    expect(blob.style.transform).not.toBe('') // breathe/drift bind the transform
    expect(() => unmount()).not.toThrow()
  })
})

describe('useInteractive', () => {
  function Chip() {
    const ref = useInteractive<HTMLDivElement>({ hover: { scale: 1.1 } })
    return <div ref={ref} data-testid="chip" />
  }
  it('binds the hover channel on mount and disposes cleanly on unmount', () => {
    const { getByTestId, unmount } = render(<Chip />)
    const chip = getByTestId('chip')
    expect(chip.style.transform).toContain('scale') // rest value of the hover channel
    expect(() => unmount()).not.toThrow()
  })
})

describe('useReveal', () => {
  function Headline() {
    const ref = useReveal<HTMLParagraphElement>({ by: 'words' })
    return (
      <p ref={ref} data-testid="reveal">
        hi there
      </p>
    )
  }
  it('splits the text for the reveal on mount and reverts on unmount', () => {
    const { getByTestId, unmount } = render(<Headline />)
    const p = getByTestId('reveal')
    expect(p.querySelectorAll('span').length).toBeGreaterThan(0)
    unmount()
    expect(p.textContent).toBe('hi there')
  })
})

describe('useTypewriter', () => {
  function Line() {
    const ref = useTypewriter<HTMLSpanElement>('typed')
    return <span ref={ref} data-testid="tw" />
  }
  it('writes the text into the element on mount and settles it on unmount', () => {
    const { getByTestId, unmount } = render(<Line />)
    const el = getByTestId('tw')
    // The final text is the accessible name from the first frame (aria-label),
    // while the visible, still-typing text lives in an aria-hidden holder.
    expect(el.getAttribute('aria-label')).toBe('typed')
    expect(el.querySelector('span[aria-hidden="true"]')).not.toBeNull()
    unmount() // stop() -> snaps to the final text
    expect(el.textContent).toBe('typed')
  })
})

describe('useScramble', () => {
  function Line() {
    const ref = useScramble<HTMLSpanElement>('decoded')
    return <span ref={ref} data-testid="sc" />
  }
  it('writes the text into the element on mount and settles it on unmount', () => {
    const { getByTestId, unmount } = render(<Line />)
    const el = getByTestId('sc')
    expect(el.getAttribute('aria-label')).toBe('decoded')
    expect(el.querySelector('span[aria-hidden="true"]')).not.toBeNull()
    unmount() // stop() -> snaps to the final text
    expect(el.textContent).toBe('decoded')
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

  function Mover() {
    const ref = useAnimate<HTMLDivElement>({ x: 120 })
    return <div ref={ref} data-testid="m" />
  }
  it('writes an inline transform for its targets and releases it on unmount', () => {
    const { getByTestId, unmount } = render(<Mover />)
    const el = getByTestId('m')
    expect(el.style.transform).toContain('translate3d') // the x target is written inline
    unmount() // the cleanup captured the element on mount, so releaseStyle runs
    expect(el.style.transform).toBe('') // inline styles released, channels disposed
  })
})
