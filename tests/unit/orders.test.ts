import { describe, expect, it } from 'vitest'
import { ARRIVAL_ORDER, CUSTOMERS, DAY_CUSTOMERS, GOODS, afterOrder, arrivalDue, blankType, dayCustomers, knownCustomers, makeOrder, namedToday, nextArrival, planDay, readyBoxFits, rideFits, stickerFits, twoBagsRange, type Level, type Order, type OrderType, type TypeProgress } from '../../src/domain/orders'
import { seeded } from '../../src/domain/random'

const SEEDS = Array.from({ length: 500 }, (_, i) => i * 7919 + 3)
const LEVELS: Level[] = [1, 2, 3]

describe('orders at every level, over many seeds', () => {
  it('«طلب»: 1-5, 3-10, 5-10, all chocolate', () => {
    const ranges = { 1: [1, 5], 2: [3, 10], 3: [5, 10] } as const
    for (const level of LEVELS) {
      const seen = new Set<number>()
      for (const seed of SEEDS) {
        const o = makeOrder('A', level, seeded(seed), 'cat')
        expect(o.type).toBe('A')
        expect(o.n).toBeGreaterThanOrEqual(ranges[level][0])
        expect(o.n).toBeLessThanOrEqual(ranges[level][1])
        expect(o.a).toBe(o.n)
        expect(o.b).toBe(0)
        seen.add(o.n)
      }
      expect(seen.size).toBe(ranges[level][1] - ranges[level][0] + 1)
    }
  })

  it('the ready box: a 2-5 + 1-2, a 3-7 + 1-3, a 4-8 + 1-4, never above ten', () => {
    const ranges = { 1: [2, 5, 1, 2], 2: [3, 7, 1, 3], 3: [4, 8, 1, 4] } as const
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const o = makeOrder('C', level, seeded(seed), 'duck')
        const [a0, a1, b0, b1] = ranges[level]
        expect(o.a >= a0 && o.a <= a1 && o.b >= b0 && o.b <= b1, JSON.stringify(o)).toBe(true)
        expect(o.n).toBe(o.a + o.b)
        expect(o.n).toBeLessThanOrEqual(10)
        expect(readyBoxFits(level, o.a, o.b)).toBe(true)
      }
    }
  })

  it('brings her missed facts back now and then, only when they fit the level', () => {
    let back = 0
    for (const seed of SEEDS) {
      const o = makeOrder('C', 2, seeded(seed), 'cat', { missed: { '5+2': 3, '9+1': 2 } })
      if (o.a === 5 && o.b === 2) back += 1
      expect(o.a === 9 && o.b === 1).toBe(false)
    }
    expect(back).toBeGreaterThan(SEEDS.length * 0.35)
  })

  it('never asks the same thing twice in a row', () => {
    for (const seed of SEEDS) {
      const rng = seeded(seed)
      const first = makeOrder('A', 1, rng, 'cat')
      expect(makeOrder('A', 1, rng, 'duck', { previous: first }).n).not.toBe(first.n)
      const box = makeOrder('C', 1, rng, 'cat')
      const next = makeOrder('C', 1, rng, 'duck', { previous: box })
      expect(next.a === box.a && next.b === box.b).toBe(false)
    }
  })
})

