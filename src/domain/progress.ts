// Her shop, kept on the device (DESIGN.md §3.4, as changed by §8, §10, §11 and §12). Every storage access
// is wrapped: the game works the same when storage is blocked (a private tab, a sandboxed preview).
import { CUSTOMERS, ORDER_TYPES, afterOrder, blankType, stepsOf, type CustomerId, type Level, type Mode, type OrderType, type TypeProgress } from './orders'

export const STORAGE_KEY = 'candy-shop:v3'
/** The shape of a save since §12 (the ready box is the stream; E is gone). */
export const REVISION = 3

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

/** The challenge (§11.5): 100 points, and the prize is real Takis. */
export const GOAL = 100
/** In competition: right at the first try +2. Nothing is ever taken away (§11.3). */
export const POINTS_RIGHT = 2
/** The big board opens by itself at these (§11.5); the coupon at the goal. */
export const MILESTONES = [25, 50, 75] as const
/** A «near» line at every other multiple of this. */
export const NEAR_EVERY = 10
/** One record goes to the Hub every this many orders (§11.4). */
export const BATCH_SIZE = 5
/** The parents' page switches A and D on; the ready box is the stream of customers (§12.1). */
export const DEFAULT_DISABLED: readonly OrderType[] = ['A', 'D']
/**
 * An earlier save hears these once more (§12.4): the goal is 100, nothing is taken away, and the
 * ready box now has three steps and counts on from its number.
 */
export const RETOLD_LINES = ['g/goal', 'g/compete', 'g/train', 'g/ready-box', 'g/tap-box', 'g/count-on', 'g/ring-bell'] as const

/** The orders of the batch that goes to the Hub next. */
export interface Batch {
  served: number
  firstBells: number
  orders: OrderType[]
}

export interface ShopProgress {
  rev: typeof REVISION
  /** Her points toward the goal (at most GOAL). */
  points: number
  /** She reached the goal: the coupon is hers, and the counter stays until the balance is reset. */
  won: boolean
  /** How many times this balance has been reset (in the game or by the Hub's Admin), §11.8. */
  epoch: number
  /** «g/near» lines said so far (dealt in turn, so none repeats before all were said). */
  nearSaid: number
  served: number
  types: Record<OrderType, TypeProgress>
  missed: Record<string, number>
  /** Customers she has met (a new one is announced once). */
  met: CustomerId[]
  /** Guide lines and first-time moments already shown. */
  seen: string[]
  voice: boolean
  /** Parents: order types switched off. */
  disabled: OrderType[]
  batch: Batch
}

const blankTypes = (): Record<OrderType, TypeProgress> => ({ A: blankType(), C: blankType(), D: blankType() })
const blankBatch = (): Batch => ({ served: 0, firstBells: 0, orders: [] })

export function defaultProgress(): ShopProgress {
  return {
    rev: REVISION,
    points: 0,
    won: false,
    epoch: 0,
    nearSaid: 0,
    served: 0,
    types: blankTypes(),
    missed: {},
    met: ['rabbit', 'cat', 'duck'],
    seen: [],
    voice: true,
    disabled: [...DEFAULT_DISABLED],
    batch: blankBatch(),
  }
}

const count = (value: unknown, max = 100_000): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0
const isType = (value: unknown): value is OrderType => typeof value === 'string' && (ORDER_TYPES as readonly string[]).includes(value)
const booleans = (value: unknown): boolean[] => (Array.isArray(value) ? value.filter((x): x is boolean => typeof x === 'boolean').slice(-5) : [])

/**
 * Reads what is saved, keeping only well-formed values. A save of an earlier revision keeps her
 * points (at most the goal), the balance's epoch, the customers served and met, the voice and what
 * she has seen (less the lines told again), and starts the ready box in training with A and D off.
 */
