# RFDELTA Daily Top Option Trades

Production-oriented generator and public report site for the RFDELTA Top Option Trades page. One weekday workflow discovers current U.S. option chains, constructs defined-risk vertical spreads, applies deterministic liquidity and risk gates, simulates each candidate, ranks a diversified basket, writes an immutable report archive, generates SVG graphics and publishes the committed result through Vercel. Six standalone iframe blocks are provided for the GoDaddy page at `https://rfdelta.com/delta-%7C-top-option-trades`.

The repository never submits orders. It does not contain account identifiers, balances, buying power, brokerage controls or public fallback mocks.

## Publication Flow

1. GitHub Actions starts at 14:45 UTC on weekdays, after the U.S. regular session is open in both standard and daylight time.
2. The workflow resolves the current date in `America/New_York`.
3. The authenticated RFDELTA market-data adapter discovers the deterministic source universe and retrieves underlying quotes in bounded batches.
4. A configurable chain budget is allocated to core market anchors, the largest percentage movers, the highest-volume remaining names and a date-seeded rotation sleeve. The exact selected set is retained with the run.
5. Same-session freshness runs before any model input is retained.
6. Finalized public daily price and volume history is queried from two fixed Yahoo Finance chart hosts, validated, merged deterministically and capped at 260 sessions. The live bridge remains authoritative for the current quote and option chain.
7. The generator computes versioned price, volatility, volume, options-skew, implied-volatility, expected-move and liquidity features for every included symbol.
8. Prior report baskets are reconciled against public expiration closes. Fully completed baskets receive final P/L, post-trade commentary and close-marked underlying charts on their original report.
9. A deterministic ridge-regularized policy is trained from fully resolved feature-rich trades. Learned score adjustments remain zero until the minimum sample threshold is reached and are always capped.
10. Bullish symbols produce call-debit and put-credit candidates. Bearish symbols produce put-debit and call-credit candidates.
11. Each candidate runs through deterministic jump-stress Monte Carlo, common scoring weights and the versioned outcome-trained policy.
12. The basket optimizer enforces one idea per symbol, correlation-bucket limits, one-lot and total-risk limits, and minimum debit/credit representation.
13. Reports, ranking graphics, per-idea underlying charts, retained bars, market features, all ranked candidates, the selection policy and a hash-verified run manifest are committed to Git.
14. Vercel deploys the commit. The GoDaddy iframes always render `/embed/...` from the latest valid committed edition.

If current-session data are not available, generation exits with code `75`. The workflow records a clean market-session skip and leaves the previous valid report published. It never copies yesterday's quotes into today's date.

## Market Data Contract

The primary production adapter uses `https://tt-bridge.rfdelta.com` for three read-only market-data operations: deterministic equity-universe discovery, paged equity quotes and normalized equity option chains. Quote retrieval defaults to 25-symbol pages with at most two pages in flight. Each page uses the same bounded retry policy and the complete response set is merged by symbol before chain selection. An allowlist in the adapter rejects account, transaction and order routes before any request is sent. The bridge key is required only in the generation runtime and is never needed by Vercel or the public browser.

The default quote universe is categorized in `lib/market/universe.ts`. `OPTIONS_CHAIN_SYMBOL_LIMIT` controls the maximum chains requested per run; core, mover and volume slot settings reserve capacity, and the remaining budget rotates deterministically by New York report date. Expiration monitoring is independent of this rotating set, so a prior top idea can still receive its final close and chart marker when it is no longer a current ranking candidate.

RFDELTA must maintain any exchange, vendor and derived-publication rights required for the public product. Authentication to the bridge is not itself a grant of redistribution rights.

The public-history adapter queries Yahoo Finance daily chart JSON through a fixed primary host and fixed mirror. It validates content type, response shape, symbol, date range and OHLC values before merge. Finalized historical sessions replace retained intraday approximations; the fresh bridge bar always wins for the current session. A temporary public-history outage leaves retained bars in place and does not turn an otherwise current options report into a failed publication.

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

Verify the public historical query and date coverage without writing a report or requiring a bridge key:

```powershell
npm run smoke:history -- 2026-07-10 "SPY,QQQ"
```

Generate a specific market date:

```powershell
npm run generate:daily -- 2026-07-13
```

Replace an existing report for the same date after deliberately re-fetching the market:

```powershell
npm run generate:daily -- 2026-07-13 force
```

Add entry charts to an existing committed report without changing its market snapshot, ranking or option structures:

```powershell
npm run backfill:charts -- 2026-07-10
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
public/charts/YYYY-MM-DD/underlying/NN-symbol.svg
data/market-history/daily-bars.json
data/datasets/index.json
data/datasets/YYYY-MM-DD/run-HASH/manifest.json
data/datasets/YYYY-MM-DD/run-HASH/market-features.json
data/datasets/YYYY-MM-DD/run-HASH/candidates.json
data/datasets/YYYY-MM-DD/run-HASH/selection-policy.json
data/training/selection-policy.json
```

`data/reports/index.json` identifies the latest valid report. `data/datasets/index.json` retains every distinct valid source run. Identical forced reruns deduplicate to the same content-derived run ID; a new source timestamp, feature set or policy creates a new immutable run directory.

The repository stores derived features and ranked candidate records, not full raw option-chain payloads. The current selection policy is a versioned data artifact rather than self-modifying source code, so every learned adjustment can be inspected, reproduced and rolled back.

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
- Production generation requires current-session option data for at least half the selected chain set.
- The broad quote universe is fetched in bounded batches, while a deterministic chain budget limits the more expensive options requests.
- Public historical responses are schema-validated, restricted to fixed Yahoo Finance chart hosts and never contain credentials.
- Retained daily bars are capped at 260 sessions per symbol and committed with each valid edition.
- Every distinct valid run retains its derived market features, complete ranked candidate set, selection policy and a manifest containing SHA-256 hashes for all three datasets.
- Outcome-trained feature weights remain inactive until at least eight fully resolved feature-rich trades are available, use ridge regularization and can change a score by no more than eight points.
- Completed report baskets reconcile exact vertical settlement, final one-lot P/L and post-trade commentary back into the originating report.
- Every selected idea carries a 90-session underlying chart with entry marked; completed charts must match the exact settlement date and price used for P/L.
- Every report carries a SHA-256 selection hash over the timestamped snapshot, features, discovered candidates, settings and policy.
- Candidate and final-rank tie breaks are stable and lexical.

Detailed scoring and construction rules are in [docs/methodology.md](docs/methodology.md). Production wiring is in [docs/production-checklist.md](docs/production-checklist.md).
