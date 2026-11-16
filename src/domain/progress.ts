// Her shop, kept on the device (DESIGN.md §3.4). Every storage access is wrapped: the game works the
// same when storage is blocked (a private tab, a sandboxed preview).
import { ARRIVAL_ORDER, CUSTOMERS, afterOrder, arrivalDue, blankType, nextArrival, type CustomerId, type Level, type Mode, type OrderType, type TypeProgress } from './orders'

export const STORAGE_KEY = 'candy-shop:v3'

/**
 * In the Hub build the shop is saved per signed-in child, so two accounts on one iPad never share
 * points. The preview has no account and uses the plain key.
 */
let player = ''
export function setPlayer(id: string): void {
  player = id
}
export function storageKey(): string {
  return player ? `${STORAGE_KEY}:${player}` : STORAGE_KEY
}

/** The challenge (§8.3): 200 points, and the prize is real Takis. */
export const GOAL = 200
/** In competition (§10.2): right at the first bell +2, wrong at the first bell −2 (never below 0). */
export const POINTS_RIGHT = 2
export const POINTS_WRONG = -2
export const MILESTONES = [50, 100, 150] as const
/** Two bags, in competition only: a new split at the first bell, and a full house, once. */
export const POINTS_NEW_SPLIT = 1
export const POINTS_FULL_HOUSE = 5

/** A number house: the splits of N delivered so far, by the right bag's count. */
export interface House {
  found: number[]
  full: boolean
}

export interface Today {
  plan: OrderType[]
  /** Who comes in today, in order. */
  customers: CustomerId[]
  /** Customers served so far today. */
  served: number
  firstBells: number
  /** The board when the day began (closing shows today's change). */
  start: number
  /** What arrived this morning (it gets its guide line). */
  arrived: OrderType | null
}

export interface ShopProgress {
  /** The day she is on (1 = the first day). */
  day: number
  /** Her points toward the goal (at most GOAL). */
  points: number
  /** She reached the goal: the coupon is hers. */
  won: boolean
  /** Shops closed so far (g/closed is said on the first three). */
  closings: number
  /** «g/near» lines said so far (dealt in turn, so none repeats before all were said). */
  nearSaid: number
  served: number
  arrived: OrderType[]
  daysSinceArrival: number
  /** Arrives next morning. */
  pendingArrival: OrderType | null
  types: Record<OrderType, TypeProgress>
  missed: Record<string, number>
  /** Number houses by N (order «كيسين»). */
  houses: Record<string, House>
  /** Customers she has met (a new one is announced once). */
  met: CustomerId[]
  /** Guide lines and first-time moments already shown. */
  seen: string[]
  voice: boolean
  /** Parents: every order type open, whatever has arrived. */
  allOrders: boolean
  /** Parents: order types switched off. */
  disabled: OrderType[]
  today: Today | null
}

export function defaultProgress(): ShopProgress {
  return {
    day: 1,
    points: 0,
    won: false,
    closings: 0,
    nearSaid: 0,
    served: 0,
    arrived: ['A'],
    daysSinceArrival: 0,
    pendingArrival: null,
    types: { A: blankType(), B: blankType(), C: blankType(), D: blankType(), E: blankType() },
    missed: {},
    houses: {},
    met: ['rabbit', 'cat', 'duck'],
    seen: [],
    voice: true,
    allOrders: false,
    disabled: [],
    today: null,
  }
}

const count = (value: unknown, max = 100_000): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0
const isType = (value: unknown): value is OrderType => typeof value === 'string' && ['A', 'B', 'C', 'D', 'E'].includes(value)

