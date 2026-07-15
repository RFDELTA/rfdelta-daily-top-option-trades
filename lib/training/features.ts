import type { MarketSnapshot, MarketSymbolSnapshot, OptionContract } from "@/lib/market/types";
import { impliedVolBisection } from "@/lib/model/math";
import type { AdvancedMarketMetrics } from "@/lib/model/types";
import type { MarketFeatureDataset } from "@/lib/training/types";

export function computeMarketFeatureDataset(snapshot: MarketSnapshot): MarketFeatureDataset {
  return {
    schemaVersion: "1.0",
    featureVersion: "rfdelta-market-features-v2",
    reportDate: snapshot.reportDate,
    dataAsOfUtc: snapshot.asOfUtc,
    ...(snapshot.sourceFingerprint ? { sourceFingerprint: snapshot.sourceFingerprint } : {}),
    ...(snapshot.historicalData ? { historicalData: snapshot.historicalData } : {}),
    ...(snapshot.chainSelection ? { chainSelection: snapshot.chainSelection } : {}),
    symbols: snapshot.symbols.map(computeSymbolMetrics).sort((a, b) => a.symbol.localeCompare(b.symbol))
  };
}

export function featureMap(dataset: MarketFeatureDataset) {
  return new Map(dataset.symbols.map((metrics) => [metrics.symbol, metrics]));
}

export function computeSymbolMetrics(symbolData: MarketSymbolSnapshot): AdvancedMarketMetrics {
  const bars = [...symbolData.bars].sort((a, b) => a.date.localeCompare(b.date));
  const closes = bars.map((bar) => bar.close).filter((value) => value > 0);
  const volumes = bars.map((bar) => bar.volume).filter((value) => value >= 0);
  const spot = symbolData.quote.last;
  const return1d = periodReturn(closes, 1, symbolData.quote.changePct);
  const return5d = periodReturn(closes, 5, return1d);
  const return15d = periodReturn(closes, 15, return5d);
  const return20d = periodReturn(closes, 20, return5d);
  const return60d = periodReturn(closes, 60, return20d);
  const sma5 = mean(closes.slice(-5)) || spot;
  const sma20 = mean(closes.slice(-20)) || spot;
  const ema5 = ema(closes, 5) || spot;
  const ema12 = ema(closes, 12) || spot;
  const ema20 = ema(closes, 20) || spot;
  const ema26 = ema(closes, 26) || spot;
  const macdSeries = buildMacdSeries(closes);
  const macd = ema12 - ema26;
  const macdSignal = ema(macdSeries, 9);
  const fallbackVolatility = clamp(Math.abs(return1d) * Math.sqrt(252), 0.25, 1.5);
  const realizedVol5 = blendedVolatility(annualizedVolatility(closes.slice(-6)), fallbackVolatility, closes.length / 6);
  const realizedVol20 = blendedVolatility(annualizedVolatility(closes.slice(-21)), fallbackVolatility, closes.length / 21);
  const downsideObserved = annualizedDownsideVolatility(closes.slice(-21));
  const downsideVol20 = blendedVolatility(downsideObserved, return1d < 0 ? fallbackVolatility : fallbackVolatility * 0.7, closes.length / 21);
  const bollingerDeviation = standardDeviation(closes.slice(-20));
  const bollingerZ20 = bollingerDeviation > 0 ? (spot - sma20) / bollingerDeviation : 0;
  const atr14Pct = averageTrueRangePct(bars.slice(-15), spot);
  const trendEfficiency20 = trendEfficiency(closes.slice(-21));
  const historyConfidence = clamp(closes.length / 21, 0.1, 1);
  const rawRsi14 = rsi(closes, 14);
  const adjustedRsi14 = 50 + (rawRsi14 - 50) * historyConfidence;
  const optionMetrics = computeOptionMetrics(symbolData);
  const dailyRisk = Math.max(realizedVol20 / Math.sqrt(252), 0.01);
  const rawTrend = (return5d * 0.6 + return20d * 0.4) / (dailyRisk * 3);
  const trendSignal = clamp(rawTrend, -1, 1) * historyConfidence;
  const riskAdjustedMomentum = clamp((return20d / Math.max(realizedVol20, 0.15)) * 4, -1, 1) * historyConfidence;

  return roundMetrics({
    symbol: symbolData.symbol,
    historySessions: closes.length,
    historyConfidence,
    return1d,
    return5d,
    return15d,
    return20d,
    return60d,
    sma5Distance: spot / Math.max(sma5, 0.01) - 1,
    sma20Distance: spot / Math.max(sma20, 0.01) - 1,
    emaTrend: ema5 / Math.max(ema20, 0.01) - 1,
    macdPct: (macd - macdSignal) / Math.max(spot, 0.01),
    rsi14: adjustedRsi14,
    atr14Pct,
    bollingerZ20,
    realizedVol5,
    realizedVol20,
    downsideVol20,
    maxDrawdown20: maxDrawdown(closes.slice(-21)),
    trendEfficiency20,
    volumeZScore20: zScoreLast(volumes.slice(-20)),
    ...optionMetrics,
    trendSignal,
    riskAdjustedMomentum
  });
}

