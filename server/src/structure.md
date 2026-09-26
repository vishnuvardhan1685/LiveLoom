server/
├── src/
│   ├── config/
│   │   ├── env.js                # loads/validates env vars
│   │   ├── db.js                 # mongoose connection
│   │   └── redis.js              # ioredis client(s) — separate pub/sub clients
│   │
│   ├── models/
│   │   ├── User.js
│   │   ├── Room.js
│   │   ├── Document.js
│   │   └── Invite.js
│   │
│   ├── middleware/
│   │   ├── auth.js               # JWT verification, attaches req.user
│   │   └── errorHandler.js
│   │
│   ├── routes/
│   │   ├── auth.routes.js        # /auth/signup, /auth/login
│   │   ├── rooms.routes.js       # /rooms, /rooms/:id, /rooms/:id/invites, /rooms/:id/ws-ticket
│   │   └── invites.routes.js     # /invites/:token
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── rooms.controller.js
│   │   └── invites.controller.js
│   │
│   ├── services/
│   │   ├── ticket.service.js     # issue/validate/invalidate single-use WS tickets
│   │   ├── snapshot.service.js   # debounced Y.Doc → Mongo checkpoint
│   │   └── roomState.service.js  # in-memory room->user->role map, activeCount helpers
│   │
│   ├── ws/
│   │   ├── server.js             # raw `ws` server, handshake sequence
│   │   ├── connection.js         # per-connection lifecycle (steps 1-6 from spec §4)
│   │   ├── docSync.js            # Yjs sync-step handling, doc-update permission check + broadcast
│   │   ├── awareness.js          # awareness-update relay
│   │   └── redisBridge.js        # SUBSCRIBE/UNSUBSCRIBE per room, cross-instance fan-out
│   │
│   ├── docStore/
│   │   └── docRegistry.js        # in-memory Map<roomId, Y.Doc>, load/evict logic
│   │
│   ├── utils/
│   │   ├── jwt.js
│   │   └── logger.js
│   │
│   ├── app.js                    # express app, mounts routes + middleware
│   └── index.js                  # entrypoint: connects db/redis, starts http+ws server
│
├── .env.example
├── package.json
└── docker-compose.yml            # mongo, redis, server