import type { SpringOptions } from '../physics/spring'
import type { ToOptions } from '../physics/tween'
import type { Scheduler } from '../scheduler/scheduler'
import { animatable, type Animatable, type AnimationHandle } from './animatable'
import type { ChannelMeta, ParsedValue, ValueType } from './value-type'

/**
 * The bridge between one CSS value and the scalar physics: a value's channels
 * each become a plain Animatable, so springs, decay-grade velocity
 * conservation, interpolated exposure, exact rest snap, and reduced-motion
 * fast-forward are all INHERITED, not re-implemented. The group owns the shared
 * shape, the cached format string, and a generation counter (keyframe chains
 * read it to detect staleness). Aggregate handles fan out: `finished` resolves
 * when the last channel rests, `stop()` freezes them all.
 */
export interface ChannelGroup {
  readonly type: ValueType
  shape: string
  readonly channels: ReadonlyArray<Animatable>
  generation: number
  format(): string
  isAnimating(): boolean
  set(parsed: ParsedValue, options?: { velocity?: number }): void
  /** Same rendered pixels, new coordinate system: every channel set(pos*m, { velocity: vel*m }). */
  rebase(multiplier: number, shape: string): void
  spring(target: ParsedValue, options?: SpringOptions): AnimationHandle
  to(target: ParsedValue, options?: ToOptions): AnimationHandle
  onChange(listener: () => void): () => void
  stop(): void
  dispose(): void
}

export interface ChannelGroupOptions {
  scheduler?: Scheduler
}

const aggregate = (handles: AnimationHandle[]): AnimationHandle => ({
  finished: Promise.all(handles.map((handle) => handle.finished)).then(() => undefined),
  stop: () => {
    for (const handle of handles) handle.stop()
  },
})

export function channelGroup(
  type: ValueType,
  parsed: ParsedValue,
  options: ChannelGroupOptions = {},
): ChannelGroup {
  const scheduler = options.scheduler
  let shape = parsed.shape
  let metas = type.channels(shape)
  let generation = 0
  let cachedFormat: string | null = null
  const changeListeners = new Set<() => void>()

  const notify = (): void => {
    cachedFormat = null
    for (const listener of [...changeListeners]) listener()
  }

  const channels = parsed.channels.map((value) =>
    animatable(value, scheduler !== undefined ? { scheduler } : {}),
  )
  const unsubscribers = channels.map((channel) => channel.on('change', notify))
  // Reused scratch: one allocation for the channel count, refilled per format.
  const scratch: number[] = new Array<number>(channels.length)

  // Per-call options win; channel meta fills only the keys the call left absent;
  // anything still absent falls through to the animatable's own defaults. Never
  // assigns undefined to an optional key (exactOptionalPropertyTypes).
  const channelOptions = (base: SpringOptions, index: number): SpringOptions => {
    const meta: ChannelMeta | undefined = metas[index]
    const opts: SpringOptions = { ...base }
    if (meta !== undefined) {
      if (opts.restDelta === undefined && meta.restDelta !== undefined) opts.restDelta = meta.restDelta
      if (opts.restSpeed === undefined && meta.restSpeed !== undefined) opts.restSpeed = meta.restSpeed
    }
    return opts
  }

  return {
    type,
    get shape() {
      return shape
    },
    set shape(next: string) {
      shape = next
    },
    channels,
    get generation() {
      return generation
    },
    set generation(next: number) {
      generation = next
    },
    format() {
      if (cachedFormat !== null) return cachedFormat
      for (let i = 0; i < channels.length; i++) scratch[i] = channels[i]!.get()
      cachedFormat = type.format(scratch, shape)
      return cachedFormat
    },
    isAnimating() {
      return channels.some((channel) => channel.isAnimating())
    },
    set(next, setOptions = {}) {
      generation += 1
      shape = next.shape
      metas = type.channels(shape)
      cachedFormat = null
      const velocity = setOptions.velocity
      for (let i = 0; i < channels.length; i++) {
        // Broadcast a scalar velocity to every channel: exact for single-channel
        // values (the gesture case), the documented approximation otherwise.
        channels[i]!.set(next.channels[i] ?? 0, velocity !== undefined ? { velocity } : undefined)
      }
    },
    rebase(multiplier, nextShape) {
      generation += 1
      shape = nextShape
      metas = type.channels(shape)
      cachedFormat = null
      for (const channel of channels) {
        channel.set(channel.get() * multiplier, { velocity: channel.velocity() * multiplier })
      }
    },
    spring(target, springOptions = {}) {
      generation += 1
      return aggregate(
        channels.map((channel, i) => channel.spring(target.channels[i] ?? 0, channelOptions(springOptions, i))),
      )
    },
    to(target, toOptions = {}) {
      generation += 1
      return aggregate(channels.map((channel, i) => channel.to(target.channels[i] ?? 0, toOptions)))
    },
    onChange(listener) {
      changeListeners.add(listener)
      return () => {
        changeListeners.delete(listener)
      }
    },
    stop() {
      generation += 1
      for (const channel of channels) channel.stop()
    },
    dispose() {
      for (const unsubscribe of unsubscribers) unsubscribe()
      for (const channel of channels) channel.dispose()
      changeListeners.clear()
    },
  }
}
