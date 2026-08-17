# Contributing

Thanks for considering a contribution to dsh-agentmemory.

## Setup

    git clone https://github.com/elementor-i/dsh-agentmemory
    cd dsh-agentmemory
    npm install

## Checks

    npm run typecheck
    npm run build
    npm test   # read-only checks against a running agentmemory server

## Guidelines

- Keep the REST tool mapping in src/tools.ts in sync with agentmemory's generated reference.
- Hook handlers must stay non-blocking and always call next() on waterfall events.
- Add or update both README.md and README.zh-CN.md for user-facing changes.
