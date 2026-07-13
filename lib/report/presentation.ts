import calibrationOutcomes from "@/data/calibration/prior-outcomes-2026-06-18.json";
import { loadRetainedHistory } from "@/lib/market/history";
import type { MarketSnapshot } from "@/lib/market/types";
import { buildAccountabilityHistory } from "@/lib/report/accountability";
import { buildMarketRead } from "@/lib/report/marketRead";
import { getReport, getReportIndex } from "@/lib/report/store";
import type { OptionsReport, TradeOutcome } from "@/lib/report/types";

const CALIBRATION_OUTCOMES = calibrationOutcomes as TradeOutcome[];

export async function getPresentationReport(date?: string): Promise<OptionsReport> {
  const index = await getReportIndex();
  const reportDate = date ?? index.latest;
  if (!reportDate) throw new Error("No published report is available.");
  const [report, archiveReports, retainedHistory] = await Promise.all([
    getReport(reportDate),
    Promise.all(index.reports.map((item) => getReport(item.date))),
    loadRetainedHistory()
  ]);
  const snapshot = presentationSnapshot(report);
  const accountabilityHistory = buildAccountabilityHistory(
    snapshot,
    archiveReports,
    retainedHistory,
    CALIBRATION_OUTCOMES
  );
  return {
    ...report,
    accountability: accountabilityHistory[0] ?? report.accountability,
    accountabilityHistory,
    marketRead: report.marketRead ?? buildMarketRead({
      reportDate: report.runMetadata.reportDate,
      dataAsOfUtc: report.runMetadata.dataAsOfUtc,
      topTrades: report.topTrades,
      analytics: report.analytics,
      marketContext: report.marketContext
    }, archiveReports, [])
  };
}

function presentationSnapshot(report: OptionsReport): MarketSnapshot {
  return {
    provider: "published-report-archive",
    providerAttribution: report.marketContext.providerAttribution,
    reportDate: report.runMetadata.reportDate,
    sessionDate: report.runMetadata.marketSessionDate,
    asOfUtc: report.runMetadata.dataAsOfUtc,
    universe: [],
    symbols: [],
    excludedSymbols: []
  };
}
