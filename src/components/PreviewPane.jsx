import { useMemo, useState } from 'react'
import { buildSrcDoc, openBlobPreview } from '../lib/preview'
import { IconExternal, IconRefresh } from './icons.jsx'

export default function PreviewPane({ files }) {
  const [nonce, setNonce] = useState(0)
  const srcDoc = useMemo(() => buildSrcDoc(files), [files, nonce])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Preview</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setNonce((n) => n + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            title="Reload preview"
            aria-label="Reload preview"
          >
            <IconRefresh width={16} height={16} />
          </button>
          <button
            onClick={() => openBlobPreview(files)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            title="Open in new tab"
            aria-label="Open preview in new tab"
          >
            <IconExternal width={16} height={16} />
          </button>
        </div>
      </div>
      <iframe
        key={nonce}
        title="Site preview"
        sandbox="allow-scripts allow-modals"
        srcDoc={srcDoc}
        className="min-h-0 flex-1 w-full border-0 bg-white"
      />
    </div>
  )
}
