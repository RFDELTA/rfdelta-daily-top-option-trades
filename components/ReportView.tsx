import type { OptionsReport } from "@/lib/report/types";
import { SiteHeader } from "@/components/SiteHeader";
import { AccountabilityAndMethod, ReportOverview, RiskRewardChart, ScoreChart, TradeList } from "@/components/ReportSections";

export function ReportView({ report }: { report: OptionsReport }) {
  return (
    <>
      <SiteHeader />
      <main>
        <ReportOverview report={report} />
        <ScoreChart report={report} />
        <RiskRewardChart report={report} />
        <TradeList report={report} />
        <AccountabilityAndMethod report={report} />
      </main>
    </>
  );
}
