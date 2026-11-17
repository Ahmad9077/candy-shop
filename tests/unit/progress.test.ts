import { describe, expect, it } from 'vitest'
import {
  BATCH_SIZE,
  DEFAULT_DISABLED,
  GOAL,
  MILESTONES,
  POINTS_RIGHT,
  REVISION,
  STORAGE_KEY,
  adoptBalance,
  defaultProgress,
  loadProgress,
  markSeen,
  mostMissed,
  nearDealt,
  openTypes,
  parseProgress,
  pointsFor,
  pointsMoment,
  recordDelivery,
  resetAll,
  resetBalance,
  saveProgress,
  setMode,
  setPlayer,
  storageKey,
  takeBatch,
  type ShopProgress,
} from '../../src/domain/progress'

class MemoryStorage {
  data = new Map<string, string>()
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
}
const throwing = {
  getItem() {
    throw new Error('blocked')
  },
  setItem() {
    throw new Error('blocked')
  },
} as unknown as Storage

/** A shop where every type is in competition, starting at `points`. */
const competing = (points = 0): ShopProgress => {
  const p = { ...defaultProgress(), points }
  const types = Object.fromEntries(Object.entries(p.types).map(([t, v]) => [t, { ...v, mode: 'compete' as const }])) as ShopProgress['types']
  return { ...p, types }
}

describe('the ready box and nothing else (§12.1)', () => {
  it('a new shop opens on the ready box only: A and D are off', () => {
    const p = defaultProgress()
    expect(p.disabled).toEqual(['A', 'D'])
    expect(DEFAULT_DISABLED).toEqual(['A', 'D'])
    expect(openTypes(p)).toEqual(['C'])
    expect(Object.keys(p.types).sort()).toEqual(['A', 'C', 'D'])
  })

  it('opens what the parents switched on, and the ready box when everything is off', () => {
    const p = defaultProgress()
    expect(openTypes({ ...p, disabled: ['C'] })).toEqual(['A', 'D'])
    expect(openTypes({ ...p, disabled: [] })).toEqual(['C', 'A', 'D'])
    expect(openTypes({ ...p, disabled: ['A', 'C', 'D'] })).toEqual(['C'])
  })
})

describe('points (§11.3, §11.5)', () => {
  it('only a right first try in competition earns, +2; nothing is ever taken away', () => {
    expect(pointsFor('help', true)).toBe(0)
    expect(pointsFor('bridge', true)).toBe(0)
    expect(pointsFor('compete', true)).toBe(POINTS_RIGHT)
    expect(pointsFor('compete', false)).toBe(0)
    expect(POINTS_RIGHT).toBe(2)
    expect(GOAL).toBe(100)
    expect(MILESTONES).toEqual([25, 50, 75])
  })

  it('training and the bridge leave the board where it was, right or wrong', () => {
    let p = { ...defaultProgress(), points: 40 }
    p = recordDelivery(p, { type: 'C', firstBell: false, fact: '5+2' })
    p = recordDelivery(p, { type: 'C', firstBell: true, fact: '5+2' })
    p = setMode(p, 'C', 'bridge')
    p = recordDelivery(p, { type: 'C', firstBell: true, fact: '4+3' })
    expect(p.points).toBe(40)
  })

  it('competition: +2 straight onto the board; a wrong first try earns nothing and costs nothing', () => {
    let p = competing(10)
    p = recordDelivery(p, { type: 'C', firstBell: true, fact: '5+3' })
    expect(p.points).toBe(12)
    p = recordDelivery(p, { type: 'C', firstBell: false, fact: '5+3' })
    expect(p.points).toBe(12)
  })

  it('stops at the goal: won, and the counter stays there until the balance is reset', () => {
    let p = recordDelivery(competing(98), { type: 'C', firstBell: true, fact: null })
    expect(p).toMatchObject({ points: 100, won: true })
    p = recordDelivery(p, { type: 'C', firstBell: true, fact: null })
    expect(p.points).toBe(100)
    const reset = resetBalance(p)
    expect(reset).toMatchObject({ points: 0, won: false, epoch: p.epoch + 1 })
    expect(recordDelivery(reset, { type: 'C', firstBell: true, fact: null }).points).toBe(2)
  })

  it('says, as the points land: the coupon at 100, the board at 25, 50, 75, a «near» line at the other tens', () => {
    expect(pointsMoment(98, 100, 0)).toEqual({ kind: 'coupon', id: 'g/goal-100' })
    expect(pointsMoment(24, 26, 0)).toEqual({ kind: 'board', id: 'g/goal-25' })
    expect(pointsMoment(48, 50, 0)).toEqual({ kind: 'board', id: 'g/goal-50' })
    expect(pointsMoment(74, 76, 0)).toEqual({ kind: 'board', id: 'g/goal-75' })
    for (const ten of [10, 20, 30, 40, 60, 70, 80, 90]) expect(pointsMoment(ten - 2, ten, 0), String(ten)).toEqual({ kind: 'near', id: 'g/near-1' })
    expect(pointsMoment(10, 12, 0)).toBeNull()
    expect(pointsMoment(12, 12, 0)).toBeNull()
    expect(pointsMoment(100, 100, 0)).toBeNull()
    // A reset runs the board down: no line.
    expect(pointsMoment(60, 0, 0)).toBeNull()
    // The near lines are dealt in turn: all three before any repeats.
    let p = { ...defaultProgress(), points: 8 }
    const said: string[] = []
    for (const at of [10, 20, 30, 40]) {
      const moment = pointsMoment(at - 2, at, p.nearSaid)!
      said.push(moment.id)
      p = nearDealt(p)
    }
    expect(said).toEqual(['g/near-1', 'g/near-2', 'g/near-3', 'g/near-1'])
  })

  it('the balance figure: 50 right first tries in competition reach the goal', () => {
    let p = competing()
    let orders = 0
    while (!p.won) {
      p = recordDelivery(p, { type: 'C', firstBell: true, fact: null })
      orders += 1
    }
    expect(orders).toBe(GOAL / POINTS_RIGHT)
  })

  it('moves a type to a step by hand (the parents) and starts its history again; only the ready box has the bridge', () => {
    const base = defaultProgress()
    const p = { ...base, types: { ...base.types, C: { ...base.types.C, modeHistory: [true, true] } } }
    expect(setMode(p, 'C', 'bridge').types.C).toMatchObject({ mode: 'bridge', modeHistory: [] })
    expect(setMode(p, 'C', 'compete').types.C.mode).toBe('compete')
    expect(setMode(p, 'A', 'bridge')).toBe(p)
    expect(setMode(p, 'D', 'compete').types.D.mode).toBe('compete')
  })
})

