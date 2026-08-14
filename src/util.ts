import { execSync } from 'node:child_process'
import { basename } from 'node:path'

/**
 * Shared helpers mirroring agentmemory's own hook scripts
 * (plugin/scripts/_project.ts and the per-hook truncation/sanitisation logic),
 * so this plugin captures observations the same way upstream does.
 */

/** Resolve the project name exactly like agentmemory's resolveProject(). */
export function resolveProject(cwd: string | undefined, override: string | undefined, env: NodeJS.ProcessEnv = process.env): string {
  const explicit = override && override.trim() ? override : env.AGENTMEMORY_PROJECT_NAME
  if (explicit && explicit.trim()) return explicit.trim()
  const dir = cwd && cwd.trim() ? cwd : process.cwd()
  try {
    const top = execSync('git rev-parse --show-toplevel', {
      cwd: dir,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 500,
    }).toString().trim()
    if (top) return basename(top)
  } catch {
    /* not a git repo — fall through */
  }
  return basename(dir)
}

/** Cap a value so a single observation can never balloon the request. */
export function truncate(value: unknown, max = 8000): unknown {
  if (typeof value === 'string') {
    return value.length > max ? value.slice(0, max) + '\n[...truncated]' : value
  }
  if (typeof value === 'object' && value !== null) {
    const str = JSON.stringify(value)
    if (str && str.length > max) return str.slice(0, max) + '...[truncated]'
    return value
  }
  return value
}

const SECRET_KEY = /(key|token|secret|password|authorization|credential)/i

/** Remove obvious credential-shaped fields before recording tool arguments. */
export function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[deep]'
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v, depth + 1))
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEY.test(k) ? '[redacted]' : redactSecrets(v, depth + 1)
    }
    return out
  }
  return value
}

/** Best-effort text extraction from a DSH message/tool result, for observation capture. */
export function extractText(value: unknown, max = 8000): string {
  if (value == null) return ''
  if (typeof value === 'string') return truncate(value, max) as string
  if (Array.isArray(value)) {
    const parts: string[] = []
    for (const block of value) {
      const b = block as any
      if (b && typeof b === 'object' && typeof b.text === 'string') parts.push(b.text)
      else if (b && typeof b === 'object' && b.type === 'text' && typeof b.content === 'string') parts.push(b.content)
    }
    if (parts.length) return truncate(parts.join('\n'), max) as string
    return truncate(JSON.stringify(value), max) as string
  }
  const o = value as any
  if (o && typeof o === 'object') {
    if (typeof o.text === 'string') return truncate(o.text, max) as string
    if (typeof o.content === 'string') return truncate(o.content, max) as string
    if (typeof o.message === 'string') return truncate(o.message, max) as string
    if (typeof o.error === 'string') return truncate(o.error, max) as string
    return truncate(JSON.stringify(o), max) as string
  }
  return truncate(String(value), max) as string
}

/** JSON that never throws — turns functions/cycles into '[unserializable]'. */
export function safeStringify(value: unknown, max = 8000): string {
  try {
    return extractText(value, max)
  } catch {
    return '[unserializable]'
  }
}

/** Pull likely fields off unknown payload objects (event payloads are harness-typed). */
export function pick(obj: unknown, keys: string[]): unknown {
  const o = obj as any
  if (!o || typeof o !== 'object') return undefined
  for (const k of keys) {
    const v = o[k]
    if (v !== undefined && v !== null) return v
  }
  return undefined
}
