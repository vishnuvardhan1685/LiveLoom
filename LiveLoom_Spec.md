# LiveLoom — Implementation Spec

**What this is:** a VS Code-style multi-user collaborative code editor, built solo in ~2 weeks. This spec is self-contained — paste any one section into a fresh Claude chat to implement that piece without needing prior conversation context.

**Companion doc:** the architecture & lifecycle diagrams (system diagram, sequence diagram, state machine) live in a separate published doc — reference it for the "why," this doc is the "what to build."

---

## 1. Tech Stack

- **Client**: React, Monaco Editor, Yjs (`yjs`, `y-monaco`, `y-websocket` client, `y-indexeddb`, `y-protocols/awareness`)
- **Server**: Node.js, Express (REST), `ws` (raw WebSocket server)
- **Sync/broadcast**: Redis (pub/sub + atomic counters via `ioredis`)
- **Persistence**: MongoDB (via Mongoose)
- **Auth**: JWT (session) + short-lived single-use WS tickets
- **Deploy**: Docker Compose locally; Railway/Render/Fly.io + managed Redis + Mongo for hosted demo

---

## 2. Data Models (MongoDB)

```js
// users
{
  _id, email, passwordHash, name,
  createdAt
}

// rooms
{
  _id, name, ownerId,
  maxUsers: Number (default 12),
  members: [{ userId, role: "owner" | "editor" | "viewer" }],
  createdAt, updatedAt
}

// documents
{
  _id, roomId,
  snapshot: Buffer,        // serialized Yjs update (Y.encodeStateAsUpdate)
  version: Number,
  updatedAt
}

// invites
{
  _id, roomId, role: "editor" | "viewer",
  token: String (unique, indexed),
  createdBy, expiresAt,
  maxUses: Number, usesSoFar: Number,
  createdAt
}
```

---

## 3. REST API

| Endpoint | Purpose |
|---|---|
| `POST /auth/signup` | create user, return JWT |
| `POST /auth/login` | verify credentials, return JWT |
| `POST /rooms` | create room `{ name, maxUsers }`, creator becomes `owner` |
| `GET /rooms/:id` | room metadata + caller's role (404 if not found, 403 if not a member and no valid invite) |
| `POST /rooms/:id/invites` | generate invite `{ role, expiresAt, maxUses }` → returns token/link (requires owner/editor) |
| `GET /invites/:token` | validate token; if valid, attach role membership to caller, return `{ roomId, role }`; 410 if expired/over-used |
| `POST /rooms/:id/ws-ticket` | issue short-lived single-use WS ticket for the caller (requires valid JWT + room membership) |

All endpoints except signup/login require `Authorization: Bearer <JWT>`.

---

## 4. WebSocket Protocol

**Connection**: `wss://host/ws?ticket=<ticket>&roomId=<roomId>`

Ticket is single-use: validated once at handshake, then invalidated server-side immediately (delete from Redis/Mongo) so it can't be replayed.

**Handshake sequence (server-side, in order):**
1. Validate ticket → reject (`4001`) if invalid/expired.
2. Check `room:{roomId}:activeCount` in Redis against `maxUsers` → reject (`4002`, "room full") if at capacity.
3. `INCR room:{roomId}:activeCount`.
4. If no in-memory Y.Doc exists yet for this room on this instance, load latest snapshot from `documents` collection and construct one (`Y.applyUpdate`).
5. `SUBSCRIBE` to `room:{roomId}:doc` and `room:{roomId}:awareness` on Redis if not already subscribed on this instance.
6. Send ack + run Yjs sync protocol (exchange state vectors, send diff) so client converges immediately.

**Message types (binary/JSON envelope, your choice — Yjs updates are binary):**
- `doc-update` — Yjs update, applied to in-memory doc, permission-checked, republished via Redis `room:{id}:doc`, broadcast to local sockets in that room.
- `awareness-update` — cursor/selection/typing state, published via Redis `room:{id}:awareness` only, never touches Mongo.
- `sync-step-1` / `sync-step-2` — Yjs sync protocol messages for initial convergence and reconnect diffing.

