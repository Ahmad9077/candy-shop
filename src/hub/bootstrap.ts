import { QUIZ_ID } from '../data/lines'
import type { BuildMode, HubWindow, QuizSource } from './contracts'

export const HUB_URL = 'https://ahmad9077.github.io/quizzes-hub/'
const HUB_ASSET_ROOT = 'https://ahmad9077.github.io/quizzes-hub'
const ACCESS_TIMEOUT_MS = 10_000

export interface BootstrapContext {
  mode: BuildMode
  source: QuizSource
  /** The signed-in child's id (Hub build only): her shop is saved under it. */
  player?: string
}

function loadScript(documentTarget: Document, src: string, quizId?: string): Promise<void> {
  const existing = documentTarget.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
  if (existing?.dataset.loaded === 'true') return Promise.resolve()

  return new Promise((resolve, reject) => {
    const script = existing ?? documentTarget.createElement('script')
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve()
    }, { once: true })
    script.addEventListener('error', () => reject(new Error(`Unable to load ${src}.`)), { once: true })
    if (!existing) {
      script.src = src
      script.async = false
      if (quizId) script.dataset.quizId = quizId
      documentTarget.head.append(script)
    }
  })
}

function withTimeout<T>(promise: Promise<T>, durationMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Hub client timed out.')), durationMs)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/**
 * Preview mode never touches the Hub. Production mode loads the shared access guard first, so an
 * unassigned or signed-out child is sent back to the Hub before the game renders, then the
 * optional progress client. (The game has no adaptive plan: its levels live on the device.)
 */
export async function bootstrapQuiz(
  mode: BuildMode,
  windowTarget: Window = window,
  documentTarget: Document = document,
): Promise<BootstrapContext> {
  if (mode === 'preview') return { mode, source: 'preview' }

  const target = windowTarget as unknown as HubWindow
  await loadScript(documentTarget, `${HUB_ASSET_ROOT}/config.js?v=4`)
  await loadScript(documentTarget, `${HUB_ASSET_ROOT}/access-guard.js?v=3`, QUIZ_ID)
  await withTimeout(target.QuizzesHubAccessReady ?? Promise.reject(new Error('Hub access client is unavailable.')), ACCESS_TIMEOUT_MS)
  await loadScript(documentTarget, `${HUB_ASSET_ROOT}/progress-client.js?v=6`, QUIZ_ID).catch(() => undefined)
  const player = await Promise.resolve(target.QuizzesHubSupabaseClient?.auth.getSession())
    .then((result) => result?.data?.session?.user?.id)
    .catch(() => undefined)

  return { mode, source: 'hub', ...(player ? { player } : {}) }
}
