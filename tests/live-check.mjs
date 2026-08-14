import { AgentMemoryClient } from '../lib/client.js'

const client = new AgentMemoryClient({
  baseURL: process.env.AGENTMEMORY_URL || 'http://127.0.0.1:3111',
  secret: process.env.AGENTMEMORY_SECRET || '',
  defaultTimeoutMs: 8000,
})

let failed = 0
async function check(label, fn) {
  try { await fn(); console.log('PASS  ' + label) }
  catch (e) { failed++; console.log('FAIL  ' + label + '  —  ' + e.message) }
}

// Read-only checks only — never writes to the user's memory store.
await check('GET /agentmemory/livez', async () => {
  const ok = await client.health()
  if (!ok) throw new Error('server unreachable at ' + client.baseURL)
})
await check('GET /agentmemory/sessions', async () => {
  await client.request('/agentmemory/sessions', { method: 'GET' })
})
await check('POST /agentmemory/search (read-only)', async () => {
  await client.request('/agentmemory/search', { method: 'POST', body: { query: 'dsh-agentmemory', limit: 3 } })
})
await check('GET /agentmemory/commits', async () => {
  await client.request('/agentmemory/commits', { method: 'GET' })
})

if (failed > 0) { console.error(failed + ' check(s) failed'); process.exit(1) }
console.log('all live checks passed')
