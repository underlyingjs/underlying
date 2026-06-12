export type TransformChannels = Partial<Record<'x' | 'y' | 'scale' | 'rotate', number>>

/**
 * Single source of the transform string format. The WAAPI delegation builds
 * its keyframes with it and the binding writes frames with it - both MUST
 * produce byte-identical strings for the same values, or handoffs would
 * visually jump.
 */
export function formatTransform(channels: TransformChannels): string {
  let transform = ''
  if (channels.x !== undefined || channels.y !== undefined) {
    transform = `translate3d(${channels.x ?? 0}px, ${channels.y ?? 0}px, 0)`
  }
  if (channels.scale !== undefined) {
    transform += `${transform === '' ? '' : ' '}scale(${channels.scale})`
  }
  if (channels.rotate !== undefined) {
    transform += `${transform === '' ? '' : ' '}rotate(${channels.rotate}deg)`
  }
  return transform
}
