import type { DailyBar, MarketSnapshot } from "@/lib/market/types";
import type { TradeIdeaScore } from "@/lib/model/types";
import type { OptionsReport, PostTradeReview, PublishedTradeIdea, UnderlyingTradeChart } from "@/lib/report/types";

const MAX_CHART_SESSIONS = 90;

export function createUnderlyingTradeChart(snapshot: MarketSnapshot, idea: TradeIdeaScore): UnderlyingTradeChart {
  const bars = snapshot.symbols.find((item) => item.symbol === idea.symbol)?.bars ?? [];
  return buildChart(idea, snapshot.reportDate, bars);
}

export function createUnderlyingTradeChartFromBars(reportDate: string, idea: PublishedTradeIdea, bars: DailyBar[]) {
  return buildChart(idea, reportDate, bars);
}

export function attachCompletedUnderlyingCharts(
  report: OptionsReport,
  review: PostTradeReview,
  snapshot: MarketSnapshot,
  retained: Record<string, DailyBar[]>
): OptionsReport {
  const topTrades = report.topTrades.map((idea) => {
    const outcome = review.trades.find((trade) => trade.tradeId === idea.id);
    if (!outcome?.settlementDate || outcome.settlementUnderlying === undefined) return idea;
    const live = snapshot.symbols.find((item) => item.symbol === idea.symbol)?.bars ?? [];
    const existing = idea.underlyingChart?.points.map((point) => ({
      date: point.date,
      open: point.close,
      high: point.close,
      low: point.close,
      close: point.close,
      volume: 0
    })) ?? [];
    const chart = buildChart(idea, report.runMetadata.reportDate, mergeBars(existing, retained[idea.symbol] ?? [], live), {
      closeDate: outcome.settlementDate,
      closePrice: outcome.settlementUnderlying
    });
    return { ...idea, underlyingChart: chart };
  });
  return { ...report, topTrades };
}

export function underlyingChartAssetPath(reportDate: string, rank: number, symbol: string) {
  const safeSymbol = symbol.toLowerCase().replace(/[^a-z0-9_-]/gu, "-");
  return `/charts/${reportDate}/underlying/${String(rank).padStart(2, "0")}-${safeSymbol}.svg`;
}

function buildChart(
  idea: TradeIdeaScore | PublishedTradeIdea,
  entryDate: string,
  bars: DailyBar[],
  close?: { closeDate: string; closePrice: number }
): UnderlyingTradeChart {
  const cutoff = close?.closeDate ?? entryDate;
  const values = new Map<string, number>();
  bars
    .filter((bar) => bar.date <= cutoff && Number.isFinite(bar.close) && bar.close > 0)
    .forEach((bar) => values.set(bar.date, bar.close));
  values.set(entryDate, idea.underlyingMark);
  if (close) values.set(close.closeDate, close.closePrice);
  const points = [...values.entries()]
    .map(([date, value]) => ({ date, close: round(value, 4) }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_CHART_SESSIONS);
  return {
    assetPath: underlyingChartAssetPath(entryDate, idea.rank, idea.symbol),
    entryDate,
    entryPrice: round(idea.underlyingMark, 4),
    ...(close ? { closeDate: close.closeDate, closePrice: round(close.closePrice, 4) } : {}),
    points
  };
}

function mergeBars(...groups: DailyBar[][]) {
  const values = new Map<string, DailyBar>();
  groups.flat().forEach((bar) => values.set(bar.date, bar));
  return [...values.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function round(value: number, places: number) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
