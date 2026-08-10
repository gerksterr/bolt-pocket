import { logError, logInfo, logOk } from './log'

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'
// Abort only when NO bytes arrive for this long (OpenRouter keep-alives count
// as activity), or when the user-configured total limit is exceeded.
const IDLE_MS = 120_000
const DEFAULT_TIMEOUT_MS = 600_000

export const BASE_URL_PRESETS = [
  { label: 'OpenRouter', value: 'https://openrouter.ai/api/v1', defaultModel: 'deepseek/deepseek-chat' },
  { label: 'Moonshot AI · Kimi direct', value: 'https://api.moonshot.ai/v1', defaultModel: 'kimi-k2-0905-preview' },
  { label: 'Moonshot CN · Kimi direct', value: 'https://api.moonshot.cn/v1', defaultModel: 'kimi-k2-0905-preview' },
  { label: 'OpenAI', value: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
]

export const SYSTEM_PROMPT =
  'Return ONLY JSON {"files": {"index.html": "...", "style.css": "...", "script.js": "..."}}'

export const MODEL_PRESETS = [
  { label: 'DeepSeek V4 Flash', value: 'deepseek/deepseek-chat' },
  { label: 'Kimi K3', value: 'moonshotai/kimi-k2' },
  { label: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
  { label: 'GPT-4o mini', value: 'openai/gpt-4o-mini' },
  { label: 'Gemini 2.0 Flash', value: 'google/gemini-2.0-flash-001' },
]

export const MOONSHOT_MODEL_PRESETS = [
  { label: 'Kimi K2', value: 'kimi-k2-0905-preview' },
  { label: 'Kimi K2 Turbo', value: 'kimi-k2-turbo-preview' },
  { label: 'kimi-latest', value: 'kimi-latest' },
]

// One-tap inserts for Settings → Extra request parameters.
export const EXTRA_PARAM_TEMPLATES = [
  { label: 'Pin provider', value: { provider: { only: ['moonshotai'], allow_fallbacks: false } } },
  { label: 'Fastest provider', value: { provider: { sort: 'throughput' } } },
  { label: 'Reasoning effort', value: { reasoning: { effort: 'high' } } },
  { label: 'JSON mode', value: { response_format: { type: 'json_object' } } },
  { label: 'Sampling', value: { temperature: 0.7, top_p: 0.9 } },
]

// Parse the free-form extras JSON. Throws GenerationError (phase 'settings')
// so a broken config fails fast in the chat instead of mid-request.
function parseExtras(raw) {
  if (!raw || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    throw new Error('top level must be a JSON object')
  } catch (e) {
    throw new GenerationError(
      'Extra request parameters are not valid JSON.',
      `Settings → Extra request parameters: ${e.message}`,
      'settings',
    )
  }
}

// Any OpenAI-protocol-compatible base URL works; we append /chat/completions.
export function chatEndpoint(baseUrl) {
  return `${(baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, '')}/chat/completions`
}

function endpointHost(baseUrl) {
  try {
    return new URL(chatEndpoint(baseUrl)).host
  } catch {
    return baseUrl || DEFAULT_BASE_URL
  }
}

function buildHeaders(baseUrl, apiKey) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
  // OpenRouter attribution headers only make sense (and only get sent) there
  if (endpointHost(baseUrl).includes('openrouter.ai')) {
    headers['HTTP-Referer'] = window.location.href
    headers['X-Title'] = 'bolt-pocket'
  }
  return headers
}

// Error with a user-actionable hint and the phase where it occurred.
export class GenerationError extends Error {
  constructor(message, hint, phase) {
    super(message)
    this.name = 'GenerationError'
    this.hint = hint
    this.phase = phase
  }
}

function httpError(status, body) {
  const detail = body?.error?.message || ''
  switch (true) {
    case status === 401:
      return ['Invalid API key.', 'Check the key in Settings — it may be revoked, mistyped, or for the wrong provider.']
    case status === 402:
      return ['Insufficient credits / quota.', 'Top up your provider balance, or pick a cheaper model.']
    case status === 403:
      return ['Access denied by the provider.', detail || 'Your key may not have access to this model.']
    case status === 404:
      return ['Model not found.', 'The model id must exactly match one your provider serves.']
    case status === 429:
      return ['Rate limited.', 'Wait a moment and retry, or switch to a less busy model.']
    case status >= 500:
      return ['The provider is having issues.', 'Retry in a moment, or switch models.']
    default:
      return [`The provider returned HTTP ${status}.`, detail || null]
  }
}

async function readErrorBody(res) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function extractJson(text) {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) t = fence[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('Model response did not contain JSON')
  return JSON.parse(t.slice(start, end + 1))
}

function toFiles(parsed) {
  const files = parsed && typeof parsed === 'object' ? parsed.files : null
  if (!files || typeof files !== 'object') {
    throw new Error('Model JSON missing "files" object')
  }
  return {
    'index.html': typeof files['index.html'] === 'string' ? files['index.html'] : '',
    'style.css': typeof files['style.css'] === 'string' ? files['style.css'] : '',
    'script.js': typeof files['script.js'] === 'string' ? files['script.js'] : '',
  }
}

function buildUserMessage(prompt, currentFiles) {
  const sections = ['index.html', 'style.css', 'script.js']
    .map((name) => `--- ${name} ---\n${currentFiles[name] || '(empty)'}`)
    .join('\n\n')
  return `Current project files:\n\n${sections}\n\nRequest: ${prompt}\n\nRespond with the complete updated files as a single JSON object only.`
}

// Read an SSE stream, accumulating content, reasoning (thinking) and usage
// separately. Callbacks receive the FULL accumulated strings so the UI can
// render the live stream; onActivity fires for every received chunk
// (including keep-alives) so callers can run a stall watchdog.
export async function readStream(body, { onContent, onReasoning, onActivity } = {}) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let reasoning = ''
  let usage = null
  let firstContent = true
  let firstReasoning = true

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    onActivity?.()
    buffer += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 1)
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (payload === '[DONE]') continue
      let json
      try {
        json = JSON.parse(payload)
      } catch {
        continue /* incomplete SSE payload — keep accumulating */
      }
      if (json.usage) usage = json.usage
      const delta = json.choices?.[0]?.delta
      if (!delta) continue
      // OpenRouter normalizes to `reasoning`; DeepSeek/Moonshot use `reasoning_content`
      const r =
        typeof delta.reasoning === 'string'
          ? delta.reasoning
          : typeof delta.reasoning_content === 'string'
            ? delta.reasoning_content
            : ''
      if (r) {
        reasoning += r
        onReasoning?.(reasoning, firstReasoning)
        firstReasoning = false
      }
      if (delta.content) {
        content += delta.content
        onContent?.(content, firstContent)
        firstContent = false
      }
    }
  }
  return { content, reasoning, usage }
}

