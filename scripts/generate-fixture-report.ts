import { HistoricalFixtureProvider } from "../lib/market/fixture";
import { generateAndPersist } from "../lib/report/generator";

async function main() {
  const dateIndex = process.argv.indexOf("--date");
  const positionalDate = process.argv.find((value) => /^\d{4}-\d{2}-\d{2}$/u.test(value));
  const date = (dateIndex >= 0 ? process.argv[dateIndex + 1] : undefined) || positionalDate || "2026-06-19";
  if (!date || !/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new Error("Fixture date must use YYYY-MM-DD.");
  const { report } = await generateAndPersist({
    date,
    force: true,
    provider: new HistoricalFixtureProvider()
  });
  console.log(`[fixture] generated date=${date} ideas=${report.topTrades.length} hash=${report.runMetadata.selectionHash.slice(0, 12)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
