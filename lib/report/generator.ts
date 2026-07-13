import { createHash } from "node:crypto";
import calibrationOutcomes from "@/data/calibration/prior-outcomes-2026-06-18.json";
import { persistSnapshotHistory } from "@/lib/market/history";
import { createMarketDataProvider } from "@/lib/market/provider";
import type { MarketDataProvider, MarketSnapshot } from "@/lib/market/types";
import { getUniverse } from "@/lib/market/universe";
import { buildPublishBasket } from "@/lib/model/basketOptimizer";
import { discoverCandidates } from "@/lib/model/candidateDiscovery";
import {
  applyRealizedBasketLesson,
  createInitialLessonSnapshot,
  type RealizedTradeOutcome
} from "@/lib/model/lessonLearning";
import { payoff } from "@/lib/model/math";
import { scoreCandidate } from "@/lib/model/scoring";
import { getDefaultModelSettings } from "@/lib/model/settings";
import type { LessonSnapshot, TradeIdeaScore } from "@/lib/model/types";
import { getReport, getReportIndex, persistReport, reportExists } from "@/lib/report/store";
import type {
  OptionsReport,
  PublishedTradeIdea,
  TradeCommentary,
  TradeOutcome
} from "@/lib/report/types";

type GenerateOptions = {
  date: string;
  force?: boolean;
  provider?: MarketDataProvider;
};

const CALIBRATION_OUTCOMES = calibrationOutcomes as TradeOutcome[];

export async function generateAndPersist(options: GenerateOptions) {
  if (!options.force && await reportExists(options.date)) {
    return { report: await getReport(options.date), skipped: true };
  }
  const provider = options.provider ?? createMarketDataProvider();
  const snapshot = await provider.getSnapshot({ reportDate: options.date, universe: getUniverse() });
  if (!snapshot.universe.length && !snapshot.symbols.length) throw new Error("The market universe is empty.");
  const report = await buildReport(snapshot);
  await persistSnapshotHistory(snapshot);
  await persistReport(report);
  return { report, skipped: false };
}

export async function generateWithUniverse(options: GenerateOptions & { universe: string[] }) {
  if (!options.force && await reportExists(options.date)) {
    return { report: await getReport(options.date), skipped: true };
  }
  const provider = options.provider ?? createMarketDataProvider();
  const snapshot = await provider.getSnapshot({ reportDate: options.date, universe: options.universe });
  const report = await buildReport(snapshot);
  await persistSnapshotHistory(snapshot);
  await persistReport(report);
  return { report, skipped: false };
}

