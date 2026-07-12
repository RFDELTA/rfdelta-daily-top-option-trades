import type { Metadata } from "next";
import { ReportView } from "@/components/ReportView";
import { getLatestReport } from "@/lib/report/store";

export const metadata: Metadata = { title: "Latest Top Option Trades" };

export default async function LatestPage() {
  return <ReportView report={await getLatestReport()} />;
}
