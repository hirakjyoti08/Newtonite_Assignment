# Newtonite Software Engineering Challenge — Agent Execution Plan

> **Purpose:** This document is a step-by-step, machine-executable plan for building the Newtonite operational work management system. Each phase has numbered steps with exact commands, file paths, and code. Execute phases in order. Do not skip steps.

> **Project Root:** `/Users/hirakjyotitalukdar/Personal/VS code/Newtonite`

> **What We Are Building:** A full-stack web application that allows teams to create, manage, and track operational work items (incidents, tasks, requests, investigations). The system must handle concurrent usage, enforce authorization at the resource level, prevent duplicate operations, and maintain a complete audit trail.

> **Time Budget:** ~9 hours. Prioritize backend correctness over frontend polish.

> **UI Design Directive:** The frontend must be **minimal and industry-standard**. Think Linear, Jira, or GitHub Issues — clean, functional, no visual clutter. The challenge brief explicitly states: *"We care significantly more about a coherent and responsive experience than decorative UI."* Do NOT add decorative gradients, animations, shadows, glassmorphism, or fancy effects. Use a neutral color palette (grays, whites, muted accents), a system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`), and consistent 4px/8px spacing. Every pixel must serve a functional purpose. A professional, boring-looking tool that works flawlessly beats a pretty tool that wastes time on aesthetics.

---

## CRITICAL REQUIREMENTS CHECKLIST

The submission **must** demonstrate at least 3 situations where correctness goes beyond simple CRUD:

- [ ] **Critical Behaviour 1: Optimistic Concurrency Control (OCC)** — When two users update the same work item simultaneously, the second write must be rejected with a 409 Conflict containing the current state. Implemented via a `version` integer field on `WorkItem` that increments on every update. The UPDATE query uses `WHERE id = $1 AND version = $2`.
- [ ] **Critical Behaviour 2: Idempotent Mutations** — Mutating API requests (POST, PATCH) accept an `Idempotency-Key` header. If the same key is sent twice, the server returns the cached response instead of re-executing the operation. Prevents duplicate work items from double-clicks or network retries.
- [ ] **Critical Behaviour 3: Resource-Level Authorization** — Users belong to teams with roles (ADMIN, MANAGER, MEMBER, VIEWER). Authorization is enforced server-side on every API request by checking the user's role in the work item's team. A user with VIEWER role in Team A cannot edit Team A's work items even by calling the API directly.
- [ ] **Bonus Critical Behaviour 4: Stale Read Detection** — When a user is viewing a work item detail page and another user modifies it, the viewing user receives a real-time SSE notification and sees a "This item has been updated" banner.

The submission **must** also include:
- [ ] `ENGINEERING_DECISIONS.md` — 5 important architectural decisions with trade-offs
- [ ] Automated tests covering the 3 critical behaviours
- [ ] `README.md` with setup and run instructions
- [ ] Docker Compose for one-command setup
- [ ] Seed data for demo

---

## TECHNOLOGY STACK

| Component | Technology | Install Command |
|-----------|-----------|----------------|
| Backend runtime | Node.js + TypeScript | Already installed |
| Backend framework | Express.js v4 | `npm install express` |
| Database | PostgreSQL 16 | Via Docker |
| ORM | Prisma | `npm install prisma @prisma/client` |
| Auth | JWT + bcrypt | `npm install jsonwebtoken bcryptjs` |
| Validation | Zod | `npm install zod` |
| Job Queue | BullMQ + Redis | `npm install bullmq` (Redis via Docker) |
| Frontend framework | React 18 + TypeScript | Via Vite scaffold |
| Frontend state | TanStack React Query v5 | `npm install @tanstack/react-query` |
| Frontend routing | React Router v6 | `npm install react-router-dom` |
| HTTP client | Axios | `npm install axios` |
| Testing | Vitest + Supertest | `npm install -D vitest supertest @types/supertest` |
| Containerization | Docker Compose | Already installed |

---

## PHASE 0: PROJECT SCAFFOLDING

**Goal:** Create the monorepo directory structure, Docker Compose file, and initialize both backend and frontend projects.

### Step 0.1: Create directory structure

Create the following directories (all relative to project root):

```
server/
server/src/
server/src/middleware/
server/src/routes/
server/src/services/
server/src/jobs/
server/src/jobs/workers/
server/src/utils/
server/prisma/
server/tests/
client/
shared/
```

### Step 0.2: Create `docker-compose.yml` in project root

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: newtonite-db
    environment:
      POSTGRES_USER: newtonite
      POSTGRES_PASSWORD: newtonite_dev
      POSTGRES_DB: newtonite
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U newtonite"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: newtonite-redis
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

### Step 0.3: Create `server/.env`

```env
DATABASE_URL="postgresql://newtonite:newtonite_dev@localhost:5432/newtonite?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="newtonite-dev-secret-change-in-production"
JWT_EXPIRES_IN="8h"
PORT=3001
NODE_ENV=development
```

### Step 0.4: Create `server/.env.example`

Same content as `.env` above but with placeholder values for secrets.

### Step 0.5: Initialize server `package.json`

Run from `server/` directory:
```bash
npm init -y
```

Then install all server dependencies in ONE command:
```bash
npm install express @prisma/client jsonwebtoken bcryptjs zod bullmq uuid cors
npm install -D typescript @types/node @types/express @types/jsonwebtoken @types/bcryptjs @types/uuid @types/cors ts-node tsx prisma vitest supertest @types/supertest @faker-js/faker dotenv
```

### Step 0.6: Create `server/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src/**/*", "../shared/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Step 0.7: Add scripts to `server/package.json`

Add these scripts to the `package.json`:
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "db:reset": "prisma migrate reset --force",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### Step 0.8: Scaffold the frontend with Vite

Run from project root:
```bash
npx -y create-vite@latest client --template react-ts
```

If `client/` already exists (from step 0.1), remove it first then run the command, OR run with `--force`.

Then install frontend dependencies from `client/` directory:
```bash
cd client
npm install
npm install @tanstack/react-query react-router-dom axios
npm install -D @types/node
```

### Step 0.9: Create `client/vite.config.ts`

Overwrite the Vite config to add API proxy:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

### Step 0.10: Start Docker containers

Run from project root:
```bash
docker-compose up -d
```

Wait for health checks to pass before proceeding.

### Step 0.11: Verify connectivity

```bash
# Test PostgreSQL
docker exec newtonite-db pg_isready -U newtonite

# Test Redis
docker exec newtonite-redis redis-cli ping
```

Both must succeed before proceeding to Phase 1.

---

## PHASE 1: DATABASE SCHEMA & SEED DATA

**Goal:** Define the complete Prisma schema with all entities, create migrations, and seed realistic demo data.

**Depends on:** Phase 0 complete, Docker containers running.

### Step 1.1: Create `server/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── ENUMS ───────────────────────────────────────────

enum TeamRole {
  ADMIN
  MANAGER
  MEMBER
  VIEWER
}

enum WorkItemType {
  INCIDENT
  TASK
  REQUEST
  INVESTIGATION
}

enum WorkItemStatus {
  OPEN
  TRIAGED
  IN_PROGRESS
  BLOCKED
  RESOLVED
  CLOSED
}

