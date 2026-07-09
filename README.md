# Vector

Internal projects, tasks and pipeline tracker for Swift AI Academy — replaces the multi-tab Excel tracker. See `SETUP.md` before running this for real (database + auth need your own credentials).

## Stack

Next.js (App Router) + TypeScript, Tailwind CSS v4 (CSS-variable theming), Prisma 7 + Postgres, hand-authored shadcn/ui-style components (Radix primitives), `next-themes`, `cmdk` command palette, `@dnd-kit` and Tremor land in later phases.

## Getting started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, see SETUP.md
npx prisma generate
npm run dev
```

Open http://localhost:3000.

## Where things are

- `app/globals.css` — the 7-theme design token system (Light/Dark/Midnight/Teal/Plum/Pink/Gold), derived from the Swift AI Academy Brand & Design Guidelines.
- `components/ui/` — base primitives (Button, Card, Badge, Dialog, DropdownMenu, Avatar).
- `components/app-shell/` — sidebar + topbar.
- `components/logo.tsx` + `lib/brand.ts` — swappable logo asset layer (placeholder assets in `public/brand/`, see SETUP.md).
- `components/command-palette.tsx` — ⌘K / Ctrl+K quick navigation and theme switching.
- `prisma/schema.prisma` — core data model (Person, Workstream, Project, Task, Comment, Resource, Dashboard, Widget).

## Build plan

The full phased plan lives at `/root/.claude/plans/give-it-a-cool-fancy-truffle.md` in the session this was built in. Current status: **Phase 0 (foundation) complete** — design system, logo layer, data schema, and app shell are in place. Phase 1 (Projects/Tasks CRUD) is next.
