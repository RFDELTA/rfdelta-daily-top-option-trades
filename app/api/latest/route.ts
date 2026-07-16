import { type NextRequest, NextResponse } from "next/server";
import { getLatestReport, getReportArchiveRevision } from "@/lib/report/store";

export async function GET(request: NextRequest) {
  const report = await getLatestReport();
  const body = request.nextUrl.searchParams.get("publication") === "1"
    ? {
        reportId: report.reportId,
        reportDate: report.runMetadata.reportDate,
        archiveRevision: await getReportArchiveRevision()
      }
    : report;
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" }
  });
}