describe('two bags, the delivery and the sticker (§9, §10.1)', () => {
  it('«كيسين»: N 4-5, 6-8, 9-10 of one good, never the same good or the same N twice in a row', () => {
    for (const level of LEVELS) {
      const goods = new Set<string>()
      for (const seed of SEEDS) {
        const rng = seeded(seed)
        const first = makeOrder('B', level, rng, 'cat')
        const next = makeOrder('B', level, rng, 'duck', { previous: first })
        for (const o of [first, next]) {
          expect(twoBagsRange(level)).toContain(o.n)
          expect(GOODS).toContain(o.good)
          expect(Object.keys(o)).not.toContain('boxGood')
          goods.add(o.good)
        }
        expect(next.good).not.toBe(first.good)
        expect(next.n).not.toBe(first.n)
      }
      expect(goods.size).toBe(3)
    }
  })

  it('«توصيل»: sum ≤ 7 with 1-3 houses, then ≤ 10 with 1-4, starting at a house ≥ 1', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const o = makeOrder('D', level, seeded(seed), 'fox')
        expect(rideFits(level, o.a, o.b), JSON.stringify(o)).toBe(true)
        expect(o.n).toBe(o.a + o.b)
        if (level === 1) expect(o.n <= 7 && o.b <= 3).toBe(true)
        else expect(o.n <= 10 && o.b <= 4).toBe(true)
      }
    }
  })

  it('«كيس واحد»: sums ≤ 5, 4-8, 6-10 with the smaller ≤ 4; small-first cards only when asked', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const o = makeOrder('E', level, seeded(seed), 'panda')
        expect(stickerFits(level, o.a, o.b), JSON.stringify(o)).toBe(true)
        if (level === 3) {
          expect(o.a).toBeGreaterThanOrEqual(o.b)
          const small = makeOrder('E', 3, seeded(seed), 'panda', { smallFirst: true })
          expect(small.a).toBeLessThan(small.b)
          expect(small.smallFirst).toBe(true)
          expect(Math.min(small.a, small.b)).toBeLessThanOrEqual(4)
        }
      }
    }
  })
})

describe('goods (§8.2)', () => {
  it('«طلب» asks for any of the three goods, and never the same good twice in a row', () => {
    const seen = new Set<string>()
    for (const seed of SEEDS) {
      const rng = seeded(seed)
      let previous: Order | undefined
      for (let i = 0; i < 5; i += 1) {
        const o = makeOrder('A', 2, rng, 'cat', { previous })
        expect(GOODS).toContain(o.good)
        if (previous) expect(o.good).not.toBe(previous.good)
        seen.add(o.good)
        previous = o
      }
    }
    expect([...seen].sort()).toEqual(['candy', 'choc', 'takis'])
  })

  it('one good per sum (§10.1): the ready box, the delivery and the sticker each come in all three goods', () => {
    for (const type of ['C', 'D', 'E'] as OrderType[]) {
      const families = new Set<string>()
      for (const seed of SEEDS) {
        const o = makeOrder(type, 2, seeded(seed), 'duck')
        expect(GOODS).toContain(o.good)
        expect(Object.keys(o)).not.toContain('boxGood')
        families.add(o.good)
      }
      expect([...families].sort(), type).toEqual(['candy', 'choc', 'takis'])
    }
  })
})

describe('her name', () => {
  it('is said by at most two customers a day: a greeting about every second day, thanks about one day in three', () => {
    let hi = 0
    let thanks = 0
    for (let day = 1; day <= 60; day += 1) {
      const named = namedToday(day)
      hi += named.hi ? 1 : 0
      thanks += named.thanks ? 1 : 0
      expect(Number(named.hi) + Number(named.thanks)).toBeLessThanOrEqual(2)
    }
    expect(hi).toBe(30)
    expect(thanks).toBe(20)
  })
})

describe('hidden levels', () => {
  it('go up after 4 of the last 5 at the first bell, down after 1 or fewer, within 1-3', () => {
    let s: TypeProgress = { ...blankType(), level: 1, history: [], served: 0 }
    for (const ok of [true, false, true, true]) s = afterOrder(s, ok)
    expect(s.level).toBe(1)
    s = afterOrder(s, true)
    expect(s.level).toBe(2)
    expect(s.history).toEqual([])
    for (const ok of [false, false, true, false]) s = afterOrder(s, ok)
    expect(s.level).toBe(2)
    s = afterOrder(s, false)
    expect(s.level).toBe(1)
    s = { ...s, level: 3, history: [true, true, true], served: 9 }
    s = afterOrder(s, true)
    expect(s.level).toBe(3)
    expect(s.served).toBe(10)
    s = { ...s, level: 1, history: [false, false, false, false], served: 4 }
    expect(afterOrder(s, false).level).toBe(1)
  })
})

