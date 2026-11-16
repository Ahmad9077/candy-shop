import type { CSSProperties, ReactNode } from 'react'
import takisPiece from '../assets/takis-piece.webp?inline'

/** The photo of one Takis piece, inlined (no file is fetched at runtime). */
export const TAKIS_PIECE: string = takisPiece

export type Flavor = 'choc' | 'pink' | 'takis'

/**
 * One piece of a good: a glossy bonbon (chocolate ones carry a little swirl so they are told apart
 * by more than colour; strawberry ones are plain pink), or the photo of a Takis piece.
 */
export function Candy({ flavor, className = '', style, children }: { flavor: Flavor; className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <span className={`candy candy-${flavor} ${className}`} style={style} aria-hidden="true">
      {flavor === 'choc' ? (
        <svg className="candy-swirl" viewBox="0 0 40 40">
          <path d="M11 22c2-7 13-9 17-3 3 5-2 10-7 8-4-1-3-6 1-6" />
        </svg>
      ) : null}
      {flavor === 'takis' ? <TakisChip /> : null}
      {children}
    </span>
  )
}

/** A dashed candy-sized ring: the faint outline of where a candy could be. */
export function CandyOutline({ filled, className = '' }: { filled?: boolean; className?: string }) {
  return filled ? <Candy flavor="choc" className={`candy-sm ${className}`} /> : <span className={`candy-outline ${className}`} aria-hidden="true" />
}

/** A Takis piece: the owner's photo of one rolled chip (§10.3), used as it is. */
function TakisChip() {
  return <img className="takis-chip" src={TAKIS_PIECE} alt="" draggable={false} />
}
