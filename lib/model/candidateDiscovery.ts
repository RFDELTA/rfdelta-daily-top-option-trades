import { assessRegime } from "@/lib/market/regime";
import type { MarketSnapshot, MarketSymbolSnapshot, OptionContract } from "@/lib/market/types";
import { getSymbolProfile } from "@/lib/market/universe";
import { getDefaultModelSettings } from "@/lib/model/settings";
import { getEntryWidth } from "@/lib/model/simulation";
import type { OptionLeg, SpreadStyle, TradeCandidate } from "@/lib/model/types";

type DiscoverySettings = {
  minVolume: number;
  minOpenInterest: number;
  maxBidAskWidthPct: number;
};

type PairDefinition = {
  long: OptionContract;
  short: OptionContract;
  fit: number;
};

export type DiscoveryResult = {
  candidates: TradeCandidate[];
  rejectionCounts: Record<string, number>;
};

export function discoverCandidates(snapshot: MarketSnapshot): DiscoveryResult {
  const settings = getDiscoverySettings();
  const modelSettings = getDefaultModelSettings();
  const candidates: TradeCandidate[] = [];
  const rejectionCounts: Record<string, number> = {};

  for (const symbolData of snapshot.symbols) {
    const regime = assessRegime(symbolData.bars);
    const styles: SpreadStyle[] = regime.direction === "bullish"
      ? ["call_debit", "put_credit"]
      : ["put_debit", "call_credit"];
    for (const style of styles) {
      const pair = choosePair(symbolData, style, settings);
      if (!pair) {
        increment(rejectionCounts, "No liquid vertical matched the structure rules");
        continue;
      }
      const candidate = buildCandidate(symbolData, style, pair, snapshot.asOfUtc);
      const entry = getEntryWidth(candidate);
      if (entry.entry <= 0 || entry.entry >= entry.width * 0.95) {
        increment(rejectionCounts, "Conservative entry consumed nearly all spread width");
        continue;
      }
      if (entry.maxLoss * 100 > modelSettings.maxSingleTradeRiskDollars) {
        increment(rejectionCounts, "One-lot risk exceeded the publication limit");
        continue;
      }
      candidates.push(candidate);
    }
  }

  return {
    candidates: candidates.sort((a, b) => a.symbol.localeCompare(b.symbol) || a.style.localeCompare(b.style) || a.id.localeCompare(b.id)),
    rejectionCounts
  };
}

function choosePair(symbolData: MarketSymbolSnapshot, style: SpreadStyle, settings: DiscoverySettings): PairDefinition | null {
  const right = style === "call_debit" || style === "call_credit" ? "C" : "P";
  const contracts = symbolData.options
    .filter((contract) => contract.right === right)
    .filter((contract) => isLiquid(contract, settings))
    .sort((a, b) => a.strike - b.strike || a.optionSymbol.localeCompare(b.optionSymbol));
  const pairs: PairDefinition[] = [];
  for (const first of contracts) {
    for (const second of contracts) {
      const assignment = assignLegs(style, first, second);
      if (!assignment) continue;
      const width = Math.abs(assignment.long.strike - assignment.short.strike);
      const minWidth = Math.max(inferStrikeStep(contracts), symbolData.quote.last * 0.004);
      const maxWidth = Math.max(minWidth, Math.min(10, symbolData.quote.last * 0.08));
      if (width < minWidth - 1e-9 || width > maxWidth + 1e-9) continue;
      const isDebit = style.includes("debit");
      const conservativeEntry = isDebit
        ? assignment.long.ask - assignment.short.bid
        : assignment.short.bid - assignment.long.ask;
      const entryToWidth = conservativeEntry / Math.max(width, 0.01);
      if (conservativeEntry <= 0) continue;
      if (isDebit && entryToWidth > 0.72) continue;
      if (!isDebit && entryToWidth < 0.15) continue;

      const longDelta = deltaAbs(assignment.long, symbolData.quote.last);
      const shortDelta = deltaAbs(assignment.short, symbolData.quote.last);
      const targets = style.includes("debit")
        ? { long: 0.5, short: 0.28 }
        : { long: 0.12, short: 0.24 };
      const spreadPenalty = quoteWidthPct(assignment.long) + quoteWidthPct(assignment.short);
      const widthTarget = Math.max(minWidth, Math.min(maxWidth, symbolData.quote.last * 0.025));
      const widthPenalty = Math.abs(width - widthTarget) / Math.max(widthTarget, 0.01);
      const economicsPenalty = isDebit
        ? Math.max(0, entryToWidth - 0.5) * 1.5
        : Math.abs(entryToWidth - 0.28) * 0.6;
      const fit = Math.abs(longDelta - targets.long) * 3 + Math.abs(shortDelta - targets.short) * 3 + spreadPenalty + widthPenalty * 0.25 + economicsPenalty;
      pairs.push({ ...assignment, fit });
    }
  }
  return pairs.sort((a, b) => a.fit - b.fit || a.long.strike - b.long.strike || a.short.strike - b.short.strike)[0] ?? null;
}

function assignLegs(style: SpreadStyle, first: OptionContract, second: OptionContract) {
  if (first.optionSymbol === second.optionSymbol) return null;
  if (style === "call_debit" && first.strike < second.strike) return { long: first, short: second };
  if (style === "put_debit" && first.strike > second.strike) return { long: first, short: second };
  if (style === "put_credit" && first.strike < second.strike) return { long: first, short: second };
  if (style === "call_credit" && first.strike > second.strike) return { long: first, short: second };
  return null;
}

