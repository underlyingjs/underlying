// A lazily-attached, shared pointer tracker. One window listener fans the live
// pointer position out to every subscriber, so pointer-reactive primitives
// (magnetic, and the cursor follower to come) all read the same pointer without
// each adding its own listener. Touch is ignored - these effects are for a fine
// pointer. The window listener detaches once the last subscriber leaves.

type Listener = (x: number, y: number) => void

const listeners = new Set<Listener>()
let attached = false
let lastX = 0
let lastY = 0
let known = false

const onMove = (event: PointerEvent): void => {
  if (event.pointerType === 'touch') return
  lastX = event.clientX
  lastY = event.clientY
  known = true
  for (const listener of [...listeners]) listener(lastX, lastY)
}

const attach = (): void => {
  if (attached || typeof window === 'undefined') return
  window.addEventListener('pointermove', onMove, { passive: true })
  attached = true
}

const detach = (): void => {
  if (!attached) return
  window.removeEventListener('pointermove', onMove)
  attached = false
}

/** Subscribe to the live pointer position in px (fine pointers only). Returns an unsubscribe. */
export function onPointerMove(listener: Listener): () => void {
  attach()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) detach()
  }
}

/** The last seen pointer position; `known` is false until the first move. Lets a new follower start where the cursor already is, not at the origin. */
export function currentPointer(): { x: number; y: number; known: boolean } {
  return { x: lastX, y: lastY, known }
}
