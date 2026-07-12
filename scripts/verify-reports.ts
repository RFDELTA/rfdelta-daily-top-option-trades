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
  const expected = (dateIndex >= 0 ? process.argv[dateIndex + 1] : undefined) || process.env.EXPECTED_REPORT_DATE;
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
  console.log(`[verify] date=${index.latest} ideas=${report.topTrades.length} archive_count=${index.reports.length}`);
}

async function requireFile(filePath: string) {
  const stat = await fs.stat(filePath);
  if (!stat.isFile() || stat.size === 0) throw new Error(`Required output is empty: ${filePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
