<div align="center">

# dsh-agentmemory

**DeepSeek Harness 的 agentmemory 集成** —— 完整的 `memory_*` 工具集、自动捕获 hooks、可选的上下文注入，全部通过本地 REST 服务完成。

[English](./README.md) · [中文](./README_zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![CI](https://github.com/elementor-i/dsh-agentmemory/actions/workflows/ci.yml/badge.svg)](https://github.com/elementor-i/dsh-agentmemory/actions/workflows/ci.yml)
[![dsh](https://img.shields.io/badge/dsh-%3E%3D0.0.1-orange)](https://github.com/deepseek-ai/deepseek-harness)

</div>

dsh-agentmemory 把 [agentmemory](https://github.com/rohitg00/agentmemory)（面向编码 agent 的本地记忆服务器）接入 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）。它提供完整的 `memory_*` 工具集，自动捕获会话、提示词与工具活动的 observation，并可把召回到的上下文注回系统提示词 —— 全程走本地 REST 服务，无需 MCP 桥。

## 特性

- **完整工具面** —— 全部 54 个 `memory_*` 工具（8 个 core）映射到 `/agentmemory/*`，外加 `memory_observe` 和任意端点的 `memory_http` 逃生舱。
- **自动捕获** —— 会话、提示词、工具调用、子代理、工作流、审批活动在后台被记录为 observation。
- **上下文注入** —— 可选；会话召回的上下文会加入系统提示词。
- **默认安全** —— 密钥脱敏、逐调用超时、非阻塞观察、破坏性工具用开关门控。
- **无需 MCP** —— 没有 stdio 桥、没有子进程；唯一依赖是运行中的 REST 服务（`localhost:3111`）。

## 前置条件

本机运行着 agentmemory 服务（默认 `http://127.0.0.1:3111`，viewer 在 `3113`）：

```bash
curl -fsS http://127.0.0.1:3111/agentmemory/livez
# 健康时输出 {"service":"agentmemory","status":"ok"}
```

服务不可用时，插件会记录一条告警，`memory_*` 工具返回错误，但 harness 本身不受影响、照常运行。

## 安装

### 原生挂载

```bash
git clone https://github.com/elementor-i/dsh-agentmemory ~/dsh-plugins/dsh-agentmemory
```

往 `~/.dsh/config.yaml`（或对全部 profile 生效的 `$DSH_HOME/cordis.patch.yml`）加一段 `insert` patch：

```yaml
- insert:
    - id: dsh-agentmemory
      name: '$HOME/dsh-plugins/dsh-agentmemory/lib/index.js'
```

然后重启 DSH。编译产物已随仓库提供，无需自行构建。

### 官方 CLI

```bash
# npm 仓库（推荐）— @elementor-i/dsh-agentmemory@^0.1.1
npx -p @deepseek-ai/dsh dsh plugin --profile web add @elementor-i/dsh-agentmemory

# 或直接从源码仓库安装
npx -p @deepseek-ai/dsh dsh plugin --profile web add github:elementor-i/dsh-agentmemory
```

把 `web` 换成你的 profile 名。插件声明了 `dsh.bundle.patch`，会作为 profile layer 加载；编译产物已随仓库提供，安装时无需构建。

### 插件管理器（AI 助手代装）

Oh-DSH-Desktop 的插件管理器带隔离预览与回滚，由 AI 编码助手通过工具驱动、而非 shell 命令，所以最快的方式是直接把这句话发给助手：

> 用 Oh-DSH-Desktop 插件管理器安装 `dsh-agentmemory`：先刷新插件目录，再以隔离预览方式准备安装，我审查预览后你再应用。

助手在底层会调用这些工具：

```text
desktop_plugin_search  { query: 'dsh-agentmemory', refresh: true }   # 确认已在目录中
desktop_plugin_prepare { action: 'install', pluginId: 'dsh-agentmemory' }
desktop_plugin_apply   {}                                            # 你审查预览后应用
```

说明：

- 插件必须已出现在公开 DSH 目录中。目录每小时从带 `dsh-plugin` topic 的 GitHub 仓库重建，新发布的仓库约一小时内可见。
- `desktop_plugin_apply` 会重启 DSH 运行时——应用前请先审查隔离预览。

## 配置

所有键都可选、有安全默认值。环境变量 `AGENTMEMORY_URL`、`AGENTMEMORY_SECRET`、`AGENTMEMORY_PROJECT_NAME` 会作为回退被读取。

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

活动通过 DSH 官方事件被自动捕获。所有 handler 非阻塞：请求用短超时、永不等待；waterfall 事件一律调用 `next()`。

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
| 上下文注入 | `system-prompt/assemble` | waterfall |

## 工具

core 集合（默认注册，`coreToolsOnly` 时仅注册这些）：

`memory_save` · `memory_recall` · `memory_smart_search` · `memory_sessions` · `memory_lesson_save` · `memory_consolidate` · `memory_reflect` · `memory_diagnose`

其余 46 个：`memory_commits` · `memory_commit_lookup` · `memory_compress_file` · `memory_file_history` · `memory_timeline` · `memory_vision_search` · `memory_lesson_recall` · `memory_lesson_delete` · `memory_graph_query` · `memory_relations` · `memory_patterns` · `memory_profile` · `memory_audit` · `memory_verify` · `memory_heal` · `memory_crystallize` · `memory_governance_delete` · `memory_slot_create` · `memory_slot_get` · `memory_slot_append` · `memory_slot_replace` · `memory_slot_list` · `memory_slot_delete` · `memory_action_create` · `memory_action_update` · `memory_frontier` · `memory_next` · `memory_lease` · `memory_checkpoint` · `memory_routine_run` · `memory_signal_send` · `memory_signal_read` · `memory_sentinel_create` · `memory_sentinel_trigger` · `memory_sketch_create` · `memory_sketch_promote` · `memory_facet_tag` · `memory_facet_query` · `memory_mesh_sync` · `memory_team_share` · `memory_team_feed` · `memory_snapshot_create` · `memory_export` · `memory_claude_bridge_sync` · `memory_obsidian_export` · `memory_insight_list`

额外：

- `memory_observe` —— 手动记录一条 observation（自动捕获通常已覆盖）。
- `memory_http` —— 用 JSON body 或 query 调用任意 `/agentmemory/*` 端点（用于没有专用工具的端点）。

## 工作原理

三个部分协同工作，全程走本地 REST 服务：

- **工具** —— 每个 `memory_*` 工具对应一个 `/agentmemory/*` 端点。
- **Hooks** —— DSH 生命周期事件被转发到服务端记录为 observation。
- **注入** —— 会话开始时服务端返回召回上下文，开启 `injectContext` 后会被加入系统提示词。

```text
DSH 事件      ──▶  /agentmemory/observe        自动捕获
memory_* 工具 ──▶  /agentmemory/*              按需操作
会话开始      ──▶  context ──▶ system prompt  可选注入
```

## 兼容性

工具名与端点遵循 agentmemory 官方参考。运行中的 server 可能与最新发布版有差异：

- 某些功能默认关闭（例如 `/slots` 返回 503 并附带开启提示）；
- 较新的端点可能尚未实现。

遇到 4xx/5xx 时，按响应体里的提示操作，或对齐 server 版本。`memory_http` 可访问没有专用工具的端点。

## 开发

从源码构建：

```bash
npm install
npm run typecheck
npm run build
npm test        # 对运行中的 server 做只读连通测试
```

## FAQ

### 插件管理器装不上，还有什么办法？

Oh-DSH-Desktop 的插件管理器与官方 CLI 底层都会执行 `dsh plugin --profile <name> add <package>`。如果你那里的插件管理器装不上，CLI 是等效的替代方案：

```bash
npx -p @deepseek-ai/dsh dsh plugin --profile desktop add @elementor-i/dsh-agentmemory
```

把 `desktop` 换成你的 profile 名，然后重启 DSH。如果你管理的是桌面 profile，请使用与桌面应用相同的 `DSH_HOME`（macOS 下为 `~/Library/Application Support/Oh-DSH-Desktop/dsh`）。

### `ERR_PNPM_UNEXPECTED_STORE` 或 "pnpm failed in profile directory"

当 profile 的 `node_modules` 曾从某个已不存在的 pnpm store 链接时可能出现——例如插件管理器的预览目录被清理之后。在 macOS 上观察到的一个可行做法是先重链接到当前 store，再重试：

```bash
CI=true dsh plugin --profile desktop install
dsh plugin --profile desktop add @elementor-i/dsh-agentmemory
```

（`CI=true` 让 pnpm 在无交互提示下重建 `node_modules`。）

### 插件管理器报 `gh` 超时

插件管理器会调用 GitHub CLI（`gh`）来解析提交和克隆仓库。如果它报 `gh` 超时、而同样的命令在你自己的终端里正常，通常重试、或改走上面的 CLI 方式，是更快的出路。

以上是某个特定环境下观察到的现象记录，不保证所有环境都一致。

## License

[MIT](./LICENSE) © 2026 Element

## 致谢

- [agentmemory](https://github.com/rohitg00/agentmemory) —— 本插件所对接的记忆服务器。
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) —— 宿主及其事件系统。
