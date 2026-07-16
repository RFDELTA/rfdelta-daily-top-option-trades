import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { HistoricalFixtureProvider } from "../lib/market/fixture";
import { listSvgArtifacts } from "../lib/report/archive";
import { renderRankedScoresSvg, renderRiskRewardSvg, renderUnderlyingPriceSvg } from "../lib/report/charts";
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
  assert.ok(report.topTrades.every((idea) => idea.underlyingChart && idea.underlyingChart.points.length >= 21));
  for (const idea of report.topTrades) {
    const entrySvg = renderUnderlyingPriceSvg(idea);
    assert.match(entrySvg, /ENTRY \|/u);
    assert.doesNotMatch(entrySvg, /NaN|undefined|Infinity/u);
    const chart = idea.underlyingChart;
    assert.ok(chart);
    const closeDate = "2026-07-03";
    const closedSvg = renderUnderlyingPriceSvg({
      ...idea,
      underlyingChart: {
        ...chart,
        closeDate,
        closePrice: idea.underlyingMark * 1.05,
        points: [...chart.points, { date: closeDate, close: idea.underlyingMark * 1.05 }]
      }
    });
    assert.match(closedSvg, /EXPIRATION CLOSE \|/u);
  }
  const archiveRoot = await mkdtemp(path.join(tmpdir(), "rfdelta-chart-archive-"));
  try {
    const missingDirectory = path.join(archiveRoot, "missing");
    assert.deepEqual(await listSvgArtifacts(missingDirectory), []);
    const chartDirectory = path.join(archiveRoot, "underlying");
    await mkdir(chartDirectory);
    await Promise.all([
      writeFile(path.join(chartDirectory, "02-second.svg"), "<svg />"),
      writeFile(path.join(chartDirectory, "01-first.svg"), "<svg />"),
      writeFile(path.join(chartDirectory, "notes.txt"), "not a chart")
    ]);
    assert.deepEqual(await listSvgArtifacts(chartDirectory), ["01-first.svg", "02-second.svg"]);
  } finally {
    await rm(archiveRoot, { recursive: true, force: true });
  }
  console.log(`[test:charts] ideas=${report.topTrades.length} bounds=ok`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
