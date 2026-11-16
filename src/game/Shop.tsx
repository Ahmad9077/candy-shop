// «البقالة»: one persistent scene. Customers walk in with an order; she packs it by tapping the
// goods, rings the bell to hand it over. Every order type is in training (Dabdoob counts with her,
// no points) or in competition (no counting help; +2 right at the first bell, −2 wrong), §10.2.
// The goal: 200 points, and her father takes her to buy real Takis. Nobody praises an answer.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Narrator } from '../audio/player'
import { sfx } from '../audio/sfx'
import { Bear, type BearMood } from '../art/Bear'
import { GiftBox } from '../art/Box'
import { Candy, type Flavor } from '../art/Candy'
import { CustomerArt, type CustomerMood } from '../art/Customer'
import { BellArt, Coin, CouponArt, DoorArt, Groceries, JarArt, PrizeBoard, Receipt, ShopWindow, TakisBag } from '../art/ShopArt'
import { WAIT_IDS, clip, sentenceClips, type LineId } from '../data/lines'
import { ar } from '../domain/digits'
import { CUSTOMERS, customerRate, dayCustomers, factOf, knownCustomers, makeOrder, namedToday, planDay, type CustomerId, type Good, type Mode, type Order } from '../domain/orders'
import { GOAL, closeDay, closingLine, markSeen, missPoints, openTypes, recordDelivery, stampHouse, startDay, type House, type ShopProgress } from '../domain/progress'
import { Bag, type Rng } from '../domain/random'
import type { HubBridge } from '../hub/bridge'
import { fly } from './fly'
import { Job, run } from './job'
import { Street } from './Street'
import { TapButton } from './tap'

type Phase = 'goal' | 'arriving' | 'packing' | 'checking' | 'leaving' | 'closing' | 'coupon' | 'board' | 'street'

