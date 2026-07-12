import assert from "node:assert/strict";
import { HistoricalFixtureProvider } from "../lib/market/fixture";
import { discoverCandidates } from "../lib/model/candidateDiscovery";

async function main() {
  const provider = new HistoricalFixtureProvider();
  const snapshot = await provider.getSnapshot({ reportDate: "2026-06-19", universe: [] });
  const first = discoverCandidates(snapshot);
  const second = discoverCandidates(snapshot);
  assert.ok(first.candidates.length >= 10, `Expected at least 10 candidates, received ${first.candidates.length}`);
  assert.deepEqual(first.candidates.map((candidate) => candidate.id), second.candidates.map((candidate) => candidate.id));
  assert.ok(first.candidates.some((candidate) => candidate.structureType === "Debit"));
  assert.ok(first.candidates.some((candidate) => candidate.structureType === "Credit"));
  for (const candidate of first.candidates) {
    assert.ok(candidate.longLeg.ask > candidate.longLeg.bid);
    assert.ok(candidate.shortLeg.ask > candidate.shortLeg.bid);
    assert.ok(candidate.daysToExpiry >= 7 && candidate.daysToExpiry <= 35);
    assert.ok(candidate.liquidityScore > 0 && candidate.liquidityScore <= 1);
  }
  console.log(`[test:discovery] candidates=${first.candidates.length} deterministic=true`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
