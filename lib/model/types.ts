export type SpreadStyle =
  | "call_debit"
  | "put_debit"
  | "put_credit"
  | "call_credit";

export type StructureType = "Debit" | "Credit";

export type RegimeLabel =
  | "trend"
  | "mean_reversion"
  | "vol_expansion"
  | "risk_off"
  | "risk_on"
  | "mixed";

export type OptionLeg = {
  optionSymbol?: string;
  right: "C" | "P";
  strike: number;
  bid: number;
  ask: number;
  mid: number;
  volume?: number;
  openInterest?: number;
  delta?: number;
  impliedVolatility?: number;
  quoteTimeUtc?: string;
};

export type AdvancedFeatureName =
  | "trendAlignment"
  | "meanReversion"
  | "volatilityQuality"
  | "optionsSkew"
  | "liquidity"
  | "riskAdjustedMomentum";

export type AdvancedMarketMetrics = {
  symbol: string;
  historySessions: number;
  historyConfidence: number;
  return1d: number;
  return5d: number;
  return15d: number;
  return20d: number;
  return60d: number;
  sma5Distance: number;
  sma20Distance: number;
  emaTrend: number;
  macdPct: number;
  rsi14: number;
  atr14Pct: number;
  bollingerZ20: number;
  realizedVol5: number;
  realizedVol20: number;
  downsideVol20: number;
  maxDrawdown20: number;
  trendEfficiency20: number;
  volumeZScore20: number;
  atmImpliedVol: number;
  putCallIvSkew: number;
  putCallVolumeRatio: number;
  putCallOpenInterestRatio: number;
  expectedMovePct: number;
  meanQuoteWidthPct: number;
  liquidContractRatio: number;
  trendSignal: number;
  riskAdjustedMomentum: number;
};

export type TradeCandidate = {
  id: string;
  name: string;
  symbol: string;
  underlyingMark: number;
  expiration: string;
  daysToExpiry: number;
  structureType: StructureType;
  style: SpreadStyle;
  longLeg: OptionLeg;
  shortLeg: OptionLeg;
  theme: string;
  thesis: string;
  liquidityScore: number;
  regime: RegimeLabel;
  direction?: "bullish" | "bearish";
  signalStrength?: number;
  correlationBucket?: string;
  sourceAsOfUtc?: string;
  marketEvidence?: string[];
  historySessionCount?: number;
  advancedMetrics?: AdvancedMarketMetrics;
  fiveDayReturn?: number;
  twentyDayReturn?: number;
  realizedVolatility?: number;
};

export type InferenceModelResult = {
  name: "jump_stress" | "market_implied" | "shrunk_regime" | "fat_tail";
  probability: number;
  expectedValueDollars: number;
  positive: boolean;
};

export type CandidateInference = {
  inferenceVersion: "rfdelta-inference-v3";
  eligibilityScore: number;
  requiredProbability: number;
  consensusProbability: number;
  probabilityMargin: number;
  positiveModelCount: number;
  conservativeExpectedValueDollars: number;
  expectedMoveCoverage: number;
  multiHorizonAlignment: number;
  sessionConfirmation: boolean;
  scenarioStability: number;
  selectionFrequencyUnderPerturbation: number;
  twoSidedQuotes: boolean;
  completeLegData: boolean;
  modelResults: InferenceModelResult[];
  hardGateFailures: string[];
  eligibleBeforeSessionGate: boolean;
  publicationEligible: boolean;
};

export type TradeIdeaScore = {
  rank: number;
  id: string;
  name: string;
  symbol: string;
  underlyingMark: number;
  expiration: string;
  daysToExpiry: number;
  structureType: StructureType;
  style: SpreadStyle;
  direction: "bullish" | "bearish";
  theme: string;
  regime: RegimeLabel;
  correlationBucket: string;
  bucket: "top_candidate" | "watchlist" | "conditional" | "reject";
  entry: number;
  width: number;
  maxLossDollars: number;
  maxProfitDollars: number;
  rewardToRisk: number;
  breakeven: number;
  requiredMovePctToBreakeven: number;
  probabilityProfit: number;
  probabilityNearMaxProfit: number;
  expectedValueDollars: number;
  blackScholesEdge: number;
  impliedVolUsed: number;
  liquidityScore: number;
  score: number;
  inference: CandidateInference;
  publicationEligible: boolean;
  riskFlags: string[];
  thesis: string;
  longLeg: OptionLeg;
  shortLeg: OptionLeg;
  sourceAsOfUtc?: string;
  marketEvidence: string[];
  historySessionCount: number;
  advancedMetrics?: AdvancedMarketMetrics;
  trainingAdjustment: number;
  trainingPolicyVersion: string;
  fiveDayReturn: number;
  twentyDayReturn: number;
  realizedVolatility: number;
  lessonAdjustments: string[];
};

export type StrategyPosterior = {
  alpha: number;
  beta: number;
  sampleCount: number;
  realizedPnlDollars: number;
  meanScore: number;
  lastUpdatedUtc: string;
};

export type LessonEvent = {
  id: string;
  createdAtUtc: string;
  basketId: string;
  narrative: string;
  realizedPnlDollars: number;
  debitPnlDollars: number;
  creditPnlDollars: number;
  adjustments: string[];
};

export type LessonSnapshot = {
  strategyPosteriors: Record<SpreadStyle, StrategyPosterior>;
  latestNarrative: string;
  events: LessonEvent[];
};
