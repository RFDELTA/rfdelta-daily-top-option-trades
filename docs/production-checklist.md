# Production Checklist

## Market Data

- [ ] Confirm exchange, vendor and derived-publication rights for the public product.
- [ ] Add `TT_BRIDGE_API_KEY` as a GitHub Actions secret.
- [ ] Add `TT_BRIDGE_BASE_URL=https://tt-bridge.rfdelta.com` as a GitHub Actions variable.
- [ ] Run `npm run smoke:bridge -- YYYY-MM-DD "SPY,QQQ"` during a current U.S. market session.
- [ ] Run a manual workflow during regular U.S. option-market hours.
- [ ] Confirm quote-universe batching and the core, mover, volume and rotation sleeve counts appear in safe workflow logs.
- [ ] Confirm the Daily Market Read contains a one-to-five-session rolling comparison and only recent ranked public headlines.

## GitHub

- [ ] Push the repository to `main`.
- [ ] Confirm branch protection permits the workflow's report commit, or grant the workflow an approved bypass.
- [ ] Confirm Actions has `contents: write` permission.
- [ ] Run CI and the daily workflow manually.
- [ ] Confirm the 10:45 a.m. and 11:05 a.m. `America/New_York` publication schedules are active.
- [ ] Confirm the 4:20 p.m. and 5:05 p.m. `America/New_York` close-capture schedules are active.
- [ ] Manually test both `publish` and `closing_prints` workflow modes.
- [ ] Confirm only `data/reports`, `data/market-history`, `data/datasets`, `data/training` and `public/charts` change during a normal daily run.

## Vercel

- [ ] Import the GitHub repository.
- [ ] Confirm Framework Preset is Next.js.
- [ ] Do not create a Vercel cron.
- [ ] Set the Actions variable `PRODUCTION_URL` to the Vercel or custom-domain origin.
- [ ] Keep Git deploys enabled or add a Vercel deploy hook to GitHub secret `VERCEL_DEPLOY_HOOK_URL`.
- [ ] Verify `/api/latest` reports the expected market date after deployment.

## GoDaddy

- [ ] Create six contiguous HTML sections on `delta-%7C-top-option-trades`.
- [ ] Paste one numbered snippet from `godaddy-top-option-trades-blocks.html` into each section.
- [ ] Leave Center Align off.
- [ ] Leave Forced Height blank.
- [ ] Place advertising sections between iframe sections where desired.
- [ ] Verify desktop and mobile pages have only the main page scrollbar.
- [ ] Expand multiple accountability ledgers and confirm GoDaddy's containing iframe grows beyond its loading height.
- [ ] Verify the iframe content uses the complete HTML-section width.
- [ ] Publish the GoDaddy page only after the Vercel origins in the snippets are correct.

## Daily Acceptance

- [ ] Workflow date is New York market date.
- [ ] Report data timestamp belongs to the same market session.
- [ ] Five ideas are published when five structurally valid candidates fit all hard gates and the basket cap.
- [ ] When five qualified ideas fit inside the $800 basket cap, all five are published.
- [ ] Rank chart labels and scores do not overlap bars.
- [ ] Prior-basket outcomes use expiration settlement and no open trade is scored.
- [ ] The accountability embed shows multiple dated baskets, opens the newest by default and expands older ledgers without an inner scrollbar.
- [ ] Daily Market Read commentary reconciles its directional, volatility, score, probability and risk statements to report data.
- [ ] The run manifest hashes match the feature, candidate and policy datasets.
- [ ] Historical provider, coverage ratio and bar count match between the feature dataset and run manifest.
- [ ] Quote-universe and option-chain counts match between the feature dataset, run manifest and public report context.
- [ ] Every top idea has a readable underlying entry chart; completed ideas also show the exact settlement close marker.
- [ ] After the close workflow, every open idea has the current session's official close and the chart ends on that session.
- [ ] The report references the same dataset run and policy version used for selection.
- [ ] Completed baskets contain no open trades and final P/L equals the sum of trade outcomes.
- [ ] Learned feature weights stay inactive below the minimum sample threshold and score adjustment remains inside the configured cap.
- [ ] Public copy contains no account, provider-failure, bridge, mock or execution-control language.