enum WorkItemPriority {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

enum EventAction {
  CREATED
  UPDATED
  STATUS_CHANGED
  PRIORITY_CHANGED
  ASSIGNED
  UNASSIGNED
  COMMENTED
  RESOLVED
  CLOSED
  REOPENED
}

// ─── MODELS ──────────────────────────────────────────

model User {
  id             String          @id @default(uuid())
  email          String          @unique
  name           String
  passwordHash   String          @map("password_hash")
  createdAt      DateTime        @default(now()) @map("created_at")
  updatedAt      DateTime        @updatedAt @map("updated_at")

  teamMemberships TeamMember[]
  assignedItems   WorkItem[]     @relation("AssignedItems")
  reportedItems   WorkItem[]     @relation("ReportedItems")
  events          WorkItemEvent[]
  comments        Comment[]
  idempotencyKeys IdempotencyKey[]

  @@map("users")
}

model Team {
  id          String       @id @default(uuid())
  name        String       @unique
  description String?
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  members     TeamMember[]
  workItems   WorkItem[]

  @@map("teams")
}

model TeamMember {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  teamId    String   @map("team_id")
  role      TeamRole @default(MEMBER)
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([userId, teamId])
  @@map("team_members")
}

model WorkItem {
  id          String           @id @default(uuid())
  title       String
  description String?
  type        WorkItemType     @default(TASK)
  status      WorkItemStatus   @default(OPEN)
  priority    WorkItemPriority @default(MEDIUM)
  version     Int              @default(1) // ★ FOR OPTIMISTIC CONCURRENCY CONTROL
  assigneeId  String?          @map("assignee_id")
  reporterId  String           @map("reporter_id")
  teamId      String           @map("team_id")
  dueDate     DateTime?        @map("due_date")
  createdAt   DateTime         @default(now()) @map("created_at")
  updatedAt   DateTime         @updatedAt @map("updated_at")

  assignee    User?            @relation("AssignedItems", fields: [assigneeId], references: [id])
  reporter    User             @relation("ReportedItems", fields: [reporterId], references: [id])
  team        Team             @relation(fields: [teamId], references: [id])
  events      WorkItemEvent[]
  comments    Comment[]

  @@index([status])
  @@index([priority])
  @@index([teamId])
  @@index([assigneeId])
  @@index([reporterId])
  @@index([createdAt])
  @@index([updatedAt])
  @@index([teamId, status])
  @@index([assigneeId, status])
  @@map("work_items")
}

model WorkItemEvent {
  id         String      @id @default(uuid())
  workItemId String      @map("work_item_id")
  userId     String      @map("user_id")
  action     EventAction
  changes    Json?       // JSONB: { field: { from: oldValue, to: newValue } }
  metadata   Json?       // JSONB: any additional context
  createdAt  DateTime    @default(now()) @map("created_at")

  workItem   WorkItem    @relation(fields: [workItemId], references: [id], onDelete: Cascade)
  user       User        @relation(fields: [userId], references: [id])

  @@index([workItemId])
  @@index([createdAt])
  @@map("work_item_events")
}

model Comment {
  id         String   @id @default(uuid())
  workItemId String   @map("work_item_id")
  userId     String   @map("user_id")
  body       String
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  workItem   WorkItem @relation(fields: [workItemId], references: [id], onDelete: Cascade)
  user       User     @relation(fields: [userId], references: [id])

  @@index([workItemId])
  @@index([createdAt])
  @@map("comments")
}

model IdempotencyKey {
  id             String   @id @default(uuid())
  key            String   @unique
  userId         String   @map("user_id")
  method         String   // HTTP method: POST, PATCH, etc.
  path           String   // Request path
  statusCode     Int      @map("status_code")
  responseBody   Json     @map("response_body")
  createdAt      DateTime @default(now()) @map("created_at")
  expiresAt      DateTime @map("expires_at")

  user           User     @relation(fields: [userId], references: [id])

  @@index([expiresAt])
  @@map("idempotency_keys")
}
```

### Step 1.2: Run Prisma migration

From `server/` directory:
```bash
npx prisma migrate dev --name init
```

This creates the database tables. Verify it succeeds before proceeding.

### Step 1.3: Generate Prisma client

```bash
npx prisma generate
```

### Step 1.4: Create `server/prisma/seed.ts`

This seed script must create:
- **3 teams**: "Engineering", "Customer Support", "Finance"
- **10 users** with hashed passwords (all using password: `password123`)
- **Team memberships**: Each user belongs to 1-3 teams with varying roles
- **50 work items**: Distributed across teams, with varied types/statuses/priorities
- **100+ work item events**: Audit trail entries for status changes, reassignments
- **30+ comments**: On various work items

Use `@faker-js/faker` for realistic data. Use `bcryptjs` to hash passwords.

**Important seed users for demo/testing** (create these exact users first, then generate random ones):

| Email | Name | Teams & Roles |
|-------|------|--------------|
| `admin@newtonite.com` | Alice Admin | Engineering (ADMIN), Customer Support (ADMIN), Finance (ADMIN) |
| `manager@newtonite.com` | Bob Manager | Engineering (MANAGER), Customer Support (MANAGER) |
| `member@newtonite.com` | Carol Member | Engineering (MEMBER), Finance (VIEWER) |
| `viewer@newtonite.com` | Dave Viewer | Engineering (VIEWER) |

The seed script must:
1. Clear all existing data (in correct order to respect foreign keys: comments → events → work items → team members → teams → idempotency keys → users)
2. Create users with bcrypt-hashed passwords
3. Create teams
4. Create team memberships
5. Create work items with varied statuses and priorities
6. Create work item events (CREATED event for each item, plus random status changes and assignments)
7. Create comments on random work items

Add `prisma.seed` to `server/package.json`:
```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

### Step 1.5: Run the seed

```bash
npx prisma db seed
```

Verify by running:
```bash
npx prisma studio
```

Check that all tables have data.

---

## PHASE 2: SHARED TYPES

**Goal:** Define TypeScript types shared between server and client.

**Depends on:** Phase 1 (need to know the schema).

### Step 2.1: Create `shared/types.ts`

This file defines all the TypeScript interfaces and types used by both server and client. It must include:

```typescript
// ─── Enums (mirror Prisma enums) ─────────────────

export enum TeamRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export enum WorkItemType {
  INCIDENT = 'INCIDENT',
  TASK = 'TASK',
  REQUEST = 'REQUEST',
  INVESTIGATION = 'INVESTIGATION',
}

export enum WorkItemStatus {
  OPEN = 'OPEN',
  TRIAGED = 'TRIAGED',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum WorkItemPriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum EventAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  PRIORITY_CHANGED = 'PRIORITY_CHANGED',
  ASSIGNED = 'ASSIGNED',
  UNASSIGNED = 'UNASSIGNED',
  COMMENTED = 'COMMENTED',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED',
}

// ─── Valid State Transitions ─────────────────────
// This map defines which status transitions are allowed.
// Key = current status, Value = array of allowed next statuses.
// This MUST be enforced server-side in the transition endpoint.

export const VALID_STATUS_TRANSITIONS: Record<WorkItemStatus, WorkItemStatus[]> = {
  [WorkItemStatus.OPEN]: [WorkItemStatus.TRIAGED, WorkItemStatus.IN_PROGRESS, WorkItemStatus.CLOSED],
  [WorkItemStatus.TRIAGED]: [WorkItemStatus.IN_PROGRESS, WorkItemStatus.BLOCKED, WorkItemStatus.CLOSED],
  [WorkItemStatus.IN_PROGRESS]: [WorkItemStatus.BLOCKED, WorkItemStatus.RESOLVED, WorkItemStatus.CLOSED],
  [WorkItemStatus.BLOCKED]: [WorkItemStatus.IN_PROGRESS, WorkItemStatus.CLOSED],
  [WorkItemStatus.RESOLVED]: [WorkItemStatus.CLOSED, WorkItemStatus.IN_PROGRESS], // reopen
  [WorkItemStatus.CLOSED]: [WorkItemStatus.OPEN], // reopen fully
};

// ─── Permission Definitions ──────────────────────
// Maps roles to allowed actions. Used by the authorize middleware.

export enum Permission {
  CREATE_WORK_ITEM = 'CREATE_WORK_ITEM',
  VIEW_WORK_ITEM = 'VIEW_WORK_ITEM',
  EDIT_OWN_WORK_ITEM = 'EDIT_OWN_WORK_ITEM',
  EDIT_ANY_WORK_ITEM = 'EDIT_ANY_WORK_ITEM',
  ASSIGN_WORK_ITEM = 'ASSIGN_WORK_ITEM',
  TRANSITION_WORK_ITEM = 'TRANSITION_WORK_ITEM',
  CLOSE_OWN_WORK_ITEM = 'CLOSE_OWN_WORK_ITEM',
  CLOSE_ANY_WORK_ITEM = 'CLOSE_ANY_WORK_ITEM',
  ADD_COMMENT = 'ADD_COMMENT',
  MANAGE_TEAM = 'MANAGE_TEAM',
}

export const ROLE_PERMISSIONS: Record<TeamRole, Permission[]> = {
  [TeamRole.VIEWER]: [
    Permission.VIEW_WORK_ITEM,
  ],
  [TeamRole.MEMBER]: [
    Permission.VIEW_WORK_ITEM,
    Permission.CREATE_WORK_ITEM,
    Permission.EDIT_OWN_WORK_ITEM,
    Permission.TRANSITION_WORK_ITEM,
    Permission.CLOSE_OWN_WORK_ITEM,
    Permission.ADD_COMMENT,
  ],
  [TeamRole.MANAGER]: [
    Permission.VIEW_WORK_ITEM,
    Permission.CREATE_WORK_ITEM,
    Permission.EDIT_OWN_WORK_ITEM,
    Permission.EDIT_ANY_WORK_ITEM,
    Permission.ASSIGN_WORK_ITEM,
    Permission.TRANSITION_WORK_ITEM,
    Permission.CLOSE_OWN_WORK_ITEM,
    Permission.CLOSE_ANY_WORK_ITEM,
    Permission.ADD_COMMENT,
  ],
  [TeamRole.ADMIN]: [
    Permission.VIEW_WORK_ITEM,
    Permission.CREATE_WORK_ITEM,
    Permission.EDIT_OWN_WORK_ITEM,
    Permission.EDIT_ANY_WORK_ITEM,
    Permission.ASSIGN_WORK_ITEM,
    Permission.TRANSITION_WORK_ITEM,
    Permission.CLOSE_OWN_WORK_ITEM,
    Permission.CLOSE_ANY_WORK_ITEM,
    Permission.ADD_COMMENT,
    Permission.MANAGE_TEAM,
  ],
};

// ─── API Request/Response Types ──────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: UserResponse;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  teams: Array<{
    teamId: string;
    teamName: string;
    role: TeamRole;
  }>;
}

export interface CreateWorkItemRequest {
  title: string;
  description?: string;
  type: WorkItemType;
  priority: WorkItemPriority;
  teamId: string;
  assigneeId?: string;
  dueDate?: string; // ISO date string
}

export interface UpdateWorkItemRequest {
  title?: string;
  description?: string;
  priority?: WorkItemPriority;
  dueDate?: string | null;
  version: number; // ★ REQUIRED for optimistic concurrency control
}

export interface TransitionWorkItemRequest {
  status: WorkItemStatus;
  version: number; // ★ REQUIRED for OCC
}

export interface AssignWorkItemRequest {
  assigneeId: string | null; // null = unassign
  version: number; // ★ REQUIRED for OCC
}

export interface CreateCommentRequest {
  body: string;
}

export interface WorkItemResponse {
  id: string;
  title: string;
  description: string | null;
  type: WorkItemType;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  version: number;
  assignee: { id: string; name: string; email: string } | null;
  reporter: { id: string; name: string; email: string };
  team: { id: string; name: string };
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemListResponse {
  items: WorkItemResponse[];
  nextCursor: string | null;
  totalCount: number;
}

export interface TimelineEntry {
  id: string;
  type: 'event' | 'comment';
  userId: string;
  userName: string;
  createdAt: string;
  // For events:
  action?: EventAction;
  changes?: Record<string, { from: unknown; to: unknown }>;
  // For comments:
  body?: string;
}

export interface DashboardSummary {
  totalOpen: number;
  totalCritical: number;
  totalAssignedToMe: number;
  byStatus: Record<WorkItemStatus, number>;
  byPriority: Record<WorkItemPriority, number>;
  recentActivity: TimelineEntry[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
    currentState?: WorkItemResponse; // included in 409 Conflict responses
  };
}

// ─── SSE Event Types ─────────────────────────────

export interface SSEWorkItemUpdated {
  type: 'WORK_ITEM_UPDATED';
  workItemId: string;
  updatedBy: string;
  updatedByName: string;
  version: number;
  changes: Record<string, { from: unknown; to: unknown }>;
  timestamp: string;
}

export interface SSEWorkItemCreated {
  type: 'WORK_ITEM_CREATED';
  workItem: WorkItemResponse;
  timestamp: string;
}

export type SSEEvent = SSEWorkItemUpdated | SSEWorkItemCreated;
```

---

## PHASE 3: SERVER CORE & MIDDLEWARE

**Goal:** Create the Express app, error handling, auth middleware, authorization middleware, and idempotency middleware.

**Depends on:** Phases 0, 1, 2.

### Step 3.1: Create `server/src/config.ts`

Load environment variables using `dotenv`. Export a typed config object:
```typescript
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET!,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  nodeEnv: process.env.NODE_ENV || 'development',
};
```

### Step 3.2: Create `server/src/utils/errors.ts`

Define custom error classes:

```typescript
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(404, 'NOT_FOUND', `${resource} with id '${id}' not found`);
  }
}

export class ConflictError extends AppError {
  // ★ Used for OCC violations — includes currentState so the client can see what changed
  constructor(message: string, public currentState?: unknown) {
    super(409, 'CONFLICT', message, currentState);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'You do not have permission to perform this action') {
    super(403, 'FORBIDDEN', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super(400, 'VALIDATION_ERROR', 'Invalid request data', details);
  }
}
```

### Step 3.3: Create `server/src/utils/pagination.ts`

Implement cursor-based pagination helper:

```typescript
// Cursor is the `createdAt` ISO string + id of the last item (base64-encoded).
// Format: base64(`${createdAt}|${id}`)

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64');
}

export function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
  const [createdAtStr, id] = decoded.split('|');
  return { createdAt: new Date(createdAtStr), id };
}
```

### Step 3.4: Create `server/src/middleware/errorHandler.ts`

Global Express error handler. Must:
1. Log the error (console.error in dev)
2. If it's an `AppError`, return its statusCode/code/message/details
3. If it's a `ConflictError`, include `currentState` in the response
4. For unknown errors, return 500 with a generic message
5. Response format must match `ApiError` type from shared/types.ts

### Step 3.5: Create `server/src/middleware/auth.ts`

JWT authentication middleware. Must:
1. Extract the `Authorization: Bearer <token>` header
2. Verify the JWT using `config.jwtSecret`
3. Decode the payload to get `userId`
4. Fetch the user from the database including their `teamMemberships` (with team info)
5. Attach the user + memberships to `req.user`
6. If token is missing/invalid, throw `UnauthorizedError`

Define the augmented Request type:
```typescript
// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        memberships: Array<{
          teamId: string;
          teamName: string;
          role: TeamRole;
        }>;
      };
    }
  }
}
```

### Step 3.6: Create `server/src/middleware/authorize.ts`

**★ CRITICAL BEHAVIOUR #3: Resource-Level Authorization**

This middleware factory takes a `Permission` and optionally a function to extract the `teamId` from the request. It:
1. Gets the user from `req.user` (set by auth middleware)
2. Determines the relevant `teamId` (from request body, params, or the work item itself)
3. Finds the user's role in that team from their memberships
4. Checks if that role has the required permission using `ROLE_PERMISSIONS` from shared/types
5. If not authorized, throws `ForbiddenError`

**There must be two variants:**
- `authorizeTeam(permission, teamIdExtractor)` — for routes where teamId is known from the request (e.g., creating a work item where `teamId` is in the body)
- `authorizeWorkItem(permission)` — for routes where we need to first load the work item to determine its teamId. This middleware must load the work item, check team membership, then attach the work item to `req.workItem` to avoid a second DB query in the route handler.

### Step 3.7: Create `server/src/middleware/idempotency.ts`

**★ CRITICAL BEHAVIOUR #2: Idempotent Mutations**

This middleware:
1. Checks for `Idempotency-Key` header on POST/PATCH requests
2. If present, queries the `IdempotencyKey` table for a matching key + userId
3. If found and not expired: immediately return the cached `statusCode` and `responseBody` — do NOT proceed to the route handler
4. If not found: let the request proceed, but monkey-patch `res.json()` to intercept the response and save it to the `IdempotencyKey` table with a 24-hour expiry
5. If the header is not present on POST requests, the request proceeds normally (idempotency is opt-in)
6. Use a database transaction to prevent race conditions where two requests with the same key arrive simultaneously

### Step 3.8: Create `server/src/middleware/validate.ts`

A middleware factory that takes a Zod schema and validates `req.body` against it. On failure, throws `ValidationError` with the Zod error details.

```typescript
import { ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors';
import { Request, Response, NextFunction } from 'express';

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.flatten());
    }
    req.body = result.data;
    next();
  };
}
```

### Step 3.9: Create `server/src/app.ts`

Set up the Express application:
1. `express.json()` body parser
2. `cors()` middleware (allow all origins in dev)
3. Mount all route files (created in later phases) under `/api/`
4. Mount the global error handler as the last middleware
5. Export the app (do NOT call `app.listen()` here — that goes in `index.ts`)

### Step 3.10: Create `server/src/index.ts`

```typescript
import { app } from './app';
import { config } from './config';

const server = app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down...');
  server.close(() => process.exit(0));
});
```

### Step 3.11: Verify the server starts

```bash
cd server && npm run dev
```

The server should start on port 3001 with no errors. It won't serve any routes yet (404 for everything is expected).

---

## PHASE 4: API ROUTES — AUTH

**Goal:** Implement login, register, and current-user endpoints.

**Depends on:** Phase 3.

### Step 4.1: Create `server/src/services/authService.ts`

Implement:
- `register(email, password, name)` → creates user with bcrypt-hashed password, returns user
- `login(email, password)` → verifies credentials, returns JWT token + user data (including team memberships)
- `getUserById(id)` → returns user with team memberships

### Step 4.2: Create `server/src/routes/auth.ts`

Endpoints:
- `POST /api/auth/register` — body: `{ email, name, password }`. Validate with Zod. Call `authService.register()`. Return `{ token, user }`.
- `POST /api/auth/login` — body: `{ email, password }`. Validate with Zod. Call `authService.login()`. Return `{ token, user }`.
- `GET /api/auth/me` — protected (use auth middleware). Return the current user with their team memberships.

### Step 4.3: Mount auth routes in `app.ts`

```typescript
import authRoutes from './routes/auth';
app.use('/api/auth', authRoutes);
```

### Step 4.4: Test auth manually

```bash
# Register
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@newtonite.com","password":"password123"}'
```

Should return a JWT token. Save it for subsequent tests.

---

## PHASE 5: API ROUTES — WORK ITEMS (WITH CRITICAL BEHAVIOURS)

**Goal:** Implement all work item CRUD + the 3 critical behaviours.

**Depends on:** Phase 4 (auth must work).

### Step 5.1: Create `server/src/services/workItemService.ts`

This is the most important file. It implements the business logic for work items.

**Methods to implement:**

#### `listWorkItems(filters, pagination, userId)`
- Query work items with filters: `status`, `priority`, `type`, `teamId`, `assigneeId`, `search` (ILIKE on title/description)
- Only return work items for teams the user belongs to (resource-level filtering)
- Cursor-based pagination: order by `createdAt DESC, id DESC`
- Return `{ items, nextCursor, totalCount }`
- Include `assignee`, `reporter`, `team` relations

#### `getWorkItemById(id, userId)`
- Fetch the work item with relations
- Check that the user belongs to the work item's team (throw `ForbiddenError` if not)
- Return the work item

#### `createWorkItem(data, userId)`
- Verify user has `CREATE_WORK_ITEM` permission in the target team
- Create the work item with `version: 1`
- Create a `WorkItemEvent` with action `CREATED`
- Return the created work item
- Emit SSE event (see Phase 8)

#### `updateWorkItem(id, data, userId)` — ★ CRITICAL BEHAVIOUR #1: OCC

**This method MUST implement optimistic concurrency control:**

```typescript
// Use Prisma's raw query or updateMany with version check
const updated = await prisma.workItem.updateMany({
  where: {
    id: id,
    version: data.version, // ★ Only update if version matches
  },
  data: {
    ...fieldsToUpdate,
    version: { increment: 1 }, // ★ Increment version on success
  },
});

if (updated.count === 0) {
  // Version mismatch — someone else updated the item
  const currentItem = await prisma.workItem.findUnique({ where: { id } });
  throw new ConflictError(
    'This work item has been modified by another user. Please review the changes.',
    formatWorkItemResponse(currentItem) // ★ Return current state so client can see what changed
  );
}
```

After successful update:
- Compute the diff (which fields changed, old value → new value)
- Create a `WorkItemEvent` with action `UPDATED` and the changes as JSONB
- Fetch and return the updated work item
- Emit SSE event

#### `transitionWorkItem(id, newStatus, version, userId)`
- Load the work item
- Verify the transition is valid using `VALID_STATUS_TRANSITIONS` map
- If invalid, throw `ValidationError` with message: `Cannot transition from ${currentStatus} to ${newStatus}`
- Apply OCC (same version check as `updateWorkItem`)
- Create appropriate `WorkItemEvent` (STATUS_CHANGED, RESOLVED, CLOSED, or REOPENED depending on the transition)
- Emit SSE event

#### `assignWorkItem(id, assigneeId, version, userId)`
- Verify user has `ASSIGN_WORK_ITEM` permission
- If `assigneeId` is provided, verify the assignee is a member of the work item's team
- Apply OCC (version check)
- Create `WorkItemEvent` with action `ASSIGNED` or `UNASSIGNED`
- Emit SSE event

### Step 5.2: Create `server/src/services/auditService.ts`

Helper to create `WorkItemEvent` records:

```typescript
export async function recordEvent(
  workItemId: string,
  userId: string,
  action: EventAction,
  changes?: Record<string, { from: unknown; to: unknown }>,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.workItemEvent.create({
    data: {
      workItemId,
      userId,
      action,
      changes: changes ?? undefined,
      metadata: metadata ?? undefined,
    },
  });
}
```

### Step 5.3: Create `server/src/routes/workItems.ts`

Define all work item routes:

```
GET    /api/work-items                → listWorkItems
POST   /api/work-items                → createWorkItem (use idempotency middleware)
GET    /api/work-items/:id            → getWorkItemById
PATCH  /api/work-items/:id            → updateWorkItem (use idempotency middleware)
POST   /api/work-items/:id/transition → transitionWorkItem (use idempotency middleware)
POST   /api/work-items/:id/assign     → assignWorkItem (use idempotency middleware)
```

**Middleware chain for each route:**

- `GET /` → `authMiddleware` → handler
- `POST /` → `authMiddleware` → `idempotencyMiddleware` → `validate(createWorkItemSchema)` → handler (authorization checked inside service since teamId comes from body)
- `GET /:id` → `authMiddleware` → handler (authorization checked inside service)
- `PATCH /:id` → `authMiddleware` → `idempotencyMiddleware` → `validate(updateWorkItemSchema)` → handler
- `POST /:id/transition` → `authMiddleware` → `idempotencyMiddleware` → `validate(transitionSchema)` → handler
- `POST /:id/assign` → `authMiddleware` → `idempotencyMiddleware` → `validate(assignSchema)` → handler

**Zod schemas to define:**
- `createWorkItemSchema` — validates `CreateWorkItemRequest`
- `updateWorkItemSchema` — validates `UpdateWorkItemRequest` (version is required!)
- `transitionSchema` — validates `TransitionWorkItemRequest`
- `assignSchema` — validates `AssignWorkItemRequest`

### Step 5.4: Create `server/src/routes/comments.ts`

```
GET    /api/work-items/:id/comments → list comments for work item (paginated)
POST   /api/work-items/:id/comments → add comment (creates WorkItemEvent too)
```

### Step 5.5: Create `server/src/routes/teams.ts`

```
GET    /api/teams                   → list teams the current user belongs to
GET    /api/teams/:id               → get team details with member list
GET    /api/teams/:id/members       → list team members
POST   /api/teams/:id/members       → add member (ADMIN only)
```

### Step 5.6: Create `server/src/routes/dashboard.ts`

```
GET    /api/dashboard/summary       → aggregated stats
GET    /api/dashboard/my-items      → work items assigned to current user
```

The summary endpoint must return:
- Count of open items (across user's teams)
- Count of critical priority items
- Count of items assigned to current user
- Breakdown by status
- Breakdown by priority
- 10 most recent activity entries

### Step 5.7: Mount all routes in `app.ts`

```typescript
import workItemRoutes from './routes/workItems';
import commentRoutes from './routes/comments';
import teamRoutes from './routes/teams';
import dashboardRoutes from './routes/dashboard';

app.use('/api/work-items', workItemRoutes);
app.use('/api/work-items', commentRoutes); // nested under work-items
app.use('/api/teams', teamRoutes);
app.use('/api/dashboard', dashboardRoutes);
```

### Step 5.8: Manual API testing

Test every endpoint with curl. Especially verify:

1. **OCC test:** GET a work item (note version), PATCH it (succeeds), PATCH it again with old version (should get 409 with current state)
2. **Idempotency test:** POST a work item with `Idempotency-Key: test-key-1`. POST again with same key. Should get identical response, no duplicate created.
3. **Auth test:** Login as `viewer@newtonite.com`, try to PATCH an Engineering work item. Should get 403.

---

## PHASE 6: REAL-TIME SSE & ASYNC PROCESSING

**Goal:** Add Server-Sent Events for stale read detection and BullMQ for async notifications.

**Depends on:** Phase 5.

### Step 6.1: Create an in-memory event emitter for SSE

Create `server/src/services/sseService.ts`:

Use Node.js `EventEmitter` to manage SSE connections. When a work item is updated, emit an event that all SSE listeners for that work item receive.

```typescript
import { EventEmitter } from 'events';

class SSEService {
  private emitter = new EventEmitter();

  // Called by route handlers to add an SSE client
  subscribe(channel: string, callback: (data: string) => void): () => void {
    this.emitter.on(channel, callback);
    return () => this.emitter.off(channel, callback);
  }

  // Called by workItemService after any mutation
  publish(channel: string, event: SSEEvent): void {
    this.emitter.emit(channel, JSON.stringify(event));
  }
}

export const sseService = new SSEService();
```

### Step 6.2: Create `server/src/routes/events.ts`

```
GET /api/events/work-items/:id → SSE stream for a specific work item
GET /api/events/team/:id       → SSE stream for all work items in a team
```

SSE endpoint implementation:
1. Set headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
2. Subscribe to the SSE channel
3. On data, write `data: ${JSON.stringify(event)}\n\n`
4. On client disconnect, unsubscribe

### Step 6.3: Integrate SSE publishing into `workItemService`

After every successful mutation (create, update, transition, assign), call:
```typescript
sseService.publish(`work-item:${id}`, { type: 'WORK_ITEM_UPDATED', ... });
sseService.publish(`team:${teamId}`, { type: 'WORK_ITEM_UPDATED', ... });
```

### Step 6.4: Create `server/src/jobs/queue.ts`

Set up BullMQ with Redis connection:
```typescript
import { Queue, Worker } from 'bullmq';
import { config } from '../config';

const connection = { url: config.redisUrl };

export const notificationQueue = new Queue('notifications', { connection });
```

### Step 6.5: Create `server/src/jobs/workers/notification.ts`

A BullMQ worker that processes notification jobs. For this demo, it logs to console. The structure supports future email/Slack integration.

```typescript
import { Worker, Job } from 'bullmq';

const worker = new Worker('notifications', async (job: Job) => {
  const { type, workItemId, userId, changes } = job.data;
  console.log(`[Notification] ${type} for work item ${workItemId} by user ${userId}`);
  console.log(`[Notification] Changes:`, JSON.stringify(changes));
  // In production: send email, Slack message, push notification
}, {
  connection: { url: config.redisUrl },
  concurrency: 5,
  limiter: { max: 10, duration: 1000 },
});

worker.on('failed', (job, error) => {
  console.error(`[Notification] Job ${job?.id} failed:`, error.message);
  // After 3 retries, the job goes to the dead-letter queue
});
```

Configure retry: `attempts: 3, backoff: { type: 'exponential', delay: 1000 }`

### Step 6.6: Enqueue notification jobs from `workItemService`

After every mutation, add a job to the notification queue:
```typescript
await notificationQueue.add('work-item-updated', {
  type: 'WORK_ITEM_UPDATED',
  workItemId: id,
  userId: userId,
  changes: changes,
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: 100,
  removeOnFail: 50,
});
```

### Step 6.7: Mount events routes in `app.ts`

```typescript
import eventRoutes from './routes/events';
app.use('/api/events', eventRoutes);
```

---

## PHASE 7: FRONTEND

**Goal:** Build the React frontend with dashboard, work item list, detail view, and conflict handling.

**Depends on:** Phase 5 (API must be working). Phase 6 is nice-to-have for SSE but not blocking.

### Step 7.1: Set up client core files

#### `client/src/api/client.ts`
Create an Axios instance:
- Base URL: `/api` (proxied to backend by Vite)
- Request interceptor: attach `Authorization: Bearer <token>` from localStorage
- Response interceptor: on 401, clear token and redirect to `/login`

#### `client/src/api/queries/auth.ts`
React Query hooks:
- `useLogin()` — mutation that calls POST `/api/auth/login`, stores token in localStorage, invalidates user query
- `useCurrentUser()` — query that calls GET `/api/auth/me`
- `useLogout()` — clears token, invalidates all queries

#### `client/src/api/queries/workItems.ts`
React Query hooks:
- `useWorkItems(filters)` — infinite query for paginated list (cursor-based)
- `useWorkItem(id)` — query for single work item detail
- `useCreateWorkItem()` — mutation with idempotency key header (generate UUID per call)
- `useUpdateWorkItem()` — mutation with optimistic update. **On 409 error: display the conflict dialog showing the current server state. Do NOT silently retry.**
- `useTransitionWorkItem()` — mutation with optimistic update + OCC handling
- `useAssignWorkItem()` — mutation
- `useWorkItemTimeline(id)` — query for events + comments

#### `client/src/api/queries/dashboard.ts`
- `useDashboardSummary()` — query for dashboard stats
- `useMyItems()` — query for current user's assigned items

#### `client/src/api/queries/teams.ts`
- `useTeams()` — query for user's teams
- `useTeamMembers(teamId)` — query for team members

### Step 7.2: Create auth context and route protection

#### `client/src/hooks/useAuth.ts`
A React context that:
- Provides `user`, `login()`, `logout()`, `isAuthenticated`
- Stores JWT in `localStorage`
- On mount, calls `/api/auth/me` to validate the stored token

#### `client/src/components/ProtectedRoute.tsx`
A wrapper component that redirects to `/login` if not authenticated.

### Step 7.3: Create `client/src/App.tsx`

Set up React Router with the following routes:
```
/login          → LoginPage (public)
/               → redirect to /dashboard
/dashboard      → DashboardPage (protected)
/work-items     → WorkItemsPage (protected)
/work-items/:id → WorkItemDetailPage (protected)
```

Wrap everything in `QueryClientProvider` from React Query.

### Step 7.4: Create page components

#### `client/src/pages/Login.tsx`
- Email + password form
- On submit, call `useLogin()` mutation
- On success, redirect to `/dashboard`
- Show error messages on failure
- Clean, centered card layout

#### `client/src/pages/Dashboard.tsx`
- Summary cards at the top: "Open Items", "Critical", "Assigned to Me"
- "My Items" section: list of work items assigned to current user
- "Needs Attention" section: critical priority items that are unassigned or OPEN
- Each item is clickable → navigates to detail page
- Auto-refreshes every 30 seconds via React Query `refetchInterval`

#### `client/src/pages/WorkItems.tsx`
- `FilterBar` component at top with:
  - Status dropdown (multi-select)
  - Priority dropdown (multi-select)
  - Team dropdown
  - Assignee dropdown (populated from team members)
  - Search text input (debounced 300ms)
- Work item table/list showing: title, status badge, priority badge, assignee, team, updated date
- Infinite scroll or "Load More" button for pagination
- Clicking a row navigates to detail page
- "Create Work Item" button → opens a create modal/dialog
- Filters are stored in URL query params (shareable)

#### `client/src/pages/WorkItemDetailPage.tsx`
- Header: title (editable), status badge with transition dropdown, priority badge (editable), type badge
- Detail section: description (editable), assignee (editable via dropdown), team, reporter, due date, created/updated timestamps
- Displays current `version` number
- "Save Changes" button that sends PATCH with the current version
- **On 409 Conflict response:** show `ConflictDialog` with server's current state and the user's attempted changes. User can choose "Reload" to fetch fresh data or "Force Update" (which fetches latest version then re-submits)
- Activity Timeline: interleaved list of events and comments, most recent first
- Comment box at the bottom to add new comments
- **SSE integration:** subscribe to `GET /api/events/work-items/:id`. On `WORK_ITEM_UPDATED` event, show `StaleBanner`: "This item was updated by {name}. Click to refresh."

### Step 7.5: Create reusable components

#### `client/src/components/Layout.tsx`
- Top navbar with: app name "Newtonite Ops", navigation links (Dashboard, Work Items), user name, logout button
- Main content area
- Sidebar optional (can be added if time permits)

#### `client/src/components/StatusBadge.tsx`
- Renders a colored pill/badge for the status
- Colors: OPEN=blue, TRIAGED=yellow, IN_PROGRESS=indigo, BLOCKED=red, RESOLVED=green, CLOSED=gray

#### `client/src/components/PriorityIndicator.tsx`
- Renders an icon + colored text for priority
- CRITICAL=red with ⚠️, HIGH=orange, MEDIUM=yellow, LOW=gray

#### `client/src/components/FilterBar.tsx`
- Row of filter dropdowns + search input
- Manages filter state via URL search params
- Calls `onChange` callback with new filters when any filter changes

#### `client/src/components/ActivityTimeline.tsx`
- Renders a vertical timeline of `TimelineEntry` items
- Events show: "{User} {action} — {changes}" with timestamp
- Comments show: "{User}: {body}" with timestamp
- Most recent at top

#### `client/src/components/ConflictDialog.tsx`
- Modal shown when a 409 is received
- Shows: "Conflict Detected" title
- Shows what the user tried to change vs what the server currently has
- Two buttons: "Reload Latest" (refetches) and "Dismiss"

#### `client/src/components/StaleBanner.tsx`
- Yellow banner at top of detail page
- Text: "This item was updated by {name} at {time}. Click to refresh."
- Clicking calls `queryClient.invalidateQueries(['workItem', id])`

#### `client/src/components/WorkItemForm.tsx`
- Reusable form for creating/editing work items
- Fields: title (text), description (textarea), type (select), priority (select), team (select), assignee (select, filtered by team), due date (date picker)
- Validation: title is required, team is required

### Step 7.6: Create `client/src/hooks/useSSE.ts`

A custom hook for subscribing to SSE:

```typescript
export function useSSE(url: string, onMessage: (event: SSEEvent) => void) {
  useEffect(() => {
    const token = localStorage.getItem('token');
    const eventSource = new EventSource(`${url}?token=${token}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as SSEEvent;
      onMessage(data);
    };

