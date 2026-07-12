# Repository Map

| Path | Responsibility |
|---|---|
| `lib/market/tradier.ts` | Fail-closed production quote, history, expiration and option-chain ingestion |
| `lib/market/fixture.ts` | Deterministic historical calibration surface used only in tests and the labeled archive edition |
| `lib/market/regime.ts` | Five/twenty-session momentum, realized volatility and directional regime |
| `lib/model/candidateDiscovery.ts` | Liquid vertical construction and deterministic leg selection |
| `lib/model/simulation.ts` | Conservative entry, implied volatility and jump-stress Monte Carlo |
| `lib/model/scoring.ts` | Common score, public risk flags and ranking classification |
| `lib/model/basketOptimizer.ts` | Risk, symbol and correlation diversification constraints |
| `lib/model/lessonLearning.ts` | Outcome-informed strategy-style posteriors |
| `lib/report/generator.ts` | End-to-end report, commentary and accountability assembly |
| `lib/report/store.ts` | Immutable date archive, index and chart persistence |
| `lib/report/charts.ts` | Standalone SVG ranking and payoff graphics |
| `components/ReportSections.tsx` | Shared full-report and embed sections |
| `app/embed/[section]/page.tsx` | Six GoDaddy iframe routes |
| `scripts/generate-daily.ts` | Manual and scheduled production entry point |
| `scripts/verify-reports.ts` | Public-output and archive validation |
| `.github/workflows/daily-options-report.yml` | Single daily generation and publication workflow |
| `docs/godaddy-top-option-trades-blocks.html` | Standalone snippets for the GoDaddy page |
