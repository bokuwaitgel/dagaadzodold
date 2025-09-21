# Follower Battle Royale — Next.js App

A canvas-based “Instagram follower battle royale” demo, now running on Next.js (App Router). It supports importing JSON/CSV, live leaderboard, saved fight history, and a minimal local login to gate the arena.

## Features
- Circular avatars with mini health bars
- Start/Pause/Reset
- Speed control and optional seeded RNG for repeatable runs
- Import JSON/CSV or drag/drop multiple images
- Lightweight: vanilla HTML/JS/CSS; runs via file:// or a simple server

## Data formats
- JSON (array):
```json
[{"name":"Alice","image":"https://example.com/a.jpg"},{"name":"Bob","image":"/path/to/b.png"}]
```
- CSV with headers `name,image`:
```
name,image
Alice,https://example.com/a.jpg
Bob,https://example.com/b.jpg
```

You can also just drop multiple image files; names will be derived from filenames.

## Run locally (Next.js)

Recommended: Node 18+

```
npm install
npm run dev
```

Open http://localhost:3000

- Home (/) shows Saved Fights (leaderboard page) with date filters and Login/Logout.
- Login (/login) sets a local auth user.
- Arena (/arena) runs the battle; requires login.

## Notes

## Deploy to Vercel

1) Set env on Vercel Project (Settings → Environment Variables):
	- `DATABASE_URL` = your Postgres connection string

2) Configure build scripts (already set):
	- `postinstall`: runs `prisma generate`
	- `build`: runs `prisma migrate deploy && next build`

3) Push to GitHub and import the repo in Vercel.

4) First deploy will run migrations and build the Next.js app.

Notes
- Local dev uses the same `.env` file; don’t commit secrets. Vercel uses its own env store.
- If you change the Prisma schema, commit it and Vercel will apply migrations on next deploy.
## Legacy

- main.js, state.js, renderer.js, script.js, styles.css (deprecated stubs)

Source of truth is the Next.js app (see `app/*` and `lib/*`).

Sample data lives at `public/test.json`.

