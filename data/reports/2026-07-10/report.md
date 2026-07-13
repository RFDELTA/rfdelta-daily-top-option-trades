# RFDELTA Top Option Trades - 2026-07-10

**2 defined-risk option setups lead the Jul 10, 2026 board**

TLT 7/24 85/84.5 Put Debit Spread ranks first with a 37.88 score, 51.1% modeled probability of profit and $29.00 maximum one-lot risk. The basket balances 0 bullish and 2 bearish expressions.

The option board is not rewarding indiscriminate beta. Across the published names, the mean five-session move is -1.6%, while 0 setups carry realized volatility above 65%. That combination favors defined-risk structures and hard entry limits over naked premium exposure.

The screen begins with 18 liquid underlyings and accepts only same-session chains with two usable legs. It then forces every idea through the same conservative mark: pay the ask for the long option and receive the bid for the short. The resulting ranking is intentionally harsher than a midpoint screen, because a trade that only works at a theoretical fill is not a durable public idea.

Direction comes from five- and twenty-session price structure rather than a headline guess. That keeps the daily board responsive to what is actually trading while the scenario engine still reserves room for jumps, volatility expansion and path-dependent failure. The result is a short list, not a promise that every liquid ticker deserves a trade.

TLT wins the top slot because liquidity, directional alignment and bounded payoff reinforce one another. Its debit entry of 0.29 creates 0.72 dollars of maximum reward for each dollar of maximum risk, with breakeven at $84.71.

PLTR supplies the counterweight. Its put debit structure scores 36.57 and carries $187.00 of one-lot maximum loss. The basket is therefore ranked as a portfolio of explicit risks, not as five unrelated ticker calls.

**Risk read:** The basket's maximum losses are additive if every thesis fails. Quote slippage, early assignment and volatility repricing can also change the practical outcome before expiration, so the published entry is a ceiling for debits and a floor for credits, not an assurance of execution.

## Ranked Opportunities

| Rank | Trade | Entry | Prob. Profit | EV | Max Loss | Max Profit | Score |
|---:|---|---:|---:|---:|---:|---:|---:|
| 1 | TLT 7/24 85/84.5 Put Debit Spread | Debit 0.29 | 51.1% | -$3.16 | $29.00 | $21.00 | 37.88 |
| 2 | PLTR 7/24 125/120 Put Debit Spread | Debit 1.87 | 40.1% | $3.11 | $187.00 | $313.00 | 36.57 |

### 1. TLT 7/24 85/84.5 Put Debit Spread

**Trigger-dependent setup.** The setup scores 37.88 on the common scale, supported by 51.1% modeled probability of profit, 0.88 liquidity quality and a conservative modeled expectancy of -$3.16, which keeps sizing discipline central.

TLT enters with -1.1% five-session momentum and -0.4% over twenty sessions. Realized volatility is 10.6%, placing the underlying in a mixed regime. The bearish structure expresses that tape without allowing the loss to expand beyond the spread debit or defined credit width.

**Underlying chart:** [TLT entry and open-position history](/charts/2026-07-10/underlying/01-tlt.svg) at $84.55.

**Advanced metrics:** 260 retained sessions; RSI(14) 29.5; MACD spread -0.33%; ATR(14) 0.71%; realized volatility 10.6%; ATM implied volatility 8.1%; expected move 1.3%. Outcome-trained score adjustment: +0.00.

**Execution:** Buy the 85 put and sell the 84.5 put, both expiring Jul 24, 2026. The debit mark of 0.29 assumes the long ask and short bid, not a midpoint. Do not pay more than 0.29 for the spread without rerunning the payoff.

**Risk:** Maximum one-lot loss is $29.00. Breakeven is $84.71 and sits 0.2% above the source mark, providing an upside cushion. Primary watch: a directional break before expiration. A break in the stated directional regime invalidates the reason for holding even when the contractual maximum loss remains unchanged.

**Payoff:** Maximum one-lot profit is $21.00, or 0.72 times maximum risk. The simulation assigns 48.3% probability to finishing near maximum profit and uses 18.0% implied volatility across deterministic jump-stress paths.

### 2. PLTR 7/24 125/120 Put Debit Spread

