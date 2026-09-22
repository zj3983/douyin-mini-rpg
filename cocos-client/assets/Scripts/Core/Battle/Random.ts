export interface SeededRandom {
  readonly seed: number
  next(): number
  range(min: number, max: number): number
  int(minInclusive: number, maxInclusive: number): number
  pick<T>(items: readonly T[]): T
}

export function createSeededRandom(seed: number): SeededRandom {
  let state = (Math.floor(seed) >>> 0) || 1
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    seed,
    next,
    range(min: number, max: number) {
      return min + (max - min) * next()
    },
    int(minInclusive: number, maxInclusive: number) {
      return Math.floor(next() * (maxInclusive - minInclusive + 1)) + minInclusive
    },
    pick<T>(items: readonly T[]): T {
      return items[Math.floor(next() * items.length)]
    },
  }
}
