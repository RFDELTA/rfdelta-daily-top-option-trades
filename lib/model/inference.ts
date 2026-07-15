import { normCdf } from "@/lib/model/math";
import type { ModelSettings } from "@/lib/model/settings";
import type { SimulationResult } from "@/lib/model/simulation";
import type { CandidateInference, InferenceModelResult, TradeCandidate } from "@/lib/model/types";

type EntryWidth = {
  entry: number;
  width: number;
  maxLoss: number;
  maxProfit: number;
};

export function inferCandidate(
  candidate: TradeCandidate,
  simulation: SimulationResult,
  entryWidth: EntryWidth,
  breakeven: number,
  settings: ModelSettings
): CandidateInference {
  const requiredProbability = payoffRequiredProbability(entryWidth);
  const directionSign = candidate.direction === "bearish" ? -1 : 1;
  const metrics = candidate.advancedMetrics;
  const sessionMove = metrics?.return1d ?? candidate.fiveDayReturn ?? 0;
  const sessionStrength = clamp(directionSign * sessionMove / Math.max(settings.minSessionConfirmationMovePct * 4, 0.0001), -1, 1);
  const sessionConfirmation = directionSign * sessionMove >= settings.minSessionConfirmationMovePct;
  const horizonReturns = [
    metrics?.return5d ?? candidate.fiveDayReturn ?? 0,
    metrics?.return15d ?? metrics?.macdPct ?? metrics?.return20d ?? candidate.twentyDayReturn ?? 0,
    metrics?.return60d ?? metrics?.return20d ?? candidate.twentyDayReturn ?? 0
  ];
  const multiHorizonAlignment = horizonReturns.filter((value) => directionSign * value > 0).length / horizonReturns.length;
  const expectedMovePct = metrics?.expectedMovePct && metrics.expectedMovePct > 0
    ? metrics.expectedMovePct
    : simulation.impliedVolUsed * Math.sqrt(Math.max(candidate.daysToExpiry, 1) / 365);
  const requiredDirectionalMove = candidate.direction === "bearish"
    ? Math.max(0, 1 - breakeven / candidate.underlyingMark)
    : Math.max(0, breakeven / candidate.underlyingMark - 1);
  const expectedMoveCoverage = clamp(1 - requiredDirectionalMove / Math.max(expectedMovePct, 0.0001), 0, 1);
  const marketImpliedProbability = terminalProbability(candidate, breakeven, simulation.impliedVolUsed, settings.riskFreeRate);
  const regimeProbability = clamp(
    marketImpliedProbability + (multiHorizonAlignment - 0.5) * 0.06 + sessionStrength * 0.015,
    0.01,
    0.99
  );
  const fatTailProbability = clamp(
    Math.min(simulation.probabilityProfit, marketImpliedProbability) - settings.jumpShockProbability * 0.2 - Math.max(0, (candidate.realizedVolatility ?? 0) - 0.8) * 0.02,
    0.01,
    0.99
  );
  const modelResults = [
    model("jump_stress", simulation.probabilityProfit, entryWidth),
    model("market_implied", marketImpliedProbability, entryWidth),
    model("shrunk_regime", regimeProbability, entryWidth),
    model("fat_tail", fatTailProbability, entryWidth)
  ];
  const consensusProbability = median(modelResults.map((result) => result.probability));
  const probabilityMargin = consensusProbability - requiredProbability;
  const positiveModelCount = modelResults.filter((result) => result.positive).length;
  const conservativeExpectedValueDollars = Math.min(...modelResults.map((result) => result.expectedValueDollars));
  const selectionFrequencyUnderPerturbation = perturbationFrequency(modelResults, requiredProbability, entryWidth, settings);
  const scenarioStability = clamp(
    selectionFrequencyUnderPerturbation * 0.6 + (positiveModelCount / modelResults.length) * 0.25 + candidate.liquidityScore * 0.15,
    0,
    1
  );
  const twoSidedQuotes = [candidate.longLeg, candidate.shortLeg].every((leg) => leg.bid > 0 && leg.ask > leg.bid);
  const completeLegData = [candidate.longLeg, candidate.shortLeg].every((leg) =>
    typeof leg.volume === "number" && leg.volume >= 0 &&
    typeof leg.openInterest === "number" && leg.openInterest > 0 &&
    Boolean(leg.quoteTimeUtc)
  ) && [
    simulation.longImpliedVol,
    simulation.shortImpliedVol,
    simulation.longDelta,
    simulation.shortDelta
  ].every(Number.isFinite);
  const eligibilityScore = inferenceScore({
    probabilityMargin,
    conservativeExpectedValueDollars,
    maxLossDollars: entryWidth.maxLoss * 100,
    liquidityScore: candidate.liquidityScore,
    multiHorizonAlignment,
    expectedMoveCoverage,
    scenarioStability
  });
  const hardGateFailures = gateFailures({
    entryWidth,
    eligibilityScore,
    positiveModelCount,
    probabilityMargin,
    conservativeExpectedValueDollars,
    liquidityScore: candidate.liquidityScore,
    multiHorizonAlignment,
    sessionConfirmation,
    twoSidedQuotes,
    completeLegData,
    settings
  });
  const eligibleBeforeSessionGate = hardGateFailures.every((failure) => failure === "session_confirmation_failed");
  const publicationEligible = hardGateFailures.length === 0;

  return {
    inferenceVersion: "rfdelta-inference-v3",
    eligibilityScore: round(eligibilityScore, 2),
    requiredProbability: round(requiredProbability, 6),
    consensusProbability: round(consensusProbability, 6),
    probabilityMargin: round(probabilityMargin, 6),
    positiveModelCount,
    conservativeExpectedValueDollars: round(conservativeExpectedValueDollars, 2),
    expectedMoveCoverage: round(expectedMoveCoverage, 6),
    multiHorizonAlignment: round(multiHorizonAlignment, 6),
    sessionConfirmation,
    scenarioStability: round(scenarioStability, 6),
    selectionFrequencyUnderPerturbation: round(selectionFrequencyUnderPerturbation, 6),
    twoSidedQuotes,
    completeLegData,
    modelResults,
    hardGateFailures,
    eligibleBeforeSessionGate,
    publicationEligible
  };
}

