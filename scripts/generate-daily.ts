import { NoFreshMarketSessionError } from "../lib/market/types";
import { generateAndPersist } from "../lib/report/generator";
import { resolveReportDate } from "../lib/report/dates";

async function main() {
  const args = process.argv.slice(2);
  const date = resolveReportDate(args, process.env.REPORT_DATE);
  const force = args.includes("--force") || args.includes("force") || process.env.FORCE_RUN === "true";
  console.log(`[options-report] start date=${date} force=${force}`);
  const { report, skipped } = await generateAndPersist({ date, force });
  console.log(`[options-report] ${skipped ? "kept existing edition" : "generated"} date=${report.runMetadata.reportDate} ideas=${report.topTrades.length} candidates=${report.marketContext.candidateCount}`);
  console.log(`[options-report] source_timestamp=${report.runMetadata.dataAsOfUtc} top=${report.topTrades[0]?.symbol ?? "none"}`);
  if (report.runMetadata.datasetRunId) {
    console.log(`[options-report] dataset_run=${report.runMetadata.datasetRunId} training_samples=${report.runMetadata.trainingSampleCount ?? 0} policy=${report.runMetadata.selectionPolicyVersion ?? "baseline"}`);
  }
  console.log(`[options-report] complete date=${date}`);
}

main().catch((error) => {
  if (error instanceof NoFreshMarketSessionError) {
    console.log(`[options-report] no fresh market session: ${error.message}`);
    process.exit(75);
  }
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
