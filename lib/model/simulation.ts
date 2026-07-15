import { blackScholesDelta, blackScholesPrice, impliedVolBisection, payoff } from "@/lib/model/math";
import { DeterministicRng } from "@/lib/model/rng";
import { ModelSettings } from "@/lib/model/settings";
import { TradeCandidate } from "@/lib/model/types";

export type SimulationResult = {
  impliedVolUsed: number;
  longImpliedVol: number;
  shortImpliedVol: number;
  longDelta: number;
  shortDelta: number;
  blackScholesEdge: number;
  probabilityProfit: number;
  probabilityNearMaxProfit: number;
  expectedValueDollars: number;
  p10Dollars: number;
  p90Dollars: number;
};

export function getEntryWidth(candidate: TradeCandidate) {
  const width = Math.abs(candidate.shortLeg.strike - candidate.longLeg.strike);

  if (candidate.structureType === "Debit") {
    const entry = Math.max(candidate.longLeg.ask - candidate.shortLeg.bid, 0.01);
    return {
      entry,
      width,
      maxLoss: entry,
      maxProfit: Math.max(width - entry, 0)
    };
  }

  const entry = Math.max(candidate.shortLeg.bid - candidate.longLeg.ask, 0.01);
  return {
    entry,
    width,
    maxLoss: Math.max(width - entry, 0),
    maxProfit: entry
  };
}

export function getBreakeven(candidate: TradeCandidate, entry: number): number {
  if (candidate.style === "call_debit") return candidate.longLeg.strike + entry;
  if (candidate.style === "put_debit") return candidate.longLeg.strike - entry;
  if (candidate.style === "put_credit") return candidate.shortLeg.strike - entry;
  return candidate.shortLeg.strike + entry;
}

export function runCandidateSimulation(
  candidate: TradeCandidate,
  settings: ModelSettings
): SimulationResult {
  const { entry, maxLoss, maxProfit } = getEntryWidth(candidate);
  const t = Math.max(candidate.daysToExpiry / 365, 1 / 365);
  const ivLong = impliedVolBisection({
    s: candidate.underlyingMark,
    k: candidate.longLeg.strike,
    t,
    r: settings.riskFreeRate,
    price: candidate.longLeg.mid,
    right: candidate.longLeg.right
  });
  const ivShort = impliedVolBisection({
    s: candidate.underlyingMark,
    k: candidate.shortLeg.strike,
    t,
    r: settings.riskFreeRate,
    price: candidate.shortLeg.mid,
    right: candidate.shortLeg.right
  });
  const suppliedIvs = [
    candidate.longLeg.impliedVolatility,
    candidate.shortLeg.impliedVolatility
  ].filter((value): value is number => typeof value === "number" && value > 0.01);
  const suppliedIv = suppliedIvs.length
    ? suppliedIvs.reduce((sum, value) => sum + value, 0) / suppliedIvs.length
    : undefined;
  const sigma = Math.max(0.18, Math.min(5, suppliedIv ?? (ivLong + ivShort) / 2));

  const modelLong = blackScholesPrice({
    s: candidate.underlyingMark,
    k: candidate.longLeg.strike,
    t,
    r: settings.riskFreeRate,
    sigma,
    right: candidate.longLeg.right
  });
  const modelShort = blackScholesPrice({
    s: candidate.underlyingMark,
    k: candidate.shortLeg.strike,
    t,
    r: settings.riskFreeRate,
    sigma,
    right: candidate.shortLeg.right
  });

  const modelSpreadValue =
    candidate.structureType === "Debit"
      ? modelLong - modelShort
      : modelShort - modelLong;

  const blackScholesEdge =
    candidate.structureType === "Debit"
      ? modelSpreadValue - entry
      : entry - modelSpreadValue;

  const rng = new DeterministicRng(settings.deterministicSeed + hashString(candidate.id));
  let profitCount = 0;
  let nearMaxProfitCount = 0;
  let sumPnl = 0;
  const sample: number[] = [];
  const shockProb = settings.jumpShockProbability;

  for (let i = 0; i < settings.pathsPerCandidate; i += 1) {
    const z = rng.normal();
    const u = rng.next();
    const jump = rng.normal();
    let shock = 0;
    const shockScale = settings.regimeShockWeight * sigma * Math.sqrt(t);
    if (u < shockProb) shock = -Math.abs(jump) * shockScale;
    if (u > 1 - shockProb) shock = Math.abs(jump) * shockScale;

    const st =
      candidate.underlyingMark *
      Math.exp(
        (settings.riskFreeRate - 0.5 * sigma * sigma) * t +
          sigma * Math.sqrt(t) * z +
          shock
      );

    let pnl: number;
    if (candidate.structureType === "Debit") {
      const gross =
        payoff(st, candidate.longLeg.strike, candidate.longLeg.right) -
        payoff(st, candidate.shortLeg.strike, candidate.shortLeg.right);
      pnl = clamp(gross - entry, -maxLoss, maxProfit);
    } else {
      const liability =
        payoff(st, candidate.shortLeg.strike, candidate.shortLeg.right) -
        payoff(st, candidate.longLeg.strike, candidate.longLeg.right);
      pnl = clamp(entry - liability, -maxLoss, maxProfit);
    }

    if (pnl > 0) profitCount += 1;
    if (maxProfit > 0 && pnl >= maxProfit * 0.98) nearMaxProfitCount += 1;
    sumPnl += pnl;
    if (i % Math.max(1, Math.floor(settings.pathsPerCandidate / 1000)) === 0) {
      sample.push(pnl * 100);
    }
  }

  sample.sort((a, b) => a - b);

  return {
    impliedVolUsed: sigma,
    longImpliedVol: ivLong,
    shortImpliedVol: ivShort,
    longDelta: blackScholesDelta({
      s: candidate.underlyingMark,
      k: candidate.longLeg.strike,
      t,
      r: settings.riskFreeRate,
      sigma: ivLong,
      right: candidate.longLeg.right
    }),
    shortDelta: blackScholesDelta({
      s: candidate.underlyingMark,
      k: candidate.shortLeg.strike,
      t,
      r: settings.riskFreeRate,
      sigma: ivShort,
      right: candidate.shortLeg.right
    }),
    blackScholesEdge,
    probabilityProfit: profitCount / settings.pathsPerCandidate,
    probabilityNearMaxProfit: nearMaxProfitCount / settings.pathsPerCandidate,
    expectedValueDollars: (sumPnl / settings.pathsPerCandidate) * 100,
    p10Dollars: percentile(sample, 0.1),
    p90Dollars: percentile(sample, 0.9)
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const idx = Math.min(xs.length - 1, Math.max(0, Math.floor(p * (xs.length - 1))));
  return xs[idx] ?? 0;
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