export async function generateSite({
  apiKey,
  baseUrl,
  model,
  prompt,
  currentFiles,
  signal,
  onProgress,
  extraParams,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  idleMs = IDLE_MS,
}) {
  const startedAt = Date.now()
  const elapsed = () => `${((Date.now() - startedAt) / 1000).toFixed(1)}s`
  const host = endpointHost(baseUrl)
  const extras = parseExtras(extraParams)

  // own controller so limits can abort independently of the user's halt signal
  let abortReason = null // 'halt' | 'timeout' | 'idle'
  const controller = new AbortController()
  const onExternalAbort = () => {
    abortReason = 'halt'
    controller.abort()
  }
  signal?.addEventListener('abort', onExternalAbort)
  const totalTimer = setTimeout(() => {
    abortReason = 'timeout'
    controller.abort()
  }, timeoutMs)
  let idleTimer = null
  const resetIdle = () => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      abortReason = 'idle'
      controller.abort()
    }, idleMs)
  }
  resetIdle() // also covers a connect that never delivers bytes

  const extraKeys = Object.keys(extras)
  logInfo(
    'request',
    `${host} · model=${model} · prompt ${prompt.length} chars · limit ${Math.round(timeoutMs / 1000)}s` +
      (extraKeys.length ? ` · extras: ${extraKeys.join(', ')}` : ''),
  )
  try {
    let res
    try {
      res = await fetch(chatEndpoint(baseUrl), {
        method: 'POST',
        signal: controller.signal,
        headers: buildHeaders(baseUrl, apiKey),
        body: JSON.stringify({
          // ask for thinking tokens unless the user's extras say otherwise
          ...(extras.reasoning == null ? { reasoning: { enabled: true } } : {}),
          // OpenRouter streams usage stats when asked
          ...(host.includes('openrouter.ai') ? { usage: { include: true } } : {}),
          // extras first so app-controlled keys can never be clobbered
          ...extras,
          model,
          stream: true,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserMessage(prompt, currentFiles) },
          ],
        }),
      })
    } catch (e) {
      if (e.name === 'AbortError') throw e
      // TypeError: Failed to fetch — DNS/TLS/CORS-preflight/offline; never reached the API
      logError('connect', `${e.name}: ${e.message} at ${elapsed()} — request never completed`)
      throw new GenerationError(
        `Could not reach ${host} — the network request was blocked or failed.`,
        `On Android this is usually an ad-blocker or private DNS blocking ${host}, a VPN, a dropped connection, or the provider not allowing browser (CORS) requests. Try Settings → Test connection, switch network, or whitelist ${host}.`,
        'connect',
      )
    }

    if (!res.ok) {
      const body = await readErrorBody(res)
      const [message, hint] = httpError(res.status, body)
      logError('response', `HTTP ${res.status} at ${elapsed()} · ${body?.error?.message || res.statusText}`)
      throw new GenerationError(message, hint, 'response')
    }
    logOk('connected', `HTTP 200 at ${elapsed()} · streaming response…`)

    let lastLogged = 0
    let lastReasoningLogged = 0
    const { content, reasoning, usage } = await readStream(res.body, {
      onContent: (text, isFirst) => {
        if (isFirst) logOk('stream', `first output token at ${elapsed()}`)
        if (text.length - lastLogged >= 2000) {
          lastLogged = text.length
          logInfo('stream', `output ${text.length.toLocaleString()} chars at ${elapsed()}`)
        }
        onProgress?.({ content, reasoning })
      },
      onReasoning: (text, isFirst) => {
        if (isFirst) logOk('stream', `first thinking token at ${elapsed()}`)
        if (text.length - lastReasoningLogged >= 4000) {
          lastReasoningLogged = text.length
          logInfo('stream', `thinking ${text.length.toLocaleString()} chars at ${elapsed()}`)
        }
        onProgress?.({ content, reasoning })
      },
      onActivity: resetIdle,
    })

    if (!content.trim()) {
      logError('parse', `stream ended with no content at ${elapsed()}`)
      throw new GenerationError(
        'The model returned an empty response.',
        'Try again, or pick a different model in Settings.',
        'parse',
      )
    }
    logInfo(
      'parse',
      `stream complete · output ${content.length.toLocaleString()}c` +
        (reasoning ? ` + thinking ${reasoning.length.toLocaleString()}c` : '') +
        ` at ${elapsed()} · extracting JSON…`,
    )

    let files
    try {
      files = toFiles(extractJson(content))
    } catch (e) {
      logError('parse', `${e.message} · response starts with: ${JSON.stringify(content.slice(0, 300))}`)
      throw new GenerationError(
        'The model did not return valid JSON.',
        'Retrying usually fixes it. The raw response is in the Log tab.',
        'parse',
      )
    }

    const sizes = Object.entries(files)
      .map(([k, v]) => `${k} ${(v.length / 1024).toFixed(1)} KB`)
      .join(' · ')
    const usageInfo = usage?.total_tokens
      ? ` · ${usage.total_tokens.toLocaleString()} tokens (${(usage.prompt_tokens || 0).toLocaleString()} in / ${(usage.completion_tokens || 0).toLocaleString()} out)`
      : ''
    logOk('done', `files updated in ${elapsed()} · ${sizes}${usageInfo}`)
    return { files, reasoning, usage, elapsedMs: Date.now() - startedAt }
  } catch (e) {
    if (e.name === 'AbortError' && abortReason === 'timeout') {
      logError('timeout', `hit the ${Math.round(timeoutMs / 1000)}s total limit at ${elapsed()}`)
      throw new GenerationError(
        `Generation hit the ${Math.round(timeoutMs / 1000)}s time limit (Settings → Generation timeout).`,
        'Raise the limit in Settings, or use a faster model (e.g. Gemini 2.0 Flash).',
        'timeout',
      )
    }
    if (e.name === 'AbortError' && abortReason === 'idle') {
      logError('timeout', `no data received for ${Math.round(idleMs / 1000)}s at ${elapsed()}`)
      throw new GenerationError(
        `The model stopped responding — no data for ${Math.round(idleMs / 1000)}s.`,
        'The provider may be overloaded. Retry, or switch models in Settings.',
        'idle',
      )
    }
    throw e
  } finally {
    clearTimeout(totalTimer)
    clearTimeout(idleTimer)
    signal?.removeEventListener('abort', onExternalAbort)
  }
}

