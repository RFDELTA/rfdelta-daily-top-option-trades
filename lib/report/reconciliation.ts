import { loadRetainedHistory } from "@/lib/market/history";
import type { DailyBar, MarketSnapshot } from "@/lib/market/types";
import { payoff } from "@/lib/model/math";
import type { OptionsReport, PostTradeReview, PublishedTradeIdea, TradeOutcome } from "@/lib/report/types";
import { getReport, getReportIndex } from "@/lib/report/store";

export type ArchiveReconciliation = {
  reports: OptionsReport[];
  updates: OptionsReport[];
};

export async function prepareArchiveReconciliation(snapshot: MarketSnapshot): Promise<ArchiveReconciliation> {
  const [index, retained] = await Promise.all([getReportIndex(), loadRetainedHistory()]);
  const reports = await Promise.all(index.reports.map((item) => getReport(item.date)));
  const updates: OptionsReport[] = [];
  const reconciled = reports.map((report) => {
    if (report.runMetadata.reportDate >= snapshot.reportDate || report.postTradeReview?.status === "complete") return report;
    const review = evaluateCompletedBasket(report, snapshot, retained);
    if (!review) return report;
    const updated = { ...report, postTradeReview: review } satisfies OptionsReport;
    updates.push(updated);
    return updated;
  });
  return { reports: reconciled, updates };
}

export function evaluateReportOutcomes(
  report: OptionsReport,
  snapshot: MarketSnapshot,
  retained: Record<string, DailyBar[]> = {}
): TradeOutcome[] {
  return report.topTrades.map((idea) => evaluateTradeOutcome(idea, snapshot, retained));
}

export function evaluateCompletedBasket(
  report: OptionsReport,
  snapshot: MarketSnapshot,
  retained: Record<string, DailyBar[]> = {}
): PostTradeReview | null {
  if (!report.topTrades.length) return null;
  const trades = evaluateReportOutcomes(report, snapshot, retained);
  if (trades.some((trade) => trade.status === "open" || trade.status === "awaiting_close")) return null;
  const wins = trades.filter((trade) => trade.status === "win").length;
  const losses = trades.filter((trade) => trade.status === "loss").length;
  const nearBreakeven = trades.filter((trade) => trade.status === "near_breakeven").length;
  const finalPnlDollars = round(trades.reduce((sum, trade) => sum + (trade.realizedPnlDollars ?? 0), 0), 2);
  const totalMaxRiskDollars = round(report.topTrades.reduce((sum, idea) => sum + idea.maxLossDollars, 0), 2);
  const sorted = [...trades].sort((a, b) => (b.realizedPnlDollars ?? 0) - (a.realizedPnlDollars ?? 0) || a.tradeId.localeCompare(b.tradeId));
  const best = sorted[0];
  const worst = sorted.at(-1);
  const winningStyles = styleSummary(report, trades, true);
  const losingStyles = styleSummary(report, trades, false);
  const completedOn = [...report.topTrades.map((idea) => idea.expiration)].sort().at(-1) ?? snapshot.sessionDate;
  const outcomeWord = finalPnlDollars > 0 ? "gain" : finalPnlDollars < 0 ? "loss" : "flat result";
  const headline = `${formatDate(report.runMetadata.reportDate)} basket closes with ${money(finalPnlDollars)} final P/L`;
  const commentary = [
    `The ${report.topTrades.length}-trade basket finished with ${wins} win${wins === 1 ? "" : "s"}, ${nearBreakeven} near-breakeven result${nearBreakeven === 1 ? "" : "s"} and ${losses} loss${losses === 1 ? "" : "es"}. The modeled one-lot portfolio produced a ${outcomeWord} of ${money(finalPnlDollars)}, equal to ${signedPct(finalPnlDollars / Math.max(totalMaxRiskDollars, 1))} of the maximum capital at risk.`,
    best ? `${best.name} was the strongest contributor at ${money(best.realizedPnlDollars ?? 0)}. ${worst && worst.tradeId !== best.tradeId ? `${worst.name} was the largest detractor at ${money(worst.realizedPnlDollars ?? 0)}.` : ""}`.trim() : "",
    winningStyles || losingStyles
      ? `${winningStyles ? `What worked: ${winningStyles}.` : ""} ${losingStyles ? `What needs tighter gating: ${losingStyles}.` : ""}`.trim()
      : "The completed basket adds another fully resolved observation to the selection archive."
  ].filter(Boolean);

  return {
    status: "complete",
    completedOn,
    evaluatedAtUtc: snapshot.asOfUtc,
    tradeCount: trades.length,
    wins,
    losses,
    nearBreakeven,
    totalMaxRiskDollars,
    finalPnlDollars,
    returnOnRisk: round(finalPnlDollars / Math.max(totalMaxRiskDollars, 1), 6),
    ...(best ? { bestTradeId: best.tradeId } : {}),
    ...(worst ? { worstTradeId: worst.tradeId } : {}),
    headline,
    commentary,
    trades
  };
}

