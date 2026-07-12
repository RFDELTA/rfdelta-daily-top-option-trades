import type { OptionsReport } from "@/lib/report/types";

export function renderReportMarkdown(report: OptionsReport) {
  const lines = [
    `# RFDELTA Top Option Trades - ${report.runMetadata.reportDate}`,
    "",
    `**${report.executiveSummary.headline}**`,
    "",
    report.executiveSummary.standfirst,
    "",
    ...report.executiveSummary.marketCommentary.flatMap((paragraph) => [paragraph, ""]),
    ...report.executiveSummary.selectionCommentary.flatMap((paragraph) => [paragraph, ""]),
    `**Risk read:** ${report.executiveSummary.riskCommentary}`,
    "",
    "## Ranked Opportunities",
    "",
    "| Rank | Trade | Entry | Prob. Profit | EV | Max Loss | Max Profit | Score |",
    "|---:|---|---:|---:|---:|---:|---:|---:|",
    ...report.topTrades.map((idea) => `| ${idea.rank} | ${idea.name} | ${idea.structureType} ${idea.entry.toFixed(2)} | ${(idea.probabilityProfit * 100).toFixed(1)}% | ${money(idea.expectedValueDollars)} | ${money(idea.maxLossDollars)} | ${money(idea.maxProfitDollars)} | ${idea.score.toFixed(2)} |`),
    ""
  ];

  for (const idea of report.topTrades) {
    lines.push(
      `### ${idea.rank}. ${idea.name}`,
      "",
      `**${idea.commentary.convictionLabel}.** ${idea.commentary.rankingRead}`,
      "",
      idea.commentary.setup,
      "",
      `**Execution:** ${idea.commentary.execution}`,
      "",
      `**Risk:** ${idea.commentary.risk}`,
      "",
      `**Payoff:** ${idea.commentary.payoffRead}`,
      ""
    );
  }

  lines.push(
    "## Accountability",
    "",
    report.accountability.read,
    "",
    "| Prior trade | Outcome | Realized P/L | Read |",
    "|---|---|---:|---|",
    ...report.accountability.trades.map((outcome) => `| ${outcome.name} | ${outcome.status.replaceAll("_", " ")} | ${outcome.realizedPnlDollars === undefined ? "Open" : money(outcome.realizedPnlDollars)} | ${outcome.read} |`),
    "",
    "## Method",
    "",
    ...report.methodology.selectionCriteria.map((item) => `- ${item}`),
    ...report.methodology.rankingFramework.map((item) => `- ${item}`),
    "",
    report.methodology.executionAssumption,
    "",
    report.methodology.marketDataStatement,
    "",
    report.methodology.disclaimer,
    ""
  );
  return lines.join("\n");
}

export function renderIdeasCsv(report: OptionsReport) {
  const columns = [
    "rank", "symbol", "name", "style", "expiration", "dte", "underlying_mark", "entry_type", "entry",
    "probability_profit", "expected_value_dollars", "max_loss_dollars", "max_profit_dollars", "reward_to_risk",
    "breakeven", "required_move_pct", "score", "liquidity_score", "implied_volatility"
  ];
  const rows = report.topTrades.map((idea) => [
    idea.rank, idea.symbol, idea.name, idea.style, idea.expiration, idea.daysToExpiry, idea.underlyingMark,
    idea.structureType, idea.entry, idea.probabilityProfit, idea.expectedValueDollars, idea.maxLossDollars,
    idea.maxProfitDollars, idea.rewardToRisk, idea.breakeven, idea.requiredMovePctToBreakeven, idea.score,
    idea.liquidityScore, idea.impliedVolUsed
  ]);
  return `${columns.join(",")}\n${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function csvCell(value: unknown) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function money(value: number) {
  const sign = value < 0 ? "-$" : "$";
  return `${sign}${Math.abs(value).toFixed(2)}`;
}
