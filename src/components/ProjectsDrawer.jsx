import { IconBolt, IconClose, IconPencil, IconPlus, IconTrash } from './icons.jsx'

export default function ProjectsDrawer({ open, projects, activeId, onClose, onSelect, onCreate, onRename, onDelete }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <span className="flex items-center gap-2 font-semibold">
            <IconBolt className="text-amber-500" /> Projects
          </span>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800" aria-label="Close">
            <IconClose />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {projects.map((p) => (
            <div
              key={p.id}
              className={`group mb-1 flex items-center gap-1 rounded-xl px-3 py-2.5 ${
                p.id === activeId ? 'bg-zinc-800' : 'hover:bg-zinc-800/60'
              }`}
            >
              <button onClick={() => onSelect(p.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-zinc-100">{p.name}</p>
                <p className="text-[11px] text-zinc-500">
                  {new Date(p.updatedAt).toLocaleString()} · {p.history.length} version{p.history.length === 1 ? '' : 's'}
                </p>
              </button>
              <button
                onClick={() => onRename(p.id)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-700 hover:text-zinc-200"
                aria-label={`Rename ${p.name}`}
              >
                <IconPencil width={15} height={15} />
              </button>
              <button
                onClick={() => onDelete(p.id)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-950 hover:text-red-300"
                aria-label={`Delete ${p.name}`}
              >
                <IconTrash width={15} height={15} />
              </button>
            </div>
          ))}
          {projects.length === 0 && (
            <p className="p-4 text-sm text-zinc-500">No projects yet.</p>
          )}
        </div>

        <div className="border-t border-zinc-800 p-3">
          <button
            onClick={onCreate}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 font-semibold text-zinc-950 active:bg-amber-400"
          >
            <IconPlus /> New project
          </button>
        </div>
      </div>
    </div>
  )
}
