# Kurtland POS Quickstart

This file is the fastest path to run the app locally.

## Prerequisites

- Node.js 20+
- npm
- Docker Desktop

## 1) Install frontend dependencies

From project root:

```bash
npm install
```

## 2) Start frontend

From project root:

```bash
npm run dev
```

Frontend URL:

- http://localhost:3000

If port 3000 is busy, Next.js may start on 3001.

## 3) Start backend stack

From project root:

```bash
cd backend
docker compose up --build
```

Backend services:

- API: http://localhost:4000
- PostgreSQL: localhost:5432
- pgAdmin: http://localhost:5051

pgAdmin login:

- Email: admin@kurtland.com
- Password: admin

## 4) Optional: run backend without Docker

From `backend`:

```bash
npm install
npm run dev
```

Make sure `backend/.env` points `DATABASE_URL` to a running Postgres instance.

## 5) Common checks

From `backend`:

```bash
docker compose ps
docker compose logs -f api
```

From root:

```bash
npm run build
npm run lint
```

## Troubleshooting

- pgAdmin not opening: use http://localhost:5051, not 5001.
- Docker pipe error (`dockerDesktopLinuxEngine`): start Docker Desktop and wait for Engine running.
- API boot issues: confirm DB is up with `docker compose ps` and check `docker compose logs -f api`.
