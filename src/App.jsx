import { useEffect, useRef, useState } from 'react'
import ChatPanel from './components/ChatPanel.jsx'
import PreviewPane from './components/PreviewPane.jsx'
import CodePane from './components/CodePane.jsx'
import LogPane from './components/LogPane.jsx'
import ProjectsDrawer from './components/ProjectsDrawer.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import PublishModal from './components/PublishModal.jsx'
import { generateSite } from './lib/ai'
import { logInfo } from './lib/log'
import {
  createProject,
  loadActiveId,
  loadProjects,
  loadSettings,
  saveActiveId,
  saveProjects,
  saveSettings,
} from './lib/store'
import {
  IconBolt,
  IconChat,
  IconCode,
  IconEye,
  IconGear,
  IconList,
  IconMenu,
  IconRocket,
  IconStop,
  IconUndo,
} from './components/icons.jsx'

const HISTORY_LIMIT = 30
const CHAT_LIMIT = 100

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const fn = (e) => setMatches(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [query])
  return matches
}

export default function App() {
  const [projects, setProjects] = useState(() => {
    const loaded = loadProjects()
    return loaded.length ? loaded : [createProject('My first site')]
  })
  const [activeId, setActiveId] = useState(loadActiveId)
  const [settings, setSettings] = useState(loadSettings)
  const [view, setView] = useState('chat') // mobile bottom-nav tab
  const [rightTab, setRightTab] = useState('preview') // desktop right pane tab
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(null) // {chars, startedAt} while generating
  const abortRef = useRef(null)
  const progressThrottleRef = useRef(0)
  const isDesktop = useMediaQuery('(min-width: 768px)')

  useEffect(() => saveProjects(projects), [projects])
  useEffect(() => saveSettings(settings), [settings])

  const active = projects.find((p) => p.id === activeId) || projects[0]
  const activeProjectId = active?.id
  useEffect(() => saveActiveId(activeProjectId), [activeProjectId])

  const updateProject = (id, patch) => {
    setProjects((ps) =>
      ps.map((p) => {
        if (p.id !== id) return p
        const next = typeof patch === 'function' ? patch(p) : patch
        return { ...p, ...next, updatedAt: Date.now() }
      }),
    )
  }

  const pushChat = (id, msg) =>
    updateProject(id, (p) => ({ chat: [...p.chat, msg].slice(-CHAT_LIMIT) }))

  const sendPrompt = async (text) => {
    if (generating) return
    const proj = active
    if (!settings.apiKey) {
      pushChat(proj.id, {
        role: 'system',
        text: 'Add your OpenRouter API key in Settings first (gear icon, top right).',
        ts: Date.now(),
      })
      setSettingsOpen(true)
      return
    }

    logInfo('prompt', `"${text.length > 80 ? text.slice(0, 80) + '…' : text}"`)

    // snapshot current files so Revert can restore the state before this prompt
    updateProject(proj.id, (p) => ({
      history: [...p.history, { ...p.files }].slice(-HISTORY_LIMIT),
      chat: [...p.chat, { role: 'user', text, ts: Date.now() }].slice(-CHAT_LIMIT),
    }))

    const controller = new AbortController()
    abortRef.current = controller
    setGenerating(true)
    setProgress({ content: '', reasoning: '', startedAt: Date.now() })
    try {
      const result = await generateSite({
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        model: settings.model,
        prompt: text,
        currentFiles: proj.files,
        signal: controller.signal,
        extraParams: settings.extraParams,
        timeoutMs: (Number(settings.timeoutSecs) || 600) * 1000,
        onProgress: ({ content, reasoning }) => {
          const now = Date.now()
          if (now - progressThrottleRef.current > 120) {
            progressThrottleRef.current = now
            setProgress((p) => (p ? { ...p, content, reasoning } : p))
          }
        },
      })
      const meta = [
        settings.model,
        `${(result.elapsedMs / 1000).toFixed(1)}s`,
        result.usage?.total_tokens ? `${result.usage.total_tokens.toLocaleString()} tokens` : null,
      ]
        .filter(Boolean)
        .join(' · ')
      updateProject(proj.id, (p) => ({
        files: result.files,
        chat: [
          ...p.chat,
          {
            role: 'assistant',
            text: 'Site updated — check the preview.',
            meta,
            // cap stored thinking so localStorage stays healthy
            reasoning: result.reasoning ? result.reasoning.slice(0, 30_000) : '',
            ts: Date.now(),
          },
        ].slice(-CHAT_LIMIT),
      }))
      if (!isDesktop) setView('preview')
    } catch (e) {
      // generation failed or was halted: files never changed, so drop the snapshot
      const msg =
        e.name === 'AbortError'
          ? { role: 'system', text: 'Generation halted.', ts: Date.now() }
          : {
              role: 'error',
              text: e.message,
              hint: e.hint || 'Technical details are in the Log tab.',
              retry: text,
              ts: Date.now(),
            }
      updateProject(proj.id, (p) => ({
        history: p.history.slice(0, -1),
        chat: [...p.chat, msg].slice(-CHAT_LIMIT),
      }))
    } finally {
      setGenerating(false)
      setProgress(null)
      abortRef.current = null
    }
  }

  const halt = () => abortRef.current?.abort()

  const revert = () => {
    if (!active || generating) return
    updateProject(active.id, (p) => {
      if (p.history.length === 0) return p
      const previous = p.history[p.history.length - 1]
      return {
        files: previous,
        history: p.history.slice(0, -1),
        chat: [...p.chat, { role: 'system', text: 'Reverted to the previous version.', ts: Date.now() }].slice(-CHAT_LIMIT),
      }
    })
  }

  const addProject = () => {
    const p = createProject(`Site ${projects.length + 1}`)
    setProjects((ps) => [...ps, p])
    setActiveId(p.id)
    setDrawerOpen(false)
    setView('chat')
  }

  const renameProject = (id) => {
    const p = projects.find((x) => x.id === id)
    const name = window.prompt('Project name', p?.name || '')
    if (name?.trim()) updateProject(id, { name: name.trim() })
  }

  const deleteProject = (id) => {
    const p = projects.find((x) => x.id === id)
    if (!window.confirm(`Delete “${p?.name}”? This cannot be undone.`)) return
    setProjects((ps) => {
      const next = ps.filter((x) => x.id !== id)
      if (next.length === 0) next.push(createProject('My first site'))
      if (id === activeId || !next.some((x) => x.id === activeId)) setActiveId(next[0].id)
      return next
    })
  }

  const rightView = isDesktop ? rightTab : view

  if (!active) return null

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-zinc-800 bg-zinc-900 px-2">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800"
          aria-label="Open projects"
        >
          <IconMenu />
        </button>
        <IconBolt className="shrink-0 text-amber-500" width={22} height={22} />
        <p className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">{active.name}</p>

        {generating && (
          <button
            onClick={halt}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-sm font-medium text-white active:bg-red-500"
          >
            <IconStop width={16} height={16} /> Halt
          </button>
        )}
        <button
          onClick={revert}
          disabled={active.history.length === 0 || generating}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
          title="Revert to previous version"
          aria-label="Revert to previous version"
        >
          <IconUndo />
        </button>
        <button
          onClick={() => setPublishOpen(true)}
          className="flex h-10 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-sm font-semibold text-zinc-950 active:bg-amber-400"
        >
          <IconRocket width={16} height={16} />
          <span className="hidden sm:inline">Publish</span>
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800"
          aria-label="Settings"
        >
          <IconGear />
        </button>
      </header>

      <main className="flex min-h-0 flex-1">
        <section
          className={`${
            view === 'chat' ? 'flex' : 'hidden'
          } min-h-0 flex-1 flex-col md:flex md:w-[380px] md:flex-none md:border-r md:border-zinc-800`}
        >
          <ChatPanel
            chat={active.chat}
            generating={generating}
            progress={progress}
            onSend={sendPrompt}
            onHalt={halt}
            onRetry={sendPrompt}
          />
        </section>

        <section
          className={`${view !== 'chat' ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col md:flex`}
        >
          <div className="hidden border-b border-zinc-800 bg-zinc-900 md:flex">
            {['preview', 'code', 'log'].map((tab) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`px-4 py-2 text-xs font-medium uppercase tracking-wide ${
                  rightTab === tab
                    ? 'border-b-2 border-amber-500 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className={rightView === 'preview' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
            <PreviewPane projectId={active.id} files={active.files} />
          </div>
          <div className={rightView === 'code' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
            <CodePane files={active.files} onChange={(files) => updateProject(active.id, { files })} />
          </div>
          <div className={rightView === 'log' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
            <LogPane />
          </div>
        </section>
      </main>

      <nav
        className="flex shrink-0 border-t border-zinc-800 bg-zinc-900 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {[
          { key: 'chat', label: 'Chat', Icon: IconChat },
          { key: 'preview', label: 'Preview', Icon: IconEye },
          { key: 'code', label: 'Code', Icon: IconCode },
          { key: 'log', label: 'Log', Icon: IconList },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
              view === key ? 'text-amber-400' : 'text-zinc-500'
            }`}
          >
            <Icon width={20} height={20} />
            {label}
          </button>
        ))}
      </nav>

      <ProjectsDrawer
        open={drawerOpen}
        projects={projects}
        activeId={active.id}
        onClose={() => setDrawerOpen(false)}
        onSelect={(id) => {
          setActiveId(id)
          setDrawerOpen(false)
          setView('chat')
        }}
        onCreate={addProject}
        onRename={renameProject}
        onDelete={deleteProject}
      />
      <SettingsModal
        key={String(settingsOpen)}
        open={settingsOpen}
        settings={settings}
        onSave={(s) => {
          setSettings(s)
          setSettingsOpen(false)
        }}
        onClose={() => setSettingsOpen(false)}
      />
      <PublishModal
        key={String(publishOpen) + active.id}
        open={publishOpen}
        project={active}
        settings={settings}
        onClose={() => setPublishOpen(false)}
      />
    </div>
  )
}
