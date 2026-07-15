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
  const hasTrades = report.topTrades.length > 0;
  return (
    <section className="chart-section">
      <div className="content-width">
        <p className="eyebrow">Ranked opportunity set</p>
        <h2>What leads the board</h2>
        <p className="section-intro">Every score combines four payoff views, conservative expected value, liquidity, session follow-through and multi-session alignment.</p>
        {hasTrades
          ? <Image className="report-chart desktop-chart" src={`/charts/${report.runMetadata.reportDate}/ranked_scores.svg`} width={1200} height={680} alt={`Ranked option trade scores for ${report.runMetadata.reportDate}`} priority />
          : <p className="section-intro">No spread reached the publication threshold today. The full candidate screen remains part of the retained daily record.</p>}
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
  const hasTrades = report.topTrades.length > 0;
  const maxPayoff = Math.max(1, ...report.topTrades.flatMap((idea) => [idea.maxLossDollars, idea.maxProfitDollars]));
  return (
    <section className="chart-section alternate">
      <div className="content-width">
        <p className="eyebrow">Payoff discipline</p>
        <h2>Risk is known before the trade</h2>
        <p className="section-intro">Maximum loss and maximum profit are shown for one vertical spread using conservative entry prices.</p>
        {hasTrades
          ? <Image className="report-chart desktop-chart" src={`/charts/${report.runMetadata.reportDate}/risk_reward.svg`} width={1200} height={680} alt={`Risk and reward comparison for ${report.runMetadata.reportDate}`} />
          : <p className="section-intro">There is no recommended spread risk on the board for this session.</p>}
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
        <h2>{ideas.length === 0 ? "No qualifying trade today" : ideas.length === 1 ? `Trade ${ideas[0]?.rank}` : `Trades ${ideas[0]?.rank ?? from + 1}-${ideas.at(-1)?.rank ?? to}`}</h2>
        {ideas.length === 0
          ? <p className="section-intro">None of today&apos;s defined-risk spreads offered enough probability margin and conservative expected value at executable prices.</p>
          : <div className="trade-list">{ideas.map((idea) => <TradeCard idea={idea} key={idea.id} />)}</div>}
      </div>
    </section>
  );
}

