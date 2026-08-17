import { defineTool } from '@deepseek-ai/dsh-tools';
const s = (description, required = false) => ({ type: 'string', required, description });
const n = (description, required = false) => ({ type: 'number', required, description });
/**
 * Full agentmemory MCP surface mapped to its REST endpoints. Parameter names and
 * types are transcribed from agentmemory's generated MCP tool reference
 * (src/mcp/tools-registry.ts); the server whitelists and drops unknown fields,
 * so passing the documented set through is always safe.
 */
export const TOOL_DEFS = [
    // ---- capture ----
    { name: 'memory_save', description: 'Explicitly save an important insight, decision, or pattern to long-term memory.', method: 'POST', path: '/agentmemory/remember', core: true,
        params: { content: s('The insight, decision, or pattern to remember', true), type: s('Observation type'), concepts: s('Comma-separated concept keywords'), files: s('Comma-separated relevant file paths'), project: s('Project identifier') },
        csvArrays: ['concepts', 'files'] },
    { name: 'memory_compress_file', description: 'Compress a markdown file to reduce token usage while preserving headings, URLs, and code blocks. Creates a .original.md backup before writing.', method: 'POST', path: '/agentmemory/compress-file',
        params: { filePath: s('Path to the markdown file to compress', true) } },
    // ---- retrieve ----
    { name: 'memory_recall', description: 'Search past session observations for relevant context. Use when you need to recall what happened in previous sessions, find past decisions, or look up how a file was modified before.', method: 'POST', path: '/agentmemory/search', core: true,
        params: { query: s('Search query (keywords, file names, concepts)', true), limit: n('Max results to return (default 10)'), format: s('Result format: full, compact, or narrative (default full)'), token_budget: n('Optional token budget to trim returned results') } },
    { name: 'memory_smart_search', description: 'Hybrid semantic+keyword search with progressive disclosure.', method: 'POST', path: '/agentmemory/smart-search', core: true,
        params: { query: s('Search query', true), expandIds: s('Related ids to expand'), limit: n('Max results') } },
    { name: 'memory_file_history', description: 'Get past observations about specific files.', method: 'POST', path: '/agentmemory/file-context',
        params: { files: s('Comma-separated file paths', true), sessionId: s('Restrict to a session') },
        csvArrays: ['files'] },
    { name: 'memory_timeline', description: 'Chronological observations around an anchor point: an ISO timestamp (e.g. 2026-08-14T12:00:00Z) or a keyword present in observation titles/narratives/concepts. The server does not resolve session ids as anchors.', method: 'POST', path: '/agentmemory/timeline',
        params: { anchor: s('Anchor point (session id, timestamp, or concept)', true), project: s('Project path'), before: n('Look back N observations'), after: n('Look forward N observations') } },
    { name: 'memory_vision_search', description: 'Cross-modal image search via CLIP embeddings. Pass queryText to find screenshots matching a description, or queryImageBase64/queryImageRef to find similar images. Requires AGENTMEMORY_IMAGE_EMBEDDINGS=true.', method: 'POST', path: '/agentmemory/vision-search',
        params: { queryText: s('Natural-language description to match'), queryImageRef: s('Absolute path to a stored image to match against'), queryImageBase64: s('Base64 image to match against'), topK: n('Number of results'), sessionId: s('Restrict to a session') } },
    // ---- sessions & commits ----
    { name: 'memory_sessions', description: 'List recent sessions with their status and observation counts.', method: 'GET', path: '/agentmemory/sessions', core: true, params: {} },
    { name: 'memory_commits', description: 'List recent commits linked to agent sessions, optionally filtered by branch or repo.', method: 'GET', path: '/agentmemory/commits',
        params: { branch: s('Filter by branch'), repo: s('Filter by repository'), limit: n('Max results') } },
    { name: 'memory_commit_lookup', description: 'Look up the agent session(s) that produced a specific git commit, given its SHA. Returns the commit metadata and linked sessions.', method: 'POST', path: '/agentmemory/session/by-commit',
        params: { sha: s('Git commit SHA', true) } },
    // ---- lessons & knowledge graph ----
    { name: 'memory_lesson_save', description: 'Save a lesson learned from this session. Lessons have confidence scores that strengthen when reinforced and decay when not used. Duplicate content auto-strengthens the existing lesson.', method: 'POST', path: '/agentmemory/lessons', core: true,
        params: { content: s('The lesson learned', true), context: s('Where or why it applies'), confidence: n('Confidence 0..1'), project: s('Project path'), tags: s('Comma-separated tags') } },
    { name: 'memory_lesson_recall', description: 'Search lessons by query. Returns lessons sorted by confidence and recency. Use to check what the agent has learned before making decisions.', method: 'POST', path: '/agentmemory/lessons/search',
        params: { query: s('Search query', true), project: s('Project path'), minConfidence: n('Minimum confidence'), limit: n('Max results') } },
    { name: 'memory_lesson_delete', description: 'Soft-delete a lesson by id. Deleted lessons are excluded from recall and list; re-saving the same content creates a fresh lesson.', method: 'POST', path: '/agentmemory/lessons/delete',
        params: { lessonId: s('Lesson id', true) } },
    { name: 'memory_graph_query', description: 'Query the knowledge graph for entities and relationships.', method: 'POST', path: '/agentmemory/graph/query',
        params: { startNodeId: s('Start node id'), nodeType: s('Node type filter'), maxDepth: n('Max traversal depth'), query: s('Natural-language query') } },
    { name: 'memory_relations', description: 'Query the memory relationship graph.', method: 'POST', path: '/agentmemory/relations',
        params: { memoryId: s('Memory id', true), maxHops: n('Max relationship hops'), minConfidence: n('Minimum confidence') } },
    { name: 'memory_patterns', description: 'Detect recurring patterns across sessions.', method: 'POST', path: '/agentmemory/patterns',
        params: { project: s('Project path') } },
    { name: 'memory_crystallize', description: 'Compress completed action chains into compact crystal digests using LLM summarization. Extracts narrative, key outcomes, files affected, and lessons.', method: 'POST', path: '/agentmemory/crystals/create',
        params: { actionIds: s('Comma-separated action ids', true), project: s('Project path'), sessionId: s('Session id') },
        csvArrays: ['actionIds'] },
    // ---- structured slots ----
    { name: 'memory_slot_create', description: 'Create a new slot. Reject if a slot with the same label already exists.', method: 'POST', path: '/agentmemory/slot',
        params: { label: s('Slot label', true), content: s('Initial content'), sizeLimit: n('Max content size'), description: s('What this slot holds'), pinned: s("Pin to top ('true' or 'false')"), scope: s('global | project') },
        booleans: ['pinned'] },
    { name: 'memory_slot_get', description: 'Read a single slot by label.', method: 'GET', path: '/agentmemory/slot',
        params: { label: s('Slot label', true) } },
    { name: 'memory_slot_append', description: 'Append text to an existing slot. Fails with 413 if the append would exceed the slot sizeLimit; compact via memory_slot_replace first.', method: 'POST', path: '/agentmemory/slot/append',
        params: { label: s('Slot label', true), text: s('Text to append', true) } },
    { name: 'memory_slot_replace', description: 'Replace slot content in place. Fails if content exceeds sizeLimit.', method: 'POST', path: '/agentmemory/slot/replace',
        params: { label: s('Slot label', true), content: s('New content', true) } },
    { name: 'memory_slot_list', description: 'List all memory slots (pinned + project + global). Slots are editable, size-limited memory units the agent can read and modify across sessions.', method: 'GET', path: '/agentmemory/slots', params: {} },
    { name: 'memory_slot_delete', description: 'Delete a slot. Seeded default slots can be deleted unless marked readOnly.', method: 'DELETE', path: '/agentmemory/slot',
        params: { label: s('Slot label', true) } },
    // ---- actions & orchestration ----
    { name: 'memory_action_create', description: 'Create an actionable work item with typed dependencies. Actions track what agents need to do and how work items relate to each other.', method: 'POST', path: '/agentmemory/actions',
        params: { title: s('Action title', true), description: s('Details'), priority: n('Priority'), project: s('Project'), tags: s('Comma-separated tags'), parentId: s('Parent action id'), requires: s('Comma-separated prerequisite action ids') } },
    { name: 'memory_action_update', description: "Update an action's status, priority, or details. Set status to 'done' to complete it and unblock dependent actions.", method: 'POST', path: '/agentmemory/actions/update',
        params: { actionId: s('Action id', true), status: s('New status'), result: s('Result of completing it'), priority: n('New priority') } },
    { name: 'memory_frontier', description: 'Get all unblocked actions ranked by priority and urgency. Returns the frontier of actionable work with no unsatisfied dependencies.', method: 'GET', path: '/agentmemory/frontier',
        params: { project: s('Project path'), agentId: s('Agent id'), limit: n('Max results') } },
    { name: 'memory_next', description: 'Get the single most important next action to work on. Combines dependency resolution, priority, and recency into a score.', method: 'GET', path: '/agentmemory/next',
        params: { project: s('Project path'), agentId: s('Agent id') } },
    { name: 'memory_lease', description: 'Acquire, release, or renew an exclusive lease on an action. Prevents multiple agents from working on the same thing.', method: 'POST', path: '/agentmemory/leases/acquire',
        pathFor: (p) => p.operation === 'release' ? '/agentmemory/leases/release' : p.operation === 'renew' ? '/agentmemory/leases/renew' : '/agentmemory/leases/acquire',
        params: { actionId: s('Action id', true), agentId: s('Agent id', true), operation: s('acquire | release | renew', true), result: s('Result when releasing'), ttlMs: n('Lease time-to-live ms') } },
    { name: 'memory_checkpoint', description: 'Create or resolve an external checkpoint (CI result, approval, deploy status) that gates action progress.', method: 'POST', path: '/agentmemory/checkpoints',
        pathFor: (p) => p.operation === 'resolve' ? '/agentmemory/checkpoints/resolve' : '/agentmemory/checkpoints',
        params: { operation: s('create | resolve', true), name: s('Checkpoint name (for create)'), checkpointId: s('Checkpoint id (for resolve)'), status: s('Status'), type: s('Type'), linkedActionIds: s('Linked action ids') } },
    { name: 'memory_routine_run', description: 'Instantiate a frozen workflow routine, creating actions for each step with proper dependencies.', method: 'POST', path: '/agentmemory/routines/run',
        params: { routineId: s('Routine id', true), project: s('Project path'), initiatedBy: s('Initiator') } },
    // ---- signals, sentinels, sketches, facets, mesh ----
    { name: 'memory_signal_send', description: 'Send a message to another agent or broadcast. Supports threading, typed messages, and TTL expiration.', method: 'POST', path: '/agentmemory/signals/send',
        params: { from: s('Sender agent id', true), to: s('Recipient agent id (omit to broadcast)'), content: s('Message body', true), type: s('Message type'), replyTo: s('Thread id to reply to') } },
    { name: 'memory_signal_read', description: 'Read messages for an agent. Marks delivered messages as read.', method: 'GET', path: '/agentmemory/signals',
        params: { agentId: s('Agent id', true), unreadOnly: s('Only unread'), threadId: s('Thread id'), limit: n('Max messages') } },
    { name: 'memory_sentinel_create', description: 'Create an event-driven sentinel that watches for conditions (webhook, timer, threshold, pattern, approval) and auto-unblocks gated actions when triggered.', method: 'POST', path: '/agentmemory/sentinels',
        params: { name: s('Sentinel name', true), type: s('Sentinel type', true), config: s('JSON config (timer, threshold, pattern, webhook)'), linkedActionIds: s('Gated action ids'), expiresInMs: n('TTL') },
        csvArrays: ['linkedActionIds'], json: ['config'] },
    { name: 'memory_sentinel_trigger', description: 'Externally fire a sentinel, providing an optional result payload. Unblocks any gated actions.', method: 'POST', path: '/agentmemory/sentinels/trigger',
        params: { sentinelId: s('Sentinel id', true), result: s('Result payload') } },
    { name: 'memory_sketch_create', description: 'Create an ephemeral action graph for exploratory work. Auto-expires after TTL. Can be promoted to permanent actions or discarded.', method: 'POST', path: '/agentmemory/sketches',
        params: { title: s('Sketch title', true), description: s('Details'), expiresInMs: n('TTL'), project: s('Project path') } },
    { name: 'memory_sketch_promote', description: "Promote a sketch's ephemeral actions to permanent actions. Makes the exploratory work official.", method: 'POST', path: '/agentmemory/sketches/promote',
        params: { sketchId: s('Sketch id', true), project: s('Project path') } },
    { name: 'memory_facet_tag', description: 'Attach a structured tag (dimension:value) to an action, memory, or observation for multi-dimensional categorization.', method: 'POST', path: '/agentmemory/facets',
        params: { targetId: s('Target id', true), targetType: s('Target type', true), dimension: s('Tag dimension', true), value: s('Tag value', true) } },
    { name: 'memory_facet_query', description: 'Query targets by facet tags with AND/OR logic. Find all actions tagged priority:urgent AND team:backend.', method: 'POST', path: '/agentmemory/facets/query',
        params: { matchAll: s('Tags that must ALL match'), matchAny: s('Tags where ANY matches'), targetType: s('Target type') },
        csvArrays: ['matchAll', 'matchAny'] },
    { name: 'memory_mesh_sync', description: 'Sync memories and actions with peer agentmemory instances for multi-agent collaboration.', method: 'POST', path: '/agentmemory/mesh/sync',
        params: { peerId: s('Peer id'), direction: s('Sync direction') } },
    // ---- team, snapshots, export, profile, bridge, obsidian ----
    { name: 'memory_team_share', description: 'Share a memory or observation with team members.', method: 'POST', path: '/agentmemory/team/share',
        params: { itemId: s('Item id', true), itemType: s('Item type', true) } },
    { name: 'memory_team_feed', description: 'Get recent shared items from all team members.', method: 'GET', path: '/agentmemory/team/feed',
        params: { limit: n('Max results') } },
    { name: 'memory_snapshot_create', description: 'Create a git-versioned snapshot of current memory state.', method: 'POST', path: '/agentmemory/snapshot/create',
        params: { message: s('Snapshot message') } },
    { name: 'memory_export', description: 'Export all memory data as JSON.', method: 'GET', path: '/agentmemory/export', params: {} },
    { name: 'memory_profile', description: 'User/project profile with top concepts and file patterns.', method: 'GET', path: '/agentmemory/profile',
        params: { project: s('Project path', true), refresh: s('Force refresh') } },
    { name: 'memory_claude_bridge_sync', description: "Sync memory state to/from Claude Code's native MEMORY.md file.", method: 'POST', path: '/agentmemory/claude-bridge/sync',
        params: { direction: s('Sync direction', true) } },
    { name: 'memory_obsidian_export', description: 'Export memories, lessons, and crystals as Obsidian-compatible Markdown files with YAML frontmatter and wikilinks for graph view.', method: 'POST', path: '/agentmemory/obsidian/export',
        params: { vaultDir: s('Obsidian vault directory'), types: s('Types to export') } },
    // ---- governance & health ----
    { name: 'memory_consolidate', description: 'Run the 4-tier memory consolidation pipeline (working -> episodic -> semantic -> procedural).', method: 'POST', path: '/agentmemory/consolidate', core: true,
        params: { tier: s('Target tier') } },
    { name: 'memory_reflect', description: 'Traverse the knowledge graph, group related memories by concept clusters, and synthesize higher-order insights via LLM. Returns new and reinforced insights.', method: 'POST', path: '/agentmemory/reflect', core: true,
        params: { project: s('Project path'), maxClusters: n('Max concept clusters') } },
    { name: 'memory_diagnose', description: 'Run health checks across all subsystems (actions, leases, sentinels, sketches, signals, sessions, memories, mesh). Identifies stuck, orphaned, and inconsistent state.', method: 'POST', path: '/agentmemory/diagnostics', core: true,
        params: { categories: s('Comma-separated categories to check') },
        csvArrays: ['categories'] },
    { name: 'memory_heal', description: 'Auto-fix all fixable issues found by diagnostics. Unblocks stuck actions, expires stale leases, cleans up orphaned data.', method: 'POST', path: '/agentmemory/diagnostics/heal',
        params: { categories: s('Comma-separated categories'), dryRun: s("Set 'true' to preview without fixing") } },
    { name: 'memory_verify', description: 'Verify a memory or observation by tracing its citation chain back to source observations and session context. Returns provenance information including confidence scores.', method: 'POST', path: '/agentmemory/verify',
        params: { id: s('Memory or observation id', true) } },
    { name: 'memory_audit', description: 'View the audit trail of memory operations.', method: 'GET', path: '/agentmemory/audit',
        params: { operation: s('Filter by operation'), limit: n('Max results') } },
    { name: 'memory_governance_delete', description: 'Delete specific memories with audit trail.', method: 'DELETE', path: '/agentmemory/governance/memories',
        params: { memoryIds: s('Comma-separated memory ids', true), reason: s('Reason for deletion') },
        csvArrays: ['memoryIds'] },
    { name: 'memory_insight_list', description: 'List synthesized insights, higher-order observations derived from patterns across memories, lessons, and crystals.', method: 'GET', path: '/agentmemory/insights',
        params: { project: s('Project path'), minConfidence: n('Minimum confidence'), limit: n('Max results') } },
];
const TEXT_OUTPUT = {
    schema: { type: 'string' },
    render: (_args, value) => [{ type: 'text', text: String(value) }],
};
function pickDefined(args, params) {
    const input = (args ?? {});
    const out = {};
    for (const k of Object.keys(params)) {
        const v = input[k];
        if (v !== undefined && v !== null && v !== '')
            out[k] = v;
    }
    return out;
}
const TRUE_WORDS = new Set(['true', '1', 'yes', 'on']);
const FALSE_WORDS = new Set(['false', '0', 'no', 'off']);
function toCsvArray(v) {
    if (Array.isArray(v))
        return v.filter((x) => typeof x === 'string');
    if (typeof v === 'string')
        return v.split(',').map((p) => p.trim()).filter(Boolean);
    return [];
}
function toBoolean(v) {
    if (typeof v === 'boolean')
        return v;
    if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (TRUE_WORDS.has(s))
            return true;
        if (FALSE_WORDS.has(s))
            return false;
    }
    if (typeof v === 'number')
        return v !== 0;
    return v; // Leave as-is; the server answers with a clear 400.
}
function toJsonObject(v) {
    if (typeof v !== 'string')
        return v;
    try {
        return JSON.parse(v);
    }
    catch {
        return v; // Leave as-is; the server answers with a clear 400.
    }
}
/**
 * The server's REST layer validates array/boolean/object fields literally —
 * its MCP adapter converts comma-separated strings before calling the inner
 * functions, but the REST routes do not (e.g. mem::remember rejects a string
 * `concepts` with "concepts must be an array"). Mirror the MCP adapter's
 * conversions here so the documented comma-separated tool inputs work
 * end to end over REST.
 */
