import type {
  DailyBar,
  EquityQuote,
  MarketDataProvider,
  MarketSnapshot,
  MarketSymbolSnapshot,
  OptionContract,
  SnapshotRequest
} from "@/lib/market/types";
import { NoFreshMarketSessionError } from "@/lib/market/types";

type JsonRecord = Record<string, unknown>;

export class TradierMarketDataProvider implements MarketDataProvider {
  private readonly token: string;
  private readonly baseUrl: string;

  constructor() {
    this.token = process.env.TRADIER_ACCESS_TOKEN?.trim() ?? "";
    this.baseUrl = (process.env.TRADIER_BASE_URL?.trim() || "https://api.tradier.com/v1").replace(/\/$/u, "");
    if (!this.token) throw new Error("TRADIER_ACCESS_TOKEN is required for production generation.");
    if (process.env.MARKET_DATA_PUBLICATION_LICENSE_ACKNOWLEDGED !== "true") {
      throw new Error("MARKET_DATA_PUBLICATION_LICENSE_ACKNOWLEDGED must be true before public generation.");
    }
  }

  async getSnapshot(request: SnapshotRequest): Promise<MarketSnapshot> {
    const quotes = await this.getQuotes(request.universe);
    const excludedSymbols: MarketSnapshot["excludedSymbols"] = [];
    const symbols = await mapLimit(request.universe, 4, async (symbol) => {
      const quote = quotes.get(symbol);
      if (!quote) {
        excludedSymbols.push({ symbol, reason: "No current underlying quote" });
        return null;
      }
      const quoteSession = dateInTimeZone(new Date(quote.tradeTimeUtc), "America/New_York");
      if (process.env.REPORT_REQUIRE_SAME_SESSION_QUOTES !== "false" && quoteSession !== request.reportDate) {
        excludedSymbols.push({ symbol, reason: `Underlying quote belongs to ${quoteSession}` });
        return null;
      }

      try {
        const [bars, expirations] = await Promise.all([
          this.getHistory(symbol, addDays(request.reportDate, -70), request.reportDate),
          this.getExpirations(symbol)
        ]);
        const expiration = chooseExpiration(expirations, request.reportDate);
        if (!expiration) {
          excludedSymbols.push({ symbol, reason: "No expiration inside the configured DTE window" });
          return null;
        }
        const options = await this.getChain(symbol, expiration, quote.tradeTimeUtc);
        if (options.length < 4) {
          excludedSymbols.push({ symbol, reason: "Option chain did not contain enough quoted contracts" });
          return null;
        }
        return { symbol, quote, bars, expiration, options } satisfies MarketSymbolSnapshot;
      } catch (error) {
        excludedSymbols.push({
          symbol,
          reason: error instanceof Error ? error.message : "Market data request did not complete"
        });
        return null;
      }
    });

    const included = symbols.filter((symbol): symbol is MarketSymbolSnapshot => symbol !== null);
    const freshRatio = included.length / Math.max(1, request.universe.length);
    if (freshRatio < 0.5) {
      throw new NoFreshMarketSessionError(
        `Only ${included.length} of ${request.universe.length} symbols had same-session option data for ${request.reportDate}.`
      );
    }
    const asOfUtc = included
      .map((item) => item.quote.tradeTimeUtc)
      .sort()
      .at(-1) ?? new Date(`${request.reportDate}T00:00:00Z`).toISOString();

    return {
      provider: "tradier-production",
      providerAttribution: "Licensed U.S. equity and options market data",
      reportDate: request.reportDate,
      sessionDate: request.reportDate,
      asOfUtc,
      universe: request.universe,
      symbols: included,
      excludedSymbols: excludedSymbols.sort((a, b) => a.symbol.localeCompare(b.symbol))
    };
  }

  private async getQuotes(symbols: string[]) {
    const json = await this.fetchJson(`/markets/quotes?symbols=${encodeURIComponent(symbols.join(","))}&greeks=false`);
    const values = toArray(asRecord(asRecord(json)?.quotes)?.quote);
    const quotes = new Map<string, EquityQuote>();
    for (const value of values) {
      const item = asRecord(value);
      const symbol = stringValue(item?.symbol).toUpperCase();
      const last = numberValue(item?.last) || midpoint(numberValue(item?.bid), numberValue(item?.ask));
      const tradeTimeUtc = timestampValue(item?.trade_date) ?? timestampValue(item?.bid_date) ?? timestampValue(item?.ask_date);
      if (!symbol || last <= 0 || !tradeTimeUtc) continue;
      const previousClose = numberValue(item?.prevclose) || last - numberValue(item?.change);
      quotes.set(symbol, {
        symbol,
        last,
        bid: numberValue(item?.bid),
        ask: numberValue(item?.ask),
        previousClose,
        changePct: numberValue(item?.change_percentage) / 100,
        volume: numberValue(item?.volume),
        tradeTimeUtc
      });
    }
    return quotes;
  }

