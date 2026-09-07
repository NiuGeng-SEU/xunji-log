# Xunji Workout Dashboard

[English](README.md) | [简体中文](README.zh-CN.md)

A personal, self-hosted workout dashboard built from [Xunji (训记)](https://xunjiapp.cn/) Open API data. It turns daily strength and cardio records into an interactive overview, year-aware trends, personal-record comparisons, and drill-down workout history.

This repository is a substantially revised version of [imklayhu/xunji-log](https://github.com/imklayhu/xunji-log). Parts of the dashboard presentation were inspired by [yihong0618/running_page](https://github.com/yihong0618/running_page).

![Workout dashboard overview](https://github.com/user-attachments/assets/dc9d7a37-1ca5-4173-ba6c-50c7b9dd1786)

## Highlights

- **Overview:** training heatmap, monthly strength/cardio totals, body-area distribution, and top movements.
- **Strength:** goals, streaks, Max & PR cards, year-to-year PR comparison, training share, and monthly duration.
- **Cardio:** distance, calories, heart rate, yearly personal bests, race prediction, and an activity log.
- **Period-aware analysis:** choose a calendar year, all history, or the rolling past year where available.
- **Drill-down details:** open a day, month, body area, or movement to inspect the underlying records.
- **Automated publishing:** GitHub Actions can fetch new Xunji data, rebuild the analysis, and deploy GitHub Pages every day.
- **Local-first operation:** run directly with Python and Node.js or deploy with Docker Compose.

## How it works

```text
Xunji Open API
      │
      ▼
data/cache/YYYY/MM/YYYY-MM-DD.json
      │
      ▼
scripts/analyze.py ──► data/analysis.json + static drill-down files
      │
      ▼
React/Vite dashboard ──► local server or GitHub Pages
```

The browser does not trigger GitHub Actions. Online data refreshes are performed by the scheduled or manually dispatched workflow in `.github/workflows/sync.yml`.

## Requirements

- A Xunji Open API/LLM key, available from the Xunji app (normally beginning with `xjllm_`)
- Docker and Docker Compose, or Python 3.10+ and Node.js 20+

Never commit your API key. Training records are personal health data; read the [Privacy](#privacy) section before publishing the repository.

## Quick start with Docker

```bash
git clone https://github.com/NiuGeng-SEU/xunji-log.git
cd xunji-log
cp .env.example .env
```

Set `XUNJI_API_KEY` in `.env`, then run:

```bash
docker compose up -d --build
```

Open <http://127.0.0.1:8080>. Docker can perform scheduled incremental syncs when `SYNC_ENABLED=true`.

## Local setup

```bash
git clone https://github.com/NiuGeng-SEU/xunji-log.git
cd xunji-log

python3 -m venv .venv
.venv/bin/pip install -r server/requirements.txt

cd web
npm ci
npm run build
cd ..

export XUNJI_API_KEY=xjllm_your_key
.venv/bin/python scripts/fetch_training.py --incremental --refresh-days 3
.venv/bin/python scripts/analyze.py
./scripts/local-ops.sh start
```

Open <http://127.0.0.1:8080>. Useful commands:

```bash
./scripts/local-ops.sh status
./scripts/local-ops.sh refresh
./scripts/local-ops.sh restart
./scripts/local-ops.sh stop
./scripts/local-ops.sh logs
```

For frontend development, run `npm run dev` inside `web/`; Vite serves the development site at <http://127.0.0.1:5173> by default.

## GitHub Actions and Pages

1. Fork or clone this repository to your GitHub account.
2. Add `XUNJI_API_KEY` under **Settings → Secrets and variables → Actions**.
3. Configure GitHub Pages to use **GitHub Actions** as its source.
4. Run **Daily Sync Xunji Data & Deploy** manually once, or wait for the schedule.

The workflow:

- refreshes the most recent three days from Xunji;
- stores daily cache files under `data/cache/YYYY/MM/`;
- regenerates aggregated and drill-down data;
- commits changed data; and
- builds and deploys the dashboard.

The included schedule runs at 22:30 UTC (06:30 Beijing time). Change the cron expression in `.github/workflows/sync.yml` if a different time is required.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `XUNJI_API_KEY` | — | Required Xunji Open API key |
| `DASHBOARD_HOST` | `127.0.0.1` | Local server bind address |
| `DASHBOARD_PORT` | `8080` | Dashboard port |
| `SYNC_ENABLED` | `true` | Enable Docker/server scheduled sync |
| `SYNC_CRON` | `30 6 * * *` | Local scheduled-sync time |
| `SYNC_REFRESH_DAYS` | `3` | Number of recent days to refetch |
| `TZ` | `America/New_York` | Runtime timezone |

## Project layout

```text
.github/workflows/   Daily data sync and Pages deployment
data/cache/          Raw daily Xunji responses, organized by year/month
scripts/             Fetching, analysis, export, and operations scripts
server/              FastAPI application and local sync endpoints
web/src/pages/       Overview, Strength, and Cardio pages
web/public/data/     Static analysis and drill-down data for Pages
```

## Quality checks

```bash
.venv/bin/python -m unittest discover -s tests -v
cd web
npm run typecheck
npm run build
```

Chart values are displayed with at most one digit after the decimal point. Source data retain their analysis precision.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service health and data status |
| `GET` | `/api/analysis` | Aggregated dashboard data |
| `GET` | `/api/day/{date}` | Daily workout details |
| `GET` | `/api/drill?type=&key=` | Month/category/movement/day drill-down |
| `GET` | `/api/sync/status` | Local scheduled-sync status |
| `POST` | `/api/sync` | Run a local incremental sync |
| `POST` | `/api/refresh` | Rebuild analysis from existing cache |

## Privacy

This repository can contain raw and aggregated personal workout data in `data/` and `web/public/data/`. If the repository or GitHub Pages site is public, those records are public too. Use a private repository or local-only deployment if the data should remain private. The dashboard has no built-in authentication; do not expose the local server directly to the internet without an access-control layer.

If an API key is exposed, rotate it in Xunji immediately.

## Credits

- Data source: [Xunji (训记) Open API](https://xunjiapp.cn/)
- Upstream project: [xunji-log by imklayhu](https://github.com/imklayhu/xunji-log)
- Design inspiration: [running_page by yihong0618](https://github.com/yihong0618/running_page)
- Development assistance: Gemini 3.8 Flash and ChatGPT 5.6 Sol (medium reasoning)

Xunji, its API, and its trademarks belong to their respective owners. This project is not an official Xunji product.

## License

[MIT](LICENSE)