function coerceParams(cleaned, def) {
    const out = { ...cleaned };
    for (const k of def.csvArrays ?? []) {
        if (out[k] === undefined)
            continue;
        const arr = toCsvArray(out[k]);
        if (arr.length > 0)
            out[k] = arr;
        else
            delete out[k];
    }
    for (const k of def.booleans ?? []) {
        if (out[k] !== undefined)
            out[k] = toBoolean(out[k]);
    }
    for (const k of def.json ?? []) {
        if (out[k] !== undefined)
            out[k] = toJsonObject(out[k]);
    }
    return out;
}
/** Build one defineTool() tool from a ToolDef. */
export function buildTool(client, def, timeoutMs) {
    const parameters = {};
    for (const [k, p] of Object.entries(def.params)) {
        parameters[k] = p.required
            ? { type: p.type, required: true, description: p.description }
            : { type: p.type, description: p.description };
    }
    return defineTool({
        name: def.name,
        description: def.description,
        parameters,
        output: TEXT_OUTPUT,
        timeoutMs,
        isConcurrencySafe: () => true,
        execute: async (args, exec) => {
            const cleaned = pickDefined(args, def.params);
            const payload = coerceParams(cleaned, def);
            const path = def.pathFor ? def.pathFor(payload) : def.path;
            const result = def.method === 'GET'
                ? await client.request(path, { method: 'GET', query: payload, timeoutMs, signal: exec.signal })
                : await client.request(path, { method: def.method, body: payload, timeoutMs, signal: exec.signal });
            return JSON.stringify(result, null, 2);
        },
    });
}
/**
 * Manual observation capture (hooks do this automatically; this is the explicit path).
 *
 * The server's /agentmemory/observe requires non-empty hookType, sessionId,
 * project, cwd and timestamp. The tool schema only exposes the first three
 * (sessionId optional); project/cwd/timestamp are filled in here. `project`
 * and `cwd` accept a getter so they resolve per call (the harness can change
 * its working directory between sessions); an empty project would be rejected
 * by the server.
 */
