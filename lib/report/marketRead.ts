import type { OptionsReport, MarketNewsItem, MarketRead, PublishedTradeIdea } from "@/lib/report/types";

export type MarketReadInput = {
  reportDate: string;
  dataAsOfUtc: string;
  topTrades: PublishedTradeIdea[];
  analytics: OptionsReport["analytics"];
  marketContext: OptionsReport["marketContext"];
};

export function buildMarketRead(
  current: MarketReadInput,
  archiveReports: OptionsReport[],
  newsRadar: MarketNewsItem[]
): MarketRead {
  const priorDaily = archiveReports
    .filter((report) => report.runMetadata.reportDate < current.reportDate && report.runMetadata.edition === "Daily market edition")
    .sort((a, b) => b.runMetadata.reportDate.localeCompare(a.runMetadata.reportDate))
    .slice(0, 4);
  const priorSessions = priorDaily.length
    ? priorDaily
    : archiveReports
      .filter((report) => report.runMetadata.reportDate < current.reportDate)
      .sort((a, b) => b.runMetadata.reportDate.localeCompare(a.runMetadata.reportDate))
      .slice(0, 4);
  const lookbackSessionDates = [current.reportDate, ...priorSessions.map((report) => report.runMetadata.reportDate)].slice(0, 5);
  if (!current.topTrades.length) return buildNoTradeMarketRead(current, lookbackSessionDates, newsRadar);
  const currentBias = directionalBias(current.topTrades);
  const priorBias = average(priorSessions.map((report) => directionalBias(report.topTrades)));
  const bullish = current.topTrades.filter((idea) => idea.direction === "bullish").length;
  const bearish = current.topTrades.length - bullish;
  const currentMomentum = average(current.topTrades.map((idea) => idea.fiveDayReturn));
  const currentRealizedVol = average(current.topTrades.map((idea) => idea.realizedVolatility));
  const currentImpliedVol = average(current.topTrades.map((idea) => idea.impliedVolUsed));
  const priorTopScore = average(priorSessions.map((report) => report.analytics.topScore));
  const priorProbability = average(priorSessions.map((report) => report.analytics.averageProbabilityProfit));
  const priorRisk = average(priorSessions.map((report) => report.analytics.totalMaxLossDollars));
  const scoreDelta = priorSessions.length ? current.analytics.topScore - priorTopScore : 0;
  const probabilityDelta = priorSessions.length ? current.analytics.averageProbabilityProfit - priorProbability : 0;
  const riskDelta = priorSessions.length ? current.analytics.totalMaxLossDollars - priorRisk : 0;
  const currentSymbols = new Set(current.topTrades.map((idea) => idea.symbol));
  const priorSymbols = new Set(priorSessions.flatMap((report) => report.topTrades.map((idea) => idea.symbol)));
  const recurringSymbols = [...currentSymbols].filter((symbol) => priorSymbols.has(symbol)).sort();
  const dominantRegime = mode(current.topTrades.map((idea) => idea.regime.replaceAll("_", " "))) ?? "mixed";
  const newsTopics = frequency(newsRadar.map((item) => topicLabel(item.topic)));
  const leadingNewsTopics = Object.entries(newsTopics)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([topic]) => topic);
  const biasRead = currentBias >= 0.2 ? "constructively tilted" : currentBias <= -0.2 ? "defensively tilted" : "split down the middle";
  const biasChange = currentBias - priorBias;
  const headline = currentBias <= -0.2
    ? "The board is selling optimism, but only with defined risk"
    : currentBias >= 0.2
      ? "Risk appetite is improving, but the option bill still matters"
      : "The index story is simple; the option board is not";
  const comparisonRead = priorSessions.length
    ? `Across ${lookbackSessionDates.length} retained market boards, directional balance has moved ${biasChange > 0.15 ? "more constructive" : biasChange < -0.15 ? "more defensive" : "sideways"}; the top score is ${signed(scoreDelta, 2)} points versus the prior-board average and modeled win probability is ${signedPctPoints(probabilityDelta)}.`
    : "This is the first retained board in the rolling comparison window, so today's levels establish the baseline that subsequent editions will challenge.";
  const recurringRead = recurringSymbols.length
    ? `${recurringSymbols.join(", ")} ${recurringSymbols.length === 1 ? "returns" : "return"} to the leading group, which makes follow-through more important than another round of headline enthusiasm.`
    : "No current leader repeats from the available prior boards. Rotation is doing more work than durable leadership, and that is usually where chasing yesterday's winner becomes expensive.";
  const volatilityGap = currentImpliedVol - currentRealizedVol;
  const volatilityRead = volatilityGap >= 0.05
    ? `Average implied volatility is ${pct(currentImpliedVol)} against ${pct(currentRealizedVol)} realized volatility. The premium is visible, but expensive options are not automatically good shorts; the spread still has to survive direction and path.`
    : volatilityGap <= -0.05
      ? `Average implied volatility is ${pct(currentImpliedVol)} against ${pct(currentRealizedVol)} realized volatility. Optionality is not carrying an obvious volatility premium, so debit ideas still need immediate directional proof.`
      : `Average implied and realized volatility are close at ${pct(currentImpliedVol)} and ${pct(currentRealizedVol)}. With little volatility cushion either way, strike placement and entry discipline matter more than a broad volatility call.`;
  const headlineRead = newsRadar.length
    ? `The public headline radar is concentrated in ${joinList(leadingNewsTopics)}. That is the catalyst layer, not the trade instruction: the useful question is whether those stories confirm the board's ${dominantRegime} regime or merely create an opening burst that fades after liquidity arrives.`
    : `The price-and-options evidence carries the read today. A ${dominantRegime} regime with ${signedPct(currentMomentum)} mean five-session momentum leaves less room for narrative-first trading; confirmation has to appear in breadth, volatility and follow-through.`;

  return {
    asOfUtc: current.dataAsOfUtc,
    lookbackSessionDates,
    headline,
    standfirst: `Today's ${current.topTrades.length}-spread board is ${biasRead}: ${bullish} bullish and ${bearish} bearish expressions, ${pct(current.analytics.averageProbabilityProfit)} average modeled probability of profit and ${money(current.analytics.totalMaxLossDollars)} of aggregate one-lot maximum risk. ${comparisonRead}`,
    commentary: [
      `The market can look calm at index level while the option chain tells a less comfortable story. The published names carry ${signedPct(currentMomentum)} average five-session momentum and cluster most heavily in a ${dominantRegime} regime. That is not a blanket vote on the market; it is a warning that the day's best-defined payoffs are selective rather than broad.`,
      `${recurringRead} The top score sits at ${current.analytics.topScore.toFixed(2)}, while the basket's expected value totals ${money(current.analytics.totalExpectedValueDollars)} under conservative bid-and-ask entries. A ranking that cannot absorb the spread between theory and execution does not belong on the public board.`,
      `${volatilityRead} The structure mix is ${current.analytics.creditIdeaCount} credit and ${current.analytics.debitIdeaCount} debit spreads, so the board is neither blindly buying convexity nor mechanically selling premium. It is paying only where direction can justify the bill and collecting only where the strikes leave room for error.`,
      headlineRead
    ],
    newsRadar,
    watchItems: [
      {
        label: "Breadth confirmation",
        signal: `${bullish} bullish / ${bearish} bearish; ${signedPct(currentMomentum)} mean five-session move`,
        read: currentBias >= 0.2
          ? "Constructive setups need broader participation. If only one or two names carry the upside, the apparent risk-on turn is still a narrow trade."
          : currentBias <= -0.2
            ? "Defensive skew needs downside follow-through. A fast reversal above entry regimes would invalidate the premise before contractual risk is reached."
            : "A balanced board is a demand for selectivity. Treat a one-sided index move as suspect until the individual setups confirm it."
      },
      {
        label: "Volatility spread",
        signal: `${pct(currentImpliedVol)} implied vs ${pct(currentRealizedVol)} realized`,
        read: "Watch whether implied volatility expands with price movement or collapses after the opening catalyst. That relationship decides whether direction alone is enough."
      },
      {
        label: "Leadership durability",
        signal: recurringSymbols.length ? `Repeat leaders: ${recurringSymbols.join(", ")}` : "No repeat leader in the current board",
        read: recurringSymbols.length
          ? "Recurring names deserve confirmation at the published entry, not looser terms. Repetition can signal durable leadership or a crowded thesis."
          : "Rapid rotation argues for smaller assumptions and harder entry limits. New leadership has not yet earned persistence."
      },
      {
        label: "News catalyst",
        signal: newsRadar.length ? `${newsRadar.length} ranked headlines across ${Math.max(1, leadingNewsTopics.length)} themes` : "Price confirmation outranks headline velocity",
        read: newsRadar.length
          ? `The leading ${joinList(leadingNewsTopics)} headlines matter only where they alter cash-flow expectations, funding costs or volatility. Price confirmation decides whether the story belongs in the trade.`
          : "Use the first reaction as evidence, not proof. The board requires price and options confirmation before a headline becomes a durable thesis."
      },
      {
        label: "Risk budget",
        signal: `${money(current.analytics.totalMaxLossDollars)} maximum one-lot basket loss (${signedMoney(riskDelta)} vs prior average)`,
        read: "Maximum losses are additive. Correlated names can fail together even when each spread is individually defined, so basket risk matters more than the comfort of any single cap."
      }
    ],
    basis: `Rolling comparison uses ${lookbackSessionDates.length} retained published market session${lookbackSessionDates.length === 1 ? "" : "s"}: ${lookbackSessionDates.map(formatDate).join(", ")}. The current screen ranked ${current.marketContext.candidateCount} candidates across ${current.marketContext.includedSymbolCount} included symbols. Headline ranking uses publication time, market relevance, source quality, symbol relevance and topic diversity. Market evidence is timestamped ${formatDateTime(current.dataAsOfUtc)}.`
  };
}

