import type { OptionsReport } from "@/lib/report/types";

const REPORT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_EDITORIAL_WORDS = 250;

export function reportEditorialWordCount(report: OptionsReport) {
  const marketRead = report.marketRead;
  const editorialText = [
    report.executiveSummary.headline,
    report.executiveSummary.standfirst,
    ...report.executiveSummary.marketCommentary,
    ...report.executiveSummary.selectionCommentary,
    report.executiveSummary.riskCommentary,
    ...(marketRead?.commentary ?? []),
    ...(marketRead?.watchItems.flatMap((item) => [item.label, item.signal, item.read]) ?? []),
    report.methodology.executionAssumption,
    report.methodology.marketDataStatement,
    report.methodology.publicationCadence,
    report.methodology.disclaimer,
    ...report.methodology.selectionCriteria,
    ...report.methodology.rankingFramework,
    ...report.topTrades.flatMap((trade) => [
      trade.name,
      trade.commentary.rankingRead,
      trade.commentary.setup,
      trade.commentary.execution,
      trade.commentary.risk,
      trade.commentary.payoffRead
    ])
  ].join(" ");

  return editorialText.match(/\p{L}[\p{L}\p{N}'’-]*/gu)?.length ?? 0;
}

export function isSubstantialPublicReport(report: OptionsReport) {
  return (
    report.schemaVersion === "1.0" &&
    REPORT_DATE_PATTERN.test(report.runMetadata.reportDate) &&
    Boolean(report.reportId.trim()) &&
    Boolean(report.executiveSummary.headline.trim()) &&
    Boolean(report.executiveSummary.standfirst.trim()) &&
    reportEditorialWordCount(report) >= MIN_EDITORIAL_WORDS
  );
}
