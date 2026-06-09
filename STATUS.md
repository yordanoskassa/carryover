# ElastiPath — Session Status Log

## Project Overview
Multi-agent system protecting migrants from fraudulent visa agencies.
**Hackathon**: Google Cloud Rapid Agent Hackathon (Elastic Track, deadline June 11, 2026)

## Tech Stack
- **Backend**: FastAPI (Python 3.13) — port **8001** (8000 is occupied by Docker)
- **Frontend**: React + Vite + Tailwind + Recharts — port **5173**
- **Data**: Elasticsearch 9.5.0 Serverless on GCP
- **Crawler**: Elastic Open Crawler v1.0.0 (Docker)

## Elastic Cloud Credentials
- **ES URL**: `https://my-observability-project-acf12a.es.us-central1.gcp.elastic.cloud`
- **Kibana**: `https://my-observability-project-acf12a.kb.us-central1.gcp.elastic.cloud`
- **API Key**: stored in `.env`

## Current Data in Elasticsearch

### Indices
| Index | Docs | Description |
|-------|------|-------------|
| `crawled-visa-pages` | 397 | Real government pages from Elastic Open Crawler |
| `visa-policies` | 249 | Structured policies (22 seed + 227 crawl-derived) |
| `known-scams` | ~10 | Labeled scam patterns for Inspector |
| `agency-posts` | ~5 | Sample agency social media posts |
| `policy-history` | ~4 | Policy change snapshots |
| `crawled-visa-pages-v2` | 284 | ELSER-embedded version (reindex was async) |

### Crawled Government Sites
| Source | Host | Pages |
|--------|------|-------|
| UK Home Office | www.gov.uk | 113 |
| US State Dept | travel.state.gov | 102 |
| Canada IRCC | www.canada.ca | 96 |
| Turkey MFA | www.mfa.gov.tr | 53 |
| UAE ICP | icp.gov.ae | 25 |
| Germany Foreign Office | www.auswaertiges-amt.de | 7 |
| Turkey e-Visa | www.evisa.gov.tr | 1 |

### Structured Visa Policies by Destination
| Destination | Docs |
|-------------|------|
| GB (UK) | 122 |
| CA (Canada) | 82 |
| US (USA) | 31 |
| DE (Germany) | 7 |
| TR (Turkey) | 4 |
| AE (UAE) | 3 |

## Backend Endpoints (port 8001)
| Method | Path | Status |
|--------|------|--------|
| POST | `/api/advisor/requirements` | Working — 3-source search (ES|QL + ELSER + crawled pages) |
| POST | `/api/advisor/ask` | Needs Agent Builder setup |
| POST | `/api/inspector/evaluate` | Working — 3 checks (semantic match, policy contradiction, identity reuse) |
| POST | `/api/inspector/evaluate-agent` | Needs Agent Builder setup |
| POST | `/api/inspector/report` | Working — memory write-back to known-scams |
| GET | `/api/dashboard/stats` | Working — ES|QL aggregations |
| POST | `/api/ingest/bulk` | Working |
| POST | `/api/ingest/setup` | Working — one-click index creation |

## Frontend Components
- **Advisor**: Country selectors (10 origins, 8 destinations), purpose dropdown (student/work/family/tourist), requirements cards with fees/days/sources
- **Inspector**: Post text input, agency name, corridor selector, RiskGauge SVG, EvidenceCards, "Report this scam" button
- **Dashboard**: StatCards, BarChart (corridors), AreaChart (trends), flagged agencies table, shared phones table, policy changes feed

## How to Start

```bash
# Backend
cd backend
source ../.venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Frontend
cd frontend
npm run dev

# Crawl (requires Docker)
docker run --rm \
  -e ES_HOST="https://my-observability-project-acf12a.es.us-central1.gcp.elastic.cloud" \
  -e ES_API_KEY="<from .env>" \
  -v "$(pwd)/crawler/gov-uk.yml:/home/app/config/crawler.yml" \
  --entrypoint "" \
  docker.elastic.co/integrations/crawler:1.0.0 \
  bin/crawler crawl /home/app/config/crawler.yml

# Process crawled pages into structured policies
python scripts/process_crawled_pages.py

# Re-seed structured policies (overwrites seed data)
python scripts/seed_policies.py
```

## Key Files Modified This Session
- `backend/app/config.py` — Fixed .env path (relative → absolute via Path)
- `backend/app/services/elastic.py` — Added :443 port for Elastic Cloud URLs
- `backend/app/routers/advisor.py` — Added purpose filter, 3-source search (ES|QL + ELSER + crawled pages), nationality=="ALL" support
- `frontend/vite.config.ts` — Proxy changed to port 8001
- `scripts/seed_policies.py` — 22 detailed visa policies across 6 corridors
- `scripts/process_crawled_pages.py` — Processes crawled pages → structured visa-policies
- `crawler/*.yml` — 5 Elastic Open Crawler configs with purge disabled

## Known Issues / TODO
- [ ] **France, Netherlands, Australia, South Africa** — crawlers got 0 classified pages (sites may need JS rendering or different URL patterns)
- [ ] **Git remote** — no remote configured yet, commits are local only
- [ ] **Agent Builder** — tools and agents defined in code but not registered with Kibana (needs API setup)
- [ ] **CFPB fraud data** — `scripts/ingest_cfpb.py` exists but hasn't been run with real CSV data
- [ ] **ELSER on crawled pages** — async reindex to `crawled-visa-pages-v2` was started (task `qq9N7DTjTrWnVk7H2lHdcg:111978`), check if complete
- [ ] **More scam data** — known-scams index only has ~10 docs, needs real fraud complaint data
- [ ] **Gemini integration** — GOOGLE_PROJECT_ID and GEMINI_API_KEY not set in .env
- [ ] **Demo video** — Remotion prompt was provided but video not created
- [ ] **Port conflict** — port 8000 occupied by Docker container `backend-backend` (DRESSR API)

## Venv
- Python 3.13 (3.14 breaks pydantic-core)
- Location: `.venv/`
- Key deps: fastapi, elasticsearch, pydantic, httpx, google-genai
