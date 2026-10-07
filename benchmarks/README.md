# LiveLoom Benchmark & Load-Test Suite

This directory contains the automated performance, concurrency, sync latency, and load testing suite for LiveLoom.

## Test Suite Components

| Script | Test Description | Key Metrics Measured |
| :--- | :--- | :--- |
| `test_a_sync_latency.js` | Core Sync Latency | P50/P95/P99 latency across 2, 10, 25, 50 typing clients |
| `test_b_concurrency_scale.js` | Concurrency & Scale | Max stable WS conns (100, 500, 1000), Memory RSS, Event Loop Lag |
| `test_c_convergence.js` | CRDT Convergence Correctness | 5,000 concurrent inserts/deletes across 10 clients (Byte-identical verification) |
| `test_d_offline_reconnect.js` | Offline & Reconnect | Offline edits sync time and edit loss prevention |
| `test_e_late_join.js` | Late-Join Initial Sync | Time to SYNCED for 10KB–5MB docs and 1–100 files |
| `test_f_cross_instance.js` | Cross-Instance Sync (Redis) | Multi-node WS synchronization latency & awareness check |
| `test_g_persistence_recovery.js` | Persistence & Crash Recovery | MongoDB snapshot write volume, crash recovery window & Y.Doc GC size |
| `test_h_memory_lifecycle.js` | Memory Leak & Eviction | Memory usage per active/idle room and 50-room eviction lifecycle |
| `test_i_awareness_traffic.js` | Awareness Presence Traffic | Bytes/sec & msgs/sec comparison (unthrottled vs 50ms throttled) |
| `test_j_rest_api.js` | REST API Load (`autocannon`) | Req/s and P50/P95/P99 latency for login, rooms, and ticket APIs |
| `test_k_security_load.js` | Security & Rate Limiting | Viewer edit rejection & oversized message protection (>1MB) |
| `test_l_frontend.js` | Frontend Bundle & Load | Code splitting, bundle chunk sizes & Fast 4G load simulation |

## How to Run

### Prerequisite Services
Ensure MongoDB and Redis are running locally on standard ports:
- MongoDB: `mongodb://localhost:27017`
- Redis: `redis://localhost:6379`
- Server: `npm run dev` in `/server` (listening on port 4000)

### 1. Run Individual Benchmark Tests
```bash
cd server
node ../benchmarks/test_a_sync_latency.js
node ../benchmarks/test_b_concurrency_scale.js
node ../benchmarks/test_c_convergence.js
node ../benchmarks/test_d_offline_reconnect.js
node ../benchmarks/test_e_late_join.js
node ../benchmarks/test_f_cross_instance.js
node ../benchmarks/test_g_persistence_recovery.js
node ../benchmarks/test_h_memory_lifecycle.js
node ../benchmarks/test_i_awareness_traffic.js
node ../benchmarks/test_j_rest_api.js
node ../benchmarks/test_k_security_load.js
node ../benchmarks/test_l_frontend.js
```

### 2. Run the Full Suite (3 Runs with Warmup, Medians & Spread)
```bash
# Baseline Benchmark Run
npm run benchmark:baseline

# Post-Optimization Benchmark Run
npm run benchmark:after
```
Results will be saved as `baseline_results.json` and `after_results.json` in `/benchmarks/`.
