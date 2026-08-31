# Evidence Dashboard

Interactive data dashboard built with [Evidence](https://evidence.dev) — Markdown + SQL, served by the Evidence CLI in Docker.

## Local development

```bash
export POSTGRES_PASSWORD=<your-password>   # or put it in .env (gitignored)
evidence dev                               # http://localhost:3000
```

## Deploy on Railway

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo** → select this repo (Dockerfile is auto-detected).
3. Set these **service variables** in Railway:

| Variable | Value |
|---|---|
| `POSTGRES_PASSWORD` | your Postgres password |
| `EVIDENCE_BASIC_USER` | any username for the dashboard login |
| `EVIDENCE_BASIC_PASSWORD` | any password for the dashboard login |

Railway injects `PORT` automatically. The container runs `evidence serve` (production mode) against the Postgres connection in `connection.yaml`.

> `connection.yaml` contains no secrets — the password is resolved from the `POSTGRES_PASSWORD` environment variable at runtime.

## Data source

Postgres (Railway): `tokaido.proxy.rlwy.net:32353`, database `railway`, schema `public`.

Tables used: `sales_daily`, `sales_records`, `pre_orders`, `tracking`, `cost_profit`.
