import { animatable, animate, bindStyle, releaseStyle, setStyle } from '@underlying/core'
import { cursor, draggable, magnetic, observe, tilt } from '@underlying/gestures'
import { button, dropdown, h, type Section } from '../showcase'

/** Smoothed pointer velocity in px/s over a ~50 ms window. */
class VelocityTracker {
  private value = 0
  private lastPosition = 0
  private lastTimeMs = 0
  start(position: number, timeMs: number): void {
    this.value = 0
    this.lastPosition = position
    this.lastTimeMs = timeMs
  }
  sample(position: number, timeMs: number): void {
    const dt = (timeMs - this.lastTimeMs) / 1000
    if (dt <= 0) return
    const instantaneous = (position - this.lastPosition) / dt
    const alpha = 1 - Math.exp(-dt / 0.05)
    this.value += (instantaneous - this.value) * alpha
    this.lastPosition = position
    this.lastTimeMs = timeMs
  }
  read(timeMs: number): number {
    return timeMs - this.lastTimeMs > 80 ? 0 : this.value
  }
}

export const gestures: Section = {
  id: 'gestures',
  group: 'Gestures',
  title: 'Drag & release',
  tagline: 'Hand a gesture\'s velocity straight into a spring or an inertial glide.',
  description: `
    <p>The hard part of gestures is the handoff: at release, the motion must
    inherit the finger's velocity seamlessly. Because every value carries its
    velocity, that handoff is one argument. Grab the chip, fling it - it springs
    back or glides on bounded inertia, the viewport edges acting as rubber-band
    boundaries.</p>`,
  code: `import { animatable, bindStyle } from '@underlying/core'

const x = animatable(0), y = animatable(0)
bindStyle(chip, { x, y })

// on release, seed the gesture velocity:
x.spring(0, { velocity: gestureVx })                  // spring back, with momentum
x.decay({ velocity: gestureVx, min: 0, max: width })  // or glide, rubber-band edges`,
  api: `interface SetOptions { velocity?: number }
animatable(initial).spring(target, { velocity })
animatable(initial).decay({ velocity, min, max })`,
  run(ctx) {
    const field = h('div', { style: 'position:absolute;inset:0;touch-action:none;cursor:grab' })
    const chip = h('div', { class: 'obj obj--chip', style: 'position:absolute;left:0;top:0' })
    field.append(chip)
    ctx.stage.append(field)

    const rect = () => field.getBoundingClientRect()
    const start = { x: rect().width / 2 - 26, y: rect().height / 2 - 26 }
    const x = animatable(start.x)
    const y = animatable(start.y)
    const dispose = bindStyle(chip, { x, y })
    ctx.onCleanup(dispose)

    const vx = new VelocityTracker()
    const vy = new VelocityTracker()
    let dragging = false
    let grabX = 0
    let grabY = 0
    let mode = 'inertia'

    chip.addEventListener('pointerdown', (event) => {
      dragging = true
      chip.setPointerCapture(event.pointerId)
      field.style.cursor = 'grabbing'
      const box = rect()
      grabX = event.clientX - box.left - x.get()
      grabY = event.clientY - box.top - y.get()
      x.stop()
      y.stop()
      vx.start(x.get(), event.timeStamp)
      vy.start(y.get(), event.timeStamp)
    })
    chip.addEventListener('pointermove', (event) => {
      if (!dragging) return
      const box = rect()
      const nx = event.clientX - box.left - grabX
      const ny = event.clientY - box.top - grabY
      x.set(nx)
      y.set(ny)
      vx.sample(nx, event.timeStamp)
      vy.sample(ny, event.timeStamp)
    })
    chip.addEventListener('pointerup', (event) => {
      if (!dragging) return
      dragging = false
      field.style.cursor = 'grab'
      const box = rect()
      const releaseVx = vx.read(event.timeStamp)
      const releaseVy = vy.read(event.timeStamp)
      if (mode === 'inertia') {
        x.decay({ velocity: releaseVx, min: 0, max: box.width - 52 })
        y.decay({ velocity: releaseVy, min: 0, max: box.height - 52 })
      } else {
        x.spring(box.width / 2 - 26, { velocity: releaseVx, stiffness: 200, damping: 16 })
        y.spring(box.height / 2 - 26, { velocity: releaseVy, stiffness: 200, damping: 16 })
      }
    })

    ctx.controls.append(
      dropdown('on release', [
        { value: 'inertia', label: 'glide (bounded inertia)' },
        { value: 'spring', label: 'spring back to center' },
      ], (value) => (mode = value)),
    )
  },
}

