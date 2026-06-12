# Account Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real server account layer for registration, login, session lookup, and cloud save sync while keeping battle simulation client-side.

**Architecture:** Add a small Node HTTP API under `server/` with a storage interface, password hashing, token sessions, and save records. The frontend keeps the current local profile UI, but first attempts `/api/*`; if the API is unavailable in local development, it can still use local-only mode.

**Tech Stack:** Node built-in `http`, `crypto`, `fs`, `node:test`; browser `fetch`; current Vite/TypeScript frontend.

---

### Task 1: Backend Auth Contract

**Files:**
- Create: `server/auth-store.js`
- Create: `server/auth-service.js`
- Create: `server/auth-service.test.js`
- Modify: `package.json`

- [ ] Write tests for register, duplicate register, login, invalid password, token lookup, save write/read.
- [ ] Run `npm test` and confirm tests fail because the modules do not exist.
- [ ] Implement the minimal store and service to pass.
- [ ] Run `npm test` and confirm all backend contract tests pass.

### Task 2: HTTP API

**Files:**
- Create: `server/api-server.js`
- Create: `server/api-server.test.js`
- Modify: `package.json`

- [ ] Write HTTP tests for `/api/register`, `/api/login`, `/api/me`, `/api/save`.
- [ ] Run `npm test` and confirm API tests fail because the server does not exist.
- [ ] Implement JSON request parsing, cookies, API routes, and health response.
- [ ] Run `npm test` and confirm contract and API tests pass.

### Task 3: Frontend Account Client

**Files:**
- Modify: `src/main.ts`
- Modify: `src/style.css`

- [ ] Add a thin account API client in `src/main.ts`.
- [ ] Make login/register try the server first.
- [ ] Keep local guest mode and local fallback explicit.
- [ ] Sync save after login and during autosave.
- [ ] Run `npm run build`.

### Task 4: Deployment

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] Upload `server/` and production package metadata to `/var/www/game/douyin-mini-rpg-server`.
- [ ] Install or refresh production dependencies if needed.
- [ ] Run the Node API as a systemd service on port `4174`.
- [ ] Add Nginx `/api/` proxy to the existing `mcp.edcedc.cn` server blocks.
- [ ] Verify `/game/douyin-mini-rpg/` loads and `/api/health` returns JSON.
