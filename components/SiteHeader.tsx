export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="wordmark" href="/latest" aria-label="RFDELTA Top Option Trades">
          <span>RFDELTA</span>
          <strong>TOP OPTION TRADES</strong>
        </a>
        <nav aria-label="Report navigation">
          <a href="/latest">Latest</a>
          <a href="/archive">Archive</a>
        </nav>
      </div>
    </header>
  );
}
