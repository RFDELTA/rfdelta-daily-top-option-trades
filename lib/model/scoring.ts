import { LessonSnapshot, TradeCandidate, TradeIdeaScore } from "@/lib/model/types";
import { ModelSettings } from "@/lib/model/settings";
import { getBreakeven, getEntryWidth, runCandidateSimulation } from "@/lib/model/simulation";
import { inferCandidate } from "@/lib/model/inference";
import { explainLessonAdjustment, getStylePosteriorAdjustment } from "@/lib/model/lessonLearning";
import { getPolicyScoreAdjustment } from "@/lib/training/policy";
import type { SelectionPolicy } from "@/lib/training/types";

export function scoreCandidate(
  candidate: TradeCandidate,
  settings: ModelSettings,
  lessons: LessonSnapshot,
  policy?: SelectionPolicy
): TradeIdeaScore {
  const entryWidth = getEntryWidth(candidate);
  const sim = runCandidateSimulation(candidate, settings);
  const breakeven = getBreakeven(candidate, entryWidth.entry);
  const inference = inferCandidate(candidate, sim, entryWidth, breakeven, settings);
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

  const posteriorAdjustment = getStylePosteriorAdjustment(lessons, candidate.style);
  const direction = candidate.direction ?? (candidate.style === "call_debit" || candidate.style === "put_credit" ? "bullish" : "bearish");
  const trainingAdjustment = policy ? getPolicyScoreAdjustment(policy, candidate.advancedMetrics, direction) : 0;
  const score = clamp(inference.eligibilityScore + posteriorAdjustment + trainingAdjustment, 0, 100);
  const bucket: TradeIdeaScore["bucket"] = inference.publicationEligible
    ? "top_candidate"
    : inference.eligibleBeforeSessionGate
      ? "watchlist"
      : inference.hardGateFailures.length <= 2 && inference.eligibilityScore >= settings.minPublicationScore - 10
        ? "conditional"
        : "reject";

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
    direction,
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
    probabilityProfit: round(inference.consensusProbability, 4),
    probabilityNearMaxProfit: round(sim.probabilityNearMaxProfit, 4),
    expectedValueDollars: round(inference.conservativeExpectedValueDollars, 2),
    blackScholesEdge: round(sim.blackScholesEdge, 4),
    impliedVolUsed: round(sim.impliedVolUsed, 4),
    liquidityScore: round(candidate.liquidityScore, 4),
    score: round(score, 2),
    inference,
    publicationEligible: inference.publicationEligible,
    riskFlags,
    thesis: candidate.thesis,
    longLeg: {
      ...candidate.longLeg,
      impliedVolatility: candidate.longLeg.impliedVolatility ?? round(sim.longImpliedVol, 6),
      delta: candidate.longLeg.delta ?? round(sim.longDelta, 6)
    },
    shortLeg: {
      ...candidate.shortLeg,
      impliedVolatility: candidate.shortLeg.impliedVolatility ?? round(sim.shortImpliedVol, 6),
      delta: candidate.shortLeg.delta ?? round(sim.shortDelta, 6)
    },
    ...(candidate.sourceAsOfUtc ? { sourceAsOfUtc: candidate.sourceAsOfUtc } : {}),
    marketEvidence: candidate.marketEvidence ?? [],
    historySessionCount: candidate.historySessionCount ?? 0,
    ...(candidate.advancedMetrics ? { advancedMetrics: candidate.advancedMetrics } : {}),
    trainingAdjustment,
    trainingPolicyVersion: policy?.policyVersion ?? "untrained-baseline",
    fiveDayReturn: round(candidate.fiveDayReturn ?? 0, 6),
    twentyDayReturn: round(candidate.twentyDayReturn ?? 0, 6),
    realizedVolatility: round(candidate.realizedVolatility ?? 0, 6),
    lessonAdjustments: []
  };

  idea.lessonAdjustments = explainLessonAdjustment(lessons, idea);
  return idea;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function round(x: number, places: number): number {
  const m = 10 ** places;
  return Math.round(x * m) / m;
}
