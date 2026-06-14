import { describe, expect, it } from 'vitest'
import { resolvePosition, type ResolveContext } from './position'

const ctx = (over: Partial<ResolveContext> = {}): ResolveContext => ({
  cursorMs: 1000,
  prevStartMs: 600,
  prevEndMs: 900,
  durationMs: 1200,
  labels: new Map([
    ['intro', 200],
    ['settled', 800],
  ]),
  ...over,
})

describe('resolvePosition', () => {
  it('absolute numbers, negative clamped to 0', () => {
    expect(resolvePosition(0, ctx())).toBe(0)
    expect(resolvePosition(450, ctx())).toBe(450)
    expect(resolvePosition(-100, ctx())).toBe(0)
  })

  it('< (prev start) and > (prev end) with offsets', () => {
    expect(resolvePosition('<', ctx())).toBe(600)
    expect(resolvePosition('>', ctx())).toBe(900)
    expect(resolvePosition('<100', ctx())).toBe(700)
    expect(resolvePosition('<-100', ctx())).toBe(500)
    expect(resolvePosition('>+=50', ctx())).toBe(950)
    expect(resolvePosition('>-=200', ctx())).toBe(700)
  })

  it('+= / -= are relative to the timeline end', () => {
    expect(resolvePosition('+=100', ctx())).toBe(1300)
    expect(resolvePosition('-=300', ctx())).toBe(900)
    expect(resolvePosition('-=2000', ctx())).toBe(0) // clamped
  })

  it('labels, with offsets', () => {
    expect(resolvePosition('settled', ctx())).toBe(800)
    expect(resolvePosition('settled+=100', ctx())).toBe(900)
    expect(resolvePosition('intro-=50', ctx())).toBe(150)
  })

  it('unknown label falls back to the cursor', () => {
    expect(resolvePosition('nope', ctx())).toBe(1000)
    expect(resolvePosition('nope+=100', ctx())).toBe(1100)
  })

  it('numeric string is absolute; empty string is the cursor', () => {
    expect(resolvePosition('250', ctx())).toBe(250)
    expect(resolvePosition('', ctx())).toBe(1000)
  })
})
