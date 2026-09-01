# Setup Guide — Evidence Dashboard

Everything about this repo: what Evidence is, how the CLI was installed, how the
project is structured, how to run it locally, and how it deploys. Written from the
official docs at [docs.evidence.studio](https://docs.evidence.studio) /
[docs.evidence.dev](https://docs.evidence.dev).

## 1. What is Evidence?

Evidence is a framework for building data products from **SQL + Markdown**. It has two parts:

| | What it is | Auth | Cost |
|---|---|---|---|
| **Evidence Core** (this repo) | MIT-licensed open-source framework: Markdown pages with embedded SQL, rendered as interactive reports. Self-host anywhere (Docker/Railway/Vercel). No account needed. | HTTP Basic Auth | Free (you pay infra) |
| **Evidence Studio** (hosted) | Platform built on Core: web editor, proper login/SSO, user roles, access controls, scheduled reports, AI agent, preview deployments | Real login screens + SSO | Managed service |

This project currently runs **self-hosted on Railway** (Core). See §8 for the Studio path.

```
Browser ──> Evidence CLI `serve` (Docker on Railway) ──> Postgres (Railway)
                 │
                 └── pages/home.md  (SQL blocks + Markdoc components)
```

## 2. Download & install the Evidence CLI

### Option A — official installer (recommended)

macOS / Linux:

```bash
curl -fsSL https://evidence.studio/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://evidence.studio/install.ps1 | iex
```

- Installs `evidence` (and alias `evd`) to `/usr/local/bin` (falls back to `~/.local/bin`)
- Verify: `evidence version`
- Upgrade later: `evidence upgrade` (the CLI also warns on startup when outdated)

### Option B — build from source (what was done on this machine)

Because the [evidence-dev/evidence](https://github.com/evidence-dev/evidence) monorepo
was cloned into `evidence/` (dev-only, gitignored), the CLI was compiled from it:

```bash
# requires Node 22.22+ (nvm install 22), pnpm 9.x, bun
corepack enable && corepack prepare pnpm@9.15.0 --activate
cd evidence
pnpm install          # ~6 min (downloads a bundled ClickHouse engine)
pnpm cli:build        # → evidence/cli/dist/evidence (self-contained ~95 MB binary)
./cli/dist/evidence version
```

Both paths give the same CLI. Option A is simpler; Option B is only for hacking on
Evidence itself.

## 3. Project layout

```
.                          ← repo root = the deployable Evidence project
├── pages/home.md          # the dashboard: SQL blocks + Markdoc components
├── connection.yaml        # DB credentials (${VAR} placeholders — no secrets)
├── evidence.config.yaml   # project name + pages dir
├── theme.yaml             # colors / fonts
├── access.yaml            # page-level access rules (used on Evidence Studio)
├── Dockerfile             # official evidencedev/serve image (Railway deploys this)
├── .env                   # LOCAL ONLY: POSTGRES_PASSWORD=...  (gitignored)
├── railway.env            # copy of the Railway service variables   (gitignored)
├── SETUP.md               # this file
├── GITHUB_AND_DEPLOY.md   # repo + Railway deployment guide
└── archive/               # old test artifacts + previous git history
```

## 4. Connect the database

`connection.yaml` (committed — contains **no secrets**, password comes from env):

```yaml
type: postgres
host: tokaido.proxy.rlwy.net
port: 32353
database: railway
user: postgres
password: ${POSTGRES_PASSWORD}
schema: public
sslmode: require        # Railway proxy cert isn't publicly trusted; verify-full fails
```

Create `.env` locally (never committed):

```bash
echo 'POSTGRES_PASSWORD=your-password' > .env
```

Self-hosted projects **must** use a direct connector like this (`connection.yaml`) —
the managed Evidence Warehouse is Studio-only.

## 5. Run locally

```bash
# load the password into the environment, then start the dev server
export $(grep -v '^#' .env | xargs)
evidence dev                 # → http://localhost:3000 (hot reload)
```

CLI commands (run `evidence help` for all):

| Command | What it does |
|---|---|
| `evidence dev` | Local dev server, live reload |
| `evidence validate` | Validate markdown/SQL in `pages/` |
| `evidence tables` | List tables in the connected DB |
| `evidence describe <table>` | Show a table's columns/types |
| `evidence query "SELECT ..."` | Run one-off SQL (`--file x.sql`, `--output out.json`) |
| `evidence schema` | All tables + column counts |
| `evidence connectors` | Connection health |
| `evidence lineage` | Where tables/columns are used in pages |

## 6. How the dashboard works

Every chart is fed by a **named SQL block** in the markdown:

````markdown
```sql daily_sales
select date::date as date, sum(total) as sales
from sales_daily
where date::date {{date_filter.between}}   -- filter injection
group by 1
```

{% line_chart data="daily_sales" x="date" y="sum(sales)" /%}
````

Components in use: `{% big_value %}` (KPI cards), `{% line_chart %}`, `{% bar_chart %}`,
`{% pie_chart %}` (donut), `{% table %}`, `{% dropdown %}`, `{% date_grain_selector %}`,
`{% range_calendar %}`.

### Filters — the TEXT-date gotcha (read before editing)

The `date` columns in this database are **TEXT**, not DATE. The calendar filter emits
`DATE '2026-08-01'` literals, so a bare comparison fails with
`operator does not exist: text >= date`. Always cast in the WHERE clause:

```sql
where date::date {{date_filter.between}}
```

| Template | Resolves to |
|---|---|
| `{{date_filter.between}}` | `BETWEEN DATE '...' AND DATE '...'` when a range is picked; `IS NOT NULL` on "All Time" (never breaks the query) |
| `{{time_grain}}` | `'day'` / `'week'` / `'month'` — use inside `date_trunc({{time_grain}}, date::date)` |
| `{{customer_filter.filter}}` | `customer = '...'`, or `true` when nothing selected |
| `{{product_filter.filter}}` | `product = '...'`, or `true` when nothing selected |

Note: date presets ("Previous Month", ...) are anchored to the **data's max date**, not
the wall clock. Data currently spans Aug 23–29 2026, so "Previous Month" (July) is
legitimately empty.

## 7. Data model (tables used)

| Table | Used for |
|---|---|
| `sales_daily` | KPIs, daily/weekly/monthly revenue + AOV trends |
| `sales_records` | Recent orders, top customers, order counts |
| `pre_orders` | Pipeline table, product bar chart, status donut |
| `tracking` | Shipment table, carrier donut |
| `cost_profit` | Cost vs revenue, cost breakdown donut, monthly profit line (JSONB) |
| `members` + `profiles` + `workspaces` | Team directory |

JSONB columns are unnested in SQL:

```sql
select b->>'label' as category, (b->>'value')::int as value
from cost_profit, jsonb_array_elements(breakdown) b
```

## 8. Deployment

### Path A — self-host on Railway (current setup)

Per [docs.evidence.dev/self-host/railway](https://docs.evidence.dev/self-host/railway).
The whole Dockerfile is:

```docker
FROM evidencedev/serve:latest
COPY --chown=evidence:evidence . /project
```

`evidence serve` is the hardened production server. Required environment variables:

| Env Var | Purpose | Required? |
|---|---|---|
| `EVIDENCE_BASIC_USER` | HTTP Basic Auth username | Yes* |
| `EVIDENCE_BASIC_PASSWORD` | HTTP Basic Auth password | Yes* |
| `${VAR}` references (here `POSTGRES_PASSWORD`) | All variables used in `connection.yaml` | Yes |
| `EVIDENCE_AUTH_DISABLED` | Skip auth — only for trusted private networks (VPN/Tailscale) | — |
| `PORT` | Server port (Railway injects it; default 3000) | — |

Steps: push to GitHub → Railway **New Project → Deploy from GitHub repo** → paste the
variables (Raw Editor accepts dotenv format) → **Settings → Networking → Generate
Domain**. Every push to `main` redeploys to the same URL. Full details in
[GITHUB_AND_DEPLOY.md](./GITHUB_AND_DEPLOY.md).

**Auth note:** this repo ships a **custom login gateway** (`login-gateway/proxy.js`) —
a styled sign-in page with an HMAC-signed session cookie, running in the same container
as `evidence serve` (auth disabled, localhost-only). This implements the official
"authenticating reverse proxy" pattern. `EVIDENCE_BASIC_USER` / `EVIDENCE_BASIC_PASSWORD`
are the login credentials; `LOGIN_SECRET` (any random string) signs the session cookie.
`/logout` clears the session. For org SSO (Google/GitHub/Okta), swap the gateway for
Cloudflare Access or oauth2-proxy, or use Studio (Path B).

### Path B — Evidence Studio (proper login, SSO, roles)

1. Sign up at [evidence.studio](https://evidence.studio) (or
   [login.evidence.studio/sign-up](https://login.evidence.studio/sign-up))
2. `evidence login` — authenticate the CLI (browser verification code step)
3. `evidence launch` — connect this project to a Studio project + GitHub repo
4. Publish — three ways, all kept in sync:
   - **Publish button** in the Studio editor
   - **`git push`** to the published branch from local dev
   - **Merge a PR** on GitHub (Studio posts validation checks + a preview link on every PR)
5. Roles (Team Settings): Viewer / Org Viewer / Developer / Admin; per-page access via
   `access.yaml`

Studio adds what self-host lacks: SSO with roles, page-level access control,
row-level security, scheduled reports, embedded analytics, the AI agent, publish
history with rollback, and the Evidence Warehouse (managed DB you can sync sources into).

Failed publishes never affect viewers — the last successful version stays live.

## 9. Telemetry

The CLI reports anonymous usage. Opt out with `EVIDENCE_TELEMETRY_DISABLED=1` or
`DO_NOT_TRACK=1`.
