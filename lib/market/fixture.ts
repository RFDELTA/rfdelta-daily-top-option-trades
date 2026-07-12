import { blackScholesPrice, normCdf } from "@/lib/model/math";
import type { MarketDataProvider, MarketSnapshot, OptionContract, SnapshotRequest } from "@/lib/market/types";

const FIXTURE_SYMBOLS = [
  { symbol: "SPCE", spot: 3.4999, iv: 1.35, drift: 0.012 },
  { symbol: "OPEN", spot: 4.4866, iv: 0.82, drift: 0.006 },
  { symbol: "SOFI", spot: 17.8813, iv: 0.56, drift: 0.004 },
  { symbol: "QUBT", spot: 10.7, iv: 1.02, drift: 0.01 },
  { symbol: "NVDA", spot: 210.33, iv: 0.29, drift: 0.003 },
  { symbol: "AMC", spot: 2.79, iv: 0.9, drift: -0.004 },
  { symbol: "SOUN", spot: 7.1, iv: 0.72, drift: -0.002 },
  { symbol: "MARA", spot: 14.2174, iv: 0.82, drift: -0.006 },
  { symbol: "SMCI", spot: 30.72, iv: 0.84, drift: 0.002 },
  { symbol: "RGTI", spot: 21.23, iv: 1.03, drift: -0.008 }
];

export class HistoricalFixtureProvider implements MarketDataProvider {
  async getSnapshot(request: SnapshotRequest): Promise<MarketSnapshot> {
    const reportDate = request.reportDate;
    const expiration = addDays(reportDate, 14);
    const asOfUtc = `${reportDate}T15:45:00.000Z`;
    const symbols = FIXTURE_SYMBOLS.map((item, index) => {
      const bars = buildBars(item.spot, item.iv, item.drift, reportDate, index);
      return {
        symbol: item.symbol,
        quote: {
          symbol: item.symbol,
          last: item.spot,
          bid: item.spot * 0.999,
          ask: item.spot * 1.001,
          previousClose: item.spot / (1 + item.drift / 5),
          changePct: item.drift / 5,
          volume: 2_000_000 + index * 100_000,
          tradeTimeUtc: asOfUtc
        },
        bars,
        expiration,
        options: buildChain(item.symbol, item.spot, item.iv, expiration, reportDate, asOfUtc, index)
      };
    });
    return {
      provider: "historical-calibration-fixture",
      providerAttribution: "RFDELTA June 2026 historical calibration set",
      reportDate,
      sessionDate: reportDate,
      asOfUtc,
      universe: symbols.map((item) => item.symbol),
      symbols,
      excludedSymbols: []
    };
  }
}

function buildBars(spot: number, iv: number, drift: number, reportDate: string, seed: number) {
  let close = spot * Math.exp(-drift * 1.4);
  const raw = Array.from({ length: 31 }, (_, barIndex) => {
    const cyclicalShock = Math.sin((barIndex + seed * 0.7) * 1.17) * (iv / Math.sqrt(252)) * 0.62;
    close *= Math.exp(drift / 20 + cyclicalShock);
    return close;
  });
  const scale = spot / (raw.at(-1) ?? spot);
  return raw.map((value, barIndex) => {
    const adjusted = value * scale;
    const daysBack = 30 - barIndex;
    return {
      date: addDays(reportDate, -daysBack),
      open: adjusted * 0.997,
      high: adjusted * 1.018,
      low: adjusted * 0.982,
      close: adjusted,
      volume: 1_000_000 + seed * 75_000 + barIndex * 1_000
    };
  });
}

function buildChain(symbol: string, spot: number, iv: number, expiration: string, reportDate: string, asOfUtc: string, seed: number) {
  const dte = Math.max(1, dayDiff(reportDate, expiration));
  const t = dte / 365;
  const step = spot < 25 ? 0.5 : spot < 100 ? 1 : 2.5;
  const center = Math.round(spot / step) * step;
  const strikes = Array.from({ length: 17 }, (_, index) => Math.max(step, center + (index - 8) * step));
  const options: OptionContract[] = [];
  for (const strike of strikes) {
    for (const right of ["C", "P"] as const) {
      const fair = blackScholesPrice({ s: spot, k: strike, t, r: 0.045, sigma: iv, right });
      const halfSpread = Math.max(0.01, fair * (0.035 + (seed % 3) * 0.005));
      const bid = round(Math.max(0.01, fair - halfSpread), 2);
      const ask = round(Math.max(bid + 0.01, fair + halfSpread), 2);
      const d1 = (Math.log(spot / strike) + (0.045 + 0.5 * iv * iv) * t) / (iv * Math.sqrt(t));
      const callDelta = normCdf(d1);
      const delta = right === "C" ? callDelta : callDelta - 1;
      options.push({
        optionSymbol: `${symbol}${expiration.replaceAll("-", "")}${right}${String(Math.round(strike * 1000)).padStart(8, "0")}`,
        underlying: symbol,
        expiration,
        right,
        strike,
        bid,
        ask,
        last: round((bid + ask) / 2, 2),
        volume: 80 + ((Math.round(strike * 10) + seed * 17) % 500),
        openInterest: 250 + ((Math.round(strike * 100) + seed * 97) % 2500),
        delta,
        impliedVolatility: iv,
        quoteTimeUtc: asOfUtc
      });
    }
  }
  return options;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function dayDiff(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

function round(value: number, places: number) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
