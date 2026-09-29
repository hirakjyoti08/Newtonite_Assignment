# Engineering Decisions

This document records 5 important architectural decisions made during the implementation of the Newtonite operational work management system, along with their trade-offs.

---

## 1. Optimistic Concurrency Control (OCC) via Version Field

**Decision:** Implement OCC using an integer `version` field on the `WorkItem` model. Every update increments the version, and UPDATE queries include `WHERE id = $1 AND version = $2`.

**Why:** Prevents lost updates when multiple users edit the same work item simultaneously. The second writer receives a 409 Conflict with the current server state, allowing them to review changes before retrying.

**Trade-offs:**
- **Pros:** No locking required; scales well under low contention; simple to implement and understand.
- **Cons:** Under high contention, users may experience frequent 409 errors requiring manual retry. Could add exponential backoff retry logic for UX improvement.

---

## 2. Idempotent Mutations via Idempotency Keys

**Decision:** Accept an optional `Idempotency-Key` header on POST/PATCH requests. Store the request/response in a database table keyed by `(userId, key)` with 24-hour TTL. Return cached response on duplicate keys.

**Why:** Prevents duplicate work items from double-clicks, network retries, or client-side bugs. Opt-in design doesn't break existing clients.

**Trade-offs:**
- **Pros:** Strong duplicate prevention; works across restarts; minimal client changes required.
- **Cons:** Storage overhead for keys; 24-hour TTL may not cover all retry scenarios; race condition during concurrent same-key requests handled via DB unique constraint.

---

## 3. Resource-Level Authorization with Team-Based Roles

**Decision:** Users belong to teams with roles (ADMIN, MANAGER, MEMBER, VIEWER). Every API request checks the user's role in the work item's team via middleware. Permissions are defined in a central `ROLE_PERMISSIONS` map.

**Why:** Ensures a VIEWER in Team A cannot edit Team A's work items even by calling the API directly. Centralized permission logic prevents authorization bypasses.

**Trade-offs:**
- **Pros:** Fine-grained control; auditable; follows principle of least privilege.
- **Cons:** Additional DB query per request to load team membership; role changes require cache invalidation (not implemented, relies on JWT expiry).

---

## 4. Cursor-Based Pagination with CreatedAt+ID Composite Key

**Decision:** Use base64-encoded `createdAt|id` as cursor for pagination. Order by `createdAt DESC, id DESC`.

**Why:** Stable ordering that handles items created at the same timestamp. Works better than offset pagination for large datasets and real-time updates.

**Trade-offs:**
- **Pros:** Consistent performance regardless of page depth; handles inserts during pagination gracefully.
- **Cons:** Cannot jump to arbitrary page numbers; cursor must be opaque to clients; slightly more complex than offset/limit.

---

## 5. Shared TypeScript Types Between Server and Client

**Decision:** Define all enums, interfaces, and API contracts in `shared/types.ts`, imported by both server (`@shared/*`) and client (`@shared/*` via path alias).

**Why:** Single source of truth for API contracts. Changes to request/response shapes are caught at compile time on both sides.

**Trade-offs:**
- **Pros:** Eliminates drift between client/server types; faster development with autocomplete; refactoring safety.
- **Cons:** Requires monorepo or shared package setup; build configuration complexity (path aliases); shared code must be pure TypeScript (no Node.js APIs).

---

## Bonus: Server-Sent Events (SSE) for Stale Read Detection

**Decision:** Use in-memory EventEmitter for SSE connections. On work item mutations, publish events to `work-item:{id}` and `team:{id}` channels. Frontend subscribes and shows "This item was updated by X" banner.

**Why:** Real-time notification without WebSocket complexity. Works over standard HTTP/2, through proxies, with automatic reconnection.

**Trade-offs:**
- **Pros:** Simple implementation; no additional infrastructure; works with existing auth.
- **Cons:** In-memory only (doesn't scale horizontally); connection per tab; no message persistence for offline clients.