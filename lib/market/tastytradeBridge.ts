import { createHash } from "node:crypto";
import { loadRetainedHistory, mergeQuoteHistory } from "@/lib/market/history";
import type {
  EquityQuote,
  MarketDataProvider,
  MarketSnapshot,
  MarketSymbolSnapshot,
  OptionContract,
  SnapshotRequest
} from "@/lib/market/types";
import { NoFreshMarketSessionError } from "@/lib/market/types";
import { selectOptionChainSymbols } from "@/lib/market/symbolSelection";

type JsonRecord = Record<string, unknown>;
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

class NonRetryableMarketDataError extends Error {}

type ProviderOptions = {
  apiKey?: string;
  baseUrl?: string;
  fetcher?: Fetcher;
  retainedHistory?: Record<string, import("@/lib/market/types").DailyBar[]>;
};

export class TastytradeBridgeMarketDataProvider implements MarketDataProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly retainedHistory?: ProviderOptions["retainedHistory"];

  constructor(options: ProviderOptions = {}) {
    this.apiKey = options.apiKey?.trim() || process.env.TT_BRIDGE_API_KEY?.trim() || "";
    this.baseUrl = (options.baseUrl?.trim() || process.env.TT_BRIDGE_BASE_URL?.trim() || "https://tt-bridge.rfdelta.com").replace(/\/$/u, "");
    this.fetcher = options.fetcher ?? fetch;
    this.retainedHistory = options.retainedHistory;
    if (!this.apiKey) throw new Error("TT_BRIDGE_API_KEY is required for production generation.");
    assertSecureBaseUrl(this.baseUrl);
  }

  async getSnapshot(request: SnapshotRequest): Promise<MarketSnapshot> {
    const requested = [...new Set(request.universe.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
    const [discovery, history] = await Promise.all([
      this.getDiscoveredUniverse(requested),
      this.retainedHistory ? Promise.resolve(this.retainedHistory) : loadRetainedHistory()
    ]);
    const available = new Set(discovery.equities);
    const activeUniverse = requested.filter((symbol) => available.has(symbol)).sort();
    const excludedSymbols: MarketSnapshot["excludedSymbols"] = requested
      .filter((symbol) => !available.has(symbol))
      .map((symbol) => ({ symbol, reason: "Symbol is outside the deterministic publication universe" }));
    if (!activeUniverse.length) throw new Error("No configured symbols were present in the deterministic publication universe.");
    console.log(`[market-data] discovery mode=${discovery.mode} configured=${requested.length} available=${available.size} selected=${activeUniverse.length} fingerprint=${discovery.fingerprint.slice(0, 12) || "unavailable"}`);

    const quotes = await this.getQuotes(activeUniverse);
    activeUniverse.filter((symbol) => !quotes.has(symbol)).forEach((symbol) => {
      excludedSymbols.push({ symbol, reason: "No current underlying quote" });
    });
    const chainSelection = selectOptionChainSymbols(quotes, request.reportDate);
    console.log(`[market-data] preselection quoted=${chainSelection.quoteUniverseCount} core=${chainSelection.core.length} movers=${chainSelection.movers.length} volume=${chainSelection.volume.length} rotation=${chainSelection.rotation.length} chains=${chainSelection.selectedSymbolCount}`);
    const symbols = await mapLimit(chainSelection.selectedSymbols, envNumber("TT_BRIDGE_CHAIN_CONCURRENCY", 4), async (symbol) => {
      const quote = quotes.get(symbol);
      if (!quote) {
        excludedSymbols.push({ symbol, reason: "No current underlying quote" });
        return null;
      }
      const quoteSession = quote.sessionDate ?? dateInTimeZone(new Date(quote.tradeTimeUtc), "America/New_York");
      if (process.env.REPORT_REQUIRE_SAME_SESSION_QUOTES !== "false" && quoteSession !== request.reportDate) {
        excludedSymbols.push({ symbol, reason: `Underlying quote belongs to ${quoteSession}` });
        return null;
      }
      try {
        const chain = await this.getChain(symbol, request.reportDate, quote.tradeTimeUtc);
        if (!chain.expiration) {
          excludedSymbols.push({ symbol, reason: "No expiration inside the configured DTE window" });
          return null;
        }
        if (chain.options.length < 4) {
          excludedSymbols.push({ symbol, reason: "Option chain did not contain enough quoted contracts" });
          return null;
        }
        const chainSession = chain.asOfUtc ? dateInTimeZone(new Date(chain.asOfUtc), "America/New_York") : quoteSession;
        if (process.env.REPORT_REQUIRE_SAME_SESSION_QUOTES !== "false" && chainSession !== request.reportDate) {
          excludedSymbols.push({ symbol, reason: `Option chain belongs to ${chainSession}` });
          return null;
        }
        return {
          symbol,
          quote,
          bars: mergeQuoteHistory(history[symbol] ?? [], quote),
          expiration: chain.expiration,
          options: chain.options
        } satisfies MarketSymbolSnapshot;
      } catch (error) {
        excludedSymbols.push({
          symbol,
          reason: error instanceof Error ? error.message : "Market data request did not complete"
        });
        return null;
      }
    });

    const included = symbols.filter((symbol): symbol is MarketSymbolSnapshot => symbol !== null);
    const freshRatio = included.length / Math.max(1, chainSelection.selectedSymbolCount);
    console.log(`[market-data] snapshot session=${request.reportDate} included=${included.length} excluded=${excludedSymbols.length}`);
    if (freshRatio < 0.5) {
      throw new NoFreshMarketSessionError(
        `Only ${included.length} of ${chainSelection.selectedSymbolCount} selected symbols had same-session option data for ${request.reportDate}.`
      );
    }
    const asOfUtc = included
      .flatMap((item) => [item.quote.tradeTimeUtc, ...item.options.map((option) => option.quoteTimeUtc).filter((value): value is string => Boolean(value))])
      .sort()
      .at(-1) ?? new Date(`${request.reportDate}T00:00:00Z`).toISOString();

    return {
      provider: "rfdelta-market-data-production",
      providerAttribution: "RFDELTA normalized U.S. equity and options market data",
      ...(discovery.fingerprint ? { sourceFingerprint: discovery.fingerprint } : {}),
      reportDate: request.reportDate,
      sessionDate: request.reportDate,
      asOfUtc,
      universe: activeUniverse,
      symbols: included,
      excludedSymbols: excludedSymbols.sort((a, b) => a.symbol.localeCompare(b.symbol)),
      chainSelection
    };
  }

  private async getDiscoveredUniverse(configured: string[]) {
    let json: unknown;
    let mode = "full";
    try {
      json = await this.fetchJson("/scan-universe/full");
    } catch {
      mode = "default";
      console.log("[market-data] discovery full unavailable; trying default universe");
      try {
        json = await this.fetchJson("/scan-universe/default");
      } catch {
        mode = "configured";
        console.log("[market-data] discovery default unavailable; using controlled configured universe");
        return {
          equities: [...configured].sort(),
          fingerprint: createHash("sha256").update(JSON.stringify([...configured].sort())).digest("hex"),
          mode
        };
      }
    }
    const data = unwrapData(json);
    const equities = toArray(data?.equities).map(stringValue).map((symbol) => symbol.toUpperCase()).filter(Boolean).sort();
    if (!equities.length) throw new Error("Market-data discovery returned an empty universe.");
    return { equities: [...new Set(equities)], fingerprint: stringValue(data?.fingerprint), mode };
  }

  private async getQuotes(symbols: string[]) {
    const quotes = new Map<string, EquityQuote>();
    const batchSize = clampInteger(envNumber("TT_BRIDGE_QUOTE_BATCH_SIZE", 60), 10, 100);
    const batches = chunk(symbols, batchSize);
    const responses = await mapLimit(batches, 3, async (batch) => {
      const query = new URLSearchParams();
      batch.forEach((symbol) => query.append("symbols", symbol));
      return this.fetchJson(`/quotes/equities?${query.toString()}`);
    });
    for (const value of responses.flatMap((json) => toArray(unwrapData(json)?.items))) {
      const item = asRecord(value);
      const symbol = stringValue(item?.symbol).toUpperCase();
      const bid = numberValue(item?.bid);
      const ask = numberValue(item?.ask);
      const last = firstPositive(item?.last, item?.mark, item?.mid) ?? midpoint(bid, ask);
      const sessionDate = dateValue(item?.["summary-date"]);
      const tradeTimeUtc = timestampValue(item?.["updated-at"]) ?? (sessionDate ? `${sessionDate}T20:00:00.000Z` : undefined);
      if (!symbol || !last || !tradeTimeUtc || !sessionDate) continue;
      const previousClose = firstPositive(item?.["prev-close"], item?.close) ?? last;
      const previousCloseDate = dateValue(item?.["prev-close-date"]);
      quotes.set(symbol, {
        symbol,
        last,
        bid,
        ask,
        previousClose,
        ...(previousCloseDate ? { previousCloseDate } : {}),
        changePct: previousClose > 0 ? last / previousClose - 1 : 0,
        volume: numberValue(item?.volume),
        tradeTimeUtc,
        sessionDate,
        ...optionalPositive("dayOpen", item?.open),
        ...optionalPositive("dayHigh", item?.["day-high-price"]),
        ...optionalPositive("dayLow", item?.["day-low-price"])
      });
    }
    return quotes;
  }

  private async getChain(symbol: string, reportDate: string, quoteTimeUtc: string) {
    const expirationLimit = clampInteger(envNumber("TT_BRIDGE_EXPIRATION_LIMIT", 10), 1, 10);
    const strikeCount = clampInteger(envNumber("TT_BRIDGE_STRIKE_COUNT", 24), 4, 30);
    const query = new URLSearchParams({
      expiration_limit: String(expirationLimit),
      strike_count: String(strikeCount),
      include_quotes: "true"
    });
    const json = await this.fetchJson(`/normalized/equity-chain/${encodeURIComponent(symbol)}?${query.toString()}`);
    const items = toArray(unwrapData(json)?.items);
    const expiration = chooseExpiration(
      [...new Set(items.map((item) => dateValue(asRecord(item)?.expiration_date)).filter((date): date is string => Boolean(date)))],
      reportDate
    );
    if (!expiration) return { expiration: undefined, options: [] as OptionContract[], asOfUtc: undefined };
    const options = items
      .map((value): OptionContract | null => {
        const item = asRecord(value);
        if (dateValue(item?.expiration_date) !== expiration) return null;
        const right = rightValue(item?.right);
        const strike = numberValue(item?.strike);
        const bid = numberValue(item?.bid);
        const ask = numberValue(item?.ask);
        if (!right || strike <= 0 || ask <= 0 || ask < bid) return null;
        const updated = timestampValue(item?.["updated-at"]) ?? quoteTimeUtc;
        const delta = numberOrUndefined(item?.delta);
        const iv = firstPositive(item?.implied_volatility, item?.["implied-volatility"]);
        return {
          optionSymbol: stringValue(item?.option_contract_symbol || item?.symbol || item?.streamer_symbol),
          underlying: symbol,
          expiration,
          right,
          strike,
          bid,
          ask,
          last: numberValue(item?.last),
          volume: numberValue(item?.volume),
          openInterest: numberValue(item?.open_interest || item?.["open-interest"]),
          ...(delta !== undefined ? { delta } : {}),
          ...(iv !== undefined ? { impliedVolatility: normalizeIv(iv) } : {}),
          quoteTimeUtc: updated
        };
      })
      .filter((option): option is OptionContract => option !== null)
      .sort((a, b) => a.right.localeCompare(b.right) || a.strike - b.strike || a.optionSymbol.localeCompare(b.optionSymbol));
    const asOfUtc = options.map((option) => option.quoteTimeUtc).filter((value): value is string => Boolean(value)).sort().at(-1);
    return { expiration, options, asOfUtc };
  }

  private async fetchJson(path: string): Promise<unknown> {
    const allowedPath = path.split("?", 1)[0] ?? "";
    if (!/^\/(scan-universe\/(default|full)|quotes\/(equities|equity-options)|normalized\/equity-chain\/[A-Za-z0-9._-]+)$/u.test(allowedPath)) {
      throw new Error("The market-data adapter rejected a non-market-data route.");
    }
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      try {
        const response = await this.fetcher(`${this.baseUrl}${path}`, {
          signal: controller.signal,
          headers: {
            "X-Proxy-Key": this.apiKey,
            Accept: "application/json",
            "User-Agent": "RFDELTA-Top-Option-Trades/1.0"
          },
          cache: "no-store"
        });
        if (response.ok) return response.json();
        if (response.status !== 429 && response.status < 500) {
          throw new NonRetryableMarketDataError(`Market data request for ${allowedPath} returned HTTP ${response.status}`);
        }
        lastError = new Error(`Market data request for ${allowedPath} returned HTTP ${response.status}`);
      } catch (error) {
        if (error instanceof NonRetryableMarketDataError) throw error;
        lastError = error;
      } finally {
        clearTimeout(timeout);
      }
      if (attempt < 3) await sleep(attempt * 750);
    }
    throw lastError instanceof Error ? lastError : new Error("Market data request did not complete");
  }
}

