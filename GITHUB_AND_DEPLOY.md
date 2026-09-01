# GitHub Repo & Railway Deployment

How the code is version-controlled and how it gets deployed.

## 1. Repository

- **URL:** **https://github.com/ch-yousafali/evidenceDashboard** (public, primary repo).
- **Branch:** `main`
- **Remote:** `origin` → `git@github.com:ch-yousafali/evidenceDashboard.git`
- The dashboard project lives at the **repo root** (Railway builds the root `Dockerfile`).

### What is committed vs ignored

| In git | Not in git (`.gitignore`) |
|---|---|
| `pages/home.md` (dashboard) | `.env` (DB password) |
| `connection.yaml` (placeholders only — `password: ${POSTGRES_PASSWORD}`) | `railway.env` (copy of deploy variables) |
| `Dockerfile`, `.dockerignore` | `.evidence/` (local cache) |
| `theme.yaml`, `evidence.config.yaml`, `access.yaml` | |
| `SETUP.md`, `GITHUB_AND_DEPLOY.md`, `README.md` | |

**Security rule:** no secret ever lands in git. The password only exists in
`.env` / `railway.env` locally and in Railway's sealed service variables.

### Commit style used

```bash
git add -A && git add -f connection.yaml   # force-add the placeholder-only config
git commit -m "..."
git push origin main
```

## 2. Docker image (custom login gateway)

The Dockerfile builds a single container with two processes:

1. **`evidence serve`** on `127.0.0.1:3001` with `EVIDENCE_AUTH_DISABLED=true`
   (the gateway below is the authentication boundary — the official
   "authenticating reverse proxy" pattern from docs.evidence.dev/self-host/authentication)
2. **`login-gateway/proxy.js`** (Node, zero dependencies) on Railway's `PORT`:
   - serves a styled **custom login page** at `/login`
   - validates `EVIDENCE_BASIC_USER` / `EVIDENCE_BASIC_PASSWORD`
     (constant-time comparison), issues an HMAC-signed session cookie
     (`LOGIN_SECRET` signs it, 12-hour expiry, HttpOnly + SameSite=Lax)
   - proxies all authenticated traffic to the Evidence server
   - `/logout` clears the session; tampered cookies are rejected

```docker
FROM node:20-slim
# … installs the pinned Evidence CLI binary, then:
CMD evidence serve --host 127.0.0.1 --port 3001 (auth disabled) & node login-gateway/proxy.js
```

Verified locally before pushing:

```bash
docker build -t evidence-login .
docker run -p 3300:3000 -e POSTGRES_PASSWORD=... -e EVIDENCE_BASIC_USER=admin \
  -e EVIDENCE_BASIC_PASSWORD=... -e LOGIN_SECRET=<random> evidence-login
# → GET /            302 → /login
# → GET /login       styled sign-in page
# → POST bad creds   401 (error shown on page)
# → POST good creds  302 → / + signed session cookie
# → GET / with cookie 200, dashboard renders live data
# → /logout          clears session; tampered cookie rejected
```

## 3. Railway setup (step by step)

1. **railway.app → New Project → Deploy from GitHub repo** → pick
   `ch-yousafali/evidenceDashboard`. Railway auto-detects the `Dockerfile`.
2. **Service → Variables → Raw Editor** → paste:

   ```env
   POSTGRES_PASSWORD=IMjShQevqnlRpqkTMDfstkiKnzpoHtAo
   EVIDENCE_BASIC_USER=admin
   EVIDENCE_BASIC_PASSWORD=<pick-a-strong-password>
   LOGIN_SECRET=<random string, e.g. openssl rand -hex 32>
   ```

   (Raw Editor accepts plain `KEY=value` dotenv lines; seal secrets with the 🔒 icon.)
3. **Service → Settings → Networking → Generate Domain** → public URL.
4. Every `git push` to `main` triggers an automatic redeploy to the **same URL**.

## 4. Current deploy state

- All dashboard code (including filters + filter fixes) is pushed to `main`.
- Railway redeploys automatically on push — the public link does not change.
- First-load shows the browser's HTTP Basic Auth prompt (this is the standard
  self-host auth; see "Login options" below).

## 5. Login (custom login page — shipped)

The Basic Auth popup is gone. The container now serves a **styled login page** at
`/login` (dark card UI matching the dashboard theme). Credentials are the
`EVIDENCE_BASIC_USER` / `EVIDENCE_BASIC_PASSWORD` variables; sessions are HMAC-signed
cookies valid for 12 hours; `/logout` signs out. Changing `EVIDENCE_BASIC_PASSWORD`
and redeploying invalidates all sessions.

If you later want real SSO (Google/GitHub sign-in buttons, per-user roles), swap the
gateway for **Cloudflare Access** or **oauth2-proxy** (same proxy pattern), or move to
**Evidence Studio** (hosted: login screens, user management, scheduled reports).

## 6. Useful operations

```bash
# Redeploy after changing the dashboard
git add pages/home.md && git commit -m "update dashboard" && git push origin main

# Check what's deployed
gh api repos/ch-yousafali/evidenceDashboard/commits --jq '.[0].sha, .[0].commit.message'

# Rotate the DB password: change it in Railway (Postgres service), then update
# the POSTGRES_PASSWORD variable on the dashboard service → auto-redeploys.
```