export const pointerTilt: Section = {
  id: 'gestures-tilt',
  group: 'Gestures',
  title: 'tilt()',
  tagline: 'A card that tilts in 3D toward the cursor, springing flat on leave.',
  description: `
    <p><code>tilt()</code> maps the pointer's position over an element to two
    rotations a spring chases, so the card follows your cursor live and eases back
    to flat when you leave - interruptible, never a restart. The rotations are live
    values you can read or bind elsewhere, like draggable's x/y. Off on touch and
    under reduced motion. Hover the card.</p>`,
  code: `import { tilt } from '@underlying/gestures'

const t = tilt(card, { max: 14, scale: 1.04 })   // 14deg, a small hover lift
// t.rotateX / t.rotateY are live values you can read or compose
t.dispose()`,
  api: `interface TiltOptions { max?: number; perspective?: number; scale?: number;
  reverse?: boolean; spring?: SpringOptions }
interface Tilt { rotateX: Animatable; rotateY: Animatable; dispose(): void }
tilt(element: HTMLElement, options?: TiltOptions): Tilt`,
  run(ctx) {
    const card = h(
      'div',
      { class: 'tiltcard' },
      h('span', { class: 'tiltcard__tag' }, 'hover me'),
      h('span', { class: 'tiltcard__title' }, 'tilt()'),
    )
    const wrap = h('div', { style: 'position:absolute;inset:0;display:grid;place-items:center' }, card)
    ctx.stage.append(wrap)
    const t = tilt(card, { max: 14, scale: 1.04 })
    ctx.onCleanup(() => t.dispose())
  },
}

export const pointerMagnetic: Section = {
  id: 'gestures-magnetic',
  group: 'Gestures',
  title: 'magnetic()',
  tagline: 'A button that leans into the cursor and springs home on exit.',
  description: `
    <p><code>magnetic()</code> pulls an element toward the cursor once it comes
    within range - the element follows a fraction of the cursor's offset, chased by
    a spring, so it leans in as you approach and springs home when you leave,
    interruptible. The offset is exposed as live values (<code>x</code> /
    <code>y</code>), like draggable's. Off on touch and under reduced motion. Move
    near the button.</p>`,
  code: `import { magnetic } from '@underlying/gestures'

const m = magnetic(button, { strength: 0.4, radius: 140 })
// m.x / m.y are live values you can read or compose
m.dispose()`,
  api: `interface MagneticOptions { radius?: number; strength?: number; spring?: SpringOptions }
interface Magnetic { x: Animatable; y: Animatable; dispose(): void }
magnetic(element: HTMLElement, options?: MagneticOptions): Magnetic`,
  run(ctx) {
    const button = h('button', { class: 'magbtn' }, 'Get in touch')
    const wrap = h('div', { style: 'position:absolute;inset:0;display:grid;place-items:center' }, button)
    ctx.stage.append(wrap)
    const m = magnetic(button, { strength: 0.4, radius: 150 })
    ctx.onCleanup(() => m.dispose())
  },
}

export const pointerCursor: Section = {
  id: 'gestures-cursor',
  group: 'Gestures',
  title: 'cursor()',
  tagline: 'A custom cursor that trails the pointer and swells over links.',
  description: `
    <p><code>cursor()</code> drops in a custom cursor that trails the real pointer
    with spring lag and flips to an active state over interactive targets. The
    library only positions it - you give it its look with <code>.cursor</code> and
    <code>.cursor--active</code> CSS. It rides the shared pointer source, so it stays
    one listener alongside magnetic, and is hidden on touch and under reduced motion.
    Move over the panel - the ring swells over the links.</p>`,
  code: `import { cursor } from '@underlying/gestures'

const c = cursor({ targets: 'a, button' })   // a <div class="cursor"> on <body>
// style .cursor and .cursor--active in your CSS; the library only moves it
c.dispose()`,
  api: `interface CursorOptions { element?: HTMLElement; className?: string;
  targets?: string; spring?: SpringOptions }
interface Cursor { readonly element: HTMLElement; dispose(): void }
cursor(options?: CursorOptions): Cursor`,
  run(ctx) {
    const panel = h(
      'div',
      { class: 'cursorstage' },
      h('span', { class: 'cursorstage__tag' }, 'move over me'),
      h(
        'div',
        { class: 'cursorstage__links' },
        h('a', { class: 'cursorchip', href: '#gestures-cursor' }, 'Work'),
        h('a', { class: 'cursorchip', href: '#gestures-cursor' }, 'Studio'),
        h('a', { class: 'cursorchip', href: '#gestures-cursor' }, 'Contact'),
      ),
    )
    ctx.stage.append(panel)

    // The real primitive, page-wide; we just gate its visibility to the panel so
    // the demo stays contained and does not fight the native cursor elsewhere.
    const c = cursor({ className: 'uc', targets: '.cursorchip' })
    const ring = c.element
    const show = (): void => {
      ring.style.opacity = '1'
    }
    const hide = (): void => {
      ring.style.opacity = '0'
    }
    panel.addEventListener('pointerenter', show)
    panel.addEventListener('pointerleave', hide)
    ctx.onCleanup(() => {
      panel.removeEventListener('pointerenter', show)
      panel.removeEventListener('pointerleave', hide)
      c.dispose()
    })
  },
}

