// All randomness of the game goes through one seeded generator, so tests can replay any session.
export type Rng = () => number

/** mulberry32: small, fast and good enough for shuffling candies. */
export function seeded(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** An integer in [min, max], both included. */
export function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * A shuffled bag: every item comes out once before any comes out again, and the first item of a
 * new round is never the last one of the round before.
 */
export class Bag<T> {
  private items: T[] = []
  private last: T | undefined

  constructor(
    private readonly all: readonly T[],
    private readonly rng: Rng,
  ) {}

  next(): T {
    if (this.items.length === 0) {
      this.items = shuffle(this.rng, this.all)
      if (this.items.length > 1 && this.items[this.items.length - 1] === this.last) this.items.unshift(this.items.pop()!)
    }
    const item = this.items.pop()!
    this.last = item
    return item
  }
}

/** The game's generator: `?seed=` in the address makes it repeatable. */
export function gameSeed(search = typeof location === 'undefined' ? '' : location.search): number {
  const value = Number(new URLSearchParams(search).get('seed'))
  return Number.isFinite(value) && value > 0 ? value : Math.floor(Math.random() * 2 ** 31) + 1
}
