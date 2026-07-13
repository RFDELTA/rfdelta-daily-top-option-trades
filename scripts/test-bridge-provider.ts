import assert from "node:assert/strict";
import { TastytradeBridgeMarketDataProvider } from "../lib/market/tastytradeBridge";

async function main() {
  const calls: Array<{ url: string; key: string }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({ url, key: headers.get("X-Proxy-Key") ?? "" });
    if (url.endsWith("/scan-universe/full")) {
      return jsonResponse({}, 403);
    }
    if (url.endsWith("/scan-universe/default")) {
      return jsonResponse({ data: { equities: ["SPY", "QQQ"], fingerprint: "fixture-fingerprint" } });
    }
    if (url.includes("/quotes/equities?")) {
      return jsonResponse({
        data: {
          items: [{
            symbol: "SPY",
            bid: 600.9,
            ask: 601.1,
            last: 601,
            "prev-close": 595,
            "prev-close-date": "2026-07-10",
            "summary-date": "2026-07-13",
            "updated-at": "2026-07-13T15:00:00Z",
            open: 597,
            "day-high-price": 602,
            "day-low-price": 596,
            volume: 1000000
          }]
        }
      });
    }
    if (url.includes("/normalized/equity-chain/SPY?")) {
      return jsonResponse({ data: { items: optionItems() } });
    }
    return jsonResponse({}, 404);
  };
  const provider = new TastytradeBridgeMarketDataProvider({
    apiKey: "test-key",
    baseUrl: "https://market.example.test",
    fetcher,
    retainedHistory: {}
  });
  const snapshot = await provider.getSnapshot({ reportDate: "2026-07-13", universe: ["SPY", "MISSING"] });
  assert.deepEqual(snapshot.universe, ["SPY"]);
  assert.equal(snapshot.symbols.length, 1);
  assert.equal(snapshot.symbols[0]?.expiration, "2026-07-24");
  assert.equal(snapshot.symbols[0]?.options.length, 4);
  assert.deepEqual(snapshot.symbols[0]?.bars.map((bar) => bar.date), ["2026-07-10", "2026-07-13"]);
  assert.ok(calls.every((call) => call.key === "test-key"));
  assert.ok(calls.every((call) => !/orders|accounts|transactions/u.test(call.url)));
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
    "/scan-universe/full",
    "/scan-universe/default",
    "/quotes/equities",
    "/normalized/equity-chain/SPY"
  ]);
  console.log(`[test:bridge] calls=${calls.length} market_data_only=true history_sessions=${snapshot.symbols[0]?.bars.length}`);
}

function optionItems() {
  return [
    option("SPY260724C00595000", "C", 595, 11.2, 11.5, 1200, 400),
    option("SPY260724C00605000", "C", 605, 5.2, 5.5, 900, 350),
    option("SPY260724P00595000", "P", 595, 4.8, 5.1, 800, 300),
    option("SPY260724P00605000", "P", 605, 9.8, 10.1, 700, 250)
  ];
}

function option(symbol: string, right: "C" | "P", strike: number, bid: number, ask: number, openInterest: number, volume: number) {
  return {
    symbol,
    expiration_date: "2026-07-24",
    right,
    strike,
    bid,
    ask,
    last: (bid + ask) / 2,
    volume,
    "open-interest": openInterest,
    "updated-at": "2026-07-13T15:00:00Z"
  };
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
