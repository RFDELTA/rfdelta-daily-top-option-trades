import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildPublishBasket } from "../lib/model/basketOptimizer";
import { getDefaultModelSettings } from "../lib/model/settings";
import type { TradeIdeaScore } from "../lib/model/types";

const REGRESSION_DATASET = "data/datasets/2026-07-13/run-3d3c3f4f58060547/candidates.json";
const DISALLOWED = new Set([
  "max single-trade risk exceeded",
  "credit below width threshold",
  "short strike at/above spot",
  "call short strike at/below spot",
  "low debit probability",
  "low credit probability"
]);

async function main() {
  const payload = JSON.parse(await readFile(REGRESSION_DATASET, "utf8")) as { candidates: TradeIdeaScore[] };
  const settings = getDefaultModelSettings();
  const basket = buildPublishBasket(payload.candidates, settings);
  assert.equal(basket.length, settings.publishIdeaCount);
  assert.ok(basket.every((idea) => !idea.riskFlags.some((flag) => DISALLOWED.has(flag))));
  assert.ok(basket.reduce((total, idea) => total + idea.maxLossDollars, 0) <= settings.maxTotalBasketRiskDollars);
  assert.equal(new Set(basket.map((idea) => idea.symbol)).size, basket.length);
  console.log(`[test:basket] ideas=${basket.length} risk=${basket.reduce((total, idea) => total + idea.maxLossDollars, 0).toFixed(0)} symbols=${basket.map((idea) => idea.symbol).join(",")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
