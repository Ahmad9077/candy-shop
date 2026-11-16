import fs from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { bootstrapQuiz } from '../../src/hub/bootstrap'
import { HubBridge, levelFor } from '../../src/hub/bridge'
import type { HubWindow } from '../../src/hub/contracts'

const report = { day: 3, firstBells: 4, customers: 5, orders: ['A', 'C', 'A', 'C', 'C'] }

describe('hub contract', () => {
  it('does not touch the Hub in preview mode', async () => {
    expect(await bootstrapQuiz('preview', {} as Window, {} as Document)).toEqual({ mode: 'preview', source: 'preview' })
    const record = vi.fn()
    const bridge = new HubBridge('preview', { QuizzesHubProgress: { record } } as HubWindow)
    expect(await bridge.reportDay(report)).toBe(false)
    expect(record).not.toHaveBeenCalled()
  })

  it('reports one aggregate per day in the Hub build', async () => {
    const record = vi.fn().mockResolvedValue({ ok: true })
    const bridge = new HubBridge('production-hub', { QuizzesHubProgress: { record } })
    expect(await bridge.reportDay(report)).toBe(true)
    expect(record).toHaveBeenCalledTimes(1)
    expect(record.mock.calls[0]![0]).toEqual({ quizId: 'candy-shop', score: 4, total: 5, level: 'A', details: { day: 3, orders: ['A', 'C', 'A', 'C', 'C'] } })
  })

  it('never throws when the progress client fails', async () => {
    const record = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await new HubBridge('production-hub', { QuizzesHubProgress: { record } }).reportDay(report)).toBe(false)
    expect(await new HubBridge('production-hub', {}).reportDay(report)).toBe(false)
  })

  it('grades like the other Hub quizzes', () => {
    expect(levelFor(5, 5)).toBe('A+')
    expect(levelFor(4, 5)).toBe('A')
    expect(levelFor(3, 5)).toBe('Practice')
  })

  it('builds the Hub version under /candy-shop/', () => {
    expect(fs.readFileSync('vite.config.ts', 'utf8')).toContain("'/candy-shop/'")
  })
})
