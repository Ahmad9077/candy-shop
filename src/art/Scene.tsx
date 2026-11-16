// Shared pieces of the shop: the awning (shop front) and the number house roof (order B, later).
import { ar } from '../domain/digits'

export function Awning() {
  return (
    <svg className="awning" viewBox="0 0 400 44" preserveAspectRatio="none" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <g key={i}>
          <rect x={i * 40} y="0" width="40" height="30" fill={i % 2 ? '#fff6e9' : '#ff8fb1'} />
          <path d={`M${i * 40} 30q20 22 40 0z`} fill={i % 2 ? '#fff6e9' : '#ff8fb1'} />
        </g>
      ))}
      <rect x="0" y="0" width="400" height="5" fill="#e0457b" />
    </svg>
  )
}

/** The gingerbread number house: the whole on the roof, two rooms below. */
export function HouseRoof({ whole }: { whole: number }) {
  return (
    <div className="house-roof">
      <svg viewBox="0 0 300 96" preserveAspectRatio="none" aria-hidden="true">
        <path d="M8 92L150 6l142 86z" fill="#ff8fb1" stroke="#3a2318" strokeWidth="4" strokeLinejoin="round" />
        <path d="M30 80L150 18l120 62" fill="none" stroke="#fff6e9" strokeWidth="5" strokeLinecap="round" strokeDasharray="0.1 14" />
        <path d="M8 92q12 8 24 0t24 0 24 0 24 0 24 0 24 0 24 0 24 0 24 0 24 0 24 0 24 0" fill="none" stroke="#fff6e9" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <span className="roof-sign">{ar(whole)}</span>
    </div>
  )
}