function buildCandidate(symbolData: MarketSymbolSnapshot, style: SpreadStyle, pair: PairDefinition, sourceAsOfUtc: string): TradeCandidate {
  const regime = assessRegime(symbolData.bars);
  const profile = getSymbolProfile(symbolData.symbol);
  const structureType = style.includes("debit") ? "Debit" : "Credit";
  const direction = style === "call_debit" || style === "put_credit" ? "bullish" : "bearish";
  const displayLegs = structureType === "Credit" ? [pair.short.strike, pair.long.strike] : [pair.long.strike, pair.short.strike];
  const styleName = style.split("_").map(capitalize).join(" ");
  const expirationLabel = new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric", timeZone: "UTC" })
    .format(new Date(`${symbolData.expiration}T00:00:00Z`));
  const evidence = [
    `Underlying ${formatMoney(symbolData.quote.last)} at the source timestamp`,
    regime.rationale,
    `${pair.long.volume + pair.short.volume} contracts of combined session volume and ${pair.long.openInterest + pair.short.openInterest} contracts of combined open interest across the two legs`
  ];
  const thesis = `${symbolData.symbol} is expressing a ${direction} ${regime.label.replaceAll("_", " ")} setup: ${regime.rationale} The ${styleName.toLowerCase()} contains the thesis to a defined one-lot loss while preserving a measurable payoff through ${expirationLabel}.`;

  return {
    id: `${symbolData.symbol.toLowerCase()}-${symbolData.expiration}-${style}-${formatStrike(pair.long.strike)}-${formatStrike(pair.short.strike)}`,
    name: `${symbolData.symbol} ${expirationLabel} ${formatStrike(displayLegs[0] ?? 0)}/${formatStrike(displayLegs[1] ?? 0)} ${styleName} Spread`,
    symbol: symbolData.symbol,
    underlyingMark: symbolData.quote.last,
    expiration: symbolData.expiration,
    daysToExpiry: dayDiff(symbolData.quote.tradeTimeUtc.slice(0, 10), symbolData.expiration),
    structureType,
    style,
    longLeg: toLeg(pair.long),
    shortLeg: toLeg(pair.short),
    theme: profile.theme,
    thesis,
    liquidityScore: liquidityScore(pair.long, pair.short, getDiscoverySettings()),
    regime: regime.label,
    direction,
    signalStrength: regime.signalStrength,
    correlationBucket: profile.correlationBucket,
    sourceAsOfUtc,
    marketEvidence: evidence,
    fiveDayReturn: regime.fiveDayReturn,
    twentyDayReturn: regime.twentyDayReturn,
    realizedVolatility: regime.realizedVolatility
  };
}

function toLeg(contract: OptionContract): OptionLeg {
  return {
    optionSymbol: contract.optionSymbol,
    right: contract.right,
    strike: contract.strike,
    bid: contract.bid,
    ask: contract.ask,
    mid: (contract.bid + contract.ask) / 2,
    volume: contract.volume,
    openInterest: contract.openInterest,
    ...(contract.delta !== undefined ? { delta: contract.delta } : {}),
    ...(contract.impliedVolatility !== undefined ? { impliedVolatility: contract.impliedVolatility } : {}),
    ...(contract.quoteTimeUtc ? { quoteTimeUtc: contract.quoteTimeUtc } : {})
  };
}

function isLiquid(contract: OptionContract, settings: DiscoverySettings) {
  const hasDepth = contract.openInterest >= settings.minOpenInterest;
  const hasFlow = contract.volume >= settings.minVolume || contract.openInterest >= settings.minOpenInterest * 4;
  return contract.bid > 0 && contract.ask > contract.bid && quoteWidthPct(contract) <= settings.maxBidAskWidthPct && hasDepth && hasFlow;
}

function liquidityScore(long: OptionContract, short: OptionContract, settings: DiscoverySettings) {
  const widthQuality = 1 - Math.min(1, (quoteWidthPct(long) + quoteWidthPct(short)) / (settings.maxBidAskWidthPct * 2));
  const depth = Math.min(1, Math.log10(Math.max(10, long.openInterest + short.openInterest)) / 4);
  const flow = Math.min(1, Math.log10(Math.max(10, long.volume + short.volume)) / 3.5);
  return Math.max(0, Math.min(1, widthQuality * 0.5 + depth * 0.3 + flow * 0.2));
}

function deltaAbs(contract: OptionContract, spot: number) {
  if (contract.delta !== undefined && Number.isFinite(contract.delta)) return Math.abs(contract.delta);
  const moneyness = Math.log(spot / contract.strike);
  const callApproximation = 1 / (1 + Math.exp(-moneyness * 18));
  return contract.right === "C" ? callApproximation : 1 - callApproximation;
}

function quoteWidthPct(contract: OptionContract) {
  const mid = (contract.bid + contract.ask) / 2;
  return mid > 0 ? ((contract.ask - contract.bid) / mid) * 100 : 100;
}

function inferStrikeStep(contracts: OptionContract[]) {
  const diffs = contracts.slice(1).map((contract, index) => contract.strike - (contracts[index]?.strike ?? contract.strike)).filter((value) => value > 0);
  return diffs.sort((a, b) => a - b)[0] ?? 0.5;
}

function getDiscoverySettings(): DiscoverySettings {
  return {
    minVolume: envNumber("REPORT_MIN_OPTION_VOLUME", 25),
    minOpenInterest: envNumber("REPORT_MIN_OPEN_INTEREST", 100),
    maxBidAskWidthPct: envNumber("REPORT_MAX_BID_ASK_WIDTH_PCT", 30)
  };
}

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function increment(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function dayDiff(start: string, end: string) {
  return Math.max(1, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000));
}

function formatStrike(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/u, "").replace(/\.$/u, "");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value < 10 ? 2 : 0 }).format(value);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
