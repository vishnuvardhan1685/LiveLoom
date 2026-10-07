# LiveLoom — Real-Time Collaborative Code Editor & Canvas

LiveLoom is a production-grade real-time collaborative code editor and canvas platform powered by Node.js, Express, Yjs (CRDTs), React, Monaco Editor, MongoDB, and Redis.

---

## Key Features

- **Real-Time CRDT Synchronization**: Instant multi-user document syncing using Yjs and WebSockets.
- **Granular Role-Based Access Control**: Room owner, editor, and viewer roles with live role enforcement.
- **Secure WebSocket Authentication**: Short-lived, HMAC-SHA256 signed tickets preventing unauthorized socket hijacking.
- **Resilient Infrastructure**: Single-instance fallback mode when Redis is unset, automatic socket keepalives (30s ping/pong), and cold-start recovery screens.
- **Containerized Deployment**: Optimised Docker image (`node:22-alpine`, 278 MB image size, 211 MB uncompressed) ready for Render Web Service deployment.

---

## Quick Start (Local Development)

```bash
# 1. Install dependencies
npm ci --prefix server
npm ci --prefix client

# 2. Start containerized stack locally
npm run docker:up

# 3. Run unit tests
npm test

# 4. Check client bundle budget (<500 KB gzipped)
npm run check:bundle

# 5. Run smoke test
npm run smoke
```

---

## CI/CD & Deployment

- **Deployment Guide**: Comprehensive guide in [`docs/DEPLOY.md`](docs/DEPLOY.md).
- **Backend Target**: Render Docker Web Service.
- **Frontend Target**: Vercel Static SPA.
- **GitHub Actions Workflows**:
  - [`.github/workflows/ci.yml`](.github/workflows/ci.yml): Linting, unit tests, bundle size budget check, Docker Buildx caching, quick containerized benchmarks (Tests A, C, K), security audit, and secret scanning.
  - [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): Build & push to GHCR (`ghcr.io`), trigger Render Deploy Hook, poll `/readyz` health status, run post-deploy live smoke test (`scripts/prod_smoke.js`).

---

## Production Rollback Procedures

Refer to [`docs/DEPLOY.md`](docs/DEPLOY.md#8-production-rollback-procedures) for detailed instructions:
- **Backend (Render)**: Navigate to Render Dashboard > `liveloom-backend` > **Deploys** > Click **Rollback** on last stable build.
- **Frontend (Vercel)**: Navigate to Vercel Dashboard > `liveloom` > **Deployments** > Click **Promote to Production** on previous stable build.
