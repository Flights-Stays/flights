# template-standalone

The standalone-app template used by [`pas create`](https://proappstore.online/docs) to scaffold new Pro apps for [ProAppStore](https://proappstore.online).

You almost certainly want to use the CLI, not clone this directly:

```bash
npm i -g @proappstore/cli
pas init my-app
```

The CLI clones this template, replaces every `flights` placeholder with your app id, runs `git init`, and makes the first commit — the result is a runnable app you can `pnpm dev` immediately.

## What's in here

- `web/` — Vite + React + TypeScript app, ESM-only, Tailwind 4 via CSS variables.
- `web/src/App.tsx` — Starter component with `initPro()` + `useProAuth()`.
- `web/src/index.css` — Platform design system (Manrope + Fraunces fonts, full light/dark theme tokens).
- `web/index.html` — PWA meta tags, font preloading, analytics script.
- `package.json` — pnpm workspace, `dev` / `build` / `typecheck` scripts. `prebuild` runs platform compliance check.
- `.github/workflows/` — deploy (CF Pages), compliance (MIT + brand + PWA), CI (typecheck).

## Scaffolding manually

If you really want to scaffold by hand:

```bash
cp -r ~/dev/stores/pas/templates/template-standalone my-app
cd my-app
find . -type f \( -name "*.json" -o -name "*.tsx" -o -name "*.ts" -o -name "*.html" -o -name "*.md" -o -name "*.yaml" \) \
  -not -path "*/node_modules/*" -exec sed -i '' "s/flights/my-app/g" {} \;
rm -rf .git && git init
pnpm install && pnpm dev
```

## License

MIT.
