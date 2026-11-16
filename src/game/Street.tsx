// «توصيل»: the delivery ride on the number street (§3.2 D as changed by §8, §9 and §10). Eleven
// little houses ٠–١٠ run left to right, like the number line in her book. Dabdoob waits on his
// scooter at house a with the parcel; each tap on him is one house on; she taps the door where it
// should go. Training: a trail of pieces marks the way and he says each house number. Competition:
// no trail, no numbers said (he rides in silence if she asks), and a wrong door costs 2 points.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { sfx } from '../audio/sfx'
import { Bear } from '../art/Bear'
import { Candy, type Flavor } from '../art/Candy'
import { CustomerArt } from '../art/Customer'
import { Coin, Receipt } from '../art/ShopArt'
import { NOT_MY_HOUSE_IDS, clip, sentenceClips, type LineId } from '../data/lines'
import { ar } from '../domain/digits'
import { customerRate, type CustomerId, type Mode, type Order } from '../domain/orders'
import { pick, type Rng } from '../domain/random'
import type { Job } from './job'
import { run } from './job'
import { TapButton } from './tap'

export const STREET_TIMING = {
  slide: 450,
  ride: 420,
  quickRide: 160,
  slowRide: 760,
  afterSentence: 1200,
}

const line = (id: LineId) => clip.line(id)
const num = (n: number) => clip.num(n)
const FLAVOR: Record<string, Flavor> = { choc: 'choc', candy: 'pink', takis: 'takis' }

export interface StreetResult {
  /** The right door at the first tap. */
  firstTry: boolean
}

