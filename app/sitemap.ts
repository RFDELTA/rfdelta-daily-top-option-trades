import type { MetadataRoute } from "next";
import { getReportIndex } from "@/lib/report/store";
import { absoluteSiteUrl, reportPath } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const index = await getReportIndex();
  const latestModified = index.reports[0]?.dataAsOfUtc ?? new Date().toISOString();

  return [
    {
      url: absoluteSiteUrl("/archive"),
      lastModified: latestModified,
      changeFrequency: "daily",
      priority: 0.7
    },
    ...index.reports.map((report, reportIndex) => ({
      url: absoluteSiteUrl(reportPath(report.date)),
      lastModified: report.dataAsOfUtc,
      changeFrequency: "never" as const,
      priority: reportIndex === 0 ? 1 : 0.8
    }))
  ];
}
