import manifest from '../../public/audio/manifest.json'
import { audioCues } from '../data/lines'
import { audioContext, onAudioReset } from './context'

const AUDIO_REVISION = 'baqala-v2'
// A recorded clip that fails to download (a weak connection) is tried again before it is skipped.
const LOAD_ATTEMPTS = 3
// A clip that could not be downloaded is left alone for a while, and a cue never waits longer than
// this for its clip: with no connection the game goes on in silence instead of slowing down.
const RETRY_AFTER_MS = 20_000
const LOAD_WAIT_MS = 2_500
const CUE_GAP_MS = 120
const LOAD_CONCURRENCY = 6
// If the browser holds the sound back (no tap yet, a locked iPad), a clip still "ends" on time.
const END_GRACE_MS = 450

/**
 * Clips the generator has recorded with the text the game says now. Anything else (not recorded,
 * or recorded with an older text) resolves at once, silently.
 */
const CLIPS = (manifest as { clips: Record<string, { durationMs?: number; text?: string }> }).clips
const CURRENT = new Map(audioCues().map((cue) => [cue.id, cue.text]))
const RECORDED = new Set(Object.keys(CLIPS).filter((id) => CLIPS[id]?.text === CURRENT.get(id)))

/**
 * Every recorded clip ends with at least 80 ms of padded silence (the generator's `apad`), so a
 * joined clip may hand over to the next this much before its file ends without cutting a word.
 */
export const JOIN_OVERLAP_MS = 70


/** How long a recorded clip lasts, from the manifest (0 when it is not recorded). */
export function clipMs(clip: string): number {
  return RECORDED.has(clip) ? (CLIPS[clip]?.durationMs ?? 0) : 0
}

/** The single-file preview page carries its clips inline (base64), since it has no network. */
type InlineAudio = Record<string, string>
const inlineAudio = (): InlineAudio | undefined => (globalThis as { __CANDY_AUDIO__?: InlineAudio }).__CANDY_AUDIO__

export interface Cue {
  clip: string
  onStart?: () => void
  /** Silence before this cue, in milliseconds. */
  gap?: number
  /** Hand over to the next cue this many ms before the clip's file ends (its silent tail). */
  trimEnd?: number
  /** Playback rate: a customer's own voice (higher and quicker above 1). */
  rate?: number
}

type Listener = (speaking: boolean) => void
type CueListener = (clip: string, recorded: boolean) => void

export function isRecorded(clip: string): boolean {
  return RECORDED.has(clip)
}

/**
 * Narration through Web Audio. Clips are fetched and decoded ahead of time, so cues follow each
 * other exactly. A clip that is not recorded, a muted voice or `?fast=1` resolve straight away,
 * so a turn never waits for sound.
 */
export class Narrator {
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>()
  private readonly listeners = new Set<Listener>()
  private readonly cueListeners = new Set<CueListener>()
  private readonly queue: string[] = []
  private readonly failedAt = new Map<string, number>()
  private active = 0
  private source: AudioBufferSourceNode | null = null
  private finish: (() => void) | null = null
  private token = 0
  private muted = false

  constructor(
    private readonly baseUrl: string,
    private readonly instant = false,
    /** `?pace=1`: no sound, but every recorded clip takes its real length (for pace tests). */
    private readonly simulate = false,
  ) {
    onAudioReset(() => this.stop())
  }