export async function buildReport(snapshot: MarketSnapshot): Promise<OptionsReport> {
  const settings = getDefaultModelSettings();
  const discovery = discoverCandidates(snapshot);
  const accountability = await buildAccountability(snapshot);
  const lessons = await buildLessonSnapshot(snapshot.asOfUtc, accountability);
  const rankedCandidates = discovery.candidates
    .map((candidate) => scoreCandidate(candidate, settings, lessons))
    .sort(compareIdeas)
    .map((idea, index) => ({ ...idea, rank: index + 1 }));
  const basket = buildPublishBasket(rankedCandidates, settings);
  const topTrades = basket.map((idea) => ({
    ...idea,
    lessonAdjustments: [],
    commentary: buildTradeCommentary(idea)
  }));
  const selectionHash = createHash("sha256")
    .update(JSON.stringify({ snapshot: snapshot.asOfUtc, candidates: discovery.candidates, settings }))
    .digest("hex");
  const historical = snapshot.provider.includes("fixture");
  const analytics = buildAnalytics(topTrades);
  const report: OptionsReport = {
    schemaVersion: "1.0",
    reportId: `rfdelta-options-${snapshot.reportDate}-${selectionHash.slice(0, 12)}`,
    runMetadata: {
      reportDate: snapshot.reportDate,
      marketSessionDate: snapshot.sessionDate,
      generatedAtUtc: historical ? snapshot.asOfUtc : new Date().toISOString(),
      dataAsOfUtc: snapshot.asOfUtc,
      edition: historical ? "Historical calibration edition" : "Daily market edition",
      methodologyVersion: "rfdelta-options-v1",
      selectionHash
    },
    executiveSummary: buildExecutiveSummary(topTrades, snapshot),
    marketContext: {
      providerAttribution: snapshot.providerAttribution,
      universeCount: snapshot.universe.length,
      includedSymbolCount: snapshot.symbols.length,
      excludedSymbolCount: snapshot.excludedSymbols.length,
      candidateCount: rankedCandidates.length,
      bullishCandidateCount: rankedCandidates.filter((idea) => idea.direction === "bullish").length,
      bearishCandidateCount: rankedCandidates.filter((idea) => idea.direction === "bearish").length,
      regimeCounts: countBy(rankedCandidates.map((idea) => idea.regime))
    },
    analytics,
    topTrades,
    accountability,
    methodology: {
      selectionCriteria: [
        "A configured liquid-symbol list is intersected with the source's fingerprinted universe and evaluated alphabetically so discovery and tie-breaking remain repeatable.",
        "The nearest expiration inside the configured 7-to-35-day window is chosen by distance from a 14-day target.",
        "Each candidate is a two-leg, one-lot vertical spread with a known maximum loss at entry.",
        "Both legs must clear bid, ask, open-interest, volume or depth, and relative quote-width gates.",
        "Momentum direction determines whether bullish call-debit and put-credit structures or bearish put-debit and call-credit structures enter the ranking set."
      ],
      rankingFramework: [
        "Modeled probability of profit: 26% of the base score.",
        "Conservative expected-value efficiency: 22%.",
        "Two-leg liquidity quality: 18%.",
        "Maximum reward relative to maximum risk: 14%.",
        "Black-Scholes spread edge and directional signal strength: 10% each.",
        "Resolved prior outcomes adjust the strategy-style posterior without changing the underlying quote record."
      ],
      executionAssumption: "Every entry is marked conservatively: the long leg is bought at its ask and the short leg is sold at its bid. Maximum loss and maximum profit are shown for one spread before commissions, fees, early assignment and exercise costs.",
      publicationCadence: "A single weekday workflow runs after the U.S. options session opens. If same-session quotes are unavailable, the most recent valid edition remains published.",
      marketDataStatement: `${snapshot.providerAttribution}. Data timestamp: ${formatDateTime(snapshot.asOfUtc)}. Historical calibration editions are clearly labeled and are never promoted as current market data.`,
      disclaimer: "RFDELTA Top Option Trades is market intelligence, not individualized investment advice. Options can expire worthless, spreads can be assigned early, and displayed quotes may move before an order can be filled."
    }
  };
  return report;
}

async function buildLessonSnapshot(asOfUtc: string, currentAccountability: OptionsReport["accountability"]): Promise<LessonSnapshot> {
  let snapshot = createInitialLessonSnapshot(asOfUtc);
  snapshot = applyRealizedBasketLesson(snapshot, "calibration-2026-06-18", toLessons(CALIBRATION_OUTCOMES), asOfUtc);
  const index = await getReportIndex();
  const seen = new Set(CALIBRATION_OUTCOMES.map((outcome) => outcome.tradeId));
  for (const item of [...index.reports].sort((a, b) => a.date.localeCompare(b.date))) {
    const report = await getReport(item.date);
    const outcomes = report.accountability.trades.filter(isResolved).filter((outcome) => !seen.has(outcome.tradeId));
    outcomes.forEach((outcome) => seen.add(outcome.tradeId));
    if (outcomes.length) snapshot = applyRealizedBasketLesson(snapshot, `archive-${item.date}`, toLessons(outcomes), asOfUtc);
  }
  const current = currentAccountability.trades.filter(isResolved).filter((outcome) => !seen.has(outcome.tradeId));
  if (current.length) snapshot = applyRealizedBasketLesson(snapshot, `current-${currentAccountability.sourceReportDate ?? "calibration"}`, toLessons(current), asOfUtc);
  return snapshot;
}