describe('the balance on the Hub (§11.8)', () => {
  it('adopts a newer epoch outright (the Admin reset it), and more points in the same epoch', () => {
    const p = { ...defaultProgress(), points: 60, epoch: 2 }
    expect(adoptBalance(p, { points: 0, epoch: 3 })).toMatchObject({ points: 0, epoch: 3, won: false })
    expect(adoptBalance(p, { points: 100, epoch: 3 })).toMatchObject({ points: 100, epoch: 3, won: true })
    expect(adoptBalance(p, { points: 64, epoch: 2 })).toMatchObject({ points: 64, epoch: 2 })
    // Otherwise it keeps what it has (the very same object).
    expect(adoptBalance(p, { points: 40, epoch: 2 })).toBe(p)
    expect(adoptBalance(p, { points: 60, epoch: 2 })).toBe(p)
    expect(adoptBalance(p, { points: 90, epoch: 1 })).toBe(p)
    expect(adoptBalance(p, { points: 500, epoch: 2 }).points).toBe(GOAL)
  })

  it('every reset counts on the balance: «تصفير الرصيد» and «تصفير التقدم» both bump the epoch', () => {
    const p = { ...competing(70), epoch: 4, voice: false }
    expect(resetBalance(p)).toMatchObject({ points: 0, won: false, epoch: 5 })
    expect(resetBalance(p).types.C.mode).toBe('compete')
    const fresh = resetAll(p)
    expect(fresh).toMatchObject({ points: 0, epoch: 5, voice: false })
    expect(fresh.types.C.mode).toBe('help')
  })
})

describe('reports to the Hub (§11.4)', () => {
  it('one batch every five orders, then a fresh one', () => {
    let p = defaultProgress()
    const batches = []
    for (let i = 0; i < 12; i += 1) {
      const taken = takeBatch(recordDelivery(p, { type: 'C', firstBell: i % 3 !== 0, fact: null }))
      p = taken.progress
      if (taken.batch) batches.push(taken.batch)
    }
    expect(BATCH_SIZE).toBe(5)
    expect(batches).toEqual([
      { served: 5, firstBells: 3, orders: ['C', 'C', 'C', 'C', 'C'] },
      { served: 5, firstBells: 3, orders: ['C', 'C', 'C', 'C', 'C'] },
    ])
    expect(p.batch).toEqual({ served: 2, firstBells: 2, orders: ['C', 'C'] })
  })
})

describe('missed facts', () => {
  it('collects the facts she missed and lets them fade when she gets them right', () => {
    let p = defaultProgress()
    p = recordDelivery(p, { type: 'C', firstBell: false, fact: '5+2' })
    p = recordDelivery(p, { type: 'C', firstBell: false, fact: '5+2' })
    p = recordDelivery(p, { type: 'C', firstBell: false, fact: '4+3' })
    expect(mostMissed(p)).toEqual([[5, 2], [4, 3]])
    p = recordDelivery(p, { type: 'C', firstBell: true, fact: '4+3' })
    expect(p.missed).toEqual({ '5+2': 2 })
    expect(p.types.C.served).toBe(4)
    expect(p.served).toBe(4)
  })
})

