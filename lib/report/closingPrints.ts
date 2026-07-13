import { loadRetainedHistory, persistHistoricalBars } from "@/lib/market/history";
import { fetchPublicHistoryBars } from "@/lib/market/publicHistory";
import type { DailyBar, MarketSnapshot } from "@/lib/market/types";
import { evaluateCompletedBasket } from "@/lib/report/reconciliation";
import { getReport, getReportIndex, persistUpdatedReports } from "@/lib/report/store";
import type { OptionsReport } from "@/lib/report/types";
import {
  attachCompletedUnderlyingCharts,
  createUnderlyingTradeChartFromBars
} from "@/lib/report/underlyingChart";

type HistoryFetcher = (
  symbol: string,
  startDate: string,
  endDate: string,
  options?: { maxBars?: number }
) => Promise<DailyBar[]>;

type CollectClosingPrintOptions = {
  date: string;
  asOfUtc?: string;
  fetchHistory?: HistoryFetcher;
  concurrency?: number;
};

export type ClosingPrintResult = {
  date: string;
  requestedSymbols: number;
  capturedSymbols: number;
  updatedReports: number;
  completedReports: number;
  skipped: boolean;
};

export class NoClosingPrintSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoClosingPrintSessionError";
  }
}

export async function collectAndPersistClosingPrints(
  options: CollectClosingPrintOptions
): Promise<ClosingPrintResult> {
  assertDate(options.date);
  const asOfUtc = options.asOfUtc ?? new Date().toISOString();
  const fetchHistory = options.fetchHistory ?? fetchPublicHistoryBars;
  const concurrency = clampInteger(options.concurrency ?? 4, 1, 12);
  const [index, retained] = await Promise.all([getReportIndex(), loadRetainedHistory()]);
  const reports = await Promise.all(index.reports.map((item) => getReport(item.date)));
  const unresolved = reports.filter((report) =>
    report.runMetadata.reportDate <= options.date &&
    report.postTradeReview?.status !== "complete" &&
    report.topTrades.length > 0
  );
  const targetIdeas = unresolved.flatMap((report) => report.topTrades);

  if (!targetIdeas.length) {
    return emptyResult(options.date, true);
  }

  const activeIdeas = targetIdeas.filter((idea) => idea.expiration >= options.date);
  const needsSettlement = targetIdeas.some((idea) => idea.expiration <= options.date);
  const alreadyCaptured = activeIdeas.length > 0 && activeIdeas.every((idea) =>
    idea.dailyCloses?.some((print) => print.date === options.date)
  );
  if (alreadyCaptured && !needsSettlement) {
    return emptyResult(options.date, true);
  }

  const startBySymbol = new Map<string, string>();
  for (const report of unresolved) {
    for (const idea of report.topTrades) {
      const current = startBySymbol.get(idea.symbol);
      if (!current || report.runMetadata.reportDate < current) {
        startBySymbol.set(idea.symbol, report.runMetadata.reportDate);
      }
    }
  }

  console.log(`[closing-prints] start date=${options.date} reports=${unresolved.length} symbols=${startBySymbol.size}`);
  const fetched = new Map<string, DailyBar[]>();
  const failures: string[] = [];
  await mapLimit([...startBySymbol.entries()].sort(([a], [b]) => a.localeCompare(b)), concurrency, async ([symbol, startDate]) => {
    try {
      const bars = await fetchHistory(symbol, startDate, options.date, { maxBars: 260 });
      if (bars.length) fetched.set(symbol, bars);
    } catch {
      failures.push(symbol);
    }
  });

  const activeSymbols = [...new Set(activeIdeas.map((idea) => idea.symbol))].sort();
  const missingCurrent = activeSymbols.filter((symbol) =>
    !fetched.get(symbol)?.some((bar) => bar.date === options.date)
  );
  if (activeSymbols.length && missingCurrent.length === activeSymbols.length) {
    throw new NoClosingPrintSessionError(`No finalized ${options.date} closing session was available.`);
  }
  if (missingCurrent.length) {
    throw new Error(`Finalized closing prints were incomplete for ${missingCurrent.length} open symbol(s).`);
  }

  const history = mergeHistory(retained, Object.fromEntries(fetched));
  const updatedReports = unresolved
    .map((report) => applyClosingPrintsToReport(report, history, options.date, asOfUtc))
    .filter((report, index) => JSON.stringify(report) !== JSON.stringify(unresolved[index]));

  if (fetched.size) await persistHistoricalBars(Object.fromEntries(fetched), asOfUtc);
  if (updatedReports.length) await persistUpdatedReports(updatedReports);
  const completedReports = updatedReports.filter((report) => report.postTradeReview?.status === "complete").length;
  console.log(`[closing-prints] complete date=${options.date} captured=${activeSymbols.length} updated_reports=${updatedReports.length} completed_reports=${completedReports} fetch_failures=${failures.length}`);

  return {
    date: options.date,
    requestedSymbols: startBySymbol.size,
    capturedSymbols: activeSymbols.length,
    updatedReports: updatedReports.length,
    completedReports,
    skipped: false
  };
}

