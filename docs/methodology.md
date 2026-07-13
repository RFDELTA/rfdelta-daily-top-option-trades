# Deterministic Options Methodology

## Discovery

The categorized publication universe is sorted, deduplicated and intersected with the source's fingerprinted deterministic equity universe on every run. Underlying quotes are retrieved in deterministic 25-symbol pages with no more than two pages in flight, then merged by symbol. Option-chain requests are capped and allocated deterministically across four sleeves: permanent market anchors, the largest absolute session movers, the highest-volume remaining names and a date-seeded rotation of the remaining quote universe. This allows the candidate set to change with market leadership while preserving exact reproducibility for a given date and quote snapshot.

The production defaults quote more than 100 market, sector, technology, semiconductor, financial, digital-asset, defense, space, healthcare, industrial, energy, materials, consumer and emerging-growth symbols, then request no more than 40 multi-expiration chains. Sleeve membership and the complete selected-symbol list are stored in the feature dataset; quote and chain counts are copied into the run manifest and public report context.

Source discovery uses the full provider universe first and its default universe second. If both discovery routes are unavailable, the controlled repository configuration becomes the deterministic discovery set; same-session quote and option-chain requirements still apply unchanged, so this fallback cannot publish synthetic or stale records.

Finalized daily underlying bars are queried from fixed Yahoo Finance chart hosts, schema-validated and merged with each valid report. The retained window is capped at 260 sessions per symbol. Public history replaces earlier intraday approximations for completed sessions; the RFDELTA bridge quote remains authoritative for the active session and official previous close. Source coverage and bar counts are stored with the versioned feature dataset and run manifest.

Expiration selection minimizes absolute distance from 14 DTE inside the 7-to-35-DTE window. Ties resolve to the earlier ISO date.

## Regime

The directional signal combines 65% five-session return and 35% twenty-session return. Twenty-session close-to-close log-return volatility is annualized. The resulting labels are trend, mean reversion, volatility expansion, risk off, risk on or mixed. Until six retained sessions are available, previous-close movement determines direction with a deliberately reduced conviction weight.

Bullish signals create:

- call debit spreads
- put credit spreads

Bearish signals create:

- put debit spreads
- call credit spreads

## Advanced Feature Surface

Every included symbol receives a versioned derived feature row before candidate construction. The row includes one-, five- and twenty-session returns; SMA and EMA distance; MACD spread; confidence-adjusted RSI; ATR; Bollinger position; five- and twenty-session realized volatility; downside volatility; maximum drawdown; trend efficiency; volume z-score; ATM implied volatility; put/call IV skew; put/call volume and open-interest ratios; expected move; quote width; and liquid-contract breadth.

Short retained windows are explicitly confidence-weighted. RSI, ATR and volatility are labeled as proxies in public output until their standard lookback is available. A temporary public-history outage preserves the last retained series rather than changing current quote or option-chain freshness rules.

## Leg Construction

Contracts must have a positive bid, ask above bid, sufficient open interest and either current volume or substantially higher standing depth. Relative bid/ask width must remain below the configured maximum.

The deterministic target deltas are:

| Structure | Long target | Short target |
|---|---:|---:|
| Call debit | 0.50 | 0.28 |
| Put debit | 0.50 absolute | 0.28 absolute |
| Put credit | 0.12 absolute | 0.24 absolute |
| Call credit | 0.12 | 0.24 |

All legal pairs are scored by delta distance, quote width and distance from the target spread width. The minimum fit score wins, followed by long strike and short strike as lexical numeric ties.

## Conservative Entry

Debit entry equals long ask minus short bid. Credit entry equals short bid minus long ask. Candidates are rejected when entry is nonpositive, consumes at least 95% of the vertical width or exceeds the configured one-lot maximum risk. The production default caps one-lot loss at $250 and the complete five-idea published basket at $800.

## Simulation

Implied volatility uses provider Greeks when present and otherwise uses bisection against each option midpoint. A seeded Monte Carlo process produces terminal prices under geometric diffusion plus symmetric jump-stress tails. Payoffs are clamped to contractual maximum loss and maximum profit.

The same candidate ID and settings produce the same simulated path sequence.

## Score

Base weights:

- 26% probability of profit
- 22% positive expected-value efficiency
- 18% liquidity quality
- 14% reward relative to risk
- 10% Black-Scholes spread edge
- 10% directional signal strength

Resolved expiration outcomes update beta-binomial strategy-style posteriors. Credit-to-width, short-strike location, quote economics and debit-lottery behavior add transparent adjustments or risk flags.

## Outcome-Trained Policy

Fully resolved trades with stored advanced metrics become deterministic training examples. Each target is realized one-lot P/L divided by published maximum loss, clamped to `[-1, 1]`. Trade-relative feature vectors cover trend alignment, mean reversion, volatility quality, option skew, liquidity and risk-adjusted momentum.

Each feature coefficient is fitted independently as `sum(x*y) / (regularization + sum(x^2))`, capped at `[-0.35, 0.35]`. The production policy remains inactive until eight examples exist. Once active, the combined learned adjustment is capped at eight score points. Policy version, sufficient statistics, coefficients, training reports and sample count are stored with every run.

This process updates versioned policy data; it never rewrites model source code.

## Basket

The publication basket:

- has at most one idea per symbol
- has at most two ideas per correlation bucket
- stays under the configured one-lot basket risk
- targets at least one credit and two debit structures when qualifying candidates exist
- ranks selected ideas by score, then expected value, then stable candidate ID

The surface targets five ranked ideas. When fewer than five candidates clear the primary score buckets, the remaining slots use the highest-ranked structures that already passed freshness, liquidity, two-leg construction and defined-risk gates. Those additions are labeled conditional and cannot carry a low modeled probability or a hard strike, credit-width or maximum-risk flag. If five candidates cannot satisfy those rules and the basket cap, the edition remains shorter rather than weakening a hard gate.

## Outcome Accountability

The selected entry and option legs are fixed in the 10:45 a.m. edition. After each regular session, finalized public daily history adds an ordered underlying close to every open idea and extends its chart; it never reranks or replaces the morning basket. Once an option expires, settlement is calculated from the retained expiration-session underlying close and the exact vertical payoff. P/L is clamped to published maximum loss and maximum profit. Outcomes are win, loss or near breakeven within one dollar. Open or unresolved contracts never train either learning layer.

When every trade from a report is terminal, the originating report receives a completed-basket section with final P/L, return on maximum risk, the strongest contributor, the largest detractor, structure-level lessons and trade-by-trade settlement reads. Partially resolved baskets are not written back as complete.

Every published idea also receives a 90-session underlying-price chart with the source-time underlying mark pinned as entry. Expired symbols are queried independently from the rotating chain-selection set, so settlement remains available even when the symbol is not selected for a new trade. Once the complete basket resolves, the archived chart is extended through expiration and receives a close marker tied to the same settlement date and price used for final P/L.

## Historical Datasets

Each distinct valid source run is archived under `data/datasets/YYYY-MM-DD/run-HASH`. The run contains the feature dataset, all scored candidates, the policy used before selection and a manifest with independent SHA-256 hashes. The report references the same run ID and policy version. Full raw option-chain payloads are not committed.
