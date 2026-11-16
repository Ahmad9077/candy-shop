import { TAKIS_PIECE } from '../art/Candy'

// A candy flying along an arc from where it was tapped to where it lands (about 350 ms).
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export interface FlyOptions {
  fast?: boolean
  duration?: number
  /** How high the arc rises above the straight path, in px. */
  lift?: number
  className: string
  /** The element's base class: a candy by default, `coin` for coins. */
  base?: string
}

export function fly(from: DOMRect, to: Element | null | undefined, options: FlyOptions): Promise<void> {
  if (!to || options.fast || typeof document === 'undefined') return Promise.resolve()
  const target = to.getBoundingClientRect()
  const duration = reduced() ? 1 : (options.duration ?? 350)
  const el = document.createElement('span')
  el.className = `${options.base ?? 'candy'} flying ${options.className}`
  el.setAttribute('aria-hidden', 'true')
  if (/\bcandy-takis\b/.test(options.className)) {
    const img = document.createElement('img')
    img.className = 'takis-chip'
    img.src = TAKIS_PIECE
    img.alt = ''
    el.append(img)
  }
  // A piece flies at its own size (the smaller of where it leaves and where it lands), from the
  // middle of one to the middle of the other: a piece leaving the wide Takis bag must not start
  // as big as the bag. Coins keep growing or shrinking into their target.
  const piece = (options.base ?? 'candy') === 'candy'
  const size = Math.min(from.width, from.height, target.width, target.height)
  const start = piece ? new DOMRect(from.left + (from.width - size) / 2, from.top + (from.height - size) / 2, size, size) : from
  const end = piece ? new DOMRect(target.left + (target.width - size) / 2, target.top + (target.height - size) / 2, size, size) : target
  Object.assign(el.style, {
    position: 'fixed',
    left: `${start.left}px`,
    top: `${start.top}px`,
    width: `${start.width}px`,
    height: `${start.height}px`,
    margin: '0',
    zIndex: '50',
    pointerEvents: 'none',
    transformOrigin: '0 0',
  })
  ;(document.querySelector('.game') ?? document.body).append(el)
  const dx = end.left - start.left
  const dy = end.top - start.top
  const scale = start.width > 0 ? end.width / start.width : 1
  const lift = options.lift ?? Math.min(110, 40 + Math.hypot(dx, dy) * 0.25)
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      el.remove()
      resolve()
    }
    try {
      const animation = el.animate(
        [
          { transform: 'translate(0, 0) scale(1)' },
          { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) scale(${(1 + scale) / 2 + 0.08})`, offset: 0.5 },
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
        ],
        { duration, easing: 'cubic-bezier(.45,.05,.4,1)', fill: 'forwards' },
      )
      animation.oncancel = finish
    } catch {
      finish()
    }
    // The landing is timed by the clock, not by the animation's own end event, so the game's pace
    // is the same in every browser (and in the pace tests, which run on a fake clock).
    window.setTimeout(finish, duration)
  })
}
