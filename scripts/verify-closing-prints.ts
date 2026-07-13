import { getReport, getReportIndex } from "../lib/report/store";
import { resolveReportDate } from "../lib/report/dates";

async function main() {
  const date = resolveReportDate(process.argv.slice(2), process.env.CLOSING_PRINT_DATE);
  const index = await getReportIndex();
  const reports = await Promise.all(index.reports.map((item) => getReport(item.date)));
  let applicableIdeas = 0;
  for (const report of reports.filter((item) => item.runMetadata.reportDate <= date)) {
    for (const idea of report.topTrades.filter((item) => item.expiration >= date)) {
      applicableIdeas += 1;
      const print = idea.dailyCloses?.find((item) => item.date === date);
      if (!print) throw new Error(`${idea.id} is missing its ${date} official close.`);
      const chartPoint = idea.underlyingChart?.points.find((item) => item.date === date);
      if (!chartPoint || chartPoint.close !== print.underlyingClose) {
        throw new Error(`${idea.id} does not chart its ${date} official close.`);
      }
    }
  }
  console.log(`[verify:closing-prints] date=${date} open_ideas=${applicableIdeas}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
