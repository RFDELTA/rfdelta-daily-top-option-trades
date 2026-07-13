import { promises as fs } from "node:fs";
import path from "node:path";
import type { DailyBar, EquityQuote, MarketSnapshot } from "@/lib/market/types";

type RetainedHistory = {
  schemaVersion: "1.0";
  updatedAtUtc: string;
  symbols: Record<string, DailyBar[]>;
};

const HISTORY_PATH = path.join(process.cwd(), "data", "market-history", "daily-bars.json");
const MAX_RETAINED_BARS = 260;

export async function loadRetainedHistory(): Promise<Record<string, DailyBar[]>> {
  try {
    const parsed = JSON.parse(await fs.readFile(HISTORY_PATH, "utf8")) as Partial<RetainedHistory>;
    return parsed.symbols && typeof parsed.symbols === "object" ? parsed.symbols : {};
  } catch {
    return {};
  }
}

export function mergeQuoteHistory(existing: DailyBar[], quote: EquityQuote): DailyBar[] {
  const bars = new Map(existing.map((bar) => [bar.date, bar]));
  if (quote.previousCloseDate && quote.previousClose > 0) {
    const existing = bars.get(quote.previousCloseDate);
    bars.set(quote.previousCloseDate, {
      date: quote.previousCloseDate,
      open: existing?.open ?? quote.previousClose,
      high: Math.max(existing?.high ?? quote.previousClose, quote.previousClose),
      low: Math.min(existing?.low ?? quote.previousClose, quote.previousClose),
      close: quote.previousClose,
      volume: existing?.volume ?? 0
    });
  }
  const sessionDate = quote.sessionDate ?? quote.tradeTimeUtc.slice(0, 10);
  bars.set(sessionDate, {
    date: sessionDate,
    open: positiveOr(quote.dayOpen, quote.previousClose || quote.last),
    high: Math.max(positiveOr(quote.dayHigh, quote.last), quote.last),
    low: Math.min(positiveOr(quote.dayLow, quote.last), quote.last),
    close: quote.last,
    volume: quote.volume
  });
  return [...bars.values()]
    .filter((bar) => /^\d{4}-\d{2}-\d{2}$/u.test(bar.date) && bar.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_RETAINED_BARS);
}

export async function persistSnapshotHistory(snapshot: MarketSnapshot) {
  if (snapshot.provider.includes("fixture")) return;
  const current = await loadRetainedHistory();
  for (const item of snapshot.symbols) {
    current[item.symbol] = mergeQuoteHistory(item.bars, item.quote);
  }
  const sorted = Object.fromEntries(
    Object.entries(current)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([symbol, bars]) => [symbol, bars.slice(-MAX_RETAINED_BARS)])
  );
  await fs.mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  const temporaryPath = `${HISTORY_PATH}.${process.pid}.tmp`;
  const value: RetainedHistory = {
    schemaVersion: "1.0",
    updatedAtUtc: snapshot.asOfUtc,
    symbols: sorted
  };
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, HISTORY_PATH);
}

function positiveOr(value: number | undefined, fallback: number) {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}