export function payoffRequiredProbability(entryWidth: EntryWidth) {
  if (entryWidth.width <= 0 || entryWidth.entry <= 0 || entryWidth.entry >= entryWidth.width) return 1;
  return entryWidth.maxLoss / Math.max(entryWidth.maxLoss + entryWidth.maxProfit, 0.0001);
}

function model(name: InferenceModelResult["name"], probability: number, entryWidth: EntryWidth): InferenceModelResult {
  const normalizedProbability = clamp(probability, 0, 1);
  const expectedValueDollars = expectedValue(normalizedProbability, entryWidth);
  return {
    name,
    probability: round(normalizedProbability, 6),
    expectedValueDollars: round(expectedValueDollars, 2),
    positive: expectedValueDollars >= 0
  };
}

function terminalProbability(candidate: TradeCandidate, breakeven: number, sigma: number, riskFreeRate: number) {
  const t = Math.max(candidate.daysToExpiry / 365, 1 / 365);
  const denominator = Math.max(sigma * Math.sqrt(t), 0.000001);
  const z = (Math.log(Math.max(breakeven, 0.01) / candidate.underlyingMark) - (riskFreeRate - 0.5 * sigma * sigma) * t) / denominator;
  return candidate.direction === "bearish" ? normCdf(z) : 1 - normCdf(z);
}

function expectedValue(probability: number, entryWidth: EntryWidth) {
  return (probability * entryWidth.maxProfit - (1 - probability) * entryWidth.maxLoss) * 100;
}

function perturbationFrequency(models: InferenceModelResult[], requiredProbability: number, entryWidth: EntryWidth, settings: ModelSettings) {
  const shifts = [-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03];
  const passing = shifts.filter((shift) => {
    const probabilities = models.map((result) => clamp(result.probability + shift, 0, 1));
    const positive = probabilities.filter((probability) => expectedValue(probability, entryWidth) >= settings.minConservativeExpectedValueDollars).length;
    return positive >= settings.minPositiveModels && median(probabilities) >= requiredProbability;
  }).length;
  return passing / shifts.length;
}

function inferenceScore(args: {
  probabilityMargin: number;
  conservativeExpectedValueDollars: number;
  maxLossDollars: number;
  liquidityScore: number;
  multiHorizonAlignment: number;
  expectedMoveCoverage: number;
  scenarioStability: number;
}) {
  const probabilityQuality = clamp(0.5 + args.probabilityMargin / 0.2, 0, 1);
  const evRiskRatio = args.conservativeExpectedValueDollars / Math.max(args.maxLossDollars, 1);
  const expectedValueQuality = clamp(0.5 + evRiskRatio / 0.4, 0, 1);
  const marginQuality = clamp(args.probabilityMargin / 0.1, 0, 1);
  return 100 * (
    0.20 * probabilityQuality +
    0.20 * expectedValueQuality +
    0.15 * marginQuality +
    0.15 * args.liquidityScore +
    0.12 * args.multiHorizonAlignment +
    0.08 * args.expectedMoveCoverage +
    0.10 * args.scenarioStability
  );
}

function gateFailures(args: {
  entryWidth: EntryWidth;
  eligibilityScore: number;
  positiveModelCount: number;
  probabilityMargin: number;
  conservativeExpectedValueDollars: number;
  liquidityScore: number;
  multiHorizonAlignment: number;
  sessionConfirmation: boolean;
  twoSidedQuotes: boolean;
  completeLegData: boolean;
  settings: ModelSettings;
}) {
  const failures: string[] = [];
  if (args.entryWidth.width <= 0 || args.entryWidth.entry <= 0 || args.entryWidth.entry >= args.entryWidth.width) failures.push("invalid_natural_price_or_width");
  if (!args.twoSidedQuotes) failures.push("missing_two_sided_quotes");
  if (args.eligibilityScore < args.settings.minPublicationScore) failures.push("score_below_threshold");
  if (args.conservativeExpectedValueDollars < args.settings.minConservativeExpectedValueDollars) failures.push("negative_conservative_ev");
  if (args.positiveModelCount < args.settings.minPositiveModels) failures.push("insufficient_positive_models");
  if (args.probabilityMargin < args.settings.minProbabilityMargin) failures.push("insufficient_probability_margin");
  if (args.liquidityScore < args.settings.minLiquidityScore) failures.push("liquidity_below_threshold");
  if (args.settings.requireCompleteLegData && !args.completeLegData) failures.push("incomplete_greeks_open_interest_or_volume");
  if (args.multiHorizonAlignment < args.settings.minMultiHorizonAlignment) failures.push("multi_horizon_confirmation_failed");
  if (args.settings.requireSessionConfirmation && !args.sessionConfirmation) failures.push("session_confirmation_failed");
  return failures;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] ?? 0 : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function round(value: number, places: number) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
