import { createHash } from "node:crypto";
import type { AdvancedFeatureName, AdvancedMarketMetrics, TradeIdeaScore } from "@/lib/model/types";
import type { OptionsReport } from "@/lib/report/types";
import type { SelectionPolicy, TrainingExample } from "@/lib/training/types";

const FEATURE_NAMES: AdvancedFeatureName[] = [
  "trendAlignment",
  "meanReversion",
  "volatilityQuality",
  "optionsSkew",
  "liquidity",
  "riskAdjustedMomentum"
];

export function trainSelectionPolicy(
  reports: OptionsReport[],
  trainedAtUtc: string,
  trainingThroughDate: string
): SelectionPolicy {
  const examples = collectTrainingExamples(reports);
  const minimumTrainingSamples = envNumber("TRAINING_MIN_RESOLVED_TRADES", 8);
  const regularization = envNumber("TRAINING_RIDGE_REGULARIZATION", 2);
  const maximumScoreAdjustment = envNumber("TRAINING_MAX_SCORE_ADJUSTMENT", 8);
  const featureStats = emptyFeatureRecord(() => ({ sampleCount: examples.length, sumX2: 0, sumXY: 0, coefficient: 0 }));

  for (const example of examples) {
    for (const name of FEATURE_NAMES) {
      const value = example.features[name];
      featureStats[name].sumX2 += value * value;
      featureStats[name].sumXY += value * example.targetReturnOnRisk;
    }
  }
  for (const name of FEATURE_NAMES) {
    const stat = featureStats[name];
    stat.sumX2 = round(stat.sumX2, 6);
    stat.sumXY = round(stat.sumXY, 6);
    stat.coefficient = round(clamp(stat.sumXY / (regularization + stat.sumX2), -0.35, 0.35), 6);
  }
  const active = examples.length >= minimumTrainingSamples;
  const featureWeights = emptyFeatureRecord((name) => active ? featureStats[name].coefficient : 0);
  const sourceReportIds = reports
    .filter((report) => report.postTradeReview?.status === "complete" && report.topTrades.some((idea) => Boolean(idea.advancedMetrics)))
    .map((report) => report.reportId)
    .sort();

  return {
    schemaVersion: "1.0",
    policyVersion: "rfdelta-online-policy-v1",
    trainedAtUtc,
    trainingThroughDate,
    resolvedTradeCount: examples.length,
    minimumTrainingSamples,
    active,
    regularization,
    maximumScoreAdjustment,
    featureWeights,
    featureStats,
    sourceReportIds
  };
}

export function collectTrainingExamples(reports: OptionsReport[]): TrainingExample[] {
  const examples: TrainingExample[] = [];
  for (const report of [...reports].sort((a, b) => a.runMetadata.reportDate.localeCompare(b.runMetadata.reportDate))) {
    const review = report.postTradeReview;
    if (!review || review.status !== "complete") continue;
    for (const outcome of review.trades) {
      if (outcome.realizedPnlDollars === undefined) continue;
      const idea = report.topTrades.find((candidate) => candidate.id === outcome.tradeId);
      if (!idea?.advancedMetrics) continue;
      examples.push({
        tradeId: idea.id,
        reportDate: report.runMetadata.reportDate,
        style: idea.style,
        direction: idea.direction,
        targetReturnOnRisk: round(clamp(outcome.realizedPnlDollars / Math.max(idea.maxLossDollars, 1), -1, 1), 6),
        features: buildFeatureVector(idea.advancedMetrics, idea.direction)
      });
    }
  }
  return examples.sort((a, b) => a.reportDate.localeCompare(b.reportDate) || a.tradeId.localeCompare(b.tradeId));
}

export function getPolicyScoreAdjustment(
  policy: SelectionPolicy,
  metrics: AdvancedMarketMetrics | undefined,
  direction: TradeIdeaScore["direction"]
) {
  if (!policy.active || !metrics) return 0;
  const vector = buildFeatureVector(metrics, direction);
  const raw = FEATURE_NAMES.reduce((sum, name) => sum + policy.featureWeights[name] * vector[name], 0) * 12;
  return round(clamp(raw, -policy.maximumScoreAdjustment, policy.maximumScoreAdjustment), 2);
}

export function selectionPolicyHash(policy: SelectionPolicy) {
  return createHash("sha256").update(JSON.stringify(policy)).digest("hex");
}

export function buildFeatureVector(metrics: AdvancedMarketMetrics, direction: "bullish" | "bearish"): Record<AdvancedFeatureName, number> {
  const directionSign = direction === "bullish" ? 1 : -1;
  return {
    trendAlignment: round(clamp(metrics.trendSignal * directionSign, -1, 1), 6),
    meanReversion: round(clamp((-metrics.bollingerZ20 / 3) * directionSign, -1, 1) * metrics.historyConfidence, 6),
    volatilityQuality: round(clamp(1 - metrics.realizedVol20 / 0.9, -1, 1) * metrics.historyConfidence, 6),
    optionsSkew: round(clamp((-metrics.putCallIvSkew / 0.25) * directionSign, -1, 1), 6),
    liquidity: round(clamp(metrics.liquidContractRatio * 2 - 1, -1, 1), 6),
    riskAdjustedMomentum: round(clamp(metrics.riskAdjustedMomentum * directionSign, -1, 1), 6)
  };
}

function emptyFeatureRecord<T>(factory: (name: AdvancedFeatureName) => T): Record<AdvancedFeatureName, T> {
  return Object.fromEntries(FEATURE_NAMES.map((name) => [name, factory(name)])) as Record<AdvancedFeatureName, T>;
}

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function round(value: number, places: number) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
