# LiveLoom Render & Vercel Deployment Guide

This guide provides step-by-step instructions for deploying LiveLoom:
- **Backend Service**: Containerized Node.js persistent WebSocket & REST server running as a Docker Web Service on **Render**.
- **Frontend SPA**: Static React single-page app hosted on **Vercel**.
- **Database**: Free **MongoDB Atlas** M0 shared cluster.

---

## 1. MongoDB Atlas Setup (Cloud Database)

1. **Create Free M0 Cluster**:
   - Sign up or log into [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
   - Click **Build a Database** and select the free **M0 Shared Cluster**.
   - Choose your preferred cloud provider and region, then click **Create**.

2. **Create Database User**:
   - Under Security in the left sidebar, click **Database Access** > **Add New Database User**.
   - Select **Password** authentication.
   - Enter a username (e.g. `liveloom_admin`) and a secure password.
   - Assign user privileges: `Read and write to any database`.
   - Click **Add User**.

3. **Configure Network Access**:
   - Under Security, click **Network Access** > **Add IP Address**.
   - Click **Allow Access from Anywhere** (`0.0.0.0/0`) to allow Render container outbound traffic.
   - Click **Confirm**.

4. **Copy Connection String (`MONGO_URI`)**:
   - Under Database, click **Connect** > **Drivers**.
   - Copy the SRV connection URI.
   - Append the database name `/liveloom` before query parameters:

```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-name>.mongodb.net/liveloom?retryWrites=true&w=majority
```

---

## 2. Render Backend Web Service Setup

### Option A: Using Blueprint (`render.yaml`)
1. Log into [Render Dashboard](https://dashboard.render.com).
2. Click **New +** > **Blueprint**.
3. Connect your GitHub repository. Render will automatically detect the root [`render.yaml`](../render.yaml) blueprint.
4. Fill in the missing environment variables when prompted and click **Apply**.

---

### Option B: Manual Web Service Setup

1. **Create Web Service**:
   - Click **New +** > **Web Service**.
   - Connect your `LiveLoom` GitHub repository.

2. **Service Configuration**:
   - **Name**: `liveloom-backend`
   - **Language / Runtime**: `Docker`
   - **Build Context**: `./server` (or `./`)
   - **Dockerfile Path**: `./server/Dockerfile`
   - **Health Check Path**: `/readyz`
   - **Auto-Deploy**: `No` (recommended; trigger via deploy hook or manually)

3. **Environment Variables Table**:

In the Render Dashboard **Environment** section, add the following variables:

| Key | Required | Value / Format | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | Yes | `10000` | Render HTTP/WS port (server binds `0.0.0.0`) |
| `NODE_ENV` | Yes | `production` | Enables production mode & JSON logging |
| `MONGO_URI` | Yes | `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/liveloom?retryWrites=true&w=majority` | Atlas SRV connection string |
| `JWT_SECRET` | Yes | Generate via `openssl rand -hex 32` | Secret key for user auth tokens |
| `WS_TICKET_SECRET` | Yes | Generate via `openssl rand -hex 32` | Secret key for WebSocket tickets |
| `CLIENT_ORIGINS` | Yes | `https://liveloom.vercel.app,https://*.vercel.app` | Allowed CORS & WS origins |
| `TRUST_PROXY` | Yes | `true` | Trust Render TLS reverse proxy |
| `LOG_LEVEL` | No | `info` | Logger verbosity |
| `LOG_FORMAT` | No | `json` | Structured JSON log format |
| `REDIS_URL` | No | *Leave Unset* | Runs in single-instance mode |

#### How to Generate Secrets:
Run this command in your local terminal to generate random 256-bit hex keys for `JWT_SECRET` and `WS_TICKET_SECRET`:
```bash
openssl rand -hex 32
```

4. **Copy Public URL**:
   Once deployed, copy your Render service URL from the dashboard header:
   `https://liveloom-backend.onrender.com`

---

## 3. Vercel Frontend Setup

1. **Deploy Repository**:
   - Connect the repository to [Vercel](https://vercel.com).
   - Set **Framework Preset** to `Vite`.
   - Set **Root Directory** to `client`.

2. **Environment Variables**:
   In Vercel **Project Settings** > **Environment Variables**, add:

| Key | Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://liveloom-backend.onrender.com` | Render Backend HTTP Base URL |
| `VITE_WS_URL` | `wss://liveloom-backend.onrender.com` | Render Backend WebSocket Base URL |

---

## 4. Cold-Start Handling & Keepalive Behavior

- **Render Free Tier Cold Starts**: Render free Web Services spin down after 15 minutes of inactivity.
- **Client Waking Screen**: If the first `/readyz` or API call takes >3 seconds during a cold start, the client automatically displays a friendly screen:
  > **"Waking up the server, this can take up to a minute"**
  > *Progress bar indicator with exponential backoff retries.*
- **WebSocket Keepalive**: Server pings connected clients every 30s (`PING_INTERVAL_MS = 30_000`). Sockets failing to pong are terminated cleanly to prevent dead sockets and keep proxy idle timeouts active.

---

## 5. Local Testing & Verification

Run local operations with npm or Makefile:
- `npm run docker:build` (`make docker-build`): Build multi-stage Docker image (`node:22-alpine`).
- `npm run docker:up` (`make docker-up`): Start container stack locally.
- `npm run docker:down` (`make docker-down`): Stop containers (preserves database volumes).
- `npm run docker:reset` (`make docker-reset`): Tear down containers and remove volumes (`docker compose down -v`).
- `npm run smoke` (`make smoke`): Run local smoke test suite.

### Production Smoke Test Verification Script:
Test your live Render backend URL:
```bash
node scripts/prod_smoke.js https://liveloom-backend.onrender.com
```

---

## 6. Known Limitations

- **Awareness Multi-Node Scope**: `awareness (presence/cursors) does not cross server instances; production runs single-instance.`
