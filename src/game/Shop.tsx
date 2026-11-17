// «البقالة»: one persistent scene. Customers walk in one after another, without days or rounds
// (§11.4). The stream is the ready box (C, §12.1): a closed box with its number on the counter; she
// taps the ordered good at the bottom and each tap drops one piece onto the tray beside it; then the
// bell. Three steps of help: in training the box's number is said and the voice counts on with her,
// each piece tagged; in the bridge only the box's number is said; in competition nothing is said and
// a right first bell is +2. A wrong bell is answered by the pieces (§12.2): counted on from the box up
// to the order, ghost cups for what is missing, extra pieces marked; she fixes it. Nothing is ever
// taken away. While she solves, everything but the task fades (§11.6). The goal: 100 points and Takis.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Narrator } from '../audio/player'
import { sfx } from '../audio/sfx'
import { Bear, type BearMood } from '../art/Bear'
import { GiftBox } from '../art/Box'
import { Candy, type Flavor } from '../art/Candy'
import { CustomerArt, type CustomerMood } from '../art/Customer'
import { BellArt, Coin, CouponArt, DoorArt, Groceries, JarArt, PrizeBoard, Receipt, ShopWindow, TakisBag } from '../art/ShopArt'
import { clip, sentenceClips, type LineId } from '../data/lines'
import { ar } from '../domain/digits'
import { CUSTOMERS, customerRate, factOf, knownCustomers, makeOrder, namedHi, namedThanks, newcomerOf, nextCustomer, nextType, type CustomerId, type Good, type Mode, type Order, type OrderType } from '../domain/orders'
import { GOAL, adoptBalance, markSeen, nearDealt, openTypes, pointsMoment, recordDelivery, takeBatch, type Balance, type PointsMoment, type ShopProgress } from '../domain/progress'
import { Bag, type Rng } from '../domain/random'
import type { HubBridge } from '../hub/bridge'
import { fly } from './fly'
import { Job, run } from './job'
import { Street } from './Street'
import { TapButton } from './tap'

type Phase = 'goal' | 'arriving' | 'packing' | 'checking' | 'leaving' | 'coupon' | 'street'

interface Live {
  key: number
  order: Order
  index: number
  /** The order's step of help when it was given (training, bridge or competition). */
  mode: Mode
  mood: CustomerMood
  /** Walking in from the door, standing at the counter, walking out, or waiting at home (a delivery). */
  place: 'door' | 'counter' | 'out' | 'away'
}

interface Piece {
  id: number
  flavor: Flavor
  arriving?: boolean
  /** Added to a ready box: keeps a lime ring when everything lines up. */
  lime?: boolean
}

/**
 * After a wrong bell the pieces show the answer (§12.2). On the ready box: the box's pieces framed
 * under their one number, then the tray's cups tagged up to the order, ghost cups for what is
 * missing, pieces past the order marked extra; it stays while she fixes the tray. On «طلب»: the tray
 * counted from one with tags.
 */
interface Reveal {
  /** The box is open, its pieces framed under their one number. */
  group: boolean
  /** Cups before this one carry their tag (pieces and ghosts, up to the order). */
  tagged: number
  /** Empty cups before this one show as ghosts (up to the order). */
  ghosts: number
  /** This many pieces past the order are marked extra. */
  extra: number
  /** What the voice is saying: 0 the group's number, k the k-th cup, -1 nothing. */
  said: number
}

/** How long the moments of the shop take (ms of real time; near zero with ?fast=1). */
export const TIMING = {
  walk: 800,
  hop: 450,
  boxSlide: 320,
  boxPeek: 1200,
  readyMoment: 700,
  lid: 300,
  countBeat: 560,
  lineupGap: 45,
  /** The receipt stays this long after its sentence has ended (§8.4). */
  receiptAfter: 1200,
  goalAfter: 700,
  goalAtLeast: 2600,
}

const line = (id: LineId) => clip.line(id)
const num = (n: number) => clip.num(n)
const FLAVOR: Record<Good, Flavor> = { choc: 'choc', candy: 'pink', takis: 'takis' }
const GOOD_WORD: Record<Good, LineId> = { choc: 'c/p-choc', candy: 'c/p-candy', takis: 'c/p-takis' }
const GOOD_NAME: Record<Good, string> = { choc: 'كاكاو', candy: 'حلاو', takis: 'تاكيز' }
/** The guide lines of each order type, said again on Dabdoob's «؟». */
const GUIDE_LINES: Record<OrderType, LineId[]> = {
  A: ['g/tap-jar', 'g/take-out', 'g/ring-bell'],
  C: ['g/ready-box', 'g/tap-box', 'g/count-on', 'g/ring-bell'],
  D: ['g/delivery', 'g/ride', 'g/door'],
}

