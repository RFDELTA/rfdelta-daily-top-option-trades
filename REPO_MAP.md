# Repository Map

| Path | Responsibility |
|---|---|
| `lib/market/tastytradeBridge.ts` | Primary read-only universe, quote and normalized-chain ingestion |
| `lib/market/history.ts` | Rolling deterministic daily price-history retention |
| `lib/market/provider.ts` | Explicit provider selection without silent fallback |
| `lib/market/tradier.ts` | Optional alternate quote, history, expiration and option-chain ingestion |
| `lib/market/fixture.ts` | Deterministic historical calibration surface used only in tests and the labeled archive edition |
| `lib/market/regime.ts` | Five/twenty-session momentum, realized volatility and directional regime |
| `lib/model/candidateDiscovery.ts` | Liquid vertical construction and deterministic leg selection |
| `lib/model/simulation.ts` | Conservative entry, implied volatility and jump-stress Monte Carlo |
| `lib/model/scoring.ts` | Common score, public risk flags and ranking classification |
| `lib/model/basketOptimizer.ts` | Risk, symbol and correlation diversification constraints |
| `lib/model/lessonLearning.ts` | Outcome-informed strategy-style posteriors |
| `lib/training/features.ts` | Advanced price, volatility, volume and options feature engineering |
| `lib/training/policy.ts` | Deterministic bounded outcome-trained selection policy |
| `lib/training/store.ts` | Immutable run datasets, policy state, manifests and hashes |
| `lib/report/generator.ts` | End-to-end report, commentary and accountability assembly |
| `lib/report/reconciliation.ts` | Expiration settlement and originating-report post-trade reviews |
| `lib/report/store.ts` | Immutable date archive, index and chart persistence |
| `lib/report/charts.ts` | Standalone SVG ranking and payoff graphics |
| `components/ReportSections.tsx` | Shared full-report and embed sections |
| `app/embed/[section]/page.tsx` | Six GoDaddy iframe routes |
| `scripts/generate-daily.ts` | Manual and scheduled production entry point |
| `scripts/smoke-bridge.ts` | Read-only market-data connectivity and response-shape check |
| `scripts/test-training-pipeline.ts` | Feature, policy and completed-basket deterministic verification |
| `scripts/verify-reports.ts` | Public-output and archive validation |
| `.github/workflows/daily-options-report.yml` | Single daily generation and publication workflow |
| `docs/godaddy-top-option-trades-blocks.html` | Standalone snippets for the GoDaddy page |
