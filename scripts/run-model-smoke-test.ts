import assert from "node:assert/strict";
import calibrationOutcomes from "../data/calibration/prior-outcomes-2026-06-18.json";
import { HistoricalFixtureProvider } from "../lib/market/fixture";
import { buildPublishBasket } from "../lib/model/basketOptimizer";
import { discoverCandidates } from "../lib/model/candidateDiscovery";
import { applyRealizedBasketLesson, createInitialLessonSnapshot } from "../lib/model/lessonLearning";
import { scoreCandidate } from "../lib/model/scoring";
import { getDefaultModelSettings } from "../lib/model/settings";
import type { RealizedTradeOutcome } from "../lib/model/lessonLearning";
import type { SpreadStyle } from "../lib/model/types";

async function main() {
  const provider = new HistoricalFixtureProvider();
  const snapshot = await provider.getSnapshot({ reportDate: "2026-06-19", universe: [] });
  const discovery = discoverCandidates(snapshot);
  const outcomes: RealizedTradeOutcome[] = calibrationOutcomes.map((outcome) => ({
    id: outcome.tradeId,
    style: outcome.style as SpreadStyle,
    realizedPnlDollars: outcome.realizedPnlDollars,
    wasWinner: outcome.realizedPnlDollars > 0
  }));
  const lessons = applyRealizedBasketLesson(
    createInitialLessonSnapshot(snapshot.asOfUtc),
    "calibration-2026-06-18",
    outcomes,
    snapshot.asOfUtc
  );
  const settings = { ...getDefaultModelSettings(), pathsPerCandidate: 5000 };
  const ranked = discovery.candidates
    .map((candidate) => scoreCandidate(candidate, settings, lessons))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map((idea, index) => ({ ...idea, rank: index + 1 }));
  const basket = buildPublishBasket(ranked, settings);
  assert.equal(basket.length, 5);
  assert.equal(new Set(basket.map((idea) => idea.symbol)).size, basket.length);
  assert.ok(basket.some((idea) => idea.structureType === "Credit"));
  assert.ok(basket.filter((idea) => idea.structureType === "Debit").length >= 2);
  assert.ok(basket.reduce((sum, idea) => sum + idea.maxLossDollars, 0) <= settings.maxTotalBasketRiskDollars);
  console.log(JSON.stringify({
    ok: true,
    candidates: ranked.length,
    finalBasket: basket.map((idea) => ({ rank: idea.rank, name: idea.name, type: idea.structureType, ev: idea.expectedValueDollars, score: idea.score }))
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
