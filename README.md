# Newtonite Operational Work Management System

A full-stack web application for teams to create, manage, and track operational work items (incidents, tasks, requests, investigations).

## Application Screenshots

### 1. Authentication
![Login Screen](./docs/images/login.png)

### 2. Admin Dashboard
![Admin Dashboard](./docs/images/admin_dashboard.png)

### 3. Work Item Detail & Audit Timeline
![Work Item Detail](./docs/images/admin_detail.png)

### 4. Manager View
![Manager Dashboard](./docs/images/manager_dashboard.png)

### 5. Viewer Mode
![Viewer Dashboard](./docs/images/viewer_dashboard.png)


## Features

- **Work Item Management**: Create, update, transition, assign, and comment on work items
- **Team-Based Authorization**: Role-based access control (ADMIN, MANAGER, MEMBER, VIEWER)
- **Optimistic Concurrency Control**: Prevents lost updates with version-based conflict detection
- **Idempotent Mutations**: Duplicate request prevention via `Idempotency-Key` header
- **Real-time Updates**: Server-Sent Events for stale read detection
- **Audit Trail**: Complete history of all changes and comments
- **Dashboard**: Summary statistics and assigned items

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Node.js + TypeScript + Express.js |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Auth | JWT + bcrypt |
| Validation | Zod |
| Job Queue | BullMQ + Redis |
| Frontend | React 18 + TypeScript + Vite |
| State Management | TanStack React Query v5 |
| Routing | React Router v6 |

## Architecture

```mermaid
flowchart LR
    Frontend["React Frontend (Vite + TS)"] <-->|REST API & SSE Events| Backend["Express Backend API"]
    Backend <-->|Prisma ORM| Database[("PostgreSQL Database")]
    Backend <-->|Idempotency & Jobs| Redis[("Redis Cache / Queues")]
```

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16
- Redis 7

### One-Command Setup (Docker Compose)

```bash
docker-compose up -d
```

This starts PostgreSQL and Redis. Then:

```bash
# Install server dependencies
cd server && npm install

# Run migrations and seed
npm run db:migrate
npm run db:seed

# Start development server
npm run dev
```

In a separate terminal:

```bash
# Install client dependencies
cd client && npm install

# Start Vite dev server
npm run dev
```

The frontend will be available at `http://localhost:5173` (proxied to backend at `http://localhost:3001`).

### Manual Setup (Without Docker)

1. Start PostgreSQL and Redis locally
2. Configure `server/.env` with your database/Redis URLs
3. Follow the same steps as above

## Demo Credentials

After seeding, the following users are available (all passwords: `password123`):

| Email | Role | Teams |
|-------|------|-------|
| `admin@newtonite.com` | ADMIN | Engineering, Customer Support, Finance |
| `manager@newtonite.com` | MANAGER | Engineering, Customer Support |
| `member@newtonite.com` | MEMBER | Engineering, Finance (VIEWER) |
| `viewer@newtonite.com` | VIEWER | Engineering |

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login, returns JWT
- `GET /api/auth/me` - Get current user

### Work Items
- `GET /api/work-items` - List with filters & pagination
- `POST /api/work-items` - Create (supports `Idempotency-Key`)
- `GET /api/work-items/:id` - Get detail
- `PATCH /api/work-items/:id` - Update (requires `version`, supports `Idempotency-Key`)
- `POST /api/work-items/:id/transition` - Status transition (requires `version`, supports `Idempotency-Key`)
- `POST /api/work-items/:id/assign` - Assign/unassign (requires `version`, supports `Idempotency-Key`)
- `GET /api/work-items/:id/comments` - List comments
- `POST /api/work-items/:id/comments` - Add comment
- `GET /api/work-items/:id/timeline` - Combined events + comments

### Teams
- `GET /api/teams` - List user's teams
- `GET /api/teams/:id` - Team details with members
- `GET /api/teams/:id/members` - List members
- `POST /api/teams/:id/members` - Add member (ADMIN only)

### Dashboard
- `GET /api/dashboard/summary` - Aggregated stats
- `GET /api/dashboard/my-items` - Items assigned to current user

### Real-time Events
- `GET /api/events/work-items/:id` - SSE stream for work item
- `GET /api/events/team/:id` - SSE stream for team

## Critical Behaviours Implemented

1. **Optimistic Concurrency Control (OCC)**: Every work item has a `version` field. Updates fail with 409 Conflict if version mismatch, returning current server state.

2. **Idempotent Mutations**: Send `Idempotency-Key` header on POST/PATCH. Duplicate keys return cached response.

3. **Resource-Level Authorization**: Server-side role checks on every request. VIEWER cannot edit, MEMBER can only edit own items, MANAGER can edit any in team, ADMIN has full access.

4. **Stale Read Detection (Bonus)**: SSE notifications when viewed item is modified by another user.

## Testing

```bash
# Run server tests
cd server && npm test

# Run client build (type check)
cd client && npm run build
```

## Project Structure

```
.
├── client/                 # React frontend
│   ├── src/
│   │   ├── api/           # API client & React Query hooks
│   │   ├── components/    # Reusable UI components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── pages/         # Page components
│   │   └── styles/        # Global styles
├── server/                 # Express backend
│   ├── prisma/            # Prisma schema & seed
│   ├── src/
│   │   ├── config.ts      # Environment config
│   │   ├── index.ts       # Entry point
│   │   ├── app.ts         # Express app setup
│   │   ├── middleware/    # Auth, authorization, idempotency, validation
│   │   ├── routes/        # API route handlers
│   │   ├── services/      # Business logic
│   │   ├── jobs/          # BullMQ queue & workers
│   │   └── utils/         # Errors, pagination, Prisma client
│   └── tests/             # Vitest + Supertest tests
├── shared/                 # Shared TypeScript types
└── docker-compose.yml      # PostgreSQL + Redis
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://newtonite:newtonite_dev@localhost:5432/newtonite` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_EXPIRES_IN` | Token expiry | `8h` |
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |

