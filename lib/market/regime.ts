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

export function assessRegime(bars: DailyBar[], fallbackChangePct = 0): RegimeAssessment {
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  const closes = sorted.map((bar) => bar.close).filter((value) => value > 0);
  if (closes.length < 6) {
    const first = closes[0];
    const last = closes.at(-1);
    const observedReturn = first && last && closes.length > 1 ? last / first - 1 : fallbackChangePct;
    const direction = observedReturn >= 0 ? "bullish" : "bearish";
    const realizedVolatility = Math.max(0.25, Math.min(1.5, Math.abs(observedReturn) * Math.sqrt(252)));
    const signalStrength = Math.max(0.35, Math.min(0.62, 0.35 + Math.abs(observedReturn) * 8));
    const label: RegimeLabel = Math.abs(observedReturn) >= 0.025
      ? "vol_expansion"
      : observedReturn >= 0.01
        ? "trend"
        : observedReturn <= -0.01
          ? "risk_off"
          : direction === "bullish" ? "risk_on" : "mixed";
    return {
      label,
      direction,
      fiveDayReturn: observedReturn,
      twentyDayReturn: observedReturn,
      realizedVolatility,
      signalStrength,
      rationale: `${formatPct(observedReturn)} across the retained session window; the shorter history receives a reduced conviction weight.`
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
