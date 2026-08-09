import { useEffect, useRef, useState } from 'react'
import { IconRefresh, IconSend, IconStop } from './icons.jsx'

function ProgressBubble({ progress }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 500)
    return () => clearInterval(t)
  }, [])
  const secs = progress ? Math.max(0, Math.floor((Date.now() - progress.startedAt) / 1000)) : 0
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-zinc-800 px-3.5 py-2 text-sm text-zinc-300">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          Generating… {(progress?.chars || 0).toLocaleString()} chars · {secs}s
        </span>
        <p className="mt-1 text-[11px] text-zinc-500">Follow along in the Log tab</p>
      </div>
    </div>
  )
}

export default function ChatPanel({ chat, generating, progress, onSend, onHalt, onRetry }) {
  const [text, setText] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat, generating])

  const submit = () => {
    const value = text.trim()
    if (!value || generating) return
    setText('')
    onSend(value)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-3">
        {chat.length === 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
            <p className="font-medium text-zinc-200">Describe the website you want to build.</p>
            <p className="mt-1">
              e.g. “A landing page for my dog-walking business with pricing and a contact form.”
              Every prompt rewrites the site — ask for changes step by step.
            </p>
          </div>
        )}
        {chat.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={
                m.role === 'user'
                  ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-amber-500 px-3.5 py-2 text-sm text-zinc-950'
                  : m.role === 'error'
                    ? 'max-w-[85%] rounded-2xl rounded-bl-sm bg-red-950 border border-red-800 px-3.5 py-2 text-sm text-red-200'
                    : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-zinc-800 px-3.5 py-2 text-sm text-zinc-100'
              }
            >
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
              {m.hint && <p className="mt-1 text-xs text-red-300/80">{m.hint}</p>}
              {m.role === 'error' && m.retry && onRetry && (
                <button
                  onClick={() => onRetry(m.retry)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-red-900 px-2.5 py-1.5 text-xs font-medium text-red-100 active:bg-red-800"
                >
                  <IconRefresh width={12} height={12} /> Retry prompt
                </button>
              )}
              {m.meta && <p className="mt-1 text-[11px] opacity-60">{m.meta}</p>}
            </div>
          </div>
        ))}
        {generating && <ProgressBubble progress={progress} />}
      </div>

      <div className="border-t border-zinc-800 bg-zinc-900 p-2">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            rows={2}
            placeholder="Describe your site or a change…"
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          {generating ? (
            <button
              onClick={onHalt}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white active:bg-red-500"
              title="Halt generation"
              aria-label="Halt generation"
            >
              <IconStop />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!text.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-zinc-950 disabled:opacity-40 active:bg-amber-400"
              title="Send"
              aria-label="Send prompt"
            >
              <IconSend />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
