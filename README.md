# Inbound Ideas

A personal "Inbound Ideas" application: it collects potentially interesting
material from configured sources, surfaces why a handful of items might be
worth exploring, and hands your pick — plus relevant context — into an
interactive ideation session with your own LLM.

It is **not** a content-writing tool. The loop is:

> Find interesting things → surface why they may matter → help you choose
> one → launch an ideation chat.

This implements the "Inbound Ideas — PRD / Build Specification" product
brief; see that document for the full product rationale (MVP goals,
non-goals, design principles) if you have access to it.

## Stack

- **Framework:** Next.js 16 (App Router, TypeScript), Tailwind CSS
- **Database:** PostgreSQL via Prisma
- **Auth:** single-user, password + signed cookie (no user database)
- **External integrations:** Google OAuth (Drive + Sheets, read-only),
  pluggable LLM adapters (OpenAI, Anthropic, Google, any OpenAI-compatible
  API)

The stack favors "simple and composable" over "scalable" — this is a
personal tool for one user, not a multi-tenant product.

## Architecture

```
Frontend (Next.js pages, client components + SWR)
   │
   ▼
API routes (src/app/api/**)
   │
   ├── Source connectors     src/lib/sources/*      (LinkedIn CSV/JSON import, Google Sheets)
   ├── Context retrieval     src/lib/ideas/context-matching.ts, src/lib/context/*
   ├── Idea engine           src/lib/ideas/*         (topics, angles, scoring, generation, prompt)
   ├── LLM adapters          src/lib/llm/*           (OpenAI / Anthropic / Google / compatible)
   ├── Google integration    src/lib/google/*        (OAuth, Drive)
   └── Database              prisma/schema.prisma via src/lib/prisma.ts
```

Key design decisions, matching the product spec:

- **Source abstraction.** Every connector normalizes into the same
  `NormalizedItem` shape (`src/lib/sources/types.ts`). The idea engine never
  depends on LinkedIn or Sheets specifically — a future connector (RSS,
  Twitter/X, a browser extension) only needs to produce that shape.
- **LLM provider abstraction.** `src/lib/llm/index.ts` builds an `LLMAdapter`
  from a stored `LLMProvider` row; nothing else in the app knows which
  provider is configured. If no provider is configured at all, idea
  generation and ranking fall back to a heuristic implementation
  (`generateIdeaHeuristically`) — the app is fully usable, including the
  seed dataset, without any API keys.
- **Nothing hard-coded.** Source config (spreadsheet IDs, column mappings,
  Drive folder IDs), the ideation prompt template, and ranking weights are
  all rows in the database, editable from Settings.