const CARD_NAMES = ['Aurora', 'Basalt', 'Cinder', 'Drift', 'Ember']

export const carousel: Section = {
  id: 'carousel',
  group: 'Gestures',
  title: 'Drag snap',
  tagline: 'Flick through cards - momentum picks the card, the ends rubber-band.',
  description: `
    <p>A carousel is a draggable that snaps. <code>draggable</code> takes
    <code>snap</code> targets (here a card-width grid) and, on release, projects where
    the flick's momentum would land, snaps to the nearest card, and springs there - a
    gentle drag steps one card, a hard flick skips several. <code>edgeResistance</code>
    rubber-bands the pull past the first and last card. All physics, all interruptible:
    grab it again mid-glide and it retargets from its live velocity.</p>`,
  code: `import { draggable } from '@underlying/gestures'

draggable(strip, {
  axis: 'x',
  bounds: { x: [-(cards - 1) * STEP, 0] },
  snap: { x: STEP },              // a card-width grid; momentum picks the target
  edgeResistance: 0.82,           // rubber-band past the ends
})`,
  api: `draggable(el: HTMLElement, options?: {
  axis?: 'x' | 'y' | 'both'
  bounds?: HTMLElement | { x?: [number, number]; y?: [number, number] }
  snap?: { x?: SnapTo; y?: SnapTo }   // increment | stops[] | (value) => value
  liveSnap?: boolean
  edgeResistance?: number             // 0 = free .. 1 = a hard wall
  release?: 'inertia' | 'spring' | 'free'
  spring?: SpringOptions; decay?: DecayOptions
}): { x: Animatable; y: Animatable; dispose(): void }`,
  run(ctx) {
    const count = CARD_NAMES.length
    const CARD = 120
    const STEP = CARD + 12 // card width + gap
    const strip = h('div', { class: 'carousel__strip' })
    CARD_NAMES.forEach((name, i) => {
      strip.append(
        h('div', { class: 'carousel__card' },
          h('span', { class: 'carousel__num' }, `0${i + 1}`),
          h('span', { class: 'carousel__label' }, name),
        ),
      )
    })
    const viewport = h('div', { class: 'carousel__viewport' }, strip)
    const dots = h('div', { class: 'carousel__dots' })
    const dotEls = CARD_NAMES.map(() => h('i', { class: 'carousel__dot' }))
    for (const dot of dotEls) dots.append(dot)
    ctx.stage.append(h('div', { class: 'carousel' }, viewport, dots))

    const drag = draggable(strip, {
      axis: 'x',
      bounds: { x: [-(count - 1) * STEP, 0] },
      snap: { x: STEP },
      edgeResistance: 0.82,
      spring: { stiffness: 200, damping: 26 },
    })
    const setActive = (): void => {
      const i = Math.min(count - 1, Math.max(0, Math.round(-drag.x.get() / STEP)))
      dotEls.forEach((dot, k) => dot.classList.toggle('carousel__dot--on', k === i))
    }
    const off = drag.x.on('change', setActive)
    setActive()
    ctx.onCleanup(() => {
      off()
      drag.dispose()
    })
  },
}

