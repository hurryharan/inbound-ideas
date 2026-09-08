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
   ├── Source connector      src/lib/sources/*      (Google Sheets — every Source is a sheet)
   ├── Context retrieval     src/lib/ideas/context-matching.ts, src/lib/context/*
   ├── Idea engine           src/lib/ideas/*         (topics, angles, scoring, generation, prompt)
   ├── LLM adapters          src/lib/llm/*           (OpenAI / Anthropic / Google / compatible)
   ├── Google integration    src/lib/google/*        (OAuth, Drive)
   └── Database              prisma/schema.prisma via src/lib/prisma.ts
```

Key design decisions, matching the product spec:

- **One connector, not one per platform.** Every Source is a Google Sheet
  (`src/lib/sources/google-sheet.ts`) — LinkedIn, Twitter, or anything else
  becomes a source by periodically exporting into a sheet, rather than the
  app maintaining a bespoke connector per platform. Rows normalize into a
  shared `NormalizedItem` shape (`src/lib/sources/types.ts`), and column
  mapping is auto-detected from the header row (title/content/URL/topic/
  author, matched against common aliases) so adding a source is just a
  name + spreadsheet URL — no per-column setup unless detection gets it
  wrong, in which case it's editable per PRD section 12.
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

### 2. Set up Postgres

All this needs is a running Postgres server and a connection string — the
app creates its own schema via Prisma migrations, nothing to configure by
hand. Pick one:

**Option A — Neon (recommended: free, hosted, nothing to install)**

1. [neon.tech](https://neon.tech) → sign up → **New Project**.
2. Copy the connection string it gives you (looks like
   `postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require`).
3. Use that as `DATABASE_URL` in the next step. This works for local dev
   and, later, for a Vercel deployment — same string, or a second Neon
   project if you want dev/prod separated.

**Option B — Docker, on your own machine**

```bash
docker run --name inbound-ideas-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=inbound_ideas \
  -p 5432:5432 -d postgres:16
```

`DATABASE_URL="postgresql://postgres:postgres@localhost:5432/inbound_ideas"`.
Requires Docker installed and running; data is lost if you remove the
container without attaching a volume.

**Option C — Native install, no Docker (Debian/Ubuntu)**

```bash
sudo apt-get install -y postgresql
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
sudo -u postgres psql -c "CREATE DATABASE inbound_ideas;"
```

Same connection string as Option B, pointing at `localhost`.

### 3. Configure environment variables

```bash
cp .env.example .env
```

At minimum, set:

- `DATABASE_URL` — the connection string from step 2
- `APP_PASSWORD` — the password used to sign in
- `SESSION_SECRET` — any long random string
- `ENCRYPTION_KEY` — 32 bytes, base64-encoded: `openssl rand -base64 32`

Google OAuth and LLM provider keys can be added later from the app's
Settings UI, or set here to have them ready at first run. See
[Google OAuth setup](#google-oauth-setup) below.

### 4. Apply the schema

```bash
npx prisma migrate deploy   # applies committed migrations
npm run db:seed             # optional: loads a demo dataset (12 ideas, context, 2 sessions)
```

For schema changes during development, use `npx prisma migrate dev` instead
of `deploy`.

### 5. Run it

```bash
npm run dev
```

Visit `http://localhost:3000`, sign in with `APP_PASSWORD`, and you'll land
on the Inbox — populated with the seed dataset if you ran `db:seed`.

### 6. Run tests

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

- **Any source (LinkedIn, Twitter, anything):** Sources → Add Source →
  give it a name (e.g. "LinkedIn Saved Posts"), paste a Google Sheet URL,
  and set the sheet name. That's it — column mapping (title/content/URL/
  topic/author) is auto-detected from the sheet's header row on first
  refresh against common aliases (`Title`/`Text`/`Content`, `URL`/`Link`,
  etc. — see `COLUMN_ALIASES` in `src/lib/sources/google-sheet.ts`). If
  detection picks the wrong column, or your sheet uses unusual headers,
  hit **Edit mapping** on that source and set it explicitly — no code
  change needed, per PRD section 12.

  Since LinkedIn has no public API for saved posts, populate the sheet by
  hand, via a browser extension, or with an export/automation tool
  (Zapier, IFTTT, Apps Script) — whatever gets rows into the sheet. The
  app only ever reads it.
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

1. **Import the repo.** [vercel.com/new](https://vercel.com/new) → import
   this GitHub repo. Framework preset auto-detects Next.js — leave the
   build/output settings as-is for now (revisited in step 4).

2. **Provision Postgres and get a connection string.** Any standard
   Postgres works — Vercel Postgres (Storage tab → Create Database →
   Postgres), Neon, or Supabase are the common choices. Copy the pooled
   connection string it gives you; that's your `DATABASE_URL`.

3. **Set environment variables.** In the project → **Settings →
   Environment Variables**, add each of these for the **Production**
   environment (and Preview, if you want preview deployments to work too).
   This is the step that fixes `APP_PASSWORD is not configured on the
   server` / `SESSION_SECRET is not set` errors — those aren't generated by
   the app, you set them here:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the connection string from step 2 |
   | `APP_PASSWORD` | any password you choose — this is what you'll type on the login screen |
   | `SESSION_SECRET` | a long random string, e.g. output of `openssl rand -hex 32` |
   | `ENCRYPTION_KEY` | 32 random bytes, e.g. output of `openssl rand -base64 32` |
   | `GOOGLE_REDIRECT_URI` | `https://your-app.vercel.app/api/context/google/callback` (only if using Google) |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud Console (optional, can add later) |
   | `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_AI_API_KEY` | optional — LLM providers can also be added later from the app's Settings UI |

   Run the two `openssl` commands locally to generate `SESSION_SECRET` and
   `ENCRYPTION_KEY` — paste the output directly into Vercel's value field,
   don't reuse the placeholder values from `.env.example`.

4. **Make the build apply migrations.** Vercel's default build command
   (`next build`) won't touch your database, so the first deploy will boot
   against an empty schema. Override the build command in **Settings →
   Build & Development Settings → Build Command** to:

   ```
   npx prisma migrate deploy && next build
   ```

   This runs on every deploy — safe, since `migrate deploy` is a no-op once
   the schema is current. (`prisma generate` runs automatically via this
   repo's `postinstall` script, so you don't need to add that separately.)

5. **Deploy**, then open the deployment URL and log in with whatever you
   set `APP_PASSWORD` to.

6. **Optional: load the seed dataset.** Vercel won't run this for you. From
   your machine, with `DATABASE_URL` pointed at the production database:

   ```bash
   DATABASE_URL="<production connection string>" npm run db:seed
   ```

**Changed an environment variable after the first deploy?** Vercel only
picks up new env var values on the *next* build — go to **Deployments**,
open the latest one, and **Redeploy** (or push a new commit). Editing the
variable alone does not restart the running deployment.

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
src/lib/sources/**         Google Sheets connector (every Source is a sheet), dedup
src/lib/google/**          Google OAuth + Drive
src/lib/ideas/**           Topic extraction, context matching, scoring, idea generation, prompt building
src/lib/llm/**             LLM provider adapters + launch/deep-link resolution
src/components/**          Shared UI (idea card, nav)
tests/**                   Vitest unit tests
```
