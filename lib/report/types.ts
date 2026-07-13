import type { TradeIdeaScore } from "@/lib/model/types";

export type OutcomeStatus = "win" | "loss" | "near_breakeven" | "open" | "awaiting_close";

export type TradeOutcome = {
  tradeId: string;
  name: string;
  symbol: string;
  style: TradeIdeaScore["style"];
  expiration: string;
  status: OutcomeStatus;
  settlementDate?: string;
  settlementUnderlying?: number;
  settlementValue?: number;
  realizedPnlDollars?: number;
  read: string;
};

export type AccountabilityLedger = {
  sourceReportDate?: string;
  sourceEdition?: OptionsReport["runMetadata"]["edition"];
  evaluatedThrough: string;
  status?: "open" | "partially_resolved" | "complete";
  wins: number;
  losses: number;
  nearBreakeven: number;
  open: number;
  resolvedPnlDollars: number;
  read: string;
  trades: TradeOutcome[];
};

export type MarketNewsItem = {
  headline: string;
  publisher: string;
  url: string;
  publishedAtUtc: string;
  topic: "rates" | "earnings" | "energy" | "policy" | "geopolitics" | "technology" | "broad_market";
};

export type MarketWatchItem = {
  label: string;
  signal: string;
  read: string;
};

export type MarketRead = {
  asOfUtc: string;
  lookbackSessionDates: string[];
  headline: string;
  standfirst: string;
  commentary: string[];
  newsRadar: MarketNewsItem[];
  watchItems: MarketWatchItem[];
  basis: string;
};

export type TradeCommentary = {
  convictionLabel: string;
  rankingRead: string;
  setup: string;
  execution: string;
  risk: string;
  payoffRead: string;
};

export type UnderlyingChartPoint = {
  date: string;
  close: number;
};

export type UnderlyingTradeChart = {
  assetPath: string;
  entryDate: string;
  entryPrice: number;
  closeDate?: string;
  closePrice?: number;
  points: UnderlyingChartPoint[];
};

export type DailyUnderlyingClose = {
  date: string;
  underlyingClose: number;
};

export type PostTradeReview = {
  status: "complete";
  completedOn: string;
  evaluatedAtUtc: string;
  tradeCount: number;
  wins: number;
  losses: number;
  nearBreakeven: number;
  totalMaxRiskDollars: number;
  finalPnlDollars: number;
  returnOnRisk: number;
  bestTradeId?: string;
  worstTradeId?: string;
  headline: string;
  commentary: string[];
  trades: TradeOutcome[];
};

export type PublishedTradeIdea = TradeIdeaScore & {
  commentary: TradeCommentary;
  underlyingChart?: UnderlyingTradeChart;
  dailyCloses?: DailyUnderlyingClose[];
};

export type OptionsReport = {
  schemaVersion: "1.0";
  reportId: string;
  runMetadata: {
    reportDate: string;
    marketSessionDate: string;
    generatedAtUtc: string;
    dataAsOfUtc: string;
    edition: "Daily market edition" | "Historical calibration edition";
    methodologyVersion: "rfdelta-options-v1" | "rfdelta-options-v2";
    selectionHash: string;
    datasetRunId?: string;
    featureVersion?: string;
    selectionPolicyVersion?: string;
    trainingSampleCount?: number;
  };
  executiveSummary: {
    headline: string;
    standfirst: string;
    marketCommentary: string[];
    selectionCommentary: string[];
    riskCommentary: string;
  };
  marketContext: {
    providerAttribution: string;
    universeCount: number;
    quotedSymbolCount?: number;
    chainSymbolCount?: number;
    includedSymbolCount: number;
    excludedSymbolCount: number;
    candidateCount: number;
    bullishCandidateCount: number;
    bearishCandidateCount: number;
    regimeCounts: Record<string, number>;
  };
  analytics: {
    publishedIdeaCount: number;
    topScore: number;
    averageProbabilityProfit: number;
    totalExpectedValueDollars: number;
    totalMaxLossDollars: number;
    totalMaxProfitDollars: number;
    debitIdeaCount: number;
    creditIdeaCount: number;
  };
  topTrades: PublishedTradeIdea[];
  accountability: AccountabilityLedger;
  accountabilityHistory?: AccountabilityLedger[];
  postTradeReview?: PostTradeReview;
  marketRead?: MarketRead;
  methodology: {
    selectionCriteria: string[];
    rankingFramework: string[];
    executionAssumption: string;
    publicationCadence: string;
    marketDataStatement: string;
    disclaimer: string;
  };
};

export type ReportIndexItem = {
  date: string;
  title: string;
  edition: OptionsReport["runMetadata"]["edition"];
  dataAsOfUtc: string;
  topSymbol: string;
  ideaCount: number;
  topScore: number;
};

export type ReportIndex = {
  latest: string | null;
  reports: ReportIndexItem[];
};