async function buildAccountability(snapshot: MarketSnapshot): Promise<OptionsReport["accountability"]> {
  const index = await getReportIndex();
  const priorItem = index.reports.find((item) => item.date < snapshot.reportDate);
  if (!priorItem) return summarizeOutcomes(CALIBRATION_OUTCOMES, "2026-06-18", snapshot.reportDate);
  const prior = await getReport(priorItem.date);
  const outcomes = prior.topTrades.map((idea): TradeOutcome => {
    if (idea.expiration >= snapshot.sessionDate) {
      return {
        tradeId: idea.id,
        name: idea.name,
        symbol: idea.symbol,
        style: idea.style,
        expiration: idea.expiration,
        status: "open",
        read: `The spread remains open through ${formatDate(idea.expiration)}; no expiration result is assigned.`
      };
    }
    const symbol = snapshot.symbols.find((item) => item.symbol === idea.symbol);
    const settlementBar = symbol?.bars.filter((bar) => bar.date <= idea.expiration).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!settlementBar) {
      return {
        tradeId: idea.id,
        name: idea.name,
        symbol: idea.symbol,
        style: idea.style,
        expiration: idea.expiration,
        status: "awaiting_close",
        read: "The expiration close is not yet present in the retained history, so the outcome remains unscored."
      };
    }
    const width = Math.abs(idea.longLeg.strike - idea.shortLeg.strike);
    const debitGross = clamp(
      payoff(settlementBar.close, idea.longLeg.strike, idea.longLeg.right) - payoff(settlementBar.close, idea.shortLeg.strike, idea.shortLeg.right),
      0,
      width
    );
    const creditLiability = clamp(
      payoff(settlementBar.close, idea.shortLeg.strike, idea.shortLeg.right) - payoff(settlementBar.close, idea.longLeg.strike, idea.longLeg.right),
      0,
      width
    );
    const rawPnl = idea.structureType === "Debit" ? (debitGross - idea.entry) * 100 : (idea.entry - creditLiability) * 100;
    const realizedPnlDollars = round(clamp(rawPnl, -idea.maxLossDollars, idea.maxProfitDollars), 2);
    const status = realizedPnlDollars > 1 ? "win" : realizedPnlDollars < -1 ? "loss" : "near_breakeven";
    const settlementValue = idea.structureType === "Debit" ? debitGross : creditLiability;
    return {
      tradeId: idea.id,
      name: idea.name,
      symbol: idea.symbol,
      style: idea.style,
      expiration: idea.expiration,
      status,
      settlementUnderlying: round(settlementBar.close, 4),
      settlementValue: round(settlementValue, 4),
      realizedPnlDollars,
      read: `${idea.symbol} closed at ${money(settlementBar.close)} for expiration settlement, producing ${money(realizedPnlDollars)} on the one-lot spread.`
    };
  });
  return summarizeOutcomes(outcomes, prior.runMetadata.reportDate, snapshot.reportDate);
}

function summarizeOutcomes(trades: TradeOutcome[], sourceReportDate: string, evaluatedThrough: string): OptionsReport["accountability"] {
  const wins = trades.filter((trade) => trade.status === "win").length;
  const losses = trades.filter((trade) => trade.status === "loss").length;
  const nearBreakeven = trades.filter((trade) => trade.status === "near_breakeven").length;
  const activelyOpen = trades.filter((trade) => trade.status === "open").length;
  const awaitingClose = trades.filter((trade) => trade.status === "awaiting_close").length;
  const open = activelyOpen + awaitingClose;
  const resolvedPnlDollars = round(trades.reduce((sum, trade) => sum + (trade.realizedPnlDollars ?? 0), 0), 2);
  const resolved = wins + losses + nearBreakeven;
  const unresolvedRead = [
    activelyOpen ? `${activelyOpen} position${activelyOpen === 1 ? " remains" : "s remain"} open.` : "",
    awaitingClose ? `${awaitingClose} expired position${awaitingClose === 1 ? " is" : "s are"} awaiting a retained expiration close before scoring.` : ""
  ].filter(Boolean).join(" ");
  const read = resolved
    ? `The ${formatDate(sourceReportDate)} basket has ${wins} win${wins === 1 ? "" : "s"}, ${nearBreakeven} near-breakeven result${nearBreakeven === 1 ? "" : "s"} and ${losses} loss${losses === 1 ? "" : "es"} across ${resolved} resolved spread${resolved === 1 ? "" : "s"}, for modeled one-lot expiration P/L of ${money(resolvedPnlDollars)}. ${unresolvedRead || "All listed positions are resolved."}`
    : unresolvedRead
      ? `The ${formatDate(sourceReportDate)} basket has no scored expiration result yet. ${unresolvedRead}`
      : `The ${formatDate(sourceReportDate)} basket has no scored expiration result yet.`;
  return { sourceReportDate, evaluatedThrough, wins, losses, nearBreakeven, open, resolvedPnlDollars, read, trades };
}