/** Reads what is saved, keeping only well-formed values. */
export function parseProgress(raw: unknown): ShopProgress {
  const base = defaultProgress()
  if (!raw || typeof raw !== 'object') return base
  const data = raw as Record<string, unknown>
  base.day = Math.max(1, count(data.day))
  base.points = Math.min(GOAL, count(data.points))
  base.won = data.won === true
  base.closings = count(data.closings)
  base.nearSaid = count(data.nearSaid)
  base.served = count(data.served)
  if (Array.isArray(data.arrived)) {
    const arrived = data.arrived.filter(isType)
    if (arrived.length) base.arrived = [...new Set(['A' as OrderType, ...arrived])]
  }
  base.daysSinceArrival = count(data.daysSinceArrival)
  base.pendingArrival = isType(data.pendingArrival) ? data.pendingArrival : null
  const types = (data.types ?? {}) as Record<string, Partial<TypeProgress> | undefined>
  for (const t of ['A', 'B', 'C', 'D', 'E'] as OrderType[]) {
    const saved = types[t]
    if (!saved || typeof saved !== 'object') continue
    const level = count(saved.level, 3)
    base.types[t] = {
      level: (level >= 1 ? level : 1) as Level,
      history: Array.isArray(saved.history) ? saved.history.filter((x): x is boolean => typeof x === 'boolean').slice(-5) : [],
      served: count(saved.served),
      mode: saved.mode === 'compete' ? 'compete' : 'help',
      modeHistory: Array.isArray(saved.modeHistory) ? saved.modeHistory.filter((x): x is boolean => typeof x === 'boolean').slice(-5) : [],
    }
  }
  if (data.missed && typeof data.missed === 'object') {
    for (const [key, value] of Object.entries(data.missed as Record<string, unknown>)) {
      if (/^\d+\+\d+$/.test(key) && count(value) > 0) base.missed[key] = count(value)
    }
  }
  if (data.houses && typeof data.houses === 'object') {
    for (const [key, value] of Object.entries(data.houses as Record<string, Partial<House>>)) {
      const n = Number(key)
      if (!Number.isInteger(n) || n < 1 || n > 10 || !value || !Array.isArray(value.found)) continue
      const found = [...new Set(value.found.filter((x): x is number => Number.isInteger(x) && x >= 0 && x <= n))].sort((a, b) => a - b)
      base.houses[key] = { found, full: found.length === n + 1 }
    }
  }
  if (Array.isArray(data.met)) {
    const known = CUSTOMERS.map((c) => c.id) as string[]
    const met = data.met.filter((id): id is CustomerId => known.includes(id as string))
    base.met = [...new Set([...base.met, ...met])]
  }
  if (Array.isArray(data.seen)) base.seen = data.seen.filter((x): x is string => typeof x === 'string')
  base.voice = data.voice !== false
  base.allOrders = data.allOrders === true
  if (Array.isArray(data.disabled)) base.disabled = data.disabled.filter(isType)
  const today = data.today as Partial<Today> | null | undefined
  if (today && Array.isArray(today.plan) && today.plan.every(isType) && today.plan.length > 0) {
    const known = CUSTOMERS.map((c) => c.id) as string[]
    const customers = Array.isArray(today.customers) ? today.customers.filter((id): id is CustomerId => known.includes(id as string)) : []
    base.today = {
      plan: today.plan,
      customers: customers.length === today.plan.length ? customers : today.plan.map((_, i) => CUSTOMERS[i % CUSTOMERS.length]!.id),
      served: Math.min(count(today.served), today.plan.length),
      firstBells: count(today.firstBells),
      start: Math.min(GOAL, count(today.start ?? base.points)),
      arrived: isType(today.arrived) ? today.arrived : null,
    }
  }
  return base
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function loadProgress(store: Storage | null = storage()): ShopProgress {
  try {
    const text = store?.getItem(storageKey())
    return text ? parseProgress(JSON.parse(text)) : defaultProgress()
  } catch {
    return defaultProgress()
  }
}

export function saveProgress(progress: ShopProgress, store: Storage | null = storage()): boolean {
  try {
    if (!store) return false
    store.setItem(storageKey(), JSON.stringify(progress))
    return true
  } catch {
    return false
  }
}

/** The order types open today: arrived (or all, for the parents) and not switched off. */
export function openTypes(progress: ShopProgress): OrderType[] {
  const pool = progress.allOrders ? [...ARRIVAL_ORDER] : progress.arrived.filter((t) => ARRIVAL_ORDER.includes(t))
  const open = pool.filter((t) => !progress.disabled.includes(t))
  return open.length > 0 ? open : pool
}

// ── Points ───────────────────────────────────────────────────────────────
/** Training never moves the board; competition: +2 right at the first bell, −2 wrong. */
export function pointsFor(mode: Mode, firstBell: boolean): number {
  if (mode !== 'compete') return 0
  return firstBell ? POINTS_RIGHT : POINTS_WRONG
}

/** The board after a change: never below 0, never above the goal. */
export function applyPoints(points: number, delta: number): number {
  return Math.max(0, Math.min(GOAL, points + delta))
}

/**
 * The line that closes a day: the coupon, a milestone crossed today, a «near» line on a day that
 * ended higher, «g/day-down» on a day that ended lower, nothing on a day with no change.
 */
export function closingLine(before: number, after: number, nearSaid: number): { id: string; near: boolean } | null {
  if (before < GOAL && after >= GOAL) return { id: 'g/goal-200', near: false }
  const crossed = [...MILESTONES].reverse().find((m) => before < m && after >= m)
  if (crossed) return { id: `g/goal-${crossed}`, near: false }
  if (after > before) return { id: `g/near-${(nearSaid % 3) + 1}`, near: true }
  if (after < before) return { id: 'g/day-down', near: false }
  return null
}

/**
 * Two bags delivered as (right bag, left bag) = (x, n − x): its row of the number house is stamped.
 * Bonus points, in competition only: +1 if the split is new and it was right at the first bell;
 * +5 once when the house becomes full at the first bell. Returns the new houses and what happened.
 */
export function stampHouse(houses: Record<string, House>, n: number, first: number, firstBell: boolean, mode: Mode = 'compete') {
  const key = String(n)
  const house = houses[key] ?? { found: [], full: false }
  const isNew = !house.found.includes(first)
  const found = isNew ? [...house.found, first].sort((a, b) => a - b) : house.found
  const full = found.length === n + 1
  const justFull = full && !house.full
  const bonus = firstBell && mode === 'compete' ? (isNew ? POINTS_NEW_SPLIT : 0) + (justFull ? POINTS_FULL_HOUSE : 0) : 0
  return { houses: { ...houses, [key]: { found, full } }, isNew, justFull, bonus }
}

/** «تحدي جديد»: points back to zero, levels and everything else kept. */
export function newChallenge(progress: ShopProgress): ShopProgress {
  return { ...progress, points: 0, won: false }
}

// ── Recording what happened ──────────────────────────────────────────────
export interface Delivery {
  type: OrderType
  firstBell: boolean
  fact: string | null
  /** Two bags: the bonus of the number house (already 0 in training). */
  bonus?: number
}

/** Moves a type between training and competition by hand (the parents' switch). */
export function setMode(progress: ShopProgress, type: OrderType, mode: Mode): ShopProgress {
  return { ...progress, types: { ...progress.types, [type]: { ...progress.types[type], mode, modeHistory: [] } } }
}

/** Wrong at the first bell (or door, or sticker) in competition: 2 points leave the board at once. */
export function missPoints(progress: ShopProgress, type: OrderType): ShopProgress {
  const delta = pointsFor(progress.types[type].mode, false)
  return delta === 0 ? progress : { ...progress, points: applyPoints(progress.points, delta) }
}

/** One customer served: hidden level and mode, missed facts, points straight onto the board. */
export function recordDelivery(progress: ShopProgress, delivery: Delivery): ShopProgress {
  const missed = { ...progress.missed }
  if (delivery.fact) {
    if (delivery.firstBell && missed[delivery.fact]) {
      missed[delivery.fact] = (missed[delivery.fact] ?? 0) - 1
      if ((missed[delivery.fact] ?? 0) <= 0) delete missed[delivery.fact]
    } else if (!delivery.firstBell) missed[delivery.fact] = (missed[delivery.fact] ?? 0) + 1
  }
  const today = progress.today
  const mode = progress.types[delivery.type].mode
  // A wrong first try has already cost its 2 points at the bell (`missPoints`): nothing more here.
  const delta = delivery.firstBell ? pointsFor(mode, true) + (mode === 'compete' ? (delivery.bonus ?? 0) : 0) : 0
  return {
    ...progress,
    served: progress.served + 1,
    points: applyPoints(progress.points, delta),
    types: { ...progress.types, [delivery.type]: afterOrder(progress.types[delivery.type], delivery.firstBell) },
    missed,
    today: today ? { ...today, served: today.served + 1, firstBells: today.firstBells + (delivery.firstBell ? 1 : 0) } : today,
  }
}

/** Closing: today's change is read off the board, and maybe something new is on its way for tomorrow. */
export function closeDay(progress: ShopProgress): ShopProgress {
  const today = progress.today
  const firstBells = today?.firstBells ?? 0
  const days = progress.daysSinceArrival + 1
  const upcoming = progress.pendingArrival ?? nextArrival(progress.arrived)
  // The ready box comes on the morning of day 2 whatever happened (§8.7).
  const due = upcoming !== null && (upcoming === 'C' || arrivalDue(firstBells, days))
  const points = progress.points
  const line = closingLine(today?.start ?? points, points, progress.nearSaid)
  return {
    ...progress,
    day: progress.day + 1,
    closings: progress.closings + 1,
    points,
    won: progress.won || points >= GOAL,
    nearSaid: progress.nearSaid + (line?.near ? 1 : 0),
    daysSinceArrival: due ? 0 : days,
    pendingArrival: due ? upcoming : progress.pendingArrival,
    today: null,
  }
}

/** A new day: tomorrow's arrival unpacks, the day number moves on. */
export function startDay(progress: ShopProgress, plan: OrderType[], arrived: OrderType | null, customers: CustomerId[]): ShopProgress {
  return {
    ...progress,
    arrived: arrived && !progress.arrived.includes(arrived) ? [...progress.arrived, arrived] : progress.arrived,
    pendingArrival: arrived ? null : progress.pendingArrival,
    today: { plan, customers, served: 0, firstBells: 0, start: progress.points, arrived },
  }
}

export function markSeen(progress: ShopProgress, key: string): ShopProgress {
  return progress.seen.includes(key) ? progress : { ...progress, seen: [...progress.seen, key] }
}

/** Her most-missed facts, for the parents' page. */
export function mostMissed(progress: ShopProgress, limit = 6): [number, number][] {
  return Object.entries(progress.missed)
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .slice(0, limit)
    .map(([key]) => key.split('+').map(Number) as [number, number])
}
