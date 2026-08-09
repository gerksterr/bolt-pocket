# bolt-pocket ⚡

A pocket AI website builder — describe a site in chat, get a live preview, publish anywhere.
Built for phones first: single-page React app, dark UI, 100% client-side, no backend.

## Features

- **Chat-to-website**: prompts go to any [OpenRouter](https://openrouter.ai) model (your API key, stored only in your browser). Presets: DeepSeek V4 Flash, Kimi K3, Claude 3.5 Sonnet, GPT-4o mini, Gemini 2.0 Flash — or type any model id.
- **Multi-project**: unlimited sites in localStorage — `{id, name, files: {index.html, style.css, script.js}, history, chat}`.
- **Halt** a generation mid-flight (AbortController) and **Revert** to the previous version (snapshot taken before every prompt).
- **Live diagnostics**: responses stream token-by-token with progress in chat (chars + elapsed), and a persistent **Build Log** tab traces every phase — request, connect, first token, streaming, parsing, file sizes, deploy steps — with timestamps. Errors are mapped to actionable hints (401 → check key, 402 → credits, 404 → model id, 429 → rate limit, "failed to fetch" → blocker/DNS/VPN guidance) with one-tap **Retry**. Settings has a **Test connection** probe (1-token ping) to validate network + key + model before generating.
- **Live preview** iframe (`srcDoc` with inlined CSS/JS) plus a full code editor for the three files.
- **Publish**: instant blob-URL preview, ZIP download, copy-paste instructions for Netlify Drop / Cloudflare Pages / GitHub Pages, or one-tap deploy to GitHub Pages via the API with a personal access token.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # outputs dist/ with relative asset paths (base: './')
```

## Deploy

Push to `main` — the included GitHub Actions workflow builds and publishes to GitHub Pages.
On first use, enable it in the repo: **Settings → Pages → Source: GitHub Actions**.
