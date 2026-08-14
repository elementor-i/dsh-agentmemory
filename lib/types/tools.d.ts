import type { AgentMemoryClient } from './client.js';
/** JSON-schema-ish parameter spec accepted by defineTool. */
export type ParamSpec = {
    type: 'string' | 'number';
    required: boolean;
    description: string;
};
export interface ToolDef {
    name: string;
    description: string;
    method: 'GET' | 'POST' | 'DELETE';
    path: string;
    core?: boolean;
    params: Record<string, ParamSpec>;
    pathFor?: (params: Record<string, unknown>) => string;
}
/**
 * Full agentmemory MCP surface mapped to its REST endpoints. Parameter names and
 * types are transcribed from agentmemory's generated MCP tool reference
 * (src/mcp/tools-registry.ts); the server whitelists and drops unknown fields,
 * so passing the documented set through is always safe.
 */
export declare const TOOL_DEFS: ToolDef[];
/** Build one defineTool() tool from a ToolDef. */
export declare function buildTool(client: AgentMemoryClient, def: ToolDef, timeoutMs: number): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Manual observation capture (hooks do this automatically; this is the explicit path). */
export declare function buildObserveTool(client: AgentMemoryClient, timeoutMs: number, project: string, cwd: string): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Escape hatch: call any agentmemory REST endpoint with a raw JSON body/query. */
export declare function buildHttpTool(client: AgentMemoryClient, timeoutMs: number): import("@deepseek-ai/dsh-tools").ToolDefinition;