function buildExecutiveSummary(topTrades: PublishedTradeIdea[], snapshot: MarketSnapshot): OptionsReport["executiveSummary"] {
  const top = topTrades[0];
  const bullish = topTrades.filter((idea) => idea.direction === "bullish").length;
  const bearish = topTrades.length - bullish;
  const highVol = topTrades.filter((idea) => idea.realizedVolatility >= 0.65).length;
  if (!top) {
    return {
      headline: "No defined-risk option setup cleared the publication gate",
      standfirst: "The screen found quoted verticals, but none met the combined liquidity, risk and ranking threshold required for publication.",
      marketCommentary: [
        "A blank board is information. It means the price of optionality, the available liquidity and the directional signal did not line up cleanly enough to justify turning motion into a recommendation.",
        "The next edition will rerun the same universe and rules after the next valid market session. The methodology does not fill empty slots with weaker trades."
      ],
      selectionCommentary: ["Capital not committed to a weak spread remains available for a better one."],
      riskCommentary: "No trade is preferable to accepting a structurally poor entry."
    };
  }
  const second = topTrades[1];
  const averageFiveDay = average(topTrades.map((idea) => idea.fiveDayReturn));
  const minimumHistorySessions = Math.min(...topTrades.map((idea) => idea.historySessionCount));
  const fullHistoryWindow = minimumHistorySessions >= 21;
  const momentumRead = fullHistoryWindow
    ? `the mean five-session move is ${signedPct(averageFiveDay)}`
    : `the mean move across the available ${minimumHistorySessions}-session retained window is ${signedPct(averageFiveDay)}`;
  const directionRead = fullHistoryWindow
    ? "Direction comes from five- and twenty-session price structure rather than a headline guess."
    : `Direction uses the available ${minimumHistorySessions}-session retained price window with a reduced conviction weight while the full twenty-session record builds.`;
  return {
    headline: `${topTrades.length} defined-risk option setups lead the ${formatDate(snapshot.reportDate)} board`,
    standfirst: `${top.name} ranks first with a ${top.score.toFixed(2)} score, ${pct(top.probabilityProfit)} modeled probability of profit and ${money(top.maxLossDollars)} maximum one-lot risk. The basket balances ${bullish} bullish and ${bearish} bearish expression${topTrades.length === 1 ? "" : "s"}.`,
    marketCommentary: [
      `The option board is not rewarding indiscriminate beta. Across the published names, ${momentumRead}, while ${highVol} setup${highVol === 1 ? " carries" : "s carry"} realized volatility above 65%. That combination favors defined-risk structures and hard entry limits over naked premium exposure.`,
      `The screen begins with ${snapshot.universe.length} liquid underlyings and accepts only same-session chains with two usable legs. It then forces every idea through the same conservative mark: pay the ask for the long option and receive the bid for the short. The resulting ranking is intentionally harsher than a midpoint screen, because a trade that only works at a theoretical fill is not a durable public idea.`,
      `${directionRead} That keeps the daily board responsive to what is actually trading while the scenario engine still reserves room for jumps, volatility expansion and path-dependent failure. The result is a short list, not a promise that every liquid ticker deserves a trade.`
    ],
    selectionCommentary: [
      `${top.symbol} wins the top slot because liquidity, directional alignment and bounded payoff reinforce one another. Its ${top.structureType.toLowerCase()} entry of ${top.entry.toFixed(2)} creates ${top.rewardToRisk.toFixed(2)} dollars of maximum reward for each dollar of maximum risk, with breakeven at ${money(top.breakeven)}.`,
      second
        ? `${second.symbol} supplies the counterweight. Its ${second.style.replaceAll("_", " ")} structure scores ${second.score.toFixed(2)} and carries ${money(second.maxLossDollars)} of one-lot maximum loss. The basket is therefore ranked as a portfolio of explicit risks, not as five unrelated ticker calls.`
        : "Only one setup cleared the full gate, so the edition publishes one rather than lowering the bar."
    ],
    riskCommentary: `The basket's maximum losses are additive if every thesis fails. Quote slippage, early assignment and volatility repricing can also change the practical outcome before expiration, so the published entry is a ceiling for debits and a floor for credits, not an assurance of execution.`
  };
}

