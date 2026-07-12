import Image from "next/image";
import Link from "next/link";
import type { OptionsReport } from "@/lib/report/types";
import { ReportMetrics } from "@/components/ReportMetrics";
import { TradeCard } from "@/components/TradeCard";

export function ReportOverview({ report, compact = false }: { report: OptionsReport; compact?: boolean }) {
  return (
    <section className={compact ? "report-overview compact" : "report-overview"}>
      <div className="content-width">
        <p className="eyebrow">RFDELTA Daily Market Intelligence</p>
        <h1>Top Option Trades</h1>
        <div className="issue-line">
          <time dateTime={report.runMetadata.reportDate}>{formatDate(report.runMetadata.reportDate)}</time>
          <span>{report.runMetadata.edition}</span>
        </div>
        <h2>{report.executiveSummary.headline}</h2>
        <p className="standfirst">{report.executiveSummary.standfirst}</p>
        {!compact && report.executiveSummary.marketCommentary.map((paragraph) => <p className="lead-copy" key={paragraph}>{paragraph}</p>)}
        <ReportMetrics report={report} />
      </div>
    </section>
  );
}

export function ScoreChart({ report }: { report: OptionsReport }) {
  return (
    <section className="chart-section">
      <div className="content-width">
        <p className="eyebrow">Ranked opportunity set</p>
        <h2>What leads the board</h2>
        <p className="section-intro">Every score uses the same probability, expected value, liquidity, payoff, model-edge and signal framework.</p>
        <Image className="report-chart desktop-chart" src={`/charts/${report.runMetadata.reportDate}/ranked_scores.svg`} width={1200} height={680} alt={`Ranked option trade scores for ${report.runMetadata.reportDate}`} priority />
        <div className="mobile-chart" aria-label={`Ranked option trade scores for ${report.runMetadata.reportDate}`}>
          {report.topTrades.map((idea) => (
            <div className="mobile-score-row" key={idea.id}>
              <div><strong>{idea.rank}. {idea.symbol} {idea.style.replaceAll("_", " ")}</strong><b>{idea.score.toFixed(2)}</b></div>
              <span>{idea.name}</span>
              <div className="mobile-score-track"><i style={{ width: `${Math.max(8, Math.min(100, idea.score))}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RiskRewardChart({ report }: { report: OptionsReport }) {
  const maxPayoff = Math.max(1, ...report.topTrades.flatMap((idea) => [idea.maxLossDollars, idea.maxProfitDollars]));
  return (
    <section className="chart-section alternate">
      <div className="content-width">
        <p className="eyebrow">Payoff discipline</p>
        <h2>Risk is known before the trade</h2>
        <p className="section-intro">Maximum loss and maximum profit are shown for one vertical spread using conservative entry prices.</p>
        <Image className="report-chart desktop-chart" src={`/charts/${report.runMetadata.reportDate}/risk_reward.svg`} width={1200} height={680} alt={`Risk and reward comparison for ${report.runMetadata.reportDate}`} />
        <div className="mobile-chart" aria-label={`Risk and reward comparison for ${report.runMetadata.reportDate}`}>
          {report.topTrades.map((idea) => (
            <div className="mobile-risk-row" key={idea.id}>
              <div><strong>{idea.rank}. {idea.symbol} {idea.style.replaceAll("_", " ")}</strong><b>{idea.rewardToRisk.toFixed(2)}x</b></div>
              <span>Max loss {money(idea.maxLossDollars)}</span>
              <div className="mobile-risk-track"><i className="loss" style={{ width: `${Math.max(5, idea.maxLossDollars / maxPayoff * 100)}%` }} /></div>
              <span>Max profit {money(idea.maxProfitDollars)}</span>
              <div className="mobile-risk-track"><i className="profit" style={{ width: `${Math.max(5, idea.maxProfitDollars / maxPayoff * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TradeList({ report, from = 0, to = report.topTrades.length }: { report: OptionsReport; from?: number; to?: number }) {
  const ideas = report.topTrades.slice(from, to);
  return (
    <section className="trades-section">
      <div className="content-width">
        <p className="eyebrow">Detailed trade intelligence</p>
        <h2>{ideas.length === 1 ? `Trade ${ideas[0]?.rank}` : `Trades ${ideas[0]?.rank ?? from + 1}-${ideas.at(-1)?.rank ?? to}`}</h2>
        <div className="trade-list">{ideas.map((idea) => <TradeCard idea={idea} key={idea.id} />)}</div>
      </div>
    </section>
  );
}

export function AccountabilityAndMethod({ report, showFullLink = false }: { report: OptionsReport; showFullLink?: boolean }) {
  return (
    <>
      <section className="accountability-section">
        <div className="content-width">
          <p className="eyebrow">Accountability ledger</p>
          <h2>What the prior basket actually did</h2>
          <p className="section-intro">{report.accountability.read}</p>
          <div className="outcome-summary">
            <span><strong>{report.accountability.wins}</strong> wins</span>
            <span><strong>{report.accountability.nearBreakeven}</strong> near breakeven</span>
            <span><strong>{report.accountability.losses}</strong> losses</span>
            <span><strong>{money(report.accountability.resolvedPnlDollars)}</strong> resolved P/L</span>
          </div>
          <div className="outcome-list">
            {report.accountability.trades.map((outcome) => (
              <article className="outcome-row" key={outcome.tradeId}>
                <div><strong>{outcome.name}</strong><span>{outcome.status.replaceAll("_", " ")}</span></div>
                <p>{outcome.read}</p>
                <strong>{outcome.realizedPnlDollars === undefined ? "Open" : money(outcome.realizedPnlDollars)}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="method-section">
        <div className="content-width method-grid">
          <div>
            <p className="eyebrow">Repeatable method</p>
            <h2>How the daily board is built</h2>
            <p>{report.methodology.executionAssumption}</p>
            <p>{report.methodology.marketDataStatement}</p>
          </div>
          <div>
            <h3>Selection rules</h3>
            <ul>{report.methodology.selectionCriteria.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
        <div className="content-width disclaimer">
          <p>{report.methodology.disclaimer}</p>
          {showFullLink && <Link href="/latest" target="_blank">Open the complete daily edition</Link>}
        </div>
      </section>
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