describe('storage', () => {
  it('saves and loads', () => {
    const store = new MemoryStorage() as unknown as Storage
    const p = markSeen({ ...recordDelivery(defaultProgress(), { type: 'C', firstBell: true, fact: '3+2' }), points: 7, nearSaid: 2, epoch: 3 }, 'g/open')
    expect(saveProgress(p, store)).toBe(true)
    expect(loadProgress(store)).toEqual(p)
    expect((store as unknown as MemoryStorage).data.has(STORAGE_KEY)).toBe(true)
    expect(STORAGE_KEY).toBe('candy-shop:v3')
    expect(p.rev).toBe(REVISION)
  })

  it('in the Hub build each signed-in child has her own shop', () => {
    const store = new MemoryStorage() as unknown as Storage
    const mine = { ...defaultProgress(), points: 40 }
    setPlayer('child-a')
    try {
      expect(storageKey()).toBe('candy-shop:v3:child-a')
      expect(saveProgress(mine, store)).toBe(true)
      expect(loadProgress(store)).toEqual(mine)
      setPlayer('child-b')
      expect(loadProgress(store)).toEqual(defaultProgress())
    } finally {
      setPlayer('')
    }
    expect(storageKey()).toBe(STORAGE_KEY)
  })

  it('an earlier save keeps her points (at most 100), customers, voice and what she has seen, and starts the ready box again', () => {
    const old = {
      day: 9,
      points: 64,
      won: false,
      closings: 8,
      served: 41,
      arrived: ['A', 'C', 'B', 'D', 'E'],
      pendingArrival: null,
      types: { A: { level: 3, history: [], served: 20, mode: 'compete', modeHistory: [] }, C: { level: 3, history: [true], served: 6, mode: 'compete', modeHistory: [] } },
      houses: { 5: { found: [1, 2] } },
      missed: { '5+2': 2 },
      met: ['rabbit', 'cat', 'duck', 'hedgehog', 'panda'],
      seen: ['g/goal', 'g/open', 'g/train', 'g/ready-box', 'g/tap-box', 'g/take-out', 'g/compete'],
      voice: false,
      allOrders: true,
      disabled: [],
      today: { plan: ['A'], customers: ['cat'], served: 0, firstBells: 0, start: 60, arrived: null },
    }
    const p = parseProgress(old)
    expect(p).toEqual({
      ...defaultProgress(),
      points: 64,
      served: 41,
      met: ['rabbit', 'cat', 'duck', 'hedgehog', 'panda'],
      // The goal (100), the competition rule and the ready box's guides are told once more.
      seen: ['g/open', 'g/take-out'],
      voice: false,
    })
    expect(p.types.C).toMatchObject({ mode: 'help', level: 1 })
    expect(p.disabled).toEqual(['A', 'D'])
    expect(Object.keys(p)).not.toContain('day')
    // 200 points of the old goal: the new goal is reached.
    expect(parseProgress({ ...old, points: 200, won: true })).toMatchObject({ points: 100, won: true })
    expect(parseProgress({ ...old, points: 150, won: false })).toMatchObject({ points: 100, won: true })
    // A save of §11 (rev 2, the preview only): its balance's epoch is kept, E is dropped.
    const r2 = parseProgress({ rev: 2, points: 30, epoch: 2, types: { E: { level: 2, mode: 'compete' } }, disabled: ['A', 'C', 'D'], seen: ['g/hold', 'g/open'] })
    expect(r2).toMatchObject({ rev: REVISION, points: 30, epoch: 2, disabled: ['A', 'D'], seen: ['g/hold', 'g/open'] })
    expect(Object.keys(r2.types)).toEqual(['A', 'C', 'D'])
  })

  it('works when storage throws or is missing, and ignores broken data', () => {
    expect(loadProgress(throwing)).toEqual(defaultProgress())
    expect(saveProgress(defaultProgress(), throwing)).toBe(false)
    expect(loadProgress(null)).toEqual(defaultProgress())
    expect(parseProgress('nonsense')).toEqual(defaultProgress())
    const odd = parseProgress({ rev: 3, points: 999, epoch: -3, types: { A: { level: 9, history: [true, 'x'], mode: 'bridge' }, C: { mode: 'bridge' }, B: { level: 2 }, E: { level: 2 } }, met: ['fox', 'dragon'], disabled: ['B', 'A', 'A', 'E'], batch: { orders: ['C', 'Q', 'E', 'C'], firstBells: 9 } })
    expect(odd.met).toEqual(['rabbit', 'cat', 'duck', 'fox'])
    expect(odd.points).toBe(100)
    expect(odd.won).toBe(true)
    expect(odd.epoch).toBe(0)
    // The bridge belongs to the ready box only.
    expect(odd.types.A).toEqual({ level: 3, history: [true], served: 0, mode: 'help', modeHistory: [] })
    expect(odd.types.C.mode).toBe('bridge')
    expect(Object.keys(odd.types)).toEqual(['A', 'C', 'D'])
    expect(odd.disabled).toEqual(['A'])
    expect(odd.batch).toEqual({ served: 2, firstBells: 2, orders: ['C', 'C'] })
  })
})