export const unifiedInput: Section = {
  id: 'observer',
  group: 'Gestures',
  title: 'observe()',
  tagline: 'One read of wheel, trackpad, and touch - drag or scroll to scrub.',
  description: `
    <p><code>observe()</code> unifies wheel, trackpad, pointer, and touch into one
    normalized stream: per-event deltas, accumulated totals, velocity, and a dominant
    axis, fed to directional and change callbacks with a tolerance dead-zone and a
    debounced stop. Here one handler scrubs the value - <em>drag up or scroll up</em>
    to raise it, down to lower it - identical on a mouse, a trackpad, or a phone. It is
    the seam under scroll-jacking, swipe nav, and design-tool number scrubbing.</p>`,
  code: `import { observe } from '@underlying/gestures'

observe({
  target: field,
  type: ['wheel', 'pointer'],
  preventDefault: true,
  onChange: (s) => { value = clamp(value - s.deltaY * 0.2, 0, 100) },
})`,
  api: `observe(options?: {
  target?: HTMLElement | Window
  type?: ('wheel' | 'pointer' | 'touch')[]
  tolerance?: number; dragMinimum?: number; wheelSpeed?: number
  axis?: 'x' | 'y'; preventDefault?: boolean
  onChange?(s: ObserverState): void   // also onPress/onRelease/onDrag/onWheel
  onUp?, onDown?, onLeft?, onRight?, onStop?: (s: ObserverState) => void
}): { enable(): void; disable(): void; dispose(): void; isEnabled: boolean }
// ObserverState: deltaX/Y, totalX/Y, velocityX/Y, axis, isDragging, event`,
  run(ctx) {
    let value = 50
    const num = h('span', { class: 'scrub__num' }, '50')
    const fill = h('i', { class: 'scrub__fill' })
    const field = h('div', { class: 'scrub__field' },
      num,
      h('div', { class: 'scrub__bar' }, fill),
      h('span', { class: 'scrub__hint' }, 'drag or scroll'),
    )
    ctx.stage.append(field)
    const render = (): void => {
      num.textContent = String(Math.round(value))
      fill.style.transform = `scaleX(${value / 100})`
    }
    render()
    const obs = observe({
      target: field,
      type: ['wheel', 'pointer'],
      preventDefault: true,
      wheelSpeed: 0.5,
      onChange: (state) => {
        value = Math.min(100, Math.max(0, value - state.deltaY * 0.2))
        render()
      },
    })
    ctx.onCleanup(() => obs.dispose())
  },
}

export const setRelease: Section = {
  id: 'set-release',
  group: 'Gestures',
  title: 'setStyle & releaseStyle',
  tagline: 'Coherent teleport with velocity handoff; an explicit uncache hatch.',
  description: `
    <p><code>setStyle()</code> teleports a property while keeping the channel state
    coherent (a raw <code>element.style</code> write would desync it), and can seed
    a velocity for a following spring to inherit. Drag the handle to resize the bar
    via <code>setStyle</code>; on release it springs to the nearest snap, carrying
    the drag momentum. <code>releaseStyle()</code> forgets the element and strips
    the inline styles we wrote.</p>`,
  code: `import { setStyle, animate, releaseStyle } from '@underlying/core'

const onDrag = (px) => setStyle(bar, { width: \`\${px}px\` })
const onRelease = (px, v) => {
  setStyle(bar, { width: \`\${px}px\` }, { velocity: v })   // seed momentum
  animate(bar, { width: '60%' })                          // spring inherits it
}
releaseStyle(bar)  // dispose channels, remove our inline styles, start cold`,
  api: `setStyle(el, targets, { velocity?: number }): void
releaseStyle(el: HTMLElement): void`,
  run(ctx) {
    const wrap = h('div', { style: 'width:100%;display:flex;flex-direction:column;gap:10px' })
    const row = h('div', { style: 'display:flex;align-items:center;gap:0' })
    const bar = h('div', { class: 'obj obj--bar', style: 'width:40%;height:48px' })
    const handle = h('div', { style: 'width:14px;height:48px;border-radius:6px;background:var(--sapin);cursor:ew-resize;touch-action:none;flex-shrink:0' })
    row.append(bar, handle)
    const note = h('div', { style: 'font-size:12px;color:var(--lichen)' }, 'drag the blue handle ->')
    wrap.append(row, note)
    ctx.stage.append(wrap)

    const vt = new VelocityTracker()
    let dragging = false
    handle.addEventListener('pointerdown', (event) => {
      dragging = true
      handle.setPointerCapture(event.pointerId)
      vt.start(bar.getBoundingClientRect().width, event.timeStamp)
    })
    handle.addEventListener('pointermove', (event) => {
      if (!dragging) return
      const width = Math.max(40, event.clientX - bar.getBoundingClientRect().left)
      setStyle(bar, { width: `${Math.round(width)}px` })
      vt.sample(width, event.timeStamp)
    })
    handle.addEventListener('pointerup', (event) => {
      if (!dragging) return
      dragging = false
      const width = bar.getBoundingClientRect().width
      const velocity = vt.read(event.timeStamp)
      setStyle(bar, { width: `${Math.round(width)}px` }, { velocity })
      const parent = bar.parentElement?.parentElement?.getBoundingClientRect().width ?? 1
      const ratio = width / parent
      const snap = ratio < 0.35 ? '25%' : ratio < 0.6 ? '50%' : ratio < 0.85 ? '75%' : '100%'
      note.textContent = `released -> spring to ${snap}`
      animate(bar, { width: snap }, { stiffness: 220, damping: 20 })
    })

    ctx.controls.append(
      button('releaseStyle (reset)', () => {
        releaseStyle(bar)
        bar.style.width = '40%'
        note.textContent = 'released the element - next animate() starts cold'
      }),
    )
  },
}
