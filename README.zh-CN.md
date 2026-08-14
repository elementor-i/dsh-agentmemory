<div align="center">

# dsh-agentmemory

**DeepSeek Harness 的 agentmemory 集成** —— 完整的 `memory_*` 工具集、自动捕获 hooks、可选的上下文注入，全部通过本地 REST 服务完成。

[English](./README.md) · [中文](./README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![CI](https://github.com/elementor-i/dsh-agentmemory/actions/workflows/ci.yml/badge.svg)](https://github.com/elementor-i/dsh-agentmemory/actions/workflows/ci.yml)
[![dsh](https://img.shields.io/badge/dsh-%3E%3D0.0.1-orange)](https://github.com/deepseek-ai/deepseek-harness)

</div>

dsh-agentmemory 把 [agentmemory](https://github.com/rohitg00/agentmemory)（面向编码 agent 的本地记忆服务器）桥接进 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）。它是原生 Cordis 插件，不是 MCP 壳：直接走 REST、订阅 harness 事件自动捕获 observation、并可选地把召回到的上下文注回系统提示词。

## 特性

- **完整工具面** —— 全部 54 个 `memory_*` 工具（8 个 core）映射到 `/agentmemory/*`，外加 `memory_observe` 和任意端点的 `memory_http` 逃生舱。
- **自动捕获 hooks** —— 订阅 DSH 官方事件，还原 agentmemory 的 Claude Code 钩子：会话、提示词、工具调用、子代理、工作流、审批。
- **上下文注入** —— 可选；会话开始时召回上下文并注入系统提示词。
- **默认安全** —— 密钥脱敏、逐调用超时、非阻塞 fire-and-forget 观察、破坏性工具用开关门控。
- **无需 MCP** —— 没有 stdio 桥、没有子进程；唯一依赖是运行中的 REST 服务（`localhost:3111`）。

## 前置条件

本机运行着 agentmemory 服务（默认 `http://127.0.0.1:3111`，viewer 在 `3113`）：

```bash
curl -fsS http://127.0.0.1:3111/agentmemory/livez
# {"service":"agentmemory","status":"ok",...}
```

插件把服务当作外部进程：启动时做健康检查，不可达只告警、绝不拖垮 harness。

## 快速开始

```bash
git clone https://github.com/elementor-i/dsh-agentmemory ~/dsh-plugins/dsh-agentmemory
cd ~/dsh-plugins/dsh-agentmemory
npm install --legacy-peer-deps   # 类型来自已发布的 @deepseek-ai SDK 包
npm run build                   # tsc -> lib/（已入库，改源码后需重新构建）
```

然后挂载（见安装）并重启 DSH。

## 安装

### 原生挂载（默认）

往用户 overlay 里加一段 `insert` patch —— `~/.dsh/config.yaml`，或整机生效的 `$DSH_HOME/cordis.patch.yml`：

```yaml
- insert:
    - id: dsh-agentmemory
      name: '$HOME/dsh-plugins/dsh-agentmemory/lib/index.js'
```

### 插件管理器

发布到市场后，从插件管理器安装：

```bash
dshx install dsh-agentmemory https://github.com/elementor-i/dsh-agentmemory
```

或在 Oh-DSH-Desktop 插件管理器中搜索 `dsh-agentmemory` 安装。

本地检出安装：

```bash
dsh registry install ~/dsh-plugins/dsh-agentmemory && dsh registry enable dsh-agentmemory
```

## 配置

所有键都可选、有安全默认值。环境变量回退与 agentmemory 自身的 hooks 一致（`AGENTMEMORY_URL`、`AGENTMEMORY_SECRET`、`AGENTMEMORY_PROJECT_NAME`）。

```yaml
dsh-agentmemory:
  baseURL: http://127.0.0.1:3111   # 留空 -> $AGENTMEMORY_URL -> 默认值
  secret: ""                       # 留空 -> $AGENTMEMORY_SECRET（Bearer）
  timeoutMs: 10000
  observeTimeoutMs: 3000           # hooks 观察的 fire-and-forget 超时
  registerTools: true
  coreToolsOnly: false             # true -> 只注册 8 个 core 工具
  dangerousTools: false            # true -> 暴露破坏性/昂贵工具
  projectName: ""                  # 留空 -> $AGENTMEMORY_PROJECT_NAME -> git 仓库 basename
  injectContext: false             # 把召回上下文注入系统提示词
  injectMaxChars: 4000
  healthCheck: true
  hooks:
    enabled: true
    capturePrompts: true
    captureToolUse: true
    toolNameFilter: []             # 非空则只捕获这些工具名
    captureSubagents: true
    captureWorkflow: true
    captureApprovals: false
    preCompactSnapshot: false      # 近似 PreCompact：request-error 时快照
    maxObservationBytes: 8000
    redactSecrets: true
```

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `baseURL` | `http://127.0.0.1:3111` | agentmemory REST 基地址 |
| `secret` | `""` | Bearer 密钥（回退到 `AGENTMEMORY_SECRET`） |
| `timeoutMs` | `10000` | 单个工具的 HTTP 超时 |
| `observeTimeoutMs` | `3000` | hooks 观察超时（fire-and-forget） |
| `registerTools` | `true` | 是否注册 `memory_*` 工具集 |
| `coreToolsOnly` | `false` | 只注册 8 个 core 工具 |
| `dangerousTools` | `false` | 暴露 `governance_delete`、`heal`、`consolidate`、`reflect`、`crystallize` |
| `injectContext` | `false` | 是否把召回上下文注入系统提示词 |
| `healthCheck` | `true` | 启动时服务不可达则告警 |

## Hooks

通过订阅 DSH 官方事件还原 agentmemory 的 Claude Code 钩子。所有 handler 非阻塞：HTTP 短超时、永不 await；waterfall 事件一律调用 `next()`。

| agentmemory 钩子 | DSH 事件 | 模式 |
| --- | --- | --- |
| SessionStart | `session/created` | emit |
| UserPromptSubmit | `agent/inbox/inserted` | emit |
| PreToolUse | `tools/pre-execute` | waterfall |
| PostToolUse / PostToolUseFailure | `tools/result` | emit |
| PreCompact（近似） | `agent/request-error` | waterfall |
| SubagentStart / SubagentStop | `subagent/start` / `subagent/end` | emit |
| Notification | `approval/request` | waterfall |
| TaskCompleted | `agent/turn-stopping` | serial |
| SessionEnd | `session/disposed` → `/session/end` | emit |
| （上下文注入） | `system-prompt/assemble` | waterfall |

## 工具

core 集合（默认注册，`coreToolsOnly` 时仅注册这些）：

`memory_save` · `memory_recall` · `memory_smart_search` · `memory_sessions` · `memory_lesson_save` · `memory_consolidate` · `memory_reflect` · `memory_diagnose`

其余 46 个：`memory_commits` · `memory_commit_lookup` · `memory_compress_file` · `memory_file_history` · `memory_timeline` · `memory_vision_search` · `memory_lesson_recall` · `memory_lesson_delete` · `memory_graph_query` · `memory_relations` · `memory_patterns` · `memory_profile` · `memory_audit` · `memory_verify` · `memory_heal` · `memory_crystallize` · `memory_governance_delete` · `memory_slot_create` · `memory_slot_get` · `memory_slot_append` · `memory_slot_replace` · `memory_slot_list` · `memory_slot_delete` · `memory_action_create` · `memory_action_update` · `memory_frontier` · `memory_next` · `memory_lease` · `memory_checkpoint` · `memory_routine_run` · `memory_signal_send` · `memory_signal_read` · `memory_sentinel_create` · `memory_sentinel_trigger` · `memory_sketch_create` · `memory_sketch_promote` · `memory_facet_tag` · `memory_facet_query` · `memory_mesh_sync` · `memory_team_share` · `memory_team_feed` · `memory_snapshot_create` · `memory_export` · `memory_claude_bridge_sync` · `memory_obsidian_export` · `memory_insight_list`

额外：

- `memory_observe` —— 手动记录一条 observation（hooks 已自动完成）。
- `memory_http` —— 用 JSON body/query 调用任意 `/agentmemory/*` 端点（未映射端点的逃生舱）。

## 工作原理

```text
DSH 事件 ──ctx.on──▶ hooks.ts ──fire-and-forget──▶ /agentmemory/observe
                                                          │
模型 ──memory_* 工具──▶ tools.ts ──REST──▶ /agentmemory/*  (3111)
                                                          │
session/created ──▶ /session/start ──▶ context ──▶ system-prompt/assemble（可选）
```

`client.ts` 是薄 REST 客户端（Bearer 认证、超时、JSON）；`tools.ts` 是数据驱动的「工具 → 端点」映射表；`hooks.ts` 订阅 harness 事件并转发 observation；`util.ts` 复刻 agentmemory 自身的 project 解析、截断与密钥脱敏。

## 兼容性

工具表与端点映射转写自 agentmemory 的生成物（`src/mcp/tools-registry.ts`、`src/triggers/api.ts`）。本地 server 版本可能与仓库 `main` 有差异：

- 某些功能默认关闭（例如 `/slots` 返回 503 并附带开启提示）；
- 较新端点可能尚未实现。

遇到 4xx/5xx 时，按响应体里的提示启用对应功能，或对齐 server 版本。`memory_http` 可绕过未映射端点。

## 开发

```bash
npm install --legacy-peer-deps   # 类型来自 @deepseek-ai/dsh-tools 等
npm run typecheck
npm run build                   # tsc -> lib/
npm test                        # 对运行中的 server 做只读连通测试
```

`inject = ['tools', 'systemPrompt']`。`apply(ctx, config)` 注册工具、订阅 hooks、贡献系统提示词段。事件名来自 DSH 官方事件矩阵（`docs/event-producer-consumer.md`），payload 一律防御式读取。

## License

[MIT](./LICENSE) © 2026 Element

## 致谢

- [agentmemory](https://github.com/rohitg00/agentmemory) —— 本插件所对接的记忆服务器。
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) —— 宿主及其官方事件矩阵。
