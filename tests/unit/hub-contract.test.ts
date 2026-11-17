import fs from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { bootstrapQuiz } from '../../src/hub/bootstrap'
import { HubBridge, levelFor } from '../../src/hub/bridge'
import type { HubWindow } from '../../src/hub/contracts'

const report = { firstBells: 4, orders: ['C', 'C', 'C', 'C', 'C'], points: 36, served: 25, step: 'bridge', numbers: 2 }
const client = (rpc: (name: string, params: Record<string, unknown>) => Promise<{ data?: unknown; error?: unknown }>) =>
  ({ QuizzesHubSupabaseClient: { auth: { getSession: () => Promise.resolve({}) }, rpc } }) as HubWindow

describe('hub contract', () => {
  it('does not touch the Hub in preview mode', async () => {
    expect(await bootstrapQuiz('preview', {} as Window, {} as Document)).toEqual({ mode: 'preview', source: 'preview' })
    const record = vi.fn()
    const rpc = vi.fn()
    const bridge = new HubBridge('preview', { QuizzesHubProgress: { record }, ...client(rpc) } as HubWindow)
    expect(await bridge.reportBatch(report)).toBe(false)
    expect(await bridge.syncBalance(10, 0)).toBeNull()
    expect(record).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('reports one aggregate per five orders in the Hub build (§11.4)', async () => {
    const record = vi.fn().mockResolvedValue({ ok: true })
    const bridge = new HubBridge('production-hub', { QuizzesHubProgress: { record } })
    expect(await bridge.reportBatch(report)).toBe(true)
    expect(record).toHaveBeenCalledTimes(1)
    expect(record.mock.calls[0]![0]).toEqual({
      quizId: 'candy-shop',
      score: 4,
      total: 5,
      level: 'تدريب خفيف',
      details: { points: 36, served: 25, wrongCount: 1, orders: ['C', 'C', 'C', 'C', 'C'], step: 'bridge', numbers: 2 },
    })
  })

  it('never throws when the progress client fails', async () => {
    const record = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await new HubBridge('production-hub', { QuizzesHubProgress: { record } }).reportBatch(report)).toBe(false)
    expect(await new HubBridge('production-hub', {}).reportBatch(report)).toBe(false)
  })

  it('syncs the balance through game_balance_sync and reads its one row (§11.8)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ points: 12, epoch: 3 }], error: null })
    const bridge = new HubBridge('production-hub', client(rpc))
    expect(await bridge.syncBalance(10, 2)).toEqual({ points: 12, epoch: 3 })
    expect(rpc).toHaveBeenCalledWith('game_balance_sync', { p_game_id: 'candy-shop', p_points: 10, p_epoch: 2 })
    // A single object is read too.
    expect(await new HubBridge('production-hub', client(vi.fn().mockResolvedValue({ data: { points: 4, epoch: 0 } }))).syncBalance(4, 0)).toEqual({ points: 4, epoch: 0 })
  })

  it('a failed sync is harmless: offline, an error, a missing function, a strange answer', async () => {
    const answers = [vi.fn().mockRejectedValue(new Error('offline')), vi.fn().mockResolvedValue({ data: null, error: { message: 'function does not exist' } }), vi.fn().mockResolvedValue({ data: [{ points: 'x' }] }), vi.fn().mockResolvedValue(undefined)]
    for (const rpc of answers) expect(await new HubBridge('production-hub', client(rpc)).syncBalance(10, 0)).toBeNull()
    expect(await new HubBridge('production-hub', {}).syncBalance(10, 0)).toBeNull()
  })

  it('labels the record with the step of the count-on order, in the words the Admin shows', () => {
    expect(levelFor('help')).toBe('تدريب')
    expect(levelFor('bridge')).toBe('تدريب خفيف')
    expect(levelFor('compete')).toBe('منافسة')
    expect(levelFor('unknown')).toBe('تدريب')
  })

  it('builds the Hub version under /candy-shop/', () => {
    expect(fs.readFileSync('vite.config.ts', 'utf8')).toContain("'/candy-shop/'")
  })
})
