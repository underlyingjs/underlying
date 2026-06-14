/**
 * Map `smooth` seconds to a follow() spring stiffness, read as the catch-up
 * time constant: smooth 0.1 -> 100 (follow's own default stiffness), softer and
 * slower as smooth grows. Shared by scrub and parallax so the feel matches.
 */
export const stiffnessFor = (smooth: number): number => 1 / (smooth * smooth)
