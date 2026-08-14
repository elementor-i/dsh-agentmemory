import { resolveProject, truncate, redactSecrets, extractText, pick } from './util.js';
/**
 * Subscribe to DSH's official harness events and forward them to agentmemory as
 * observations, mirroring agentmemory's own Claude Code hook scripts
 * (plugin/scripts/*.mjs). Every handler is non-blocking: HTTP is fired with a
 * short timeout and never awaited, and waterfall handlers always call next().
 */
export function subscribeHooks(ctx, client, cfg, state) {
    if (!cfg.hooks.enabled)
        return;
    // The harness event names come from packages/*/src/index.ts, but the published
    // @deepseek-ai/cordis package does not carry those declarations, so we bind
    // loosely and read payloads defensively.
    const on = ctx.on.bind(ctx);
    const fireObserve = (hookType, data) => {
        const s = state.currentSession;
        const sessionId = s?.sessionId ?? 'unknown';
        const project = s?.project ?? resolveProject(s?.cwd, cfg.projectName);
        const cwd = s?.cwd ?? process.cwd();
        client.observe({
            hookType,
            sessionId,
            project,
            cwd,
            timestamp: new Date().toISOString(),
            data: truncate(data, cfg.hooks.maxObservationBytes),
        }, { timeoutMs: cfg.observeTimeoutMs }).catch(() => { });
    };
    // ---- session lifecycle (session/created, session/disposed) ----
    on('session/created', (session) => {
        const id = String(pick(session, ['id', 'key', 'sessionId']) ?? 'ses_' + Date.now().toString(36));
        const cwd = String(pick(session, ['cwd', 'workdir', 'directory']) ?? process.cwd());
        const titleRaw = pick(session, ['title', 'summary', 'firstPrompt']);
        const title = typeof titleRaw === 'string' && titleRaw ? titleRaw.slice(0, 200) : undefined;
        const project = resolveProject(cwd, cfg.projectName);
        state.currentSession = { sessionId: id, project, cwd };
        const payload = { sessionId: id, project, cwd, ...(title ? { title } : {}) };
        if (cfg.injectContext) {
            client.sessionStart(payload, { timeoutMs: 1500 }).then((res) => {
                if (res && typeof res.context === 'string' && res.context)
                    state.injectedContext = res.context;
            }).catch(() => { });
        }
        else {
            client.sessionStart(payload, { timeoutMs: 800 }).catch(() => { });
        }
    });
    on('session/disposed', (session) => {
        const s = state.currentSession;
        const id = String(pick(session, ['id', 'key', 'sessionId']) ?? s?.sessionId ?? 'unknown');
        const project = s?.project ?? resolveProject(s?.cwd, cfg.projectName);
        const cwd = s?.cwd ?? process.cwd();
        client.sessionEnd({ sessionId: id, project, cwd }, { timeoutMs: 800 }).catch(() => { });
        if (s && s.sessionId === id)
            state.currentSession = null;
    });
    // ---- prompt capture (UserPromptSubmit equivalent) ----
    if (cfg.hooks.capturePrompts) {
        on('agent/inbox/inserted', (payload) => {
            const message = payload?.message ?? payload;
            const text = extractText(message, cfg.hooks.maxObservationBytes);
            if (text)
                fireObserve('prompt_submit', { prompt: text });
        });
    }
    // ---- tool use (PreToolUse / PostToolUse / PostToolUseFailure) ----
    if (cfg.hooks.captureToolUse) {
        const allowed = (name) => cfg.hooks.toolNameFilter.length === 0 || cfg.hooks.toolNameFilter.includes(name);
        on('tools/pre-execute', (exec, next) => {
            const name = String(exec?.name ?? '');
            if (allowed(name)) {
                const raw = exec?.arguments ?? exec?.args;
                const input = cfg.hooks.redactSecrets ? redactSecrets(raw) : raw;
                fireObserve('pre_tool_use', { tool_name: name, tool_input: input });
            }
            return next();
        });
        on('tools/result', (exec, result) => {
            const name = String(exec?.name ?? '');
            if (allowed(name)) {
                const failed = result && typeof result === 'object' && (result.error || result.ok === false);
                const raw = exec?.arguments ?? exec?.args;
                const input = cfg.hooks.redactSecrets ? redactSecrets(raw) : raw;
                const output = cfg.hooks.redactSecrets ? redactSecrets(result) : result;
                fireObserve(failed ? 'post_tool_failure' : 'post_tool_use', { tool_name: name, tool_input: input, tool_output: output });
            }
        });
    }
    // ---- subagents (SubagentStart / SubagentStop) ----
    if (cfg.hooks.captureSubagents) {
        on('subagent/start', (info) => fireObserve('subagent_start', { id: pick(info, ['id', 'agentId', 'subagentId']), label: pick(info, ['label', 'description']) }));
        on('subagent/end', (info) => fireObserve('subagent_stop', { id: pick(info, ['id', 'agentId', 'subagentId']), label: pick(info, ['label']), outcome: pick(info, ['outcome', 'status', 'result']) }));
    }
    // ---- workflow orchestration ----
    if (cfg.hooks.captureWorkflow) {
        on('workflow/start', (w) => fireObserve('workflow_start', { name: pick(w, ['name', 'id']), phases: pick(w, ['phases']) }));
        on('workflow/end', (w) => fireObserve('workflow_end', { name: pick(w, ['name', 'id']), result: pick(w, ['result']) }));
    }
    // ---- approvals (opt-in; Notification equivalent) ----
    if (cfg.hooks.captureApprovals) {
        on('approval/request', (req, next) => {
            fireObserve('approval_request', { summary: extractText(pick(req, ['question', 'request', 'message', 'summary']), 2000) });
            return next();
        });
    }
    // ---- pre-compact approximation (PreCompact equivalent) ----
    if (cfg.hooks.preCompactSnapshot) {
        on('agent/request-error', (payload, next) => {
            fireObserve('pre_compact', { provider: payload?.provider, failure: extractText(payload?.failure, 2000) });
            return next();
        });
    }
    // ---- turn completion (TaskCompleted equivalent) ----
    on('agent/turn-stopping', (payload) => {
        fireObserve('task_completed', { turn: payload?.turn });
    });
    // ---- context injection (opt-in) ----
    if (cfg.injectContext) {
        on('system-prompt/assemble', (assembly, _context, next) => {
            if (state.injectedContext) {
                try {
                    const sections = assembly?.sections;
                    if (Array.isArray(sections)) {
                        sections.push({ name: 'memory-context', order: 118, text: state.injectedContext.slice(0, cfg.injectMaxChars) });
                    }
                }
                catch {
                    /* never break prompt assembly */
                }
            }
            return next();
        });
    }
}
