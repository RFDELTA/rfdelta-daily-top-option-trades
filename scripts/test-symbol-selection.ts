import assert from "node:assert/strict";
import { selectOptionChainSymbols } from "../lib/market/symbolSelection";
import type { EquityQuote } from "../lib/market/types";

function main() {
  const quotes = new Map<string, EquityQuote>();
  for (let index = 0; index < 40; index += 1) {
    const symbol = `T${String(index).padStart(2, "0")}`;
    quotes.set(symbol, quote(symbol, index === 39 ? 0.2 : index / 10_000, index === 0 ? 100_000_000 : 1_000 + index));
  }
  quotes.set("SPY", quote("SPY", 0.001, 50_000_000));
  quotes.set("QQQ", quote("QQQ", -0.002, 45_000_000));
  const options = { limit: 12, moverSlots: 4, volumeSlots: 2, coreSymbols: ["SPY", "QQQ"] };
  const first = selectOptionChainSymbols(quotes, "2026-07-13", options);
  const repeat = selectOptionChainSymbols(quotes, "2026-07-13", options);
  const nextDate = selectOptionChainSymbols(quotes, "2026-07-14", options);
  assert.deepEqual(first, repeat);
  assert.equal(first.selectedSymbolCount, 12);
  assert.deepEqual(first.core, ["SPY", "QQQ"]);
  assert.ok(first.movers.includes("T39"));
  assert.ok(first.volume.includes("T00"));
  assert.equal(new Set(first.selectedSymbols).size, first.selectedSymbols.length);
  assert.notDeepEqual(first.rotation, nextDate.rotation);
  assert.equal(first.core.length + first.movers.length + first.volume.length + first.rotation.length, first.selectedSymbolCount);
  console.log(`[test:selection] quoted=${first.quoteUniverseCount} chains=${first.selectedSymbolCount} core=${first.core.length} movers=${first.movers.length} volume=${first.volume.length} rotation=${first.rotation.length}`);
}

function quote(symbol: string, changePct: number, volume: number): EquityQuote {
  return {
    symbol,
    last: 100,
    bid: 99.9,
    ask: 100.1,
    previousClose: 100 / (1 + changePct),
    changePct,
    volume,
    tradeTimeUtc: "2026-07-13T15:00:00.000Z",
    sessionDate: "2026-07-13"
  };
}

main();
