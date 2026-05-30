# Kurtland POS

Kurtland POS is a full-stack point-of-sale system with a Next.js frontend and an Express + PostgreSQL backend.

## Project Structure

- Frontend: `app/`, `components/`, `lib/`
- Backend: `backend/src/`
- Backend Docker: `backend/docker-compose.yml`

## Prerequisites

- Node.js 20+
- npm or pnpm
- Docker Desktop (for containerized backend)

## Quick Start

### 1) Install frontend dependencies

```bash
npm install
```

### 2) Run frontend (Next.js)

```bash
npm run dev
```

Frontend URL:

- http://localhost:3000

Note: if port 3000 is busy, Next.js may run on 3001.

### 3) Run backend with Docker

```bash
cd backend
docker compose up --build
```

Backend services:

- API: http://localhost:4000
- PostgreSQL: localhost:5432
- pgAdmin: http://localhost:5051

pgAdmin default login:

- Email: admin@kurtland.com
- Password: admin

## Useful Commands

From project root:

```bash
npm run dev
npm run build
npm run lint
```

From backend folder:

```bash
docker compose up --build
docker compose up -d
docker compose ps
docker compose logs -f api
```

## Notes

- Product soft-delete is supported through `is_deleted` in the update endpoint.
- Receipt timestamps are formatted for Asia/Manila timezone.
- If Docker fails with missing `dockerDesktopLinuxEngine` pipe, start Docker Desktop and retry.