export function parseProgress(raw: unknown): ShopProgress {
  const base = defaultProgress()
  if (!raw || typeof raw !== 'object') return base
  const data = raw as Record<string, unknown>
  base.points = Math.min(GOAL, count(data.points))
  base.won = data.won === true || base.points >= GOAL
  base.served = count(data.served)
  if (Array.isArray(data.met)) {
    const known = CUSTOMERS.map((c) => c.id) as string[]
    const met = data.met.filter((id): id is CustomerId => known.includes(id as string))
    base.met = [...new Set([...base.met, ...met])]
  }
  if (Array.isArray(data.seen)) base.seen = data.seen.filter((x): x is string => typeof x === 'string')
  base.voice = data.voice !== false
  base.epoch = count(data.epoch, Number.MAX_SAFE_INTEGER)
  base.nearSaid = count(data.nearSaid)
  if (data.rev !== REVISION) {
    const retold: readonly string[] = RETOLD_LINES
    base.seen = base.seen.filter((id) => !retold.includes(id))
    return base
  }
  const types = (data.types ?? {}) as Record<string, Partial<TypeProgress> | undefined>
  for (const t of ORDER_TYPES) {
    const saved = types[t]
    if (!saved || typeof saved !== 'object') continue
    const level = count(saved.level, 3)
    base.types[t] = {
      level: (level >= 1 ? level : 1) as Level,
      history: booleans(saved.history),
      served: count(saved.served),
      mode: stepsOf(t).includes(saved.mode as Mode) ? (saved.mode as Mode) : 'help',
      modeHistory: booleans(saved.modeHistory),
    }
  }
  if (data.missed && typeof data.missed === 'object') {
    for (const [key, value] of Object.entries(data.missed as Record<string, unknown>)) {
      if (/^\d+\+\d+$/.test(key) && count(value) > 0) base.missed[key] = count(value)
    }
  }
  if (Array.isArray(data.disabled)) base.disabled = [...new Set(data.disabled.filter(isType))]
  const batch = data.batch as Partial<Batch> | undefined
  if (batch && typeof batch === 'object') {
    const orders = Array.isArray(batch.orders) ? batch.orders.filter(isType).slice(0, BATCH_SIZE) : []
    base.batch = { served: orders.length, firstBells: Math.min(orders.length, count(batch.firstBells)), orders }
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

/** The order types open now: all of them minus the ones switched off (if none is left, C). */
export function openTypes(progress: ShopProgress): OrderType[] {
  const open = ORDER_TYPES.filter((t) => !progress.disabled.includes(t))
  return open.length > 0 ? open : ['C']
}

// ── Points ───────────────────────────────────────────────────────────────
/** Only a right first try in competition earns points, and only until the goal is reached. */
export function pointsFor(mode: Mode, firstBell: boolean): number {
  return mode === 'compete' && firstBell ? POINTS_RIGHT : 0
}

/**
 * What is said as the points land (§11.5), after the order's receipt has been read: the coupon at
 * the goal, the big board at a milestone, a «near» line (dealt in turn) at any other multiple of 10.
 */
export type PointsMoment = { kind: 'coupon'; id: 'g/goal-100' } | { kind: 'board'; id: string } | { kind: 'near'; id: string }

export function pointsMoment(before: number, after: number, nearSaid: number): PointsMoment | null {
  if (after <= before) return null
  if (before < GOAL && after >= GOAL) return { kind: 'coupon', id: 'g/goal-100' }
  const crossed = [...MILESTONES].reverse().find((m) => before < m && after >= m)
  if (crossed) return { kind: 'board', id: `g/goal-${crossed}` }
  if (Math.floor(after / NEAR_EVERY) > Math.floor(before / NEAR_EVERY)) return { kind: 'near', id: `g/near-${(nearSaid % 3) + 1}` }
  return null
}

/** Moves a type to a step by hand (the parents' page); its history starts again. */
export function setMode(progress: ShopProgress, type: OrderType, mode: Mode): ShopProgress {
  if (!stepsOf(type).includes(mode)) return progress
  return { ...progress, types: { ...progress.types, [type]: { ...progress.types[type], mode, modeHistory: [] } } }
}

// ── The balance (§11.8) ──────────────────────────────────────────────────
export interface Balance {
  points: number
  epoch: number
}

/** «تصفير الرصيد»: points back to zero, the coupon gone, one more reset on the balance. */
export function resetBalance(progress: ShopProgress): ShopProgress {
  return { ...progress, points: 0, won: false, epoch: progress.epoch + 1 }
}

/**
 * «تصفير التقدم»: the shop starts again (the voice is kept). The balance counts it as a reset, so the
 * Hub does not hand the old points back.
 */
export function resetAll(progress: ShopProgress): ShopProgress {
  return { ...defaultProgress(), voice: progress.voice, epoch: progress.epoch + 1 }
}

/**
 * The Hub's answer to a sync. A newer epoch wins outright (the Admin reset her balance); in the same
 * epoch, more points win (she played on another device). Otherwise nothing changes.
 */
export function adoptBalance(progress: ShopProgress, answer: Balance): ShopProgress {
  const points = Math.min(GOAL, count(answer.points))
  const epoch = count(answer.epoch, Number.MAX_SAFE_INTEGER)
  if (epoch > progress.epoch || (epoch === progress.epoch && points > progress.points)) return { ...progress, points, epoch, won: points >= GOAL }
  return progress
}

// ── Recording what happened ──────────────────────────────────────────────
export interface Delivery {
  type: OrderType
  firstBell: boolean
  fact: string | null
}

/** One customer served: hidden level and step, missed facts, points straight onto the board, the batch. */
export function recordDelivery(progress: ShopProgress, delivery: Delivery): ShopProgress {
  const missed = { ...progress.missed }
  if (delivery.fact) {
    if (delivery.firstBell && missed[delivery.fact]) {
      missed[delivery.fact] = (missed[delivery.fact] ?? 0) - 1
      if ((missed[delivery.fact] ?? 0) <= 0) delete missed[delivery.fact]
    } else if (!delivery.firstBell) missed[delivery.fact] = (missed[delivery.fact] ?? 0) + 1
  }
  const mode = progress.types[delivery.type].mode
  // Once the goal is reached the counter stays where it is until the balance is reset.
  const points = progress.won ? progress.points : Math.min(GOAL, progress.points + pointsFor(mode, delivery.firstBell))
  const batch = progress.batch.served >= BATCH_SIZE ? blankBatch() : progress.batch
  return {
    ...progress,
    served: progress.served + 1,
    points,
    won: progress.won || points >= GOAL,
    types: { ...progress.types, [delivery.type]: afterOrder(progress.types[delivery.type], delivery.firstBell, delivery.type) },
    missed,
    batch: { served: batch.served + 1, firstBells: batch.firstBells + (delivery.firstBell ? 1 : 0), orders: [...batch.orders, delivery.type] },
  }
}

/** A full batch is taken off to be sent to the Hub; the next one starts empty. */
export function takeBatch(progress: ShopProgress): { progress: ShopProgress; batch: Batch | null } {
  if (progress.batch.served < BATCH_SIZE) return { progress, batch: null }
  return { progress: { ...progress, batch: blankBatch() }, batch: progress.batch }
}

/** A «near» line was said: the next one is the next in turn. */
export function nearDealt(progress: ShopProgress): ShopProgress {
  return { ...progress, nearSaid: progress.nearSaid + 1 }
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
