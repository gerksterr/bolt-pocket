const PROJECTS_KEY = 'boltpocket.projects.v1'
const SETTINGS_KEY = 'boltpocket.settings.v1'
const ACTIVE_KEY = 'boltpocket.active.v1'

export const FILE_NAMES = ['index.html', 'style.css', 'script.js']

export const DEFAULT_FILES = {
  'index.html': `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My site</title>
</head>
<body>
  <main class="hero">
    <h1>Hello from bolt-pocket ⚡</h1>
    <p>Describe the site you want in the chat, and it will appear here.</p>
    <button id="cta">Click me</button>
  </main>
</body>
</html>
`,
  'style.css': `body { margin: 0; font-family: system-ui, sans-serif; background: #09090b; color: #fafafa; }
.hero { min-height: 100vh; display: grid; place-content: center; text-align: center; gap: 12px; padding: 24px; }
#cta { justify-self: center; padding: 12px 24px; border: 0; border-radius: 999px; background: #f59e0b; color: #09090b; font-weight: 700; cursor: pointer; }
`,
  'script.js': `document.getElementById('cta').addEventListener('click', () => {
  alert('It works! ⚡')
})
`,
}

export const DEFAULT_SETTINGS = {
  apiKey: '',
  model: 'deepseek/deepseek-chat',
  ghPat: '',
  ghUser: '',
  timeoutSecs: 600,
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function createProject(name = 'Untitled site') {
  return {
    id: uid(),
    name,
    files: { ...DEFAULT_FILES },
    history: [],
    chat: [],
    updatedAt: Date.now(),
  }
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('localStorage write failed', e)
  }
}

export function loadProjects() {
  const list = read(PROJECTS_KEY, [])
  return Array.isArray(list) ? list : []
}

export function saveProjects(projects) {
  write(PROJECTS_KEY, projects)
}

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) }
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings)
}

export function loadActiveId() {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function saveActiveId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {
    /* ignore */
  }
}
