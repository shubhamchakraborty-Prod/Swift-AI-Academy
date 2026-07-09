# Setup

Phase 0 (design system) and Phase 1 (Projects/Tasks core) are both built
and working against a real Postgres database. The items below are what's
still needed — mostly credentials only you can provide.

## 1. Database (Postgres)

This was built and tested against a local Postgres instance (already
migrated and seeded in this environment). To run it against your own
database instead:

Recommended: a free [Supabase](https://supabase.com) project — it also gives
file storage (for Gallery-view cover images and Resource files in Phase 2)
and can provide auth later, so one account covers both needs.

1. Create a Supabase project.
2. Project Settings → Database → Connection string → **URI** (use the
   pooled "Transaction" connection string for serverless deploys, or the
   direct connection for local dev).
3. Copy `.env.example` to `.env` and set `DATABASE_URL` to that string.
4. Run `npx prisma migrate dev` to create the tables from
   `prisma/schema.prisma` (the initial migration is already committed
   under `prisma/migrations/`).
5. Run `npx prisma db seed` to load the real team roster and workstream
   list (from the client's own "Legends" tab) as managed dropdown values.

## 2. Auth — not yet real

There's no login yet. `lib/current-user.ts` resolves every mutation
(created-by, comment author, etc.) to the seeded Admin user (Shubham
Chakraborty) as a stand-in until the login method below is decided.
Everyone using a `npm run dev` instance right now acts as that one user.

## 3. Logo — real asset needed

`components/logo.tsx` currently renders placeholder SVGs
(`public/brand/logo-*.svg`) standing in for the node-network mark shared
in chat (that image wasn't saved as a file, so it couldn't be used
directly — a follow-up SVG attachment also didn't come through). To swap
in the real mark:

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

## 4. Fonts — Cabinet Grotesk / JetBrains Mono

The brand guideline specifies Cabinet Grotesk and JetBrains Mono. Neither
is bundled with this build (no license file available), so `--font-display`
and `--font-mono` in `app/globals.css` currently resolve to self-hosted
Geist as a placeholder. Once you have license files:

1. Add them via `next/font/local` in `app/layout.tsx` (same pattern as the
   existing Geist import).
2. Point the two CSS variables at the new font variables — no other file
   needs to change.

## 5. Still-open product decisions

- **Login**: Google Workspace SSO (matches how the team already shares the
  Sheet) vs. plain email/password.
- **Alerts**: email, Slack, or WhatsApp for overdue/assignment notifications
  (Phase 4).
- **Admin**: who can add new Projects/Workstreams/People to the managed
  dropdowns — there's no admin UI for this yet, so new values currently
  need a database edit or a seed script change.

## 6. Deploying

Target is Vercel. Once `DATABASE_URL` is set as a Vercel project env var,
`npm run build` / the default Next.js build output works with no extra
config. Run `npx prisma migrate deploy` (not `migrate dev`) against the
production database before first deploy.
