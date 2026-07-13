import { notFound } from "next/navigation";
import { ReportView } from "@/components/ReportView";
import { getPresentationReport } from "@/lib/report/presentation";
import { getReportIndex } from "@/lib/report/store";

export async function generateStaticParams() {
  return (await getReportIndex()).reports.map((report) => ({ date: report.date }));
}

export default async function ReportPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  let report;
  try {
    report = await getPresentationReport(date);
  } catch {
    notFound();
  }
  return <ReportView report={report} />;
}