export function buildObserveTool(client, timeoutMs, project, cwd, activeSessionId) {
    return defineTool({
        name: 'memory_observe',
        description: 'Record a raw observation into agentmemory with the given hook type. Automatic capture usually covers this; use for one-off annotations.',
        parameters: {
            hookType: { type: 'string', required: true, description: 'Observation kind, e.g. decision, idea, bug, note' },
            content: { type: 'string', required: true, description: 'Free-form observation content' },
            sessionId: { type: 'string', description: 'Session id (defaults to the active session)' },
        },
        output: TEXT_OUTPUT,
        timeoutMs,
        isConcurrencySafe: () => true,
        execute: async (args, exec) => {
            const a = (args ?? {});
            const explicit = typeof a.sessionId === 'string' && a.sessionId.trim() ? a.sessionId.trim() : undefined;
            const sessionId = explicit ?? activeSessionId?.() ?? 'unknown';
            const result = await client.observe({
                hookType: String(a.hookType ?? 'note'),
                sessionId,
                project: typeof project === 'function' ? project() : project,
                cwd: typeof cwd === 'function' ? cwd() : cwd,
                timestamp: new Date().toISOString(),
                data: { content: String(a.content ?? '') },
            }, { timeoutMs, signal: exec.signal });
            return JSON.stringify(result, null, 2);
        },
    });
}
/** Escape hatch: call any agentmemory REST endpoint with a raw JSON body/query. */
export function buildHttpTool(client, timeoutMs) {
    return defineTool({
        name: 'memory_http',
        description: 'Call any agentmemory REST endpoint directly. Use for endpoints without a dedicated tool. Path must start with /agentmemory/. body/query are JSON strings.',
        parameters: {
            path: { type: 'string', required: true, description: 'Endpoint path, e.g. /agentmemory/semantic' },
            method: { type: 'string', description: 'GET, POST, or DELETE (default POST)' },
            body: { type: 'string', description: 'JSON object to send as the request body' },
            query: { type: 'string', description: 'JSON object to send as query-string parameters' },
        },
        output: TEXT_OUTPUT,
        timeoutMs,
        isConcurrencySafe: () => true,
        execute: async (args, exec) => {
            const a = (args ?? {});
            const path = String(a.path ?? '');
            if (!path.startsWith('/agentmemory/'))
                throw new Error("memory_http: path must start with /agentmemory/");
            const method = (typeof a.method === 'string' && a.method.toUpperCase()) || 'POST';
            if (method !== 'GET' && method !== 'POST' && method !== 'DELETE')
                throw new Error('memory_http: method must be GET, POST, or DELETE');
            let body;
            let query;
            if (typeof a.body === 'string' && a.body.trim())
                body = JSON.parse(a.body);
            if (typeof a.query === 'string' && a.query.trim())
                query = JSON.parse(a.query);
            const result = method === 'GET'
                ? await client.request(path, { method: 'GET', query, timeoutMs, signal: exec.signal })
                : await client.request(path, { method: method, body, timeoutMs, signal: exec.signal });
            return JSON.stringify(result, null, 2);
        },
    });
}
