import Image from "next/image";
import type { PublishedTradeIdea } from "@/lib/report/types";

export function TradeCard({ idea }: { idea: PublishedTradeIdea }) {
  return (
    <article className="trade-card">
      <div className="trade-rank" aria-hidden="true">{idea.rank}</div>
      <div className="trade-body">
        <div className="trade-heading">
          <div>
            <p className="eyebrow">{idea.commentary.convictionLabel} | {idea.theme}</p>
            <h3>{idea.name}</h3>
          </div>
          <div className="score-block">
            <span>RFDELTA score</span>
            <strong>{idea.score.toFixed(2)}</strong>
          </div>
        </div>
        <div className="trade-stat-grid">
          <Stat label={`${idea.structureType} entry`} value={idea.entry.toFixed(2)} />
          <Stat label="Prob. profit" value={percent(idea.probabilityProfit)} />
          <Stat label="Max loss" value={money(idea.maxLossDollars)} />
          <Stat label="Max profit" value={money(idea.maxProfitDollars)} />
          <Stat label="Breakeven" value={money(idea.breakeven)} />
          <Stat label="Reward / risk" value={`${idea.rewardToRisk.toFixed(2)}x`} />
        </div>
        <div className="commentary-grid">
          <section>
            <h4>Why it ranks</h4>
            <p>{idea.commentary.rankingRead}</p>
            <p>{idea.commentary.setup}</p>
          </section>
          <section>
            <h4>Trade construction</h4>
            <p>{idea.commentary.execution}</p>
            <p>{idea.commentary.payoffRead}</p>
          </section>
        </div>
        {idea.underlyingChart && (
          <figure className="underlying-chart-figure">
            <Image
              src={idea.underlyingChart.assetPath}
              width={1200}
              height={500}
              alt={`${idea.symbol} underlying price chart with entry${idea.underlyingChart.closeDate ? " and expiration close" : ""} marked`}
            />
            <figcaption>
              Underlying entry {money(idea.underlyingChart.entryPrice)} on {formatDate(idea.underlyingChart.entryDate)}
              {idea.underlyingChart.closeDate && idea.underlyingChart.closePrice !== undefined
                ? `; expiration close ${money(idea.underlyingChart.closePrice)} on ${formatDate(idea.underlyingChart.closeDate)}`
                : "; the expiration close will be added after the position resolves"}.
            </figcaption>
          </figure>
        )}
        {idea.advancedMetrics && (
          <div className="technical-grid" aria-label={`${idea.symbol} technical and options metrics`}>
            <Stat label="History" value={`${idea.advancedMetrics.historySessions} sessions`} />
            <Stat label={idea.advancedMetrics.historySessions >= 15 ? "RSI (14)" : "RSI proxy"} value={idea.advancedMetrics.rsi14.toFixed(1)} />
            <Stat label="MACD spread" value={percentSigned(idea.advancedMetrics.macdPct)} />
            <Stat label={idea.advancedMetrics.historySessions >= 15 ? "ATR (14)" : "ATR proxy"} value={percent(idea.advancedMetrics.atr14Pct)} />
            <Stat label={idea.advancedMetrics.historySessions >= 21 ? "Realized vol." : "Volatility proxy"} value={percent(idea.advancedMetrics.realizedVol20)} />
            <Stat label="ATM implied vol." value={percent(idea.advancedMetrics.atmImpliedVol)} />
            <Stat label="Expected move" value={percent(idea.advancedMetrics.expectedMovePct)} />
          </div>
        )}
        <div className="risk-read">
          <strong>Risk read</strong>
          <p>{idea.commentary.risk}</p>
        </div>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function percentSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}
