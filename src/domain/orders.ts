// Orders, hidden levels and steps of help, and who comes in next (DESIGN.md §3.2, as changed by §11 and §12).
// Every range here is checked over many seeds by tests/unit/orders.test.ts.
import { int, pick, type Rng } from './random'

/**
 * The order types left after §11 and §12 (B and E are gone). C, the ready box with the tray, is the
 * stream of customers (§12.1); A and D stay in the game, off unless a parent switches them on.
 */
export type OrderType = 'A' | 'C' | 'D'
export type Level = 1 | 2 | 3
export const ORDER_TYPES: readonly OrderType[] = ['C', 'A', 'D']

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
  /** A: n. C: the pieces in the ready box (the bigger number). D: the house Dabdoob starts at. */
  a: number
  /** A: 0. C: how many more. D: how many houses to ride. */
  b: number
  customer: CustomerId
  /** The one good of the order (§10.1: an order never adds or mixes two goods). */
  good: Good
}

const fact = (a: number, b: number) => `${a}+${b}`

/**
 * The (a, b) pairs of the ready box (C): a closed box plus a few more. The box always holds the
 * bigger number, so she counts on from the big one.
 */
export function readyBoxFits(level: Level, a: number, b: number): boolean {
  if (a + b > 10 || a < b) return false
  if (level === 1) return a >= 2 && a <= 5 && b >= 1 && b <= 2
  if (level === 2) return a >= 3 && a <= 7 && b >= 1 && b <= 3
  return a >= 4 && a <= 8 && b >= 1 && b <= 4
}

/** The delivery ride (D): sum ≤ 7 with 1-3 houses, then sum ≤ 10 with 1-4. */
export function rideFits(level: Level, a: number, b: number): boolean {
  if (a < 1 || a + b > 10) return false
  return level === 1 ? b >= 1 && b <= 3 && a + b <= 7 : b >= 1 && b <= 4
}

export function packRange(level: Level): [number, number] {
  return level === 1 ? [1, 5] : level === 2 ? [3, 10] : [5, 10]
}

export function makeOrder(
  type: OrderType,
  level: Level,
  rng: Rng,
  customer: CustomerId,
  options: { missed?: Record<string, number>; previous?: Order } = {},
): Order {
  const previous = options.previous
  // The goods vary: never the same good twice in a row.
  const goodFrom = (choices: readonly Good[]) => pick(rng, choices.filter((g) => g !== previous?.good).length ? choices.filter((g) => g !== previous?.good) : choices)
  if (type !== 'A') {
    const fits = type === 'D' ? rideFits : readyBoxFits
    const pairs: [number, number][] = []
    for (let a = 0; a <= 10; a += 1) for (let b = 0; b <= 10; b += 1) if (fits(level, a, b)) pairs.push([a, b])
    // Her missed facts come back now and then.
    const missed = Object.entries(options.missed ?? {})
      .filter(([, count]) => count > 0)
      .map(([key]) => key.split('+').map(Number) as [number, number])
      .filter(([a, b]) => pairs.some(([x, y]) => x === a && y === b))
    let [a, b] = missed.length > 0 && rng() < 0.5 ? pick(rng, missed) : pick(rng, pairs)
    if (previous?.type === type && previous.a === a && previous.b === b && pairs.length > 1) [a, b] = pick(rng, pairs.filter(([x, y]) => x !== a || y !== b))
    return { type, level, n: a + b, a, b, customer, good: goodFrom(GOODS) }
  }
  // A: pack an order of n.
  const [min, max] = packRange(level)
  let n = int(rng, min, max)
  if (previous?.type === 'A' && previous.n === n) n = n === max ? min : n + 1
  const good = goodFrom(GOODS)
  return { type: 'A', level, n, a: n, b: 0, customer, good }
}

export function factOf(order: Order): string | null {
  return order.type === 'A' ? null : fact(order.a, order.b)
}

// ── Hidden levels and the steps of help (§10.2, §11.2) ───────────────────
/**
 * `help`: training, all the counting help, no points. `bridge` (C only): the voice says the box's
 * number and she counts on by herself, no points. `compete`: no counting help, +2 right first time.
 */
export type Mode = 'help' | 'bridge' | 'compete'

/** The steps of each type, from the most help to none: the ready box has the bridge between the two. */
export function stepsOf(type: OrderType): readonly Mode[] {
  return type === 'C' ? ['help', 'bridge', 'compete'] : ['help', 'compete']
}

