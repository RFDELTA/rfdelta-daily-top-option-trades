import type { OptionsReport } from "@/lib/report/types";
import { EmbedAutoResize } from "@/components/EmbedAutoResize";
import { AccountabilityAndMethod, ReportOverview, RiskRewardChart, ScoreChart, TradeList } from "@/components/ReportSections";

export const EMBED_SECTIONS = ["overview", "score-chart", "risk-reward", "trades-1-2", "trades-3-5", "accountability"] as const;
export type EmbedSectionName = typeof EMBED_SECTIONS[number];

export function EmbedSection({ report, section, frameId }: { report: OptionsReport; section: EmbedSectionName; frameId: string }) {
  return (
    <main className="embed-shell">
      <EmbedAutoResize frameId={frameId} />
      {section === "overview" && <ReportOverview report={report} compact />}
      {section === "score-chart" && <ScoreChart report={report} />}
      {section === "risk-reward" && <RiskRewardChart report={report} />}
      {section === "trades-1-2" && <TradeList report={report} from={0} to={2} />}
      {section === "trades-3-5" && <TradeList report={report} from={2} to={5} />}
      {section === "accountability" && <AccountabilityAndMethod report={report} showFullLink />}
    </main>
  );
}