// Minimal-cost probe: 1-token completion validates connectivity, key, and model id.
export async function testConnection({ apiKey, baseUrl, model, extraParams }) {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  const latency = () => `${((Date.now() - startedAt) / 1000).toFixed(1)}s`
  const host = endpointHost(baseUrl)
  let extras
  try {
    extras = parseExtras(extraParams)
  } catch (e) {
    return { ok: false, message: e.message, hint: e.hint, latency: latency() }
  }
  logInfo('test', `testing ${host} · model=${model}`)
  try {
    const res = await fetch(chatEndpoint(baseUrl), {
      method: 'POST',
      signal: controller.signal,
      headers: buildHeaders(baseUrl, apiKey),
      body: JSON.stringify({
        ...extras,
        model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    })
    if (!res.ok) {
      const body = await readErrorBody(res)
      const [message, hint] = httpError(res.status, body)
      logError('test', `HTTP ${res.status} at ${latency()} · ${body?.error?.message || res.statusText}`)
      return { ok: false, message: `HTTP ${res.status} — ${message}`, hint, latency: latency() }
    }
    logOk('test', `connection OK at ${latency()}`)
    return { ok: true, message: `Connected — “${model}” responded`, latency: latency() }
  } catch (e) {
    if (e.name === 'AbortError') {
      logError('test', `timed out at ${latency()}`)
      return { ok: false, message: 'Timed out after 30s', hint: 'Connection is too slow or blocked.', latency: latency() }
    }
    logError('test', `${e.name}: ${e.message} at ${latency()}`)
    return {
      ok: false,
      message: `${e.name}: ${e.message}`,
      hint: `Network-level failure: ${host} is unreachable. Check ad-blocker/private DNS/VPN, whether the provider allows browser (CORS) requests, or try another network.`,
      latency: latency(),
    }
  } finally {
    clearTimeout(timer)
  }
}
