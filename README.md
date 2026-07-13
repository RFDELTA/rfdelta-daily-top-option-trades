# RFDELTA Daily Top Option Trades

Production-oriented generator and public report site for the RFDELTA Top Option Trades page. One weekday workflow discovers current U.S. option chains, constructs defined-risk vertical spreads, applies deterministic liquidity and risk gates, simulates each candidate, ranks a diversified basket, writes an immutable report archive, generates SVG graphics and publishes the committed result through Vercel. Six standalone iframe blocks are provided for the GoDaddy page at `https://rfdelta.com/delta-%7C-top-option-trades`.

The repository never submits orders. It does not contain account identifiers, balances, buying power, brokerage controls or public fallback mocks.

## Publication Flow

1. GitHub Actions starts at 14:45 UTC on weekdays, after the U.S. regular session is open in both standard and daylight time.
2. The workflow resolves the current date in `America/New_York`.
3. The authenticated RFDELTA market-data adapter discovers the deterministic source universe, fetches bulk underlying quotes and retrieves normalized multi-expiration option chains.
4. Same-session freshness, bid/ask, open interest, volume/depth and relative spread-width gates run before modeling.
5. Bullish symbols produce call-debit and put-credit candidates. Bearish symbols produce put-debit and call-credit candidates.
6. Each candidate runs through deterministic jump-stress Monte Carlo and common scoring weights.
7. The basket optimizer enforces one idea per symbol, correlation-bucket limits, one-lot and total-risk limits, and minimum debit/credit representation.
8. The generator evaluates expired ideas from the prior edition and integrates resolved outcomes into strategy-style posteriors.
9. JSON, Markdown, CSV, two SVG charts and a rolling 90-session price-history file are committed to Git.
10. Vercel deploys the commit. The GoDaddy iframes always render `/embed/...` from the latest valid committed edition.

If current-session data are not available, generation exits with code `75`. The workflow records a clean market-session skip and leaves the previous valid report published. It never copies yesterday's quotes into today's date.

## Market Data Contract

The primary production adapter uses `https://tt-bridge.rfdelta.com` for three read-only market-data operations: deterministic equity-universe discovery, bulk equity quotes and normalized equity option chains. An allowlist in the adapter rejects account, transaction and order routes before any request is sent. The bridge key is required only in the generation runtime and is never needed by Vercel or the public browser.

RFDELTA must maintain any exchange, vendor and derived-publication rights required for the public product. Authentication to the bridge is not itself a grant of redistribution rights.

Tradier remains available as an explicitly selected alternate provider. Its separate publication-rights acknowledgement still fails closed when that adapter is selected.

## Local Setup

Prerequisites:

- Node.js 22
- npm 10 or later
- An RFDELTA market-data key for live generation

Install and create local configuration:

```powershell
npm install
Copy-Item .env.example .env.local
```

Set at minimum:

```dotenv
MARKET_DATA_PROVIDER="tt_bridge"
TT_BRIDGE_API_KEY="your-protected-key"
TT_BRIDGE_BASE_URL="https://tt-bridge.rfdelta.com"
```

Start the site:

```powershell
npm run dev
```

Open `http://localhost:3000/latest`.

## Commands

Generate the current New York market date from live data:

```powershell
npm run generate:daily -- today
```

Verify universe, quote and option-chain access without writing a report:

```powershell
npm run smoke:bridge -- 2026-07-13 "SPY,QQQ"
```

Generate a specific market date:

```powershell
npm run generate:daily -- 2026-07-13
```

Replace an existing report for the same date after deliberately re-fetching the market:

```powershell
npm run generate:daily -- 2026-07-13 force
```

Generate the clearly labeled historical calibration edition without network credentials:

```powershell
npm run generate:fixture
```

Verify archive completeness and reject internal-facing public copy:

```powershell
npm run verify:reports -- 2026-06-19
```

Run all deterministic tests and production checks:

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

## Report Outputs

For market date `YYYY-MM-DD`:

