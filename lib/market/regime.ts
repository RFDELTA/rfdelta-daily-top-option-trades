import type { DailyBar } from "@/lib/market/types";
import type { RegimeLabel } from "@/lib/model/types";

export type RegimeAssessment = {
  label: RegimeLabel;
  direction: "bullish" | "bearish";
  fiveDayReturn: number;
  twentyDayReturn: number;
  realizedVolatility: number;
  signalStrength: number;
  rationale: string;
};

export function assessRegime(bars: DailyBar[]): RegimeAssessment {
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  const closes = sorted.map((bar) => bar.close).filter((value) => value > 0);
  if (closes.length < 6) {
    return {
      label: "mixed",
      direction: "bullish",
      fiveDayReturn: 0,
      twentyDayReturn: 0,
      realizedVolatility: 0.35,
      signalStrength: 0.35,
      rationale: "Price history is limited, so the signal receives a reduced conviction weight."
    };
  }

  const last = closes.at(-1) ?? 1;
  const fiveBase = closes[Math.max(0, closes.length - 6)] ?? last;
  const twentyBase = closes[Math.max(0, closes.length - 21)] ?? closes[0] ?? last;
  const fiveDayReturn = last / fiveBase - 1;
  const twentyDayReturn = last / twentyBase - 1;
  const logReturns = closes.slice(1).map((close, index) => Math.log(close / (closes[index] ?? close)));
  const recentReturns = logReturns.slice(-20);
  const mean = recentReturns.reduce((sum, value) => sum + value, 0) / Math.max(1, recentReturns.length);
  const variance = recentReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, recentReturns.length - 1);
  const realizedVolatility = Math.sqrt(variance * 252);
  const directionalScore = fiveDayReturn * 0.65 + twentyDayReturn * 0.35;
  const direction = directionalScore >= 0 ? "bullish" : "bearish";

  let label: RegimeLabel = "mixed";
  if (realizedVolatility >= 0.65) label = "vol_expansion";
  else if (fiveDayReturn > 0.01 && twentyDayReturn > 0.015) label = "trend";
  else if (fiveDayReturn < -0.01 && twentyDayReturn < -0.015) label = "risk_off";
  else if (fiveDayReturn * twentyDayReturn < 0) label = "mean_reversion";
  else if (direction === "bullish") label = "risk_on";

  const normalizedMomentum = Math.min(1, Math.abs(directionalScore) / Math.max(realizedVolatility / Math.sqrt(252) * 3, 0.01));
  const signalStrength = Math.max(0.35, Math.min(0.95, 0.45 + normalizedMomentum * 0.5));
  const rationale = `${formatPct(fiveDayReturn)} over five sessions and ${formatPct(twentyDayReturn)} over twenty, with ${formatPct(realizedVolatility)} annualized realized volatility.`;

  return {
    label,
    direction,
    fiveDayReturn,
    twentyDayReturn,
    realizedVolatility,
    signalStrength,
    rationale
  };
}

function formatPct(value: number) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}
