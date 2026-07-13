import {
  collectAndPersistClosingPrints,
  NoClosingPrintSessionError
} from "../lib/report/closingPrints";
import { resolveReportDate } from "../lib/report/dates";

async function main() {
  const date = resolveReportDate(process.argv.slice(2), process.env.CLOSING_PRINT_DATE);
  console.log(`[closing-prints] requested date=${date}`);
  const result = await collectAndPersistClosingPrints({ date });
  console.log(`[closing-prints] result date=${result.date} requested=${result.requestedSymbols} captured=${result.capturedSymbols} updated=${result.updatedReports} completed=${result.completedReports} skipped=${result.skipped}`);
}

main().catch((error) => {
  if (error instanceof NoClosingPrintSessionError) {
    console.log(`[closing-prints] session unavailable: ${error.message}`);
    process.exit(75);
  }
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
