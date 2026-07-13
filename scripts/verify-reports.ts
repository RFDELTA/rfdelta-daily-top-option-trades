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
  const expectedIdeaCount = Number(process.env.PUBLISH_IDEA_COUNT ?? 5);
  if (report.runMetadata.edition === "Daily market edition" && report.topTrades.length !== expectedIdeaCount) {
    throw new Error(`Daily report ${index.latest} contains ${report.topTrades.length} ideas; expected ${expectedIdeaCount}.`);
  }
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
    const ledgers = report.accountabilityHistory ?? [];
    if (!ledgers.length || ledgers.length > 8) throw new Error("Rolling accountability history is missing or exceeds its publication limit.");
    const ledgerDates = ledgers.map((ledger) => ledger.sourceReportDate ?? "");
    if (new Set(ledgerDates).size !== ledgerDates.length || ledgerDates.some((date, index) => !/^\d{4}-\d{2}-\d{2}$/u.test(date) || (index > 0 && date >= (ledgerDates[index - 1] ?? "")))) {
      throw new Error("Accountability ledgers are duplicated, malformed or out of descending order.");
    }
    for (const ledger of ledgers) {
      const resolved = ledger.wins + ledger.losses + ledger.nearBreakeven;
      if (resolved + ledger.open !== ledger.trades.length) throw new Error(`Accountability ledger ${ledger.sourceReportDate} does not reconcile to its trades.`);
      const pnl = round(ledger.trades.reduce((sum, trade) => sum + (trade.realizedPnlDollars ?? 0), 0), 2);
      if (pnl !== ledger.resolvedPnlDollars) throw new Error(`Accountability ledger ${ledger.sourceReportDate} P/L does not reconcile.`);
    }
    const marketRead = report.marketRead;
    if (!marketRead || marketRead.commentary.length < 4 || marketRead.watchItems.length < 5) {
      throw new Error("Daily Market Read commentary or watch coverage is incomplete.");
    }
    if (marketRead.lookbackSessionDates[0] !== report.runMetadata.reportDate || marketRead.lookbackSessionDates.length < 1 || marketRead.lookbackSessionDates.length > 5) {
      throw new Error("Daily Market Read session window is invalid.");
    }
    if (new Set(marketRead.lookbackSessionDates).size !== marketRead.lookbackSessionDates.length) throw new Error("Daily Market Read session window contains duplicate dates.");
    for (const item of marketRead.newsRadar) {
      if (!item.url.startsWith("https://") || item.publishedAtUtc > report.runMetadata.dataAsOfUtc) throw new Error("Daily Market Read contains an invalid or future news item.");
    }
    for (const idea of report.topTrades) {
      const chart = idea.underlyingChart;
      if (!chart || chart.entryDate !== report.runMetadata.reportDate || chart.entryPrice !== idea.underlyingMark || chart.points.length < 21) {
        throw new Error(`Published idea ${idea.id} is missing a valid underlying entry chart.`);
      }
      if (!/^\/charts\/\d{4}-\d{2}-\d{2}\/underlying\/[a-z0-9-]+\.svg$/u.test(chart.assetPath)) {
        throw new Error(`Published idea ${idea.id} has an invalid underlying chart path.`);
      }
      const chartPath = path.join(process.cwd(), "public", chart.assetPath.replace(/^\/+/, ""));
      await requireFile(chartPath);
      const chartSvg = await fs.readFile(chartPath, "utf8");
      if (!chartSvg.includes("ENTRY |")) throw new Error(`Underlying chart for ${idea.id} is missing its entry marker.`);
      if (chart.closeDate && !chartSvg.includes("EXPIRATION CLOSE |")) throw new Error(`Underlying chart for ${idea.id} is missing its expiration close marker.`);
      if (idea.dailyCloses) {
        const dates = idea.dailyCloses.map((print) => print.date);
        if (dates.some((date) => !/^\d{4}-\d{2}-\d{2}$/u.test(date) || date < report.runMetadata.reportDate || date > idea.expiration)) {
          throw new Error(`Published idea ${idea.id} contains an invalid daily close date.`);
        }
        if (new Set(dates).size !== dates.length || dates.some((date, index) => index > 0 && date <= (dates[index - 1] ?? ""))) {
          throw new Error(`Published idea ${idea.id} contains duplicate or unordered daily closes.`);
        }
        for (const print of idea.dailyCloses) {
          if (!Number.isFinite(print.underlyingClose) || print.underlyingClose <= 0) throw new Error(`Published idea ${idea.id} contains an invalid daily close.`);
          if (!chart.points.some((point) => point.date === print.date && point.close === print.underlyingClose)) {
            throw new Error(`Published idea ${idea.id} daily close is missing from its underlying chart.`);
          }
        }
      }
    }
    const underlyingDirectory = path.join(chartDirectory, "underlying");
    const expectedCharts = report.topTrades
      .map((idea) => path.basename(idea.underlyingChart?.assetPath ?? ""))
      .filter(Boolean)
      .sort();
    const actualCharts = (await fs.readdir(underlyingDirectory))
      .filter((file) => file.endsWith(".svg"))
      .sort();
    if (JSON.stringify(actualCharts) !== JSON.stringify(expectedCharts)) {
      throw new Error("Underlying chart archive contains missing or stale assets.");
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
    const historicalData = isRecord(features.historicalData) ? features.historicalData : undefined;
    if (historicalData) {
      if (manifest.historicalProvider !== historicalData.provider) throw new Error("Historical provider does not match the feature dataset.");
      if (manifest.historicalCoverageRatio !== historicalData.coverageRatio) throw new Error("Historical coverage does not match the feature dataset.");
      if (manifest.historicalBarCount !== historicalData.totalBarCount) throw new Error("Historical bar count does not match the feature dataset.");
    }
    const chainSelection = isRecord(features.chainSelection) ? features.chainSelection : undefined;
    if (chainSelection) {
      if (manifest.chainSelectionVersion !== chainSelection.strategyVersion) throw new Error("Chain-selection version does not match the feature dataset.");
      if (manifest.quotedSymbolCount !== chainSelection.quoteUniverseCount) throw new Error("Quoted-symbol count does not match the feature dataset.");
      if (manifest.chainSymbolCount !== chainSelection.selectedSymbolCount) throw new Error("Chain-symbol count does not match the feature dataset.");
      if (report.marketContext.quotedSymbolCount !== chainSelection.quoteUniverseCount || report.marketContext.chainSymbolCount !== chainSelection.selectedSymbolCount) {
        throw new Error("Public market-context counts do not match chain selection.");
      }
    }
  }
  if (report.postTradeReview) {
    if (report.postTradeReview.trades.some((trade) => trade.status === "open" || trade.status === "awaiting_close")) {
      throw new Error("Completed post-trade review contains an unresolved trade.");
    }
    const pnl = round(report.postTradeReview.trades.reduce((sum, trade) => sum + (trade.realizedPnlDollars ?? 0), 0), 2);
    if (pnl !== report.postTradeReview.finalPnlDollars) throw new Error("Completed post-trade P/L does not reconcile.");
    for (const outcome of report.postTradeReview.trades) {
      const idea = report.topTrades.find((candidate) => candidate.id === outcome.tradeId);
      if (!idea?.underlyingChart?.closeDate || idea.underlyingChart.closeDate !== outcome.settlementDate || idea.underlyingChart.closePrice !== outcome.settlementUnderlying) {
        throw new Error(`Completed trade ${outcome.tradeId} does not match its underlying close marker.`);
      }
    }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function round(value: number, places: number) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
