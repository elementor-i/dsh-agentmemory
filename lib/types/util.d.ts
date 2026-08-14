/**
 * Shared helpers mirroring agentmemory's own hook scripts
 * (plugin/scripts/_project.ts and the per-hook truncation/sanitisation logic),
 * so this plugin captures observations the same way upstream does.
 */
/** Resolve the project name exactly like agentmemory's resolveProject(). */
export declare function resolveProject(cwd: string | undefined, override: string | undefined, env?: NodeJS.ProcessEnv): string;
/** Cap a value so a single observation can never balloon the request. */
export declare function truncate(value: unknown, max?: number): unknown;
/** Remove obvious credential-shaped fields before recording tool arguments. */
export declare function redactSecrets(value: unknown, depth?: number): unknown;
/** Best-effort text extraction from a DSH message/tool result, for observation capture. */
export declare function extractText(value: unknown, max?: number): string;
/** JSON that never throws — turns functions/cycles into '[unserializable]'. */
export declare function safeStringify(value: unknown, max?: number): string;
/** Pull likely fields off unknown payload objects (event payloads are harness-typed). */
export declare function pick(obj: unknown, keys: string[]): unknown;