function computeOptionMetrics(symbolData: MarketSymbolSnapshot) {
  const spot = symbolData.quote.last;
  const dte = Math.max(1, dayDiff(symbolData.quote.sessionDate ?? symbolData.quote.tradeTimeUtc.slice(0, 10), symbolData.expiration));
  const t = dte / 365;
  const contracts = symbolData.options.filter((option) => option.ask > 0 && option.ask >= option.bid);
  const ivRows = contracts.map((option) => ({ option, iv: impliedVol(option, spot, t) }));
  const calls = ivRows.filter((row) => row.option.right === "C");
  const puts = ivRows.filter((row) => row.option.right === "P");
  const atmCall = nearestToSpot(calls, spot);
  const atmPut = nearestToSpot(puts, spot);
  const atmIvs = [atmCall?.iv, atmPut?.iv].filter((value): value is number => value !== undefined && Number.isFinite(value));
  const putSkew = mean(puts.filter((row) => row.option.strike <= spot).slice(-4).map((row) => row.iv));
  const callSkew = mean(calls.filter((row) => row.option.strike >= spot).slice(0, 4).map((row) => row.iv));
  const callVolume = calls.reduce((sum, row) => sum + row.option.volume, 0);
  const putVolume = puts.reduce((sum, row) => sum + row.option.volume, 0);
  const callOi = calls.reduce((sum, row) => sum + row.option.openInterest, 0);
  const putOi = puts.reduce((sum, row) => sum + row.option.openInterest, 0);
  const widths = contracts.map(quoteWidthPct).filter(Number.isFinite);
  const liquid = contracts.filter((option) => option.bid > 0 && option.ask > option.bid && option.openInterest >= 100 && quoteWidthPct(option) <= 30);
  const straddle = (atmCall ? midpoint(atmCall.option) : 0) + (atmPut ? midpoint(atmPut.option) : 0);
  return {
    atmImpliedVol: mean(atmIvs) || 0,
    putCallIvSkew: putSkew && callSkew ? putSkew - callSkew : 0,
    putCallVolumeRatio: putVolume / Math.max(callVolume, 1),
    putCallOpenInterestRatio: putOi / Math.max(callOi, 1),
    expectedMovePct: straddle / Math.max(spot, 0.01),
    meanQuoteWidthPct: mean(widths),
    liquidContractRatio: liquid.length / Math.max(contracts.length, 1)
  };
}

function impliedVol(option: OptionContract, spot: number, t: number) {
  if (option.impliedVolatility && option.impliedVolatility > 0.01) return clamp(option.impliedVolatility, 0.01, 5);
  const mid = midpoint(option);
  const intrinsic = option.right === "C" ? Math.max(0, spot - option.strike) : Math.max(0, option.strike - spot);
  if (mid <= intrinsic + 0.001) return 0.01;
  return clamp(impliedVolBisection({ s: spot, k: option.strike, t, r: 0.045, price: mid, right: option.right }), 0.01, 5);
}

