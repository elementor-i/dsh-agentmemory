import type { Context as CordisContext } from '@deepseek-ai/cordis';
import type SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import type ToolRuntime from '@deepseek-ai/dsh-tools';
import z from '@deepseek-ai/schemastery';
type Context = CordisContext & {
    tools: ToolRuntime;
    systemPrompt: SystemPrompt;
    logger?: {
        warn?: (msg: string) => void;
    };
};
export declare const name = "dsh-agentmemory";
export declare const inject: string[];
export interface HooksConfig {
    enabled?: boolean;
    capturePrompts?: boolean;
    captureToolUse?: boolean;
    toolNameFilter?: string[];
    captureSubagents?: boolean;
    captureWorkflow?: boolean;
    captureApprovals?: boolean;
    preCompactSnapshot?: boolean;
    maxObservationBytes?: number;
    redactSecrets?: boolean;
}
export interface Config {
    baseURL?: string;
    secret?: string;
    timeoutMs?: number;
    observeTimeoutMs?: number;
    registerTools?: boolean;
    coreToolsOnly?: boolean;
    dangerousTools?: boolean;
    projectName?: string;
    injectContext?: boolean;
    injectMaxChars?: number;
    healthCheck?: boolean;
    hooks?: HooksConfig;
}
export declare const Config: z<Config>;
export declare function apply(ctx: Context, config: Config): void;
export {};
