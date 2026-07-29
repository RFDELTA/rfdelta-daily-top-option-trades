import assert from "node:assert/strict";
import { getPresentationReport } from "../lib/report/presentation";

async function main() {
  const report = await getPresentationReport("2026-07-13");
  const ledgers = report.accountabilityHistory ?? [];
  assert.ok(ledgers.length >= 2);
  assert.equal(ledgers[0]?.sourceReportDate, "2026-07-10");
  assert.equal(ledgers[1]?.sourceReportDate, "2026-06-19");
  assert.equal(new Set(ledgers.map((ledger) => ledger.sourceReportDate)).size, ledgers.length);
  assert.ok(ledgers.some((ledger) => ledger.status === "complete"));
  assert.ok(ledgers.some((ledger) => ledger.open > 0));
  assert.ok(report.marketRead);
  assert.ok((report.marketRead?.lookbackSessionDates.length ?? 0) >= 2);
  assert.ok((report.marketRead?.lookbackSessionDates.length ?? 0) <= 5);
  assert.equal(report.marketRead?.commentary.length, 4);
  assert.equal(report.marketRead?.watchItems.length, 5);
  const recentReport = await getPresentationReport("2026-07-29");
  const recentLedgers = recentReport.accountabilityHistory ?? [];
  assert.ok(recentLedgers.length >= 5);
  assert.ok(recentLedgers.every((ledger) => ledger.trades.length > 0));
  const july14Ledger = recentLedgers.find((ledger) => ledger.sourceReportDate === "2026-07-14");
  assert.equal(july14Ledger?.status, "partially_resolved");
  assert.equal(july14Ledger?.losses, 1);
  assert.equal(july14Ledger?.open, 4);
  assert.equal(july14Ledger?.resolvedPnlDollars, -18);
  assert.ok(recentLedgers.some((ledger) => (
    ledger.sourceReportDate === "2026-07-13" &&
    ledger.status === "complete"
  )));
  console.log(
    `[test:presentation] historical_ledgers=${ledgers.length} recent_ledgers=${recentLedgers.length} sessions=${report.marketRead?.lookbackSessionDates.length}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
