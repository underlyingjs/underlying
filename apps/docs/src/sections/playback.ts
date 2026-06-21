import { animatable, animate, bindStyle } from '@underlying/core'
import { animatePlayback, follow, playable } from '@underlying/core/playback'
import type { PlaybackHandle } from '@underlying/core/playback'
import { button, h, slider, type Section } from '../showcase'

const lane = (): HTMLElement =>
  h('div', { style: 'position:absolute;inset:18px;display:flex;align-items:center' })

const spanOf = (track: HTMLElement): number => Math.max(track.getBoundingClientRect().width - 52, 200)

export const pauseResume: Section = {
  id: 'playback-pause',
  group: 'Playback',
  title: 'animatePlayback()',
  tagline: 'Pause, resume, and reverse a running animation.',
  description: `
    <p>The opt-in <code>@underlying/core/playback</code> entry returns a richer
    handle. <code>animatePlayback()</code> is <code>animate()</code> with controls:
    a delegated tween rides the compositor, so <code>pause</code> / <code>play</code>
    / <code>reverse</code> are lossless and off the main thread. Launch, then
    interrupt the flight.</p>`,
  code: `import { animatePlayback } from '@underlying/core/playback'

const play = animatePlayback(box, { x: 280, rotate: 180 }, { duration: 1800 })
play.pause()     // freeze in place
play.play()      // resume the same trajectory
play.reverse()   // run the curve backward`,
  api: `interface PlaybackHandle {
  pause(): this; play(): this; reverse(): this
  timeScale(rate: number): this; seek(ms: number): this; progress(p?: number): this | number
}`,
  run(ctx) {
    const track = lane()
    const box = h('div', { class: 'obj obj--chip' })
    track.append(box)
    ctx.stage.append(track)
    let handle: PlaybackHandle | null = null
    let out = false
    const launch = (): void => {
      handle?.stop()
      out = !out
      handle = animatePlayback(box, { x: out ? spanOf(track) : 0, rotate: out ? 180 : 0 }, { duration: 1800 })
    }
    ctx.onCleanup(() => handle?.stop())
    ctx.controls.append(
      button('launch', launch),
      button('pause', () => handle?.pause()),
      button('resume', () => handle?.play()),
      button('reverse', () => handle?.reverse()),
    )
  },
}

export const lifecycle: Section = {
  id: 'playback-lifecycle',
  group: 'Playback',
  title: 'Lifecycle callbacks',
  tagline: 'Hook start, update, complete and interrupt to coordinate side effects.',
  description: `
    <p><code>onStart</code> / <code>onUpdate</code> / <code>onComplete</code> /
    <code>onInterrupt</code> fire at the lifecycle moments, so you can drive sound,
    analytics, DOM text or chained logic off them - on a value, a playback handle, or
    <code>animate()</code>. Press Play; press again mid-flight to get
    <code>onInterrupt</code> instead of <code>onComplete</code>.</p>`,
  code: `animate(card, { x: 150, rotate: 8 }, {
  duration: 700,
  onStart:     () => log('start'),
  onUpdate:    (v) => log('x = ' + Math.round(v.x)),
  onComplete:  () => log('complete'),
  onInterrupt: () => log('interrupted'),
})`,
  api: `interface AnimateOptions { /* ... */ onStart?(handle); onUpdate?(values, handle);
  onComplete?(handle); onInterrupt?(handle); scope?: object }
handle.eventCallback(event, fn | null)  // attach a callback after the fact`,
  run(ctx) {
    const card = h('div', { class: 'lifecard' }, h('span', { class: 'lifecard__t' }, 'card'))
    const logEl = h('ul', { class: 'lifelog' })
    ctx.stage.append(h('div', { class: 'lifegrid' }, h('div', { class: 'lifewrap' }, card), logEl))

    const log = (text: string, kind: string): void => {
      logEl.prepend(h('li', { class: `lifeline lifeline--${kind}` }, text))
      while (logEl.children.length > 7) logEl.lastChild?.remove()
    }
    let updates = 0
    const play = (): void => {
      updates = 0
      animate(
        card,
        { x: 150, rotate: 8, scale: 1.05 },
        {
          duration: 700,
          onStart: () => log('start', 'start'),
          onUpdate: (v) => {
            updates += 1
            if (updates % 5 === 0) log(`x = ${Math.round(v.x ?? 0)}`, 'update')
          },
          onComplete: () => {
            log('complete', 'complete')
            animate(card, { x: 0, rotate: 0, scale: 1 }, { duration: 450 })
          },
          onInterrupt: () => log('interrupted', 'interrupt'),
        },
      )
    }
    ctx.onCleanup(() => animate(card, { x: 0, rotate: 0, scale: 1 }, { duration: 0 }))
    ctx.controls.append(button('Play', play))
  },
}