export function applyClosingPrintsToReport(
  report: OptionsReport,
  history: Record<string, DailyBar[]>,
  closeDate: string,
  asOfUtc: string
): OptionsReport {
  const topTrades = report.topTrades.map((idea) => {
    const cutoff = idea.expiration < closeDate ? idea.expiration : closeDate;
    const bars = [...new Map((history[idea.symbol] ?? [])
      .filter((bar) => bar.date >= report.runMetadata.reportDate && bar.date <= cutoff)
      .map((bar) => [bar.date, bar])).values()]
      .sort((a, b) => a.date.localeCompare(b.date));
    const dailyCloses = bars.map((bar) => ({
      date: bar.date,
      underlyingClose: round(bar.close, 4)
    }));
    return {
      ...idea,
      ...(dailyCloses.length ? { dailyCloses } : {}),
      underlyingChart: createUnderlyingTradeChartFromBars(
        report.runMetadata.reportDate,
        idea,
        history[idea.symbol] ?? [],
        cutoff
      )
    };
  });
  let updated: OptionsReport = { ...report, topTrades };
  if (!updated.postTradeReview && topTrades.every((idea) => idea.expiration <= closeDate)) {
    const snapshot = reconciliationSnapshot(closeDate, asOfUtc);
    const review = evaluateCompletedBasket(updated, snapshot, history);
    if (review) {
      updated = attachCompletedUnderlyingCharts(
        { ...updated, postTradeReview: review },
        review,
        snapshot,
        history
      );
    }
  }
  return updated;
}

function reconciliationSnapshot(closeDate: string, asOfUtc: string): MarketSnapshot {
  const nextDate = addUtcDays(closeDate, 1);
  return {
    provider: "public-closing-history",
    providerAttribution: "Public daily market history",
    reportDate: nextDate,
    sessionDate: nextDate,
    asOfUtc,
    universe: [],
    symbols: [],
    excludedSymbols: []
  };
}

function mergeHistory(
  retained: Record<string, DailyBar[]>,
  additions: Record<string, DailyBar[]>
) {
  const result: Record<string, DailyBar[]> = { ...retained };
  for (const [symbol, bars] of Object.entries(additions)) {
    const merged = new Map((result[symbol] ?? []).map((bar) => [bar.date, bar]));
    bars.forEach((bar) => merged.set(bar.date, bar));
    result[symbol] = [...merged.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-260);
  }
  return result;
}

function emptyResult(date: string, skipped: boolean): ClosingPrintResult {
  return { date, requestedSymbols: 0, capturedSymbols: 0, updatedReports: 0, completedReports: 0, skipped };
}

function addUtcDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function assertDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error("Closing-print date must use YYYY-MM-DD.");
  }
}

function round(value: number, places: number) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function clampInteger(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

async function mapLimit<T>(values: T[], limit: number, mapper: (value: T) => Promise<void>) {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      await mapper(values[index] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), values.length) }, worker));
}
