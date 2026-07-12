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

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}
