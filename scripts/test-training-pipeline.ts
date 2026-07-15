import assert from "node:assert/strict";
import { HistoricalFixtureProvider } from "../lib/market/fixture";
import { mergeQuoteHistory } from "../lib/market/history";
import type { MarketSnapshot } from "../lib/market/types";
import { buildReport } from "../lib/report/generator";
import { evaluateCompletedBasket } from "../lib/report/reconciliation";
import { renderReportMarkdown } from "../lib/report/renderers";
import type { OptionsReport, PostTradeReview } from "../lib/report/types";
import { computeMarketFeatureDataset } from "../lib/training/features";
import { getPolicyScoreAdjustment, selectionPolicyHash, trainSelectionPolicy } from "../lib/training/policy";
import { createDatasetRunId, shouldReplaceCurrentPolicy } from "../lib/training/store";
import { attachCompletedUnderlyingCharts } from "../lib/report/underlyingChart";

async function main() {
  const finalizedBars = mergeQuoteHistory([{
    date: "2026-07-10",
    open: 99,
    high: 102,
    low: 98,
    close: 100.25,
    volume: 1000
  }], {
    symbol: "TEST",
    last: 103,
    bid: 102.9,
    ask: 103.1,
    previousClose: 101.75,
    previousCloseDate: "2026-07-10",
    changePct: 0.012,
    volume: 500,
    tradeTimeUtc: "2026-07-13T15:00:00Z",
    sessionDate: "2026-07-13"
  });
  assert.equal(finalizedBars.find((bar) => bar.date === "2026-07-10")?.close, 101.75);

  const snapshot = await new HistoricalFixtureProvider().getSnapshot({ reportDate: "2026-06-19", universe: [] });
  const firstFeatures = computeMarketFeatureDataset(snapshot);
  const secondFeatures = computeMarketFeatureDataset(snapshot);
  assert.deepEqual(firstFeatures, secondFeatures);
  assert.equal(firstFeatures.symbols.length, snapshot.symbols.length);
  for (const metrics of firstFeatures.symbols) {
    assert.ok(metrics.historySessions >= 21);
    assert.ok(metrics.rsi14 >= 0 && metrics.rsi14 <= 100);
    assert.ok(metrics.atmImpliedVol > 0);
    assert.ok(metrics.liquidContractRatio > 0 && metrics.liquidContractRatio <= 1);
    for (const value of Object.values(metrics).filter((entry): entry is number => typeof entry === "number")) {
      assert.ok(Number.isFinite(value));
    }
  }

  process.env.MODEL_MIN_PUBLICATION_SCORE = "0";
  process.env.MODEL_MIN_PROBABILITY_MARGIN = "-1";
  process.env.MODEL_MIN_CONSERVATIVE_EV_DOLLARS = "-10000";
  process.env.MODEL_MIN_POSITIVE_MODELS = "0";
  process.env.MODEL_MIN_LIQUIDITY_SCORE = "0";
  process.env.MODEL_MIN_MULTI_HORIZON_ALIGNMENT = "0";
  process.env.MODEL_REQUIRE_SESSION_CONFIRMATION = "false";
  const report = await buildReport(snapshot);
  assert.ok(report.topTrades.every((idea) => idea.advancedMetrics));
  const settlementSnapshot = withSettlementBars(snapshot, report);
  const review = evaluateCompletedBasket(report, settlementSnapshot);
  assert.ok(review);
  assert.equal(review?.status, "complete");
  assert.equal(review?.trades.length, report.topTrades.length);
  assert.ok(review?.trades.every((trade) => trade.realizedPnlDollars !== undefined));
  assert.ok(review?.trades.every((trade) => trade.settlementDate));
  const charted = attachCompletedUnderlyingCharts(report, review as PostTradeReview, settlementSnapshot, {});
  assert.ok(charted.topTrades.every((idea) => idea.underlyingChart?.closeDate && idea.underlyingChart.closePrice !== undefined));

  const trainedReports = [0, 1].map((copy) => reportWithReview(report, review as PostTradeReview, copy));
  const policy = trainSelectionPolicy(trainedReports, settlementSnapshot.asOfUtc, settlementSnapshot.reportDate);
  const repeat = trainSelectionPolicy(trainedReports, settlementSnapshot.asOfUtc, settlementSnapshot.reportDate);
  assert.equal(policy.active, true);
  assert.ok(policy.resolvedTradeCount >= 8);
  assert.equal(selectionPolicyHash(policy), selectionPolicyHash(repeat));
  const idea = trainedReports[0]?.topTrades[0];
  assert.ok(idea?.advancedMetrics);
  const adjustment = getPolicyScoreAdjustment(policy, idea?.advancedMetrics, idea?.direction ?? "bullish");
  assert.ok(Math.abs(adjustment) <= policy.maximumScoreAdjustment);
  const runId = createDatasetRunId(snapshot, firstFeatures, policy);
  assert.equal(runId, createDatasetRunId(snapshot, secondFeatures, repeat));
  assert.equal(shouldReplaceCurrentPolicy(policy, { ...policy, trainedAtUtc: "2026-06-18T00:00:00.000Z", trainingThroughDate: "2026-06-18" }), false);
  assert.equal(shouldReplaceCurrentPolicy(policy, { ...policy, trainedAtUtc: "2026-07-07T00:00:00.000Z", trainingThroughDate: "2026-07-07" }), true);

  const reviewed = { ...report, postTradeReview: review as PostTradeReview } satisfies OptionsReport;
  const markdown = renderReportMarkdown(reviewed);
  assert.match(markdown, /Completed Basket Review/u);
  assert.match(markdown, /Advanced metrics/u);
  console.log(`[test:training] features=${firstFeatures.symbols.length} resolved=${policy.resolvedTradeCount} active=${policy.active} adjustment=${adjustment.toFixed(2)}`);
}

function withSettlementBars(snapshot: MarketSnapshot, report: OptionsReport): MarketSnapshot {
  const expiration = report.topTrades.map((idea) => idea.expiration).sort().at(-1) ?? "2026-07-03";
  return {
    ...snapshot,
    reportDate: "2026-07-06",
    sessionDate: "2026-07-06",
    asOfUtc: "2026-07-06T15:45:00.000Z",
    symbols: snapshot.symbols.map((symbol) => {
      const idea = report.topTrades.find((candidate) => candidate.symbol === symbol.symbol);
      const direction = idea?.direction === "bearish" ? -1 : 1;
      const close = symbol.quote.last * (1 + direction * 0.12);
      return {
        ...symbol,
        bars: [...symbol.bars, {
          date: expiration,
          open: close,
          high: close,
          low: close,
          close,
          volume: symbol.quote.volume
        }]
      };
    })
  };
}

function reportWithReview(report: OptionsReport, review: PostTradeReview, copy: number): OptionsReport {
  const suffix = `-training-${copy}`;
  const topTrades = report.topTrades.map((idea) => ({ ...idea, id: `${idea.id}${suffix}` }));
  const trades = review.trades.map((trade) => ({
    ...trade,
    tradeId: `${trade.tradeId}${suffix}`,
    realizedPnlDollars: copy === 0 ? (trade.realizedPnlDollars ?? 0) : -(trade.realizedPnlDollars ?? 0) / 2
  }));
  return {
    ...report,
    reportId: `${report.reportId}${suffix}`,
    runMetadata: { ...report.runMetadata, reportDate: copy === 0 ? "2026-06-19" : "2026-06-20" },
    topTrades,
    postTradeReview: { ...review, trades }
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
