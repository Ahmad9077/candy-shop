// The customers: original, simple animals with a walk, an idle bob, a happy hop with hearts and a
// puzzled head tilt with a small «؟» puff. Their lower half hides behind the counter.
import type { ReactNode } from 'react'
import type { CustomerId } from '../domain/orders'

export type CustomerMood = 'idle' | 'walk' | 'happy' | 'puzzled'

const eyes = (y: number, gap = 15) => (
  <g className="cu-eyes">
    {[-gap, gap].map((dx) => (
      <g key={dx} className="cu-eye">
        <ellipse cx={60 + dx} cy={y} rx="6.2" ry="7.4" fill="#3a2318" />
        <circle cx={61.6 + dx} cy={y - 2.4} r="2.2" fill="#fff" />
      </g>
    ))}
  </g>
)

const BODIES: Record<CustomerId, ReactNode> = {
  rabbit: (
    <>
      <g className="cu-ears">
        <path d="M44 52C36 22 38 4 46 4s12 20 8 48z" fill="#f3eefb" stroke="#3a2318" strokeWidth="2.6" />
        <path d="M46 46C42 26 43 12 47 12s6 14 4 34z" fill="#ffc4d6" />
        <path d="M76 52C84 22 82 4 74 4s-12 20-8 48z" fill="#f3eefb" stroke="#3a2318" strokeWidth="2.6" />
        <path d="M74 46C78 26 77 12 73 12s-6 14-4 34z" fill="#ffc4d6" />
      </g>
      <path d="M26 160c0-38 14-58 34-58s34 20 34 58z" fill="#f3eefb" stroke="#3a2318" strokeWidth="2.6" />
      <path d="M44 110c6 6 26 6 32 0l-2 10c-8 5-20 5-28 0z" fill="#8fe0c9" stroke="#3a2318" strokeWidth="2.2" />
      <circle cx="60" cy="76" r="34" fill="#f3eefb" stroke="#3a2318" strokeWidth="2.6" />
      {eyes(72)}
      <ellipse cx="60" cy="86" rx="5" ry="3.6" fill="#ff8fb1" />
      <path d="M60 90v4M60 94c-3 3-7 3-9 1M60 94c3 3 7 3 9 1" fill="none" stroke="#3a2318" strokeWidth="2" strokeLinecap="round" />
      <circle cx="36" cy="86" r="6" fill="#ff8fb1" opacity=".4" />
      <circle cx="84" cy="86" r="6" fill="#ff8fb1" opacity=".4" />
    </>
  ),
  cat: (
    <>
      <path d="M26 160c0-38 14-58 34-58s34 20 34 58z" fill="#c9d7ea" stroke="#3a2318" strokeWidth="2.6" />
      <path d="M48 120h24M46 134h28M46 148h28" stroke="#9fb3cf" strokeWidth="5" strokeLinecap="round" />
      <path d="M30 60L28 30l22 16zM90 60l2-30-22 16z" fill="#c9d7ea" stroke="#3a2318" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M33 52l-1-14 10 8zM87 52l1-14-10 8z" fill="#ffc4d6" />
      <ellipse cx="60" cy="74" rx="36" ry="32" fill="#c9d7ea" stroke="#3a2318" strokeWidth="2.6" />
      <path d="M52 46l2 10M60 44v11M68 46l-2 10" stroke="#9fb3cf" strokeWidth="3.4" strokeLinecap="round" />
      {eyes(72, 14)}
      <path d="M56 84h8l-4 4z" fill="#ff8fb1" />
      <path d="M60 88c-2 4-6 4-8 2M60 88c2 4 6 4 8 2" fill="none" stroke="#3a2318" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 80l16 2M22 88l16-2M98 80l-16 2M98 88l-16-2" stroke="#3a2318" strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
      <circle cx="38" cy="86" r="5.5" fill="#ff8fb1" opacity=".35" />
      <circle cx="82" cy="86" r="5.5" fill="#ff8fb1" opacity=".35" />
    </>
  ),
  duck: (
    <>
      <path d="M24 160c0-40 16-62 36-62s36 22 36 62z" fill="#ffd95a" stroke="#3a2318" strokeWidth="2.6" />
      <path d="M30 128c-6-6-8-16-4-20 8 2 12 10 12 18z" fill="#ffcb2e" stroke="#3a2318" strokeWidth="2.2" />
      <circle cx="60" cy="72" r="34" fill="#ffd95a" stroke="#3a2318" strokeWidth="2.6" />
      <path d="M58 38c-2-10 6-14 10-10-6 0-6 6-4 10z" fill="#ffcb2e" stroke="#3a2318" strokeWidth="2" />
      {eyes(66, 14)}
      <path d="M44 82c4-8 28-8 32 0-2 8-30 8-32 0z" fill="#ff9f43" stroke="#3a2318" strokeWidth="2.4" />
      <path d="M46 82h28" stroke="#3a2318" strokeWidth="1.6" opacity=".5" />
      <path d="M44 104l10 6 6-6 6 6 10-6-4 12H48z" fill="#9fd8ff" stroke="#3a2318" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="34" cy="80" r="5.5" fill="#ff8fb1" opacity=".4" />
      <circle cx="86" cy="80" r="5.5" fill="#ff8fb1" opacity=".4" />
    </>
  ),
  hedgehog: (
    <>
      <path d="M22 160c0-40 16-64 38-64s38 24 38 64z" fill="#c9a27a" stroke="#3a2318" strokeWidth="2.6" />
      <path d="M22 70l-6-14 14 4-2-16 13 9 2-17 11 13 6-16 6 16 11-13 2 17 13-9-2 16 14-4-6 14 10 8-14 2z" fill="#8a5a3c" stroke="#3a2318" strokeWidth="2.4" strokeLinejoin="round" />
      <ellipse cx="60" cy="80" rx="30" ry="26" fill="#f1d9bd" stroke="#3a2318" strokeWidth="2.6" />
      {eyes(76, 12)}
      <ellipse cx="60" cy="90" rx="5" ry="4" fill="#3a2318" />
      <path d="M54 98c3 3 9 3 12 0" fill="none" stroke="#3a2318" strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="90" r="5" fill="#ff8fb1" opacity=".45" />
      <circle cx="80" cy="90" r="5" fill="#ff8fb1" opacity=".45" />
    </>
  ),
  panda: (
    <>
      <path d="M24 160c0-40 16-60 36-60s36 20 36 60z" fill="#fff" stroke="#3a2318" strokeWidth="2.6" />
      <path d="M24 130c4-14 12-22 20-24v54H24zM96 130c-4-14-12-22-20-24v54h20z" fill="#3a2318" />
      <circle cx="30" cy="46" r="13" fill="#3a2318" />
      <circle cx="90" cy="46" r="13" fill="#3a2318" />
      <circle cx="60" cy="74" r="34" fill="#fff" stroke="#3a2318" strokeWidth="2.6" />
      <ellipse cx="45" cy="72" rx="11" ry="13" fill="#3a2318" transform="rotate(-20 45 72)" />
      <ellipse cx="75" cy="72" rx="11" ry="13" fill="#3a2318" transform="rotate(20 75 72)" />
      <g className="cu-eyes">
        {[-14, 14].map((dx) => (
          <g key={dx} className="cu-eye">
            <circle cx={60 + dx} cy="72" r="5" fill="#fff" />
            <circle cx={60 + dx} cy="73" r="3" fill="#3a2318" />
          </g>
        ))}
      </g>
      <ellipse cx="60" cy="88" rx="5" ry="3.6" fill="#3a2318" />
      <path d="M60 92c-3 4-8 4-10 1M60 92c3 4 8 4 10 1" fill="none" stroke="#3a2318" strokeWidth="2" strokeLinecap="round" />
      <circle cx="38" cy="88" r="5" fill="#ff8fb1" opacity=".45" />
      <circle cx="82" cy="88" r="5" fill="#ff8fb1" opacity=".45" />
    </>
  ),
  frog: (
    <>
      <path d="M24 160c0-40 16-60 36-60s36 20 36 60z" fill="#8ed36b" stroke="#3a2318" strokeWidth="2.6" />
      <ellipse cx="60" cy="130" rx="20" ry="18" fill="#d8f2b8" />
      <ellipse cx="60" cy="80" rx="38" ry="28" fill="#8ed36b" stroke="#3a2318" strokeWidth="2.6" />
      <circle cx="40" cy="56" r="14" fill="#8ed36b" stroke="#3a2318" strokeWidth="2.6" />
      <circle cx="80" cy="56" r="14" fill="#8ed36b" stroke="#3a2318" strokeWidth="2.6" />
      {eyes(56, 20)}
      <path d="M38 86c8 10 36 10 44 0" fill="none" stroke="#3a2318" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="30" cy="84" r="6" fill="#ff8fb1" opacity=".45" />
      <circle cx="90" cy="84" r="6" fill="#ff8fb1" opacity=".45" />
      <path d="M48 104l12 6 12-6" fill="#ffc94a" stroke="#3a2318" strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  fox: (
    <>
      <path d="M26 160c0-38 14-58 34-58s34 20 34 58z" fill="#f29a4a" stroke="#3a2318" strokeWidth="2.6" />
      <path d="M44 112c4 10 28 10 32 0v48H44z" fill="#fff6e9" />
      <path d="M28 64L24 28l26 22zM92 64l4-36-26 22z" fill="#f29a4a" stroke="#3a2318" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M30 52l-2-16 12 10zM90 52l2-16-12 10z" fill="#3a2318" />
      <path d="M24 70c0-22 16-34 36-34s36 12 36 34c0 16-16 32-36 32S24 86 24 70z" fill="#f29a4a" stroke="#3a2318" strokeWidth="2.6" />
      <path d="M30 78c8 0 18 6 30 22 12-16 22-22 30-22-4 14-14 24-30 24S34 92 30 78z" fill="#fff6e9" />
      {eyes(70, 14)}
      <ellipse cx="60" cy="92" rx="5" ry="3.6" fill="#3a2318" />
      <circle cx="38" cy="84" r="5" fill="#ff8fb1" opacity=".45" />
      <circle cx="82" cy="84" r="5" fill="#ff8fb1" opacity=".45" />
    </>
  ),
  penguin: (
    <>
      <path d="M24 160c0-42 16-66 36-66s36 24 36 66z" fill="#3d4b6b" stroke="#3a2318" strokeWidth="2.6" />
      <path d="M38 160c0-30 10-50 22-50s22 20 22 50z" fill="#fff" />
      <circle cx="60" cy="72" r="34" fill="#3d4b6b" stroke="#3a2318" strokeWidth="2.6" />
      <path d="M34 78c0-16 12-24 26-16 14-8 26 0 26 16 0 14-12 22-26 22S34 92 34 78z" fill="#fff" />
      {eyes(76, 12)}
      <path d="M52 88h16l-8 8z" fill="#ffb347" stroke="#3a2318" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="40" cy="88" r="5" fill="#ff8fb1" opacity=".5" />
      <circle cx="80" cy="88" r="5" fill="#ff8fb1" opacity=".5" />
      <path d="M38 104h44" stroke="#ff8fb1" strokeWidth="6" strokeLinecap="round" />
    </>
  ),
}

export function CustomerArt({ id, mood = 'idle', className = '' }: { id: CustomerId; mood?: CustomerMood; className?: string }) {
  return (
    <span className={`customer customer-${id} mood-${mood} ${className}`} aria-hidden="true">
      <svg className="customer-body" viewBox="0 0 120 160">
        {BODIES[id]}
      </svg>
      {mood === 'happy' ? (
        <span className="hearts">
          {[0, 1, 2].map((i) => (
            <svg key={i} className={`heart heart-${i}`} viewBox="0 0 24 22">
              <path d="M12 21C5 15 1 11 1 6.5 1 3.4 3.4 1 6.4 1c2.2 0 4.2 1.3 5.6 3.2C13.4 2.3 15.4 1 17.6 1 20.6 1 23 3.4 23 6.5 23 11 19 15 12 21z" />
            </svg>
          ))}
        </span>
      ) : null}
      {mood === 'puzzled' ? <span className="puff">؟</span> : null}
    </span>
  )
}
