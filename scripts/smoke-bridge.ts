import { TastytradeBridgeMarketDataProvider } from "../lib/market/tastytradeBridge";
import { currentReportDate } from "../lib/report/dates";

async function main() {
  const args = process.argv.slice(2);
  const positionalDate = args.find((value) => /^\d{4}-\d{2}-\d{2}$/u.test(value));
  const date = valueAfter(args, "--date") || positionalDate || currentReportDate();
  const positionalSymbols = args
    .filter((value) => value !== positionalDate && !value.startsWith("--"))
    .join(",");
  const symbols = (valueAfter(args, "--symbols") || positionalSymbols || "SPY,QQQ")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
  const snapshot = await new TastytradeBridgeMarketDataProvider().getSnapshot({ reportDate: date, universe: symbols });
  console.log(`[smoke:bridge] session=${snapshot.sessionDate} requested=${symbols.length} included=${snapshot.symbols.length} excluded=${snapshot.excludedSymbols.length}`);
  console.log(`[smoke:bridge] chains=${snapshot.symbols.map((item) => `${item.symbol}:${item.expiration}:${item.options.length}`).join(",")}`);
}

function valueAfter(args: string[], flag: string) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
