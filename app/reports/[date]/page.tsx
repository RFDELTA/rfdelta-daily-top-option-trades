import { notFound } from "next/navigation";
import { ReportView } from "@/components/ReportView";
import { getReport, getReportIndex } from "@/lib/report/store";

export async function generateStaticParams() {
  return (await getReportIndex()).reports.map((report) => ({ date: report.date }));
}

export default async function ReportPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  let report;
  try {
    report = await getReport(date);
  } catch {
    notFound();
  }
  return <ReportView report={report} />;
}
