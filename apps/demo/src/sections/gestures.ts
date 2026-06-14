import { animatable, animate, bindStyle, releaseStyle, setStyle } from '@underlying/core'
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