    eventSource.onerror = () => {
      // SSE auto-reconnects, just log
      console.warn('SSE connection error, reconnecting...');
    };

    return () => eventSource.close();
  }, [url, onMessage]);
}
```

### Step 7.7: Create `client/src/hooks/useFilters.ts`

A hook that reads/writes filter state from URL search params:
```typescript
export function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Parse filters from searchParams
  // Return { filters, setFilter, clearFilters }
}
```

### Step 7.8: Style the application

**DESIGN PHILOSOPHY: Minimal, industry-standard, internal-tool aesthetic.** Reference apps: Linear, Jira, GitHub Issues, Notion. These tools look clean, professional, and functional — not flashy.

Create `client/src/styles/global.css` with:

**DO:**
- Use a system font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- Use a neutral color palette: white backgrounds, `#f9fafb` for secondary surfaces, `#111827` for text, `#6b7280` for secondary text
- Use a 4px base spacing unit: `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`
- Use `14px` base font size, `13px` for secondary text, `16px-20px` for headings
- Use thin `1px solid #e5e7eb` borders for cards, tables, and dividers
- Use small `4px` border-radius for inputs/buttons, `9999px` for badges/pills
- Use functional colors only for status/priority badges:
  - Status: OPEN=`#3b82f6` blue, TRIAGED=`#f59e0b` amber, IN_PROGRESS=`#6366f1` indigo, BLOCKED=`#ef4444` red, RESOLVED=`#10b981` green, CLOSED=`#6b7280` gray
  - Priority: CRITICAL=`#dc2626` red, HIGH=`#f97316` orange, MEDIUM=`#eab308` yellow, LOW=`#9ca3af` gray
