import type { CSSProperties, ReactNode } from 'react'
import { ar } from '../domain/digits'

/** The ribbon bow on a gift box lid. */
export function Bow({ className = '' }: { className?: string }) {
  return (
    <svg className={`bow ${className}`} viewBox="0 0 80 40" aria-hidden="true">
      <path d="M40 26C30 8 10 2 8 14c-2 10 16 14 32 12z" fill="#ff8fb1" stroke="#e0457b" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M40 26C50 8 70 2 72 14c2 10-16 14-32 12z" fill="#ff8fb1" stroke="#e0457b" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M17 14c5-4 13 2 18 9M63 14c-5-4-13 2-18 9" fill="none" stroke="#ffd0df" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M36 27l-8 12M44 27l8 12" stroke="#e0457b" strokeWidth="5" strokeLinecap="round" />
      <rect x="33" y="20" width="14" height="12" rx="5" fill="#e0457b" />
    </svg>
  )
}

/**
 * «العلبة»: a gift box with a lid. Open: the lid is lifted and the candies sit inside. Closed: the
 * lid is on and the round label shows the numeral — "the number in your head".
 */
export function GiftBox({
  open,
  label,
  children,
  className = '',
  style,
}: {
  open: boolean
  /** The numeral (or «؟») on the label of the closed box. */
  label?: number | string
  children?: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <span className={`gift ${open ? 'is-open' : 'is-closed'} ${className}`} style={style}>
      <span className="gift-body">
        <span className="gift-inside" />
        <span className="gift-candies">{children}</span>
        <span className="gift-front">
          <span className="gift-ribbon" />
        </span>
        {label !== undefined ? (
          <span className="gift-label" aria-hidden={open}>
            {typeof label === 'number' ? ar(label) : label}
          </span>
        ) : null}
      </span>
      <span className="gift-lid">
        <span className="gift-ribbon" />
        <Bow />
      </span>
    </span>
  )
}

/** A tiny closed gift box, for a hidden numeral on the number line. */
export function MiniBox() {
  return (
    <svg className="mini-box" viewBox="0 0 40 40" aria-hidden="true">
      <rect x="6" y="15" width="28" height="20" rx="3" fill="#ffe9c7" stroke="#c98a55" strokeWidth="2" />
      <rect x="4" y="10" width="32" height="8" rx="2.5" fill="#fff6e9" stroke="#c98a55" strokeWidth="2" />
      <rect x="17.5" y="10" width="5" height="25" fill="#ff8fb1" />
      <path d="M20 10c-4-6-10-6-9-2s6 3 9 2zM20 10c4-6 10-6 9-2s-6 3-9 2z" fill="#ff8fb1" stroke="#e0457b" strokeWidth="1.4" />
    </svg>
  )
}
