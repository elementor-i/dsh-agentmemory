import z from '@deepseek-ai/schemastery';
import { AgentMemoryClient } from './client.js';
import { TOOL_DEFS, buildTool, buildObserveTool, buildHttpTool } from './tools.js';
import { subscribeHooks } from './hooks.js';
export const name = 'dsh-agentmemory';
export const inject = ['tools', 'systemPrompt'];
export const Config = z.object({
    baseURL: z.string().default('').description('agentmemory REST base URL. Empty falls back to $AGENTMEMORY_URL, then http://127.0.0.1:3111'),
    secret: z.string().role('secret').default('').description('Bearer secret; empty falls back to $AGENTMEMORY_SECRET. Localhost is open without one.'),
    timeoutMs: z.number().step(1).min(1000).max(300000).default(10000).description('Per-tool HTTP timeout in ms'),
    observeTimeoutMs: z.number().step(1).min(100).max(60000).default(3000).description('Hook observation HTTP timeout in ms (fire-and-forget)'),
    registerTools: z.boolean().default(true).description('Register the memory_* tool set'),
    coreToolsOnly: z.boolean().default(false).description('Register only the 8 core memory tools'),
    dangerousTools: z.boolean().default(false).description('Expose destructive/expensive tools (governance_delete, heal, consolidate, reflect, crystallize)'),
    projectName: z.string().default('').description('Override the project name; empty falls back to $AGENTMEMORY_PROJECT_NAME, then the git repo basename'),
    injectContext: z.boolean().default(false).description('Inject session-start context into the system prompt (opt-in; uses tokens)'),
    injectMaxChars: z.number().step(1).min(0).max(100000).default(4000).description('Max chars of injected context'),
    healthCheck: z.boolean().default(true).description('Warn on startup if the server is unreachable'),
    hooks: z.object({
        enabled: z.boolean().default(true).description('Master switch for automatic observation capture'),
        capturePrompts: z.boolean().default(true),
        captureToolUse: z.boolean().default(true),
        toolNameFilter: z.array(z.string()).default([]).description('Restrict tool-use capture to these tool names (empty = all)'),
        captureSubagents: z.boolean().default(true),
        captureWorkflow: z.boolean().default(true),
        captureApprovals: z.boolean().default(false),
        preCompactSnapshot: z.boolean().default(false).description('Approximate PreCompact: snapshot on request-error (context-overflow signals)'),
        maxObservationBytes: z.number().step(1).min(100).max(100000).default(8000),
        redactSecrets: z.boolean().default(true).description('Strip credential-shaped fields from recorded tool input/output'),
    }),
});
/** Tools that mutate shared state or spend LLM tokens; gated behind dangerousTools. */
const DANGEROUS = new Set(['memory_governance_delete', 'memory_heal', 'memory_consolidate', 'memory_reflect', 'memory_crystallize']);
const PROMPT_TEXT = [
    '## Memory (agentmemory)',
    'Automatic capture records sessions, prompts, tool use, and subagent activity in the background — you do not need to save routine work.',
    'Use memory_save to keep an important insight, decision, or lesson; use memory_smart_search or memory_recall to retrieve past observations before re-deriving them; use memory_sessions for session history.',
    'Prefer the narrowest tool for the task and pass only documented fields.',
].join('\n');
function resolve(config) {
    const env = process.env;
    return {
        baseURL: (config.baseURL || env.AGENTMEMORY_URL || 'http://127.0.0.1:3111').replace(/\/+$/, ''),
        secret: config.secret ?? env.AGENTMEMORY_SECRET ?? '',
        timeoutMs: config.timeoutMs ?? 10000,
        observeTimeoutMs: config.observeTimeoutMs ?? 3000,
        registerTools: config.registerTools !== false,
        coreToolsOnly: config.coreToolsOnly === true,
        dangerousTools: config.dangerousTools === true,
        projectName: config.projectName ?? env.AGENTMEMORY_PROJECT_NAME ?? '',
        injectContext: config.injectContext === true,
        injectMaxChars: config.injectMaxChars ?? 4000,
        healthCheck: config.healthCheck !== false,
        hooks: {
            enabled: config.hooks?.enabled !== false,
            capturePrompts: config.hooks?.capturePrompts !== false,
            captureToolUse: config.hooks?.captureToolUse !== false,
            toolNameFilter: config.hooks?.toolNameFilter ?? [],
            captureSubagents: config.hooks?.captureSubagents !== false,
            captureWorkflow: config.hooks?.captureWorkflow !== false,
            captureApprovals: config.hooks?.captureApprovals === true,
            preCompactSnapshot: config.hooks?.preCompactSnapshot === true,
            maxObservationBytes: config.hooks?.maxObservationBytes ?? 8000,
            redactSecrets: config.hooks?.redactSecrets !== false,
        },
    };
}
export function apply(ctx, config) {
    const resolved = resolve(config);
    const client = new AgentMemoryClient({ baseURL: resolved.baseURL, secret: resolved.secret, defaultTimeoutMs: resolved.timeoutMs });
    const state = { sessions: new Map(), lastSessionId: null, injectedContext: '' };
    if (resolved.registerTools) {
        for (const def of TOOL_DEFS) {
            if (resolved.coreToolsOnly && !def.core)
                continue;
            if (!resolved.dangerousTools && DANGEROUS.has(def.name))
                continue;
            ctx.effect(() => ctx.tools.register(buildTool(client, def, resolved.timeoutMs)));
        }
        ctx.effect(() => ctx.tools.register(buildObserveTool(client, resolved.timeoutMs, resolved.projectName, process.cwd())));
        ctx.effect(() => ctx.tools.register(buildHttpTool(client, resolved.timeoutMs)));
    }
    ctx.effect(() => ctx.systemPrompt.section({ name: 'tool:dsh-agentmemory', order: 117, text: PROMPT_TEXT }));
    subscribeHooks(ctx, client, resolved, state);
    if (resolved.healthCheck) {
        client.health(2500).then((ok) => {
            if (!ok && ctx.logger?.warn) {
                ctx.logger.warn('[dsh-agentmemory] agentmemory server unreachable at ' + resolved.baseURL + ' — tools will fail until it is running');
            }
        }).catch(() => { });
    }
}
