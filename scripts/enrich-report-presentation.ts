import calibrationOutcomes from "../data/calibration/prior-outcomes-2026-06-18.json";
import { loadRetainedHistory } from "../lib/market/history";
import { discoverMarketNews } from "../lib/market/news";
import type { MarketSnapshot } from "../lib/market/types";
import { buildAccountabilityHistory } from "../lib/report/accountability";
import { buildMarketRead } from "../lib/report/marketRead";
import { getReport, getReportIndex, persistUpdatedReports } from "../lib/report/store";
import type { TradeOutcome } from "../lib/report/types";

async function main() {
  const index = await getReportIndex();
  const date = process.argv.find((value) => /^\d{4}-\d{2}-\d{2}$/u.test(value)) ?? index.latest;
  if (!date) throw new Error("No report is available to enrich.");
  const [report, archiveReports, retainedHistory] = await Promise.all([
    getReport(date),
    Promise.all(index.reports.map((item) => getReport(item.date))),
    loadRetainedHistory()
  ]);
  const snapshot: MarketSnapshot = {
    provider: "published-report-archive",
    providerAttribution: report.marketContext.providerAttribution,
    reportDate: report.runMetadata.reportDate,
    sessionDate: report.runMetadata.marketSessionDate,
    asOfUtc: report.runMetadata.dataAsOfUtc,
    universe: [],
    symbols: [],
    excludedSymbols: []
  };
  const accountabilityHistory = buildAccountabilityHistory(
    snapshot,
    archiveReports,
    retainedHistory,
    calibrationOutcomes as TradeOutcome[]
  );
  const newsRadar = report.runMetadata.edition === "Daily market edition"
    ? await discoverMarketNews({
      symbols: report.topTrades.map((idea) => idea.symbol),
      asOfUtc: report.runMetadata.dataAsOfUtc
    })
    : [];
  const updated = {
    ...report,
    accountability: accountabilityHistory[0] ?? report.accountability,
    accountabilityHistory,
    marketRead: buildMarketRead({
      reportDate: report.runMetadata.reportDate,
      dataAsOfUtc: report.runMetadata.dataAsOfUtc,
      topTrades: report.topTrades,
      analytics: report.analytics,
      marketContext: report.marketContext
    }, archiveReports, newsRadar)
  };
  await persistUpdatedReports([updated]);
  console.log(`[presentation] date=${date} ledgers=${accountabilityHistory.length} headlines=${newsRadar.length} sessions=${updated.marketRead.lookbackSessionDates.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