export function AccountabilityAndMarketRead({ report, showFullLink = false }: { report: OptionsReport; showFullLink?: boolean }) {
  const ledgers = report.accountabilityHistory?.length ? report.accountabilityHistory : [report.accountability];
  const marketRead = report.marketRead ?? {
    asOfUtc: report.runMetadata.dataAsOfUtc,
    lookbackSessionDates: [report.runMetadata.reportDate],
    headline: "The option board favors selectivity over a broad market bet",
    standfirst: report.executiveSummary.standfirst,
    commentary: [...report.executiveSummary.marketCommentary, ...report.executiveSummary.selectionCommentary],
    newsRadar: [],
    watchItems: [{
      label: "Risk budget",
      signal: `${money(report.analytics.totalMaxLossDollars)} maximum one-lot basket loss`,
      read: report.executiveSummary.riskCommentary
    }],
    basis: report.methodology.marketDataStatement
  };
  return (
    <>
      {report.postTradeReview && (
        <section className="post-trade-section">
          <div className="content-width">
            <p className="eyebrow">Completed basket review</p>
            <h2>{report.postTradeReview.headline}</h2>
            {report.postTradeReview.commentary.map((paragraph) => <p className="section-intro" key={paragraph}>{paragraph}</p>)}
            <div className="outcome-summary">
              <span><strong>{report.postTradeReview.wins}</strong> wins</span>
              <span><strong>{report.postTradeReview.nearBreakeven}</strong> near breakeven</span>
              <span><strong>{report.postTradeReview.losses}</strong> losses</span>
              <span><strong>{money(report.postTradeReview.finalPnlDollars)}</strong> final P/L</span>
            </div>
            <div className="outcome-list">
              {report.postTradeReview.trades.map((outcome) => (
                <article className="outcome-row" key={outcome.tradeId}>
                  <div><strong>{outcome.name}</strong><span>{outcome.status.replaceAll("_", " ")}</span></div>
                  <p>{outcome.read}</p>
                  <strong>{money(outcome.realizedPnlDollars ?? 0)}</strong>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
      <section className="accountability-section">
        <div className="content-width">
          <p className="eyebrow">Accountability ledger</p>
          <h2>Every prior basket, one expanding record</h2>
          <p className="section-intro">Open positions remain visible beside completed baskets, preserving the original trade terms and the final modeled expiration result for each published day.</p>
          <div className="ledger-list">
            {ledgers.map((ledger, index) => {
              const resolved = ledger.wins + ledger.losses + ledger.nearBreakeven;
              const status = ledger.status ?? (ledger.open ? "open" : "complete");
              return (
                <details className="ledger-disclosure" open={index === 0} key={ledger.sourceReportDate ?? `ledger-${index}`}>
                  <summary>
                    <span className="ledger-heading">
                      <strong>{ledger.sourceReportDate ? formatDate(ledger.sourceReportDate) : "Prior basket"}</strong>
                      <small>{ledger.sourceEdition ?? "Published market edition"}</small>
                    </span>
                    <span className="ledger-summary-metrics">
                      <b>{status.replaceAll("_", " ")}</b>
                      <span>{resolved} resolved / {ledger.open} open</span>
                      <strong>{money(ledger.resolvedPnlDollars)}</strong>
                    </span>
                  </summary>
                  <div className="ledger-body">
                    <p className="section-intro">{ledger.read}</p>
                    <div className="outcome-summary">
                      <span><strong>{ledger.wins}</strong> wins</span>
                      <span><strong>{ledger.nearBreakeven}</strong> near breakeven</span>
                      <span><strong>{ledger.losses}</strong> losses</span>
                      <span><strong>{ledger.open}</strong> still open</span>
                    </div>
                    <div className="outcome-list">
                      {ledger.trades.map((outcome) => (
                        <article className="outcome-row" key={outcome.tradeId}>
                          <div><strong>{outcome.name}</strong><span>{outcome.status.replaceAll("_", " ")}</span></div>
                          <p>{outcome.read}</p>
                          <strong>{outcome.realizedPnlDollars === undefined ? "Open" : money(outcome.realizedPnlDollars)}</strong>
                        </article>
                      ))}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </section>
      <section className="market-read-section">
        <div className="content-width">
          <p className="eyebrow">Daily Market Read</p>
          <h2>{marketRead.headline}</h2>
          <p className="market-read-standfirst">{marketRead.standfirst}</p>
          <div className={marketRead.newsRadar.length ? "market-read-grid" : "market-read-grid market-read-grid-wide"}>
            <article className="market-read-commentary">
              {marketRead.commentary.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </article>
            {marketRead.newsRadar.length > 0 && (
              <aside className="news-radar">
                <h3>Market news radar</h3>
                <ol>
                  {marketRead.newsRadar.map((item) => (
                    <li key={item.url}>
                      <a href={item.url} target="_blank" rel="noreferrer">{item.headline}</a>
                      <span>{item.publisher} | {formatDateTime(item.publishedAtUtc)}</span>
                    </li>
                  ))}
                </ol>
              </aside>
            )}
          </div>
          <div className="watch-section">
            <p className="eyebrow">What to watch</p>
            <div className="watch-list">
              {marketRead.watchItems.map((item) => (
                <article className="watch-row" key={item.label}>
                  <div><strong>{item.label}</strong><span>{item.signal}</span></div>
                  <p>{item.read}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="disclaimer">
            <p>{marketRead.basis} {report.methodology.disclaimer}</p>
            {showFullLink && <Link href="/latest" target="_blank">Open the complete daily edition</Link>}
          </div>
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short"
  }).format(new Date(value));
}
