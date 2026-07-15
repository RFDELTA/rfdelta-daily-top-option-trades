import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildPublishBasket } from "../lib/model/basketOptimizer";
import { getDefaultModelSettings } from "../lib/model/settings";
import { scoreCandidate } from "../lib/model/scoring";
import { createInitialLessonSnapshot } from "../lib/model/lessonLearning";
import type { TradeCandidate } from "../lib/model/types";

const REGRESSION_DATASET = "data/datasets/2026-07-13/run-c4c8b8ff616c2943/candidates.json";
async function main() {
  const payload = JSON.parse(await readFile(REGRESSION_DATASET, "utf8")) as { candidates: unknown[] };
  const settings = { ...getDefaultModelSettings(), pathsPerCandidate: 5000 };
  const lessons = createInitialLessonSnapshot("2026-07-13T15:31:38.463Z");
  const rescored = (payload.candidates as TradeCandidate[])
    .map((candidate) => scoreCandidate(candidate, settings, lessons))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const basket = buildPublishBasket(rescored, settings);
  if (!basket.length) {
    console.log(JSON.stringify(rescored.slice(0, 8).map((idea) => ({
      symbol: idea.symbol,
      style: idea.style,
      score: idea.inference.eligibilityScore,
      probabilityMargin: idea.inference.probabilityMargin,
      conservativeEv: idea.inference.conservativeExpectedValueDollars,
      alignment: idea.inference.multiHorizonAlignment,
      session: idea.inference.sessionConfirmation,
      failures: idea.inference.hardGateFailures
    })), null, 2));
  }
  assert.ok(basket.length > 0 && basket.length <= settings.publishIdeaCount);
  assert.ok(basket.every((idea) => idea.publicationEligible && idea.inference.hardGateFailures.length === 0));
  assert.ok(basket.every((idea) => idea.inference.conservativeExpectedValueDollars >= 0));
  assert.ok(rescored.some((idea) => !idea.publicationEligible));
  assert.ok(rescored.filter((idea) => !idea.publicationEligible).every((idea) => !basket.some((selected) => selected.id === idea.id)));
  assert.ok(basket.reduce((total, idea) => total + idea.maxLossDollars, 0) <= settings.maxTotalBasketRiskDollars);
  assert.equal(new Set(basket.map((idea) => idea.symbol)).size, basket.length);
  console.log(`[test:basket] ideas=${basket.length} risk=${basket.reduce((total, idea) => total + idea.maxLossDollars, 0).toFixed(0)} symbols=${basket.map((idea) => idea.symbol).join(",")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
