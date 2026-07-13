import { z } from "zod";
import type { DailyBar, HistoricalDataProvenance, MarketSnapshot } from "@/lib/market/types";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type PublicHistoryOptions = {
  enabled?: boolean;
  lookbackDays?: number;
  maxBars?: number;
  concurrency?: number;
  fetcher?: Fetcher;
};

type FetchHistoryOptions = {
  fetcher?: Fetcher;
  maxBars?: number;
};

const HISTORY_HOSTS = [
  "https://query1.finance.yahoo.com",
  "https://query2.finance.yahoo.com"
] as const;

const QuoteSchema = z.object({
  open: z.array(z.number().nullable()),
  high: z.array(z.number().nullable()),
  low: z.array(z.number().nullable()),
  close: z.array(z.number().nullable()),
  volume: z.array(z.number().nullable())
});

const ChartResponseSchema = z.object({
  chart: z.object({
    result: z.array(z.object({
      meta: z.object({
        symbol: z.string(),
        exchangeTimezoneName: z.string().optional()
      }),
      timestamp: z.array(z.number()),
      indicators: z.object({ quote: z.array(QuoteSchema).min(1) })
    })).nullable(),
    error: z.unknown().nullable().optional()
  })
});

export async function hydratePublicHistoricalData(
  snapshot: MarketSnapshot,
  options: PublicHistoryOptions = {}
): Promise<MarketSnapshot> {
  const enabled = options.enabled ?? process.env.PUBLIC_HISTORY_ENABLED !== "false";
  if (!enabled || snapshot.provider.includes("fixture") || !snapshot.symbols.length) return snapshot;

  const lookbackDays = clampInteger(options.lookbackDays ?? envNumber("PUBLIC_HISTORY_LOOKBACK_DAYS", 400), 30, 1_500);
  const maxBars = clampInteger(options.maxBars ?? envNumber("PUBLIC_HISTORY_MAX_BARS", 260), 21, 1_000);
  const concurrency = clampInteger(options.concurrency ?? envNumber("PUBLIC_HISTORY_CONCURRENCY", 4), 1, 12);
  const queryStartDate = addUtcDays(snapshot.sessionDate, -lookbackDays);
  const queryEndDate = snapshot.sessionDate;
  const requested = [...snapshot.symbols].sort((a, b) => a.symbol.localeCompare(b.symbol));
  const fetched = new Map<string, DailyBar[]>();

  console.log(`[history] start provider=yahoo-public requested=${requested.length} window=${queryStartDate}:${queryEndDate}`);
  await mapLimit(requested, concurrency, async (item) => {
    try {
      const bars = await fetchPublicHistoryBars(item.symbol, queryStartDate, queryEndDate, {
        ...(options.fetcher ? { fetcher: options.fetcher } : {}),
        maxBars
      });
      if (bars.length) fetched.set(item.symbol, bars);
    } catch {
      // A retained series is safer than failing an otherwise valid daily edition.
    }
  });

  const symbols = snapshot.symbols.map((item) => ({
    ...item,
    bars: mergePublicHistory(item.bars, fetched.get(item.symbol) ?? [], snapshot.sessionDate, maxBars)
  }));
  const totalBarCount = [...fetched.values()].reduce((total, bars) => total + bars.length, 0);
  const historicalData: HistoricalDataProvenance = {
    provider: "Yahoo Finance",
    dataset: "Public daily chart history",
    queryStartDate,
    queryEndDate,
    requestedSymbolCount: requested.length,
    hydratedSymbolCount: fetched.size,
    totalBarCount,
    coverageRatio: round(fetched.size / requested.length, 6)
  };
  console.log(`[history] complete hydrated=${fetched.size} requested=${requested.length} bars=${totalBarCount} coverage=${(historicalData.coverageRatio * 100).toFixed(1)}%`);
  if (!fetched.size) return snapshot;
  return { ...snapshot, symbols, historicalData };
}

