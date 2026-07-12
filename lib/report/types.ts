import type { TradeIdeaScore } from "@/lib/model/types";

export type OutcomeStatus = "win" | "loss" | "near_breakeven" | "open" | "awaiting_close";

export type TradeOutcome = {
  tradeId: string;
  name: string;
  symbol: string;
  style: TradeIdeaScore["style"];
  expiration: string;
  status: OutcomeStatus;
  settlementUnderlying?: number;
  settlementValue?: number;
  realizedPnlDollars?: number;
  read: string;
};

export type TradeCommentary = {
  convictionLabel: string;
  rankingRead: string;
  setup: string;
  execution: string;
  risk: string;
  payoffRead: string;
};

export type PublishedTradeIdea = TradeIdeaScore & {
  commentary: TradeCommentary;
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
    methodologyVersion: "rfdelta-options-v1";
    selectionHash: string;
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
  accountability: {
    sourceReportDate?: string;
    evaluatedThrough: string;
    wins: number;
    losses: number;
    nearBreakeven: number;
    open: number;
    resolvedPnlDollars: number;
    read: string;
    trades: TradeOutcome[];
  };
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
