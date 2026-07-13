import { loadRetainedHistory } from "../lib/market/history";
import { getReport, getReportIndex, persistUpdatedReports } from "../lib/report/store";
import { createUnderlyingTradeChartFromBars } from "../lib/report/underlyingChart";

async function main() {
  const index = await getReportIndex();
  const requestedDate = process.argv.find((value) => /^\d{4}-\d{2}-\d{2}$/u.test(value));
  const dates = requestedDate ? [requestedDate] : index.reports.map((report) => report.date);
  const history = await loadRetainedHistory();
  let chartCount = 0;
  for (const date of dates) {
    const report = await getReport(date);
    const topTrades = report.topTrades.map((idea) => {
      if (idea.underlyingChart) return idea;
      const bars = history[idea.symbol] ?? [];
      if (!bars.length) return idea;
      chartCount += 1;
      return { ...idea, underlyingChart: createUnderlyingTradeChartFromBars(date, idea, bars) };
    });
    await persistUpdatedReports([{ ...report, topTrades }]);
  }
  console.log(`[backfill:charts] reports=${dates.length} charts=${chartCount}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