export async function fetchPublicHistoryBars(
  symbol: string,
  startDate: string,
  endDate: string,
  options: FetchHistoryOptions = {}
): Promise<DailyBar[]> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9.^=-]{1,20}$/u.test(normalizedSymbol)) throw new Error("Historical symbol is invalid.");
  assertDate(startDate);
  assertDate(endDate);
  if (startDate > endDate) throw new Error("Historical date range is invalid.");
  const fetcher = options.fetcher ?? fetch;
  const maxBars = clampInteger(options.maxBars ?? envNumber("PUBLIC_HISTORY_MAX_BARS", 260), 21, 1_000);
  const period1 = Math.floor(Date.parse(`${startDate}T00:00:00Z`) / 1_000);
  const period2 = Math.floor(Date.parse(`${addUtcDays(endDate, 1)}T00:00:00Z`) / 1_000);

  for (const host of HISTORY_HOSTS) {
    const url = new URL(`/v8/finance/chart/${encodeURIComponent(normalizedSymbol)}`, host);
    url.search = new URLSearchParams({
      period1: String(period1),
      period2: String(period2),
      interval: "1d",
      events: "history",
      includeAdjustedClose: "true"
    }).toString();
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const response = await fetcher(url, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "User-Agent": "RFDELTA-Top-Option-Trades/1.0"
          },
          cache: "no-store"
        });
        if (!response.ok) continue;
        const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
        if (contentType.includes("text/html")) continue;
        const parsed = ChartResponseSchema.safeParse(await response.json());
        if (!parsed.success) continue;
        const result = parsed.data.chart.result?.[0];
        if (!result || result.meta.symbol.trim().toUpperCase() !== normalizedSymbol) continue;
        const quote = result.indicators.quote[0];
        const timeZone = result.meta.exchangeTimezoneName || "America/New_York";
        const bars = result.timestamp.flatMap((timestamp, index): DailyBar[] => {
          const open = quote?.open[index];
          const high = quote?.high[index];
          const low = quote?.low[index];
          const close = quote?.close[index];
          const volume = quote?.volume[index] ?? 0;
          if (![open, high, low, close].every(isPositiveNumber) || !Number.isFinite(volume) || volume < 0) return [];
          const date = dateInTimeZone(new Date(timestamp * 1_000), timeZone);
          if (date < startDate || date > endDate || (high as number) < (low as number)) return [];
          return [{ date, open: open as number, high: high as number, low: low as number, close: close as number, volume }];
        });
        if (!bars.length) continue;
        return dedupeBars(bars).slice(-maxBars);
      } catch {
        // Retry this fixed host, then use the deterministic mirror.
      } finally {
        clearTimeout(timeout);
      }
    }
  }
  throw new Error(`Public historical data was unavailable for ${normalizedSymbol}.`);
}

export function mergePublicHistory(existing: DailyBar[], historical: DailyBar[], sessionDate: string, maxBars = 260) {
  const bars = new Map(existing.map((bar) => [bar.date, bar]));
  for (const bar of historical) {
    if (bar.date < sessionDate || !bars.has(bar.date)) bars.set(bar.date, bar);
  }
  return dedupeBars([...bars.values()]).slice(-maxBars);
}

function dedupeBars(bars: DailyBar[]) {
  return [...new Map(bars
    .filter((bar) => /^\d{4}-\d{2}-\d{2}$/u.test(bar.date) && isPositiveNumber(bar.close))
    .map((bar) => [bar.date, bar])).values()]
    .sort((a, b) => a.date.localeCompare(b.date));
}

function dateInTimeZone(date: Date, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function addUtcDays(date: string, days: number) {
  assertDate(date);
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function assertDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error("Historical date must use YYYY-MM-DD.");
  }
}

function isPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function clampInteger(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function round(value: number, places: number) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

async function mapLimit<T>(values: T[], limit: number, mapper: (value: T) => Promise<void>) {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      await mapper(values[index] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), values.length) }, worker));
}
