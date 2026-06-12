/** Easing over normalized progress [0, 1] -> [0, 1]. */
export type Easing = (progress: number) => number

export const linear: Easing = (p) => p
export const easeInCubic: Easing = (p) => p * p * p
export const easeOutCubic: Easing = (p) => 1 - (1 - p) ** 3
export const easeInOutCubic: Easing = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2)
