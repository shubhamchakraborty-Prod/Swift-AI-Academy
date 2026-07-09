# Setup

Phase 0 (this build) needs no live services to run — the app boots and the
design system/shell are fully interactive with no database. The items below
are what's needed to move into Phase 1 (real Projects/Tasks) and are not
yet wired up because they need credentials only you can provide.

## 1. Database (Postgres)

Recommended: a free [Supabase](https://supabase.com) project — it also gives
file storage (for Gallery-view cover images and Resource files in Phase 2)
and can provide auth later, so one account covers both needs.

1. Create a Supabase project.
2. Project Settings → Database → Connection string → **URI** (use the
   pooled "Transaction" connection string for serverless deploys, or the
   direct connection for local dev).
3. Copy `.env.example` to `.env` and set `DATABASE_URL` to that string.
4. Run `npx prisma migrate dev --name init` to create the tables from
   `prisma/schema.prisma`.

Without this, `npm run dev` still runs — you'll just see the Phase 0 shell
with no live data screens yet (those land in Phase 1).

## 2. Logo — real asset needed

`components/logo.tsx` currently renders placeholder SVGs
(`public/brand/logo-*.svg`) standing in for the node-network mark you
shared in chat (that image wasn't saved as a file, so it couldn't be
used directly). To swap in the real mark:

1. Export the final logo as SVG (preferred) in these variants: full
   lockup, full lockup reversed (for dark surfaces), symbol-only, symbol
   reversed.
2. Replace the four files in `public/brand/` with the same filenames
   (`logo-full.svg`, `logo-full-reversed.svg`, `logo-symbol.svg`,
   `logo-symbol-reversed.svg`), and `app/icon.svg` for the favicon.
3. If the new asset's proportions differ significantly from 240×64 (full)
   / 64×64 (symbol), update the `width`/`height` in `lib/brand.ts` to match
   — everything else (the `Logo` component, sidebar, favicon) picks it up
   automatically.

## 3. Fonts — Cabinet Grotesk / JetBrains Mono

The brand guideline specifies Cabinet Grotesk and JetBrains Mono. Neither
is bundled with this build (no license file available), so `--font-display`
and `--font-mono` in `app/globals.css` currently resolve to self-hosted
Geist as a placeholder. Once you have license files:

1. Add them via `next/font/local` in `app/layout.tsx` (same pattern as the
   existing Geist import).
2. Point the two CSS variables at the new font variables — no other file
   needs to change.

## 4. Still-open product decisions

These don't block Phase 0 but are needed before Phase 1 ships:

- **Login**: Google Workspace SSO (matches how the team already shares the
  Sheet) vs. plain email/password.
- **Alerts**: email, Slack, or WhatsApp for overdue/assignment notifications
  (Phase 4).
- **Admin**: who can add new Projects/Workstreams/People to the managed
  dropdowns.

## 5. Deploying

Target is Vercel. Once `DATABASE_URL` is set as a Vercel project env var,
`npm run build` / the default Next.js build output works with no extra
config.