function nearestToSpot<T extends { option: OptionContract }>(rows: T[], spot: number) {
  return [...rows].sort((a, b) => Math.abs(a.option.strike - spot) - Math.abs(b.option.strike - spot) || a.option.strike - b.option.strike)[0];
}

function midpoint(option: OptionContract) {
  return (option.bid + option.ask) / 2;
}

function quoteWidthPct(option: OptionContract) {
  const mid = midpoint(option);
  return mid > 0 ? ((option.ask - option.bid) / mid) * 100 : 100;
}

function periodReturn(closes: number[], sessions: number, fallback: number) {
  const last = closes.at(-1);
  const base = closes[Math.max(0, closes.length - sessions - 1)];
  return last && base && closes.length > 1 ? last / base - 1 : fallback;
}

function ema(values: number[], period: number) {
  if (!values.length) return 0;
  const alpha = 2 / (period + 1);
  return values.slice(1).reduce((current, value) => current + alpha * (value - current), values[0] ?? 0);
}

function buildMacdSeries(closes: number[]) {
  return closes.map((_, index) => {
    const values = closes.slice(0, index + 1);
    return ema(values, 12) - ema(values, 26);
  });
}

function rsi(closes: number[], period: number) {
  const returns = closes.slice(1).map((close, index) => close - (closes[index] ?? close)).slice(-period);
  if (!returns.length) return 50;
  const gains = mean(returns.map((value) => Math.max(0, value)));
  const losses = mean(returns.map((value) => Math.max(0, -value)));
  if (losses === 0) return gains > 0 ? 100 : 50;
  return 100 - 100 / (1 + gains / losses);
}

function averageTrueRangePct(bars: MarketSymbolSnapshot["bars"], spot: number) {
  if (!bars.length) return 0;
  const ranges = bars.map((bar, index) => {
    const previous = bars[index - 1]?.close ?? bar.open;
    return Math.max(bar.high - bar.low, Math.abs(bar.high - previous), Math.abs(bar.low - previous));
  });
  return mean(ranges) / Math.max(spot, 0.01);
}

function annualizedVolatility(closes: number[]) {
  const returns = logReturns(closes);
  return standardDeviation(returns) * Math.sqrt(252);
}

function annualizedDownsideVolatility(closes: number[]) {
  const downside = logReturns(closes).filter((value) => value < 0);
  return standardDeviation(downside) * Math.sqrt(252);
}

function blendedVolatility(observed: number, fallback: number, confidence: number) {
  const weight = clamp(confidence, 0, 1);
  return observed * weight + fallback * (1 - weight);
}

function logReturns(closes: number[]) {
  return closes.slice(1).map((close, index) => Math.log(close / Math.max(closes[index] ?? close, 0.01)));
}

function maxDrawdown(closes: number[]) {
  let peak = closes[0] ?? 0;
  let drawdown = 0;
  for (const close of closes) {
    peak = Math.max(peak, close);
    if (peak > 0) drawdown = Math.min(drawdown, close / peak - 1);
  }
  return drawdown;
}

function trendEfficiency(closes: number[]) {
  if (closes.length < 2) return 0;
  const net = Math.abs((closes.at(-1) ?? 0) - (closes[0] ?? 0));
  const path = closes.slice(1).reduce((sum, close, index) => sum + Math.abs(close - (closes[index] ?? close)), 0);
  return path > 0 ? net / path : 0;
}

function zScoreLast(values: number[]) {
  const deviation = standardDeviation(values);
  return values.length && deviation > 0 ? ((values.at(-1) ?? 0) - mean(values)) / deviation : 0;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(variance, 0));
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function roundMetrics(metrics: AdvancedMarketMetrics): AdvancedMarketMetrics {
  return Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, typeof value === "number" ? round(value, 6) : value])) as AdvancedMarketMetrics;
}

function dayDiff(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

function round(value: number, places: number) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