export interface TypeProgress {
  level: Level
  /** Right at the first try, for her latest orders that count for the level (newest last, at most 5). */
  history: boolean[]
  served: number
  mode: Mode
  /** Right at the first try in this step; it starts empty after each move between the steps. */
  modeHistory: boolean[]
}

export const blankType = (): TypeProgress => ({ level: 1, history: [], served: 0, mode: 'help', modeHistory: [] })

/**
 * After one order of `type`. The number range: up when 4 of her last 5 were right at the first try,
 * down when 1 or fewer were; for C only in competition (the method is learnt on easy numbers). The
 * step: up after 4 of her last 5 right in this step, down after two wrong first tries in a row.
 */
export function afterOrder(state: TypeProgress, firstBell: boolean, type: OrderType): TypeProgress {
  let level = state.level
  let history = state.history
  if (type !== 'C' || state.mode === 'compete') {
    history = [...state.history, firstBell].slice(-5)
    const right = history.filter(Boolean).length
    if (right >= 4 && level < 3) [level, history] = [(level + 1) as Level, []]
    else if (history.length === 5 && right <= 1 && level > 1) [level, history] = [(level - 1) as Level, []]
  }
  const steps = stepsOf(type)
  const at = Math.max(0, steps.indexOf(state.mode))
  let modeHistory = [...state.modeHistory, firstBell].slice(-5)
  let mode = steps[at]!
  if (modeHistory.filter(Boolean).length >= 4 && at < steps.length - 1) [mode, modeHistory] = [steps[at + 1]!, []]
  else if (modeHistory.length >= 2 && !modeHistory.at(-1) && !modeHistory.at(-2) && at > 0) [mode, modeHistory] = [steps[at - 1]!, []]
  return { level, history, served: state.served + 1, mode, modeHistory }
}

// ── Who comes next (§11.4: no days, one customer after another) ───────────
export interface NextTypeInput {
  /** The types open now (all minus the ones the parents switched off). */
  open: readonly OrderType[]
  levels: Record<OrderType, Level>
  missedCount: number
  /** The latest types served, newest last. */
  recent: readonly OrderType[]
}

/**
 * The next order's type. With several open: weaker types (lower level, or with missed facts) more
 * often, never three of a kind in a row, a delivery at most once in five.
 */
export function nextType(input: NextTypeInput, rng: Rng): OrderType {
  const open = input.open.length > 0 ? input.open : (['C'] as const)
  if (open.length === 1) return open[0]!
  const last = input.recent.slice(-4)
  const three = last.length >= 2 && last.at(-1) === last.at(-2) ? last.at(-1) : null
  let options = open.filter((t) => t !== three && !(t === 'D' && last.includes('D')))
  if (options.length === 0) options = open.filter((t) => t !== 'D')
  if (options.length === 0) options = [...open]
  const facts = (t: OrderType) => t !== 'A' && input.missedCount > 0
  const weights = options.map((t) => 4 - input.levels[t] + (facts(t) ? 1 : 0))
  let roll = rng() * weights.reduce((sum, w) => sum + w, 0)
  for (let i = 0; i < options.length; i += 1) {
    roll -= weights[i]!
    if (roll < 0) return options[i]!
  }
  return options.at(-1)!
}

/** The next customer: a newcomer first (the very next customer after they join), never the same one twice in a row. */
export function nextCustomer(rng: Rng, served: number, previous: CustomerId | null, newcomer: CustomerId | null = null): CustomerId {
  const known = knownCustomers(served)
  if (newcomer && known.includes(newcomer) && newcomer !== previous) return newcomer
  const choices = known.filter((id) => id !== previous)
  return pick(rng, choices.length ? choices : known)
}

/** The first customer who knows the shop but has not been met yet. */
export function newcomerOf(served: number, met: readonly CustomerId[]): CustomerId | null {
  return knownCustomers(served).find((id) => !met.includes(id)) ?? null
}

/**
 * Her name in the customers' mouths (§11.4), by the orders served before this one: the greeting
 * once in eight customers, the thanks once in twelve, never on the same customer.
 */
export function namedHi(served: number): boolean {
  return served % 8 === 0
}
export function namedThanks(served: number): boolean {
  return served % 12 === 7
}

export function customerRate(id: CustomerId): number {
  return customerOf(id).rate
}
