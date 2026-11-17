// The sweet shop itself: jars, the bell, coins and the coin jar, the window, the door and its sign,
// the shop front, the groceries on the shelves, the prize board, the coupon, the receipt. All
// original inline SVG/CSS, except the Takis bag, which is the owner's photo used as it is.
import type { CSSProperties, ReactNode } from 'react'
import { ar } from '../domain/digits'
import takisBag from '../assets/takis-bag.webp?inline'
import { CHILD_NAME } from '../data/lines'
import { GOAL } from '../domain/progress'
import { Awning } from './Scene'

/** A glass candy jar full of one flavour (the thing she taps). */
export function JarArt({ flavor }: { flavor: 'choc' | 'pink' }) {
  const dots = [
    [30, 92], [50, 94], [70, 92], [40, 78], [60, 79], [80, 80], [26, 76], [34, 62], [54, 64], [74, 64], [46, 50], [66, 50],
  ]
  return (
    <svg className={`jar-art jar-${flavor}`} viewBox="0 0 100 120" aria-hidden="true">
      <defs>
        <radialGradient id={`jc-${flavor}`} cx="35%" cy="30%" r="70%">
          {flavor === 'choc' ? (
            <>
              <stop offset="0" stopColor="#b98160" />
              <stop offset=".6" stopColor="#6b3f2a" />
              <stop offset="1" stopColor="#46261a" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#ffe6ee" />
              <stop offset=".6" stopColor="#ff8fb1" />
              <stop offset="1" stopColor="#e66892" />
            </>
          )}
        </radialGradient>
      </defs>
      <rect x="22" y="6" width="56" height="14" rx="5" fill={flavor === 'choc' ? '#e8a04b' : '#ff8fb1'} stroke="#3a2318" strokeWidth="2.4" />
      <rect x="28" y="18" width="44" height="8" fill="#dcefff" stroke="#9cc6e6" strokeWidth="2" />
      <path d="M28 26c-16 6-20 18-20 34v38c0 10 6 16 16 16h52c10 0 16-6 16-16V60c0-16-4-28-20-34z" fill="#eef8ff" stroke="#9cc6e6" strokeWidth="3" />
      <g>
        {dots.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y! + 10} r="10" fill={`url(#jc-${flavor})`} stroke="rgba(58,35,24,.25)" />
        ))}
      </g>
      <path d="M18 54c0-10 4-18 12-22" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".8" />
      <rect x="30" y="60" width="40" height="22" rx="6" fill="#fff6e9" stroke="#3a2318" strokeWidth="2" />
      <circle cx="50" cy="71" r="7" fill={`url(#jc-${flavor})`} />
    </svg>
  )
}

/** The brass counter bell. */
export function BellArt() {
  return (
    <svg className="bell-art" viewBox="0 0 100 80" aria-hidden="true">
      <defs>
        <linearGradient id="brass" x1="0" x2="1">
          <stop offset="0" stopColor="#b8862b" />
          <stop offset=".35" stopColor="#ffe08a" />
          <stop offset=".7" stopColor="#e8b23f" />
          <stop offset="1" stopColor="#9a6a1c" />
        </linearGradient>
      </defs>
      <rect x="8" y="64" width="84" height="12" rx="6" fill="#6b3f2a" stroke="#3a2318" strokeWidth="2.4" />
      <g className="bell-dome">
        <path d="M18 64c0-24 14-38 32-38s32 14 32 38z" fill="url(#brass)" stroke="#7a5212" strokeWidth="2.4" />
        <path d="M30 52c2-10 8-16 16-18" fill="none" stroke="#fff6d0" strokeWidth="4" strokeLinecap="round" opacity=".8" />
      </g>
      <g className="bell-button">
        <rect x="46" y="14" width="8" height="14" rx="3" fill="#9a6a1c" />
        <ellipse cx="50" cy="13" rx="11" ry="5" fill="url(#brass)" stroke="#7a5212" strokeWidth="2" />
      </g>
    </svg>
  )
}

/** One gold coin. */
export function Coin({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <span className={`coin ${className}`} style={style} aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="18" fill="#ffc94a" stroke="#b07a12" strokeWidth="2.6" />
        <circle cx="20" cy="20" r="12.5" fill="none" stroke="#e5a521" strokeWidth="2" />
        <path d="M20 12l2.4 5 5.4.6-4 3.7 1.1 5.3L20 24l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z" fill="#fff1b8" />
      </svg>
    </span>
  )
}