function buildTradeCommentary(idea: TradeIdeaScore): TradeCommentary {
  const convictionLabel = idea.bucket === "top_candidate" ? "Highest-conviction screen" : idea.bucket === "watchlist" ? "Actionable watch" : "Trigger-dependent setup";
  const evRead = idea.expectedValueDollars >= 0
    ? `positive modeled expectancy of ${money(idea.expectedValueDollars)}`
    : `a conservative modeled expectancy of ${money(idea.expectedValueDollars)}, which keeps sizing discipline central`;
  const risks = idea.riskFlags.length ? idea.riskFlags.join("; ") : "a directional break before expiration";
  const longAction = `Buy the ${formatStrike(idea.longLeg.strike)} ${idea.longLeg.right === "C" ? "call" : "put"}`;
  const shortAction = `sell the ${formatStrike(idea.shortLeg.strike)} ${idea.shortLeg.right === "C" ? "call" : "put"}`;
  const entryDiscipline = idea.structureType === "Debit"
    ? `Do not pay more than ${idea.entry.toFixed(2)} for the spread without rerunning the payoff.`
    : `Do not accept less than ${idea.entry.toFixed(2)} of credit without rerunning the payoff.`;
  const breakevenAboveSpot = idea.breakeven >= idea.underlyingMark;
  const moveMagnitude = Math.abs(idea.requiredMovePctToBreakeven).toFixed(1);
  const moveRead = idea.direction === "bullish"
    ? breakevenAboveSpot
      ? `requires a ${moveMagnitude}% rise from the source mark`
      : `sits ${moveMagnitude}% below the source mark, providing a downside cushion`
    : breakevenAboveSpot
      ? `sits ${moveMagnitude}% above the source mark, providing an upside cushion`
      : `requires a ${moveMagnitude}% decline from the source mark`;
  const momentumSetup = idea.historySessionCount >= 21
    ? `${signedPct(idea.fiveDayReturn)} five-session momentum and ${signedPct(idea.twentyDayReturn)} over twenty sessions`
    : `${signedPct(idea.fiveDayReturn)} across the available ${idea.historySessionCount}-session retained window, with a reduced conviction weight until the full history builds`;
  return {
    convictionLabel,
    rankingRead: `The setup scores ${idea.score.toFixed(2)} on the common scale, supported by ${pct(idea.probabilityProfit)} modeled probability of profit, ${idea.liquidityScore.toFixed(2)} liquidity quality and ${evRead}.`,
    setup: `${idea.symbol} enters with ${momentumSetup}. Realized volatility is ${pct(idea.realizedVolatility)}, placing the underlying in a ${idea.regime.replaceAll("_", " ")} regime. The ${idea.direction} structure expresses that tape without allowing the loss to expand beyond the spread debit or defined credit width.`,
    execution: `${longAction} and ${shortAction}, both expiring ${formatDate(idea.expiration)}. The ${idea.structureType.toLowerCase()} mark of ${idea.entry.toFixed(2)} assumes the long ask and short bid, not a midpoint. ${entryDiscipline}`,
    risk: `Maximum one-lot loss is ${money(idea.maxLossDollars)}. Breakeven is ${money(idea.breakeven)} and ${moveRead}. Primary watch: ${risks}. A break in the stated directional regime invalidates the reason for holding even when the contractual maximum loss remains unchanged.`,
    payoffRead: `Maximum one-lot profit is ${money(idea.maxProfitDollars)}, or ${idea.rewardToRisk.toFixed(2)} times maximum risk. The simulation assigns ${pct(idea.probabilityNearMaxProfit)} probability to finishing near maximum profit and uses ${pct(idea.impliedVolUsed)} implied volatility across deterministic jump-stress paths.`
  };
}

function buildAnalytics(topTrades: PublishedTradeIdea[]): OptionsReport["analytics"] {
  return {
    publishedIdeaCount: topTrades.length,
    topScore: topTrades[0]?.score ?? 0,
    averageProbabilityProfit: average(topTrades.map((idea) => idea.probabilityProfit)),
    totalExpectedValueDollars: round(topTrades.reduce((sum, idea) => sum + idea.expectedValueDollars, 0), 2),
    totalMaxLossDollars: round(topTrades.reduce((sum, idea) => sum + idea.maxLossDollars, 0), 2),
    totalMaxProfitDollars: round(topTrades.reduce((sum, idea) => sum + idea.maxProfitDollars, 0), 2),
    debitIdeaCount: topTrades.filter((idea) => idea.structureType === "Debit").length,
    creditIdeaCount: topTrades.filter((idea) => idea.structureType === "Credit").length
  };
}

function toLessons(outcomes: TradeOutcome[]): RealizedTradeOutcome[] {
  return outcomes.filter(isResolved).map((outcome) => ({
    id: outcome.tradeId,
    style: outcome.style,
    realizedPnlDollars: outcome.realizedPnlDollars ?? 0,
    wasWinner: (outcome.realizedPnlDollars ?? 0) > 0
  }));
}

function isResolved(outcome: TradeOutcome) {
  return outcome.realizedPnlDollars !== undefined && ["win", "loss", "near_breakeven"].includes(outcome.status);
}

function compareIdeas(a: TradeIdeaScore, b: TradeIdeaScore) {
  return b.score - a.score || b.expectedValueDollars - a.expectedValueDollars || a.id.localeCompare(b.id);
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, places: number) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function signedPct(value: number) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function money(value: number) {
  const prefix = value < 0 ? "-$" : "$";
  return `${prefix}${Math.abs(value).toFixed(2)}`;
}

function formatStrike(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/u, "").replace(/\.$/u, "");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(new Date(value));
}
