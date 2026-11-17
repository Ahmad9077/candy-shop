import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { wakeAudio, watchAudio } from './audio/context'
import { Narrator } from './audio/player'
import { NarratorContext } from './audio/NarratorContext'
import { sfx } from './audio/sfx'
import { Facade, Sign } from './art/ShopArt'
import { cueText } from './data/lines'
import { adoptBalance, loadProgress, resetAll, resetBalance, saveProgress, setMode, type Balance, type ShopProgress } from './domain/progress'
import { gameSeed, seeded } from './domain/random'
import { Shop } from './game/Shop'
import { TapButton } from './game/tap'
import type { HubBridge } from './hub/bridge'
import { ParentsScreen } from './screens/Parents'

type Screen = 'front' | 'shop' | 'parents'

const params = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search)
const FAST = params.get('fast') === '1'
/** `?pace=1`: silent, but every clip takes its recorded length (the pace tests use it). */
const PACE = params.get('pace') === '1'
/** The balance on the Hub (§11.8): the first sync waits at most this long before the shop opens... */
const SYNC_START_MS = 2_500
/** ...and a change of points is pushed this long after it settles. */
const SYNC_AFTER_MS = 1_500

export default function App({ bridge }: { bridge: HubBridge }) {
  const narrator = useMemo(() => new Narrator(import.meta.env.BASE_URL, FAST, PACE), [])
  const rng = useMemo(() => seeded(gameSeed()), [])
  const [screen, setScreen] = useState<Screen>('front')
  const [progress, setProgressState] = useState<ShopProgress>(() => loadProgress())
  const [flipping, setFlipping] = useState(false)
  const setProgress = useCallback((update: (p: ShopProgress) => ShopProgress) => setProgressState(update), [])
  const progressRef = useRef(progress)
  const screenRef = useRef(screen)
  useEffect(() => {
    progressRef.current = progress
    screenRef.current = screen
  })

  // ── Her balance on the Hub (§11.8; the preview's bridge always answers null) ──
  /** An answer that came while she was in the shop: the shop takes it between two orders. */
  const pending = useRef<Balance | null>(null)
  const sync = useCallback(async () => {
    const { points, epoch } = progressRef.current
    const answer = await bridge.syncBalance(points, epoch)
    if (!answer || adoptBalance(progressRef.current, answer) === progressRef.current) return
    if (screenRef.current === 'shop') pending.current = answer
    else setProgress((p) => adoptBalance(p, answer))
  }, [bridge, setProgress])
  const takeBalance = useCallback(() => {
    const answer = pending.current
    pending.current = null
    return answer
  }, [])
  // Once at start: the shop opens after it, or after 2.5 s without it.
  const started = useRef<Promise<unknown>>(Promise.resolve())
  useEffect(() => {
    started.current = Promise.race([sync(), new Promise((resolve) => window.setTimeout(resolve, SYNC_START_MS))])
  }, [sync])
  // Out of the shop, an answer that waited for the end of an order is taken at once.
  useEffect(() => {
    const answer = screen === 'shop' ? null : takeBalance()
    if (answer) setProgress((p) => adoptBalance(p, answer))
  }, [screen, takeBalance, setProgress])
  // After any change of points (or a reset), once it has settled.
  const synced = useRef({ points: progress.points, epoch: progress.epoch })
  useEffect(() => {
    if (synced.current.points === progress.points && synced.current.epoch === progress.epoch) return
    synced.current = { points: progress.points, epoch: progress.epoch }
    const timer = window.setTimeout(() => void sync(), SYNC_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [progress.points, progress.epoch, sync])
  // Each time the page is seen again (the Admin may have reset her balance meanwhile).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [sync])
  /** A reset from the parents' page goes to the Hub at once. */
  const reset = (update: (p: ShopProgress) => ShopProgress) => {
    const next = update(progressRef.current)
    progressRef.current = next
    synced.current = { points: next.points, epoch: next.epoch }
    setProgress(() => next)
    void sync()
  }

  useEffect(() => narrator.setMuted(!progress.voice), [narrator, progress.voice])
  useEffect(() => {
    saveProgress(progress)
  }, [progress])
  useEffect(() => watchAudio(), [])
  useEffect(() => {
    if (FAST) document.documentElement.classList.add('fast')
  }, [])

  /** The sign flips to «مفتوح», the door chimes, and in we go. */
  const open = () => {
    if (flipping) return
    wakeAudio()
    setFlipping(true)
    sfx.door()
    const flip = new Promise((resolve) => window.setTimeout(resolve, FAST ? 0 : 900))
    void Promise.all([flip, started.current]).then(() => setScreen('shop'))
  }

  return (
    <NarratorContext.Provider value={narrator}>
      {screen === 'front' ? (
        <main className={`screen front ${flipping ? 'is-opening' : ''}`}>
          <Facade>
            <div className="facade-door">
              <span className="facade-door-panel" />
              <TapButton className="facade-sign" aria-label={flipping ? 'مفتوح' : 'مسكر'} onTap={open}>
                <Sign open={flipping} />
              </TapButton>
            </div>
          </Facade>
          {__QUIZ_BUILD_MODE__ === 'preview' ? <span className="preview-badge">نسخة تجريبية</span> : null}
        </main>
      ) : null}
      {screen === 'shop' ? (
        <Shop progress={progress} setProgress={setProgress} narrator={narrator} rng={rng} fast={FAST} bridge={bridge} takeBalance={takeBalance} onParents={() => setScreen('parents')} />
      ) : null}
      {screen === 'parents' ? (
        <ParentsScreen
          progress={progress}
          onBack={() => setScreen('shop')}
          onResetBalance={() => reset(resetBalance)}
          onMode={(type, mode) => setProgress((p) => setMode(p, type, mode))}
          onToggleType={(type, on) => setProgress((p) => ({ ...p, disabled: on ? p.disabled.filter((t) => t !== type) : [...new Set([...p.disabled, type])] }))}
          onVoice={(value) => setProgress((p) => ({ ...p, voice: value }))}
          onReset={() => reset(resetAll)}
        />
      ) : null}
      {screen === 'shop' && __QUIZ_BUILD_MODE__ === 'preview' ? <span className="preview-badge in-shop">نسخة تجريبية</span> : null}
      {__QUIZ_BUILD_MODE__ === 'preview' ? <Captions narrator={narrator} /> : null}
    </NarratorContext.Provider>
  )
}

/**
 * Preview builds only: while a line is not recorded yet, its text shows for a moment, so the flow
 * can be reviewed before any recording is paid for.
 */
function Captions({ narrator }: { narrator: Narrator }) {
  const [text, setText] = useState<{ value: string; key: number } | null>(null)
  useEffect(() => {
    let timer = 0
    let key = 0
    const off = narrator.onCue((id, recorded) => {
      if (recorded || FAST || PACE) return
      const value = cueText(id)
      if (!value) return
      key += 1
      setText({ value, key })
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setText(null), 2600)
    })
    return () => {
      off()
      window.clearTimeout(timer)
    }
  }, [narrator])
  if (!text) return null
  return (
    <div className="caption" aria-hidden="true" key={text.key}>
      <span className="caption-tag">لم يسجل بعد</span>
      {text.value}
    </div>
  )
}
