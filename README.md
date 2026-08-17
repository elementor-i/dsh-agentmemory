<div align="center">

# dsh-agentmemory

**agentmemory for DeepSeek Harness** — full `memory_*` tools, automatic capture hooks, and opt-in context injection over the local REST server.

[English](./README.md) · [中文](./README_zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![CI](https://github.com/elementor-i/dsh-agentmemory/actions/workflows/ci.yml/badge.svg)](https://github.com/elementor-i/dsh-agentmemory/actions/workflows/ci.yml)
[![dsh](https://img.shields.io/badge/dsh-%3E%3D0.0.1-orange)](https://github.com/deepseek-ai/deepseek-harness)

</div>

dsh-agentmemory connects [agentmemory](https://github.com/rohitg00/agentmemory), a local memory server for coding agents, to [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH). It exposes the full `memory_*` tool set, captures observations automatically from sessions, prompts, and tool activity, and can inject recalled context into the system prompt — all over the local REST server, with no MCP bridge required.

## Features

- **Full tool surface** — all 54 `memory_*` tools (8 core) mapped to `/agentmemory/*`, plus `memory_observe` and a `memory_http` escape hatch for any endpoint.
- **Automatic capture** — session, prompt, tool-use, subagent, workflow, and approval activity are recorded as observations in the background.
- **Context injection** — opt-in; recalled context from the session is added to the system prompt.
- **Safe by default** — credential redaction, per-call timeouts, non-blocking observation, and destructive tools gated behind a flag.
- **No MCP required** — no stdio bridge, no child process; the running REST server (`localhost:3111`) is the only dependency.

## Requirements

An agentmemory server running on the same machine (default `http://127.0.0.1:3111`, viewer on `3113`):

```bash
curl -fsS http://127.0.0.1:3111/agentmemory/livez
# {"service":"agentmemory","status":"ok"} when healthy
```

If the server is unavailable, the plugin logs a warning and the `memory_*` tools return errors; the harness itself keeps running normally.

## Install

### Native mount

```bash
git clone https://github.com/elementor-i/dsh-agentmemory ~/dsh-plugins/dsh-agentmemory
```

Add an `insert` patch to `~/.dsh/config.yaml` (or `$DSH_HOME/cordis.patch.yml` for all profiles):

```yaml
- insert:
    - id: dsh-agentmemory
      name: '$HOME/dsh-plugins/dsh-agentmemory/lib/index.js'
```

Then restart DSH. Compiled output is committed, so no build step is required.

### Official CLI

```bash
# npm registry (recommended) — @elementor-i/dsh-agentmemory@^0.1.1
npx -p @deepseek-ai/dsh dsh plugin --profile web add @elementor-i/dsh-agentmemory

# or directly from the source repository
npx -p @deepseek-ai/dsh dsh plugin --profile web add github:elementor-i/dsh-agentmemory
```

Replace `web` with your profile name. The package declares a `dsh.bundle.patch`, so it loads as a profile layer; compiled output is committed, so no build runs on install.

### Plugin manager (AI-assisted)

Oh-DSH-Desktop's plugin manager installs with an isolated preview and rollback. It is driven by an AI coding agent through tools — not shell commands — so the fastest path is to paste this prompt to your assistant:

> Install `dsh-agentmemory` from the Oh-DSH-Desktop plugin manager: refresh the plugin catalog, prepare the install as an isolated preview, and apply it after I review the preview.

Under the hood the assistant calls these tools:

```text
desktop_plugin_search  { query: 'dsh-agentmemory', refresh: true }   # confirm it is in the catalog
desktop_plugin_prepare { action: 'install', pluginId: 'dsh-agentmemory' }
desktop_plugin_apply   {}                                            # after you approve the preview
```

Notes:

- The plugin must already be in the public DSH catalog. The catalog is rebuilt hourly from GitHub repos tagged `dsh-plugin`, so a newly published repo appears within about an hour.
- `desktop_plugin_apply` restarts the live DSH runtime — review the isolated preview before applying.

## Configuration

All keys are optional and have safe defaults. The environment variables `AGENTMEMORY_URL`, `AGENTMEMORY_SECRET`, and `AGENTMEMORY_PROJECT_NAME` are honored as fallbacks.

```yaml
dsh-agentmemory:
  baseURL: http://127.0.0.1:3111   # empty -> $AGENTMEMORY_URL -> default
  secret: ""                       # empty -> $AGENTMEMORY_SECRET (Bearer)
  timeoutMs: 10000
  observeTimeoutMs: 3000           # fire-and-forget hook timeout
  registerTools: true
  coreToolsOnly: false             # true -> only the 8 core tools
  dangerousTools: false            # true -> expose destructive/expensive tools
  projectName: ""                  # empty -> $AGENTMEMORY_PROJECT_NAME -> git repo basename
  injectContext: false             # inject recalled context into the system prompt
  injectMaxChars: 4000
  healthCheck: true
  hooks:
    enabled: true
    capturePrompts: true
    captureToolUse: true
    toolNameFilter: []             # non-empty -> only these tool names
    captureSubagents: true
    captureWorkflow: true
    captureApprovals: false
    preCompactSnapshot: false      # approximate PreCompact on request-error
    maxObservationBytes: 8000
    redactSecrets: true
```

| Key | Default | Description |
| --- | --- | --- |
| `baseURL` | `http://127.0.0.1:3111` | agentmemory REST base URL |
| `secret` | `""` | Bearer secret (falls back to `AGENTMEMORY_SECRET`) |
| `timeoutMs` | `10000` | per-tool HTTP timeout |
| `observeTimeoutMs` | `3000` | hook observation timeout (fire-and-forget) |
| `registerTools` | `true` | register the `memory_*` tool set |
| `coreToolsOnly` | `false` | register only the 8 core tools |
| `dangerousTools` | `false` | expose `governance_delete`, `heal`, `consolidate`, `reflect`, `crystallize` |
| `injectContext` | `false` | inject recalled context into the system prompt |
| `healthCheck` | `true` | warn on startup if the server is unreachable |

## Hooks

Activity is captured automatically through DSH's official events. Handlers are non-blocking: requests use a short timeout and are never awaited, and waterfall events always call `next()`.

| agentmemory hook | DSH event | Mode |
| --- | --- | --- |
| SessionStart | `session/created` | emit |
| UserPromptSubmit | `agent/inbox/inserted` | emit |
| PreToolUse | `tools/pre-execute` | waterfall |
| PostToolUse / PostToolUseFailure | `tools/result` | emit |
| PreCompact (approx) | `agent/request-error` | waterfall |
| SubagentStart / SubagentStop | `subagent/start` / `subagent/end` | emit |
| Notification | `approval/request` | waterfall |
| TaskCompleted | `agent/turn-stopping` | serial |
| SessionEnd | `session/disposed` → `/session/end` | emit |
| context injection | `system-prompt/assemble` | waterfall |

## Tools

Core set (registered by default, or exclusively with `coreToolsOnly`):

`memory_save` · `memory_recall` · `memory_smart_search` · `memory_sessions` · `memory_lesson_save` · `memory_consolidate` · `memory_reflect` · `memory_diagnose`

The remaining 46: `memory_commits` · `memory_commit_lookup` · `memory_compress_file` · `memory_file_history` · `memory_timeline` · `memory_vision_search` · `memory_lesson_recall` · `memory_lesson_delete` · `memory_graph_query` · `memory_relations` · `memory_patterns` · `memory_profile` · `memory_audit` · `memory_verify` · `memory_heal` · `memory_crystallize` · `memory_governance_delete` · `memory_slot_create` · `memory_slot_get` · `memory_slot_append` · `memory_slot_replace` · `memory_slot_list` · `memory_slot_delete` · `memory_action_create` · `memory_action_update` · `memory_frontier` · `memory_next` · `memory_lease` · `memory_checkpoint` · `memory_routine_run` · `memory_signal_send` · `memory_signal_read` · `memory_sentinel_create` · `memory_sentinel_trigger` · `memory_sketch_create` · `memory_sketch_promote` · `memory_facet_tag` · `memory_facet_query` · `memory_mesh_sync` · `memory_team_share` · `memory_team_feed` · `memory_snapshot_create` · `memory_export` · `memory_claude_bridge_sync` · `memory_obsidian_export` · `memory_insight_list`

Extras:

- `memory_observe` — record a raw observation manually (automatic capture usually covers this).
- `memory_http` — call any `/agentmemory/*` endpoint with a JSON body or query (for endpoints without a dedicated tool).

## How it works

Three parts cooperate over the local REST server:

- **Tools** — each `memory_*` tool maps to the matching `/agentmemory/*` endpoint.
- **Hooks** — DSH lifecycle events are forwarded to the server as observations.
- **Injection** — on session start, the server returns recalled context, which is added to the system prompt when `injectContext` is enabled.

```text
DSH events     ──▶  /agentmemory/observe        automatic capture
memory_* tools ──▶  /agentmemory/*              on-demand operations
session start  ──▶  context ──▶ system prompt   optional injection
```

## Compatibility

Tool names and endpoints follow agentmemory's official reference. A running server may differ from the latest release:

- some features are disabled by default (for example `/slots` returns 503 with an enable hint);
- newer endpoints may not be present yet.

On a 4xx or 5xx response, follow the hint in the response body or align the server version. `memory_http` reaches endpoints without a dedicated tool.

## Development

Build from source:

```bash
npm install
npm run typecheck
npm run build
npm test        # read-only checks against a running server
```

## FAQ

### The plugin manager fails to install — what else can I try?

Oh-DSH-Desktop's plugin manager and the official CLI both end up running `dsh plugin --profile <name> add <package>`. If the plugin manager fails in your environment, the CLI is an equivalent fallback:

```bash
npx -p @deepseek-ai/dsh dsh plugin --profile desktop add @elementor-i/dsh-agentmemory
```

Replace `desktop` with your profile name, then restart DSH. If you are managing the desktop profile, run the command with the same `DSH_HOME` the desktop app uses (on macOS, `~/Library/Application Support/Oh-DSH-Desktop/dsh`).

### `ERR_PNPM_UNEXPECTED_STORE` or "pnpm failed in profile directory"

This can happen when the profile's `node_modules` was linked from a pnpm store that no longer exists — for example, after a plugin-manager preview directory was cleaned up. A workaround observed on macOS is to relink from the current store, then retry:

```bash
CI=true dsh plugin --profile desktop install
dsh plugin --profile desktop add @elementor-i/dsh-agentmemory
```

(`CI=true` lets pnpm recreate `node_modules` without an interactive prompt.)

### The plugin manager times out on `gh`

The plugin manager shells out to the GitHub CLI (`gh`) to resolve commits and clone repositories. If it reports a `gh` timeout while the same command works in your own terminal, retrying — or using the CLI path above — is usually the quickest way forward.

These notes describe symptoms observed in a specific environment; they are not a guarantee that every setup behaves the same way.

## License

[MIT](./LICENSE) © 2026 Element

## Acknowledgements

- [agentmemory](https://github.com/rohitg00/agentmemory) — the memory server this plugin connects to.
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — the host and its event system.
