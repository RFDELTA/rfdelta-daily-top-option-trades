import type { OptionsReport, PublishedTradeIdea } from "@/lib/report/types";

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

export function renderUnderlyingPriceSvg(idea: PublishedTradeIdea) {
  const width = 1200;
  const height = 500;
  const chart = idea.underlyingChart;
  if (!chart?.points.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(idea.symbol)} underlying price chart"><rect width="${width}" height="${height}" fill="#071f1c"/><text x="40" y="60" fill="#f4fff9" font-family="Arial,sans-serif" font-size="24">${escapeXml(idea.symbol)} underlying history</text></svg>`;
  }
  const margin = { top: 100, right: 58, bottom: 66, left: 86 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const values = chart.points.map((point) => point.close).concat(chart.entryPrice, chart.closePrice ?? []);
  const observedMinimum = Math.min(...values);
  const observedMaximum = Math.max(...values);
  const padding = Math.max((observedMaximum - observedMinimum) * 0.1, observedMaximum * 0.015, 0.25);
  const minimum = Math.max(0.01, observedMinimum - padding);
  const maximum = observedMaximum + padding;
  const range = Math.max(0.01, maximum - minimum);
  const x = (index: number) => margin.left + (chart.points.length === 1 ? plotWidth / 2 : index / (chart.points.length - 1) * plotWidth);
  const y = (value: number) => margin.top + (maximum - value) / range * plotHeight;
  const linePath = chart.points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.close).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${x(chart.points.length - 1).toFixed(1)},${(margin.top + plotHeight).toFixed(1)} L${x(0).toFixed(1)},${(margin.top + plotHeight).toFixed(1)} Z`;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = maximum - index / 4 * range;
    const gridY = y(value);
    return `<line x1="${margin.left}" x2="${width - margin.right}" y1="${gridY.toFixed(1)}" y2="${gridY.toFixed(1)}" stroke="#1b4a42" stroke-width="1"/><text x="${margin.left - 14}" y="${(gridY + 5).toFixed(1)}" text-anchor="end" class="axis">$${formatPrice(value)}</text>`;
  }).join("");
  const tickIndexes = [...new Set([0, Math.round((chart.points.length - 1) * 0.25), Math.round((chart.points.length - 1) * 0.5), Math.round((chart.points.length - 1) * 0.75), chart.points.length - 1])];
  const ticks = tickIndexes.map((index) => `<text x="${x(index).toFixed(1)}" y="${height - 28}" text-anchor="middle" class="axis">${escapeXml(shortDate(chart.points[index]?.date ?? ""))}</text>`).join("");
  const entryIndex = nearestDateIndex(chart.points.map((point) => point.date), chart.entryDate);
  const entryMarker = renderPriceMarker({
    x: x(entryIndex),
    y: y(chart.entryPrice),
    plotTop: margin.top,
    plotBottom: margin.top + plotHeight,
    width,
    color: "#18e59c",
    label: `ENTRY | ${shortDate(chart.entryDate)} | $${formatPrice(chart.entryPrice)}`
  });
  const closeMarker = chart.closeDate && chart.closePrice !== undefined
    ? renderPriceMarker({
      x: x(nearestDateIndex(chart.points.map((point) => point.date), chart.closeDate)),
      y: y(chart.closePrice),
      plotTop: margin.top,
      plotBottom: margin.top + plotHeight,
      width,
      color: "#f3bd5b",
      label: `EXPIRATION CLOSE | ${shortDate(chart.closeDate)} | $${formatPrice(chart.closePrice)}`
    })
    : "";
  const status = chart.closeDate ? "Entry through expiration settlement" : "Entry marked; position remains open";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(`${idea.symbol} underlying price from entry${chart.closeDate ? " through expiration close" : ""}`)}">
  <rect width="${width}" height="${height}" fill="#071f1c"/>
  <style>.head{fill:#f4fff9;font:800 27px Georgia,serif}.sub{fill:#9fc4bb;font:14px Arial,sans-serif}.axis{fill:#8eaaa3;font:12px Arial,sans-serif}.marker{font:800 12px Arial,sans-serif}</style>
  <text x="${margin.left}" y="40" class="head">${escapeXml(idea.symbol)} Underlying Price</text>
  <text x="${margin.left}" y="66" class="sub">${escapeXml(`${chart.points.length} sessions | ${status} | Published option idea rank ${idea.rank}`)}</text>
  ${grid}
  <path d="${areaPath}" fill="#0f5949" opacity="0.28"/>
  <path d="${linePath}" fill="none" stroke="#62d9ee" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  ${entryMarker}
  ${closeMarker}
  ${ticks}
  </svg>`;
}

function renderPriceMarker(args: { x: number; y: number; plotTop: number; plotBottom: number; width: number; color: string; label: string }) {
  const labelX = clamp(args.x, 170, args.width - 170);
  const labelY = args.y - args.plotTop < 48 ? args.y + 34 : args.y - 18;
  return `<g>
    <line x1="${args.x.toFixed(1)}" x2="${args.x.toFixed(1)}" y1="${args.plotTop}" y2="${args.plotBottom}" stroke="${args.color}" stroke-width="2" stroke-dasharray="7 7" opacity="0.8"/>
    <circle cx="${args.x.toFixed(1)}" cy="${args.y.toFixed(1)}" r="8" fill="#071f1c" stroke="${args.color}" stroke-width="4"/>
    <text x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" class="marker" fill="${args.color}">${escapeXml(args.label)}</text>
  </g>`;
}

function nearestDateIndex(dates: string[], target: string) {
  const exact = dates.indexOf(target);
  if (exact >= 0) return exact;
  return dates.reduce((best, date, index) => Math.abs(Date.parse(date) - Date.parse(target)) < Math.abs(Date.parse(dates[best] ?? date) - Date.parse(target)) ? index : best, 0);
}

function shortDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatPrice(value: number) {
  return value.toFixed(value < 10 ? 2 : 2);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
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
