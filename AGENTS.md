# bolt-pocket — agent notes

Pocket AI website builder. React 18 + Vite 5 + Tailwind 3, fully client-side, no backend.

## Commands
- `npm install` / `npm run dev` / `npm run build` (build output: `dist/`, vite `base: './'` for GitHub Pages)

## Architecture
- `src/lib/store.js` — localStorage (`boltpocket.projects.v1`, `boltpocket.settings.v1`). Project shape: `{id, name, files: {index.html, style.css, script.js}, history: [], chat: []}`. History holds pre-generation snapshots (cap 30); chat capped at 100.
- `src/lib/ai.js` — OpenRouter `POST /api/v1/chat/completions` with `stream: true` (SSE parsed in `readStream`, tolerant of chunk-split lines). System prompt must stay exactly: `Return ONLY JSON {"files": {"index.html": "...", "style.css": "...", "script.js": "..."}}`. Errors surface as `GenerationError(message, hint, phase)`; 180s timeout via internal AbortController (user halt = external signal). `testConnection()` = 1-token probe used by Settings.
- `src/lib/log.js` — ring-buffer activity log (localStorage `boltpocket.log.v1`, 200 entries) with pub/sub; viewed in the Log tab (`LogPane.jsx`). Log phases: prompt/request/connected/stream/parse/done, test, deploy.
- `src/lib/preview.js` — builds iframe srcDoc by inlining style.css/script.js into index.html (strips sibling link/script tags).
- `src/lib/github.js` — PAT-based deploy: ensure repo (auto-creates for PAT owner), PUT contents per file (sha-aware), POST /pages.
- `src/App.jsx` — all state; `useMediaQuery('(min-width: 768px)')` switches mobile tabs vs desktop split.

## Constraints / gotchas
- Mobile-first dark UI (zinc-950 + amber-500). Bottom nav on <md, safe-area inset padding.
- The session GITHUB_TOKEN is an app-integration token with NO repo permissions: cannot create repos or push. Pushing requires a user PAT (repo scope) — ask the user for one.
- GitHub Pages for this repo must use "GitHub Actions" source (workflow: `.github/workflows/deploy.yml`); can be set via API: `POST /repos/{owner}/{repo}/pages` with `{"build_type": "workflow", "source": {"branch": "main", "path": "/"}}`.