export function Street({
  order,
  job,
  rng,
  neighbours,
  mode,
  guideOnce,
  onReady,
  onMiss,
  onDone,
}: {
  order: Order
  job: () => Job
  rng: Rng
  /** Who may live in the other houses (a wrong door's resident). */
  neighbours: CustomerId[]
  mode: Mode
  guideOnce: (id: LineId, spot?: string | null) => Promise<void>
  onReady: (ready: boolean) => void
  /** A wrong door at the first try (competition: 2 points leave the board). */
  onMiss: () => void
  onDone: (result: StreetResult) => void
}) {
  const { a, b, n } = order
  const help = mode === 'help'
  const [pos, setPos] = useState(a)
  const [hop, setHop] = useState(0)
  const [arcs, setArcs] = useState<[number, number][]>([])
  const [trail, setTrail] = useState<number[]>(() => (help ? Array.from({ length: b }, (_, i) => a + i + 1) : []))
  const [ready, setReadyState] = useState(false)
  const [lit, setLit] = useState<number[]>([])
  const [resident, setResident] = useState<{ at: number; who: CustomerId } | null>(null)
  const [opened, setOpened] = useState<number | null>(null)
  const [glow, setGlow] = useState<number | null>(null)
  const [dimmed, setDimmed] = useState<number[]>([])
  const [ticketPart, setTicketPart] = useState(-1)
  const [delivered, setDelivered] = useState(false)
  const [missed, setMissed] = useState(false)
  const readyRef = useRef(false)
  const busy = useRef(false)
  const wrong = useRef(false)
  const posRef = useRef(a)
  const queued = useRef(0)
  const riding = useRef(false)
  const pendingDoor = useRef<number | null>(null)

  const setReady = (value: boolean) => {
    readyRef.current = value
    setReadyState(value)
    onReady(value)
  }
  const wait = (ms: number) => job().wait(ms)

  /** One house on: the arc is drawn as he rides, never before. */
  const rideOne = async (speak: boolean, ms = STREET_TIMING.ride) => {
    const from = posRef.current
    const to = from + 1
    posRef.current = to
    setPos(to)
    setHop((h) => h + 1)
    setArcs((all) => [...all, [from, to]])
    setLit((all) => [...all, to])
    setTrail((all) => all.filter((x) => x !== to))
    sfx.hop()
    const landing = wait(ms)
    if (speak) void job().count(num(to))
    await landing
  }

  const pump = (speak: boolean) => {
    if (riding.current) return
    riding.current = true
    run(async () => {
      try {
        while (queued.current > 0) {
          queued.current -= 1
          await rideOne(speak)
        }
      } finally {
        riding.current = false
      }
    })
  }

  /** A tap on Dabdoob or the road: one house on (training: along the trail, saying the number). */
  const askRide = () => {
    if (!readyRef.current || busy.current) return
    const target = posRef.current + queued.current
    if (target >= 10) return
    if (help && target >= a + b) return
    queued.current += 1
    pump(help)
  }

  const tapDoor = (house: number) => {
    if (!readyRef.current || busy.current || house === a) return
    if (riding.current) {
      // Still landing: the door answers as soon as he has stopped.
      if (pendingDoor.current !== null) return
      pendingDoor.current = house
      run(async () => {
        while (riding.current) await wait(30)
        pendingDoor.current = null
        tapDoor(house)
      })
      return
    }
    busy.current = true
    job().cutPrompt()
    if (house === n) {
      run(async () => {
        setReady(false)
        setGlow(null)
        // Level 3 straight to the door: he rides there in one go, the arcs drawn as he goes.
        while (posRef.current < n) await rideOne(false, STREET_TIMING.quickRide)
        setOpened(n)
        sfx.door()
        sfx.happy()
        setDelivered(true)
        await job().say([line('c/delivered')], { rate: customerRate(order.customer) })
        // The sum and the arcs stay until the sentence has ended, and a moment more.
        await job().say(sentenceClips(a, b), { joined: true, kind: 'receipt', onStart: (i) => setTicketPart(i) })
        setTicketPart(-1)
        await wait(STREET_TIMING.afterSentence)
        onDone({ firstTry: !wrong.current })
      })
      return
    }
    // A wrong door: its resident pops out; Dabdoob goes back and rides house by house, aloud.
    if (!wrong.current) onMiss()
    wrong.current = true
    setMissed(true)
    run(async () => {
      setReady(false)
      setDimmed((all) => [...all, house])
      const who = pick(rng, neighbours.length ? neighbours : [order.customer])
      setResident({ at: house, who })
      sfx.puzzled()
      await job().say([line(pick(rng, NOT_MY_HOUSE_IDS))], { rate: customerRate(who) })
      await wait(300)
      setResident(null)
      posRef.current = a
      setPos(a)
      setHop((h) => h + 1)
      setArcs([])
      setLit([])
      await wait(STREET_TIMING.slowRide)
      for (let k = 1; k <= b; k += 1) await rideOne(true, STREET_TIMING.slowRide)
      setGlow(n)
      busy.current = false
      setReady(true)
    })
  }

  useEffect(() => {
    run(async () => {
      sfx.door()
      await wait(STREET_TIMING.slide)
      setReady(true)
      await guideOnce('g/delivery', null)
      if (help) await guideOnce('g/ride', null)
      await guideOnce('g/door', null)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ticket = (
    <div className="ticket" data-ticket>
      <Receipt a={a} b={b} n={delivered ? n : null} good={order.good} part={ticketPart} className="ticket-receipt" />
      {!help && !delivered && !missed ? (
        // Competition: the stake waits on the ticket (drawn, no text).
        <span className="stake" data-stake aria-hidden="true">
          <Coin className="stake-coin" />
          <Coin className="stake-coin" />
        </span>
      ) : null}
    </div>
  )

  return (
    <div className="street" data-street data-pos={pos} data-ready={ready ? 1 : 0} data-mode={mode} role="region" aria-label="الشارع">
      <div className="street-sky" aria-hidden="true" />
      {ticket}
      <div className="street-row" dir="ltr">
        <svg className="street-arcs" viewBox="0 0 110 40" preserveAspectRatio="none" aria-hidden="true">
          {arcs.map(([from, to], i) => {
            const x1 = from * 10 + 5
            const x2 = to * 10 + 5
            return <path key={`${i}-${from}`} className="arc" d={`M${x1} 38 Q${(x1 + x2) / 2} -4 ${x2} 38`} vectorEffect="non-scaling-stroke" />
          })}
        </svg>
        <div className="trail" aria-hidden="true">
          {trail.map((h) => (
            <span key={h} className="trail-candy" style={{ '--n': h } as CSSProperties}>
              <Candy flavor={FLAVOR[order.good] ?? 'pink'} className="candy-sm" />
            </span>
          ))}
        </div>
        <TapButton className="scooter" style={{ '--n': pos } as CSSProperties} aria-label="دبدوب" onTap={askRide} data-scooter={pos}>
          <span key={hop} className={hop ? 'bear-hop' : ''}>
            <Bear mood={delivered ? 'clap' : help ? 'idle' : 'hush'} className="scooter-bear" />
            <svg className="scooter-art" viewBox="0 0 100 50" aria-hidden="true">
              <rect x="20" y="8" width="26" height="20" rx="4" fill="#ffe9c7" stroke="#3a2318" strokeWidth="2.4" />
              <path d="M33 8v20" stroke="#ff8fb1" strokeWidth="4" />
              <path d="M14 34h62l10-20" fill="none" stroke="#e0457b" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="20" cy="40" r="8" fill="#3a2318" />
              <circle cx="78" cy="40" r="8" fill="#3a2318" />
              <circle cx="20" cy="40" r="3" fill="#fff6e9" />
              <circle cx="78" cy="40" r="3" fill="#fff6e9" />
            </svg>
          </span>
        </TapButton>
        <div className="houses" role="group" aria-label="البيوت">
          {Array.from({ length: 11 }, (_, h) => (
            <TapButton
              key={h}
              className={`house-door ${lit.includes(h) ? 'is-lit' : ''} ${dimmed.includes(h) ? 'is-dim' : ''} ${glow === h ? 'guide' : ''} ${opened === h ? 'is-open' : ''}`}
              aria-label={`بيت ${ar(h)}`}
              data-door={h}
              onTap={() => tapDoor(h)}
              style={{ '--hue': (h * 37) % 360 } as CSSProperties}
            >
              <span className="mini-roof" />
              <span className="mini-house">
                <span className="mini-window" />
                <span className="mini-door" />
              </span>
              <span className="house-num">{ar(h)}</span>
              {resident?.at === h ? (
                <span className="resident">
                  <CustomerArt id={resident.who} mood="puzzled" />
                </span>
              ) : null}
              {opened === h ? (
                <span className="resident">
                  <CustomerArt id={order.customer} mood="happy" />
                </span>
              ) : null}
            </TapButton>
          ))}
        </div>
        <TapButton className="road" aria-label="الطريق" onTap={askRide} />
      </div>
    </div>
  )
}
