import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="wordmark" href="/latest" aria-label="RFDELTA Top Option Trades">
          <span>RFDELTA</span>
          <strong>TOP OPTION TRADES</strong>
        </Link>
        <nav aria-label="Report navigation">
          <Link href="/latest">Latest</Link>
          <Link href="/archive">Archive</Link>
        </nav>
      </div>
    </header>
  );
}
