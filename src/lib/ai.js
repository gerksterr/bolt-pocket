export const SYSTEM_PROMPT =
  'Return ONLY JSON {"files": {"index.html": "...", "style.css": "...", "script.js": "..."}}'

export const MODEL_PRESETS = [
  { label: 'DeepSeek V4 Flash', value: 'deepseek/deepseek-chat' },
  { label: 'Kimi K3', value: 'moonshotai/kimi-k2' },
  { label: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
  { label: 'GPT-4o mini', value: 'openai/gpt-4o-mini' },
  { label: 'Gemini 2.0 Flash', value: 'google/gemini-2.0-flash-001' },
]

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

export async function generateSite({ apiKey, model, prompt, currentFiles, signal }) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.href,
      'X-Title': 'bolt-pocket',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserMessage(prompt, currentFiles) },
      ],
    }),
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body?.error?.message || JSON.stringify(body)
    } catch {
      /* keep statusText */
    }
    throw new Error(`OpenRouter ${res.status}: ${detail}`)
  }

  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty response from model')
  return toFiles(extractJson(text))
}