**Trigger-dependent setup.** The setup scores 36.57 on the common scale, supported by 40.1% modeled probability of profit, 0.86 liquidity quality and positive modeled expectancy of $3.11.

PLTR enters with -2.1% five-session momentum and -2.8% over twenty sessions. Realized volatility is 58.1%, placing the underlying in a risk off regime. The bearish structure expresses that tape without allowing the loss to expand beyond the spread debit or defined credit width.

**Underlying chart:** [PLTR entry and open-position history](/charts/2026-07-10/underlying/02-pltr.svg) at $126.55.

**Advanced metrics:** 260 retained sessions; RSI(14) 48.3; MACD spread 1.29%; ATR(14) 5.58%; realized volatility 58.1%; ATM implied volatility 49.1%; expected move 7.7%. Outcome-trained score adjustment: +0.00.

**Execution:** Buy the 125 put and sell the 120 put, both expiring Jul 24, 2026. The debit mark of 1.87 assumes the long ask and short bid, not a midpoint. Do not pay more than 1.87 for the spread without rerunning the payoff.

**Risk:** Maximum one-lot loss is $187.00. Breakeven is $123.13 and requires a 2.7% decline from the source mark. Primary watch: a directional break before expiration. A break in the stated directional regime invalidates the reason for holding even when the contractual maximum loss remains unchanged.

**Payoff:** Maximum one-lot profit is $313.00, or 1.67 times maximum risk. The simulation assigns 30.3% probability to finishing near maximum profit and uses 50.4% implied volatility across deterministic jump-stress paths.

## Accountability

The Jun 19, 2026 basket has no scored expiration result yet. 5 expired positions are awaiting a retained expiration close before scoring.

| Prior trade | Outcome | Realized P/L | Read |
|---|---|---:|---|
| MARA 7/3 13/12.5 Put Credit Spread | awaiting close | Open | The expiration close is not yet present in the retained history, so the outcome remains unscored. |
| SMCI 7/3 28/27 Put Credit Spread | awaiting close | Open | The expiration close is not yet present in the retained history, so the outcome remains unscored. |
| RGTI 7/3 19.5/19 Put Credit Spread | awaiting close | Open | The expiration close is not yet present in the retained history, so the outcome remains unscored. |
| QUBT 7/3 10.5/10 Put Debit Spread | awaiting close | Open | The expiration close is not yet present in the retained history, so the outcome remains unscored. |
| SOFI 7/3 17.5/16.5 Put Debit Spread | awaiting close | Open | The expiration close is not yet present in the retained history, so the outcome remains unscored. |

## Method

- A configured liquid-symbol list is intersected with the source's fingerprinted universe and evaluated alphabetically so discovery and tie-breaking remain repeatable.
- The nearest expiration inside the configured 7-to-35-day window is chosen by distance from a 14-day target.
- Each candidate is a two-leg, one-lot vertical spread with a known maximum loss at entry.
- Both legs must clear bid, ask, open-interest, volume or depth, and relative quote-width gates.
- Momentum direction determines whether bullish call-debit and put-credit structures or bearish put-debit and call-credit structures enter the ranking set.
- Resolved trades train bounded feature adjustments only after the minimum sample threshold; every policy and input dataset is versioned with the report.
- Modeled probability of profit: 26% of the base score.
- Conservative expected-value efficiency: 22%.
- Two-leg liquidity quality: 18%.
- Maximum reward relative to maximum risk: 14%.
- Black-Scholes spread edge and directional signal strength: 10% each.
- Resolved prior outcomes adjust the strategy-style posterior without changing the underlying quote record.
- The advanced feature layer contributes at most 8 score points and currently contains 0 fully resolved training examples.

Every entry is marked conservatively: the long leg is bought at its ask and the short leg is sold at its bid. Maximum loss and maximum profit are shown for one spread before commissions, fees, early assignment and exercise costs.

RFDELTA normalized U.S. equity and options market data. Historical technical series: Yahoo Finance public daily chart history. Data timestamp: Jul 11, 2026, 6:38 AM EDT. Historical calibration editions are clearly labeled and are never promoted as current market data.

RFDELTA Top Option Trades is market intelligence, not individualized investment advice. Options can expire worthless, spreads can be assigned early, and displayed quotes may move before an order can be filled.