function evaluateTradeOutcome(
  idea: PublishedTradeIdea,
  snapshot: MarketSnapshot,
  retained: Record<string, DailyBar[]>
): TradeOutcome {
  if (idea.expiration >= snapshot.sessionDate) {
    return baseOutcome(idea, "open", `The spread remains open through ${formatDate(idea.expiration)}; no expiration result is assigned.`);
  }
  const liveBars = snapshot.symbols.find((item) => item.symbol === idea.symbol)?.bars ?? [];
  const bars = mergeBars(retained[idea.symbol] ?? [], liveBars);
  const settlementBar = bars
    .filter((bar) => bar.date <= idea.expiration && dayDiff(bar.date, idea.expiration) <= 4)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!settlementBar) {
    return baseOutcome(idea, "awaiting_close", "The expiration close is not yet present in the retained history, so the outcome remains unscored.");
  }
  const width = Math.abs(idea.longLeg.strike - idea.shortLeg.strike);
  const debitGross = clamp(
    payoff(settlementBar.close, idea.longLeg.strike, idea.longLeg.right) - payoff(settlementBar.close, idea.shortLeg.strike, idea.shortLeg.right),
    0,
    width
  );
  const creditLiability = clamp(
    payoff(settlementBar.close, idea.shortLeg.strike, idea.shortLeg.right) - payoff(settlementBar.close, idea.longLeg.strike, idea.longLeg.right),
    0,
    width
  );
  const rawPnl = idea.structureType === "Debit" ? (debitGross - idea.entry) * 100 : (idea.entry - creditLiability) * 100;
  const realizedPnlDollars = round(clamp(rawPnl, -idea.maxLossDollars, idea.maxProfitDollars), 2);
  const status = realizedPnlDollars > 1 ? "win" : realizedPnlDollars < -1 ? "loss" : "near_breakeven";
  const settlementValue = idea.structureType === "Debit" ? debitGross : creditLiability;
  return {
    ...baseOutcome(idea, status, `${idea.symbol} closed at ${money(settlementBar.close)} for expiration settlement, producing ${money(realizedPnlDollars)} on the one-lot spread.`),
    settlementUnderlying: round(settlementBar.close, 4),
    settlementValue: round(settlementValue, 4),
    realizedPnlDollars
  };
}

function baseOutcome(idea: PublishedTradeIdea, status: TradeOutcome["status"], read: string): TradeOutcome {
  return {
    tradeId: idea.id,
    name: idea.name,
    symbol: idea.symbol,
    style: idea.style,
    expiration: idea.expiration,
    status,
    read
  };
}

function mergeBars(...groups: DailyBar[][]) {
  const values = new Map<string, DailyBar>();
  groups.flat().forEach((bar) => values.set(bar.date, bar));
  return [...values.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function styleSummary(report: OptionsReport, trades: TradeOutcome[], winners: boolean) {
  const selected = trades.filter((trade) => winners ? (trade.realizedPnlDollars ?? 0) > 1 : (trade.realizedPnlDollars ?? 0) < -1);
  const values = [...new Set(selected.map((trade) => report.topTrades.find((idea) => idea.id === trade.tradeId)?.style.replaceAll("_", " ")).filter((value): value is string => Boolean(value)))];
  return values.join(", ");
}

function dayDiff(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function money(value: number) {
  const prefix = value < 0 ? "-$" : "$";
  return `${prefix}${Math.abs(value).toFixed(2)}`;
}

function signedPct(value: number) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function round(value: number, places: number) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