function chunk<T>(values: T[], size: number) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size));
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

function unwrapData(value: unknown) {
  const record = asRecord(value);
  return asRecord(record?.data) ?? record;
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

function optionalPositive<Key extends "dayOpen" | "dayHigh" | "dayLow">(key: Key, value: unknown): Partial<Record<Key, number>> {
  const parsed = firstPositive(value);
  return parsed === undefined ? {} : { [key]: parsed } as Partial<Record<Key, number>>;
}

function rightValue(value: unknown): "C" | "P" | null {
  const normalized = stringValue(value).toLowerCase();
  if (normalized === "c" || normalized === "call") return "C";
  if (normalized === "p" || normalized === "put") return "P";
  return null;
}

function dateValue(value: unknown) {
  const normalized = stringValue(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/u.test(normalized) ? normalized : undefined;
}

function timestampValue(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function normalizeIv(value: number) {
  return value > 5 ? value / 100 : value;
}

function midpoint(bid: number, ask: number) {
  return bid > 0 && ask > 0 ? (bid + ask) / 2 : Math.max(bid, ask);
}

function dayDiff(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

function dateInTimeZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function clampInteger(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function assertSecureBaseUrl(value: string) {
  const url = new URL(value);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) throw new Error("TT_BRIDGE_BASE_URL must use HTTPS.");
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), values.length) }, worker));
  return results;
}
