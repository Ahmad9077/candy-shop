import { describe, expect, it } from 'vitest'
import { CUSTOMERS, GOODS, ORDER_TYPES, afterOrder, blankType, knownCustomers, makeOrder, namedHi, namedThanks, newcomerOf, nextCustomer, nextType, readyBoxFits, rideFits, stepsOf, type CustomerId, type Level, type Order, type OrderType, type TypeProgress } from '../../src/domain/orders'
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

describe('the delivery and the count-on order (§9, §11.1)', () => {
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

  it('the ready box (§12.1): the box always holds the bigger number, never above ten, several sums a level', () => {
    const ranges = { 1: [2, 5, 1, 2], 2: [3, 7, 1, 3], 3: [4, 8, 1, 4] } as const
    for (const level of LEVELS) {
      const sums = new Set<number>()
      for (const seed of SEEDS) {
        const o = makeOrder('C', level, seeded(seed), 'panda')
        const [a0, a1, b0, b1] = ranges[level]
        expect(o.a >= a0 && o.a <= a1 && o.b >= b0 && o.b <= b1, JSON.stringify(o)).toBe(true)
        expect(o.a).toBeGreaterThanOrEqual(o.b)
        expect(o.n).toBe(o.a + o.b)
        expect(o.n).toBeLessThanOrEqual(10)
        expect(Object.keys(o)).not.toContain('smallFirst')
        sums.add(o.n)
      }
      expect(sums.size).toBeGreaterThan(2)
    }
    expect(readyBoxFits(3, 2, 6)).toBe(false)
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

  it('one good per sum (§10.1): the ready box and the delivery each come in all three goods', () => {
    for (const type of ['C', 'D'] as OrderType[]) {
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

describe('her name (§11.4)', () => {
  it('greets her once in eight customers and thanks her once in twelve, never both on one customer', () => {
    let hi = 0
    let thanks = 0
    for (let served = 0; served < 96; served += 1) {
      hi += namedHi(served) ? 1 : 0
      thanks += namedThanks(served) ? 1 : 0
      expect(namedHi(served) && namedThanks(served)).toBe(false)
    }
    expect(hi).toBe(12)
    expect(thanks).toBe(8)
    expect(namedHi(0)).toBe(true)
    expect(namedThanks(7)).toBe(true)
  })
})

describe('hidden levels', () => {
  it('go up after 4 of the last 5 at the first try, down after 1 or fewer, within 1-3', () => {
    let s: TypeProgress = { ...blankType(), level: 1, history: [], served: 0 }
    for (const ok of [true, false, true, true]) s = afterOrder(s, ok, 'A')
    expect(s.level).toBe(1)
    s = afterOrder(s, true, 'A')
    expect(s.level).toBe(2)
    expect(s.history).toEqual([])
    for (const ok of [false, false, true, false]) s = afterOrder(s, ok, 'D')
    expect(s.level).toBe(2)
    s = afterOrder(s, false, 'D')
    expect(s.level).toBe(1)
    s = { ...s, level: 3, history: [true, true, true], served: 9 }
    s = afterOrder(s, true, 'D')
    expect(s.level).toBe(3)
    expect(s.served).toBe(10)
    s = { ...s, level: 1, history: [false, false, false, false], served: 4 }
    expect(afterOrder(s, false, 'A').level).toBe(1)
  })

  it('the ready box: the number level moves only in competition (the method is learnt on easy numbers)', () => {
    let help: TypeProgress = { ...blankType(), mode: 'help' }
    let bridge: TypeProgress = { ...blankType(), mode: 'bridge' }
    for (let i = 0; i < 3; i += 1) {
      help = afterOrder(help, true, 'C')
      bridge = afterOrder(bridge, true, 'C')
    }
    expect(help).toMatchObject({ level: 1, history: [] })
    expect(bridge).toMatchObject({ level: 1, history: [] })
    let compete: TypeProgress = { ...blankType(), mode: 'compete' }
    for (let i = 0; i < 4; i += 1) compete = afterOrder(compete, true, 'C')
    expect(compete).toMatchObject({ level: 2, mode: 'compete' })
    compete = { ...compete, history: [false, false, true, false] }
    compete = afterOrder(compete, false, 'C')
    expect(compete.level).toBe(1)
  })
})

describe('the steps of help (§11.2)', () => {
  it('the ready box has three steps, the others two; B and E are gone', () => {
    expect(stepsOf('C')).toEqual(['help', 'bridge', 'compete'])
    for (const t of ['A', 'D'] as OrderType[]) expect(stepsOf(t)).toEqual(['help', 'compete'])
    expect(ORDER_TYPES).toEqual(['C', 'A', 'D'])
  })

  it('a new type starts in training', () => {
    expect(blankType()).toMatchObject({ mode: 'help', modeHistory: [] })
  })

  it('the ready box: up after 4 of the last 5 right in the step, help → bridge → compete; the history starts again', () => {
    let s = blankType()
    for (const ok of [true, false, true, true]) s = afterOrder(s, ok, 'C')
    expect(s.mode).toBe('help')
    s = afterOrder(s, true, 'C')
    expect(s).toMatchObject({ mode: 'bridge', modeHistory: [] })
    for (let i = 0; i < 4; i += 1) s = afterOrder(s, true, 'C')
    expect(s).toMatchObject({ mode: 'compete', modeHistory: [] })
    // At the top it stays.
    for (let i = 0; i < 6; i += 1) s = afterOrder(s, true, 'C')
    expect(s.mode).toBe('compete')
  })

  it('the ready box: down after two wrong first tries in a row, compete → bridge → help', () => {
    let s: TypeProgress = { ...blankType(), mode: 'compete' }
    s = afterOrder(s, false, 'C')
    s = afterOrder(s, true, 'C')
    s = afterOrder(s, false, 'C')
    expect(s.mode).toBe('compete')
    s = afterOrder(s, false, 'C')
    expect(s).toMatchObject({ mode: 'bridge', modeHistory: [] })
    s = afterOrder(s, false, 'C')
    expect(s.mode).toBe('bridge')
    s = afterOrder(s, false, 'C')
    expect(s).toMatchObject({ mode: 'help', modeHistory: [] })
    // Training is the floor.
    s = afterOrder(afterOrder(s, false, 'C'), false, 'C')
    expect(s.mode).toBe('help')
  })

  it('A and D: help → compete after 4 of 5, compete → help after two wrong in a row', () => {
    for (const t of ['A', 'D'] as OrderType[]) {
      let s = blankType()
      for (let i = 0; i < 4; i += 1) s = afterOrder(s, true, t)
      expect(s.mode, t).toBe('compete')
      s = afterOrder(afterOrder(s, false, t), false, t)
      expect(s.mode, t).toBe('help')
    }
  })

  it('the number range of A and D moves in both steps and is kept when the step changes', () => {
    let s = blankType()
    for (let i = 0; i < 4; i += 1) s = afterOrder(s, true, 'A')
    expect(s).toMatchObject({ level: 2, mode: 'compete' })
    for (let i = 0; i < 4; i += 1) s = afterOrder(s, true, 'A')
    expect(s).toMatchObject({ level: 3, mode: 'compete' })
    for (let i = 0; i < 2; i += 1) s = afterOrder(s, false, 'A')
    expect(s).toMatchObject({ level: 3, mode: 'help' })
  })
})

describe('one customer after another (§11.4)', () => {
  const levels = { A: 1, C: 1, D: 1 } as Record<OrderType, Level>

  it('is the ready box only while the others are off, and the ready box when nothing is open', () => {
    for (const seed of SEEDS) {
      expect(nextType({ open: ['C'], levels, missedCount: 0, recent: ['C', 'C', 'C'] }, seeded(seed))).toBe('C')
      expect(nextType({ open: [], levels, missedCount: 0, recent: [] }, seeded(seed))).toBe('C')
    }
  })

  it('with several open: never three of a kind in a row, a delivery at most once in five, every type can come', () => {
    const seen = new Set<string>()
    for (const seed of SEEDS.slice(0, 100)) {
      const rng = seeded(seed)
      const recent: OrderType[] = []
      for (let i = 0; i < 30; i += 1) {
        const t = nextType({ open: ['C', 'A', 'D'], levels, missedCount: 1, recent: recent.slice(-4) }, rng)
        recent.push(t)
        seen.add(t)
      }
      for (let i = 2; i < recent.length; i += 1) expect(recent[i] === recent[i - 1] && recent[i] === recent[i - 2]).toBe(false)
      for (let i = 0; i + 5 <= recent.length; i += 1) expect(recent.slice(i, i + 5).filter((t) => t === 'D').length).toBeLessThanOrEqual(1)
    }
    expect([...seen].sort()).toEqual(['A', 'C', 'D'])
  })

  it('leans toward her weaker type', () => {
    let weakA = 0
    let weakC = 0
    for (const seed of SEEDS) {
      if (nextType({ open: ['A', 'C'], levels: { ...levels, A: 1, C: 3 }, missedCount: 0, recent: [] }, seeded(seed)) === 'A') weakA += 1
      if (nextType({ open: ['A', 'C'], levels: { ...levels, A: 3, C: 1 }, missedCount: 0, recent: [] }, seeded(seed)) === 'A') weakC += 1
    }
    expect(weakA).toBeGreaterThan(weakC)
  })

  it('brings customers who know the shop, never twice in a row, a newcomer the very next', () => {
    expect(knownCustomers(0)).toEqual(['rabbit', 'cat', 'duck'])
    expect(knownCustomers(5)).toContain('hedgehog')
    expect(knownCustomers(33)).not.toContain('penguin')
    expect(knownCustomers(34)).toHaveLength(8)
    expect(CUSTOMERS.map((c) => c.after)).toEqual([0, 0, 0, 5, 10, 16, 24, 34])
    expect(newcomerOf(4, ['rabbit', 'cat', 'duck'])).toBeNull()
    expect(newcomerOf(5, ['rabbit', 'cat', 'duck'])).toBe('hedgehog')
    expect(newcomerOf(5, ['rabbit', 'cat', 'duck', 'hedgehog'])).toBeNull()
    for (const seed of SEEDS) {
      const rng = seeded(seed)
      expect(nextCustomer(rng, 5, 'cat', 'hedgehog')).toBe('hedgehog')
      let previous: CustomerId | null = null
      for (let i = 0; i < 10; i += 1) {
        const id: CustomerId = nextCustomer(rng, 3, previous)
        expect(['rabbit', 'cat', 'duck']).toContain(id)
        expect(id).not.toBe(previous)
        previous = id
      }
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