export const slowMo: Section = {
  id: 'playback-timescale',
  group: 'Playback',
  title: 'timeScale()',
  tagline: 'Dilate time without changing the trajectory shape.',
  description: `
    <p>The integrator only ever steps by 1/120 s, so <code>timeScale</code> changes
    how many steps a frame consumes, never the step size. The same overshoot, the
    same path, slower or faster wall-clock. Drag the dial, then launch.</p>`,
  code: `const play = animatePlayback(box, { x: 280 }, { duration: 1400 })

play.timeScale(0.25)   // quarter speed, identical motion
play.timeScale(1)      // back to real time`,
  api: `timeScale(rate: number): this   // set the dilation; 0 acts like pause
timeScale(): number             // read the current rate`,
  run(ctx) {
    const track = lane()
    const box = h('div', { class: 'obj obj--chip' })
    track.append(box)
    ctx.stage.append(track)
    let handle: PlaybackHandle | null = null
    let scale = 0.4
    let out = false
    const launch = (): void => {
      handle?.stop()
      out = !out
      handle = animatePlayback(box, { x: out ? spanOf(track) : 0, rotate: out ? 360 : 0 }, { duration: 1400 })
      handle.timeScale(scale)
    }
    ctx.onCleanup(() => handle?.stop())
    ctx.controls.append(
      button('launch', launch),
      slider('timeScale', {
        min: 0.1,
        max: 2,
        value: scale,
        step: 0.05,
        onInput: (v) => {
          scale = v
          handle?.timeScale(v)
        },
      }),
    )
  },
}

export const scrub: Section = {
  id: 'playback-scrub',
  group: 'Playback',
  title: 'seek() and progress()',
  tagline: 'A duration tween is seekable from birth - drive the playhead by hand.',
  description: `
    <p>A tween is path-independent, so its playhead is just a value you set.
    Created <code>paused</code>, it waits for you. Drag the scrubber to run the
    motion forward and backward, frame-accurate.</p>`,
  code: `const clip = animatePlayback(box, { x: 280, rotate: 360 }, { duration: 2000, paused: true })

scrubber.addEventListener('input', () => clip.progress(scrubber.valueAsNumber / 100))`,
  api: `seek(timeMs: number): this       // jump the playhead to an absolute time (ms)
progress(p: number): this        // write normalized progress 0..1
progress(): number               // read it back`,
  run(ctx) {
    const track = lane()
    const box = h('div', { class: 'obj obj--chip' })
    track.append(box)
    ctx.stage.append(track)
    const clip = animatePlayback(box, { x: spanOf(track), rotate: 360 }, { duration: 2000, paused: true })
    ctx.onCleanup(() => clip.stop())
    ctx.controls.append(slider('progress', { min: 0, max: 100, value: 0, onInput: (v) => clip.progress(v / 100) }))
  },
}