```text
data/reports/YYYY-MM-DD/report.json
data/reports/YYYY-MM-DD/report.md
data/reports/YYYY-MM-DD/ideas.csv
public/charts/YYYY-MM-DD/ranked_scores.svg
public/charts/YYYY-MM-DD/risk_reward.svg
data/market-history/daily-bars.json
```

`data/reports/index.json` identifies the latest valid report and retains archive metadata. The archive is committed data, so a Vercel build never depends on writing to an ephemeral server filesystem.

## GitHub Configuration

Create a GitHub repository and push `main`. Add these Actions secrets:

| Name | Type | Purpose |
|---|---|---|
| `TT_BRIDGE_API_KEY` | Secret | Production read-only market-data authentication |
| `VERCEL_DEPLOY_HOOK_URL` | Secret, optional | Explicit deploy hook when Git integration is not sufficient |

Add these Actions variables:

| Name | Value |
|---|---|
| `TT_BRIDGE_BASE_URL` | `https://tt-bridge.rfdelta.com` |
| `PRODUCTION_URL` | The final Vercel or custom-domain origin |

The workflow uses `RFDELTA LLC <rfdeltax@gmail.com>` for report commits so Vercel Git attribution remains consistent.

Manual production test:

1. Open **Actions > Daily Top Option Trades > Run workflow**.
2. Leave `report_date` empty for today's New York date, or enter an explicit market date.
3. Enable `force` only when replacing that date's edition is intentional.
4. Confirm the generation, archive verification, commit, deploy and production-date checks all pass.

## Vercel Configuration

1. Import the GitHub repository as a Next.js project.
2. Do not configure a Vercel cron. GitHub Actions is the only scheduler.
3. Add no market-data token to Vercel unless a future server-side runtime route truly needs it. The current Vercel site reads committed reports only.
4. Set `NEXT_PUBLIC_SITE_URL` to the production origin if a custom domain is used.
5. Keep Git deployment enabled, or create a deploy hook and save it as the GitHub secret above.

Expected public routes:

- `/latest`
- `/archive`
- `/reports/YYYY-MM-DD`
- `/api/latest`
- `/embed/overview`
- `/embed/score-chart`
- `/embed/risk-reward`
- `/embed/trades-1-2`
- `/embed/trades-3-5`
- `/embed/accountability`

## GoDaddy Installation

Use [docs/godaddy-top-option-trades-blocks.html](docs/godaddy-top-option-trades-blocks.html). Each numbered snippet is standalone and belongs in its own contiguous GoDaddy HTML section. Leave **Center align** off and **Forced Height** blank. The fallback height is used only until the iframe sends its measured height.

Separate blocks remove nested page scrollbars and allow GoDaddy or Google ad sections between report areas. The contained snippets fill 100% of the width GoDaddy grants to the HTML section. CSS inside an iframe cannot override a narrower parent column. If the page theme enforces a fixed column, use the full-width wrapper described in [docs/godaddy-embed-guide.md](docs/godaddy-embed-guide.md), then verify that it does not overlap the site's persistent left navigation.

## Security and Integrity

- Credentials stay in `.env.local` or GitHub Actions secrets.
- Authorization headers and raw provider payloads are never written to reports.
- The production adapter contains an explicit allowlist for discovery, equity-quote and normalized equity-chain routes only.
- Public report validation rejects bridge, account, mock, order and runtime-failure language.
- Public output contains derived two-leg quotes and model analytics, not access credentials.
- Production generation requires current-session quotes for at least half the configured universe.
- Retained daily bars are derived from public market fields, capped at 90 sessions per symbol and committed with each valid edition.
- Every report carries a SHA-256 selection hash over the timestamped snapshot, discovered candidates and model settings.
- Candidate and final-rank tie breaks are stable and lexical.

Detailed scoring and construction rules are in [docs/methodology.md](docs/methodology.md). Production wiring is in [docs/production-checklist.md](docs/production-checklist.md).