/** The window: the sky follows the day (data-time 0 morning … 5 evening). */
export function ShopWindow() {
  return (
    <div className="shop-window" aria-hidden="true">
      <div className="sky">
        <span className="sun" />
        <span className="cloud cloud-1" />
        <span className="cloud cloud-2" />
        <span className="town">
          <svg viewBox="0 0 200 60" preserveAspectRatio="none">
            <path d="M0 60V34h20V22h18v12h16V14h22v20h14V26h20v8h18V18h22v16h14V28h16v32z" fill="currentColor" />
          </svg>
        </span>
      </div>
      <span className="window-bars" />
    </div>
  )
}

/** The hanging sign: «مفتوح» or «مسكر». */
export function Sign({ open }: { open: boolean }) {
  return (
    <span className={`shop-sign ${open ? 'is-open' : 'is-closed'}`} aria-hidden="true">
      <span className="sign-string" />
      <span className="sign-card" key={open ? 'open' : 'closed'}>
        <span className={`sign-face ${open ? 'sign-back' : 'sign-front'}`}>{open ? 'مفتوح' : 'مسكر'}</span>
      </span>
    </span>
  )
}

export function DoorArt({ open, ajar = false }: { open: boolean; ajar?: boolean }) {
  return (
    <div className={`shop-door ${ajar ? 'is-ajar' : ''}`} aria-hidden="true">
      <span className="door-frame" />
      <span className="door-panel">
        <span className="door-glass" />
        <span className="door-knob" />
      </span>
      <Sign open={open} />
    </div>
  )
}

/** The shop from the street, for the opening. */
export function Facade({ children }: { children?: ReactNode }) {
  return (
    <div className="facade" aria-hidden="false">
      <div className="facade-wall">
        <Awning />
        <span className="facade-name">البقالة</span>
        <div className="facade-window">
          <span className="fw-jar fw-jar-1" />
          <span className="fw-jar fw-jar-2" />
          <span className="fw-jar fw-jar-3" />
          <span className="fw-cake" />
        </div>
        {children}
      </div>
      <div className="facade-street" />
    </div>
  )
}

/**
 * The receipt «a + b = n», first number on the right: brown then pink for sweets, purple then lime
 * for Takis. `part` is the word being said (0 a, 1 +, 2 b, 3 =, 4 n): that part pulses.
 */
export function Receipt({
  a,
  b,
  n,
  good = 'choc',
  part = -1,
  className = '',
}: {
  a: number
  b: number
  n: number | null
  /** The order's one good: the first chip takes its colour (brown, pink, purple), the second is lime. */
  good?: string
  part?: number
  className?: string
}) {
  const on = (i: number) => (part === i ? 'is-said' : '')
  return (
    <div
      className={`receipt receipt-${good} ${className}`}
      dir="rtl"
      role="img"
      aria-label={n === null ? `${ar(a)} زائد ${ar(b)}` : `${ar(a)} زائد ${ar(b)} يساوي ${ar(n)}`}
    >
      <span className={`chip chip-first ${on(0)}`} data-part="a">
        {ar(a)}
      </span>
      <span className={`sign ${on(1)}`}>+</span>
      <span className={`chip chip-second ${on(2)}`} data-part="b">
        {ar(b)}
      </span>
      {n === null ? null : (
        <>
          <span className={`sign ${on(3)}`}>=</span>
          <span className={`chip chip-sum ${on(4)}`} data-part="sum">
            {ar(n)}
          </span>
        </>
      )}
    </div>
  )
}

/** The owner's photo of the Takis bag, used as it is. */
export function TakisBag({ className = '' }: { className?: string }) {
  return <img className={`takis-bag ${className}`} src={takisBag} alt="" draggable={false} />
}

/** The board's track: 20 steps whatever the goal (§11.5: one step per 5 points). */
export const BOARD_STEPS = 20

/**
 * The prize board: the bag at the far end of a track of 20 steps, filling left to right like the
 * number line, and her points as a numeral.
 */
