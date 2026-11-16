// A turn's script: narration and waits that stop the moment the turn leaves the screen.
import { JOIN_OVERLAP_MS, type Narrator } from '../audio/player'

export const CANCELLED = Symbol('cancelled')

export class Job {
  cancelled = false
  private chain: Promise<unknown> = Promise.resolve()
  /** The line being said is an instruction a count word may cut short. */
  private prompting = false
  /** Lines waiting their turn, by kind, so an answer can drop what no longer needs saying. */
  private readonly pending = new Set<{ kind: string; skipped: boolean }>()
  private current: string | null = null

  constructor(
    private readonly narrator: Narrator,
    readonly fast: boolean,
  ) {}

  cancel(): void {
    this.cancelled = true
  }

  check(): void {
    if (this.cancelled) throw CANCELLED
  }

  /** Waits `ms` (about zero with `?fast=1`), then stops if the turn is gone. */
  async wait(ms: number): Promise<void> {
    await new Promise((resolve) => window.setTimeout(resolve, this.fast ? Math.min(ms, 4) : ms))
    this.check()
  }

  /**
   * Says clips after whatever is being said now. `onStart(i)` runs as clip i starts (or at once
   * when it is not recorded), which is how highlights follow the voice.
   */
  say(clips: string[], options: { onStart?: (index: number) => void; prompt?: boolean; joined?: boolean; kind?: string; rate?: number } = {}): Promise<void> {
    const entry = { kind: options.kind ?? (options.prompt ? 'prompt' : 'line'), skipped: false }
    this.pending.add(entry)
    const run = async () => {
      this.pending.delete(entry)
      if (this.cancelled || entry.skipped) return
      this.prompting = Boolean(options.prompt)
      this.current = entry.kind
      try {
        // Joined: one flowing line («ثلاثة زائد اثنان يساوي خمسة»), no pause between the clips.
        const join = options.joined ? { gap: 0, trimEnd: JOIN_OVERLAP_MS } : {}
        const rate = options.rate ? { rate: options.rate } : {}
        await this.narrator.play(clips.map((clip, index) => ({ clip, onStart: () => options.onStart?.(index), ...join, ...rate })))
      } finally {
        this.prompting = false
        this.current = null
      }
    }
    const done = this.chain.then(run, run)
    this.chain = done.catch(() => undefined)
    return done.then(() => this.check())
  }

  /** Drops lines of these kinds that have not started yet. */
  skip(...kinds: string[]): void {
    for (const entry of this.pending) if (kinds.includes(entry.kind)) entry.skipped = true
  }

  /** Drops lines of these kinds that are waiting, and stops one being said now. */
  cut(...kinds: string[]): void {
    this.skip(...kinds)
    if (this.current !== null && kinds.includes(this.current)) this.narrator.stop()
  }

  /**
   * Her answer: the reply comes straight away. An instruction being said stops, and questions and
   * count words still waiting are dropped (she has answered them).
   */
  cutPrompt(): void {
    this.skip('prompt', 'count')
    if (this.prompting) this.narrator.stop()
  }

  /** A count word for a tap: it cuts an instruction short, then waits its turn after other counts. */
  count(clip: string, kind = 'count'): Promise<void> {
    if (this.prompting) this.narrator.stop()
    return this.say([clip], { kind }).catch(() => undefined)
  }

  /** Says clips and waits at least `ms`, so the pace holds when a clip is missing or muted. */
  async beat(clips: string[], ms: number, onStart?: (index: number) => void): Promise<void> {
    await Promise.all([this.say(clips, { onStart }), this.wait(ms)])
  }

  /** Everything queued so far has been said. */
  async drain(): Promise<void> {
    await this.chain
    this.check()
  }
}

/** Runs a script, swallowing the stop of a turn that left the screen. */
export function run(task: () => Promise<void>): void {
  task().catch((error: unknown) => {
    if (error !== CANCELLED) console.error(error)
  })
}
