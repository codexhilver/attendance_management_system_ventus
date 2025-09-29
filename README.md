# Attendance Management System

A simple attendance tracker with a React + Vite frontend and a lightweight Express API.

The backend uses Vercel Postgres via `@vercel/postgres` (`server/db.js`). No Supabase or local SQLite is required anymore.

## Prerequisites
- Node.js 18+
- Vercel account (for deployment) and Vercel Postgres integration

## Environment
Copy `env.example` to `.env` and set values as needed:
- `POSTGRES_URL`: Connection string. On Vercel, this is provisioned automatically when you add Vercel Postgres. For local dev, you can point to a local Postgres.
- `VITE_API_URL`: Base URL for the API. In dev, set to `http://127.0.0.1:5174`. In production on Vercel, you can leave empty to use relative paths.
- `ADMIN_PIN` (optional): Required for destructive admin routes (delete and patch).
- `PORT` (optional): Defaults to `5174` for the local API server.

## Scripts
- `npm run dev`: Runs Vite and the Express API concurrently.
- `npm run build`: Builds the frontend to `dist/`.
- `npm run lint`: Type-checks and builds to ensure a clean build.

## Local Development
1. `npm install`
2. Create `.env` from `env.example` and set `POSTGRES_URL` and `VITE_API_URL=http://127.0.0.1:5174`.
3. `npm run dev`
   - Frontend will open on the Vite port (default 5173)
   - API runs at `http://127.0.0.1:5174`

## Deployment (Vercel)
- Ensure the project has the Vercel Postgres integration. Vercel will inject Postgres env vars automatically.
- `vercel` (or deploy from the Vercel dashboard)
- `vercel.json` routes API requests `/api/*` to `server/index.js` and serves the built frontend from `dist/`.

## Notes
- The server auto-creates tables on first run in `server/db.js` if they don't exist.
- Old Supabase and SQLite migration files were removed during cleanup.
