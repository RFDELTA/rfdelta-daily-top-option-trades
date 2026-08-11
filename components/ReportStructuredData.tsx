import { buildReportStructuredData } from "@/lib/report/seo";
import type { OptionsReport } from "@/lib/report/types";

export function ReportStructuredData({ report }: { report: OptionsReport }) {
  const json = JSON.stringify(buildReportStructuredData(report)).replace(/</gu, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