- Use `cursor: pointer` on interactive elements
- Use `:hover` background changes for table rows (`#f9fafb`) and buttons (`darken by 5%`)
- Use `max-width: 1200px` centered container for main content
- Make tables full-width with left-aligned text, right-aligned numbers/dates
- Style form inputs with `padding: 8px 12px`, `border: 1px solid #d1d5db`, `border-radius: 4px`
- Use a fixed top navbar (`height: 56px`, white background, bottom border)

**DO NOT:**
- Add gradients, glassmorphism, backdrop-blur, or box-shadows deeper than `0 1px 2px rgba(0,0,0,0.05)`
- Add animations or transitions longer than `150ms` (only use for button hover, dropdown open)
- Use custom fonts from Google Fonts — system fonts are faster and look professional
- Add dark mode — it's extra work with zero scoring value
- Use bright/saturated background colors — keep backgrounds neutral
- Add decorative icons or illustrations
- Round corners more than `8px` on any element (except circular badges)

### Step 7.9: Test the frontend

Start both servers:
```bash
# Terminal 1: server
cd server && npm run dev

# Terminal 2: client
cd client && npm run dev
```

Open `http://localhost:5173`. Test the full flow:
1. Login as `admin@newtonite.com` / `password123`
2. Dashboard should show summary cards and assigned items
3. Navigate to Work Items → see filtered list
4. Click a work item → see detail with timeline
5. Edit a field → save → verify version incremented
6. Open same item in two tabs → edit in one → try editing in other with old version → verify 409 conflict dialog appears

