// App-wide activity log: in-memory ring buffer persisted to localStorage,
// with pub/sub so the LogPane can follow generation live.

const LOG_KEY = 'boltpocket.log.v1'
const MAX_ENTRIES = 200

function load() {
  try {
    const raw = localStorage.getItem(LOG_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

let entries = load()
const listeners = new Set()

function emit() {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(entries))
  } catch {
    /* quota — keep in-memory copy */
  }
  listeners.forEach((fn) => fn(entries))
}

export function log(level, step, detail) {
  entries = [...entries, { ts: Date.now(), level, step, detail }].slice(-MAX_ENTRIES)
  emit()
}

export const logInfo = (step, detail) => log('info', step, detail)
export const logOk = (step, detail) => log('ok', step, detail)
export const logWarn = (step, detail) => log('warn', step, detail)
export const logError = (step, detail) => log('error', step, detail)

export function getLogs() {
  return entries
}

export function clearLogs() {
  entries = []
  emit()
}

export function subscribeLogs(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
