import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdSenseAutoAds } from "@/components/AdSenseAutoAds";
import { ReportStructuredData } from "@/components/ReportStructuredData";
import { ReportView } from "@/components/ReportView";
import { getCachedPresentationReport } from "@/lib/report/presentation";
import { buildReportMetadata, unavailableReportMetadata } from "@/lib/report/seo";
import { getReportIndex } from "@/lib/report/store";

const REPORT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function generateStaticParams() {
  return (await getReportIndex()).reports.map((report) => ({ date: report.date }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  if (!REPORT_DATE_PATTERN.test(date)) return unavailableReportMetadata();
  try {
    return buildReportMetadata(await getCachedPresentationReport(date));
  } catch {
    return unavailableReportMetadata();
  }
}

export default async function ReportPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!REPORT_DATE_PATTERN.test(date)) notFound();
  let report;
  try {
    report = await getCachedPresentationReport(date);
  } catch {
    notFound();
  }
  return (
    <>
      <AdSenseAutoAds report={report} />
      <ReportStructuredData report={report} />
      <ReportView report={report} />
    </>
  );
}