**Permission enforcement**: every `doc-update` message checks the sender's role in the in-memory `room -> user -> role` map before applying/broadcasting. `viewer` role → reject with a clear error, don't apply.

**On disconnect**: `DECR room:{roomId}:activeCount`; if this was the last local client for that room, `UNSUBSCRIBE` from its Redis channels (keep the in-memory doc briefly in case of fast reconnect, evict after a short idle timeout).

---

## 5. Redis Usage

| Key/Channel | Purpose | Persisted? |
|---|---|---|
| `room:{id}:doc` (pub/sub channel) | cross-instance document update broadcast | No |
| `room:{id}:awareness` (pub/sub channel) | cross-instance cursor/typing broadcast | No |
| `room:{id}:activeCount` (counter) | atomic connected-user count for capacity enforcement | No (ephemeral, TTL optional) |
| `permission:update` (pub/sub channel) | propagate live role changes to all instances | No |

---

## 6. Persistence / Snapshot Service

- Debounced checkpoint: on each `doc-update`, schedule a snapshot write if none is pending; fire after ~3s of inactivity **or** every N updates, whichever comes first (avoid a write per keystroke).
- Write: `Y.encodeStateAsUpdate(doc)` → `documents` collection, `{ roomId, snapshot, version: version+1, updatedAt }`.
- **Stated durability guarantee**: at most ~3 seconds of edits may be lost in a simultaneous multi-instance crash. This is a deliberate scope tradeoff — document it in the README, don't hide it.

---

## 7. Client Responsibilities

- `useWsTicket`: calls `POST /rooms/:id/ws-ticket` before every (re)connection attempt — tickets are single-use, never reused across reconnects.
- `useYjsDoc`: constructs `Y.Doc`, binds `y-indexeddb` for local persistence, binds the WS provider for remote sync, binds `y-monaco` to the editor instance.
- Awareness: track local cursor/selection; set `typing: true` on each local doc update, clear via a ~1.5s debounce timer, broadcast as part of awareness state.
- `InviteModal`: calls `POST /rooms/:id/invites` with chosen role + expiry, displays the shareable `/join/:token` link.
- Handle WS close codes distinctly in the UI: `4001` → re-auth flow, `4002` → "room full" message, unexpected close → reconnect-with-backoff flow.

---

## 8. Concurrency Model (reference for implementers)

No locking, no last-write-wins. Yjs (YATA algorithm) assigns each operation a unique `(clientID, clock)` ID, positions inserts relative to neighboring content, and deterministically tie-breaks simultaneous inserts at the same position by comparing `clientID`. All replicas converge to the same final state regardless of the order updates arrive in — this is why Redis doesn't need to guarantee ordering and reconnection doesn't need "replay in order."

---

## 9. Edge Cases Checklist (verify each before calling a milestone done)

- [ ] Two clients typing at the same position converge to identical content on both sides
- [ ] Room-full rejection happens before Yjs sync begins, not after
- [ ] Invite link with `viewer` role cannot send `doc-update` (server rejects, doesn't just hide the UI control)
- [ ] Killing one WS instance mid-session: clients on other instances keep working; affected clients reconnect and recover via checkpoint
- [ ] Role downgraded mid-session takes effect on the very next edit attempt, not just on next reconnect
- [ ] Browser closed and reopened without network loss recovers full document from `y-indexeddb` before server round-trip completes
- [ ] Expired/over-used invite token returns a clear error, not a silent failure
- [ ] WS ticket cannot be reused for a second connection

---

## 10. Suggested Build Order (maps to the 2-week plan)

1. Monaco standalone, no collab
2. Yjs + y-monaco + y-websocket demo server (two tabs syncing)
3. Custom WS server: tickets, room capacity, permission map
4. Persistence: snapshot service, hydrate-on-activation
5. Awareness: cursors + typing indicator
6. Invite links: generate/validate/consume, role attachment
7. Redis pub/sub: two instances, cross-instance sync demo
8. Deploy + README (architecture diagram, durability tradeoff stated explicitly) + demo video
