import type { AdvancedFeatureName, AdvancedMarketMetrics, SpreadStyle, TradeIdeaScore } from "@/lib/model/types";
import type { HistoricalDataProvenance, OptionChainSelection } from "@/lib/market/types";

export type MarketFeatureDataset = {
  schemaVersion: "1.0";
  featureVersion: "rfdelta-market-features-v1";
  reportDate: string;
  dataAsOfUtc: string;
  sourceFingerprint?: string;
  historicalData?: HistoricalDataProvenance;
  chainSelection?: OptionChainSelection;
  symbols: AdvancedMarketMetrics[];
};

export type TrainingExample = {
  tradeId: string;
  reportDate: string;
  style: SpreadStyle;
  direction: "bullish" | "bearish";
  targetReturnOnRisk: number;
  features: Record<AdvancedFeatureName, number>;
};

export type FeatureTrainingStat = {
  sampleCount: number;
  sumX2: number;
  sumXY: number;
  coefficient: number;
};

export type SelectionPolicy = {
  schemaVersion: "1.0";
  policyVersion: "rfdelta-online-policy-v1";
  trainedAtUtc: string;
  trainingThroughDate: string;
  resolvedTradeCount: number;
  minimumTrainingSamples: number;
  active: boolean;
  regularization: number;
  maximumScoreAdjustment: number;
  featureWeights: Record<AdvancedFeatureName, number>;
  featureStats: Record<AdvancedFeatureName, FeatureTrainingStat>;
  sourceReportIds: string[];
};

export type DatasetManifest = {
  schemaVersion: "1.0";
  runId: string;
  reportDate: string;
  reportId: string;
  dataAsOfUtc: string;
  sourceFingerprint?: string;
  historicalProvider?: HistoricalDataProvenance["provider"];
  historicalCoverageRatio?: number;
  historicalBarCount?: number;
  chainSelectionVersion?: OptionChainSelection["strategyVersion"];
  quotedSymbolCount?: number;
  chainSymbolCount?: number;
  featureVersion: MarketFeatureDataset["featureVersion"];
  policyVersion: SelectionPolicy["policyVersion"];
  trainingSampleCount: number;
  universeCount: number;
  includedSymbolCount: number;
  candidateCount: number;
  selectedIdeaCount: number;
  featureDatasetHash: string;
  candidateDatasetHash: string;
  selectionPolicyHash: string;
};

export type CandidateDataset = {
  schemaVersion: "1.0";
  runId: string;
  reportDate: string;
  candidates: TradeIdeaScore[];
};
