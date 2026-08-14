/** Thin REST client for agentmemory (http://localhost:3111 by default). */
export class AgentMemoryClient {
    baseURL;
    secret;
    defaultTimeoutMs;
    constructor(opts) {
        this.baseURL = opts.baseURL.replace(/\/+$/, '');
        this.secret = opts.secret;
        this.defaultTimeoutMs = opts.defaultTimeoutMs;
    }
    headers() {
        const h = { 'Content-Type': 'application/json' };
        if (this.secret)
            h.Authorization = 'Bearer ' + this.secret;
        return h;
    }
    signalFor(opts) {
        const signals = [];
        const timeoutMs = opts.timeoutMs ?? this.defaultTimeoutMs;
        if (timeoutMs > 0)
            signals.push(AbortSignal.timeout(timeoutMs));
        if (opts.signal)
            signals.push(opts.signal);
        if (signals.length === 0)
            return undefined;
        if (signals.length === 1)
            return signals[0];
        return AbortSignal.any(signals);
    }
    async request(path, opts = {}) {
        const method = opts.method ?? 'GET';
        let url = this.baseURL + path;
        if (opts.query && Object.keys(opts.query).length > 0) {
            const qs = new URLSearchParams();
            for (const [k, v] of Object.entries(opts.query)) {
                if (v !== undefined && v !== null)
                    qs.set(k, String(v));
            }
            url += (url.includes('?') ? '&' : '?') + qs.toString();
        }
        const init = { method, headers: this.headers() };
        if (method !== 'GET' && opts.body !== undefined) {
            init.body = JSON.stringify(opts.body);
        }
        const signal = this.signalFor(opts);
        if (signal)
            init.signal = signal;
        const res = await fetch(url, init);
        if (!res.ok) {
            let detail = '';
            try {
                detail = (await res.text()).slice(0, 500);
            }
            catch { /* ignore */ }
            const msg = 'agentmemory ' + res.status + ' on ' + method + ' ' + path + (detail ? ': ' + detail : '');
            throw new Error(msg);
        }
        if (res.status === 204)
            return undefined;
        const text = await res.text();
        if (!text)
            return undefined;
        try {
            return JSON.parse(text);
        }
        catch {
            return text;
        }
    }
    /** GET /agentmemory/livez — returns true when the server is up. */
    async health(timeoutMs = 2000) {
        try {
            await this.request('/agentmemory/livez', { timeoutMs });
            return true;
        }
        catch {
            return false;
        }
    }
    /** POST /agentmemory/session/start — register a session (returns injected context). */
    async sessionStart(payload, opts = {}) {
        return this.request('/agentmemory/session/start', { method: 'POST', body: payload, ...opts });
    }
    /** POST /agentmemory/session/end — close a session. */
    async sessionEnd(payload, opts = {}) {
        return this.request('/agentmemory/session/end', { method: 'POST', body: payload, ...opts });
    }
    /**
     * POST /agentmemory/observe — record one observation.
     * Fire-and-forget friendly: callers should .catch(() => {}) and pass a short timeout.
     */
    observe(payload, opts = {}) {
        return this.request('/agentmemory/observe', { method: 'POST', body: payload, ...opts });
    }
}
