import type { JsonValue } from './json.js'

export interface ClientOptions {
  baseURL: string
  secret: string
  defaultTimeoutMs: number
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: Record<string, unknown>
  query?: Record<string, unknown>
  timeoutMs?: number
  signal?: AbortSignal
}

/** Thin REST client for agentmemory (http://localhost:3111 by default). */
export class AgentMemoryClient {
  readonly baseURL: string
  private readonly secret: string
  private readonly defaultTimeoutMs: number

  constructor(opts: ClientOptions) {
    this.baseURL = opts.baseURL.replace(/\/+$/, '')
    this.secret = opts.secret
    this.defaultTimeoutMs = opts.defaultTimeoutMs
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.secret) h.Authorization = 'Bearer ' + this.secret
    return h
  }

  private signalFor(opts: RequestOptions): AbortSignal | undefined {
    const signals: AbortSignal[] = []
    const timeoutMs = opts.timeoutMs ?? this.defaultTimeoutMs
    if (timeoutMs > 0) signals.push(AbortSignal.timeout(timeoutMs))
    if (opts.signal) signals.push(opts.signal)
    if (signals.length === 0) return undefined
    if (signals.length === 1) return signals[0]
    return AbortSignal.any(signals)
  }

  async request<T = JsonValue>(path: string, opts: RequestOptions = {}): Promise<T> {
    const method = opts.method ?? 'GET'
    let url = this.baseURL + path
    if (opts.query && Object.keys(opts.query).length > 0) {
      const qs = new URLSearchParams()
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== null) qs.set(k, String(v))
      }
      url += (url.includes('?') ? '&' : '?') + qs.toString()
    }
    const init: RequestInit = { method, headers: this.headers() }
    if (method !== 'GET' && opts.body !== undefined) {
      init.body = JSON.stringify(opts.body)
    }
    const signal = this.signalFor(opts)
    if (signal) init.signal = signal

    const res = await fetch(url, init)
    if (!res.ok) {
      let detail = ''
      try { detail = (await res.text()).slice(0, 500) } catch { /* ignore */ }
      const msg = 'agentmemory ' + res.status + ' on ' + method + ' ' + path + (detail ? ': ' + detail : '')
      throw new Error(msg)
    }
    if (res.status === 204) return undefined as T
    const text = await res.text()
    if (!text) return undefined as T
    try { return JSON.parse(text) as T } catch { return text as unknown as T }
  }

  /** GET /agentmemory/livez — returns true when the server is up. */
  async health(timeoutMs = 2000): Promise<boolean> {
    try {
      await this.request('/agentmemory/livez', { timeoutMs })
      return true
    } catch {
      return false
    }
  }

  /** POST /agentmemory/session/start — register a session (returns injected context). */
  async sessionStart(payload: { sessionId: string; project: string; cwd: string; title?: string }, opts: RequestOptions = {}): Promise<{ session: unknown; context: string }> {
    return this.request('/agentmemory/session/start', { method: 'POST', body: payload as unknown as Record<string, unknown>, ...opts })
  }

  /** POST /agentmemory/session/end — close a session. */
  async sessionEnd(payload: { sessionId: string; project: string; cwd: string }, opts: RequestOptions = {}): Promise<JsonValue> {
    return this.request('/agentmemory/session/end', { method: 'POST', body: payload as unknown as Record<string, unknown>, ...opts })
  }

  /**
   * POST /agentmemory/observe — record one observation.
   * Fire-and-forget friendly: callers should .catch(() => {}) and pass a short timeout.
   */
  observe(payload: {
    hookType: string
    sessionId: string
    project: string
    cwd: string
    timestamp: string
    data?: unknown
  }, opts: RequestOptions = {}): Promise<JsonValue> {
    return this.request('/agentmemory/observe', { method: 'POST', body: payload as unknown as Record<string, unknown>, ...opts })
  }
}