function buildNoTradeMarketRead(current: MarketReadInput, lookbackSessionDates: string[], newsRadar: MarketNewsItem[]): MarketRead {
  return {
    asOfUtc: current.dataAsOfUtc,
    lookbackSessionDates,
    headline: "The cleanest option trade today is patience",
    standfirst: `The screen evaluated ${current.marketContext.candidateCount} defined-risk spreads across ${current.marketContext.includedSymbolCount} current option chains. None cleared the complete price, probability, liquidity and confirmation standard at the quoted terms.`,
    commentary: [
      "A no-trade board does not mean the market is quiet. It means the available spreads asked for too much risk, offered too little probability margin or lacked enough follow-through to justify an entry at the displayed bid and ask.",
      "The important distinction is between an interesting ticker and an executable spread. Today produced candidates worth monitoring, but not one with enough room between its modeled probability and the payoff hurdle after conservative pricing.",
      "That leaves the daily posture in cash rather than forcing a fifth-best idea into a portfolio. A later move can improve the setup, but it would need a fresh option-chain evaluation because both price and volatility will have changed.",
      newsRadar.length
        ? "The headline tape remains active, but fresh news only matters when the underlying and option market confirm it together. Today that confirmation was incomplete."
        : "Price, volatility and liquidity carry the read today. None aligned strongly enough to turn market movement into a defined-risk recommendation."
    ],
    newsRadar,
    watchItems: [
      { label: "Probability margin", signal: "No spread cleared the full hurdle", read: "A stronger move or better option price can widen the gap between modeled probability and the break-even requirement." },
      { label: "Liquidity", signal: `${current.marketContext.includedSymbolCount} current chains reviewed`, read: "Tighter two-sided quotes can materially improve a vertical spread without changing the underlying thesis." },
      { label: "Session follow-through", signal: "Direction remains unconfirmed", read: "A durable move through the session reference level matters more than an opening burst that fades." },
      { label: "Volatility", signal: "No favorable risk-price combination", read: "Watch whether implied volatility reprices faster than the underlying. Better structure can emerge even when direction stays unchanged." },
      { label: "Risk budget", signal: "$0 of new one-lot maximum loss", read: "No new exposure is preferable to accepting a spread that failed the same publication standard applied to every candidate." }
    ],
    basis: `Rolling comparison covers ${lookbackSessionDates.length} retained market session${lookbackSessionDates.length === 1 ? "" : "s"}: ${lookbackSessionDates.map(formatDate).join(", ")}. Market evidence is timestamped ${formatDateTime(current.dataAsOfUtc)}.`
  };
}

function directionalBias(ideas: PublishedTradeIdea[]) {
  if (!ideas.length) return 0;
  return ideas.reduce((sum, idea) => sum + (idea.direction === "bullish" ? 1 : -1), 0) / ideas.length;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function mode(values: string[]) {
  const counts = frequency(values);
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

function frequency(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function topicLabel(topic: MarketNewsItem["topic"]) {
  return topic === "broad_market" ? "broad-market positioning" : topic;
}

function joinList(values: string[]) {
  if (!values.length) return "cross-asset positioning";
  if (values.length === 1) return values[0];
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function signedPct(value: number) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function signedPctPoints(value: number) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)} percentage points`;
}

function signed(value: number, places: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(places)}`;
}

function money(value: number) {
  const prefix = value < 0 ? "-$" : "$";
  return `${prefix}${Math.abs(value).toFixed(0)}`;
}

function signedMoney(value: number) {
  return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toFixed(0)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short"
  }).format(new Date(value));
}
