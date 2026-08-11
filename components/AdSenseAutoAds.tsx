import { isSubstantialPublicReport } from "@/lib/monetization";
import type { OptionsReport } from "@/lib/report/types";
import { ADSENSE_SCRIPT_URL } from "@/lib/site";

export function AdSenseAutoAds({ report }: { report: OptionsReport }) {
  if (!isSubstantialPublicReport(report)) return null;

  // React hoists async external scripts into <head>. Keeping this native script
  // inside report pages makes the document response itself route-aware.
  return (
    <script
      async
      crossOrigin="anonymous"
      src={ADSENSE_SCRIPT_URL}
    />
  );
}
