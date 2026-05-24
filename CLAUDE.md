# flights (Pro)

A Pro app on ProAppStore.

- Subdomain: `flights.proappstore.online`
- Dev: `pnpm install && pnpm dev`
- Build: `pnpm build` (runs platform compliance check via prebuild)
- Deploy: `git push origin main` (auto-deploys via Cloudflare Pages)

For platform conventions, read SKILLS.md:
https://raw.githubusercontent.com/proappstore-online/proappstore/main/SKILLS.md

## SDK

This app uses `@proappstore/sdk`. Available modules:

**Core:**
- `app.auth` — GitHub OAuth sign-in (SSO across all apps)
- `app.kv` — per-user storage (10MB, 100 keys)
- `app.counters` — atomic shared counters
- `app.rooms` — real-time WebSocket rooms
- `app.proxy` — secret-injecting API proxy
- `app.roles` — app-level RBAC
- `app.email` — transactional email (100/day)
- `app.webhooks` — outbound webhook management

**Data & storage:**
- `app.db` — per-app D1 SQL database (query, execute, batch, migrate)
- `app.storage` — file uploads to R2 (private + public URLs)

**Services:**
- `app.subscription` — Stripe checkout + portal + entitlements
- `app.license` — license key generation + validation
- `app.maps` — geocoding, routing, embeds (OpenStreetMap, no API key needed)
- `app.notifications` — Web Push (subscribe, send, broadcast)
- `app.sms` — SMS via Twilio
- `app.ai` — Workers AI (text generation, chat, embeddings)
- `app.usage` — usage tracking for payout calculations

Types: `import type { User, QueryResult, ExecuteResult } from '@proappstore/sdk'`
Hooks: `import { useProAuth, useTheme } from '@proappstore/sdk/hooks'`
UI: `import { ProShell, Avatar, ProBadge } from '@proappstore/sdk/ui'`

## Database

All database operations require the user to be signed in. There is no anonymous/public read access.

```ts
// Schema migrations (run lazily, tracked by name)
await app.db.migrate([
  { name: '0001_init', sql: 'CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at INTEGER NOT NULL)' },
])

// Queries
const { rows } = await app.db.query<MyType>('SELECT * FROM items WHERE id = ?', [id])
const { meta } = await app.db.execute('INSERT INTO items (id, title, created_at) VALUES (?,?,?)', [id, title, Date.now()])
await app.db.batch([{ sql: '...', params: [...] }, { sql: '...', params: [...] }])

// Multi-tenant helpers (auto-injects tenant_id on all operations)
const tx = app.db.tenant('workspace-id')
await tx.insert('items', { id, title })
const all = await tx.findMany('items')
```

## Auth

```ts
app.auth.signIn()         // GitHub OAuth (default)
app.auth.signIn('google') // Google OAuth
app.auth.signOut()
app.auth.user             // User | null (id, login, avatarUrl, dateOfBirth)

// React hook
const { user, loading, signIn, signOut } = useProAuth(app)
```

## Config & secrets

- Never commit `.env.production` (compliance check fails).
- Public identifiers: set as GitHub repo Variables (`VITE_*` prefix).
- API keys that cost money: use `app.proxy.fetch()`.
- Local dev: use `.env.local` (gitignored).