---

## PHASE 8: AUTOMATED TESTS

**Goal:** Write automated tests covering the 3 critical behaviours and key business logic.

**Depends on:** Phase 5.

### Step 8.1: Create `server/tests/setup.ts`

Test setup file that:
1. Creates a separate test database (or uses a transaction wrapper that rolls back after each test)
2. Runs migrations on the test database
3. Seeds minimal test data (2 users, 2 teams, team memberships with different roles)
4. Exports helper functions: `loginAsAdmin()`, `loginAsMember()`, `loginAsViewer()`, `createTestWorkItem()`

### Step 8.2: Create `server/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000,
  },
});
```

### Step 8.3: Create `server/tests/concurrency.test.ts`

**Tests for Critical Behaviour #1: Optimistic Concurrency Control**

```
Test: "should reject update when version is stale"
  1. Create a work item (version = 1)
  2. Update it successfully (version becomes 2)
  3. Attempt to update it with version = 1
  4. Assert: response is 409 Conflict
  5. Assert: response body contains `currentState` with version = 2

Test: "should handle simultaneous updates correctly"
  1. Create a work item
  2. Send two PATCH requests simultaneously (same version) using Promise.all
  3. Assert: exactly one succeeds (200) and one fails (409)

Test: "should increment version on successful update"
  1. Create a work item (version = 1)
  2. Update title (version → 2)
  3. Update priority with version = 2 (version → 3)
  4. Assert: final version is 3

