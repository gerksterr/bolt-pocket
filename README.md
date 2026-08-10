# bolt-pocket ⚡

A pocket AI website builder — describe a site in chat, get a live preview, publish anywhere.
Built for phones first: single-page React app, dark UI, 100% client-side, no backend.

## Features

- **Chat-to-website**: prompts go to any OpenAI-compatible endpoint (your API key, stored only in your browser). One-tap providers: [OpenRouter](https://openrouter.ai), Moonshot AI direct (Kimi), OpenAI — or type any custom base URL. Model presets adapt to the provider, or type any model id.
- **Extra request parameters**: merge arbitrary JSON into every request — OpenRouter `provider` routing (`only`, `allow_fallbacks`, `sort`), `reasoning` effort, `response_format`, sampling — with one-tap templates and live validation.
- **Multi-project**: unlimited sites in localStorage — `{id, name, files: {index.html, style.css, script.js}, history, chat}`.
- **Halt** a generation mid-flight (AbortController) and **Revert** to the previous version (snapshot taken before every prompt).
- **Live stream view**: watch the model work in real time — **Thinking** (reasoning tokens, streamed separately and stored on the message for later replay) and **Output** (raw response) scroll live in the chat bubble, with token usage stats when the provider reports them. Reasoning is requested automatically (`reasoning: enabled`) unless your extra parameters say otherwise.
- **Live diagnostics**: a persistent **Build Log** tab traces every phase — request, connect, first thinking/output tokens, stream milestones, parsing, file sizes, token usage, deploy steps — with timestamps. Errors are mapped to actionable hints (401 → check key, 402 → credits, 404 → model id, 429 → rate limit, "failed to fetch" → blocker/DNS/VPN guidance) with one-tap **Retry**. Settings has a **Test connection** probe (1-token ping) to validate network + key + model before generating.
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
