import { promises as fs } from "node:fs";
import path from "node:path";
import { renderRankedScoresSvg, renderRiskRewardSvg, renderUnderlyingPriceSvg } from "@/lib/report/charts";
import { renderIdeasCsv, renderReportMarkdown } from "@/lib/report/renderers";
import type { OptionsReport, ReportIndex, ReportIndexItem } from "@/lib/report/types";

const ROOT = process.cwd();
const REPORTS_ROOT = path.join(ROOT, "data", "reports");
const INDEX_PATH = path.join(REPORTS_ROOT, "index.json");

export async function getReportIndex(): Promise<ReportIndex> {
  try {
    return JSON.parse(await fs.readFile(INDEX_PATH, "utf8")) as ReportIndex;
  } catch {
    return { latest: null, reports: [] };
  }
}

export async function getReport(date: string): Promise<OptionsReport> {
  const value = await fs.readFile(path.join(REPORTS_ROOT, date, "report.json"), "utf8");
  return JSON.parse(value) as OptionsReport;
}

export async function getLatestReport() {
  const index = await getReportIndex();
  if (!index.latest) throw new Error("No published report is available.");
  return getReport(index.latest);
}

export async function reportExists(date: string) {
  try {
    await fs.access(path.join(REPORTS_ROOT, date, "report.json"));
    return true;
  } catch {
    return false;
  }
}

export async function persistReport(report: OptionsReport) {
  const reportDirectory = path.join(REPORTS_ROOT, report.runMetadata.reportDate);
  const chartDirectory = path.join(ROOT, "public", "charts", report.runMetadata.reportDate);
  const underlyingDirectory = path.join(chartDirectory, "underlying");
  await Promise.all([fs.mkdir(reportDirectory, { recursive: true }), fs.mkdir(chartDirectory, { recursive: true }), fs.mkdir(underlyingDirectory, { recursive: true })]);
  await Promise.all([
    writeJson(path.join(reportDirectory, "report.json"), report),
    fs.writeFile(path.join(reportDirectory, "report.md"), renderReportMarkdown(report), "utf8"),
    fs.writeFile(path.join(reportDirectory, "ideas.csv"), renderIdeasCsv(report), "utf8"),
    fs.writeFile(path.join(chartDirectory, "ranked_scores.svg"), renderRankedScoresSvg(report), "utf8"),
    fs.writeFile(path.join(chartDirectory, "risk_reward.svg"), renderRiskRewardSvg(report), "utf8"),
    ...report.topTrades.filter((idea) => idea.underlyingChart).map((idea) =>
      fs.writeFile(chartFilePath(idea.underlyingChart?.assetPath ?? ""), renderUnderlyingPriceSvg(idea), "utf8")
    )
  ]);
  await updateIndex(report);
}

export async function persistUpdatedReports(reports: OptionsReport[]) {
  for (const report of reports) {
    const reportDirectory = path.join(REPORTS_ROOT, report.runMetadata.reportDate);
    const underlyingDirectory = path.join(ROOT, "public", "charts", report.runMetadata.reportDate, "underlying");
    await Promise.all([fs.mkdir(reportDirectory, { recursive: true }), fs.mkdir(underlyingDirectory, { recursive: true })]);
    await Promise.all([
      writeJson(path.join(reportDirectory, "report.json"), report),
      fs.writeFile(path.join(reportDirectory, "report.md"), renderReportMarkdown(report), "utf8"),
      fs.writeFile(path.join(reportDirectory, "ideas.csv"), renderIdeasCsv(report), "utf8"),
      ...report.topTrades.filter((idea) => idea.underlyingChart).map((idea) =>
        fs.writeFile(chartFilePath(idea.underlyingChart?.assetPath ?? ""), renderUnderlyingPriceSvg(idea), "utf8")
      )
    ]);
  }
}

async function updateIndex(report: OptionsReport) {
  const index = await getReportIndex();
  const item: ReportIndexItem = {
    date: report.runMetadata.reportDate,
    title: report.executiveSummary.headline,
    edition: report.runMetadata.edition,
    dataAsOfUtc: report.runMetadata.dataAsOfUtc,
    topSymbol: report.topTrades[0]?.symbol ?? "Cash",
    ideaCount: report.topTrades.length,
    topScore: report.topTrades[0]?.score ?? 0
  };
  const reports = [item, ...index.reports.filter((entry) => entry.date !== item.date)]
    .sort((a, b) => b.date.localeCompare(a.date));
  await fs.mkdir(REPORTS_ROOT, { recursive: true });
  await writeJson(INDEX_PATH, { latest: reports[0]?.date ?? null, reports } satisfies ReportIndex);
}

async function writeJson(filePath: string, value: unknown) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function chartFilePath(assetPath: string) {
  if (!/^\/charts\/\d{4}-\d{2}-\d{2}\/underlying\/[a-z0-9-]+\.svg$/u.test(assetPath)) {
    throw new Error("Underlying chart path is invalid.");
  }
  return path.join(ROOT, "public", assetPath.replace(/^\/+/, ""));
}
