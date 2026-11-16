// Orders, hidden levels, the plan of a day and what arrives when (DESIGN.md §3.2-3.3).
// Every range here is checked over many seeds by tests/unit/orders.test.ts.
import { int, pick, shuffle, type Rng } from './random'

export type OrderType = 'A' | 'B' | 'C' | 'D' | 'E'
export type Level = 1 | 2 | 3

/**
 * The order types in the order they arrive at her shop (§9): day 1 «طلب», day 2 the ready box,
 * then «كيسين», «توصيل» and «كيس واحد», one per morning.
 */
export const ARRIVAL_ORDER: readonly OrderType[] = ['A', 'C', 'B', 'D', 'E']
export const ORDER_TYPES: readonly OrderType[] = ARRIVAL_ORDER

export const DAY_CUSTOMERS = 5
/** A new thing arrives after a day with at least this many first-bell deliveries... */
export const ARRIVAL_FIRST_BELLS = 3
/** ...or after this many days, whatever happened. */
export const ARRIVAL_DAYS = 2

export type CustomerId = 'rabbit' | 'cat' | 'duck' | 'hedgehog' | 'panda' | 'frog' | 'fox' | 'penguin'

/** The three goods (§8.2): chocolate and strawberry bonbons, and Takis. */
export type Good = 'choc' | 'candy' | 'takis'
export const GOODS: readonly Good[] = ['choc', 'candy', 'takis']

export interface Customer {
  id: CustomerId
  /** The customer's voice: the recorded lines at this playback rate. */
  rate: number
  /** Joins the shop after this many customers served (announced with «g/new-customer»). */
  after: number
  /** Their own greetings and thanks, from the recorded lines (no new lines). */
  hi: readonly string[]
  thanks: readonly string[]
}

export const CUSTOMERS: readonly Customer[] = [
  { id: 'rabbit', rate: 1.3, after: 0, hi: ['c/hi-1', 'c/hi-2'], thanks: ['c/thanks-1', 'c/thanks-2', 'c/thanks-6'] },
  { id: 'cat', rate: 1.18, after: 0, hi: ['c/hi-3', 'c/hi-4'], thanks: ['c/thanks-3', 'c/thanks-4', 'c/thanks-1'] },
  { id: 'duck', rate: 1.35, after: 0, hi: ['c/hi-1', 'c/hi-4'], thanks: ['c/thanks-5', 'c/thanks-2', 'c/thanks-6'] },
  { id: 'hedgehog', rate: 1.24, after: 5, hi: ['c/hi-2', 'c/hi-3'], thanks: ['c/thanks-3', 'c/thanks-6', 'c/thanks-2'] },
  { id: 'panda', rate: 1.12, after: 10, hi: ['c/hi-3', 'c/hi-4'], thanks: ['c/thanks-1', 'c/thanks-3', 'c/thanks-4'] },
  { id: 'frog', rate: 1.32, after: 16, hi: ['c/hi-1', 'c/hi-2'], thanks: ['c/thanks-2', 'c/thanks-5', 'c/thanks-6'] },
  { id: 'fox', rate: 1.2, after: 24, hi: ['c/hi-2', 'c/hi-4'], thanks: ['c/thanks-4', 'c/thanks-1', 'c/thanks-5'] },
  { id: 'penguin', rate: 1.28, after: 34, hi: ['c/hi-1', 'c/hi-3'], thanks: ['c/thanks-6', 'c/thanks-3', 'c/thanks-5'] },
]

/** The customers who know her shop after `served` customers. */
export function knownCustomers(served: number): CustomerId[] {
  return CUSTOMERS.filter((c) => served >= c.after).map((c) => c.id)
}

export function customerOf(id: CustomerId): Customer {
  return CUSTOMERS.find((c) => c.id === id) ?? CUSTOMERS[0]!
}

export interface Order {
  type: OrderType
  level: Level
  /** What the customer wants in all. */
  n: number
  /**
   * A: n. B: 0 (any split). C: the pieces already in the ready box. D: the house Dabdoob starts at.
   * E: the first number on the order card.
   */
  a: number
  /** A, B: 0. C: how many more. D: how many houses to ride. E: the second number on the card. */
  b: number
  customer: CustomerId
  /** The one good of the order (§10.1: an order never adds or mixes two goods). */
  good: Good
  /** E level 3: the small number comes first on the card («٢ + ٦»). */
  smallFirst?: boolean
}

const fact = (a: number, b: number) => `${a}+${b}`

/** The (a, b) pairs a ready-box order takes at a level. */
export function readyBoxFits(level: Level, a: number, b: number): boolean {
  if (a + b > 10) return false
  if (level === 1) return a >= 2 && a <= 5 && b >= 1 && b <= 2
  if (level === 2) return a >= 3 && a <= 7 && b >= 1 && b <= 3
  return a >= 4 && a <= 8 && b >= 1 && b <= 4
}

/** The delivery ride (D): sum ≤ 7 with 1-3 houses, then sum ≤ 10 with 1-4. */
export function rideFits(level: Level, a: number, b: number): boolean {
  if (a < 1 || a + b > 10) return false
  return level === 1 ? b >= 1 && b <= 3 && a + b <= 7 : b >= 1 && b <= 4
}