- **Launch into chat, not a custom chat UI.** `src/lib/llm/launch.ts`
  resolves a deep-link (currently: ChatGPT's `?q=` prefill) when available,
  and otherwise copies the prepared prompt to the clipboard and opens the
  provider's site. The fallback always works. A `Session` row records what
  was launched, for the Sessions screen and the "already explored" state.

## Local setup

### Prerequisites

- Node.js 20+
- A PostgreSQL database (local install, Docker, or a hosted instance)

### 1. Install dependencies

```bash
npm install
```

> If you hit an `npm error Cannot read properties of null (reading
> 'edgesOut')`, that's a known npm/arborist bug unrelated to this project —
> retry with `npm install --legacy-peer-deps`.

### 2. Configure environment variables

```bash
cp .env.example .env
```

At minimum, set:

- `DATABASE_URL` — your Postgres connection string
- `APP_PASSWORD` — the password used to sign in
- `SESSION_SECRET` — any long random string
- `ENCRYPTION_KEY` — 32 bytes, base64-encoded: `openssl rand -base64 32`

Google OAuth and LLM provider keys can be added later from the app's
Settings UI, or set here to have them ready at first run. See
[Google OAuth setup](#google-oauth-setup) below.

### 3. Set up the database

```bash
npx prisma migrate deploy   # applies committed migrations
npm run db:seed             # optional: loads a demo dataset (12 ideas, context, 2 sessions)
```

For schema changes during development, use `npx prisma migrate dev` instead
of `deploy`.

### 4. Run it

```bash
npm run dev
```

Visit `http://localhost:3000`, sign in with `APP_PASSWORD`, and you'll land
on the Inbox — populated with the seed dataset if you ran `db:seed`.

### 5. Run tests

```bash
npm test
```

Covers source normalization, deduplication, idea ranking, context
selection, prompt generation, and the LLM launch/handoff logic.

## Google OAuth setup

Needed for Context sources (Google Drive folders/docs) and for Google
Sheet inbound sources with live refresh.

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create an OAuth 2.0 Client ID of type "Web application".
2. Enable the **Google Drive API** and **Google Sheets API** for the project.
3. Add an authorized redirect URI matching `GOOGLE_REDIRECT_URI` in your
   `.env` (default: `http://localhost:3000/api/context/google/callback`).
4. Copy the client ID/secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. In the app, go to **Context → Connect Google** and grant read-only
   access. The app requests `drive.readonly` and `spreadsheets.readonly`
   only — it never writes back to your Drive or Sheets.

## Connecting real sources

- **LinkedIn Saved Posts:** Sources → Add Source → LinkedIn Saved Posts,
  then use **Import CSV/JSON** on that source. LinkedIn has no public API
  for saved posts, so export/copy your saved posts into a CSV with columns
  like `title, text/content, url, author, date` (headers are matched
  case-insensitively; extra columns are ignored) or an equivalent JSON
  array. A browser extension or an official API integration can replace
  this later without touching anything downstream — see
  `src/lib/sources/linkedin.ts`.
- **Google Sheet:** Sources → Add Source → Google Sheet, paste the sheet
  URL, and map your columns (title/body/topic/URL) to your sheet's actual
  headers. If the sheet's structure changes, edit the source and remap —
  no code change needed.
- **Context (Google Drive):** Context → Add Source, paste a Drive folder or
  document URL, tag it (e.g. `company`, `product`, `governance`), and set a
  priority. The idea engine matches an idea's topics against these tags to
  decide which context to pull into a prompt (see
  `src/lib/ideas/context-matching.ts`) — it never dumps every document into
  every prompt.

## LLM providers

Settings → LLM Providers → Add Provider. Supported kinds: OpenAI,
Anthropic, Google, or any OpenAI-compatible API (set a base URL). Mark one
as default — that's the provider used for idea generation and for the
"Explore" button unless overridden per-session. API keys are encrypted at
rest (`ENCRYPTION_KEY`) and never sent to the browser.

If no provider is configured, ideas are still generated (using
`src/lib/ideas/generate.ts`'s heuristic path), and "Explore" falls back to
the clipboard + a generic provider URL.

## Deployment

### Option A — Vercel + managed Postgres

1. Push this repo to GitHub and import it into Vercel.
2. Provision Postgres (Vercel Postgres, Neon, Supabase, RDS — any standard
   Postgres works) and set `DATABASE_URL` in Vercel's environment variables.
3. Set the remaining variables from `.env.example` (`APP_PASSWORD`,
   `SESSION_SECRET`, `ENCRYPTION_KEY`, Google/LLM keys as needed).
   Set `GOOGLE_REDIRECT_URI` and `NEXT_PUBLIC_APP_URL` to your production
   domain.
4. Run `npx prisma migrate deploy` against the production database (a
   Vercel build step or a one-off job) before or during first deploy.
5. Deploy. Vercel builds with `npm run build` and serves `npm run start`
   automatically.

### Option B — Single Docker deployment

Build a standard Next.js production image (multi-stage: `npm ci && npm run
build`, then `npm run start` in the runtime stage) alongside a Postgres
container or managed instance. Run `npx prisma migrate deploy` as a release
step before starting the app. Any host that can run a long-lived Node
process and reach your Postgres instance works (Fly.io, Railway, a plain
VM, etc.).

In both cases:

- Rotate `APP_PASSWORD` and generate a fresh `SESSION_SECRET` /
  `ENCRYPTION_KEY` for production — don't reuse the dev values in
  `.env.example`.
- Update the Google OAuth client's authorized redirect URI to your
  production `GOOGLE_REDIRECT_URI` before connecting Google in production.

## Data deletion

Deleting a Source or Context Source (Sources / Context pages → Delete)
cascades to its imported items/documents and any ideas derived solely from
them, per the app's cascade rules in `prisma/schema.prisma`. There is
currently no bulk "delete all my data" button — for a full reset, drop and
recreate the database and re-run migrations.

## Project structure

```
prisma/schema.prisma       Database schema (see PRD section 34 for the entity list)
prisma/seed.ts             Dev seed dataset
src/app/(app)/**           Authenticated pages (Inbox, Ideas, Sessions, Sources, Context, LLM, Settings)
src/app/api/**             REST-ish API routes
src/lib/sources/**         Source connector framework + LinkedIn/Sheets connectors
src/lib/google/**          Google OAuth + Drive
src/lib/ideas/**           Topic extraction, context matching, scoring, idea generation, prompt building
src/lib/llm/**             LLM provider adapters + launch/deep-link resolution
src/components/**          Shared UI (idea card, nav)
tests/**                   Vitest unit tests
```
