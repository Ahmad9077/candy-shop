import { useCallback, useEffect, useMemo, useState } from 'react'
import { wakeAudio, watchAudio } from './audio/context'
import { Narrator } from './audio/player'
import { NarratorContext } from './audio/NarratorContext'
import { sfx } from './audio/sfx'
import { Facade, Sign } from './art/ShopArt'
import { cueText } from './data/lines'
import { defaultProgress, loadProgress, newChallenge, saveProgress, setMode, type ShopProgress } from './domain/progress'
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

export default function App({ bridge }: { bridge: HubBridge }) {
  const narrator = useMemo(() => new Narrator(import.meta.env.BASE_URL, FAST, PACE), [])
  const rng = useMemo(() => seeded(gameSeed()), [])
  const [screen, setScreen] = useState<Screen>('front')
  const [progress, setProgressState] = useState<ShopProgress>(() => loadProgress())
  const [flipping, setFlipping] = useState(false)
  const setProgress = useCallback((update: (p: ShopProgress) => ShopProgress) => setProgressState(update), [])

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
    window.setTimeout(() => setScreen('shop'), FAST ? 0 : 900)
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
        <Shop progress={progress} setProgress={setProgress} narrator={narrator} rng={rng} fast={FAST} bridge={bridge} onParents={() => setScreen('parents')} />
      ) : null}
      {screen === 'parents' ? (
        <ParentsScreen
          progress={progress}
          onBack={() => setScreen('shop')}
          onAllOrders={(value) => setProgress((p) => ({ ...p, allOrders: value }))}
          onNewChallenge={() => setProgress((p) => newChallenge(p))}
          onMode={(type, mode) => setProgress((p) => setMode(p, type, mode))}
          onToggleType={(type, on) => setProgress((p) => ({ ...p, disabled: on ? p.disabled.filter((t) => t !== type) : [...new Set([...p.disabled, type])] }))}
          onVoice={(value) => setProgress((p) => ({ ...p, voice: value }))}
          onReset={() => setProgress((p) => ({ ...defaultProgress(), voice: p.voice }))}
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