describe('training and competition (§10.2)', () => {
  it('a new type starts in training', () => {
    expect(blankType()).toMatchObject({ mode: 'help', modeHistory: [] })
  })

  it('training → competition after 4 of the last 5 right at the first try; the history starts again', () => {
    let s = blankType()
    for (const ok of [true, false, true, true]) s = afterOrder(s, ok)
    expect(s.mode).toBe('help')
    s = afterOrder(s, true)
    expect(s.mode).toBe('compete')
    expect(s.modeHistory).toEqual([])
    // At the least: four customers of training, all right.
    let quick = blankType()
    for (let i = 0; i < 4; i += 1) quick = afterOrder(quick, true)
    expect(quick.mode).toBe('compete')
  })

  it('competition → training when 1 or fewer of the last 5 were right', () => {
    let s: TypeProgress = { ...blankType(), mode: 'compete' }
    for (const ok of [false, true, false, false]) s = afterOrder(s, ok)
    expect(s.mode).toBe('compete')
    s = afterOrder(s, false)
    expect(s.mode).toBe('help')
    expect(s.modeHistory).toEqual([])
    // Two right of five keeps the competition.
    let t: TypeProgress = { ...blankType(), mode: 'compete' }
    for (const ok of [true, false, true, false, false]) t = afterOrder(t, ok)
    expect(t.mode).toBe('compete')
  })

  it('the number range moves by its own rule in both modes and is kept when the mode changes', () => {
    let s = blankType()
    for (let i = 0; i < 4; i += 1) s = afterOrder(s, true)
    // Four right: both moved at once (level 2, competition).
    expect(s).toMatchObject({ level: 2, mode: 'compete' })
    for (let i = 0; i < 4; i += 1) s = afterOrder(s, true)
    expect(s).toMatchObject({ level: 3, mode: 'compete' })
    for (let i = 0; i < 5; i += 1) s = afterOrder(s, false)
    expect(s).toMatchObject({ level: 2, mode: 'help' })
  })
})