  private async getExpirations(symbol: string) {
    const json = await this.fetchJson(`/markets/options/expirations?symbol=${encodeURIComponent(symbol)}&includeAllRoots=false`);
    return toArray(asRecord(asRecord(json)?.expirations)?.date)
      .map(stringValue)
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/u.test(date));
  }

  private async getChain(symbol: string, expiration: string, quoteTimeUtc: string) {
    const json = await this.fetchJson(`/markets/options/chains?symbol=${encodeURIComponent(symbol)}&expiration=${expiration}&greeks=true`);
    return toArray(asRecord(asRecord(json)?.options)?.option)
      .map((value): OptionContract | null => {
        const item = asRecord(value);
        const type = stringValue(item?.option_type || item?.type).toLowerCase();
        const right = type === "call" ? "C" : type === "put" ? "P" : null;
        const strike = numberValue(item?.strike);
        const bid = numberValue(item?.bid);
        const ask = numberValue(item?.ask);
        const greeks = asRecord(item?.greeks);
        if (!right || strike <= 0 || ask <= 0 || ask < bid) return null;
        const updated = timestampValue(greeks?.updated_at) ?? quoteTimeUtc;
        const iv = firstPositive(greeks?.mid_iv, greeks?.smv_vol, greeks?.ask_iv, greeks?.bid_iv);
        const delta = numberOrUndefined(greeks?.delta);
        return {
          optionSymbol: stringValue(item?.symbol),
          underlying: symbol,
          expiration: stringValue(item?.expiration_date) || expiration,
          right,
          strike,
          bid,
          ask,
          last: numberValue(item?.last),
          volume: numberValue(item?.volume),
          openInterest: numberValue(item?.open_interest),
          ...(delta !== undefined ? { delta } : {}),
          ...(iv !== undefined ? { impliedVolatility: normalizeIv(iv) } : {}),
          quoteTimeUtc: updated
        };
      })
      .filter((contract): contract is OptionContract => contract !== null)
      .sort((a, b) => a.right.localeCompare(b.right) || a.strike - b.strike || a.optionSymbol.localeCompare(b.optionSymbol));
  }

  private async getHistory(symbol: string, start: string, end: string) {
    const json = await this.fetchJson(`/markets/history?symbol=${encodeURIComponent(symbol)}&interval=daily&start=${start}&end=${end}`);
    return toArray(asRecord(asRecord(json)?.history)?.day)
      .map((value): DailyBar | null => {
        const item = asRecord(value);
        const date = stringValue(item?.date);
        const close = numberValue(item?.close);
        if (!date || close <= 0) return null;
        return {
          date,
          open: numberValue(item?.open) || close,
          high: numberValue(item?.high) || close,
          low: numberValue(item?.low) || close,
          close,
          volume: numberValue(item?.volume)
        };
      })
      .filter((bar): bar is DailyBar => bar !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private async fetchJson(path: string): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          "User-Agent": "RFDELTA-Top-Option-Trades/1.0"
        },
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`Market data request returned HTTP ${response.status}`);
      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}

function chooseExpiration(expirations: string[], reportDate: string) {
  const minDte = envNumber("REPORT_MIN_DTE", 7);
  const maxDte = envNumber("REPORT_MAX_DTE", 35);
  const targetDte = envNumber("REPORT_TARGET_DTE", 14);
  return expirations
    .map((expiration) => ({ expiration, dte: dayDiff(reportDate, expiration) }))
    .filter(({ dte }) => dte >= minDte && dte <= maxDte)
    .sort((a, b) => Math.abs(a.dte - targetDte) - Math.abs(b.dte - targetDte) || a.expiration.localeCompare(b.expiration))[0]?.expiration;
}

function dayDiff(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function dateInTimeZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : null;
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value).trim();
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberOrUndefined(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstPositive(...values: unknown[]) {
  for (const value of values) {
    const parsed = numberOrUndefined(value);
    if (parsed !== undefined && parsed > 0) return parsed;
  }
  return undefined;
}

function normalizeIv(value: number) {
  return value > 5 ? value / 100 : value;
}

function midpoint(bid: number, ask: number) {
  return bid > 0 && ask > 0 ? (bid + ask) / 2 : Math.max(bid, ask);
}

function timestampValue(value: unknown): string | undefined {
  if (typeof value === "number" || (typeof value === "string" && /^\d+$/u.test(value))) {
    const number = Number(value);
    const milliseconds = number < 10_000_000_000 ? number * 1000 : number;
    const date = new Date(milliseconds);
    return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const normalized = value.includes("T") ? value : value.replace(" ", "T") + "Z";
    const date = new Date(normalized);
    return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
  }
  return undefined;
}

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

async function mapLimit<T, R>(values: T[], limit: number, mapper: (value: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}