Test: "should reject state transition with stale version"
  1. Create a work item (OPEN, version = 1)
  2. Transition to IN_PROGRESS (version → 2)
  3. Attempt to transition from OPEN to TRIAGED with version = 1
  4. Assert: 409 Conflict
```

### Step 8.4: Create `server/tests/idempotency.test.ts`

**Tests for Critical Behaviour #2: Idempotent Mutations**

```
Test: "should return cached response for duplicate POST with same idempotency key"
  1. POST /api/work-items with Idempotency-Key: "test-create-1"
  2. Assert: 201 Created, note the work item ID
  3. POST /api/work-items with Idempotency-Key: "test-create-1" (same key, same body)
  4. Assert: response is identical (same status code, same body, same work item ID)
  5. Assert: only ONE work item exists in the database

Test: "should process normally without idempotency key"
  1. POST /api/work-items without Idempotency-Key header
  2. POST /api/work-items without Idempotency-Key header (identical body)
  3. Assert: TWO work items created (no dedup without the header)

Test: "should treat different idempotency keys as different requests"
  1. POST with key "key-a"
  2. POST with key "key-b" (same body)
  3. Assert: two different work items created
```

### Step 8.5: Create `server/tests/authorization.test.ts`

**Tests for Critical Behaviour #3: Resource-Level Authorization**

```
Test: "VIEWER cannot create work items in their team"
  1. Login as viewer (VIEWER in Engineering team)
  2. POST /api/work-items for Engineering team
  3. Assert: 403 Forbidden

