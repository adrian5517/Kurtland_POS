# Kurtland POS Backend

Express + PostgreSQL API for the Kurtland POS system.

## Tech Stack

- Node.js
- Express
- PostgreSQL (`pg`)
- Zod validation
- JWT auth
- Docker Compose for local services

## Folder Structure

- `src/config` - environment and service config
- `src/db` - database pool and bootstrap
- `src/middleware` - auth, error handling, audit
- `src/modules/*` - feature modules (controller/service/repository/schema)
- `src/routes` - route registration
- `scripts` - local seed utilities

## Prerequisites

- Node.js 20+
- npm
- Docker Desktop (recommended for local DB + pgAdmin)

## Environment

Create or update `backend/.env`:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/kurt_land_pos
JWT_SECRET=dev-secret-change-me
CLOUDINARY_URL=
```

Notes:

- In Docker Compose, API uses `db` as hostname internally.
- `CLOUDINARY_URL` can be blank for local development.

## Run Locally (Node only)

```bash
cd backend
npm install
npm run dev
```

API URL:

- http://localhost:4000

## Run with Docker Compose

```bash
cd backend
docker compose up --build
```

Services:

- API: http://localhost:4000
- PostgreSQL: localhost:5432
- pgAdmin: http://localhost:5051

pgAdmin login:

- Email: admin@kurtland.com
- Password: admin

## Common Commands

```bash
# Start backend in watch mode
npm run dev

# Start backend once
npm start

# Seed demo users
npm run seed:demo

# Compose status/logs
docker compose ps
docker compose logs -f api
```

## Core API Endpoints

- `GET /api/health`
- `GET /api/products`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `POST /api/orders`

## Notes

- Product updates support `is_active`/`isActive` and `is_deleted`/`isDeleted`.
- Receipt timestamps are formatted to `Asia/Manila`.
- Product delete endpoint is soft delete (`is_deleted = true`).
