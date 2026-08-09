import { useState } from 'react'
import { FILE_NAMES } from '../lib/store'

export default function CodePane({ files, onChange }) {
  const [active, setActive] = useState('index.html')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex border-b border-zinc-800 bg-zinc-900">
        {FILE_NAMES.map((name) => (
          <button
            key={name}
            onClick={() => setActive(name)}
            className={`px-4 py-2.5 text-xs font-medium ${
              active === name
                ? 'border-b-2 border-amber-500 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      <textarea
        value={files[active] || ''}
        onChange={(e) => onChange({ ...files, [active]: e.target.value })}
        spellCheck={false}
        className="min-h-0 flex-1 w-full resize-none bg-zinc-950 p-3 font-mono text-[13px] leading-relaxed text-zinc-200 focus:outline-none"
      />
    </div>
  )
}
