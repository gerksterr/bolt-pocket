import { logError, logInfo, logOk } from './log'

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
// Abort only when NO bytes arrive for this long (OpenRouter keep-alives count
// as activity), or when the user-configured total limit is exceeded.
const IDLE_MS = 120_000
const DEFAULT_TIMEOUT_MS = 600_000

export const SYSTEM_PROMPT =
  'Return ONLY JSON {"files": {"index.html": "...", "style.css": "...", "script.js": "..."}}'

export const MODEL_PRESETS = [
  { label: 'DeepSeek V4 Flash', value: 'deepseek/deepseek-chat' },
  { label: 'Kimi K3', value: 'moonshotai/kimi-k2' },
  { label: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
  { label: 'GPT-4o mini', value: 'openai/gpt-4o-mini' },
  { label: 'Gemini 2.0 Flash', value: 'google/gemini-2.0-flash-001' },
]

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
      return ['Invalid OpenRouter API key.', 'Check the key in Settings — it may be revoked or mistyped.']
    case status === 402:
      return ['Insufficient OpenRouter credits.', 'Top up at openrouter.ai/credits, or pick a cheaper model.']
    case status === 403:
      return ['Access denied by OpenRouter.', detail || 'Your key may not have access to this model.']
    case status === 404:
      return ['Model not found.', 'The model id in Settings must exactly match an OpenRouter model.']
    case status === 429:
      return ['Rate limited.', 'Wait a moment and retry, or switch to a less busy model.']
    case status >= 500:
      return ['OpenRouter or the model provider is having issues.', 'Retry in a moment, or switch models.']
    default:
      return [`OpenRouter returned HTTP ${status}.`, detail || null]
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

// Read an SSE stream, returning the accumulated content. onChunk(len, isFirst)
// fires for every content delta; onActivity fires for every received chunk
// (including keep-alives) so callers can run a stall watchdog.
async function readStream(body, onChunk, onActivity) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let first = true

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
      try {
        const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content
        if (delta) {
          text += delta
          onChunk(text.length, first)
          first = false
        }
      } catch {
        /* incomplete SSE payload — keep accumulating */
      }
    }
  }
  return text
}

export async function generateSite({
  apiKey,
  model,
  prompt,
  currentFiles,
  signal,
  onProgress,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  idleMs = IDLE_MS,
}) {
  const startedAt = Date.now()
  const elapsed = () => `${((Date.now() - startedAt) / 1000).toFixed(1)}s`

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

  logInfo('request', `model=${model} · prompt ${prompt.length} chars · limit ${Math.round(timeoutMs / 1000)}s`)
  try {
    let res
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.href,
          'X-Title': 'bolt-pocket',
        },
        body: JSON.stringify({
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
        'Could not reach OpenRouter — the network request was blocked or failed.',
        'On Android this is usually an ad-blocker or private DNS blocking openrouter.ai, a VPN, or a dropped connection. Try Settings → Test connection, switch network, or whitelist openrouter.ai.',
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
    const text = await readStream(
      res.body,
      (len, isFirst) => {
        if (isFirst) logOk('stream', `first token at ${elapsed()}`)
        if (len - lastLogged >= 2000) {
          lastLogged = len
          logInfo('stream', `${len.toLocaleString()} chars received at ${elapsed()}`)
        }
        onProgress?.(len)
      },
      resetIdle,
    )

    if (!text.trim()) {
      logError('parse', `stream ended with no content at ${elapsed()}`)
      throw new GenerationError(
        'The model returned an empty response.',
        'Try again, or pick a different model in Settings.',
        'parse',
      )
    }
    logInfo('parse', `stream complete · ${text.length.toLocaleString()} chars at ${elapsed()} · extracting JSON…`)

    let files
    try {
      files = toFiles(extractJson(text))
    } catch (e) {
      logError('parse', `${e.message} · response starts with: ${JSON.stringify(text.slice(0, 300))}`)
      throw new GenerationError(
        'The model did not return valid JSON.',
        'Retrying usually fixes it. The raw response is in the Log tab.',
        'parse',
      )
    }

    const sizes = Object.entries(files)
      .map(([k, v]) => `${k} ${(v.length / 1024).toFixed(1)} KB`)
      .join(' · ')
    logOk('done', `files updated in ${elapsed()} · ${sizes}`)
    return files
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
export async function testConnection({ apiKey, model }) {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  const latency = () => `${((Date.now() - startedAt) / 1000).toFixed(1)}s`
  logInfo('test', `testing connection · model=${model}`)
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.href,
        'X-Title': 'bolt-pocket',
      },
      body: JSON.stringify({
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
      hint: 'Network-level failure: openrouter.ai is unreachable. Check ad-blocker/private DNS/VPN, or try another network.',
      latency: latency(),
    }
  } finally {
    clearTimeout(timer)
  }
}