/** One sticker for two parcels (E): sums ≤ 5, 4-8, 6-10 with the smaller ≤ 4 (as written). */
export function stickerFits(level: Level, a: number, b: number): boolean {
  if (a < 1 || b < 1) return false
  const sum = a + b
  if (level === 1) return sum <= 5
  if (level === 2) return sum >= 4 && sum <= 8
  return sum >= 6 && sum <= 10 && Math.min(a, b) <= 4
}

/** Two bags (B): N 4 or 5, then 6-8, then 9 or 10. */
export function twoBagsRange(level: Level): readonly number[] {
  return level === 1 ? [4, 5] : level === 2 ? [6, 7, 8] : [9, 10]
}

export function packRange(level: Level): [number, number] {
  return level === 1 ? [1, 5] : level === 2 ? [3, 10] : [5, 10]
}

export function makeOrder(
  type: OrderType,
  level: Level,
  rng: Rng,
  customer: CustomerId,
  options: { missed?: Record<string, number>; previous?: Order; smallFirst?: boolean } = {},
): Order {
  const previous = options.previous
  // The goods vary within a day: never the same good twice in a row.
  const goodFrom = (choices: readonly Good[]) => pick(rng, choices.filter((g) => g !== previous?.good).length ? choices.filter((g) => g !== previous?.good) : choices)
  if (type === 'C' || type === 'D' || type === 'E') {
    const fits = type === 'C' ? readyBoxFits : type === 'D' ? rideFits : stickerFits
    let pairs: [number, number][] = []
    for (let a = 0; a <= 10; a += 1) for (let b = 0; b <= 10; b += 1) if (fits(level, a, b)) pairs.push([a, b])
    // E level 3: most cards put the bigger number first; one or two a day the small one.
    if (type === 'E' && level === 3) pairs = pairs.filter(([a, b]) => (options.smallFirst ? a < b : a >= b))
    // Her missed facts come back now and then.
    const missed = Object.entries(options.missed ?? {})
      .filter(([, count]) => count > 0)
      .map(([key]) => key.split('+').map(Number) as [number, number])
      .filter(([a, b]) => pairs.some(([x, y]) => x === a && y === b))
    let [a, b] = missed.length > 0 && rng() < 0.5 ? pick(rng, missed) : pick(rng, pairs)
    if (previous?.type === type && previous.a === a && previous.b === b && pairs.length > 1) [a, b] = pick(rng, pairs.filter(([x, y]) => x !== a || y !== b))
    return { type, level, n: a + b, a, b, customer, good: goodFrom(GOODS), ...(type === 'E' && level === 3 ? { smallFirst: a < b } : {}) }
  }
  if (type === 'B') {
    let n = pick(rng, twoBagsRange(level))
    const range = twoBagsRange(level)
    if (previous?.type === 'B' && previous.n === n && range.length > 1) n = pick(rng, range.filter((x) => x !== n))
    return { type, level, n, a: 0, b: 0, customer, good: goodFrom(GOODS) }
  }
  // A: pack an order of n.
  const [min, max] = packRange(level)
  let n = int(rng, min, max)
  if (previous?.type === 'A' && previous.n === n) n = n === max ? min : n + 1
  const good = goodFrom(GOODS)
  return { type: 'A', level, n, a: n, b: 0, customer, good }
}

export function factOf(order: Order): string | null {
  return order.type === 'C' || order.type === 'D' || order.type === 'E' ? fact(order.a, order.b) : null
}

// ── Hidden levels and the two modes (§10.2) ──────────────────────────────
/** `help`: training, all the counting help, no points. `compete`: no counting help, ±2. */
export type Mode = 'help' | 'compete'

export interface TypeProgress {
  level: Level
  /** Right at the first bell, for her latest orders of this type (newest last, at most 5). */
  history: boolean[]
  served: number
  mode: Mode
  /** The same, counted for the mode; it starts empty after each move between the modes. */
  modeHistory: boolean[]
}

export const blankType = (): TypeProgress => ({ level: 1, history: [], served: 0, mode: 'help', modeHistory: [] })

/**
 * The number range: up when 4 of her last 5 were right at the first bell, down when 1 or fewer
 * were (in both modes, never announced). The mode: training → competition when 4 of her last 5
 * in training were right; competition → training when 1 or fewer of her last 5 were.
 */
export function afterOrder(state: TypeProgress, firstBell: boolean): TypeProgress {
  const history = [...state.history, firstBell].slice(-5)
  const right = history.filter(Boolean).length
  let level = state.level
  let next = history
  if (right >= 4 && level < 3) [level, next] = [(level + 1) as Level, []]
  else if (history.length === 5 && right <= 1 && level > 1) [level, next] = [(level - 1) as Level, []]
  const modeHistory = [...state.modeHistory, firstBell].slice(-5)
  const modeRight = modeHistory.filter(Boolean).length
  let mode = state.mode
  let modeNext = modeHistory
  if (mode === 'help' && modeRight >= 4) [mode, modeNext] = ['compete', []]
  else if (mode === 'compete' && modeHistory.length === 5 && modeRight <= 1) [mode, modeNext] = ['help', []]
  return { level, history: next, served: state.served + 1, mode, modeHistory: modeNext }
}

