import assert from "node:assert/strict";
import { HistoricalFixtureProvider } from "../lib/market/fixture";
import { renderRankedScoresSvg, renderRiskRewardSvg } from "../lib/report/charts";
import { buildReport } from "../lib/report/generator";

async function main() {
  const snapshot = await new HistoricalFixtureProvider().getSnapshot({ reportDate: "2026-06-19", universe: [] });
  const report = await buildReport(snapshot);
  const svgs = [renderRankedScoresSvg(report), renderRiskRewardSvg(report)];
  for (const svg of svgs) {
    assert.match(svg, /viewBox="0 0 1200 \d+"/u);
    assert.doesNotMatch(svg, /NaN|undefined|Infinity/u);
    for (const match of svg.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/gu)) {
      const x = Number(match[1]);
      const width = Number(match[2]);
      assert.ok(x + width <= 1200.01, `SVG rectangle crosses the 1200px viewBox: ${x} + ${width}`);
    }
  }
  assert.ok(renderRankedScoresSvg(report).includes("Labels and scores are separated from payoff bars"));
  console.log(`[test:charts] ideas=${report.topTrades.length} bounds=ok`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
