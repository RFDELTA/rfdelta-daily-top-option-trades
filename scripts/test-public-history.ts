import assert from "node:assert/strict";
import { hydratePublicHistoricalData } from "../lib/market/publicHistory";
import type { MarketSnapshot } from "../lib/market/types";

async function main() {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url.hostname);
    if (url.hostname === "query1.finance.yahoo.com") return jsonResponse({}, 503);
    return jsonResponse(yahooHistory());
  };
  const hydrated = await hydratePublicHistoricalData(snapshot(), {
    fetcher,
    lookbackDays: 60,
    maxBars: 260,
    concurrency: 1
  });
  assert.deepEqual(calls, [
    "query1.finance.yahoo.com",
    "query1.finance.yahoo.com",
    "query2.finance.yahoo.com"
  ]);
  assert.equal(hydrated.historicalData?.provider, "Yahoo Finance");
  assert.equal(hydrated.historicalData?.coverageRatio, 1);
  assert.equal(hydrated.historicalData?.totalBarCount, 3);
  assert.deepEqual(hydrated.symbols[0]?.bars.map((bar) => bar.date), ["2026-07-09", "2026-07-10", "2026-07-13"]);
  assert.equal(hydrated.symbols[0]?.bars.find((bar) => bar.date === "2026-07-10")?.close, 101);
  assert.equal(hydrated.symbols[0]?.bars.find((bar) => bar.date === "2026-07-13")?.close, 104);

  const unavailable = await hydratePublicHistoricalData(snapshot(), {
    fetcher: async () => new Response("browser verification", { status: 200, headers: { "Content-Type": "text/html" } }),
    lookbackDays: 60,
    concurrency: 1
  });
  assert.equal(unavailable.historicalData, undefined);
  assert.deepEqual(unavailable.symbols[0]?.bars, snapshot().symbols[0]?.bars);
  console.log(`[test:history] mirrors=${calls.length} sessions=${hydrated.symbols[0]?.bars.length} current_session_preserved=true`);
}

function snapshot(): MarketSnapshot {
  return {
    provider: "production-test",
    providerAttribution: "Test market data",
    reportDate: "2026-07-13",
    sessionDate: "2026-07-13",
    asOfUtc: "2026-07-13T15:00:00.000Z",
    universe: ["SPY"],
    symbols: [{
      symbol: "SPY",
      quote: {
        symbol: "SPY",
        last: 104,
        bid: 103.9,
        ask: 104.1,
        previousClose: 102,
        previousCloseDate: "2026-07-10",
        changePct: 104 / 102 - 1,
        volume: 1_000,
        tradeTimeUtc: "2026-07-13T15:00:00.000Z",
        sessionDate: "2026-07-13",
        dayOpen: 103,
        dayHigh: 105,
        dayLow: 102.5
      },
      bars: [
        { date: "2026-07-10", open: 100, high: 103, low: 99, close: 102, volume: 900 },
        { date: "2026-07-13", open: 103, high: 105, low: 102.5, close: 104, volume: 1_000 }
      ],
      expiration: "2026-07-24",
      options: []
    }],
    excludedSymbols: []
  };
}

function yahooHistory() {
  return {
    chart: {
      result: [{
        meta: { symbol: "SPY", exchangeTimezoneName: "America/New_York" },
        timestamp: [
          Date.parse("2026-07-09T13:30:00Z") / 1_000,
          Date.parse("2026-07-10T13:30:00Z") / 1_000,
          Date.parse("2026-07-13T13:30:00Z") / 1_000
        ],
        indicators: {
          quote: [{
            open: [98, 100, 102],
            high: [100, 102, 106],
            low: [97, 99, 101],
            close: [99, 101, 105],
            volume: [800, 900, 1_100]
          }]
        }
      }],
      error: null
    }
  };
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
