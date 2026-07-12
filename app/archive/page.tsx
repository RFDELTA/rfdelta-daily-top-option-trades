import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { getReportIndex } from "@/lib/report/store";

export const metadata: Metadata = { title: "Report Archive" };

export default async function ArchivePage() {
  const index = await getReportIndex();
  return (
    <>
      <SiteHeader />
      <main className="archive-page">
        <section className="archive-heading">
          <div className="content-width">
            <p className="eyebrow">RFDELTA archive</p>
            <h1>Top Option Trades</h1>
            <p>Daily rankings, payoff graphics, market commentary and outcome accountability, retained by market session.</p>
          </div>
        </section>
        <section className="archive-list-section">
          <div className="content-width archive-list">
            {index.reports.map((report) => (
              <article className="archive-card" key={report.date}>
                <div>
                  <time dateTime={report.date}>{formatDate(report.date)}</time>
                  <h2>{report.title}</h2>
                  <p>{report.ideaCount} ranked ideas | Top symbol {report.topSymbol} | Score {report.topScore.toFixed(2)}</p>
                </div>
                <Link href={`/reports/${report.date}`}>Read edition</Link>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}
