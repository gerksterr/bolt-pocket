import { useEffect, useRef, useState } from 'react'
import { clearLogs, getLogs, subscribeLogs } from '../lib/log'
import { IconTrash } from './icons.jsx'

const LEVEL_COLOR = {
  info: 'text-zinc-500',
  ok: 'text-emerald-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour12: false })
}

export default function LogPane() {
  const [entries, setEntries] = useState(getLogs)
  const [copied, setCopied] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => subscribeLogs(setEntries), [])
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries])

  const copy = async () => {
    const text = entries
      .map((e) => `[${new Date(e.ts).toISOString()}] ${e.level.toUpperCase()} ${e.step} — ${e.detail}`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Build log · {entries.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={copy}
            disabled={entries.length === 0}
            className="flex h-9 items-center rounded-lg px-3 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={clearLogs}
            disabled={entries.length === 0}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-red-300 disabled:opacity-30"
            title="Clear log"
            aria-label="Clear log"
          >
            <IconTrash width={15} height={15} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto py-2 font-mono text-xs">
        {entries.length === 0 && (
          <p className="p-4 font-sans text-sm text-zinc-500">
            Nothing logged yet. Every generation is traced here — request, connection, streaming
            progress, parsing, and errors — and kept between sessions.
          </p>
        )}
        {entries.map((e, i) => (
          <div key={i} className="flex gap-2 px-3 py-1">
            <span className="shrink-0 text-zinc-600">{formatTime(e.ts)}</span>
            <span className={`w-16 shrink-0 font-semibold ${LEVEL_COLOR[e.level] || 'text-zinc-400'}`}>
              {e.step}
            </span>
            <span className="min-w-0 break-words text-zinc-400">{e.detail}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
