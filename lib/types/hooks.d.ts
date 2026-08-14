import type { Context as CordisContext } from '@deepseek-ai/cordis';
import type { AgentMemoryClient } from './client.js';
/** Fully-resolved runtime configuration (defaults + env applied). */
export interface ResolvedConfig {
    baseURL: string;
    secret: string;
    timeoutMs: number;
    observeTimeoutMs: number;
    registerTools: boolean;
    coreToolsOnly: boolean;
    dangerousTools: boolean;
    projectName: string;
    injectContext: boolean;
    injectMaxChars: number;
    healthCheck: boolean;
    hooks: {
        enabled: boolean;
        capturePrompts: boolean;
        captureToolUse: boolean;
        toolNameFilter: string[];
        captureSubagents: boolean;
        captureWorkflow: boolean;
        captureApprovals: boolean;
        preCompactSnapshot: boolean;
        maxObservationBytes: number;
        redactSecrets: boolean;
    };
}
export interface SessionInfo {
    sessionId: string;
    project: string;
    cwd: string;
}
export interface HookState {
    /** All known sessions, keyed by session id (project/cwd lookup). */
    sessions: Map<string, SessionInfo>;
    /** Last-seen session id, used only as a fallback when an event carries no agent/session. */
    lastSessionId: string | null;
    injectedContext: string;
}
/**
 * Subscribe to DSH's official harness events and forward them to agentmemory as
 * observations, mirroring agentmemory's own Claude Code hook scripts
 * (plugin/scripts/*.mjs). Every handler is non-blocking: HTTP is fired with a
 * short timeout and never awaited, and waterfall handlers always call next().
 *
 * Session attribution: the harness delivers the owning agent/session on each
 * event payload (exec.agent.session, payload.agent, session). We resolve the
 * session from that payload rather than a single mutable variable, so concurrent
 * sessions (main + subagents + panels) each land their observations in the
 * correct session.
 */
export declare function subscribeHooks(ctx: CordisContext, client: AgentMemoryClient, cfg: ResolvedConfig, state: HookState): void;
