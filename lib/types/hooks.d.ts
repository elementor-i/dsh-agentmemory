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
export interface HookState {
    currentSession: {
        sessionId: string;
        project: string;
        cwd: string;
    } | null;
    injectedContext: string;
}
/**
 * Subscribe to DSH's official harness events and forward them to agentmemory as
 * observations, mirroring agentmemory's own Claude Code hook scripts
 * (plugin/scripts/*.mjs). Every handler is non-blocking: HTTP is fired with a
 * short timeout and never awaited, and waterfall handlers always call next().
 */
export declare function subscribeHooks(ctx: CordisContext, client: AgentMemoryClient, cfg: ResolvedConfig, state: HookState): void;
