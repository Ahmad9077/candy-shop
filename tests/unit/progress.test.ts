import { describe, expect, it } from 'vitest'
import { DAY_CUSTOMERS } from '../../src/domain/orders'
import {
  GOAL,
  POINTS_FULL_HOUSE,
  POINTS_NEW_SPLIT,
  POINTS_RIGHT,
  POINTS_WRONG,
  applyPoints,
  missPoints,
  setMode,
  stampHouse,
  MILESTONES,
  STORAGE_KEY,
  closeDay,
  closingLine,
  newChallenge,
  pointsFor,
  defaultProgress,
  loadProgress,
  markSeen,
  mostMissed,
  openTypes,
  parseProgress,
  recordDelivery,
  saveProgress,
  setPlayer,
  startDay,
  storageKey,
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

const day = () => startDay(defaultProgress(), ['A', 'A', 'A', 'A', 'A'], null, ['cat', 'duck', 'cat', 'rabbit', 'duck'])
/** A day where every type is in competition, starting at `points`. */
const competing = (points = 0) => {
  const p = { ...defaultProgress(), points }
  const types = Object.fromEntries(Object.entries(p.types).map(([t, v]) => [t, { ...v, mode: 'compete' as const }])) as ShopProgress['types']
  return startDay({ ...p, types }, ['A', 'B', 'C', 'D', 'E'], null, ['cat', 'duck', 'cat', 'rabbit', 'duck'])
}

describe('number houses (§9 B, §10.2)', () => {
  it('stamp a new split for +1 at the first bell, a known one for nothing, and a full house +5 once', () => {
    let houses = {}
    const first = stampHouse(houses, 4, 4, true)
    expect(first).toMatchObject({ isNew: true, justFull: false, bonus: 1 })
    houses = first.houses
    expect(stampHouse(houses, 4, 4, true)).toMatchObject({ isNew: false, bonus: 0 })
    const checked = stampHouse(houses, 4, 2, false)
    expect(checked).toMatchObject({ isNew: true, bonus: 0 })
    houses = checked.houses
    for (const x of [0, 1]) houses = stampHouse(houses, 4, x, true).houses
    const full = stampHouse(houses, 4, 3, true)
    expect(full).toMatchObject({ isNew: true, justFull: true, bonus: 6 })
    expect(full.houses['4']).toEqual({ found: [0, 1, 2, 3, 4], full: true })
    expect(stampHouse(full.houses, 4, 3, true)).toMatchObject({ justFull: false, bonus: 0 })
  })

  it('pays the bonuses only in competition: a house stamped in training earns nothing', () => {
    const help = stampHouse({}, 4, 1, true, 'help')
    expect(help).toMatchObject({ isNew: true, bonus: 0 })
    expect(help.houses['4']!.found).toEqual([1])
    let houses = help.houses
    for (const x of [0, 2, 3]) houses = stampHouse(houses, 4, x, true, 'help').houses
    expect(stampHouse(houses, 4, 4, true, 'help')).toMatchObject({ justFull: true, bonus: 0 })
    expect(stampHouse(houses, 4, 4, true, 'compete')).toMatchObject({ justFull: true, bonus: POINTS_NEW_SPLIT + POINTS_FULL_HOUSE })
    // The bonus goes onto the board only in competition, with the order's own +2.
    const p = recordDelivery(competing(), { type: 'B', firstBell: true, fact: null, bonus: 1 })
    expect(p.points).toBe(3)
    expect(recordDelivery(day(), { type: 'B', firstBell: true, fact: null, bonus: 1 }).points).toBe(0)
  })

  it('the balance figure: a faultless day with every type in competition', () => {
    // Five orders at +2; each «كيسين» with a new split +1; finishing a house +5 once.
    expect(DAY_CUSTOMERS * POINTS_RIGHT).toBe(10)
    let p = competing()
    for (const type of ['A', 'B', 'C', 'D', 'E'] as const) p = recordDelivery(p, { type, firstBell: true, fact: null, bonus: type === 'B' ? 1 : 0 })
    expect(p.points).toBe(11)
    expect(POINTS_FULL_HOUSE).toBe(5)
  })
})

describe('points in training and competition (§10.2)', () => {
  it('training never moves the board; competition is +2 right at the first try and −2 wrong', () => {
    expect(pointsFor('help', true)).toBe(0)
    expect(pointsFor('help', false)).toBe(0)
    expect(pointsFor('compete', true)).toBe(POINTS_RIGHT)
    expect(pointsFor('compete', false)).toBe(POINTS_WRONG)
    expect(POINTS_RIGHT).toBe(2)
    expect(POINTS_WRONG).toBe(-2)
    expect(GOAL).toBe(200)
  })

  it('a training day leaves the board where it was, right or wrong', () => {
    let p = startDay({ ...defaultProgress(), points: 40 }, ['A', 'A'], null, ['cat', 'duck'])
    p = missPoints(p, 'A')
    p = recordDelivery(p, { type: 'A', firstBell: false, fact: null })
    p = recordDelivery(p, { type: 'A', firstBell: true, fact: null })
    expect(p.points).toBe(40)
    expect(p.today).toMatchObject({ served: 2, firstBells: 1, start: 40 })
  })

  it('competition: +2 straight onto the board; a miss costs 2 at once and nothing more at the hand-over', () => {
    let p = competing(10)
    p = recordDelivery(p, { type: 'A', firstBell: true, fact: null })
    expect(p.points).toBe(12)
    p = missPoints(p, 'C')
    expect(p.points).toBe(10)
    p = recordDelivery(p, { type: 'C', firstBell: false, fact: '5+2' })
    expect(p.points).toBe(10)
  })

  it('never below 0, never above 200', () => {
    expect(missPoints(competing(1), 'A').points).toBe(0)
    expect(missPoints(competing(0), 'A').points).toBe(0)
    expect(recordDelivery(competing(199), { type: 'A', firstBell: true, fact: null }).points).toBe(200)
    expect(applyPoints(198, 5)).toBe(200)
    expect(applyPoints(1, -2)).toBe(0)
  })

  it('closes the day with the board as it stands: today is told from the morning\'s points', () => {
    let p = competing(196)
    for (let i = 0; i < 2; i += 1) p = recordDelivery(p, { type: 'A', firstBell: true, fact: null })
    p = closeDay(p)
    expect(p.points).toBe(200)
    expect(p.won).toBe(true)
    expect(p.closings).toBe(1)
    expect(p.today).toBeNull()
    expect(p.day).toBe(2)
  })

  it('moves a type by hand (the parents\' switch) and starts its history again', () => {
    const p = { ...defaultProgress(), types: { ...defaultProgress().types, D: { ...defaultProgress().types.D, modeHistory: [true, true] } } }
    const moved = setMode(p, 'D', 'compete')
    expect(moved.types.D).toMatchObject({ mode: 'compete', modeHistory: [] })
    expect(setMode(moved, 'D', 'help').types.D.mode).toBe('help')
  })

  it('closes a day with the coupon, the milestone crossed, or a «near» line dealt in turn', () => {
    expect(closingLine(190, 200, 0)).toEqual({ id: 'g/goal-200', near: false })
    expect(closingLine(46, 56, 0)).toEqual({ id: 'g/goal-50', near: false })
    expect(closingLine(96, 106, 0)).toEqual({ id: 'g/goal-100', near: false })
    expect(closingLine(140, 152, 0)).toEqual({ id: 'g/goal-150', near: false })
    expect(closingLine(10, 18, 0)).toEqual({ id: 'g/near-1', near: true })
    expect(closingLine(10, 18, 1)).toEqual({ id: 'g/near-2', near: true })
    expect(closingLine(10, 18, 5)).toEqual({ id: 'g/near-3', near: true })
    expect(closingLine(10, 10, 0)).toBeNull()
    expect(closingLine(18, 12, 0)).toEqual({ id: 'g/day-down', near: false })
    // Three days of near lines: all three said once before any repeats.
    let p = { ...defaultProgress(), points: 10 }
    const said: string[] = []
    for (let d = 0; d < 6; d += 1) {
      const before = p.points
      const today = startDay(p, ['A'], null, ['cat'])
      p = closeDay({ ...today, points: today.points + 2 })
      said.push(closingLine(before, p.points, p.nearSaid - 1)!.id)
    }
    expect(said.slice(0, 3).sort()).toEqual(['g/near-1', 'g/near-2', 'g/near-3'])
    expect(MILESTONES).toEqual([50, 100, 150])
  })

  it('«تحدي جديد» puts the points back to zero and keeps the levels', () => {
    const won = { ...defaultProgress(), points: 200, won: true, types: { ...defaultProgress().types, C: { ...defaultProgress().types.C, level: 3 as const, served: 40 } } }
    const fresh = newChallenge(won)
    expect(fresh.points).toBe(0)
    expect(fresh.won).toBe(false)
    expect(fresh.types.C.level).toBe(3)
  })
})

describe('arrivals over days', () => {
  it('after the ready box, the mix, the delivery and the sticker come one per morning', () => {
    let p: ShopProgress = { ...day(), arrived: ['A', 'C'] }
    for (let i = 0; i < 3; i += 1) p = recordDelivery(p, { type: 'A', firstBell: true, fact: null })
    p = closeDay(p)
    expect(p.pendingArrival).toBe('B')
    // A slow day: nothing yet; a second day: it comes whatever happened.
    let slow = closeDay({ ...day(), arrived: ['A', 'C', 'B'] })
    expect(slow.pendingArrival).toBeNull()
    slow = closeDay(startDay(slow, ['A', 'A', 'A', 'A', 'A'], null, ['cat', 'duck', 'cat', 'duck', 'cat']))
    expect(slow.pendingArrival).toBe('D')
  })

  it('the ready box arrives on the morning of day 2 whatever happened on day 1 (§8.7)', () => {
    for (const firstBells of [0, 5]) {
      let p = day()
      for (let i = 0; i < firstBells; i += 1) p = recordDelivery(p, { type: 'A', firstBell: true, fact: null })
      p = closeDay(p)
      expect(p.pendingArrival).toBe('C')
      p = startDay(p, ['C', 'A', 'C', 'A', 'C'], 'C', ['cat', 'duck', 'cat', 'duck', 'cat'])
      expect(p.arrived).toEqual(['A', 'C'])
      expect(p.pendingArrival).toBeNull()
    }
  })

  it('opens the types that arrived, or all of them for the parents, minus the ones switched off', () => {
    const p = defaultProgress()
    expect(openTypes(p)).toEqual(['A'])
    expect(openTypes({ ...p, allOrders: true })).toEqual(['A', 'C', 'B', 'D', 'E'])
    expect(openTypes({ ...p, arrived: ['A', 'C'], disabled: ['A'] })).toEqual(['C'])
    expect(openTypes({ ...p, arrived: ['A', 'C'], disabled: ['A', 'C'] })).toEqual(['A', 'C'])
  })
})

describe('missed facts', () => {
  it('collects the ready-box facts she missed and lets them fade when she gets them right', () => {
    let p = day()
    p = recordDelivery(p, { type: 'C', firstBell: false, fact: '5+2' })
    p = recordDelivery(p, { type: 'C', firstBell: false, fact: '5+2' })
    p = recordDelivery(p, { type: 'C', firstBell: false, fact: '4+3' })
    expect(mostMissed(p)).toEqual([[5, 2], [4, 3]])
    p = recordDelivery(p, { type: 'C', firstBell: true, fact: '4+3' })
    expect(p.missed).toEqual({ '5+2': 2 })
    expect(p.types.C.served).toBe(4)
  })
})

describe('storage', () => {
  it('saves and loads', () => {
    const store = new MemoryStorage() as unknown as Storage
    const p = markSeen({ ...day(), points: 7, won: false, nearSaid: 2 }, 'g/open')
    expect(saveProgress(p, store)).toBe(true)
    expect(loadProgress(store)).toEqual(p)
    expect((store as unknown as MemoryStorage).data.has(STORAGE_KEY)).toBe(true)
    expect(STORAGE_KEY).toBe('candy-shop:v3')
  })

  it('in the Hub build each signed-in child has her own shop', () => {
    const store = new MemoryStorage() as unknown as Storage
    const mine = { ...day(), points: 40, won: false, nearSaid: 0 }
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

  it('works when storage throws or is missing, and ignores broken data', () => {
    expect(loadProgress(throwing)).toEqual(defaultProgress())
    expect(saveProgress(defaultProgress(), throwing)).toBe(false)
    expect(loadProgress(null)).toEqual(defaultProgress())
    expect(parseProgress('nonsense')).toEqual(defaultProgress())
    const odd = parseProgress({ day: -4, points: 999, arrived: ['Z', 'C'], types: { C: { level: 9, history: [true, 'x'] } }, today: { plan: ['A', 'Q'] }, houses: { 5: { found: [5, 2, 2, 9] }, 12: { found: [1] } }, met: ['fox', 'dragon'] })
    expect(odd.houses).toEqual({ 5: { found: [2, 5], full: false } })
    expect(odd.met).toEqual(['rabbit', 'cat', 'duck', 'fox'])
    expect(odd.day).toBe(1)
    expect(odd.points).toBe(200)
    expect(odd.arrived).toEqual(['A', 'C'])
    expect(odd.types.C).toEqual({ level: 3, history: [true], served: 0, mode: 'help', modeHistory: [] })
    expect(odd.today).toBeNull()
  })
})
