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
  fiveDayReturn?: number;
  twentyDayReturn?: number;
  realizedVolatility?: number;
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
  riskFlags: string[];
  thesis: string;
  longLeg: OptionLeg;
  shortLeg: OptionLeg;
  sourceAsOfUtc?: string;
  marketEvidence: string[];
  historySessionCount: number;
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
