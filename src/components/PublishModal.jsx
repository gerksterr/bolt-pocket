import { useState } from 'react'
import { openBlobPreview } from '../lib/preview'
import { downloadZip } from '../lib/zip'
import { deployToGitHubPages } from '../lib/github'
import { logError, logInfo, logOk } from '../lib/log'
import { IconClose, IconDownload, IconExternal, IconGithub, IconRocket } from './icons.jsx'

const inputCls =
  'w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none'

export default function PublishModal({ open, project, settings, onClose }) {
  const [owner, setOwner] = useState(settings.ghUser || '')
  const [repo, setRepo] = useState('')
  const [pat, setPat] = useState(settings.ghPat || '')
  const [logLines, setLogLines] = useState([])
  const [deploying, setDeploying] = useState(false)
  const [siteUrl, setSiteUrl] = useState('')

  if (!open) return null

  const log = (msg) => {
    setLogLines((l) => [...l, msg])
    if (msg.startsWith('Error')) logError('deploy', msg)
    else logInfo('deploy', msg)
  }

  const deploy = async () => {
    setDeploying(true)
    setLogLines([])
    setSiteUrl('')
    try {
      const url = await deployToGitHubPages({
        pat: pat.trim(),
        owner: owner.trim(),
        repo: repo.trim(),
        files: project.files,
        onLog: log,
      })
      setSiteUrl(url)
      log('Done! Site is building — it can take 1–2 minutes to go live.')
      logOk('deploy', `live at ${url}`)
    } catch (e) {
      log(`Error: ${e.message}`)
    } finally {
      setDeploying(false)
    }
  }

  const canDeploy = pat.trim() && owner.trim() && repo.trim() && !deploying

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-2xl bg-zinc-900 shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <span className="flex items-center gap-2 font-semibold">
            <IconRocket className="text-amber-500" /> Publish “{project.name}”
          </span>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800" aria-label="Close">
            <IconClose />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => openBlobPreview(project.files)}
              className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 py-3 text-sm font-medium text-zinc-100 hover:border-amber-500"
            >
              <IconExternal width={16} height={16} /> Instant preview
            </button>
            <button
              onClick={() => downloadZip(project)}
              className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 py-3 text-sm font-medium text-zinc-100 hover:border-amber-500"
            >
              <IconDownload width={16} height={16} /> Download ZIP
            </button>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-400">
            <p className="mb-2 font-medium text-zinc-200">Free hosting — drag &amp; drop the ZIP (or its files):</p>
            <ul className="list-inside list-disc space-y-1">
              <li><a className="text-amber-400 underline" href="https://app.netlify.com/drop" target="_blank" rel="noreferrer">Netlify Drop</a> — drop the files, get a URL instantly</li>
              <li><a className="text-amber-400 underline" href="https://pages.cloudflare.com/" target="_blank" rel="noreferrer">Cloudflare Pages</a> — create a project → “Direct upload”</li>
              <li><a className="text-amber-400 underline" href="https://pages.github.com/" target="_blank" rel="noreferrer">GitHub Pages</a> — push files, enable Pages in repo settings</li>
            </ul>
          </div>

          <div className="rounded-xl border border-zinc-800 p-3">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-200">
              <IconGithub width={16} height={16} /> Deploy straight to GitHub Pages
            </p>
            <div className="space-y-2">
              <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="GitHub username" autoComplete="off" className={inputCls} />
              <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="repo name (created if missing)" autoComplete="off" className={inputCls} />
              <input value={pat} onChange={(e) => setPat(e.target.value)} placeholder="personal access token (repo scope)" type="password" autoComplete="off" className={inputCls} />
              <button
                onClick={deploy}
                disabled={!canDeploy}
                className="w-full rounded-xl bg-amber-500 px-4 py-3 font-semibold text-zinc-950 disabled:opacity-40 active:bg-amber-400"
              >
                {deploying ? 'Deploying…' : 'Deploy to GitHub Pages'}
              </button>
            </div>
            {logLines.length > 0 && (
              <div className="mt-3 max-h-36 overflow-y-auto rounded-lg bg-zinc-950 p-2 font-mono text-xs text-zinc-400">
                {logLines.map((l, i) => (
                  <p key={i}>{l}</p>
                ))}
                {siteUrl && (
                  <p className="mt-1">
                    → <a className="text-amber-400 underline" href={siteUrl} target="_blank" rel="noreferrer">{siteUrl}</a>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