export function PrizeBoard({ points, big = false, won = false, lit = false }: { points: number; big?: boolean; won?: boolean; lit?: boolean }) {
  const steps = Math.floor((Math.min(points, GOAL) * BOARD_STEPS) / GOAL)
  return (
    <span className={`prize-board ${big ? 'is-big' : ''} ${won ? 'is-won' : ''} ${lit ? 'is-lit' : ''}`}>
      <span className="pb-points">
        <Coin className="pb-coin" />
        <span className="pb-num" data-points={points}>
          {ar(points)}
        </span>
      </span>
      <span className="pb-track" dir="ltr">
        {Array.from({ length: BOARD_STEPS }, (_, i) => (
          <span key={i} className={`pb-step ${i < steps ? 'on' : ''}`} />
        ))}
        <span className="pb-prize">
          <TakisBag />
          {won ? <span className="pb-ticket">كوبون</span> : big ? <span className="pb-goal">{ar(GOAL)}</span> : null}
        </span>
      </span>
    </span>
  )
}

/** The golden coupon at the goal. */
export function CouponArt() {
  return (
    <div className="coupon-card">
      <span className="coupon-title">كوبون تاكيز</span>
      <TakisBag className="coupon-bag" />
      <span className="coupon-text">
        {CHILD_NAME} جمعت {ar(GOAL)} نقطة بدون مساعدة
      </span>
    </div>
  )
}

/** Groceries on the wall shelves: drawn, generic, no brand or lettering, not for sale. */
export function Groceries({ row }: { row: 1 | 2 }) {
  return (
    <svg className="groceries" viewBox="0 0 200 60" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      {row === 1 ? (
        <>
          {[8, 34, 60].map((x, i) => (
            <g key={x}>
              <rect x={x} y="22" width="22" height="36" rx="3" fill={['#e8f1f8', '#fde7c5', '#e6f6ee'][i]} stroke="#3a2318" strokeWidth="2" />
              <rect x={x} y="32" width="22" height="12" fill={['#ff8fb1', '#e8a04b', '#8fe0c9'][i]} />
              <ellipse cx={x + 11} cy="22" rx="11" ry="3" fill="#cfd8e0" stroke="#3a2318" strokeWidth="2" />
            </g>
          ))}
          <path d="M94 58V18l6-8h20l6 8v40z" fill="#9fd8ff" stroke="#3a2318" strokeWidth="2" strokeLinejoin="round" />
          <rect x="100" y="26" width="20" height="20" rx="4" fill="#fff6e9" />
          <circle cx="110" cy="36" r="6" fill="#ffc94a" />
          <rect x="134" y="14" width="26" height="44" rx="3" fill="#ffe39a" stroke="#3a2318" strokeWidth="2" />
          <path d="M134 24h26" stroke="#e0457b" strokeWidth="5" />
          <rect x="166" y="24" width="26" height="34" rx="3" fill="#c9a0dc" stroke="#3a2318" strokeWidth="2" />
          <circle cx="179" cy="41" r="7" fill="#fff6e9" />
        </>
      ) : (
        <>
          <path d="M6 58c0-14 10-22 30-22s30 8 30 22z" fill="#e8a04b" stroke="#3a2318" strokeWidth="2" />
          {(
            [
              [18, 36, '#ff6b5b'],
              [32, 30, '#ffb347'],
              [46, 36, '#ff6b5b'],
              [26, 42, '#9ad15b'],
              [40, 42, '#ffb347'],
            ] as const
          ).map(([x, y, c], i) => (
            <circle key={i} cx={x} cy={y} r="8" fill={c} stroke="#3a2318" strokeWidth="1.6" />
          ))}
          {[78, 100].map((x, i) => (
            <g key={x}>
              <path d={`M${x} 58V26h16v32z`} fill={i ? '#ffb3cb' : '#b7e4ff'} stroke="#3a2318" strokeWidth="2" />
              <path d={`M${x + 4} 26v-8h8v8`} fill="#fff" stroke="#3a2318" strokeWidth="2" />
              <rect x={x + 3} y="36" width="10" height="10" rx="2" fill="#fff6e9" />
            </g>
          ))}
          {[126, 152, 176].map((x, i) => (
            <g key={x}>
              <path d={`M${x} 58V22c0-5 4-8 8-8h4c4 0 8 3 8 8v36z`} fill={['#8fe0c9', '#ff8fb1', '#ffd77a'][i]} stroke="#3a2318" strokeWidth="2" />
              <rect x={x + 6} y="8" width="8" height="8" rx="2" fill="#6b3f2a" />
            </g>
          ))}
        </>
      )}
    </svg>
  )
}
