// Inline style.css and script.js into index.html so the result works as a
// standalone document (iframe srcDoc, blob URL, or static host root).

export function buildSrcDoc(files) {
  let html = files['index.html'] || ''
  const css = files['style.css'] || ''
  const js = files['script.js'] || ''

  // drop tags that reference the now-inlined sibling files
  html = html.replace(/<link[^>]*href=["'][^"']*style\.css["'][^>]*>\s*/gi, '')
  html = html.replace(/<script[^>]*src=["'][^"']*script\.js["'][^>]*>\s*<\/script>\s*/gi, '')

  const styleTag = `<style>\n${css}\n</style>`
  const scriptTag = `<script>\n${js}\n</script>`

  if (/<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, `${styleTag}\n</head>`)
  } else {
    html = styleTag + '\n' + html
  }

  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, `${scriptTag}\n</body>`)
  } else {
    html = html + '\n' + scriptTag
  }

  return html
}

export function openBlobPreview(files) {
  const blob = new Blob([buildSrcDoc(files)], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  return url
}
