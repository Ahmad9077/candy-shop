export type BuildMode = 'preview' | 'production-hub'
export type QuizSource = 'preview' | 'hub'

export interface HubResult {
  ok?: boolean
  reason?: string
}

export interface HubAccess {
  ok?: boolean
  quizId?: string
  difficulty?: string
}

export interface HubProgressPayload {
  quizId: string
  score: number
  total: number
  level?: string
  details?: Record<string, unknown>
}

export interface HubWindow {
  QuizzesHubAccessReady?: Promise<HubAccess>
  /**
   * The Hub's signed-in client, set by the access guard: the child's id is read from it, and her
   * balance is synced through one function (§11.8).
   */
  QuizzesHubSupabaseClient?: {
    auth: { getSession(): Promise<{ data?: { session?: { user?: { id?: string } } | null } }> }
    rpc?(name: string, params: Record<string, unknown>): PromiseLike<{ data?: unknown; error?: unknown } | undefined>
  }
  QuizzesHubProgress?: {
    record(payload: HubProgressPayload): Promise<HubResult | undefined> | undefined
  }
}
