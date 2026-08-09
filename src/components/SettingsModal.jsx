import { useState } from 'react'
import { MODEL_PRESETS, testConnection } from '../lib/ai'
import { IconClose, IconGear } from './icons.jsx'

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none'

export default function SettingsModal({ open, settings, onSave, onClose }) {
  const [draft, setDraft] = useState(settings)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  if (!open) return null

  const set = (key) => (e) => {
    setTestResult(null)
    setDraft((d) => ({ ...d, [key]: e.target.value }))
  }

  const runTest = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await testConnection({ apiKey: draft.apiKey.trim(), model: draft.model.trim() })
    setTestResult(result)
    setTesting(false)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-2xl bg-zinc-900 shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <span className="flex items-center gap-2 font-semibold">
            <IconGear className="text-amber-500" /> Settings
          </span>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800" aria-label="Close">
            <IconClose />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <Field
            label="OpenRouter API key"
            hint={<>Get one at <a className="text-amber-400 underline" href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a>. Stored only in this browser.</>}
          >
            <input
              type="password"
              value={draft.apiKey}
              onChange={set('apiKey')}
              placeholder="sk-or-…"
              autoComplete="off"
              className={inputCls}
            />
          </Field>

          <Field label="Model" hint="Pick a preset below, or type any OpenRouter model id.">
            <input
              type="text"
              value={draft.model}
              onChange={set('model')}
              placeholder="provider/model-name"
              list="model-presets"
              autoComplete="off"
              className={inputCls}
            />
            <datalist id="model-presets">
              {MODEL_PRESETS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </datalist>
          </Field>

          <div className="flex flex-wrap gap-2">
            {MODEL_PRESETS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => {
                  setTestResult(null)
                  setDraft((d) => ({ ...d, model: m.value }))
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  draft.model === m.value
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-zinc-800 p-3">
            <button
              type="button"
              onClick={runTest}
              disabled={testing || !draft.apiKey.trim() || !draft.model.trim()}
              className="w-full rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:border-amber-500 disabled:opacity-40"
            >
              {testing ? 'Testing connection…' : 'Test connection'}
            </button>
            {testResult && (
              <div className="mt-2 text-xs">
                <p className={testResult.ok ? 'text-emerald-400' : 'text-red-400'}>
                  {testResult.ok ? '✓ ' : '✕ '}
                  {testResult.message} · {testResult.latency}
                </p>
                {!testResult.ok && testResult.hint && (
                  <p className="mt-1 text-zinc-500">{testResult.hint}</p>
                )}
              </div>
            )}
            <p className="mt-2 text-[11px] text-zinc-600">
              Sends a 1-token “ping” to the selected model — validates network, key, and model id.
            </p>
          </div>

          <div className="border-t border-zinc-800 pt-4">
            <p className="mb-3 text-sm font-medium text-zinc-300">GitHub deploy (optional)</p>
            <div className="space-y-4">
              <Field label="GitHub username">
                <input
                  type="text"
                  value={draft.ghUser}
                  onChange={set('ghUser')}
                  placeholder="your-username"
                  autoComplete="off"
                  className={inputCls}
                />
              </Field>
              <Field
                label="GitHub personal access token"
                hint={<>Needs <code>repo</code> scope. Create at <a className="text-amber-400 underline" href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">github.com/settings/tokens</a>.</>}
              >
                <input
                  type="password"
                  value={draft.ghPat}
                  onChange={set('ghPat')}
                  placeholder="ghp_…"
                  autoComplete="off"
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-800 p-3">
          <button
            onClick={() => onSave(draft)}
            className="w-full rounded-xl bg-amber-500 px-4 py-3 font-semibold text-zinc-950 active:bg-amber-400"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