Test: "MEMBER can create work items in their team"
  1. Login as member (MEMBER in Engineering team)
  2. POST /api/work-items for Engineering team
  3. Assert: 201 Created

Test: "MEMBER cannot edit other users' work items"
  1. Login as admin, create a work item
  2. Login as member, PATCH the work item
  3. Assert: 403 Forbidden

Test: "MANAGER can edit any work item in their team"
  1. Login as admin, create a work item
  2. Login as manager, PATCH the work item
  3. Assert: 200 OK

Test: "User cannot access work items from teams they don't belong to"
  1. Login as member (MEMBER in Engineering, VIEWER in Finance)
  2. Create a work item in Finance (should fail — VIEWER can't create)
  3. Try to PATCH a Finance work item (should fail — VIEWER can't edit)
  4. GET a Finance work item (should succeed — VIEWER can view)

Test: "Authorization is enforced server-side, not just UI"
  1. Login as viewer
  2. Directly call PATCH /api/work-items/:id with valid payload
  3. Assert: 403 Forbidden (not 404, not 200)

Test: "User cannot see work items from teams they don't belong to"
  1. Create a user with no team memberships
  2. GET /api/work-items
  3. Assert: empty list (not all work items)
```

### Step 8.6: Create `server/tests/workItems.test.ts`

**Tests for business logic:**

```
Test: "should enforce valid state transitions"
  1. Create work item (OPEN)
  2. Transition to RESOLVED → Assert: 400 (invalid, must go through IN_PROGRESS)
  3. Transition to IN_PROGRESS → Assert: 200
  4. Transition to RESOLVED → Assert: 200
  5. Transition to CLOSED → Assert: 200
  6. Transition to OPEN → Assert: 200 (reopen)

Test: "should create audit event on every change"
  1. Create work item → check WorkItemEvent with action CREATED exists
  2. Update title → check WorkItemEvent with action UPDATED and changes showing old/new title
  3. Transition status → check WorkItemEvent with action STATUS_CHANGED

Test: "should not assign user who is not a team member"
  1. Create work item in Engineering team
  2. Try to assign a user who is only in Finance team
  3. Assert: 400 Bad Request

Test: "pagination returns stable results under concurrent inserts"
  1. Create 20 work items
  2. Fetch page 1 (10 items), note the cursor
  3. Create 5 more work items (simulating concurrent inserts)
  4. Fetch page 2 using the cursor
  5. Assert: no items are duplicated or skipped from the original set
```

### Step 8.7: Run all tests

```bash
cd server && npm test
```

All tests must pass. Fix any failures before proceeding.

---

## PHASE 9: DOCUMENTATION

**Goal:** Write all required documentation.

**Depends on:** All previous phases.

### Step 9.1: Create `ENGINEERING_DECISIONS.md` in project root

Write exactly 5 engineering decisions. Each must include:
- **Decision:** What you decided
- **Context:** Why this decision was needed
- **Options Considered:** At least 2 alternatives
- **Decision Rationale:** Why you chose this option
- **Trade-offs:** What you gave up

**The 5 decisions (write these exactly):**

1. **Optimistic Concurrency Control via Integer Version Field**
   - Context: Multiple users editing the same work item simultaneously
   - Options: Pessimistic locking (SELECT FOR UPDATE), last-write-wins, OCC with version, OCC with ETag
   - Chosen: OCC with integer version field
   - Rationale: Pessimistic locking serializes writes and degrades performance. Last-write-wins silently loses data. OCC detects conflicts without holding locks, suitable for a read-heavy system with occasional write contention.
   - Trade-off: Users see conflict dialogs when concurrent edits happen. Acceptable because data integrity > convenience.

2. **Append-Only Audit Log for Work Item History**
   - Context: The brief explicitly requires understanding "what has happened previously" and "why a particular decision was made"
   - Options: Update-in-place with `updatedAt`, soft deletes with history table, append-only event log
   - Chosen: Append-only WorkItemEvent table with JSONB change diffs
   - Rationale: Immutable event log ensures history cannot be tampered with. JSONB diffs make it easy to see exactly what changed.
   - Trade-off: Storage grows linearly. Mitigated by archival policies and paginated access.

3. **Resource-Level Authorization over Route-Level**
   - Context: Users belong to multiple teams with different roles
   - Options: Global roles (admin/user), route-level permissions, resource-level (per-team) authorization
   - Chosen: Resource-level authorization checking user's role in the work item's team
   - Rationale: Route-level auth can't handle "MANAGER in Team A but VIEWER in Team B". Each resource access checks the specific team context.
   - Trade-off: More complex authorization logic, extra DB queries. Mitigated by eager-loading team memberships in the auth middleware.

4. **Cursor-Based Pagination over Offset-Based**
   - Context: List endpoints must remain stable as new items are created concurrently
   - Options: Offset/limit, cursor-based (keyset), page tokens
   - Chosen: Cursor-based using `(createdAt, id)` tuple
   - Rationale: Offset pagination breaks when items are inserted between page fetches (items get skipped or duplicated). Cursor-based pagination is stable regardless of concurrent inserts.
   - Trade-off: No "jump to page N" feature. Users must paginate sequentially. Acceptable for a work management tool.

5. **Server-Sent Events over WebSockets for Real-Time Updates**
   - Context: Users viewing a work item need to know when it's been modified by someone else
   - Options: Polling, WebSockets, SSE, Long polling
   - Chosen: SSE for server-to-client push notifications
   - Rationale: We only need server→client communication (notifying viewers of changes). SSE uses standard HTTP, auto-reconnects on failure, and works through most reverse proxies without configuration. WebSockets would add bidirectional complexity we don't need.
   - Trade-off: No client-to-server channel via SSE. If we needed real-time collaborative editing (like Google Docs), WebSockets would be necessary. Not needed for our use case.

### Step 9.2: Update `README.md` in project root

Must include:

```markdown
# Newtonite Operations Manager

An operational work management system for teams to create, track, and resolve work items with full audit history, role-based authorization, and concurrent usage handling.

## Prerequisites

- Docker & Docker Compose
- Node.js 18+
- npm 9+

## Quick Start

1. Clone the repository
2. Start the infrastructure:
   ```bash
   docker-compose up -d
   ```
3. Set up the backend:
   ```bash
   cd server
   cp .env.example .env
   npm install
   npx prisma migrate dev
   npx prisma db seed
   npm run dev
   ```
4. Set up the frontend:
   ```bash
   cd client
   npm install
   npm run dev
   ```
5. Open http://localhost:5173

## Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@newtonite.com | password123 | Admin in all teams |
| manager@newtonite.com | password123 | Manager in Engineering & Support |
| member@newtonite.com | password123 | Member in Engineering, Viewer in Finance |
| viewer@newtonite.com | password123 | Viewer in Engineering |

## Running Tests

```bash
cd server
npm test
```

## Architecture

[Include a Mermaid diagram showing: Client → API Server → PostgreSQL / Redis / BullMQ]

## Known Limitations

1. Notification worker logs to console only (no email/Slack integration)
2. Text search uses PostgreSQL ILIKE (not full-text search with ranking)
3. No file attachments on work items
4. No SLA/due-date automation or escalation
5. JWT-only auth (no refresh tokens or session revocation)
6. No rate limiting on API endpoints
```

### Step 9.3: Final file checklist

Verify these files exist:
- [ ] `docker-compose.yml`
- [ ] `README.md`
- [ ] `ENGINEERING_DECISIONS.md`
- [ ] `server/package.json` with all scripts
- [ ] `server/prisma/schema.prisma`
- [ ] `server/prisma/seed.ts`
- [ ] `server/src/index.ts`
- [ ] `server/src/app.ts`
- [ ] `server/src/config.ts`
- [ ] `server/src/middleware/auth.ts`
- [ ] `server/src/middleware/authorize.ts`
- [ ] `server/src/middleware/idempotency.ts`
- [ ] `server/src/middleware/errorHandler.ts`
- [ ] `server/src/middleware/validate.ts`
- [ ] `server/src/routes/auth.ts`
- [ ] `server/src/routes/workItems.ts`
- [ ] `server/src/routes/comments.ts`
- [ ] `server/src/routes/teams.ts`
- [ ] `server/src/routes/dashboard.ts`
- [ ] `server/src/routes/events.ts`
- [ ] `server/src/services/workItemService.ts`
- [ ] `server/src/services/auditService.ts`
- [ ] `server/src/services/authService.ts`
- [ ] `server/src/services/sseService.ts`
- [ ] `server/src/jobs/queue.ts`
- [ ] `server/src/jobs/workers/notification.ts`
- [ ] `server/src/utils/errors.ts`
- [ ] `server/src/utils/pagination.ts`
- [ ] `server/tests/setup.ts`
- [ ] `server/tests/concurrency.test.ts`
- [ ] `server/tests/idempotency.test.ts`
- [ ] `server/tests/authorization.test.ts`
- [ ] `server/tests/workItems.test.ts`
- [ ] `server/vitest.config.ts`
- [ ] `client/src/App.tsx`
- [ ] `client/src/api/client.ts`
- [ ] `client/src/api/queries/auth.ts`
- [ ] `client/src/api/queries/workItems.ts`
- [ ] `client/src/api/queries/dashboard.ts`
- [ ] `client/src/api/queries/teams.ts`
- [ ] `client/src/hooks/useAuth.ts`
- [ ] `client/src/hooks/useSSE.ts`
- [ ] `client/src/hooks/useFilters.ts`
- [ ] `client/src/components/Layout.tsx`
- [ ] `client/src/components/StatusBadge.tsx`
- [ ] `client/src/components/PriorityIndicator.tsx`
- [ ] `client/src/components/FilterBar.tsx`
- [ ] `client/src/components/ActivityTimeline.tsx`
- [ ] `client/src/components/ConflictDialog.tsx`
- [ ] `client/src/components/StaleBanner.tsx`
- [ ] `client/src/components/WorkItemForm.tsx`
- [ ] `client/src/pages/Login.tsx`
- [ ] `client/src/pages/Dashboard.tsx`
- [ ] `client/src/pages/WorkItems.tsx`
- [ ] `client/src/pages/WorkItemDetailPage.tsx`
- [ ] `client/src/styles/global.css`
- [ ] `shared/types.ts`

### Step 9.4: Final verification

Run this sequence to verify everything works from scratch:

```bash
# 1. Start infrastructure
docker-compose down -v && docker-compose up -d

# 2. Set up server
cd server
npm install
npx prisma migrate dev --name init
npx prisma db seed

# 3. Run tests
npm test

# 4. Start server
npm run dev &

# 5. Start client
cd ../client
npm install
npm run dev &

# 6. Open browser at http://localhost:5173
```

### Step 9.5: Git commit strategy

Make logical commits (not one giant commit):

```bash
git init
git add docker-compose.yml README.md
git commit -m "chore: project setup with Docker Compose"

git add server/prisma/ shared/
git commit -m "feat: database schema and shared types"

git add server/src/config.ts server/src/utils/ server/src/middleware/
git commit -m "feat: server core, middleware, auth, authorization, idempotency"

git add server/src/routes/ server/src/services/
git commit -m "feat: work item API with OCC, audit trail, and comments"

git add server/src/jobs/ server/src/routes/events.ts server/src/services/sseService.ts
git commit -m "feat: SSE real-time updates and BullMQ notification queue"

git add server/tests/ server/vitest.config.ts
git commit -m "test: critical behaviour tests (OCC, idempotency, authorization)"

git add client/
git commit -m "feat: React frontend with dashboard, work items, and conflict handling"

git add ENGINEERING_DECISIONS.md
git commit -m "docs: engineering decisions document"
```

---

## PRIORITY ORDER IF RUNNING OUT OF TIME

If time is running short, cut features in this order (bottom = cut first):

1. **MUST HAVE (non-negotiable):**
   - Working server with all 3 critical behaviours (OCC, idempotency, resource auth)
   - Automated tests for the 3 critical behaviours
   - ENGINEERING_DECISIONS.md
   - README.md with setup instructions
   - Docker Compose
   - Seed data

2. **SHOULD HAVE:**
   - Frontend with login + dashboard + work item list + detail page
   - Audit trail/timeline
   - Search and filtering
   - Comments

3. **NICE TO HAVE (cut first if needed):**
   - SSE real-time updates + stale banner
   - BullMQ notification jobs
   - Polished UI styling
   - Team management pages
   - Frontend infinite scroll
   - URL-based filter state

**The backend with tests and documentation alone is a passing submission. A broken or half-finished frontend with no tests is worse than no frontend at all.**
