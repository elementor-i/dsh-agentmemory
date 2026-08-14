import { execSync } from 'node:child_process';
import { basename } from 'node:path';
/**
 * Shared helpers mirroring agentmemory's own hook scripts
 * (plugin/scripts/_project.ts and the per-hook truncation/sanitisation logic),
 * so this plugin captures observations the same way upstream does.
 */
/** Resolve the project name exactly like agentmemory's resolveProject(). */
export function resolveProject(cwd, override, env = process.env) {
    const explicit = override && override.trim() ? override : env.AGENTMEMORY_PROJECT_NAME;
    if (explicit && explicit.trim())
        return explicit.trim();
    const dir = cwd && cwd.trim() ? cwd : process.cwd();
    try {
        const top = execSync('git rev-parse --show-toplevel', {
            cwd: dir,
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 500,
        }).toString().trim();
        if (top)
            return basename(top);
    }
    catch {
        /* not a git repo — fall through */
    }
    return basename(dir);
}
/** Cap a value so a single observation can never balloon the request. */
export function truncate(value, max = 8000) {
    if (typeof value === 'string') {
        return value.length > max ? value.slice(0, max) + '\n[...truncated]' : value;
    }
    if (typeof value === 'object' && value !== null) {
        const str = JSON.stringify(value);
        if (str && str.length > max)
            return str.slice(0, max) + '...[truncated]';
        return value;
    }
    return value;
}
const SECRET_KEY = /(key|token|secret|password|authorization|credential)/i;
/** Remove obvious credential-shaped fields before recording tool arguments. */
export function redactSecrets(value, depth = 0) {
    if (depth > 6)
        return '[deep]';
    if (Array.isArray(value))
        return value.map((v) => redactSecrets(v, depth + 1));
    if (typeof value === 'object' && value !== null) {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = SECRET_KEY.test(k) ? '[redacted]' : redactSecrets(v, depth + 1);
        }
        return out;
    }
    return value;
}
/** Best-effort text extraction from a DSH message/tool result, for observation capture. */
/** Extract readable text from a content-block array ([{ type: 'text', text }, ...]). */
function extractBlocks(blocks, max) {
    const parts = [];
    for (const block of blocks) {
        const b = block;
        if (!b || typeof b !== 'object')
            continue;
        if (typeof b.text === 'string' && b.text)
            parts.push(b.text);
        else if (b.type === 'text' && typeof b.content === 'string')
            parts.push(b.content);
    }
    if (parts.length)
        return truncate(parts.join('\n'), max);
    return truncate(JSON.stringify(blocks), max);
}
/** Best-effort text extraction from a DSH message/tool result, for observation capture. */
export function extractText(value, max = 8000) {
    if (value == null)
        return '';
    if (typeof value === 'string')
        return truncate(value, max);
    if (Array.isArray(value))
        return extractBlocks(value, max);
    const o = value;
    if (o && typeof o === 'object') {
        if (Array.isArray(o.content))
            return extractBlocks(o.content, max);
        if (typeof o.text === 'string')
            return truncate(o.text, max);
        if (typeof o.content === 'string')
            return truncate(o.content, max);
        if (typeof o.message === 'string')
            return truncate(o.message, max);
        if (typeof o.error === 'string')
            return truncate(o.error, max);
        return truncate(JSON.stringify(o), max);
    }
    return truncate(String(value), max);
}
/** JSON that never throws — turns functions/cycles into '[unserializable]'. */
export function safeStringify(value, max = 8000) {
    try {
        return extractText(value, max);
    }
    catch {
        return '[unserializable]';
    }
}
/** Pull likely fields off unknown payload objects (event payloads are harness-typed). */
export function pick(obj, keys) {
    const o = obj;
    if (!o || typeof o !== 'object')
        return undefined;
    for (const k of keys) {
        const v = o[k];
        if (v !== undefined && v !== null)
            return v;
    }
    return undefined;
}
