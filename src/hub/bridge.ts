import { QUIZ_ID } from '../data/lines'
import type { BuildMode, HubWindow } from './contracts'

/** Five orders in a row (§11.4): how many were right at the first try, and where she stands. */
export interface BatchReport {
  firstBells: number
  orders: string[]
  points: number
  served: number
  /** The step of the count-on order: `help`, `bridge` or `compete`. */
  step: string
  /** The hidden number level of the count-on order. */
  numbers: number
}

export interface BalanceAnswer {
  points: number
  epoch: number
}

export const BATCH_TOTAL = 5

/** The record's level, as the Admin page shows it: the step of the count-on order, in words. */
const STEP_LABEL: Record<string, string> = { help: 'تدريب', bridge: 'تدريب خفيف', compete: 'منافسة' }
export function levelFor(step: string): string {
  return STEP_LABEL[step] ?? STEP_LABEL.help!
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

export class HubBridge {
  constructor(
    private readonly mode: BuildMode,
    private readonly target: HubWindow = window as unknown as HubWindow,
  ) {}

  /** One aggregate per five orders, in the Hub build only. Never throws. */
  async reportBatch(report: BatchReport): Promise<boolean> {
    if (this.mode !== 'production-hub' || report.orders.length === 0) return false
    const progress = this.target.QuizzesHubProgress
    if (!progress?.record) return false
    try {
      const result = await progress.record({
        quizId: QUIZ_ID,
        score: report.firstBells,
        total: BATCH_TOTAL,
        level: levelFor(report.step),
        details: { points: report.points, served: report.served, wrongCount: BATCH_TOTAL - report.firstBells, orders: report.orders, step: report.step, numbers: report.numbers },
      })
      return Boolean(result?.ok)
    } catch {
      return false
    }
  }

  /**
   * Her balance on the Hub (§11.8): sends what the device has and returns the server's row, which
   * keeps the larger points of the same epoch, and a newer epoch outright. Hub build only; offline,
   * not assigned, or the function not there yet: `null`, and play goes on.
   */
  async syncBalance(points: number, epoch: number): Promise<BalanceAnswer | null> {
    if (this.mode !== 'production-hub') return null
    const client = this.target.QuizzesHubSupabaseClient
    if (!client?.rpc) return null
    try {
      const { data, error } = (await client.rpc('game_balance_sync', { p_game_id: QUIZ_ID, p_points: points, p_epoch: epoch })) ?? {}
      if (error) return null
      const row = (Array.isArray(data) ? data[0] : data) as Partial<BalanceAnswer> | null | undefined
      return row && isCount(row.points) && isCount(row.epoch) ? { points: row.points, epoch: row.epoch } : null
    } catch {
      return null
    }
  }
}
