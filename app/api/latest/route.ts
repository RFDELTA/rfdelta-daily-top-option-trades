import { NextResponse } from "next/server";
import { getLatestReport } from "@/lib/report/store";

export async function GET() {
  return NextResponse.json(await getLatestReport(), {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" }
  });
}
