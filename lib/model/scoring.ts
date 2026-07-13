import { LessonSnapshot, TradeCandidate, TradeIdeaScore } from "@/lib/model/types";
import { ModelSettings } from "@/lib/model/settings";
import { getBreakeven, getEntryWidth, runCandidateSimulation } from "@/lib/model/simulation";
import { explainLessonAdjustment, getStylePosteriorAdjustment } from "@/lib/model/lessonLearning";

export function scoreCandidate(
  candidate: TradeCandidate,
  settings: ModelSettings,
  lessons: LessonSnapshot
): TradeIdeaScore {
  const entryWidth = getEntryWidth(candidate);
  const sim = runCandidateSimulation(candidate, settings);
  const breakeven = getBreakeven(candidate, entryWidth.entry);
  const rewardToRisk =
    entryWidth.maxLoss > 0 ? entryWidth.maxProfit / entryWidth.maxLoss : 0;

  const riskFlags: string[] = [];
  const creditToWidth = candidate.structureType === "Credit"
    ? entryWidth.entry / Math.max(entryWidth.width, 0.01)
    : 0;

  if (candidate.structureType === "Credit" && creditToWidth < settings.minCreditReceivedWidthPct) {
    riskFlags.push("credit below width threshold");
  }

  if (
    candidate.style === "put_credit" &&
    candidate.shortLeg.strike >= candidate.underlyingMark
  ) {
    riskFlags.push("short strike at/above spot");
  }

  if (sim.blackScholesEdge < -0.05) {
    riskFlags.push("negative conservative BS edge");
  }

  if (candidate.structureType === "Debit" && sim.probabilityProfit < settings.minProfitProbabilityDebit) {
    riskFlags.push("low debit probability");
  }

  if (candidate.structureType === "Credit" && sim.probabilityProfit < settings.minProfitProbabilityCredit) {
    riskFlags.push("low credit probability");
  }

  if ((candidate.realizedVolatility ?? 0) >= 0.8) {
    riskFlags.push("elevated gap and volatility risk");
  }

  if (candidate.daysToExpiry <= 5) {
    riskFlags.push("short-dated gamma risk");
  }

  if (candidate.style === "call_credit" && candidate.shortLeg.strike <= candidate.underlyingMark) {
    riskFlags.push("call short strike at/below spot");
  }

  if (entryWidth.maxLoss * 100 > settings.maxSingleTradeRiskDollars) {
    riskFlags.push("max single-trade risk exceeded");
  }

  const evEff = clamp(sim.expectedValueDollars / Math.max(entryWidth.maxLoss * 100, 1), -1, 1);
  const rrEff = clamp(rewardToRisk / 5, 0, 1);
  const edgeEff = clamp(sim.blackScholesEdge / Math.max(entryWidth.maxLoss, 0.01), -1, 1);
  const posteriorAdjustment = getStylePosteriorAdjustment(lessons, candidate.style);
  const signalStrength = clamp(candidate.signalStrength ?? 0.5, 0, 1);

  let score =
    100 *
      (0.26 * sim.probabilityProfit +
        0.22 * Math.max(0, evEff) +
        0.14 * rrEff +
        0.18 * candidate.liquidityScore +
        0.10 * Math.max(0, edgeEff) +
        0.10 * signalStrength) +
    posteriorAdjustment;

  if (candidate.structureType === "Credit") {
    score += settings.creditSpreadPriorBoost * 20;
    if (creditToWidth >= settings.minCreditReceivedWidthPct) score += 5;
    if (candidate.style === "put_credit" && candidate.shortLeg.strike < candidate.underlyingMark) {
      score += 4;
    }
  }

  if (candidate.structureType === "Debit" && rewardToRisk > 4 && sim.probabilityProfit < 0.3) {
    score -= settings.debitLotteryPenalty * 20;
  }

  if (riskFlags.includes("short strike at/above spot")) score -= 10;
  if (riskFlags.includes("negative conservative BS edge")) score -= 8;
  if (riskFlags.includes("credit below width threshold")) score -= 6;

  let bucket: TradeIdeaScore["bucket"] = "reject";
  const evRiskRatio = sim.expectedValueDollars / Math.max(entryWidth.maxLoss * 100, 1);
  if (score >= 58 && sim.expectedValueDollars > 0 && severeRiskCount(riskFlags) === 0) {
    bucket = "top_candidate";
  } else if (score >= 45 && evRiskRatio >= -0.15 && severeRiskCount(riskFlags) === 0) {
    bucket = "watchlist";
  } else if (score >= 32 && evRiskRatio >= -0.2 && severeRiskCount(riskFlags) === 0) {
    bucket = "conditional";
  }

  const idea: TradeIdeaScore = {
    rank: 0,
    id: candidate.id,
    name: candidate.name,
    symbol: candidate.symbol,
    underlyingMark: round(candidate.underlyingMark, 4),
    expiration: candidate.expiration,
    daysToExpiry: candidate.daysToExpiry,
    structureType: candidate.structureType,
    style: candidate.style,
    direction: candidate.direction ?? (candidate.style === "call_debit" || candidate.style === "put_credit" ? "bullish" : "bearish"),
    theme: candidate.theme,
    regime: candidate.regime,
    correlationBucket: candidate.correlationBucket ?? candidate.theme,
    bucket,
    entry: round(entryWidth.entry, 4),
    width: round(entryWidth.width, 4),
    maxLossDollars: round(entryWidth.maxLoss * 100, 2),
    maxProfitDollars: round(entryWidth.maxProfit * 100, 2),
    rewardToRisk: round(rewardToRisk, 2),
    breakeven: round(breakeven, 4),
    requiredMovePctToBreakeven: round(((breakeven / candidate.underlyingMark) - 1) * 100, 2),
    probabilityProfit: round(sim.probabilityProfit, 4),
    probabilityNearMaxProfit: round(sim.probabilityNearMaxProfit, 4),
    expectedValueDollars: round(sim.expectedValueDollars, 2),
    blackScholesEdge: round(sim.blackScholesEdge, 4),
    impliedVolUsed: round(sim.impliedVolUsed, 4),
    liquidityScore: round(candidate.liquidityScore, 4),
    score: round(score, 2),
    riskFlags,
    thesis: candidate.thesis,
    longLeg: candidate.longLeg,
    shortLeg: candidate.shortLeg,
    ...(candidate.sourceAsOfUtc ? { sourceAsOfUtc: candidate.sourceAsOfUtc } : {}),
    marketEvidence: candidate.marketEvidence ?? [],
    historySessionCount: candidate.historySessionCount ?? 0,
    fiveDayReturn: round(candidate.fiveDayReturn ?? 0, 6),
    twentyDayReturn: round(candidate.twentyDayReturn ?? 0, 6),
    realizedVolatility: round(candidate.realizedVolatility ?? 0, 6),
    lessonAdjustments: []
  };

  idea.lessonAdjustments = explainLessonAdjustment(lessons, idea);
  return idea;
}

function severeRiskCount(flags: string[]): number {
  return flags.filter((x) =>
    [
      "max single-trade risk exceeded",
      "credit below width threshold",
      "short strike at/above spot",
      "call short strike at/below spot"
    ].includes(x)
  ).length;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function round(x: number, places: number): number {
  const m = 10 ** places;
  return Math.round(x * m) / m;
}
