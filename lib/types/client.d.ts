import type { JsonValue } from './json.js';
export interface ClientOptions {
    baseURL: string;
    secret: string;
    defaultTimeoutMs: number;
}
export interface RequestOptions {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    timeoutMs?: number;
    signal?: AbortSignal;
}
/** Thin REST client for agentmemory (http://localhost:3111 by default). */
export declare class AgentMemoryClient {
    readonly baseURL: string;
    private readonly secret;
    private readonly defaultTimeoutMs;
    constructor(opts: ClientOptions);
    private headers;
    private signalFor;
    request<T = JsonValue>(path: string, opts?: RequestOptions): Promise<T>;
    /** GET /agentmemory/livez — returns true when the server is up. */
    health(timeoutMs?: number): Promise<boolean>;
    /** POST /agentmemory/session/start — register a session (returns injected context). */
    sessionStart(payload: {
        sessionId: string;
        project: string;
        cwd: string;
        title?: string;
    }, opts?: RequestOptions): Promise<{
        session: unknown;
        context: string;
    }>;
    /** POST /agentmemory/session/end — close a session. */
    sessionEnd(payload: {
        sessionId: string;
        project: string;
        cwd: string;
    }, opts?: RequestOptions): Promise<JsonValue>;
    /**
     * POST /agentmemory/observe — record one observation.
     * Fire-and-forget friendly: callers should .catch(() => {}) and pass a short timeout.
     */
    observe(payload: {
        hookType: string;
        sessionId: string;
        project: string;
        cwd: string;
        timestamp: string;
        data?: unknown;
    }, opts?: RequestOptions): Promise<JsonValue>;
}
