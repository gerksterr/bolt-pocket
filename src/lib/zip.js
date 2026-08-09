import JSZip from 'jszip'
import { FILE_NAMES } from './store'

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'site'
  )
}

export async function downloadZip(project) {
  const zip = new JSZip()
  for (const name of FILE_NAMES) {
    zip.file(name, project.files[name] || '')
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slugify(project.name)}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
