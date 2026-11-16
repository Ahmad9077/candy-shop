import { QUIZ_ID } from '../data/lines'
import type { BuildMode, HubWindow } from './contracts'

export interface DayReport {
  day: number
  /** Orders right at the first bell. */
  firstBells: number
  customers: number
  orders: string[]
}

export function levelFor(score: number, total: number): string {
  if (score === total) return 'A+'
  return score >= total * 0.8 ? 'A' : 'Practice'
}

export class HubBridge {
  constructor(
    private readonly mode: BuildMode,
    private readonly target: HubWindow = window as unknown as HubWindow,
  ) {}

  /** One aggregate per finished day, in the Hub build only. Never throws. */
  async reportDay(report: DayReport): Promise<boolean> {
    if (this.mode !== 'production-hub' || report.customers === 0) return false
    const progress = this.target.QuizzesHubProgress
    if (!progress?.record) return false
    try {
      const result = await progress.record({
        quizId: QUIZ_ID,
        score: report.firstBells,
        total: report.customers,
        level: levelFor(report.firstBells, report.customers),
        details: { day: report.day, orders: report.orders },
      })
      return Boolean(result?.ok)
    } catch {
      return false
    }
  }
}