describe('the day', () => {
  const levels = { A: 1, B: 1, C: 1, D: 1, E: 1 } as Record<OrderType, Level>

  it('is five «طلب» while nothing else has arrived', () => {
    for (const seed of SEEDS) expect(planDay({ open: ['A'], arrivedToday: null, levels, missedCount: 0 }, seeded(seed))).toEqual(['A', 'A', 'A', 'A', 'A'])
  })

  it('starts with what arrived this morning, and gives it every other order', () => {
    for (const seed of SEEDS) {
      const plan = planDay({ open: ['A', 'C'], arrivedToday: 'C', levels, missedCount: 0 }, seeded(seed))
      expect(plan).toEqual(['C', 'A', 'C', 'A', 'C'])
    }
  })

  it('once everything has arrived: at least two ready boxes, at most one delivery, every type can come', () => {
    const seen = new Set<string>()
    for (const seed of SEEDS) {
      const plan = planDay({ open: ['A', 'C', 'B', 'D', 'E'], arrivedToday: null, levels, missedCount: 1 }, seeded(seed))
      expect(plan).toHaveLength(DAY_CUSTOMERS)
      expect(plan.filter((t) => t === 'C').length).toBeGreaterThanOrEqual(2)
      expect(plan.filter((t) => t === 'D').length).toBeLessThanOrEqual(1)
      for (const t of plan) seen.add(t)
    }
    expect([...seen].sort()).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('the morning something arrives, it comes first (the delivery twice, the others three times)', () => {
    for (const seed of SEEDS) {
      expect(planDay({ open: ['A', 'C', 'B'], arrivedToday: 'B', levels, missedCount: 0 }, seeded(seed)).filter((t, i) => i % 2 === 0)).toEqual(['B', 'B', 'B'])
      const d = planDay({ open: ['A', 'C', 'B', 'D'], arrivedToday: 'D', levels, missedCount: 0 }, seeded(seed))
      expect(d[0]).toBe('D')
      expect(d.filter((t) => t === 'D')).toHaveLength(2)
    }
  })

  it('with A and C only: at least two ready boxes, never three of a kind in a row', () => {
    for (const seed of SEEDS) {
      const plan = planDay({ open: ['A', 'C'], arrivedToday: null, levels: { ...levels, A: 3, C: 1 }, missedCount: 2 }, seeded(seed))
      expect(plan).toHaveLength(DAY_CUSTOMERS)
      expect(plan.filter((t) => t === 'C').length).toBeGreaterThanOrEqual(2)
      for (let i = 2; i < plan.length; i += 1) expect(plan[i] === plan[i - 1] && plan[i] === plan[i - 2]).toBe(false)
    }
  })

  it('leans toward her weaker type', () => {
    let weakA = 0
    let weakC = 0
    for (const seed of SEEDS) {
      weakA += planDay({ open: ['A', 'C'], arrivedToday: null, levels: { ...levels, A: 1, C: 3 }, missedCount: 0 }, seeded(seed)).filter((t) => t === 'A').length
      weakC += planDay({ open: ['A', 'C'], arrivedToday: null, levels: { ...levels, A: 3, C: 1 }, missedCount: 0 }, seeded(seed)).filter((t) => t === 'A').length
    }
    expect(weakA).toBeGreaterThan(weakC)
  })

  it('keeps to the types the parents left on', () => {
    for (const seed of SEEDS.slice(0, 50)) expect(new Set(planDay({ open: ['C'], arrivedToday: null, levels, missedCount: 0 }, seeded(seed)))).toEqual(new Set(['C']))
  })

  it('brings customers who know the shop, never twice in a row, a newcomer second', () => {
    expect(knownCustomers(0)).toEqual(['rabbit', 'cat', 'duck'])
    expect(knownCustomers(5)).toContain('hedgehog')
    expect(knownCustomers(33)).not.toContain('penguin')
    expect(knownCustomers(34)).toHaveLength(8)
    expect(CUSTOMERS.map((c) => c.after)).toEqual([0, 0, 0, 5, 10, 16, 24, 34])
    for (const seed of SEEDS) {
      const early = dayCustomers(seeded(seed), 5, 3)
      for (const id of early) expect(['rabbit', 'cat', 'duck']).toContain(id)
      expect(dayCustomers(seeded(seed), 5, 5, 'hedgehog').slice(0, 2)).toContain('hedgehog')
    }
    for (const seed of SEEDS) {
      const list = dayCustomers(seeded(seed))
      expect(list).toHaveLength(DAY_CUSTOMERS)
      for (let i = 1; i < list.length; i += 1) expect(list[i]).not.toBe(list[i - 1])
      for (const id of list) expect(CUSTOMERS.map((c) => c.id)).toContain(id)
    }
  })

  it('gives every customer their own greetings and thanks, from the recorded lines', () => {
    for (const c of CUSTOMERS) {
      expect(c.hi.length).toBeGreaterThanOrEqual(2)
      expect(c.thanks.length).toBeGreaterThanOrEqual(3)
      for (const id of [...c.hi, ...c.thanks]) expect(id).toMatch(/^c\/(hi|thanks)-\d$/)
    }
  })

  it('gives every customer a voice of their own, higher and quicker', () => {
    for (const c of CUSTOMERS) {
      expect(c.rate).toBeGreaterThanOrEqual(1.12)
      expect(c.rate).toBeLessThanOrEqual(1.35)
    }
    expect(new Set(CUSTOMERS.map((c) => c.rate)).size).toBe(CUSTOMERS.length)
  })
})

describe('arrivals', () => {
  it('come in order: the ready box, then the mix, the delivery and the sticker', () => {
    expect(ARRIVAL_ORDER).toEqual(['A', 'C', 'B', 'D', 'E'])
    expect(nextArrival(['A'])).toBe('C')
    expect(nextArrival(['A', 'C'])).toBe('B')
    expect(nextArrival(['A', 'C', 'B', 'D'])).toBe('E')
    expect(nextArrival(['A', 'C', 'B', 'D', 'E'])).toBeNull()
  })

  it('after a day with 3 first-bell deliveries, or after two days whatever happened', () => {
    expect(arrivalDue(3, 1)).toBe(true)
    expect(arrivalDue(2, 1)).toBe(false)
    expect(arrivalDue(0, 2)).toBe(true)
  })
})
