import type { OptionsReport } from "@/lib/report/types";

export function ReportMetrics({ report }: { report: OptionsReport }) {
  const metrics = [
    ["Top score", report.analytics.topScore.toFixed(2)],
    ["Avg. probability", percent(report.analytics.averageProbabilityProfit)],
    ["Basket max risk", money(report.analytics.totalMaxLossDollars)],
    ["Data as of", formatTime(report.runMetadata.dataAsOfUtc)]
  ];
  return (
    <div className="metric-strip" aria-label="Report summary metrics">
      {metrics.map(([label, value]) => (
        <div className="metric" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(new Date(value));
}