interface Live {
  key: number
  order: Order
  index: number
  /** The order's mode when it was given (training or competition). */
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

type BagSide = 'right' | 'left'
/** «كيسين»: the two open bags, and the one she tapped last (the right one to begin with). */
interface TwoBags {
  right: Piece[]
  left: Piece[]
  pick: BagSide
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
  pointFly: 140,
  goalAfter: 700,
  goalAtLeast: 2600,
}

const line = (id: LineId) => clip.line(id)
const num = (n: number) => clip.num(n)
const FLAVOR: Record<Good, Flavor> = { choc: 'choc', candy: 'pink', takis: 'takis' }
const GOOD_WORD: Record<Good, LineId> = { choc: 'c/p-choc', candy: 'c/p-candy', takis: 'c/p-takis' }
const GOOD_NAME: Record<Good, string> = { choc: 'كاكاو', candy: 'حلاو', takis: 'تاكيز' }

/** «كيس واحد»: the box holds the bigger number, the loose pieces (or second bag) the smaller. */
interface StickerState {
  /** The box holds the first number on the card, or (a small-first card) the second. */
  boxCount: number
  /** One good for the whole order (§10.1). */
  flavor: Flavor
  looseCount: number
  /** Training: loose pieces still on the counter (ids), and how many have hopped into the bag. */
  loose: number[]
  inBag: number
  /** Competition: the second part comes as a closed, labelled bag (no counting tools). */
  bagClosed: boolean
  sticker: number | null
  dimmed: number[]
  misses: number
}

export function Shop({
  progress,
  setProgress,
  narrator,
  rng,
  fast,
  bridge,
  onParents,
}: {
  progress: ShopProgress
  setProgress: (update: (p: ShopProgress) => ShopProgress) => void
  narrator: Narrator
  rng: Rng
  fast: boolean
  bridge: HubBridge
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
  const bags = useMemo(() => {
    // Each animal greets and thanks with its own few lines (from the recorded ones).
    const own = new Map(CUSTOMERS.map((c) => [c.id, { hi: new Bag(c.hi, rng), thanks: new Bag(c.thanks, rng) }]))
    return { own, wait: new Bag(WAIT_IDS, rng) }
  }, [rng])
  const hiFor = (id: CustomerId) => (bags.own.get(id)?.hi.next() ?? 'c/hi-1') as LineId
  const thanksFor = (id: CustomerId) => (bags.own.get(id)?.thanks.next() ?? 'c/thanks-1') as LineId

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
  const [lit, setLit] = useState<number>(-1)
  const [receipt, setReceipt] = useState<{ a: number; b: number; n: number; good: Good; part: number } | null>(null)
  const [twoBags, setTwoBagsState] = useState<TwoBags>({ right: [], left: [], pick: 'right' })
  const twoBagsRef = useRef<TwoBags>({ right: [], left: [], pick: 'right' })
  const setTwoBags = (next: TwoBags) => {
    twoBagsRef.current = next
    setTwoBagsState(next)
  }
  /** The board's numeral while coins are on their way (it ticks as they land or leave). */
  const [boardShown, setBoardShown] = useState<number | null>(null)
  const [boardLit, setBoardLit] = useState(false)
  const [boardDrop, setBoardDrop] = useState(0)
  const [todayChange, setTodayChange] = useState(0)
  const [guide, setGuide] = useState<string | null>(null)
  const [bellKey, setBellKey] = useState(0)
  const [jiggle, setJiggle] = useState<string | null>(null)
  const [signOpen, setSignOpen] = useState(true)
  const [shownPoints, setShownPoints] = useState<number | null>(null)
  const [bearMood, setBearMood] = useState<BearMood>('idle')
  const [sparkle, setSparkle] = useState<string | null>(null)
  const [dayDone, setDayDone] = useState(false)
  const [sticker, setStickerState] = useState<StickerState | null>(null)
  const stickerRef = useRef<StickerState | null>(null)
  const setSticker = (next: StickerState | null) => {
    stickerRef.current = next
    setStickerState(next)
  }
  const [houseRow, setHouseRow] = useState<{ n: number; row: number | null; point: boolean; gold: boolean } | null>(null)
  const [stickerFly, setStickerFly] = useState<number | null>(null)
  const smallFirstToday = useRef(0)
  const eToday = useRef(0)
  const firstBell = useRef(true)
  const nextId = useRef(1)
  const peeking = useRef(false)
  const skip = useRef<(() => void) | null>(null)
  const previousOrder = useRef<Order | undefined>(undefined)

  const wait = (ms: number) => J().wait(ms)
  const seen = (key: string) => progressRef.current.seen.includes(key)
  const see = (key: string) => {
    progressRef.current = markSeen(progressRef.current, key)
    setProgress((p) => markSeen(p, key))
  }

  /** A guide line, once: when the thing first arrives. */
  const guideOnce = async (id: LineId, spot: string | null = null) => {
    if (seen(id)) return
    see(id)
    if (spot) setGuide(spot)
    await J().say([line(id)], { prompt: true })
  }

  const customerSays = (clips: string[], options: { prompt?: boolean; joined?: boolean } = {}) => {
    const who = liveRef.current?.order.customer
    return J().say(clips, { rate: who ? customerRate(who) : 1.2, ...options })
  }
  const orderClips = (order: Order) =>
    order.type === 'B'
      ? [line('c/want'), num(order.n), line(GOOD_WORD[order.good]), line('c/two-bags')]
      : order.type === 'E'
        ? [line('c/may-i'), num(order.a), line('ui/plus'), num(order.b)]
        : [line('c/want'), num(order.n), line(GOOD_WORD[order.good])]

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

  /** Waits `ms`, or less if she taps to skip (the big board, the closing count). */
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

  // ── A customer walks in ───────────────────────────────────────────────
  /**
   * The next customer walks up. If a receipt is still being read (`receiptDone`), she waits by the
   * counter in silence; her box, her bubble and her order come only once the receipt has gone.
   */
  const serveNext = async (receiptDone: Promise<void> = Promise.resolve()) => {
    const p = progressRef.current
    const today = p.today
    if (!today) return
    const index = today.served
    if (index >= today.plan.length) {
      await receiptDone
      await closeShop()
      return
    }
    const type = today.plan[index]!
    const customer = today.customers[index] ?? 'rabbit'
    if (index === 0) {
      smallFirstToday.current = 0
      eToday.current = 0
    }
    // «كيس واحد» level 3: one or two cards a day put the small number first.
    const mode = p.types[type].mode
    let smallFirst = false
    if (type === 'E' && p.types.E.level === 3) {
      smallFirst = smallFirstToday.current < 2 && (eToday.current === 0 || rng() < 0.5)
      if (smallFirst) smallFirstToday.current += 1
    }
    if (type === 'E') eToday.current += 1
    const order = makeOrder(type, p.types[type].level, rng, customer, { missed: p.missed, previous: previousOrder.current, smallFirst })
    previousOrder.current = order
    firstBell.current = true
    setReady(false)
    setPhase('arriving')
    setBubble(false)
    setLit(-1)
    if (order.type === 'D') {
      await receiptDone
      setReceipt(null)
      setTrayPieces([])
      setSidePieces([])
      setSticker(null)
      setHouseRow(null)
      setTwoBags({ right: [], left: [], pick: 'right' })
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
    await receiptDone
    setReceipt(null)
    setTrayPieces([])
    setSidePieces([])
    setTwoBags({ right: [], left: [], pick: 'right' })
    setHouseRow(order.type === 'B' ? { n: order.n, row: null, point: false, gold: false } : null)
    if (order.type === 'E') {
      // The box holds the first number on the card; on a small-first card (level 3) Dabdoob still
      // puts the bigger number in the box. Training: the rest lie loose, to hop in and count on.
      // Competition: the rest come as a second closed bag with its label.
      const swap = order.smallFirst === true
      const boxCount = swap ? order.b : order.a
      const looseCount = swap ? order.a : order.b
      setSticker({
        boxCount,
        looseCount,
        flavor: FLAVOR[order.good],
        loose: mode === 'help' ? Array.from({ length: looseCount }, () => nextId.current++) : [],
        inBag: 0,
        bagClosed: mode === 'compete',
        sticker: null,
        dimmed: [],
        misses: 0,
      })
      setBox({ shown: true, open: false, lineup: false })
    } else {
      setSticker(null)
      setBox({ shown: order.type === 'C', open: order.type === 'C', lineup: false })
    }
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
    // Spoken once she can already start: the greeting and the order.
    if (index === 0 && !seen('g/open')) void guideOnce('g/open')
    // A customer who has just come to know the shop is announced, once.
    if (!p.met.includes(customer)) {
      const met = [...p.met, customer]
      progressRef.current = { ...progressRef.current, met }
      setProgress((q) => ({ ...q, met: [...new Set([...q.met, customer])] }))
      setSparkle('customer')
      sfx.sparkle()
      window.setTimeout(() => setSparkle(null), 1600)
      void J().say([line('g/new-customer')], { prompt: true })
    }
    const named = index === 0 && namedToday(p.day).hi
    void customerSays([line(named ? 'c/hi-dima' : hiFor(customer))])
    void customerSays(orderClips(order), { prompt: true, joined: true })
    if (mode === 'help') await guideOnce('g/train')
    if (order.type === 'A') {
      await guideOnce('g/tap-jar', `src-${order.good}`)
      if (p.types.A.served >= 2) await guideOnce('g/take-out')
    } else if (order.type === 'B') {
      await guideOnce('g/two-bags', `src-${order.good}`)
    } else if (order.type === 'E') {
      if (order.smallFirst) void J().say([line('g/bigger-first')], { prompt: true })
      await guideOnce('g/sticker', 'roll')
    } else {
      await guideOnce('g/ready-box', 'box')
      await guideOnce('g/tap-box', 'box')
    }
  }

  // ── Taps ──────────────────────────────────────────────────────────────
  const canPack = () => readyRef.current && phaseRef.current === 'packing'
  /** Training: Dabdoob counts with her. Competition: taps only plip. */
  const helping = () => liveRef.current?.mode !== 'compete'
  /** Dabdoob leans in to count (training), or steps back with a paw over his mouth (competition). */
  const stance = (mode: Mode | undefined = liveRef.current?.mode): BearMood => (mode === 'compete' ? 'hush' : mode === 'help' ? 'lean' : 'idle')

  /** Only the ordered good answers; another source wobbles while the right one pulses. */
  const tapSource = (good: Good, rect: DOMRect) => {
    const order = liveRef.current?.order
    if (!order || !canPack()) {
      flash(`src-${good}`)
      return
    }
    if (order.type === 'E' || good !== order.good) {
      flash(`src-${good}`)
      const right = order.type === 'E' ? 'roll' : `src-${order.good}`
      setGuide(right)
      window.setTimeout(() => setGuide((g) => (g === right ? null : g)), 1200)
      return
    }
    setGuide((g) => (g === `src-${good}` ? null : g))
    const flavor = FLAVOR[good]
    const help = helping()
    if (order.type === 'A') {
      if (trayRef.current.length >= 10) return flash(`src-${good}`)
      const piece: Piece = { id: nextId.current++, flavor, arriving: true }
      const pieces = [...trayRef.current, piece]
      setTrayPieces(pieces)
      const count = pieces.length
      sfx.plip(count)
      if (help) void J().count(num(count))
      void fly(rect, rootRef.current?.querySelector(`[data-cup="${count - 1}"]`), { className: `candy-${flavor}`, fast }).then(() => land(piece.id, 'tray'))
      if (count === order.n && !seen('g/ring-bell')) void guideOnce('g/ring-bell', 'bell')
      if (count > order.n && !seen('g/take-out')) void guideOnce('g/take-out')
    } else if (order.type === 'B') {
      // The piece drops into the bag she tapped last.
      const bags2 = twoBagsRef.current
      const total = bags2.right.length + bags2.left.length
      if (total >= 10) return flash(`src-${good}`)
      const piece: Piece = { id: nextId.current++, flavor, arriving: true }
      const into = [...bags2[bags2.pick], piece]
      setTwoBags({ ...bags2, [bags2.pick]: into })
      sfx.plip(total + 1)
      if (help) void J().count(num(total + 1))
      void fly(rect, rootRef.current?.querySelector(`[data-bag="${bags2.pick}"] [data-cup="${into.length - 1}"]`), { className: `candy-${flavor}`, fast }).then(() => land(piece.id, bags2.pick))
      if (total + 1 === order.n && !seen('g/ring-bell')) void guideOnce('g/ring-bell', 'bell')
    } else {
      if (order.a + sideRef.current.length >= 10) return flash(`src-${good}`)
      const piece: Piece = { id: nextId.current++, flavor, arriving: true, lime: true }
      const pieces = [...sideRef.current, piece]
      setSidePieces(pieces)
      const total = order.a + pieces.length
      sfx.plip(total)
      if (help) void J().count(num(total))
      void fly(rect, rootRef.current?.querySelector(`[data-side="${pieces.length - 1}"]`), { className: `candy-${flavor}`, fast }).then(() => land(piece.id, 'side'))
    }
  }

  const land = (id: number, where: 'tray' | 'side' | BagSide) => {
    const update = (pieces: Piece[]) => pieces.map((p) => (p.id === id ? { ...p, arriving: false } : p))
    if (where === 'tray') setTrayPieces(update(trayRef.current))
    else if (where === 'side') setSidePieces(update(sideRef.current))
    else setTwoBags({ ...twoBagsRef.current, [where]: update(twoBagsRef.current[where]) })
  }

  /** «كيسين»: a tap on a bag makes it the one the next pieces drop into. */
  const pickBag = (side: BagSide) => {
    if (!canPack() || twoBagsRef.current.pick === side) return
    sfx.tok()
    setTwoBags({ ...twoBagsRef.current, pick: side })
  }

  const takeBack = (where: 'tray' | 'side' | BagSide, id: number, rect: DOMRect) => {
    const order = liveRef.current?.order
    if (!order || !canPack()) return
    const pieces = where === 'tray' ? trayRef.current : where === 'side' ? sideRef.current : twoBagsRef.current[where]
    const piece = pieces.find((p) => p.id === id)
    if (!piece) return
    const rest = pieces.filter((p) => p.id !== id)
    if (where === 'tray') setTrayPieces(rest)
    else if (where === 'side') setSidePieces(rest)
    else setTwoBags({ ...twoBagsRef.current, [where]: rest })
    const bags2 = twoBagsRef.current
    const total = where === 'tray' ? rest.length : where === 'side' ? order.a + rest.length : bags2.right.length + bags2.left.length
    sfx.pop()
    if (helping()) void J().count(num(total))
    void fly(rect, rootRef.current?.querySelector(`[data-src="${order.good}"]`), { className: `candy-${piece.flavor}`, fast })
  }

  /** Training: the closed box opens and says its number. Competition: it only wobbles. */
  const tapBox = () => {
    const order = liveRef.current?.order
    if (!order || (order.type !== 'C' && order.type !== 'E') || !readyRef.current || peeking.current || phaseRef.current !== 'packing') return
    setGuide((g) => (g === 'box' ? null : g))
    if (!helping()) {
      flash('box')
      sfx.tok()
      return
    }
    peeking.current = true
    void J().count(num(order.type === 'E' ? (stickerRef.current?.boxCount ?? order.a) : order.a), 'box')
    run(async () => {
      try {
        setBox((b) => ({ ...b, open: true }))
        sfx.lid()
        await wait(TIMING.boxPeek)
        setBox((b) => ({ ...b, open: false }))
        sfx.lid()
      } finally {
        peeking.current = false
      }
    })
  }

  const tapCustomer = () => {
    const order = liveRef.current?.order
    if (!order || !readyRef.current) return
    J().cutPrompt()
    void customerSays(orderClips(order), { prompt: true, joined: true })
  }

  const tapGuide = () => {
    J().cutPrompt()
    const order = liveRef.current?.order
    const lines: LineId[] =
      order?.type === 'C'
        ? ['g/ready-box', 'g/tap-box', 'g/ring-bell']
        : order?.type === 'B'
          ? ['g/two-bags', 'g/two-bags-new', 'g/ring-bell']
          : order?.type === 'D'
            ? ['g/delivery', 'g/ride', 'g/door']
            : order?.type === 'E'
              ? ['g/sticker', 'g/tap-box']
              : ['g/tap-jar', 'g/take-out', 'g/ring-bell']
    void J().say(lines.map(line), { prompt: true })
  }

  // ── «كيس واحد» ────────────────────────────────────────────────────────
  /** Training: a loose piece hops into the bag; the narrator counts on from the box. */
  const tapLoose = (id: number, rect: DOMRect) => {
    const st = stickerRef.current
    const order = liveRef.current?.order
    if (!st || !order || !canPack() || !st.loose.includes(id)) return
    const inBag = st.inBag + 1
    setSticker({ ...st, loose: st.loose.filter((x) => x !== id), inBag })
    sfx.plip(st.boxCount + inBag)
    void J().count(num(st.boxCount + inBag))
    void fly(rect, rootRef.current?.querySelector('.paper-bag'), { className: `candy-${st.flavor}`, fast })
  }

  /** Competition: the second bag stays closed; a tap only makes it wobble. */
  const tapSecondBag = () => {
    if (!stickerRef.current || !canPack()) return
    flash('second-bag')
    sfx.tok()
  }

  /** A sticker for the bag: the total, or it peels off and the customer counts with her. */
  const tapSticker = (value: number) => {
    const current = liveRef.current
    const st = stickerRef.current
    if (!current || !st || current.order.type !== 'E' || !canPack() || peeking.current) return
    if (st.dimmed.includes(value)) return
    J().cutPrompt()
    setGuide(null)
    sfx.pop()
    setStickerFly(value)
    setSticker({ ...st, sticker: value })
    const order = current.order
    if (value === order.n) {
      run(() => handOver(current, firstBell.current))
      return
    }
    if (firstBell.current) miss(current)
    firstBell.current = false
    run(async () => {
      setPhase('checking')
      setReady(false)
      await wait(500)
      // It peels off and flutters down.
      const misses = st.misses + 1
      setSticker({ ...st, sticker: null, dimmed: [...st.dimmed, value], misses })
      setStickerFly(null)
      setLive({ ...current, mood: 'puzzled' })
      setBearMood('watch')
      sfx.puzzled()
      await customerSays([line(bags.wait.next())])
      setBox((b) => ({ ...b, open: true }))
      sfx.lid()
      await wait(TIMING.lid)
      for (let i = 0; i < order.n; i += 1) {
        setLit(i)
        await J().beat([num(i + 1)], TIMING.countBeat)
      }
      await wait(TIMING.lid)
      setLit(-1)
      setBox((b) => ({ ...b, open: false }))
      sfx.lid()
      setLive({ ...current, mood: 'idle' })
      setBearMood(stance(current.mode))
      // After a second miss, the right sticker wiggles.
      if (misses >= 2) setGuide(`sticker-${order.n}`)
      setPhase('packing')
      setReady(true)
    })
  }

  // ── Points (§10.2) ────────────────────────────────────────────────────
  /** Wrong the first time in competition: two coins drop out of the board and fade. */
  const miss = (current: Live) => {
    if (current.mode !== 'compete') return
    const before = progressRef.current.points
    const next = missPoints(progressRef.current, current.order.type)
    progressRef.current = next
    setProgress(() => next)
    setBoardDrop((k) => k + 1)
    sfx.lose()
    setBoardShown(before)
    const lost = before - next.points
    for (let i = 1; i <= lost; i += 1) window.setTimeout(() => setBoardShown(before - i), fast ? 0 : 200 + i * 220)
    window.setTimeout(() => setBoardShown(null), fast ? 0 : 200 + (lost + 1) * 220)
    void guideOnce('g/points-no')
  }

  /** Records a served order; the mode may move (with its line, once). Returns the points earned. */
  const record = (order: Order, atFirstBell: boolean, bonus = 0) => {
    const before = progressRef.current
    const next = recordDelivery(before, { type: order.type, firstBell: atFirstBell, fact: factOf(order), bonus })
    progressRef.current = next
    setProgress(() => next)
    const was = before.types[order.type].mode
    const now = next.types[order.type].mode
    if (was === 'help' && now === 'compete') {
      if (!seen('g/compete')) {
        // The competition starts: the board lights up, a short fanfare.
        setBoardLit(true)
        window.setTimeout(() => setBoardLit(false), fast ? 0 : 2400)
        sfx.fanfare()
        void guideOnce('g/compete')
      } else void guideOnce('g/compete-more')
    } else if (was === 'compete' && now === 'help') void guideOnce('g/back-to-train')
    return next.points - before.points
  }

  // ── «توصيل» ───────────────────────────────────────────────────────────
  const streetDone = (firstTry: boolean) => {
    const current = liveRef.current
    if (!current) return
    const earned = record(current.order, firstTry)
    payPoints(earned, '.street .resident')
    if (earned > 0) void guideOnce('g/points-yes')
    setReady(false)
    setPhase('arriving')
    run(() => serveNext())
  }

  // ── The bell ──────────────────────────────────────────────────────────
  const packedNow = (order: Order) =>
    order.type === 'A' ? trayRef.current.length : order.type === 'B' ? twoBagsRef.current.right.length + twoBagsRef.current.left.length : order.a + sideRef.current.length

  const ring = () => {
    const current = liveRef.current
    setBellKey((k) => k + 1)
    sfx.bell()
    if (!current || !canPack() || peeking.current) return
    if (current.order.type === 'E') {
      // The bag is handed over with its sticker, not with the bell.
      setGuide('roll')
      window.setTimeout(() => setGuide((g) => (g === 'roll' ? null : g)), 1200)
      return
    }
    setGuide(null)
    J().cutPrompt()
    const order = current.order
    const packed = packedNow(order)
    if (packed === order.n) run(() => handOver(current, firstBell.current))
    else {
      if (firstBell.current) miss(current)
      run(() => peekAndCount(current, packed))
    }
    firstBell.current = false
  }

  /** Not right: the customer peeks into the box and counts it with her; then she fixes it. */
  const peekAndCount = async (current: Live, packed: number) => {
    const order = current.order
    setPhase('checking')
    setReady(false)
    setLive({ ...current, mood: 'puzzled' })
    setBearMood('watch')
    sfx.puzzled()
    await customerSays([line(bags.wait.next())])
    if (order.type === 'C') {
      setBox((b) => ({ ...b, open: true }))
      sfx.lid()
      await wait(TIMING.lid)
    }
    for (let i = 0; i < packed; i += 1) {
      setLit(i)
      await J().beat([num(i + 1)], TIMING.countBeat)
    }
    // What she counted stays lit while the customer says what was wrong.
    await customerSays([line(packed < order.n ? 'c/too-few' : 'c/too-many')])
    setLit(-1)
    if (order.type === 'C') {
      setBox((b) => ({ ...b, open: false }))
      sfx.lid()
    }
    setLive({ ...current, mood: 'idle' })
    setBearMood(stance(current.mode))
    setPhase('packing')
    setReady(true)
  }

  /** Right: hearts and thanks; points in competition at the first try; a receipt that stays while it is read. */
  const handOver = async (current: Live, atFirstBell: boolean) => {
    const order = current.order
    setPhase('leaving')
    setReady(false)
    setBubble(false)
    setLive({ ...current, mood: 'happy' })
    setBearMood('clap')
    sfx.happy()
    let split: { right: number; left: number; stamp: ReturnType<typeof stampHouse> } | null = null
    if (order.type === 'B') {
      const right = twoBagsRef.current.right.length
      const stamp = stampHouse(progressRef.current.houses, order.n, right, atFirstBell, current.mode)
      split = { right, left: order.n - right, stamp }
      progressRef.current = { ...progressRef.current, houses: stamp.houses }
      setProgress((q) => ({ ...q, houses: stamp.houses }))
    }
    const earned = record(order, atFirstBell, split?.stamp.bonus ?? 0)
    payPoints(earned)
    const p = progressRef.current
    const last = p.today !== null && current.index === p.today.plan.length - 1
    void customerSays([line(last && namedToday(p.day).thanks ? 'c/thanks-dima' : thanksFor(order.customer))])
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
    if (order.type === 'B' && split) {
      // The house stamps its row: the right bag's count on the right.
      setHouseRow({ n: order.n, row: split.right, point: !split.stamp.isNew, gold: split.stamp.houses[String(order.n)]?.full ?? false })
      receiptDone = readReceipt(split.right, split.left)
      if (split.stamp.justFull && split.stamp.bonus > 0) void J().say([line('g/house-done')], { prompt: true })
      else void guideOnce('g/two-bags-new')
      await wait(TIMING.hop)
    } else if (order.type === 'E') {
      const st = stickerRef.current
      if (st) setSticker({ ...st, sticker: order.n })
      receiptDone = readReceipt(order.a, order.b)
      await wait(TIMING.hop)
    } else if (order.type === 'C') {
      // The box opens and everything lines up in the tray: it really is that many.
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
    await serveNext(receiptDone)
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

  /** +2 (and a bonus): coins fly from the customer to the board, and the numeral ticks up as they land. */
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
  /** The big board: «g/goal» (or the coupon once she has won). A tap skips it. */
  const showGoal = async () => {
    if (progressRef.current.won) {
      setPhase('coupon')
      return
    }
    const before = phaseRef.current
    setPhase('goal')
    setShownPoints(progressRef.current.points)
    J().cutPrompt()
    const said = J().say([line('g/goal')], { prompt: true })
    // At least a few seconds on screen, even while the line is not recorded yet.
    await Promise.race([Promise.all([said, wait(TIMING.goalAtLeast)]).then(() => wait(TIMING.goalAfter)), skippable(60_000)])
    skip.current = null
    J().cutPrompt()
    setShownPoints(null)
    setPhase(before === 'goal' ? 'arriving' : before)
  }

  const tapBoard = () => {
    const now = phaseRef.current
    if (now === 'goal' || now === 'closing') {
      skip.current?.()
      return
    }
    if (now === 'board') return
    if (now !== 'packing' && now !== 'arriving') return
    run(async () => {
      const wasReady = readyRef.current
      setReady(false)
      await showGoal()
      if (phaseRef.current !== 'coupon') {
        setPhase(wasReady ? 'packing' : phaseRef.current)
        setReady(wasReady)
      }
    })
  }

  // ── Closing ───────────────────────────────────────────────────────────
  const closeShop = async () => {
    setPhase('closing')
    setReady(false)
    setBubble(false)
    setLive(null)
    liveRef.current = null
    setBox({ shown: false, open: false, lineup: false })
    setTrayPieces([])
    // The last order's receipt has been read in full by now: it must not linger behind the board.
    setReceipt(null)
    setSticker(null)
    setHouseRow(null)
    setSignOpen(false)
    sfx.door()
    const p = progressRef.current
    const today = p.today
    // The points went onto the board as she earned them; the big board now shows today's change:
    // the numeral runs from the morning's points to tonight's, today's coins pulse. A tap skips.
    const before = Math.min(today?.start ?? p.points, GOAL)
    const target = p.points
    setTodayChange(target - before)
    setShownPoints(before)
    await wait(500)
    if (p.closings < 3) await J().say([line('g/closed')], { prompt: true })
    let skipped = false
    const skipAll = new Promise<void>((resolve) => {
      skip.current = () => {
        skipped = true
        skip.current = null
        resolve()
      }
    })
    const step = target >= before ? 1 : -1
    for (let i = 1; i <= Math.abs(target - before) && !skipped; i += 1) {
      if (step > 0) sfx.plip(Math.min(10, i))
      setShownPoints(before + i * step)
      await Promise.race([wait(TIMING.pointFly), skipAll])
    }
    if (step < 0 && target !== before) sfx.lose()
    skip.current = null
    setShownPoints(target)
    void bridge.reportDay({ day: p.day, firstBells: today?.firstBells ?? 0, customers: today?.plan.length ?? 0, orders: today?.plan ?? [] })
    const closing = closingLine(before, target, p.nearSaid)
    const next = closeDay(progressRef.current)
    progressRef.current = next
    setProgress(() => next)
    await wait(300)
    if (closing?.id === 'g/goal-200') {
      // The end of the game: the golden coupon, until she taps «نرجع البقالة».
      setPhase('coupon')
      sfx.fanfare()
      void J().say([line('g/goal-200')])
      return
    }
    if (closing) void J().say([line(closing.id as LineId)])
    setDayDone(true)
  }

  const backFromCoupon = () => {
    if (phaseRef.current !== 'coupon') return
    J().cutPrompt()
    if (progressRef.current.today === null) {
      // The coupon came at closing: the board and «يوم جديد» are next.
      setShownPoints(progressRef.current.points)
      setDayDone(true)
      setPhase('closing')
    } else {
      setPhase('packing')
      setReady(liveRef.current !== null)
    }
  }

  const newDay = () => {
    if (phaseRef.current !== 'closing' || !dayDone) return
    J().cutPrompt()
    setDayDone(false)
    setShownPoints(null)
    setTodayChange(0)
    beginDay()
    setSignOpen(true)
    sfx.door()
    run(async () => {
      if (progressRef.current.day > 1) void guideOnce('g/new-day')
      await serveNext()
    })
  }

  /** Today's plan: made once in the morning (and kept if she comes back later in the day). */
  const beginDay = () => {
    const p = progressRef.current
    if (p.today && p.today.served < p.today.plan.length) return
    const arriving = p.pendingArrival
    const withArrival = arriving ? { ...p, arrived: [...new Set([...p.arrived, arriving])] } : p
    const levels = { A: p.types.A.level, B: p.types.B.level, C: p.types.C.level, D: p.types.D.level, E: p.types.E.level }
    const plan = planDay({ open: openTypes(withArrival), arrivedToday: arriving, levels, missedCount: Object.keys(p.missed).length }, rng)
    const newcomer = knownCustomers(p.served).find((id) => !p.met.includes(id)) ?? null
    const next = startDay(p, plan, arriving, dayCustomers(rng, plan.length, p.served, newcomer))
    progressRef.current = next
    setProgress(() => next)
    if (arriving) {
      setSparkle('box')
      sfx.sparkle()
      window.setTimeout(() => setSparkle(null), 1600)
    }
  }

  // Open the shop: on the very first opening the big board shows the challenge, then the first
  // customer walks in.
  useEffect(() => {
    if (!jobRef.current || jobRef.current.cancelled) jobRef.current = new Job(narrator, fast)
    const mine = jobRef.current
    beginDay()
    run(async () => {
      if (!seen('g/goal')) {
        await showGoal()
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
  const today = progress.today
  const served = today?.served ?? 0
  const time = phase === 'closing' ? 5 : Math.min(4, served)
  const queue = phase === 'closing' || !today ? [] : today.customers.slice(served + 1, Math.min(served + 3, today.plan.length))
  const packed = order
    ? order.type === 'A'
      ? tray.length
      : order.type === 'B'
        ? twoBags.right.length + twoBags.left.length
        : order.type === 'E'
          ? sticker
            ? sticker.boxCount + sticker.inBag
            : 0
          : order.a + side.length
    : 0
  const house: House | undefined = houseRow ? progress.houses[String(houseRow.n)] : undefined
  const boardPoints = boardShown ?? progress.points
  const help = live?.mode !== 'compete'
  const stake = live?.mode === 'compete' && live.place === 'counter' && (phase === 'packing' || phase === 'checking' || phase === 'arriving')
  const bigBoard = phase === 'goal' || phase === 'closing'

  const source = (good: Good) => (
    <TapButton
      key={good}
      className={`source source-${good} ${jiggle === `src-${good}` ? 'jiggle' : ''} ${guide === `src-${good}` ? 'guide' : ''}`}
      aria-label={GOOD_NAME[good]}
      onTap={(rect) => tapSource(good, rect)}
      data-src={good}
    >
      {good === 'takis' ? <TakisBag /> : <JarArt flavor={good === 'choc' ? 'choc' : 'pink'} />}
    </TapButton>
  )

  return (
    <main
      className={`screen shop phase-${phase}`}
      ref={rootRef}
      data-time={time}
      data-phase={phase}
      data-ready={ready ? 1 : 0}
      data-order={order?.type ?? ''}
      data-level={order?.level ?? ''}
      data-a={order?.a ?? ''}
      data-b={order?.b ?? ''}
      data-n={order?.n ?? ''}
      data-good={order?.good ?? ''}
      data-mode={live?.mode ?? ''}
      data-sticker={sticker?.sticker ?? ''}
      data-packed={packed}
      data-customer={live ? live.index : ''}
      data-day={progress.day}
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
        {houseRow ? <HouseBoard n={houseRow.n} house={house} row={houseRow.row} point={houseRow.point} /> : null}
        <DoorArt open={signOpen} ajar={live?.mood === 'walk' || leaving !== null} />
        <div className="queue" aria-hidden="true">
          {queue.map((id, i) => (
            <span key={`${served}-${i}`} className={`queue-spot queue-${i}`}>
              <CustomerArt id={id} />
            </span>
          ))}
        </div>
        <TapButton className="board-button" aria-label={`النقاط: ${ar(boardPoints)} من ${ar(GOAL)}`} onTap={tapBoard} data-board>
          <PrizeBoard points={boardPoints} won={progress.won} lit={boardLit} />
          {boardDrop ? (
            <span key={boardDrop} className="board-drop" aria-hidden="true">
              <Coin className="drop-coin" />
              <Coin className="drop-coin" />
            </span>
          ) : null}
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
          {bubble || phase === 'checking' ? <OrderBubble order={live.order} help={live.mode !== 'compete'} /> : null}
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

          <div className={`pack-zone ${order?.type === 'C' && !box.lineup ? 'is-ready-box' : 'is-tray'} ${sparkle === 'box' ? 'sparkle' : ''}`}>
            {order?.type === 'E' && sticker ? (
              <div className="sticker-zone" dir="rtl">
                <TapButton className={`ready-box ${guide === 'box' ? 'guide' : ''}`} aria-label={`العلبة ${ar(sticker.boxCount)}`} onTap={tapBox} data-box>
                  <GiftBox open={box.open} label={sticker.boxCount} className="gift-ready">
                    {box.open ? (
                      <span className="in-box-grid" style={{ '--cols': sticker.boxCount > 6 ? 4 : 3 } as CSSProperties}>
                        {Array.from({ length: sticker.boxCount }, (_, i) => (
                          <span key={i} data-in-box={i}>
                            <Candy flavor={sticker.flavor} className={lit === i ? 'is-lit' : ''} />
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </GiftBox>
                </TapButton>
                <div className="loose">
                  {sticker.bagClosed ? (
                    <TapButton className={`second-bag ${jiggle === 'second-bag' ? 'jiggle' : ''}`} aria-label={`كيس ${ar(sticker.looseCount)}`} onTap={tapSecondBag} data-second-bag>
                      <PaperBag label={sticker.looseCount} />
                    </TapButton>
                  ) : (
                    sticker.loose.map((id, k) => (
                      <TapButton key={id} className="piece" aria-label={GOOD_NAME[order.good]} data-loose={id} onTap={(rect) => tapLoose(id, rect)}>
                        <Candy flavor={sticker.flavor} className={`land ${lit === sticker.boxCount + sticker.inBag + k ? 'is-lit' : ''}`} />
                      </TapButton>
                    ))
                  )}
                </div>
                <span className={`paper-bag-spot ${lit >= sticker.boxCount && lit < sticker.boxCount + sticker.inBag ? 'is-lit' : ''}`} data-in-bag={sticker.inBag}>
                  <PaperBag label={sticker.sticker} fill={sticker.inBag} flavor={sticker.flavor} slap={stickerFly !== null} />
                </span>
              </div>
            ) : order?.type === 'C' && !box.lineup ? (
              <div className="ready-zone" dir="rtl">
                {box.shown ? (
                  <TapButton className={`ready-box slide-in ${guide === 'box' ? 'guide' : ''} ${jiggle === 'box' ? 'jiggle' : ''}`} aria-label={`العلبة ${ar(order.a)}`} onTap={tapBox} data-box>
                    <GiftBox open={box.open} label={order.a} className="gift-ready">
                      {box.open ? (
                        <span className="in-box-grid" style={{ '--cols': order.a > 6 ? 4 : 3 } as CSSProperties}>
                          {Array.from({ length: order.a }, (_, i) => (
                            <span key={i} data-in-box={i}>
                              <Candy flavor={FLAVOR[order.good]} className={lit === i ? 'is-lit' : ''} />
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </GiftBox>
                  </TapButton>
                ) : null}
                <div className="side-tray" style={{ '--slots': Math.max(4, 10 - order.a) } as CSSProperties}>
                  {Array.from({ length: Math.max(4, 10 - order.a) }, (_, i) => {
                    const piece = side[i]
                    return (
                      <span key={i} className="side-slot" data-side={i}>
                        {piece && !piece.arriving ? (
                          <TapButton className="piece ring-lime" aria-label={GOOD_NAME[order.good]} data-side-piece={piece.id} onTap={(rect) => takeBack('side', piece.id, rect)}>
                            <Candy flavor={piece.flavor} className={`land ${lit === order.a + i ? 'is-lit' : ''}`} />
                            {help ? <span className="piece-tag">{ar(order.a + i + 1)}</span> : null}
                          </TapButton>
                        ) : null}
                      </span>
                    )
                  })}
                </div>
              </div>
            ) : order?.type === 'B' ? (
              <div className="two-bags" dir="rtl" data-pick={twoBags.pick}>
                {(['right', 'left'] as BagSide[]).map((side, k) => (
                  <div key={side} className={`open-bag ${twoBags.pick === side ? 'is-picked' : ''}`} data-bag={side}>
                    <TapButton className="bag-body" aria-label={side === 'right' ? 'الكيس اليمين' : 'الكيس اليسار'} aria-pressed={twoBags.pick === side} onTap={() => pickBag(side)} data-bag-pick={side} />
                    <span className="bag-cups">
                      {Array.from({ length: 10 }, (_, i) => {
                        const piece = twoBags[side][i]
                        const index = (k === 0 ? 0 : twoBags.right.length) + i
                        return (
                          <span key={i} className="cup" data-cup={i}>
                            {piece && !piece.arriving ? (
                              <TapButton className="piece" aria-label={GOOD_NAME[order.good]} data-bag-piece={piece.id} onTap={(rect) => takeBack(side, piece.id, rect)}>
                                <Candy flavor={piece.flavor} className={`land ${lit === index ? 'is-lit' : ''}`} />
                              </TapButton>
                            ) : null}
                          </span>
                        )
                      })}
                    </span>
                  </div>
                ))}
                {help ? (
                  <span className="box-count bags-count" aria-hidden="true">
                    {ar(packed)}
                  </span>
                ) : null}
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
                            <Candy flavor={piece.flavor} className={`land ${lit === i ? 'is-lit' : ''}`} />
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
            {receipt ? (
              <Receipt a={receipt.a} b={receipt.b} n={receipt.n} good={receipt.good} part={receipt.part} />
            ) : order?.type === 'E' && sticker && ready ? (
              <Receipt a={order.a} b={order.b} n={null} ask good={order.good} className="order-card" />
            ) : null}
          </div>

          <div className="sources">{(['takis', 'candy', 'choc'] as Good[]).map(source)}</div>
        </div>
        {order?.type === 'E' && sticker ? (
          <div className={`sticker-roll ${guide === 'roll' ? 'guide' : ''}`} dir="ltr" role="group" aria-label="ستيكرات الأعداد">
            {Array.from({ length: 11 }, (_, v) => (
              <TapButton
                key={v}
                className={`sticker ${sticker.dimmed.includes(v) ? 'is-peeled' : ''} ${guide === `sticker-${v}` ? 'guide wiggle' : ''} ${sticker.sticker === v ? 'is-used' : ''}`}
                aria-label={ar(v)}
                data-sticker-n={v}
                onTap={() => tapSticker(v)}
              >
                {ar(v)}
              </TapButton>
            ))}
          </div>
        ) : null}
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
          onMiss={() => {
            if (liveRef.current) miss(liveRef.current)
          }}
          onDone={(result) => streetDone(result.firstTry)}
        />
      ) : null}

      {bigBoard ? (
        <div className="board-overlay" role="dialog" aria-label="التحدي" onPointerDown={() => skip.current?.()}>
          <div className="board-card">
            <PrizeBoard points={shownPoints ?? progress.points} big won={progress.won} lit={boardLit} today={phase === 'closing' ? todayChange : undefined} />
            {phase === 'closing' && dayDone ? (
              <TapButton className="new-day" aria-label="يوم جديد" onTap={newDay}>
                <svg className="sun-icon" viewBox="0 0 64 64" aria-hidden="true">
                  {Array.from({ length: 8 }, (_, i) => (
                    <path key={i} d="M32 4v9" transform={`rotate(${i * 45} 32 32)`} />
                  ))}
                  <circle cx="32" cy="32" r="14" />
                </svg>
                <span>يوم جديد</span>
              </TapButton>
            ) : null}
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
          <TapButton className="new-day coupon-back" aria-label="نرجع البقالة" onTap={backFromCoupon}>
            <span>نرجع البقالة</span>
          </TapButton>
        </div>
      ) : null}
    </main>
  )
}

function OrderBubble({ order, help }: { order: Order; help: boolean }) {
  if (order.type === 'E') {
    return (
      <div className="order-bubble order-E" role="img" aria-label={`كيس واحد ${ar(order.a)} زائد ${ar(order.b)}`}>
        <Receipt a={order.a} b={order.b} n={null} ask good={order.good} className="bubble-card" />
      </div>
    )
  }
  if (order.type === 'B') {
    return (
      <div className="order-bubble order-B" role="img" aria-label={`${ar(order.n)} ${GOOD_NAME[order.good]} في كيسين`}>
        <span className="order-line" dir="rtl">
          <span className="order-num">{ar(order.n)}</span>
          <Candy flavor={FLAVOR[order.good]} className="order-good" />
          <span className="order-bags" aria-hidden="true">
            <PaperBag label={null} />
            <PaperBag label={null} />
          </span>
        </span>
      </div>
    )
  }
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

/** The number house for N on the wall: N on the roof, one row per split (the right bag's count on the right). */
function HouseBoard({ n, house, row, point }: { n: number; house: House | undefined; row: number | null; point: boolean }) {
  const found = house?.found ?? []
  return (
    <div className={`house-board ${house?.full ? 'is-full' : ''} ${point ? 'point-empty' : ''}`} data-house={n} data-found={found.length} role="img" aria-label={`بيت العدد ${ar(n)}: ${ar(found.length)} من ${ar(n + 1)}`}>
      <span className="hb-roof">
        <span className="hb-sign">{ar(n)}</span>
      </span>
      <span className="hb-rows">
        {Array.from({ length: n + 1 }, (_, i) => {
          const first = n - i
          const has = found.includes(first)
          return (
            <span key={first} className={`hb-row ${has ? 'is-found' : ''} ${row === first ? 'is-new' : ''}`} dir="rtl" data-row={first}>
              <span className="hb-room first">{has ? ar(first) : ''}</span>
              <span className="hb-room second">{has ? ar(n - first) : ''}</span>
            </span>
          )
        })}
      </span>
    </div>
  )
}

/** The paper bag of «كيس واحد»: its sticker spot, and a peek of the pieces inside. */
function PaperBag({ label, fill = 0, flavor = 'pink', slap = false }: { label: number | null; fill?: number; flavor?: Flavor; slap?: boolean }) {
  return (
    <span className="paper-bag">
      <svg className="bag-art" viewBox="0 0 100 110" aria-hidden="true">
        <path d="M16 30h68l8 74H8z" fill="#e8c49a" stroke="#3a2318" strokeWidth="3" strokeLinejoin="round" />
        <path d="M16 30l10-14h48l10 14" fill="#d9a877" stroke="#3a2318" strokeWidth="3" strokeLinejoin="round" />
        <path d="M36 30c0-12 28-12 28 0" fill="none" stroke="#3a2318" strokeWidth="3" />
      </svg>
      <span className="bag-peek">
        {Array.from({ length: Math.min(fill, 4) }, (_, i) => (
          <Candy key={i} flavor={flavor} className="candy-sm" />
        ))}
      </span>
      {label !== null ? <span className={`bag-sticker ${slap ? 'slap' : ''}`}>{ar(label)}</span> : <span className="bag-spot" />}
    </span>
  )
}

/** «للأهل»: opens only after a 2-second press-and-hold; a ring fills while holding. */
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
