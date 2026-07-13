import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getReport, getReportIndex } from "../lib/report/store";

const forbiddenPublicPatterns = [
  /api status/iu,
  /connector[_ ]status/iu,
  /bridge health/iu,
  /mock data/iu,
  /research-only/iu,
  /no orders submitted/iu,
  /account buying power/iu,
  /internal status/iu,
  /failed with/iu,
  /posterior mean/iu,
  /survivor sleeve/iu,
  /strategy posterior/iu
];

async function main() {
  const index = await getReportIndex();
  if (!index.latest) throw new Error("No report is listed as latest.");
  const dateIndex = process.argv.indexOf("--date");
  const positionalDate = process.argv.find((value) => /^\d{4}-\d{2}-\d{2}$/u.test(value));
  const expected = (dateIndex >= 0 ? process.argv[dateIndex + 1] : undefined) || positionalDate || process.env.EXPECTED_REPORT_DATE;
  if (expected && index.latest !== expected) throw new Error(`Latest report is ${index.latest}; expected ${expected}.`);
  const report = await getReport(index.latest);
  if (report.topTrades.length === 0) throw new Error(`Report ${index.latest} contains no published ideas.`);
  if (report.analytics.publishedIdeaCount !== report.topTrades.length) throw new Error("Published idea count does not match the report body.");
  if (!report.runMetadata.selectionHash.match(/^[a-f0-9]{64}$/u)) throw new Error("Selection hash is missing or malformed.");
  const reportDirectory = path.join(process.cwd(), "data", "reports", index.latest);
  const chartDirectory = path.join(process.cwd(), "public", "charts", index.latest);
  for (const file of ["report.json", "report.md", "ideas.csv"]) await requireFile(path.join(reportDirectory, file));
  for (const file of ["ranked_scores.svg", "risk_reward.svg"]) await requireFile(path.join(chartDirectory, file));
  const markdown = await fs.readFile(path.join(reportDirectory, "report.md"), "utf8");
  const publicJson = await fs.readFile(path.join(reportDirectory, "report.json"), "utf8");
  for (const pattern of forbiddenPublicPatterns) {
    if (pattern.test(`${markdown}\n${publicJson}`)) throw new Error(`Public report contains internal-facing language matching ${pattern}.`);
  }
  if (report.runMetadata.methodologyVersion === "rfdelta-options-v2") {
    const runId = report.runMetadata.datasetRunId;
    if (!runId?.match(/^run-[a-f0-9]{16}$/u)) throw new Error("Dataset run identifier is missing or malformed.");
    if (!report.topTrades.every((idea) => idea.advancedMetrics && Number.isFinite(idea.trainingAdjustment))) {
      throw new Error("Published ideas are missing advanced metrics or training adjustments.");
    }
    const datasetDirectory = path.join(process.cwd(), "data", "datasets", report.runMetadata.reportDate, runId);
    const [manifest, features, candidates, policy] = await Promise.all([
      readJson(path.join(datasetDirectory, "manifest.json")),
      readJson(path.join(datasetDirectory, "market-features.json")),
      readJson(path.join(datasetDirectory, "candidates.json")),
      readJson(path.join(datasetDirectory, "selection-policy.json"))
    ]);
    if (String(manifest.reportId) !== report.reportId) throw new Error("Dataset manifest does not match the report.");
    if (String(manifest.featureDatasetHash) !== sha256(features)) throw new Error("Feature dataset hash does not match its manifest.");
    if (String(manifest.candidateDatasetHash) !== sha256(candidates)) throw new Error("Candidate dataset hash does not match its manifest.");
    if (String(manifest.selectionPolicyHash) !== sha256(policy)) throw new Error("Selection policy hash does not match its manifest.");
  }
  if (report.postTradeReview) {
    if (report.postTradeReview.trades.some((trade) => trade.status === "open" || trade.status === "awaiting_close")) {
      throw new Error("Completed post-trade review contains an unresolved trade.");
    }
    const pnl = round(report.postTradeReview.trades.reduce((sum, trade) => sum + (trade.realizedPnlDollars ?? 0), 0), 2);
    if (pnl !== report.postTradeReview.finalPnlDollars) throw new Error("Completed post-trade P/L does not reconcile.");
  }
  console.log(`[verify] date=${index.latest} ideas=${report.topTrades.length} archive_count=${index.reports.length}`);
}

async function requireFile(filePath: string) {
  const stat = await fs.stat(filePath);
  if (!stat.isFile() || stat.size === 0) throw new Error(`Required output is empty: ${filePath}`);
}

async function readJson(filePath: string): Promise<Record<string, unknown>> {
  await requireFile(filePath);
  return JSON.parse(await fs.readFile(filePath, "utf8")) as Record<string, unknown>;
}

function sha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function round(value: number, places: number) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
