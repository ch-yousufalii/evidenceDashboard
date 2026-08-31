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

## 2. Docker image (official pattern)

Per https://docs.evidence.dev/self-host/railway — the entire Dockerfile is:

```docker
FROM evidencedev/serve:latest
COPY --chown=evidence:evidence . /project
```

`evidencedev/serve` is Evidence's official production image:

- Runs `evidence serve` (hardened mode: no dev reload, no dev machinery)
- Binds to Railway's injected `PORT` automatically
- Enforces HTTP Basic Auth via `EVIDENCE_BASIC_USER` / `EVIDENCE_BASIC_PASSWORD`
  (refuses to bind publicly without them)

Verified locally before pushing:

```bash
docker build -t evidence-official .
docker run -p 3200:3000 \
  -e POSTGRES_PASSWORD=... \
  -e EVIDENCE_BASIC_USER=admin -e EVIDENCE_BASIC_PASSWORD=... \
  evidence-official
# → 401 without credentials, 200 with, dashboard renders live data
```

## 3. Railway setup (step by step)

1. **railway.app → New Project → Deploy from GitHub repo** → pick
   `ch-yousafali/evidenceDashboard`. Railway auto-detects the `Dockerfile`.
2. **Service → Variables → Raw Editor** → paste:

   ```env
   POSTGRES_PASSWORD=IMjShQevqnlRpqkTMDfstkiKnzpoHtAo
   EVIDENCE_BASIC_USER=admin
   EVIDENCE_BASIC_PASSWORD=<pick-a-strong-password>
   ```

   (Raw Editor accepts plain `KEY=value` dotenv lines; seal secrets with the 🔒 icon.)
3. **Service → Settings → Networking → Generate Domain** → public URL.
4. Every `git push` to `main` triggers an automatic redeploy to the **same URL**.

## 4. Current deploy state

- All dashboard code (including filters + filter fixes) is pushed to `main`.
- Railway redeploys automatically on push — the public link does not change.
- First-load shows the browser's HTTP Basic Auth prompt (this is the standard
  self-host auth; see "Login options" below).

## 5. Login options (why the login looks the way it does)

The ugly popup is the browser's **native HTTP Basic Auth** dialog — that is the only
auth mechanism `evidence serve` (self-hosted) provides. Options:

| Option | Look | Effort |
|---|---|---|
| **Basic Auth (current)** | Native browser popup | Zero — already on |
| **Evidence Studio** (hosted) | Proper login page, Google SSO, per-user access rules, page-level permissions | Sign up at evidence.studio, `evidence launch` to connect the repo; deploys via git push |
| **Cloudflare Access / reverse-proxy SSO** in front of the Railway URL | Branded SSO page (Google/GitHub login) | Put Cloudflare in front of the domain, enable Zero Trust access |
| `EVIDENCE_AUTH_DISABLED=true` | No login at all | **Not recommended** — dashboard would be public |

Recommendation: keep Basic Auth for internal use; move to **Evidence Studio** if you
want real login screens, user management, and scheduled reports without managing
infrastructure.

## 6. Useful operations

```bash
# Redeploy after changing the dashboard
git add pages/home.md && git commit -m "update dashboard" && git push origin main

# Check what's deployed
gh api repos/ch-yousafali/evidenceDashboard/commits --jq '.[0].sha, .[0].commit.message'

# Rotate the DB password: change it in Railway (Postgres service), then update
# the POSTGRES_PASSWORD variable on the dashboard service → auto-redeploys.
```
