import type { Metadata } from "next";
import { AdSenseAutoAds } from "@/components/AdSenseAutoAds";
import { ReportStructuredData } from "@/components/ReportStructuredData";
import { ReportView } from "@/components/ReportView";
import { getCachedPresentationReport } from "@/lib/report/presentation";
import { buildReportMetadata, unavailableReportMetadata } from "@/lib/report/seo";

export async function generateMetadata(): Promise<Metadata> {
  try {
    return buildReportMetadata(await getCachedPresentationReport());
  } catch {
    return unavailableReportMetadata();
  }
}

export default async function LatestPage() {
  const report = await getCachedPresentationReport();
  return (
    <>
      <AdSenseAutoAds report={report} />
      <ReportStructuredData report={report} />
      <ReportView report={report} />
    </>
  );
}
