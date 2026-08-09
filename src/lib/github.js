// Deploy the three site files to a GitHub repo and enable GitHub Pages,
// using a user-supplied personal access token (repo scope).

const API = 'https://api.github.com'

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

async function gh(pat, path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  return res
}

async function ensureRepo(pat, owner, repo, log) {
  const res = await gh(pat, `/repos/${owner}/${repo}`)
  if (res.ok) return
  if (res.status !== 404) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `Cannot access repo (${res.status})`)
  }
  log('Repo not found — creating it…')
  const me = await gh(pat, '/user')
  if (!me.ok) throw new Error('Bad GitHub token (check the PAT)')
  const { login } = await me.json()
  if (login.toLowerCase() !== owner.toLowerCase()) {
    throw new Error(`Repo ${owner}/${repo} doesn't exist. Create it on github.com first (only your own repos can be auto-created).`)
  }
  const created = await gh(pat, '/user/repos', {
    method: 'POST',
    body: JSON.stringify({ name: repo, private: false, auto_init: true }),
  })
  if (!created.ok) {
    const body = await created.json().catch(() => ({}))
    throw new Error(body.message || 'Failed to create repo')
  }
  log(`Created repo ${owner}/${repo}`)
}

async function putFile(pat, owner, repo, path, content, log) {
  let sha
  const existing = await gh(pat, `/repos/${owner}/${repo}/contents/${path}`)
  if (existing.ok) {
    sha = (await existing.json()).sha
  }
  const res = await gh(pat, `/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Deploy ${path} from bolt-pocket`,
      content: utf8ToBase64(content),
      ...(sha ? { sha } : {}),
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `Failed to upload ${path}`)
  }
  log(`Uploaded ${path}`)
}

async function enablePages(pat, owner, repo, log) {
  const res = await gh(pat, `/repos/${owner}/${repo}/pages`, {
    method: 'POST',
    body: JSON.stringify({ source: { branch: 'main', path: '/' } }),
  })
  if (res.ok || res.status === 409) {
    log('GitHub Pages enabled (branch: main)')
    return
  }
  const body = await res.json().catch(() => ({}))
  throw new Error(body.message || 'Failed to enable GitHub Pages')
}

export async function deployToGitHubPages({ pat, owner, repo, files, onLog }) {
  const log = (msg) => onLog?.(msg)
  await ensureRepo(pat, owner, repo, log)
  for (const [path, content] of Object.entries(files)) {
    await putFile(pat, owner, repo, path, content, log)
  }
  await enablePages(pat, owner, repo, log)
  return `https://${owner}.github.io/${repo}/`
}