// ── The day ──────────────────────────────────────────────────────────────
export interface DayInput {
  /** Types that have arrived and are switched on. */
  open: readonly OrderType[]
  /** A type that arrived this morning: it gets the first order and every other one. */
  arrivedToday: OrderType | null
  levels: Record<OrderType, Level>
  missedCount: number
}

/**
 * Five orders. On the morning something new arrives it comes first, then every other order.
 * Once everything has arrived: at least two ready boxes, the rest leaning toward her weaker types.
 */
export function planDay(input: DayInput, rng: Rng): OrderType[] {
  const open = input.open.length > 0 ? [...input.open] : ['A' as OrderType]
  if (open.length === 1) return Array.from({ length: DAY_CUSTOMERS }, () => open[0]!)
  const fresh = input.arrivedToday && open.includes(input.arrivedToday) ? input.arrivedToday : null
  if (fresh) {
    // The delivery takes the scene to the street: twice on its first morning, not three times.
    const others = open.filter((t) => t !== fresh && t !== 'D')
    const slots = fresh === 'D' ? [0, 3] : [0, 2, 4]
    const pool = others.length ? others : open.filter((t) => t !== fresh)
    return Array.from({ length: DAY_CUSTOMERS }, (_, i) => (slots.includes(i) ? fresh : pick(rng, pool.length ? pool : [fresh])))
  }
  const plan: OrderType[] = []
  if (open.includes('C')) plan.push('C', 'C')
  // Weaker types (lower level) are chosen more often; at most one delivery a day.
  const facts = (t: OrderType) => (t === 'C' || t === 'D' || t === 'E') && input.missedCount > 0
  const weights = open.map((t) => 4 - input.levels[t] + (facts(t) ? 1 : 0))
  while (plan.length < DAY_CUSTOMERS) {
    if (plan.includes('D')) {
      const d = open.indexOf('D')
      if (d >= 0) weights[d] = 0
      if (weights.every((w) => w === 0)) break
    }
    let roll = rng() * weights.reduce((sum, w) => sum + w, 0)
    let index = 0
    while (roll >= weights[index]!) {
      roll -= weights[index]!
      index += 1
    }
    plan.push(open[index]!)
  }
  while (plan.length < DAY_CUSTOMERS) plan.push(open.find((t) => t !== 'D') ?? open[0]!)
  // At most four of a kind, so the day stays mixed...
  for (const t of open) {
    while (plan.filter((x) => x === t).length > DAY_CUSTOMERS - 1) plan[plan.lastIndexOf(t)] = open.find((o) => o !== t)!
  }
  // ...and never three of a kind in a row.
  const left = shuffle(rng, plan)
  const out: OrderType[] = []
  while (left.length > 0) {
    const blocked = out.length >= 2 && out.at(-1) === out.at(-2) ? out.at(-1) : null
    const counts = (t: OrderType) => left.filter((x) => x === t).length
    const options = [...new Set(left)].filter((t) => t !== blocked).sort((x, y) => counts(y) - counts(x))
    const choice = options[0] ?? left[0]!
    out.push(choice)
    left.splice(left.indexOf(choice), 1)
  }
  return out
}

/**
 * The customers of a day, from those who know her shop: never the same one twice in a row; a
 * newcomer comes in second that day.
 */
export function dayCustomers(rng: Rng, count = DAY_CUSTOMERS, served = 999, newcomer: CustomerId | null = null): CustomerId[] {
  const known = knownCustomers(served)
  const out: CustomerId[] = []
  for (let i = 0; i < count; i += 1) {
    if (i === 1 && newcomer && known.includes(newcomer) && out.at(-1) !== newcomer) {
      out.push(newcomer)
      continue
    }
    const choices = known.filter((id) => id !== out.at(-1))
    out.push(pick(rng, choices.length ? choices : known))
  }
  return out
}

/** The first customer who joined between two served counts, if any. */
export function newcomerBetween(before: number, now: number): CustomerId | null {
  return CUSTOMERS.find((c) => c.after > before && c.after <= now)?.id ?? null
}

/** The next type to arrive, if any. */
export function nextArrival(arrived: readonly OrderType[]): OrderType | null {
  return ARRIVAL_ORDER.find((t) => !arrived.includes(t)) ?? null
}

/** After a day: does something new arrive next morning? */
export function arrivalDue(firstBells: number, daysSinceArrival: number): boolean {
  return firstBells >= ARRIVAL_FIRST_BELLS || daysSinceArrival >= ARRIVAL_DAYS
}

/**
 * Her name in the customers' mouths (§8.5): the first customer greets her by name about every
 * second day, the last one thanks her by name about one day in three; never more than two a day.
 */
export function namedToday(day: number): { hi: boolean; thanks: boolean } {
  return { hi: day % 2 === 1, thanks: day % 3 === 2 }
}

export function customerRate(id: CustomerId): number {
  return customerOf(id).rate
}
