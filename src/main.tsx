import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/baloo-bhaijaan-2'
import './styles/app.css'
import App from './App'
const TITLE = 'البقالة'
import { HUB_URL, bootstrapQuiz } from './hub/bootstrap'
import { HubBridge } from './hub/bridge'
import { setPlayer } from './domain/progress'

const root = document.getElementById('root')
if (!root) throw new Error('Game root element is missing.')
const mountRoot = root

document.documentElement.lang = 'ar'
document.documentElement.dir = 'rtl'
document.documentElement.dataset.buildMode = __QUIZ_BUILD_MODE__
if (__QUIZ_BUILD_MODE__ === 'preview') document.title = `${TITLE} · نسخة تجريبية`

// iPad Safari: no pinch or double-tap zoom on the game, no long-press callout.
document.addEventListener('gesturestart', (event) => event.preventDefault())
document.addEventListener('dblclick', (event) => event.preventDefault())

async function mount(): Promise<void> {
  try {
    const context = await bootstrapQuiz(__QUIZ_BUILD_MODE__)
    if (context.player) setPlayer(context.player)
    createRoot(mountRoot).render(
      <StrictMode>
        <App bridge={new HubBridge(context.mode)} />
      </StrictMode>,
    )
  } catch {
    const main = document.createElement('main')
    main.className = 'screen bootstrap-error'
    const title = document.createElement('h1')
    title.textContent = `تعذر فتح «${TITLE}»`
    const text = document.createElement('p')
    text.textContent = `الرجوع إلى صفحة الاختبارات وفتح «${TITLE}» مرة أخرى يحل المشكلة غالبا.`
    const link = document.createElement('a')
    link.className = 'big-button big-berry'
    link.href = HUB_URL
    link.textContent = 'العودة إلى الاختبارات'
    main.append(title, text, link)
    mountRoot.replaceChildren(main)
  }
}

void mount()
