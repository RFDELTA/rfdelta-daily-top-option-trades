import { fetchPublicHistoryBars } from "../lib/market/publicHistory";
import { currentReportDate } from "../lib/report/dates";

async function main() {
  const args = process.argv.slice(2);
  const endDate = args.find((value) => /^\d{4}-\d{2}-\d{2}$/u.test(value)) || currentReportDate();
  const symbols = args
    .filter((value) => value !== endDate)
    .join(",")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
  const requested = symbols.length ? symbols : ["SPY", "QQQ"];
  const startDate = addUtcDays(endDate, -400);
  for (const symbol of requested) {
    const bars = await fetchPublicHistoryBars(symbol, startDate, endDate);
    console.log(`[smoke:history] symbol=${symbol} sessions=${bars.length} range=${bars[0]?.date ?? "none"}:${bars.at(-1)?.date ?? "none"}`);
  }
}

function addUtcDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
