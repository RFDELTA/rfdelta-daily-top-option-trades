# RFDELTA Daily Top Option Trades

Production-oriented generator and public report site for the RFDELTA Top Option Trades page. One weekday workflow discovers current U.S. option chains, constructs defined-risk vertical spreads, applies deterministic liquidity and risk gates, simulates each candidate, ranks a diversified basket, writes an immutable report archive, generates SVG graphics and publishes the committed result through Vercel. Six standalone iframe blocks are provided for the GoDaddy page at `https://rfdelta.com/delta-%7C-top-option-trades`.

The repository never submits orders. It does not contain account identifiers, balances, buying power, brokerage controls or public fallback mocks.

## Publication Flow

1. GitHub Actions starts at 14:45 UTC on weekdays, after the U.S. regular session is open in both standard and daylight time.
2. The workflow resolves the current date in `America/New_York`.
3. The Tradier production adapter fetches bulk underlying quotes, daily history, deterministic expirations and one option chain per included symbol.
4. Same-session freshness, bid/ask, open interest, volume/depth and relative spread-width gates run before modeling.
5. Bullish symbols produce call-debit and put-credit candidates. Bearish symbols produce put-debit and call-credit candidates.
6. Each candidate runs through deterministic jump-stress Monte Carlo and common scoring weights.
7. The basket optimizer enforces one idea per symbol, correlation-bucket limits, one-lot and total-risk limits, and minimum debit/credit representation.
8. The generator evaluates expired ideas from the prior edition and integrates resolved outcomes into strategy-style posteriors.
9. JSON, Markdown, CSV and two SVG charts are written under the report date and committed to Git.
10. Vercel deploys the commit. The GoDaddy iframes always render `/embed/...` from the latest valid committed edition.

If current-session data are not available, generation exits with code `75`. The workflow records a clean market-session skip and leaves the previous valid report published. It never copies yesterday's quotes into today's date.

## Market Data Rights

The included production adapter uses the Tradier Brokerage API. Tradier documents production market data and option-chain Greeks, but its FAQ also says ordinary API access is for personal use unless the user is a Tradier Partner. Before public deployment, confirm that the RFDELTA account and intended derived publication have the necessary rights. See:

- <https://docs.tradier.com/docs/endpoints>
- <https://docs.tradier.com/reference/brokerage-api-markets-get-options-chains>
- <https://docs.tradier.com/docs/faq>

The generator fails closed until `MARKET_DATA_PUBLICATION_LICENSE_ACKNOWLEDGED=true`. That switch is an operational acknowledgement, not a substitute for an appropriate agreement.

## Local Setup

Prerequisites:

- Node.js 22
- npm 10 or later
- A Tradier production token for live generation

Install and create local configuration:

```powershell
npm install
Copy-Item .env.example .env.local
```

Set at minimum:

```dotenv
TRADIER_ACCESS_TOKEN="your-production-token"
TRADIER_BASE_URL="https://api.tradier.com/v1"
MARKET_DATA_PUBLICATION_LICENSE_ACKNOWLEDGED="true"
```

Start the site:

```powershell
npm run dev
```

Open `http://localhost:3000/latest`.

## Commands

Generate the current New York market date from live data:

```powershell
npm run generate:daily -- --date today
```

Generate a specific market date:

```powershell
npm run generate:daily -- --date 2026-07-13
```

Replace an existing report for the same date after deliberately re-fetching the market:

```powershell
npm run generate:daily -- --date 2026-07-13 --force
```

Generate the clearly labeled historical calibration edition without network credentials:

```powershell
npm run generate:fixture
```

Verify archive completeness and reject internal-facing public copy:

```powershell
npm run verify:reports -- --date 2026-06-19
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
```

`data/reports/index.json` identifies the latest valid report and retains archive metadata. The archive is committed data, so a Vercel build never depends on writing to an ephemeral server filesystem.

## GitHub Configuration

Create a GitHub repository and push `main`. Add this Actions secret:

| Name | Type | Purpose |
|---|---|---|
| `TRADIER_ACCESS_TOKEN` | Secret | Production market-data authentication |
| `VERCEL_DEPLOY_HOOK_URL` | Secret, optional | Explicit deploy hook when Git integration is not sufficient |

Add these Actions variables:

| Name | Value |
|---|---|
| `MARKET_DATA_PUBLICATION_LICENSE_ACKNOWLEDGED` | `true` only after rights are confirmed |
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

- Tokens stay in `.env.local` or GitHub Actions secrets.
- Authorization headers and raw provider payloads are never written to reports.
- Public report validation rejects bridge, account, mock, order and runtime-failure language.
- Public output contains derived two-leg quotes and model analytics, not access credentials.
- Production generation requires current-session quotes for at least half the configured universe.
- Every report carries a SHA-256 selection hash over the timestamped snapshot, discovered candidates and model settings.
- Candidate and final-rank tie breaks are stable and lexical.

Detailed scoring and construction rules are in [docs/methodology.md](docs/methodology.md). Production wiring is in [docs/production-checklist.md](docs/production-checklist.md).
