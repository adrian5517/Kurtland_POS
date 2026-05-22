# Kurtland POS Backend

JavaScript Express backend organized with an MVC-style structure.

## Structure

- `src/config` - environment configuration
- `src/db` - PostgreSQL pool
- `src/middleware` - shared middleware and error handling
- `src/modules/*` - feature modules with routes, controllers, services, repositories, and schemas
- `src/routes` - route registration
- `src/utils` - shared utilities

## Run locally

```bash
cd backend
npm install
npm run dev
```

## Production

```bash
npm start
```

## Docker

```bash
docker compose up --build
```

## API

- `GET /api/health`
- `GET /api/products`
- `POST /api/products`# Kurtland POS Backend

Express + PostgreSQL backend organized with an MVC-style structure.

## Structure

- `src/config` - environment configuration
- `src/db` - PostgreSQL connection
- `src/middleware` - error handling and shared middleware
- `src/modules/*` - feature modules with routes, controllers, services, repositories, and schemas
- `src/routes` - application route registration
- `src/utils` - shared utilities

## Run locally

```bash
cd backend
npm install
npm run dev
```

## Build

```bash
npm run build
npm start
```

## Docker

```bash
docker compose up --build
```

## API

- `GET /api/health` - health check
- `GET /api/products` - list products
- `POST /api/products` - create product

## Environment

Copy `.env.example` to `.env` and update the values for your local PostgreSQL instance.# Backend Server — Full Guide (Express.js + PostgreSQL)

This document provides a complete, practical backend guide for building a production-ready Express.js API server that pairs with the existing Next.js frontend. It includes setup, local development (with Docker), TypeScript configuration, database migrations, authentication, testing, deployment and recommended project structure.

If you prefer code scaffolding, I can create the `backend/src` files and configs for you after this guide.

**Target stack**: Node.js + TypeScript, Express, PostgreSQL, `pg` pool, Zod for validation, optional Prisma/Drizzle for migrations.

---

## Table of Contents

- Prerequisites
- Recommended folder layout
- Quick start (local)
- Environment variables
- Dependencies & package.json scripts
- TypeScript config
- Minimal starter code (app, server, db)
- Database schema & migrations (Prisma + SQL examples)
- Seeding
- API design patterns
- Authentication (JWT) example
- Validation & error handling
- Logging, metrics and monitoring
- Docker + docker-compose
- Testing
- Security and production hardening
- CI / CD example (GitHub Actions)
- Backups and maintenance
- Next steps / scaffolding options

---

## Prerequisites

- Node.js (>=18 recommended)
- pnpm (or npm/yarn)
- Docker (for local Postgres, optional)

## Recommended folder layout

Place your backend in a sibling `backend/` folder at the repository root so frontend and backend remain independent:

```
kurt-land-pos-web-app/
  app/                # next frontend
  components/
  backend/
    src/
      config/
      db/
      middleware/
      routes/
      controllers/
      services/
      schemas/
      app.ts
      server.ts
    .env
    .env.example
    package.json
    tsconfig.json
    prisma/ (optional)
    docker-compose.yml
```

## Quick start (local)

1. From repo root create backend folder if not present:

```bash
mkdir backend
cd backend
pnpm init -y
```

2. Install dependencies (minimal):

```bash
pnpm add express cors helmet morgan pg dotenv zod
pnpm add -D typescript tsx @types/node @types/express @types/cors @types/morgan
```

3. Add scripts to `backend/package.json`:

```json
"scripts": {
  "dev": "tsx watch src/server.ts",
  "build": "tsc -p tsconfig.json",
  "start": "node dist/server.js",
  "lint": "eslint . --ext .ts"
}
```

4. Create an `.env` (see Environment Variables section) and run:

```bash
pnpm dev
```

Open `http://localhost:4000/health` to verify.

## Environment variables

Create `.env` and `.env.example` at `backend/`:

```
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@db:5432/kurt_land_pos
JWT_SECRET=replace-with-secure-secret
```

Notes:

- In production, store secrets in your hosting provider's secret manager.
- Use `DATABASE_URL` for migrations and pool connections.

## Dependencies (recommended)

- express, cors, helmet, morgan
- pg (Postgres client)
- dotenv
- zod (validation)
- jsonwebtoken / jose (JWT)
- bcryptjs (password hashing)

Dev dependencies:

- typescript, tsx, @types/*, eslint, prettier, vitest / jest

## TypeScript config (minimal)

Create `tsconfig.json` in `backend/`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

## Minimal starter code

Create the following key files under `backend/src`.

- `src/config/env.ts` — central env loader

```ts
import dotenv from 'dotenv';

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
};
```

- `src/db/pool.ts` — Postgres pool

```ts
import { Pool } from 'pg';
import { env } from '../config/env';

export const db = new Pool({ connectionString: env.databaseUrl });
```

- `src/app.ts` — express app

```ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true }));

export default app;
```

- `src/server.ts` — boot up server and verify DB

```ts
import app from './app';
import { env } from './config/env';
import { db } from './db/pool';

const start = async () => {
  try {
    await db.query('SELECT 1');
    app.listen(env.port, () => console.log(`Backend running on http://localhost:${env.port}`));
  } catch (err) {
    console.error('Failed to start', err);
    process.exit(1);
  }
};

start();
```

## Database schema & migrations

Two common approaches:

- Use plain SQL migration tool (pg-migrate or self-managed SQL files).
- Use Prisma or Drizzle ORM for schema + migrations.

Prisma quickstart (optional):

```bash
pnpm add -D prisma @prisma/client
npx prisma init --datasource-provider postgresql
```

Example `schema.prisma` for products/sales:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Product {
  id        Int     @id @default(autoincrement())
  name      String
  sku       String  @unique
  price     Decimal
  quantity  Int     @default(0)
  createdAt DateTime @default(now())
}

model Sale {
  id        Int      @id @default(autoincrement())
  productId Int
  qty       Int
  total     Decimal
  createdAt DateTime @default(now())
  Product   Product  @relation(fields: [productId], references: [id])
}
```

Run migrations:

```bash
npx prisma migrate dev --name init
```

If you prefer raw SQL, keep `migrations/` with `0001_init.sql` and run using `psql` inside CI or with a small migration runner.

## Seeding

Create `prisma/seed.ts` or a `scripts/seed.ts` to populate products for development.

## API design patterns

- Keep routes thin: controllers call services which call DB.
- Use folder per domain: `routes/products.ts`, `controllers/productController.ts`, `services/productService.ts`.
- Return consistent response shape: `{ data, error }`.

Example route registration in `src/app.ts`:

```ts
import productRouter from './routes/products';
app.use('/api/products', productRouter);
```

## Authentication (JWT) — minimal example

- Use `jsonwebtoken` (or `jose`) and store a `JWT_SECRET` in env.
- Hash passwords with `bcryptjs` when storing users.

Auth middleware snippet:

```ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization?.split(' ')[1];
  if (!auth) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(auth, env.jwtSecret);
    (req as any).user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

## Validation & error handling

- Validate request bodies with Zod; centralize conversion of validation errors to 400 responses.
- Use a global error handler to format errors and hide internal stack traces in production.

## Logging, metrics and monitoring

- Use `pino` or `winston` for structured logs.
- Add request IDs and correlate logs.
- Expose `/metrics` for Prometheus if needed.

## Docker + docker-compose (local)

Create `docker-compose.yml` in `backend/` to run Postgres and the backend for local dev:

```yaml
version: '3.8'
services:
  db:
    image: postgres:15
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: kurt_land_pos
    volumes:
      - db_data:/var/lib/postgresql/data
    ports:
      - '5432:5432'

  backend:
    build: .
    command: pnpm dev
    volumes:
      - ./:/app
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/kurt_land_pos
    ports:
      - '4000:4000'
    depends_on:
      - db

volumes:
  db_data:
```

And a minimal `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
CMD ["node", "dist/server.js"]
```

## Testing

- Use `vitest` or `jest` and `supertest` for integration tests.
- Keep tests fast and seed a transient test database (or use a dedicated docker-compose test stack).

Example test command in `package.json`:

```json
"test": "vitest"
```

## Security & production hardening

- Do not log secrets. Use structured logs.
- Run DB migrations during deployment window.
- Enforce HTTPS in production, use HSTS.
- Use rate limiting (e.g., `express-rate-limit`) for public endpoints.
- Use parameterized queries or ORM to prevent SQL injection.

## CI / CD (GitHub Actions) — basic pipeline

Create `.github/workflows/ci.yml` to run lint, build, and tests. Example steps:

- Checkout, install node, install dependencies
- Run typecheck, lint, tests
- Build and publish Docker image if desired

## Backups & maintenance

- Schedule periodic Postgres backups (pg_dump) and keep offsite.
- Monitor disk, CPU, connection counts.

## Next steps (scaffolding)

I can scaffold the `backend/` folder with runnable TypeScript files and `package.json`, `tsconfig.json`, a `Dockerfile`, and sample routes (`products`, `sales`) and a simple Prisma setup. Tell me which of the following you want next:

1. Full file scaffold (TypeScript + Prisma + seed + sample routes)
2. Minimal runnable Express + PG scaffold (no ORM) — fast to run
3. Docker + docker-compose only (I will create Dockerfile and compose file)

---

If you want me to scaffold files now, pick an option above or say "make scaffold 1".
