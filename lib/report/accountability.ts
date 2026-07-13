import type { DailyBar, MarketSnapshot } from "@/lib/market/types";
import { evaluateReportOutcomes } from "@/lib/report/reconciliation";
import type { AccountabilityLedger, OptionsReport, TradeOutcome } from "@/lib/report/types";

const DEFAULT_LEDGER_LIMIT = 8;

export function buildAccountabilityHistory(
  snapshot: MarketSnapshot,
  archiveReports: OptionsReport[],
  retainedHistory: Record<string, DailyBar[]>,
  fallbackOutcomes: TradeOutcome[],
  limit = DEFAULT_LEDGER_LIMIT
): AccountabilityLedger[] {
  const priorReports = archiveReports
    .filter((report) => report.runMetadata.reportDate < snapshot.reportDate)
    .sort((a, b) => b.runMetadata.reportDate.localeCompare(a.runMetadata.reportDate))
    .slice(0, Math.max(1, limit));

  const ledgers = priorReports.map((report) => summarizeOutcomes(
    report.postTradeReview?.trades ?? evaluateReportOutcomes(report, snapshot, retainedHistory),
    report.runMetadata.reportDate,
    snapshot.sessionDate,
    report.runMetadata.edition
  ));

  if (ledgers.length) return ledgers;
  return [summarizeOutcomes(
    fallbackOutcomes,
    "2026-06-18",
    snapshot.sessionDate,
    "Historical calibration edition"
  )];
}

export function summarizeOutcomes(
  trades: TradeOutcome[],
  sourceReportDate: string,
  evaluatedThrough: string,
  sourceEdition?: OptionsReport["runMetadata"]["edition"]
): AccountabilityLedger {
  const wins = trades.filter((trade) => trade.status === "win").length;
  const losses = trades.filter((trade) => trade.status === "loss").length;
  const nearBreakeven = trades.filter((trade) => trade.status === "near_breakeven").length;
  const activelyOpen = trades.filter((trade) => trade.status === "open").length;
  const awaitingClose = trades.filter((trade) => trade.status === "awaiting_close").length;
  const open = activelyOpen + awaitingClose;
  const resolvedPnlDollars = round(trades.reduce((sum, trade) => sum + (trade.realizedPnlDollars ?? 0), 0), 2);
  const resolved = wins + losses + nearBreakeven;
  const status = open === 0 ? "complete" : resolved > 0 ? "partially_resolved" : "open";
  const unresolvedRead = [
    activelyOpen ? `${activelyOpen} position${activelyOpen === 1 ? " remains" : "s remain"} open.` : "",
    awaitingClose ? `${awaitingClose} expired position${awaitingClose === 1 ? " is" : "s are"} awaiting a retained expiration close before scoring.` : ""
  ].filter(Boolean).join(" ");
  const read = resolved
    ? `The ${formatDate(sourceReportDate)} basket has ${wins} win${wins === 1 ? "" : "s"}, ${nearBreakeven} near-breakeven result${nearBreakeven === 1 ? "" : "s"} and ${losses} loss${losses === 1 ? "" : "es"} across ${resolved} resolved spread${resolved === 1 ? "" : "s"}, for modeled one-lot expiration P/L of ${money(resolvedPnlDollars)}. ${unresolvedRead || "All listed positions are resolved."}`
    : unresolvedRead
      ? `The ${formatDate(sourceReportDate)} basket has no scored expiration result yet. ${unresolvedRead}`
      : `The ${formatDate(sourceReportDate)} basket has no scored expiration result yet.`;
  return {
    sourceReportDate,
    ...(sourceEdition ? { sourceEdition } : {}),
    evaluatedThrough,
    status,
    wins,
    losses,
    nearBreakeven,
    open,
    resolvedPnlDollars,
    read,
    trades
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
}

function money(value: number) {
  const prefix = value < 0 ? "-$" : "$";
  return `${prefix}${Math.abs(value).toFixed(2)}`;
}

function round(value: number, places: number) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
