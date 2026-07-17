# Vector

Internal projects, tasks and pipeline tracker for Swift AI Academy — replaces the multi-tab Excel tracker. See `SETUP.md` before running this for real (database + auth need your own credentials).

## Stack

Next.js (App Router) + TypeScript, Tailwind CSS v4 (CSS-variable theming), Prisma 7 + Postgres (driver-adapter client), hand-authored shadcn/ui-style components (Radix primitives), `next-themes`, `cmdk` command palette, `@dnd-kit` drag-and-drop. Tremor dashboards land in a later phase.

## Getting started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, see SETUP.md
npx prisma migrate dev
npx prisma db seed     # loads the real team roster + workstreams
npm run dev
```

Open http://localhost:3000.

## Where things are

- `app/globals.css` — the 7-theme design token system (Light/Dark/Midnight/Teal/Plum/Pink/Gold), derived from the Swift AI Academy Brand & Design Guidelines.
- `components/ui/` — base primitives (Button, Card, Badge, Dialog, Sheet, DropdownMenu, Avatar, Input, Label).
- `components/app-shell/` — sidebar + topbar.
- `components/logo.tsx` + `lib/brand.ts` — swappable logo asset layer (placeholder assets in `public/brand/`, see SETUP.md).
- `components/command-palette.tsx` — ⌘K / Ctrl+K quick navigation and theme switching.
- `components/tasks/` — task table, board (drag-and-drop), detail slide-over, new-task dialog, and the inline status/priority/owner pickers.
- `components/projects/` — BD Pipeline kanban (drag-and-drop across stages) and the new-project dialog, including the "Convert to project" action.
- `components/gallery/` — the Gallery view (Projects/Resources tabs, card grid with deterministic placeholder covers).
- `components/resources/` — new-resource dialog for the tagged link/file library.
- `prisma/schema.prisma` — core data model (Person, Workstream, Project, Task, Comment, Resource, Dashboard, Widget).
- `lib/data/` — read queries for server components. `lib/actions/` — Server Action mutations.
- `app/(app)/` — the authenticated app shell (layout fetches the sidebar's shared data once); `page.tsx` is My Tasks, `board/`, `pipeline/`, `gallery/` are the other views.

## Build plan

The full phased plan lives at `/root/.claude/plans/give-it-a-cool-fancy-truffle.md` in the session this was built in. Current status: **Phases 0-2 complete** — design system, logo layer, data schema, My Tasks table, Board, task detail with comments, task creation, the BD Pipeline kanban (with convert-to-project), the Resource library, and the Gallery view are all working against a real Postgres database. Phase 3 (no-code Dashboard builder) is next.
