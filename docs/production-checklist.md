# Production Checklist

## Market Data

- [ ] Confirm public derived-publication rights with the provider.
- [ ] Create a Tradier production access token.
- [ ] Add `TRADIER_ACCESS_TOKEN` as a GitHub Actions secret.
- [ ] Set the Actions variable `MARKET_DATA_PUBLICATION_LICENSE_ACKNOWLEDGED=true` only after rights are confirmed.
- [ ] Run a manual workflow during regular U.S. option-market hours.

## GitHub

- [ ] Push the repository to `main`.
- [ ] Confirm branch protection permits the workflow's report commit, or grant the workflow an approved bypass.
- [ ] Confirm Actions has `contents: write` permission.
- [ ] Run CI and the daily workflow manually.
- [ ] Confirm only `data/reports` and `public/charts` change during a normal daily run.

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
- [ ] Verify the iframe content uses the complete HTML-section width.
- [ ] Publish the GoDaddy page only after the Vercel origins in the snippets are correct.

## Daily Acceptance

- [ ] Workflow date is New York market date.
- [ ] Report data timestamp belongs to the same market session.
- [ ] Five or fewer ideas meet all hard gates.
- [ ] Rank chart labels and scores do not overlap bars.
- [ ] Prior-basket outcomes use expiration settlement and no open trade is scored.
- [ ] Public copy contains no account, provider-failure, bridge, mock or execution-control language.
