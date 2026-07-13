# Deterministic Options Methodology

## Discovery

The publication list is sorted, deduplicated and intersected with the source's fingerprinted deterministic equity universe on every run. A bulk underlying quote call is followed by one normalized multi-expiration option-chain request per symbol. Symbols are processed with bounded concurrency so the result does not depend on network response timing.

Daily underlying bars are retained with each valid report and capped at 90 sessions per symbol. The current session and previous close seed new symbols; the retained window then supplies the five- and twenty-session signal history without introducing a second live-data source.

Expiration selection minimizes absolute distance from 14 DTE inside the 7-to-35-DTE window. Ties resolve to the earlier ISO date.

## Regime

The directional signal combines 65% five-session return and 35% twenty-session return. Twenty-session close-to-close log-return volatility is annualized. The resulting labels are trend, mean reversion, volatility expansion, risk off, risk on or mixed. Until six retained sessions are available, previous-close movement determines direction with a deliberately reduced conviction weight.

Bullish signals create:

- call debit spreads
- put credit spreads

Bearish signals create:

- put debit spreads
- call credit spreads

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

Debit entry equals long ask minus short bid. Credit entry equals short bid minus long ask. Candidates are rejected when entry is nonpositive, consumes at least 95% of the vertical width or exceeds the configured one-lot maximum risk. The production default caps one-lot loss at $250 and the complete published basket at $750.

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

## Basket

The publication basket:

- has at most one idea per symbol
- has at most two ideas per correlation bucket
- stays under the configured one-lot basket risk
- targets at least one credit and two debit structures when qualifying candidates exist
- ranks selected ideas by score, then expected value, then stable candidate ID

The screen may publish fewer than five ideas. It does not fill a date with a candidate that breaches a hard risk gate.

## Outcome Accountability

Once an option expires, settlement is calculated from the underlying expiration close and the exact vertical payoff. P/L is clamped to published maximum loss and maximum profit. Outcomes are win, loss or near breakeven within one dollar. Open contracts stay open and do not train the posterior.
