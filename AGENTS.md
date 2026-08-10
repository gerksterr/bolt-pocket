# bolt-pocket — agent notes

Pocket AI website builder. React 18 + Vite 5 + Tailwind 3, fully client-side, no backend.

## Commands
- `npm install` / `npm run dev` / `npm run build` (build output: `dist/`, vite `base: './'` for GitHub Pages)

## Architecture
- `src/lib/store.js` — localStorage (`boltpocket.projects.v1`, `boltpocket.settings.v1`). Project shape: `{id, name, files: {index.html, style.css, script.js}, history: [], chat: []}`. History holds pre-generation snapshots (cap 30); chat capped at 100.
- `src/lib/ai.js` — `POST {baseUrl}/chat/completions` with `stream: true` against any OpenAI-compatible endpoint (`settings.baseUrl`, default OpenRouter; `BASE_URL_PRESETS` carry per-provider `defaultModel`; Moonshot users get `MOONSHOT_MODEL_PRESETS` chips). OpenRouter attribution headers are only sent to openrouter.ai hosts. `settings.extraParams` is a free-form JSON string parsed (`parseExtras`, throws `GenerationError('settings')` on invalid) and spread into the request body BEFORE app-controlled keys — `model`/`messages`/`stream`/`max_tokens` always win, everything else (`provider` routing, `reasoning`, `response_format`, sampling…) passes through; `EXTRA_PARAM_TEMPLATES` are one-tap inserts (deep-merged in SettingsModal). SSE parsed in `readStream` (exported, tolerant of chunk-split lines): content, reasoning (`delta.reasoning` OpenRouter / `delta.reasoning_content` DeepSeek/Moonshot) and `usage` are accumulated separately; request injects `reasoning: {enabled: true}` unless extras define it, plus `usage: {include: true}` on OpenRouter. generateSite returns `{files, reasoning, usage, elapsedMs}`; reasoning is stored on the assistant chat message (30k cap) and replayable via `<details>`; live Thinking/Output blocks stream in ChatPanel's ProgressBubble (`progress = {content, reasoning, startedAt}`). System prompt must stay exactly: `Return ONLY JSON {"files": {"index.html": "...", "style.css": "...", "script.js": "..."}}`. Errors surface as `GenerationError(message, hint, phase)`; messages stay provider-agnostic (use `endpointHost`). Two abort limits via internal controller, distinguished by `abortReason`: user-configurable TOTAL limit (`settings.timeoutSecs`, default 600s) and a fixed 120s idle watchdog reset on every received chunk (keep-alives count). Do NOT revert to a single absolute timer — long generations that stream the whole time were being killed at 180s. `testConnection()` = 1-token probe used by Settings.
- `PreviewPane` — iframe MUST stay declarative: `key={projectId:stamp}` + `srcDoc` attribute. An earlier imperative `iframe.srcdoc = …` effect with a shared frame risked stale previews on project switches.
- Active project id persists in localStorage `boltpocket.active.v1` (loadActiveId/saveActiveId).
- `src/lib/log.js` — ring-buffer activity log (localStorage `boltpocket.log.v1`, 200 entries) with pub/sub; viewed in the Log tab (`LogPane.jsx`). Log phases: prompt/request/connected/stream/parse/done, test, deploy.
- `src/lib/preview.js` — builds iframe srcDoc by inlining style.css/script.js into index.html (strips sibling link/script tags).
- `src/lib/github.js` — PAT-based deploy: ensure repo (auto-creates for PAT owner), PUT contents per file (sha-aware), POST /pages.
- `src/App.jsx` — all state; `useMediaQuery('(min-width: 768px)')` switches mobile tabs vs desktop split.

## Constraints / gotchas
- Mobile-first dark UI (zinc-950 + amber-500). Bottom nav on <md, safe-area inset padding.
- The session GITHUB_TOKEN is an app-integration token with NO repo permissions: cannot create repos or push. Pushing requires a user PAT (repo scope) — ask the user for one.
- GitHub Pages for this repo must use "GitHub Actions" source (workflow: `.github/workflows/deploy.yml`); can be set via API: `POST /repos/{owner}/{repo}/pages` with `{"build_type": "workflow", "source": {"branch": "main", "path": "/"}}`.