export const bakedClip: Section = {
  id: 'playback-bake',
  group: 'Playback',
  title: 'bake()',
  tagline: 'Turn a live spring into a clip you can scrub and play again.',
  description: `
    <p>A live spring chases a target, so it has no timeline: you cannot rewind it.
    <code>bake()</code> runs the deterministic 1/120 s simulation to rest <em>once</em>
    and records the whole bounce into a seekable table, pixel-for-pixel identical to
    the live run. Press <strong>play</strong> to watch the recorded bounce, then drag
    the scrubber to step through the overshoot by hand, forward or backward. That is
    the bridge from physics to a timeline.</p>`,
  code: `import { animatable, bindStyle } from '@underlying/core'
import { playable } from '@underlying/core/playback'

const x = animatable(0)
bindStyle(box, { x })                                  // x -> box transform

const clip = playable(x).spring(240, { damping: 9, paused: true })
clip.bake()                                            // sample the bounce once

clip.progress(0.5)   // now seekable: jump anywhere on the recorded bounce`,
  api: `bake(options?: { maxDurationMs?: number }): boolean   // false if the motion never rests`,
  run(ctx) {
    const track = lane()
    const box = h('div', { class: 'obj obj--chip' })
    track.append(box)
    ctx.stage.append(track)

    const x = animatable(0)
    ctx.onCleanup(bindStyle(box, { x }))
    // Aim short of the edge so the underdamped overshoot stays inside the stage.
    const clip = playable(x).spring(spanOf(track) * 0.62, { stiffness: 120, damping: 9, paused: true })
    clip.bake()

    const scrubber = slider('progress', { min: 0, max: 100, value: 0, onInput: (v) => clip.progress(v / 100) })
    const range = scrubber.querySelector('input') as HTMLInputElement
    const durationMs = clip.duration() ?? 1000
    let raf = 0
    const play = (): void => {
      cancelAnimationFrame(raf)
      let start = 0
      const tick = (now: number): void => {
        if (start === 0) start = now
        const p = Math.min((now - start) / durationMs, 1)
        range.value = String(p * 100)
        range.dispatchEvent(new Event('input')) // moves the thumb and seeks the clip
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }
    ctx.onCleanup(() => {
      cancelAnimationFrame(raf)
      clip.stop()
      x.dispose()
    })
    ctx.controls.append(button('play', play), scrubber)
  },
}

export const momentumScrub: Section = {
  id: 'playback-follow',
  group: 'Playback',
  title: 'follow()',
  tagline: 'A value that springs toward a moving target - momentum scrub.',
  description: `
    <p>The scroll differentiator. <code>follow()</code> holds one spring whose
    target you move every frame; the value lags behind with conserved momentum,
    critically damped so it never overshoots. The target re-aims in place, with no
    per-frame allocation. Sweep the pointer across the lane.</p>`,
  code: `import { follow } from '@underlying/core/playback'

const lag = follow(0, { stiffness: 120, damping: 22 })   // ~critically damped
bindStyle(box, { x: lag.value })
lane.addEventListener('pointermove', (event) => lag.target(localX(event)))`,
  api: `follow(initial: number, options?: FollowOptions): {
  value: Animatable; target(next: number): void; stop(): void; dispose(): void
}`,
  run(ctx) {
    const track = h('div', {
      style: 'position:absolute;inset:18px;display:flex;align-items:center;cursor:crosshair',
    })
    const box = h('div', { class: 'obj obj--chip' })
    track.append(box)
    ctx.stage.append(track)
    const lag = follow(0, { stiffness: 120, damping: 22 })
    ctx.onCleanup(bindStyle(box, { x: lag.value }))
    ctx.onCleanup(() => lag.dispose())
    const localX = (event: PointerEvent): number => {
      const rect = track.getBoundingClientRect()
      return Math.max(0, Math.min(event.clientX - rect.left - 26, rect.width - 52))
    }
    track.addEventListener('pointerdown', (event) => lag.target(localX(event)))
    track.addEventListener('pointermove', (event) => lag.target(localX(event)))
  },
}