export function Shop({
  progress,
  setProgress,
  narrator,
  rng,
  fast,
  bridge,
  takeBalance,
  onParents,
}: {
  progress: ShopProgress
  setProgress: (update: (p: ShopProgress) => ShopProgress) => void
  narrator: Narrator
  rng: Rng
  fast: boolean
  bridge: HubBridge
  /** A balance the Hub sent while she was in the shop (an Admin reset): taken between orders. */
  takeBalance: () => Balance | null
  onParents: () => void
}) {
  // The shop's script runner; replaced when the scene mounts again (React runs effects twice in
  // development), so a stopped script never blocks the new one.
  const jobRef = useRef<Job | null>(null)
  const J = () => {
    if (!jobRef.current) jobRef.current = new Job(narrator, fast)
    return jobRef.current
  }
  const rootRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(progress)
  useEffect(() => {
    progressRef.current = progress
  })
  // Each animal greets and thanks with its own few lines (from the recorded ones).
  const bags = useMemo(() => new Map(CUSTOMERS.map((c) => [c.id, { hi: new Bag(c.hi, rng), thanks: new Bag(c.thanks, rng) }])), [rng])
  const hiFor = (id: CustomerId) => (bags.get(id)?.hi.next() ?? 'c/hi-1') as LineId
  const thanksFor = (id: CustomerId) => (bags.get(id)?.thanks.next() ?? 'c/thanks-1') as LineId

  const [phase, setPhaseState] = useState<Phase>('arriving')
  const phaseRef = useRef<Phase>('arriving')
  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])
  const [ready, setReadyState] = useState(false)
  const readyRef = useRef(false)
  const setReady = useCallback((value: boolean) => {
    readyRef.current = value
    setReadyState(value)
  }, [])

  const [live, setLive] = useState<Live | null>(null)
  const liveRef = useRef<Live | null>(null)
  const [leaving, setLeaving] = useState<Live | null>(null)
  const [bubble, setBubble] = useState(false)
  const [tray, setTray] = useState<Piece[]>([])
  const trayRef = useRef<Piece[]>([])
  const [side, setSide] = useState<Piece[]>([])
  const sideRef = useRef<Piece[]>([])
  const [box, setBox] = useState<{ shown: boolean; open: boolean; lineup: boolean }>({ shown: false, open: false, lineup: false })
  const [reveal, setRevealState] = useState<Reveal | null>(null)
  const revealRef = useRef<Reveal | null>(null)
  const setReveal = (next: Reveal | null) => {
    revealRef.current = next
    setRevealState(next)
  }
  const [receipt, setReceipt] = useState<{ a: number; b: number; n: number; good: Good; part: number } | null>(null)
  /** The board's numeral while coins are on their way (it ticks as they land), or a reset runs down. */
  const [boardShown, setBoardShown] = useState<number | null>(null)
  const [boardLit, setBoardLit] = useState(false)
  const [guide, setGuide] = useState<string | null>(null)
  const [bellKey, setBellKey] = useState(0)
  const [jiggle, setJiggle] = useState<string | null>(null)
  const [swell, setSwell] = useState(0)
  const [shownPoints, setShownPoints] = useState<number | null>(null)
  const [bearMood, setBearMood] = useState<BearMood>('idle')
  const [sparkle, setSparkle] = useState<string | null>(null)
  /** The ready box's number has been said for this order (training and the bridge): she holds it. */
  const [held, setHeldState] = useState(false)
  const heldRef = useRef(false)
  const setHeld = (value: boolean) => {
    heldRef.current = value
    setHeldState(value)
  }
  const firstBell = useRef(true)
  const nextId = useRef(1)
  const orderCount = useRef(0)
  const skip = useRef<(() => void) | null>(null)
  const couponClosed = useRef<(() => void) | null>(null)
  const previousOrder = useRef<Order | undefined>(undefined)
  const recentTypes = useRef<OrderType[]>([])
  /** The next two customers, waiting by the door (the queue is who really comes in next). */
  const [queue, setQueueState] = useState<CustomerId[]>([])
  const queueRef = useRef<CustomerId[]>([])

  const wait = (ms: number) => J().wait(ms)
  const seen = (key: string) => progressRef.current.seen.includes(key)
  const see = (key: string) => {
    progressRef.current = markSeen(progressRef.current, key)
    setProgress((p) => markSeen(p, key))
  }
  /** Shop-side changes to her progress: the ref first (the scripts read it), then the state. */
  const commit = (next: ShopProgress) => {
    progressRef.current = next
    setProgress(() => next)
  }

  /**
   * A guide line, once: the first time the thing comes up. It counts as said only once it starts:
   * a line dropped before its turn (she rang the bell meanwhile) comes back the next time.
   */
  const guiding = useRef(new Set<string>())
  const guideOnce = async (id: LineId, spot: string | null = null) => {
    if (seen(id) || guiding.current.has(id)) return
    guiding.current.add(id)
    if (spot) setGuide(spot)
    try {
      await J().say([line(id)], { prompt: true, onStart: () => see(id) })
    } finally {
      guiding.current.delete(id)
    }
  }
  /** A spot pulses once, for a moment. */
  const pulse = (spot: string) => {
    setGuide(spot)
    window.setTimeout(() => setGuide((g) => (g === spot ? null : g)), 1200)
  }

  const customerSays = (clips: string[], options: { prompt?: boolean; joined?: boolean } = {}) => {
    const who = liveRef.current?.order.customer
    return J().say(clips, { rate: who ? customerRate(who) : 1.2, ...options })
  }
  const orderClips = (order: Order) => [line('c/want'), num(order.n), line(GOOD_WORD[order.good])]

  const setTrayPieces = (pieces: Piece[]) => {
    trayRef.current = pieces
    setTray(pieces)
  }
  const setSidePieces = (pieces: Piece[]) => {
    sideRef.current = pieces
    setSide(pieces)
  }
  const flash = (what: string) => {
    setJiggle(what)
    window.setTimeout(() => setJiggle((j) => (j === what ? null : j)), 450)
  }

  /** Waits `ms`, or less if she taps to skip (the big board). */
  const skippable = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = window.setTimeout(done, fast ? 0 : ms)
      function done() {
        window.clearTimeout(timer)
        skip.current = null
        resolve()
      }
      skip.current = done
    })

  /** The board's numeral runs from one number to another (a reset from the Hub: no line). */
  const runBoard = (from: number, to: number) => {
    const steps = Math.min(20, Math.abs(to - from))
    if (steps === 0) return
    setBoardShown(from)
    for (let i = 1; i <= steps; i += 1) {
      window.setTimeout(() => setBoardShown(i === steps ? null : Math.round(from + ((to - from) * i) / steps)), fast ? 0 : i * 60)
    }
  }

  /** A balance the Hub sent while she played: it takes effect here, between two orders. */
  const adoptPending = () => {
    const answer = takeBalance()
    if (!answer) return
    const before = progressRef.current
    const next = adoptBalance(before, answer)
    if (next === before) return
    commit(next)
    runBoard(before.points, next.points)
  }

  // ── A customer walks in ───────────────────────────────────────────────
  /**
   * The next customer walks up. If a receipt is still being read, or the points are being told
   * (`before`), she waits by the counter in silence; her box, her bubble and her order come only
   * once that is over.
   */
  const serveNext = async (before: Promise<void> = Promise.resolve()) => {
    const p = progressRef.current
    const type = nextType({ open: openTypes(p), levels: { A: p.types.A.level, C: p.types.C.level, D: p.types.D.level }, missedCount: Object.keys(p.missed).length, recent: recentTypes.current }, rng)
    recentTypes.current = [...recentTypes.current, type].slice(-4)
    const customer = nextInLine(p)
    const mode = p.types[type].mode
    const order = makeOrder(type, p.types[type].level, rng, customer, { missed: p.missed, previous: previousOrder.current })
    previousOrder.current = order
    const index = orderCount.current++
    // Her name, by the orders served before this one (§11.4).
    const named = namedHi(p.served)
    firstBell.current = true
    setReady(false)
    setPhase('arriving')
    setBubble(false)
    if (order.type === 'D') {
      await before
      adoptPending()
      clearCounter()
      // The phone rings: a delivery. The scene goes out to the street.
      const away: Live = { key: nextId.current++, order, index, mode, mood: 'idle', place: 'away' }
      liveRef.current = away
      setLive(away)
      sfx.phone()
      setPhase('street')
      return
    }
    const me: Live = { key: nextId.current++, order, index, mode, mood: 'walk', place: 'door' }
    liveRef.current = me
    setLive(me)
    sfx.door()
    await wait(30)
    setLive({ ...me, place: 'counter' })
    const walkIn = wait(TIMING.walk).then(() => {
      const here = { ...me, place: 'counter' as const, mood: 'idle' as const }
      liveRef.current = here
      setLive(here)
    })
    await before
    adoptPending()
    clearCounter()
    setBox({ shown: order.type === 'C', open: order.type === 'C', lineup: false })
    if (order.type === 'C') {
      // Dabdoob slides the ready box onto the counter, open for a moment, then the lid snaps shut.
      sfx.slide()
      await wait(TIMING.boxSlide)
      await wait(TIMING.readyMoment)
      setBox({ shown: true, open: false, lineup: false })
      sfx.lid()
      await wait(TIMING.lid)
    }
    await walkIn
    setReady(true)
    setPhase('packing')
    setBubble(true)
    setBearMood(stance(mode))
    // Training and the bridge: the box pulses until its number has been said.
    if (order.type === 'C' && mode !== 'compete') setGuide('box')
    // Spoken once she can already start: the greeting and the order.
    if (!seen('g/open')) void guideOnce('g/open')
    // A customer who has just come to know the shop is announced, once.
    if (!p.met.includes(customer)) {
      commit({ ...progressRef.current, met: [...new Set([...progressRef.current.met, customer])] })
      setSparkle('customer')
      sfx.sparkle()
      window.setTimeout(() => setSparkle(null), 1600)
      void J().say([line('g/new-customer')], { prompt: true })
    }
    void customerSays([line(named ? 'c/hi-dima' : hiFor(customer))])
    void customerSays(orderClips(order), { prompt: true, joined: true })
    // First-time lines, while this order is still hers to pack (once she has rung, the rest wait for
    // the next customer).
    const still = () => liveRef.current?.key === me.key && phaseRef.current === 'packing'
    if (mode === 'help') await guideOnce('g/train')
    if (!still()) return
    if (order.type === 'A') {
      await guideOnce('g/tap-jar', `src-${order.good}`)
      if (still() && p.types.A.served >= 2) await guideOnce('g/take-out')
    } else if (!heldRef.current) {
      await guideOnce('g/ready-box', 'box')
      if (still() && !heldRef.current) await guideOnce('g/tap-box', 'box')
    }
  }

  /**
   * Who comes in now: a newcomer first (the very next customer after they join), else the first of
   * the queue; never the same customer twice in a row. The queue is filled up again behind them.
   */
  const nextInLine = (p: ShopProgress): CustomerId => {
    const previous = previousOrder.current?.customer ?? null
    const known = knownCustomers(p.served)
    const newcomer = newcomerOf(p.served, p.met)
    const waiting = queueRef.current.filter((id) => known.includes(id))
    const customer = newcomer && newcomer !== previous ? newcomer : waiting[0] && waiting[0] !== previous ? waiting[0] : nextCustomer(rng, p.served, previous)
    const rest = waiting.filter((id) => id !== customer)
    while (rest.length < 2) rest.push(nextCustomer(rng, p.served, rest.at(-1) ?? customer))
    queueRef.current = rest
    setQueueState(rest)
    return customer
  }

  /** The counter is cleared for the next order (the last receipt has been read by now). */
  const clearCounter = () => {
    setReceipt(null)
    setReveal(null)
    setTrayPieces([])
    setSidePieces([])
    setHeld(false)
    setGuide(null)
    setBox({ shown: false, open: false, lineup: false })
  }

  // ── Taps ──────────────────────────────────────────────────────────────
  const canPack = () => readyRef.current && phaseRef.current === 'packing'
  /** Training: Dabdoob counts with her. The bridge and competition: taps only plip. */
  const counting = () => liveRef.current?.mode === 'help'
  /** Dabdoob leans in (training and the bridge), or steps back with a paw over his mouth (competition). */
  const stance = (mode: Mode | undefined = liveRef.current?.mode): BearMood => (mode === 'compete' ? 'hush' : mode ? 'lean' : 'idle')

  /** Only the ordered good answers; another source wobbles while the right one pulses. */
  const tapSource = (good: Good, rect: DOMRect) => {
    const order = liveRef.current?.order
    if (!order || !canPack()) {
      flash(`src-${good}`)
      return
    }
    if (good !== order.good) {
      flash(`src-${good}`)
      pulse(`src-${order.good}`)
      return
    }
    setGuide((g) => (g === `src-${good}` ? null : g))
    const flavor = FLAVOR[good]
    if (order.type === 'A') {
      if (trayRef.current.length >= 10) return flash(`src-${good}`)
      const piece: Piece = { id: nextId.current++, flavor, arriving: true }
      const pieces = [...trayRef.current, piece]
      setTrayPieces(pieces)
      const count = pieces.length
      sfx.plip(count)
      if (counting()) void J().count(num(count))
      void fly(rect, rootRef.current?.querySelector(`[data-cup="${count - 1}"]`), { className: `candy-${flavor}`, fast }).then(() => land(piece.id, 'tray'))
      if (count === order.n && !seen('g/ring-bell')) void guideOnce('g/ring-bell', 'bell')
      if (count > order.n && !seen('g/take-out')) void guideOnce('g/take-out')
    } else {
      if (order.a + sideRef.current.length >= 10) return flash(`src-${good}`)
      // Training and the bridge: before the first piece, the box's number (she holds it).
      const first = sayBox()
      const piece: Piece = { id: nextId.current++, flavor, arriving: true, lime: true }
      const pieces = [...sideRef.current, piece]
      setSidePieces(pieces)
      const total = order.a + pieces.length
      sfx.plip(total)
      if (counting()) void J().count(num(total))
      void fly(rect, rootRef.current?.querySelector(`[data-side="${pieces.length - 1}"]`), { className: `candy-${flavor}`, fast }).then(() => land(piece.id, 'side'))
      if (first) void guideOnce('g/count-on')
      trayChanged(order, total)
    }
  }

  /**
   * The ready box's number, said once per order before counting on (training and the bridge),
   * whichever she taps first, the box or the good. The box stays closed; its number swells.
   * Returns true the first time.
   */
  const sayBox = (): boolean => {
    const current = liveRef.current
    if (!current || current.order.type !== 'C' || current.mode === 'compete' || heldRef.current) return false
    setHeld(true)
    setGuide((g) => (g === 'box' ? null : g))
    setSwell((k) => k + 1)
    void J().count(num(current.order.a), 'box')
    return true
  }

  /** The ready box's tray has changed: the bell, when it matches the order. */
  const trayChanged = (order: Order, total: number) => {
    if (total === order.n) {
      if (!seen('g/ring-bell')) void guideOnce('g/ring-bell', 'bell')
      else if (counting() || revealRef.current) pulse('bell')
    }
    if (total > order.n && !seen('g/take-out')) void guideOnce('g/take-out')
  }

  const land = (id: number, where: 'tray' | 'side') => {
    const update = (pieces: Piece[]) => pieces.map((p) => (p.id === id ? { ...p, arriving: false } : p))
    if (where === 'tray') setTrayPieces(update(trayRef.current))
    else setSidePieces(update(sideRef.current))
  }

  const takeBack = (where: 'tray' | 'side', id: number, rect: DOMRect) => {
    const order = liveRef.current?.order
    if (!order || !canPack()) return
    const pieces = where === 'tray' ? trayRef.current : sideRef.current
    const piece = pieces.find((p) => p.id === id)
    if (!piece) return
    const rest = pieces.filter((p) => p.id !== id)
    if (where === 'tray') setTrayPieces(rest)
    else setSidePieces(rest)
    sfx.pop()
    if (counting()) void J().count(num(where === 'tray' ? rest.length : order.a + rest.length))
    void fly(rect, rootRef.current?.querySelector(`[data-src="${order.good}"]`), { className: `candy-${piece.flavor}`, fast })
    if (where === 'side') trayChanged(order, order.a + rest.length)
  }

  /**
   * The closed ready box. Training and the bridge: it stays closed, its number swells and is said
   * (every tap); the first time, how to go on. Competition: it only bumps. It never opens for a
   * peek, which would invite counting from one (§12.1).
   */
  const tapBox = () => {
    const current = liveRef.current
    if (!current || current.order.type !== 'C' || !canPack()) return
    setGuide((g) => (g === 'box' ? null : g))
    if (current.mode === 'compete') {
      flash('box')
      sfx.tok()
      return
    }
    if (sayBox()) {
      void guideOnce('g/count-on', `src-${current.order.good}`)
      return
    }
    setSwell((k) => k + 1)
    void J().count(num(current.order.a), 'box')
  }

  const tapCustomer = () => {
    const order = liveRef.current?.order
    if (!order || !readyRef.current) return
    J().cutPrompt()
    void customerSays(orderClips(order), { prompt: true, joined: true })
  }

  const tapGuide = () => {
    J().cutPrompt()
    void J().say(GUIDE_LINES[liveRef.current?.order.type ?? 'C'].map(line), { prompt: true })
  }

  /** The customer tilts its head (a soft tok, no words); Dabdoob watches. */
  const puzzled = (current: Live) => {
    setLive({ ...current, mood: 'puzzled' })
    setBearMood('watch')
    sfx.tok()
  }
  /** Back to her turn (on the ready box, with what the pieces showed still in view). */
  const settle = (current: Live) => {
    setLive({ ...current, mood: 'idle' })
    setBearMood(stance(current.mode))
    setPhase('packing')
    setReady(true)
  }

  // ── Points ────────────────────────────────────────────────────────────
  /** Wrong at the first try: only remembered (§11.3: nothing leaves the board, nothing is said). */
  const miss = () => {
    firstBell.current = false
  }

  /** Records a served order; the step may move (with its line, once); a full batch goes to the Hub. */
  const record = (order: Order, atFirstBell: boolean) => {
    const before = progressRef.current
    const taken = takeBatch(recordDelivery(before, { type: order.type, firstBell: atFirstBell, fact: factOf(order) }))
    const next = taken.progress
    commit(next)
    if (taken.batch) {
      const { firstBells, orders } = taken.batch
      void bridge.reportBatch({ firstBells, orders, points: next.points, served: next.served, step: next.types.C.mode, numbers: next.types.C.level })
    }
    const was = before.types[order.type].mode
    const now = next.types[order.type].mode
    // A move between the steps is told once the receipt has been read (it must not hold the sum back).
    const tellStep = () => {
      if (now === 'compete' && was !== 'compete') {
        if (!seen('g/compete')) {
          // The competition starts: the board lights up, a short fanfare.
          setBoardLit(true)
          window.setTimeout(() => setBoardLit(false), fast ? 0 : 2400)
          sfx.fanfare()
          void guideOnce('g/compete')
        } else void guideOnce('g/compete-more')
      } else if (was === 'compete' && now !== 'compete') void guideOnce('g/back-to-train')
      else if (now === 'bridge' && was === 'help') void guideOnce('g/bridge')
    }
    return { earned: next.points - before.points, moment: pointsMoment(before.points, next.points, before.nearSaid), tellStep }
  }

  /**
   * What the points say as they land (§11.5), after the receipt has been read: a «near» line from
   * the guide, the big board at a milestone, the coupon at the goal (until she taps back).
   */
  const tellPoints = async (moment: PointsMoment | null) => {
    if (!moment) return
    if (moment.kind === 'near') {
      commit(nearDealt(progressRef.current))
      void J().say([line(moment.id as LineId)], { prompt: true })
      return
    }
    // The receipt has been read in full by now: it must not linger behind the board.
    setReceipt(null)
    if (moment.kind === 'board') await bigBoard(moment.id as LineId)
    else {
      sfx.fanfare()
      void J().say([line(moment.id)])
      await showCoupon()
    }
    setPhase('arriving')
  }

  // ── «توصيل» ───────────────────────────────────────────────────────────
  const streetDone = (firstTry: boolean) => {
    const current = liveRef.current
    if (!current) return
    const { earned, moment, tellStep } = record(current.order, firstTry)
    payPoints(earned, '.street .resident')
    if (earned > 0) void guideOnce('g/points-yes')
    tellStep()
    setReady(false)
    setPhase('arriving')
    run(() => serveNext(tellPoints(moment)))
  }

  // ── The bell ──────────────────────────────────────────────────────────
  const packedNow = (order: Order) => (order.type === 'A' ? trayRef.current.length : order.a + sideRef.current.length)

  const ring = () => {
    const current = liveRef.current
    setBellKey((k) => k + 1)
    sfx.bell()
    if (!current || !canPack()) return
    setGuide(null)
    J().cutPrompt()
    const order = current.order
    const packed = packedNow(order)
    if (packed === order.n) run(() => handOver(current, firstBell.current))
    else {
      miss()
      run(() => showCount(current))
    }
  }

  /**
   * Not right at the bell: the pieces show it, with numbers only, no sentence (§12.2). The ready box
   * opens, its pieces framed under their one number; her pieces are counted on up to the order; what
   * is missing appears as ghost cups, counted on to the order; pieces past it are marked extra. The
   * box closes and all of that stays while she fixes the tray. «طلب»: the tray counted from one.
   */
  const showCount = async (current: Live) => {
    const order = current.order
    setPhase('checking')
    setReady(false)
    puzzled(current)
    if (order.type === 'C') {
      const want = order.n - order.a
      const mine = sideRef.current.length
      const shown = (next: Partial<Reveal>) => setReveal({ group: true, tagged: 0, ghosts: 0, extra: 0, said: -1, ...next })
      setReveal(null)
      setBox((b) => ({ ...b, open: true }))
      sfx.lid()
      await wait(TIMING.lid)
      shown({ said: 0 })
      await J().beat([num(order.a)], TIMING.countBeat)
      for (let k = 1; k <= Math.min(mine, want); k += 1) {
        shown({ tagged: k, said: k })
        await J().beat([num(order.a + k)], TIMING.countBeat)
      }
      for (let k = mine + 1; k <= want; k += 1) {
        shown({ tagged: k, ghosts: k, said: k })
        await J().beat([num(order.a + k)], TIMING.countBeat)
      }
      for (let k = 1; k <= mine - want; k += 1) {
        shown({ tagged: want, extra: k })
        sfx.tok()
        await wait(TIMING.countBeat)
      }
      await wait(TIMING.lid)
      setBox((b) => ({ ...b, open: false }))
      sfx.lid()
      // While she fixes it: every cup up to the order keeps its tag, ghosts fill as pieces land,
      // and any piece past the order is extra.
      setReveal({ group: false, tagged: want, ghosts: want, extra: 10, said: -1 })
    } else {
      for (let k = 1; k <= trayRef.current.length; k += 1) {
        setReveal({ group: false, tagged: k, ghosts: 0, extra: 0, said: k })
        await J().beat([num(k)], TIMING.countBeat)
      }
      await wait(TIMING.lid)
      setReveal(null)
    }
    settle(current)
  }

  /** Right: hearts and thanks; points in competition at the first try; a receipt that stays while it is read. */
  const handOver = async (current: Live, atFirstBell: boolean) => {
    const order = current.order
    setPhase('leaving')
    setReady(false)
    setBubble(false)
    setGuide(null)
    setLive({ ...current, mood: 'happy' })
    setBearMood('clap')
    sfx.happy()
    const thanksNamed = namedThanks(progressRef.current.served)
    const { earned, moment, tellStep } = record(order, atFirstBell)
    payPoints(earned)
    void customerSays([line(thanksNamed ? 'c/thanks-dima' : thanksFor(order.customer))])
    if (earned > 0) void guideOnce('g/points-yes')
    let receiptDone: Promise<void> = Promise.resolve()
    const readReceipt = (a: number, b: number) => {
      setReceipt({ a, b, n: order.n, good: order.good, part: -1 })
      // Nothing cuts it: it is said in full, then stays a moment longer.
      return J()
        .say(sentenceClips(a, b), { joined: true, kind: 'receipt', onStart: (i) => setReceipt((r) => (r ? { ...r, part: i } : r)) })
        .then(() => setReceipt((r) => (r ? { ...r, part: -1 } : r)))
        .then(() => wait(TIMING.receiptAfter))
    }
    if (order.type === 'C') {
      // The box opens and everything lines up in the tray: it really is that many.
      setReveal(null)
      setBox((b) => ({ ...b, open: true }))
      sfx.lid()
      await wait(TIMING.lid)
      await lineUp(order)
      receiptDone = readReceipt(order.a, order.b)
    } else {
      await wait(TIMING.hop)
    }
    // She walks out with her order; the next customer walks up (in silence while the receipt is read).
    setLeaving({ ...current, mood: 'walk', place: 'out' })
    window.setTimeout(() => setLeaving(null), fast ? 0 : TIMING.walk + 100)
    setBearMood('idle')
    await serveNext(
      receiptDone.then(() => {
        tellStep()
        return tellPoints(moment)
      }),
    )
  }

  const lineUp = async (order: Order) => {
    const root = rootRef.current
    const from = [
      ...Array.from({ length: order.a }, (_, i) => root?.querySelector(`[data-in-box="${i}"] .candy`)?.getBoundingClientRect() ?? null),
      ...sideRef.current.map((p) => root?.querySelector(`[data-side-piece="${p.id}"] .candy`)?.getBoundingClientRect() ?? null),
    ]
    const flavor = FLAVOR[order.good]
    const pieces: Piece[] = from.map((_, i) => ({ id: nextId.current++, flavor, arriving: true, lime: i >= order.a }))
    setBox((b) => ({ ...b, lineup: true }))
    setSidePieces([])
    setTrayPieces(pieces)
    await wait(20)
    await Promise.all(
      from.map(async (rect, i) => {
        await wait(i * TIMING.lineupGap)
        const target = rootRef.current?.querySelector(`[data-cup="${i}"]`)
        if (rect) await fly(rect, target, { className: `candy-${pieces[i]!.flavor}`, fast, duration: 300 })
        land(pieces[i]!.id, 'tray')
      }),
    )
  }

  /** +2: coins fly from the customer to the board, and the numeral ticks up as they land. */
  const payPoints = (points: number, fromSelector = '.customer-spot .customer') => {
    if (points <= 0) return
    const root = rootRef.current
    const from = root?.querySelector(fromSelector)?.getBoundingClientRect()
    const toEl = root?.querySelector('[data-board] .pb-num')
    const start = progressRef.current.points - points
    setBoardShown(start)
    for (let i = 0; i < points; i += 1) {
      window.setTimeout(
        () => {
          const landed = () => {
            sfx.coin(i)
            setBoardShown(i === points - 1 ? null : start + i + 1)
          }
          if (from) void fly(new DOMRect(from.x + from.width / 2 - 18, from.y + from.height * 0.4, 36, 36), toEl, { base: 'coin', className: 'coin-fly', fast, lift: 120 }).then(landed)
          else landed()
        },
        fast ? 0 : i * 160,
      )
    }
  }

  // ── The goal and the board ────────────────────────────────────────────
  /** The big board with one line (the challenge, or a milestone). A tap skips it. */
  const bigBoard = async (id: LineId) => {
    setPhase('goal')
    setShownPoints(progressRef.current.points)
    J().cutPrompt()
    const said = J().say([line(id)], { prompt: true })
    // At least a few seconds on screen, even while the line is not recorded yet.
    await Promise.race([Promise.all([said, wait(TIMING.goalAtLeast)]).then(() => wait(TIMING.goalAfter)), skippable(60_000)])
    skip.current = null
    J().cutPrompt()
    setShownPoints(null)
  }

  /** The golden coupon, until she taps «نرجع البقالة». */
  const showCoupon = () =>
    new Promise<void>((resolve) => {
      couponClosed.current = resolve
      setPhase('coupon')
    })

  const backFromCoupon = () => {
    if (phaseRef.current !== 'coupon') return
    J().cutPrompt()
    const done = couponClosed.current
    couponClosed.current = null
    done?.()
  }

  /** The small board: the challenge again (or the coupon once she has won); then back to her order. */
  const tapBoard = () => {
    if (phaseRef.current === 'goal') {
      skip.current?.()
      return
    }
    if (!canPack()) return
    run(async () => {
      setReady(false)
      if (progressRef.current.won) await showCoupon()
      else await bigBoard('g/goal')
      setPhase('packing')
      setReady(true)
    })
  }

  // Open the shop: on the very first opening the big board shows the challenge, then the first
  // customer walks in, and the next, and the next.
  useEffect(() => {
    if (!jobRef.current || jobRef.current.cancelled) jobRef.current = new Job(narrator, fast)
    const mine = jobRef.current
    orderCount.current = 0
    run(async () => {
      if (!seen('g/goal')) {
        await bigBoard('g/goal')
        see('g/goal')
      }
      await serveNext()
    })
    return () => {
      mine.cancel()
      narrator.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Drawing ───────────────────────────────────────────────────────────
  const order = live?.order
  const served = progress.served
  const packed = order ? (order.type === 'A' ? tray.length : order.a + side.length) : 0
  const boardPoints = boardShown ?? progress.points
  const help = live?.mode === 'help'
  const stake = live?.mode === 'compete' && live.place === 'counter' && (phase === 'packing' || phase === 'checking' || phase === 'arriving')
  // Her turn, and the pieces showing a wrong answer: everything but the task fades (§11.6).
  const solving = (phase === 'packing' && ready) || phase === 'checking'
  const tagged = (i: number) => reveal !== null && i < reveal.tagged
  const said = (k: number) => reveal?.said === k
  // The ready box's tray: as many cups as can still fit (at least 4), filling from the box outward.
  const want = order ? order.n - order.a : 0
  const slots = order ? Math.max(4, 10 - order.a) : 0

  const source = (good: Good) => (
    <TapButton
      key={good}
      className={`source source-${good} ${order && order.type !== 'D' && order.good === good ? 'is-ordered' : ''} ${jiggle === `src-${good}` ? 'jiggle' : ''} ${guide === `src-${good}` ? 'guide' : ''}`}
      aria-label={GOOD_NAME[good]}
      onTap={(rect) => tapSource(good, rect)}
      data-src={good}
    >
      {good === 'takis' ? <TakisBag /> : <JarArt flavor={good === 'choc' ? 'choc' : 'pink'} />}
    </TapButton>
  )

  return (
    <main
      className={`screen shop phase-${phase} ${solving ? 'is-solving' : ''}`}
      ref={rootRef}
      data-time={1}
      data-phase={phase}
      data-ready={ready ? 1 : 0}
      data-solving={solving ? 1 : 0}
      data-order={order?.type ?? ''}
      data-level={order?.level ?? ''}
      data-a={order?.a ?? ''}
      data-b={order?.b ?? ''}
      data-n={order?.n ?? ''}
      data-good={order?.good ?? ''}
      data-mode={live?.mode ?? ''}
      data-held={held ? 1 : 0}
      data-reveal={reveal ? reveal.tagged : ''}
      data-packed={packed}
      data-customer={live ? live.index : ''}
      data-served={progress.served}
      data-points={progress.points}
      aria-label="البقالة"
    >
      <section className="backroom">
        <div className="wallpaper" aria-hidden="true" />
        <ShopWindow />
        <div className="shelf shelf-1" aria-hidden="true">
          <Groceries row={1} />
        </div>
        <div className="shelf shelf-2" aria-hidden="true">
          <Groceries row={2} />
        </div>
        <DoorArt open ajar={live?.mood === 'walk' || leaving !== null} />
        <div className="queue" aria-hidden="true">
          {queue.map((id, i) => (
            <span key={`${served}-${i}`} className={`queue-spot queue-${i}`}>
              <CustomerArt id={id} />
            </span>
          ))}
        </div>
        <TapButton className="board-button" aria-label={`النقاط: ${ar(boardPoints)} من ${ar(GOAL)}`} onTap={tapBoard} data-board>
          <PrizeBoard points={boardPoints} won={progress.won} lit={boardLit} />
        </TapButton>
        <HoldButton onDone={onParents} />
      </section>

      {leaving ? (
        <div className="customer-spot is-leaving" key={`out-${leaving.key}`} aria-hidden="true">
          <CustomerArt id={leaving.order.customer} mood="walk" />
        </div>
      ) : null}
      {live && live.place !== 'away' ? (
        <div className={`customer-spot at-${live.place} ${sparkle === 'customer' ? 'sparkle' : ''}`} key={live.key}>
          <TapButton className="customer-button" aria-label="الزبون" onTap={tapCustomer}>
            <CustomerArt id={live.order.customer} mood={live.mood} />
          </TapButton>
          {bubble || phase === 'checking' ? <OrderBubble order={live.order} help={help} /> : null}
        </div>
      ) : null}

      <div className="helper" aria-hidden="false">
        <Bear mood={bearMood} className="helper-bear" />
        <TapButton className="helper-ask" aria-label="دبدوب يشرح" onTap={tapGuide}>
          ؟
        </TapButton>
      </div>

      <section className="counter">
        <div className="counter-top" aria-hidden="true" />
        <div className="counter-items">
          <div className="bell-spot">
            <TapButton className={`bell ${guide === 'bell' ? 'guide' : ''}`} aria-label="الجرس" onTap={ring} data-bell>
              <span key={bellKey} className={bellKey ? 'ring' : ''}>
                <BellArt />
              </span>
            </TapButton>
            {stake ? (
              // Competition: two gold coins wait by the bell (no text: the stake is drawn).
              <span className="stake" data-stake aria-hidden="true">
                <Coin className="stake-coin" />
                <Coin className="stake-coin" />
              </span>
            ) : null}
          </div>

          <div className={`pack-zone ${order?.type === 'C' && !box.lineup ? 'is-ready-box' : 'is-tray'}`}>
            {order?.type === 'C' && !box.lineup ? (
              <div className="ready-zone" dir="rtl">
                {box.shown ? (
                  <TapButton
                    className={`ready-box slide-in ${guide === 'box' ? 'guide' : ''} ${jiggle === 'box' ? 'jiggle' : ''} ${reveal?.group ? 'is-framed' : ''}`}
                    aria-label={`العلبة ${ar(order.a)}`}
                    onTap={tapBox}
                    data-box
                  >
                    <GiftBox open={box.open} label={order.a} className={`gift-ready ${swell ? 'is-swell' : ''}`} key={`swell-${swell}`}>
                      {box.open ? (
                        <span className="in-box-grid" style={{ '--cols': order.a > 6 ? 4 : 3 } as CSSProperties}>
                          {Array.from({ length: order.a }, (_, i) => (
                            <span key={i} data-in-box={i}>
                              <Candy flavor={FLAVOR[order.good]} className={said(0) ? 'is-lit' : ''} />
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </GiftBox>
                    {reveal?.group ? (
                      <span className={`group-num ${said(0) ? 'is-said' : ''}`} aria-hidden="true">
                        {ar(order.a)}
                      </span>
                    ) : null}
                  </TapButton>
                ) : null}
                <div className="side-tray" style={{ '--cols': Math.min(4, slots) } as CSSProperties} data-side-tray>
                  {Array.from({ length: slots }, (_, i) => {
                    const piece = side[i]
                    const tag = i < want && (help || tagged(i))
                    if (piece && !piece.arriving) {
                      const extra = reveal !== null && i >= want && i < want + reveal.extra
                      return (
                        <span key={i} className="side-slot" data-side={i}>
                          <TapButton
                            className={`piece ring-lime ${extra ? 'is-extra' : ''}`}
                            aria-label={GOOD_NAME[order.good]}
                            data-side-piece={piece.id}
                            data-extra={extra ? 1 : undefined}
                            onTap={(rect) => takeBack('side', piece.id, rect)}
                          >
                            <Candy flavor={piece.flavor} className={`land ${said(i + 1) ? 'is-lit' : ''}`} />
                            {tag ? <span className={`piece-tag ${said(i + 1) ? 'is-said' : ''}`}>{ar(order.a + i + 1)}</span> : null}
                          </TapButton>
                        </span>
                      )
                    }
                    // A ghost cup: a piece still missing, with its number (after a wrong bell).
                    const ghost = !piece && reveal !== null && i < want && i < reveal.ghosts
                    return (
                      <span key={i} className={`side-slot ${ghost ? 'is-ghost' : ''}`} data-side={i} data-ghost={ghost ? order.a + i + 1 : undefined}>
                        {ghost ? (
                          <>
                            <Candy flavor={FLAVOR[order.good]} className="ghost-candy" />
                            {tag ? <span className={`piece-tag ${said(i + 1) ? 'is-said' : ''}`}>{ar(order.a + i + 1)}</span> : null}
                          </>
                        ) : null}
                      </span>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="packing-box">
                <div className="tray" dir="rtl">
                  {Array.from({ length: 10 }, (_, i) => {
                    const piece = tray[i]
                    return (
                      <span key={i} className="cup" data-cup={i}>
                        {piece && !piece.arriving ? (
                          <TapButton className={`piece ${piece.lime ? 'ring-lime' : ''}`} aria-label={GOOD_NAME[order?.good ?? 'choc']} data-piece={piece.id} onTap={(rect) => takeBack('tray', piece.id, rect)}>
                            <Candy flavor={piece.flavor} className={`land ${said(i + 1) ? 'is-lit' : ''}`} />
                            {tagged(i) ? <span className={`piece-tag ${said(i + 1) ? 'is-said' : ''}`}>{ar(i + 1)}</span> : null}
                          </TapButton>
                        ) : null}
                      </span>
                    )
                  })}
                </div>
                <span className="box-front" aria-hidden="true">
                  <span className="box-ribbon" />
                  {order?.type === 'A' && help ? <span className="box-count">{ar(tray.length)}</span> : null}
                </span>
              </div>
            )}
            {receipt ? <Receipt a={receipt.a} b={receipt.b} n={receipt.n} good={receipt.good} part={receipt.part} /> : null}
          </div>

          <div className="sources">{(['takis', 'candy', 'choc'] as Good[]).map(source)}</div>
        </div>
      </section>

      {phase === 'street' && order?.type === 'D' ? (
        <Street
          key={live?.key}
          order={order}
          job={J}
          rng={rng}
          neighbours={knownCustomers(progress.served).filter((id) => id !== order.customer)}
          mode={live?.mode ?? 'help'}
          guideOnce={guideOnce}
          onReady={setReady}
          onMiss={miss}
          onDone={(result) => streetDone(result.firstTry)}
        />
      ) : null}

      {phase === 'goal' ? (
        <div className="board-overlay" role="dialog" aria-label="التحدي" onPointerDown={() => skip.current?.()}>
          <div className="board-card">
            <PrizeBoard points={shownPoints ?? progress.points} big won={progress.won} lit={boardLit} />
          </div>
        </div>
      ) : null}

      {phase === 'coupon' ? (
        <div className="coupon-overlay" role="dialog" aria-label="كوبون تاكيز">
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 28 }, (_, i) => (
              <span key={i} className="confetti-bit" style={{ '--i': i } as CSSProperties} />
            ))}
          </div>
          <CouponArt />
          <TapButton className="gold-button coupon-back" aria-label="نرجع البقالة" onTap={backFromCoupon}>
            <span>نرجع البقالة</span>
          </TapButton>
        </div>
      ) : null}
    </main>
  )
}

function OrderBubble({ order, help }: { order: Order; help: boolean }) {
  // Training: dots under the order, one per piece. Competition: no dots.
  const dots = order.type === 'A' && help
  return (
    <div className={`order-bubble order-${order.type}`} role="img" aria-label={`الطلب ${ar(order.n)} ${GOOD_NAME[order.good]}`}>
      <span className="order-line">
        <span className="order-num">{ar(order.n)}</span>
        <Candy flavor={FLAVOR[order.good]} className="order-good" />
      </span>
      {dots ? (
        <span className="order-dots" dir="rtl" data-dots>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={`order-dot ${i < order.n ? `on dot-${order.good}` : ''}`} />
          ))}
        </span>
      ) : null}
    </div>
  )
}

export function HoldButton({ onDone, ms = 2000 }: { onDone: () => void; ms?: number }) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<number | null>(null)
  const stop = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    setHolding(false)
  }
  const begin = () => {
    if (timer.current !== null) return
    setHolding(true)
    timer.current = window.setTimeout(() => {
      timer.current = null
      setHolding(false)
      onDone()
    }, ms)
  }
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )
  return (
    <button
      type="button"
      className={`hold-button ${holding ? 'is-holding' : ''}`}
      style={{ '--hold': `${ms}ms` } as CSSProperties}
      aria-label="للأهل (اضغط مطولا)"
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) begin()
      }}
      onKeyUp={stop}
      onContextMenu={(event) => event.preventDefault()}
    >
      <svg className="hold-ring" viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r="19" className="ring-track" />
        <circle cx="22" cy="22" r="19" className="ring-fill" />
      </svg>
      <span>للأهل</span>
    </button>
  )
}
