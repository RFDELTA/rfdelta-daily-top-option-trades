import type { OptionsReport } from "@/lib/report/types";

export function renderReportMarkdown(report: OptionsReport) {
  const ledgers = report.accountabilityHistory?.length ? report.accountabilityHistory : [report.accountability];
  const marketRead = report.marketRead;
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
    const latestClose = idea.dailyCloses?.at(-1);
    lines.push(
      `### ${idea.rank}. ${idea.name}`,
      "",
      `**${idea.commentary.convictionLabel}.** ${idea.commentary.rankingRead}`,
      "",
      idea.commentary.setup,
      "",
      ...(idea.underlyingChart ? [
        `**Underlying chart:** [${idea.symbol} entry${idea.underlyingChart.closeDate ? " through expiration close" : " and open-position history"}](${idea.underlyingChart.assetPath}) at ${money(idea.underlyingChart.entryPrice)}${idea.underlyingChart.closePrice !== undefined ? `; expiration close ${money(idea.underlyingChart.closePrice)}` : latestClose ? `; latest official close ${money(latestClose.underlyingClose)} on ${latestClose.date}` : ""}.`,
        ""
      ] : []),
      ...(idea.advancedMetrics ? [
        `**Advanced metrics:** ${idea.advancedMetrics.historySessions} retained sessions; ${idea.advancedMetrics.historySessions >= 15 ? "RSI(14)" : "RSI proxy"} ${idea.advancedMetrics.rsi14.toFixed(1)}; MACD spread ${(idea.advancedMetrics.macdPct * 100).toFixed(2)}%; ${idea.advancedMetrics.historySessions >= 15 ? "ATR(14)" : "ATR proxy"} ${(idea.advancedMetrics.atr14Pct * 100).toFixed(2)}%; ${idea.advancedMetrics.historySessions >= 21 ? "realized volatility" : "volatility proxy"} ${(idea.advancedMetrics.realizedVol20 * 100).toFixed(1)}%; ATM implied volatility ${(idea.advancedMetrics.atmImpliedVol * 100).toFixed(1)}%; expected move ${(idea.advancedMetrics.expectedMovePct * 100).toFixed(1)}%. Outcome-trained score adjustment: ${signed(idea.trainingAdjustment)}.`,
        ""
      ] : []),
      `**Execution:** ${idea.commentary.execution}`,
      "",
      `**Risk:** ${idea.commentary.risk}`,
      "",
      `**Payoff:** ${idea.commentary.payoffRead}`,
      ""
    );
  }

  if (report.postTradeReview) {
    lines.push(
      "## Completed Basket Review",
      "",
      `**${report.postTradeReview.headline}**`,
      "",
      ...report.postTradeReview.commentary.flatMap((paragraph) => [paragraph, ""]),
      "| Trade | Outcome | Final P/L | Settlement read |",
      "|---|---|---:|---|",
      ...report.postTradeReview.trades.map((outcome) => `| ${outcome.name} | ${outcome.status.replaceAll("_", " ")} | ${money(outcome.realizedPnlDollars ?? 0)} | ${outcome.read} |`),
      ""
    );
  }

  lines.push("## Prior Basket Accountability", "");
  for (const ledger of ledgers) {
    lines.push(
      `### ${ledger.sourceReportDate ?? "Prior basket"}`,
      "",
      ledger.read,
      "",
      "| Prior trade | Outcome | Realized P/L | Read |",
      "|---|---|---:|---|",
      ...ledger.trades.map((outcome) => `| ${outcome.name} | ${outcome.status.replaceAll("_", " ")} | ${outcome.realizedPnlDollars === undefined ? "Open" : money(outcome.realizedPnlDollars)} | ${outcome.read} |`),
      ""
    );
  }

  lines.push("## Daily Market Read", "");
  if (marketRead) {
    lines.push(
      `**${marketRead.headline}**`,
      "",
      marketRead.standfirst,
      "",
      ...marketRead.commentary.flatMap((paragraph) => [paragraph, ""]),
      "### Market News Radar",
      "",
      ...(marketRead.newsRadar.length
        ? marketRead.newsRadar.map((item) => `- [${item.headline}](${item.url}) - ${item.publisher}, ${item.publishedAtUtc}`)
        : ["Price, options and retained-session evidence supply today's catalyst read."]),
      "",
      "### What to Watch",
      "",
      ...marketRead.watchItems.map((item) => `- **${item.label}: ${item.signal}.** ${item.read}`),
      "",
      marketRead.basis,
      ""
    );
  } else {
    lines.push(
      ...report.executiveSummary.marketCommentary.flatMap((paragraph) => [paragraph, ""]),
      ...report.executiveSummary.selectionCommentary.flatMap((paragraph) => [paragraph, ""])
    );
  }
  lines.push(report.methodology.disclaimer, "");
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

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}