  url(clip: string): string {
    return `${this.baseUrl}audio/${clip}.mp3?v=${AUDIO_REVISION}`
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Hears every cue as it starts, recorded or not (used for captions in the preview). */
  onCue(listener: CueListener): () => void {
    this.cueListeners.add(listener)
    return () => this.cueListeners.delete(listener)
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (muted) this.stop()
  }

  get silent(): boolean {
    return this.muted || this.instant
  }

  preload(clips: string[]): void {
    if (this.instant || this.simulate) return
    for (const clip of clips) {
      if (!RECORDED.has(clip) || this.buffers.has(clip) || this.queue.includes(clip)) continue
      this.queue.push(clip)
    }
    this.pump()
  }

  stop(): void {
    this.token += 1
    this.halt()
    this.emit(false)
  }

  /** Plays cues in order; a newer call or stop() cancels the rest. Resolves true when all played. */
  async play(cues: Cue[]): Promise<boolean> {
    this.token += 1
    const token = this.token
    this.halt()
    if (this.silent) {
      for (const cue of cues) {
        cue.onStart?.()
        this.announce(cue.clip)
      }
      return true
    }
    this.preload(cues.map((cue) => cue.clip))
    this.emit(true)
    for (const [index, cue] of cues.entries()) {
      if (this.simulate) {
        const recorded = RECORDED.has(cue.clip)
        const gap = recorded ? (cue.gap ?? (index > 0 ? CUE_GAP_MS : 0)) : 0
        if (gap > 0) await wait(gap)
        if (token !== this.token) return false
        cue.onStart?.()
        this.announce(cue.clip)
        if (recorded) await this.simulatePlay(Math.max(0, clipMs(cue.clip) / (cue.rate ?? 1) - (cue.trimEnd ?? 0)))
        if (token !== this.token) return false
        continue
      }
      const buffer = RECORDED.has(cue.clip) ? await Promise.race([this.load(cue.clip), wait(LOAD_WAIT_MS).then(() => null)]) : null
      if (token !== this.token) return false
      const gap = buffer ? (cue.gap ?? (index > 0 ? CUE_GAP_MS : 0)) : 0
      if (gap > 0) {
        await wait(gap)
        if (token !== this.token) return false
      }
      cue.onStart?.()
      this.announce(cue.clip)
      if (buffer) await this.playBuffer(buffer, cue.trimEnd ?? 0, cue.rate ?? 1)
      if (token !== this.token) return false
    }
    this.emit(false)
    return true
  }

  private announce(clip: string): void {
    // `?fast=1` keeps a list of what would have been said, for the tests.
    if (this.instant) ((globalThis as { __spoken?: string[] }).__spoken ??= []).push(clip)
    // `?pace=1` too, for the pace tests.
    if (this.simulate) {
      ;((globalThis as { __paceSpoken?: string[] }).__paceSpoken ??= []).push(clip)
      // When each clip started, on the page's clock (the pace tests run it as a fake clock).
      ;((globalThis as { __paceLog?: { clip: string; at: number }[] }).__paceLog ??= []).push({ clip, at: Date.now() })
    }
    const recorded = RECORDED.has(clip)
    this.cueListeners.forEach((listener) => listener(clip, recorded))
  }

  private load(clip: string): Promise<AudioBuffer | null> {
    const known = this.buffers.get(clip)
    if (known) return known
    if (this.gaveUp(clip)) return Promise.resolve(null)
    const queued = this.queue.indexOf(clip)
    if (queued >= 0) this.queue.splice(queued, 1)
    const promise = this.fetchAndDecode(clip)
    this.buffers.set(clip, promise)
    return promise
  }

  private pump(): void {
    while (this.active < LOAD_CONCURRENCY && this.queue.length > 0) {
      const clip = this.queue.shift()!
      if (this.buffers.has(clip) || this.gaveUp(clip)) continue
      this.active += 1
      const promise = this.fetchAndDecode(clip)
      this.buffers.set(clip, promise)
      void promise.finally(() => {
        this.active -= 1
        this.pump()
      })
    }
  }

  private async fetchAndDecode(clip: string): Promise<AudioBuffer | null> {
    const inline = inlineAudio()?.[clip]
    for (let attempt = 1; attempt <= LOAD_ATTEMPTS; attempt += 1) {
      try {
        const data = inline ? fromBase64(inline) : await (await fetchOk(this.url(clip))).arrayBuffer()
        const ctx = audioContext()
        if (!ctx) return null
        return await decode(ctx, data)
      } catch {
        if (attempt < LOAD_ATTEMPTS) await wait(300 * attempt)
      }
    }
    this.buffers.delete(clip)
    this.failedAt.set(clip, Date.now())
    return null
  }

  private gaveUp(clip: string): boolean {
    const at = this.failedAt.get(clip)
    return at !== undefined && Date.now() - at < RETRY_AFTER_MS
  }

  /** `?pace=1`: a clip's length in silence, stopped like a real clip by stop() or a newer play(). */
  private simulatePlay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        window.clearTimeout(timer)
        if (this.finish === done) this.finish = null
        resolve()
      }
      const timer = window.setTimeout(done, ms)
      this.finish = done
    })
  }

  private playBuffer(buffer: AudioBuffer, trimEnd: number, rate: number): Promise<void> {
    const ctx = audioContext()
    if (!ctx) return Promise.resolve()
    if (ctx.state !== 'running') void ctx.resume().catch(() => undefined)
    return new Promise((resolve) => {
      let settled = false
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.playbackRate.value = rate
      source.connect(ctx.destination)
      const length = (buffer.duration * 1000) / rate
      const done = () => {
        if (settled) return
        settled = true
        window.clearTimeout(guard)
        if (this.source === source) {
          this.source = null
          this.finish = null
        }
        resolve()
      }
      // A suspended context never fires `ended`: the guard keeps the turn moving. A joined cue
      // hands over during its silent tail, which keeps playing underneath.
      const guard =
        trimEnd > 0 && ctx.state === 'running'
          ? window.setTimeout(done, Math.max(0, length - trimEnd))
          : window.setTimeout(done, length + END_GRACE_MS)
      source.onended = done
      this.source = source
      this.finish = done
      try {
        source.start()
      } catch {
        done()
      }
    })
  }

  private halt(): void {
    const source = this.source
    const finish = this.finish
    this.source = null
    this.finish = null
    finish?.()
    if (source) {
      try {
        source.stop()
      } catch {
        // Already stopped.
      }
    }
  }

  private emit(speaking: boolean): void {
    this.listeners.forEach((listener) => listener(speaking))
  }
}

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Missing clip ${url}`)
  return response
}

function fromBase64(text: string): ArrayBuffer {
  const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
  return bytes.buffer
}

/** Decodes a clip, giving up if its context is closed meanwhile (browsers can leave it waiting). */
function decode(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const closed = () => {
      if (ctx.state === 'closed') reject(new Error('The sound started afresh.'))
    }
    const timer = window.setTimeout(() => reject(new Error('Decoding took too long.')), 8000)
    ctx.addEventListener('statechange', closed)
    ctx
      .decodeAudioData(data)
      .then(resolve, reject)
      .finally(() => {
        window.clearTimeout(timer)
        ctx.removeEventListener('statechange', closed)
      })
  })
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
