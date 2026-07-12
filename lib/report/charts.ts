import type { OptionsReport } from "@/lib/report/types";

export function renderRankedScoresSvg(report: OptionsReport) {
  const width = 1200;
  const rowHeight = 112;
  const height = 112 + report.topTrades.length * rowHeight;
  const maxScore = Math.max(100, ...report.topTrades.map((idea) => idea.score));
  const rows = report.topTrades.map((idea, index) => {
    const y = 105 + index * rowHeight;
    const barWidth = Math.max(10, (idea.score / maxScore) * 1070);
    const title = wrapLabel(idea.name, 72);
    return `<g>
      <text x="34" y="${y}" class="rank">${idea.rank}</text>
      <text x="78" y="${y}" class="title">${title.map((line, lineIndex) => `<tspan x="78" dy="${lineIndex === 0 ? 0 : 20}">${escapeXml(line)}</tspan>`).join("")}</text>
      <text x="1166" y="${y}" class="score" text-anchor="end">${idea.score.toFixed(2)}</text>
      <text x="78" y="${y + 39}" class="meta">${escapeXml(`${idea.theme} | ${idea.structureType.toLowerCase()} | ${Math.round(idea.probabilityProfit * 100)}% modeled probability`)}</text>
      <rect x="78" y="${y + 56}" width="1070" height="16" rx="3" fill="#143b36"/>
      <rect x="78" y="${y + 56}" width="${barWidth.toFixed(1)}" height="16" rx="3" fill="url(#scoreBar)"/>
    </g>`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="RFDELTA ranked option trade scores">
  <defs>
    <linearGradient id="background" x1="0" x2="1"><stop stop-color="#061b19"/><stop offset="1" stop-color="#0a2d28"/></linearGradient>
    <linearGradient id="scoreBar" x1="0" x2="1"><stop stop-color="#18e59c"/><stop offset="0.7" stop-color="#5bd7f4"/><stop offset="1" stop-color="#f4c95d"/></linearGradient>
    <style>.title{fill:#f4fff9;font:700 18px Arial,sans-serif}.rank,.score{fill:#f4fff9;font:800 18px Arial,sans-serif}.meta{fill:#9fc4bb;font:13px Arial,sans-serif}.head{fill:#f4fff9;font:800 28px Georgia,serif}.sub{fill:#9fc4bb;font:14px Arial,sans-serif}</style>
  </defs>
  <rect width="1200" height="${height}" fill="url(#background)"/>
  <text x="34" y="42" class="head">RFDELTA Top Option Trades</text>
  <text x="34" y="69" class="sub">Deterministic ranking for ${escapeXml(report.runMetadata.reportDate)}. Labels and scores are separated from payoff bars for legibility.</text>
  ${rows}
  </svg>`;
}

export function renderRiskRewardSvg(report: OptionsReport) {
  const width = 1200;
  const rowHeight = 104;
  const height = 108 + report.topTrades.length * rowHeight;
  const maxValue = Math.max(1, ...report.topTrades.flatMap((idea) => [idea.maxLossDollars, idea.maxProfitDollars]));
  const rows = report.topTrades.map((idea, index) => {
    const y = 100 + index * rowHeight;
    const lossWidth = Math.max(5, idea.maxLossDollars / maxValue * 350);
    const profitWidth = Math.max(5, idea.maxProfitDollars / maxValue * 350);
    return `<g>
      <text x="34" y="${y}" class="label">${escapeXml(`${idea.rank}. ${idea.symbol} ${styleLabel(idea.style)}`)}</text>
      <text x="1166" y="${y}" class="ratio" text-anchor="end">${idea.rewardToRisk.toFixed(2)}x reward/risk</text>
      <text x="34" y="${y + 31}" class="lossText">MAX LOSS $${idea.maxLossDollars.toFixed(0)}</text>
      <rect x="180" y="${y + 18}" width="${lossWidth.toFixed(1)}" height="18" rx="3" fill="#f29e5b"/>
      <text x="620" y="${y + 31}" class="profitText">MAX PROFIT $${idea.maxProfitDollars.toFixed(0)}</text>
      <rect x="800" y="${y + 18}" width="${profitWidth.toFixed(1)}" height="18" rx="3" fill="#58d8ee"/>
      <line x1="34" x2="1166" y1="${y + 62}" y2="${y + 62}" stroke="#1e4a43"/>
    </g>`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="RFDELTA option trade risk and reward comparison">
  <rect width="1200" height="${height}" fill="#071f1c"/>
  <style>.head{fill:#f4fff9;font:800 28px Georgia,serif}.sub{fill:#9fc4bb;font:14px Arial,sans-serif}.label,.ratio{fill:#f4fff9;font:700 16px Arial,sans-serif}.lossText{fill:#f2b17b;font:800 12px Arial,sans-serif}.profitText{fill:#7ce3f4;font:800 12px Arial,sans-serif}</style>
  <text x="34" y="42" class="head">Defined Risk Versus Maximum Payoff</text>
  <text x="34" y="68" class="sub">One contract per spread, excluding commissions and assignment costs.</text>
  ${rows}
  </svg>`;
}

function styleLabel(style: string) {
  return style.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function wrapLabel(value: string, maxLength: number) {
  const lines: string[] = [];
  let current = "";
  for (const word of value.split(/\s+/u)) {
    const next = current ? `${current} ${word}` : word;
    if (!current || next.length <= maxLength) current = next;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
