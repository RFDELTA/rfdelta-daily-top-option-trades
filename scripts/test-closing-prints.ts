import assert from "node:assert/strict";
import { HistoricalFixtureProvider } from "../lib/market/fixture";
import type { DailyBar } from "../lib/market/types";
import { buildReport } from "../lib/report/generator";
import { applyClosingPrintsToReport } from "../lib/report/closingPrints";

async function main() {
  process.env.MODEL_MIN_PUBLICATION_SCORE = "0";
  process.env.MODEL_MIN_PROBABILITY_MARGIN = "-1";
  process.env.MODEL_MIN_CONSERVATIVE_EV_DOLLARS = "-10000";
  process.env.MODEL_MIN_POSITIVE_MODELS = "0";
  process.env.MODEL_MIN_LIQUIDITY_SCORE = "0";
  process.env.MODEL_MIN_MULTI_HORIZON_ALIGNMENT = "0";
  process.env.MODEL_REQUIRE_SESSION_CONFIRMATION = "false";
  const snapshot = await new HistoricalFixtureProvider().getSnapshot({ reportDate: "2026-06-19", universe: [] });
  const report = await buildReport(snapshot);
  const expiration = report.topTrades.map((idea) => idea.expiration).sort().at(-1) ?? "2026-07-03";
  const openDate = "2026-06-22";
  const history = Object.fromEntries(report.topTrades.map((idea) => {
    const entry = idea.underlyingChart?.points.map((point) => bar(point.date, point.close)) ?? [];
    return [idea.symbol, [
      ...entry,
      bar(report.runMetadata.reportDate, idea.underlyingMark * 1.02),
      bar(openDate, idea.underlyingMark * 1.01),
      bar(expiration, idea.underlyingMark * (idea.direction === "bullish" ? 1.1 : 0.9))
    ]];
  }));

  const sameDay = applyClosingPrintsToReport(report, history, report.runMetadata.reportDate, "2026-06-19T21:00:00.000Z");
  assert.ok(sameDay.topTrades.every((idea) => idea.underlyingChart?.points.find((point) => point.date === report.runMetadata.reportDate)?.close === idea.dailyCloses?.[0]?.underlyingClose));

  const tracked = applyClosingPrintsToReport(report, history, openDate, "2026-06-22T21:00:00.000Z");
  assert.ok(tracked.topTrades.every((idea) => idea.dailyCloses?.some((print) => print.date === openDate)));
  assert.ok(tracked.topTrades.every((idea) => idea.underlyingChart?.points.at(-1)?.date === openDate));
  assert.equal(tracked.postTradeReview, undefined);

  const completed = applyClosingPrintsToReport(report, history, expiration, "2026-07-03T21:00:00.000Z");
  assert.equal(completed.postTradeReview?.status, "complete");
  assert.ok(completed.topTrades.every((idea) => idea.underlyingChart?.closeDate === expiration));
  assert.ok(completed.topTrades.every((idea) => idea.dailyCloses?.some((print) => print.date === expiration)));
  console.log(`[test:closing-prints] tracked=${tracked.topTrades.length} completed=${completed.postTradeReview?.tradeCount ?? 0}`);
}

function bar(date: string, close: number): DailyBar {
  return { date, open: close, high: close, low: close, close, volume: 1_000 };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
