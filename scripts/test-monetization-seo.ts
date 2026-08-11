import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { isSubstantialPublicReport, reportEditorialWordCount } from "../lib/monetization";
import { getPresentationReport } from "../lib/report/presentation";
import { buildReportMetadata, buildReportStructuredData } from "../lib/report/seo";
import { ADSENSE_CLIENT, ADSENSE_SCRIPT_URL, SITE_ORIGIN } from "../lib/site";

async function main() {
  const report = await getPresentationReport("2026-08-11");
  assert.ok(reportEditorialWordCount(report) >= 250);
  assert.equal(isSubstantialPublicReport(report), true);

  const metadata = buildReportMetadata(report);
  assert.equal(metadata.metadataBase, undefined);
  assert.deepEqual(metadata.alternates, { canonical: "/reports/2026-08-11" });
  assert.deepEqual(metadata.other, { "google-adsense-account": ADSENSE_CLIENT });
  assert.equal(metadata.openGraph?.url, "/reports/2026-08-11");
  assert.equal(metadata.robots && typeof metadata.robots === "object" && metadata.robots.index, true);
  assert.equal(ADSENSE_SCRIPT_URL, `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`);
  assert.equal(SITE_ORIGIN, "https://www.trade.rfdelta.com");

  const structuredData = buildReportStructuredData(report);
  assert.deepEqual(structuredData["@type"], ["Article", "Report"]);
  assert.equal(structuredData.url, `${SITE_ORIGIN}/reports/2026-08-11`);
  assert.equal(structuredData.mainEntityOfPage["@id"], structuredData.url);

  const emptyReport = structuredClone(report);
  emptyReport.executiveSummary = {
    headline: "",
    standfirst: "",
    marketCommentary: [],
    selectionCommentary: [],
    riskCommentary: ""
  };
  delete emptyReport.marketRead;
  emptyReport.topTrades = [];
  emptyReport.methodology = {
    selectionCriteria: [],
    rankingFramework: [],
    executionAssumption: "",
    publicationCadence: "",
    marketDataStatement: "",
    disclaimer: ""
  };
  assert.equal(isSubstantialPublicReport(emptyReport), false);
  assert.equal(buildReportMetadata(emptyReport).other, undefined);

  const adsMirror = await fs.readFile(path.join(process.cwd(), "public", "ads.txt"), "utf8");
  assert.equal(adsMirror.trim(), "google.com, pub-2668057120623042, DIRECT, f08c47fec0942fa0");

  const rootLayout = await fs.readFile(path.join(process.cwd(), "app", "layout.tsx"), "utf8");
  const embedPage = await fs.readFile(path.join(process.cwd(), "app", "embed", "[section]", "page.tsx"), "utf8");
  const privacyPage = await fs.readFile(path.join(process.cwd(), "app", "privacy", "page.tsx"), "utf8");
  assert.doesNotMatch(rootLayout, /AdSenseAutoAds|adsbygoogle/u);
  assert.doesNotMatch(embedPage, /AdSenseAutoAds|adsbygoogle/u);
  assert.doesNotMatch(privacyPage, /AdSenseAutoAds|adsbygoogle/u);

  console.log(`[test:monetization] words=${reportEditorialWordCount(report)} canonical=${structuredData.url}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
