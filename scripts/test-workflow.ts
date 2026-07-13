import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { HistoricalFixtureProvider } from "../lib/market/fixture";
import { buildReport } from "../lib/report/generator";
import { currentReportDate, resolveReportDate } from "../lib/report/dates";

async function main() {
  assert.equal(resolveReportDate(["--date", "2026-06-19"]), "2026-06-19");
  assert.equal(resolveReportDate(["2026-07-10"]), "2026-07-10");
  assert.equal(currentReportDate(new Date("2026-06-19T02:00:00Z"), "America/New_York"), "2026-06-18");
  const provider = new HistoricalFixtureProvider();
  const snapshot = await provider.getSnapshot({ reportDate: "2026-06-19", universe: [] });
  const first = await buildReport(snapshot);
  const second = await buildReport(snapshot);
  assert.equal(first.runMetadata.selectionHash, second.runMetadata.selectionHash);
  assert.deepEqual(first.topTrades.map((idea) => idea.id), second.topTrades.map((idea) => idea.id));
  assert.equal(first.runMetadata.edition, "Historical calibration edition");
  assert.equal(first.runMetadata.methodologyVersion, "rfdelta-options-v2");
  assert.ok(first.runMetadata.datasetRunId?.startsWith("run-"));
  assert.ok(first.topTrades.every((idea) => idea.advancedMetrics));
  const workflow = await readFile(".github/workflows/daily-options-report.yml", "utf8");
  for (const cron of ["45 10 * * 1-5", "5 11 * * 1-5", "20 16 * * 1-5", "5 17 * * 1-5"]) {
    assert.match(workflow, new RegExp(`cron: [\"']${cron.replaceAll("*", "\\*")}[\"']`, "u"));
  }
  assert.equal(workflow.match(/timezone: ["']America\/New_York["']/gu)?.length, 4);
  assert.match(workflow, /npm run collect:closes/u);
  console.log(`[test:workflow] hash=${first.runMetadata.selectionHash.slice(0, 12)} ideas=${first.topTrades.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
