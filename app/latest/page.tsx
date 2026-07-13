import type { Metadata } from "next";
import { ReportView } from "@/components/ReportView";
import { getPresentationReport } from "@/lib/report/presentation";

export const metadata: Metadata = { title: "Latest Top Option Trades" };

export default async function LatestPage() {
  return <ReportView report={await getPresentationReport()} />;
}
