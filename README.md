<div align="center">

# dsh-agentmemory

**agentmemory for DeepSeek Harness** — the full `memory_*` tool surface, automatic capture hooks, and opt-in context injection, all over the local REST server.

[English](./README.md) · [中文](./README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![CI](https://github.com/elementor-i/dsh-agentmemory/actions/workflows/ci.yml/badge.svg)](https://github.com/elementor-i/dsh-agentmemory/actions/workflows/ci.yml)
[![dsh](https://img.shields.io/badge/dsh-%3E%3D0.0.1-orange)](https://github.com/deepseek-ai/deepseek-harness)

</div>

dsh-agentmemory bridges [agentmemory](https://github.com/rohitg00/agentmemory) — a local memory server for coding agents — into [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH). It is a native Cordis plugin, not an MCP shim: it talks REST directly, subscribes to harness events to capture observations automatically, and can inject recalled context back into the system prompt.

## Features

- **Full tool surface** — all 54 `memory_*` tools (8 core) mapped to `/agentmemory/*`, plus `memory_observe` and a `memory_http` escape hatch for any endpoint.
- **Automatic capture hooks** — reproduces agentmemory's Claude Code hooks by subscribing to DSH's official events: sessions, prompts, tool use, subagents, workflows, approvals.
- **Context injection** — opt-in; recalls session context on start and injects it into the system prompt.
- **Safe by default** — credential redaction, per-call timeouts, non-blocking fire-and-forget observation, destructive tools gated behind a flag.
- **No MCP required** — no stdio bridge, no child process; the running REST server (`localhost:3111`) is the only dependency.

## Prerequisites

An agentmemory server running on the same machine (default `http://127.0.0.1:3111`, viewer on `3113`):

```bash
curl -fsS http://127.0.0.1:3111/agentmemory/livez
# {"service":"agentmemory","status":"ok",...}
```

The plugin treats the server as an external process: it health-checks on startup and only warns when unreachable — it never crashes the harness.

## Quick start

```bash
git clone https://github.com/elementor-i/dsh-agentmemory ~/dsh-plugins/dsh-agentmemory
cd ~/dsh-plugins/dsh-agentmemory
npm install --legacy-peer-deps   # builds against the published @deepseek-ai SDK types
npm run build                   # tsc -> lib/ (committed, but rebuild after edits)
```

Then mount it (see Installation) and restart DSH.

## Installation

### Native mount (default)

Add an `insert` patch to your user overlay — `~/.dsh/config.yaml`, or `$DSH_HOME/cordis.patch.yml` for a whole machine:

```yaml
- insert:
    - id: dsh-agentmemory
      name: '$HOME/dsh-plugins/dsh-agentmemory/lib/index.js'
```

### Plugin manager

Once published to the marketplace, install it from your plugin manager:

```bash
dshx install dsh-agentmemory https://github.com/elementor-i/dsh-agentmemory
```

or search for `dsh-agentmemory` in the Oh-DSH-Desktop plugin manager.

For a local checkout:

```bash
dsh registry install ~/dsh-plugins/dsh-agentmemory && dsh registry enable dsh-agentmemory
```

## Configuration

All keys are optional and have safe defaults. Environment fallbacks mirror agentmemory's own hooks (`AGENTMEMORY_URL`, `AGENTMEMORY_SECRET`, `AGENTMEMORY_PROJECT_NAME`).

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
    preCompactSnapshot: false      # approx PreCompact on request-error
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

agentmemory's Claude Code hooks are reproduced by subscribing to DSH's official events. Every handler is non-blocking: HTTP is fired with a short timeout and never awaited, and waterfall events always call `next()`.

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
| (context injection) | `system-prompt/assemble` | waterfall |

## Tools

Core set (registered by default, or exclusively with `coreToolsOnly`):

`memory_save` · `memory_recall` · `memory_smart_search` · `memory_sessions` · `memory_lesson_save` · `memory_consolidate` · `memory_reflect` · `memory_diagnose`

The remaining 46: `memory_commits` · `memory_commit_lookup` · `memory_compress_file` · `memory_file_history` · `memory_timeline` · `memory_vision_search` · `memory_lesson_recall` · `memory_lesson_delete` · `memory_graph_query` · `memory_relations` · `memory_patterns` · `memory_profile` · `memory_audit` · `memory_verify` · `memory_heal` · `memory_crystallize` · `memory_governance_delete` · `memory_slot_create` · `memory_slot_get` · `memory_slot_append` · `memory_slot_replace` · `memory_slot_list` · `memory_slot_delete` · `memory_action_create` · `memory_action_update` · `memory_frontier` · `memory_next` · `memory_lease` · `memory_checkpoint` · `memory_routine_run` · `memory_signal_send` · `memory_signal_read` · `memory_sentinel_create` · `memory_sentinel_trigger` · `memory_sketch_create` · `memory_sketch_promote` · `memory_facet_tag` · `memory_facet_query` · `memory_mesh_sync` · `memory_team_share` · `memory_team_feed` · `memory_snapshot_create` · `memory_export` · `memory_claude_bridge_sync` · `memory_obsidian_export` · `memory_insight_list`

Extras:

- `memory_observe` — record a raw observation manually (hooks already do this automatically).
- `memory_http` — call any `/agentmemory/*` endpoint with a JSON body/query (escape hatch for unmapped endpoints).

## How it works

```text
DSH events ──ctx.on──▶ hooks.ts ──fire-and-forget──▶ /agentmemory/observe
                                                          │
model ──memory_* tool──▶ tools.ts ──REST──▶ /agentmemory/*  (3111)
                                                          │
session/created ──▶ /session/start ──▶ context ──▶ system-prompt/assemble (optional)
```

`client.ts` is a thin REST client (Bearer auth, timeout, JSON). `tools.ts` is a data-driven table mapping each tool to its endpoint; `hooks.ts` subscribes to harness events and forwards observations. `util.ts` mirrors agentmemory's own project resolution, truncation, and secret redaction.

## Compatibility

The tool table and endpoint map are transcribed from agentmemory's generated references (`src/mcp/tools-registry.ts`, `src/triggers/api.ts`). A local server version may differ from the repo `main`:

- some features are off by default (e.g. `/slots` returns 503 with an enable hint);
- newer endpoints may not exist yet.

On a 4xx/5xx, follow the hint in the response body or align server versions. `memory_http` bypasses unmapped endpoints.

## Development

```bash
npm install --legacy-peer-deps   # types come from @deepseek-ai/dsh-tools etc.
npm run typecheck
npm run build                   # tsc -> lib/
npm test                        # read-only checks against a running server
```

`inject = ['tools', 'systemPrompt']`. `apply(ctx, config)` registers tools, subscribes hooks, and contributes a system-prompt section. Event names come from DSH's official event matrix (`docs/event-producer-consumer.md`); payloads are read defensively.

## License

[MIT](./LICENSE) © 2026 Element

## Acknowledgements

- [agentmemory](https://github.com/rohitg00/agentmemory) — the memory server this plugin fronts.
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — the host and its official event matrix.
