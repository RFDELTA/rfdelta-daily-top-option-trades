export type EquityQuote = {
  symbol: string;
  last: number;
  bid: number;
  ask: number;
  previousClose: number;
  previousCloseDate?: string;
  changePct: number;
  volume: number;
  tradeTimeUtc: string;
  sessionDate?: string;
  dayOpen?: number;
  dayHigh?: number;
  dayLow?: number;
};

export type DailyBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type OptionContract = {
  optionSymbol: string;
  underlying: string;
  expiration: string;
  right: "C" | "P";
  strike: number;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  openInterest: number;
  delta?: number;
  impliedVolatility?: number;
  quoteTimeUtc?: string;
};

export type MarketSymbolSnapshot = {
  symbol: string;
  quote: EquityQuote;
  bars: DailyBar[];
  expiration: string;
  options: OptionContract[];
};

export type HistoricalDataProvenance = {
  provider: "Yahoo Finance";
  dataset: "Public daily chart history";
  queryStartDate: string;
  queryEndDate: string;
  requestedSymbolCount: number;
  hydratedSymbolCount: number;
  totalBarCount: number;
  coverageRatio: number;
};

export type OptionChainSelection = {
  strategyVersion: "rfdelta-chain-preselection-v1";
  quoteUniverseCount: number;
  selectedSymbolCount: number;
  core: string[];
  movers: string[];
  volume: string[];
  rotation: string[];
  selectedSymbols: string[];
};

export type MarketSnapshot = {
  provider: string;
  providerAttribution: string;
  sourceFingerprint?: string;
  reportDate: string;
  sessionDate: string;
  asOfUtc: string;
  universe: string[];
  symbols: MarketSymbolSnapshot[];
  excludedSymbols: Array<{ symbol: string; reason: string }>;
  historicalData?: HistoricalDataProvenance;
  chainSelection?: OptionChainSelection;
};

export type SnapshotRequest = {
  reportDate: string;
  universe: string[];
};

export interface MarketDataProvider {
  getSnapshot(request: SnapshotRequest): Promise<MarketSnapshot>;
}

export class NoFreshMarketSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoFreshMarketSessionError";
  }
}
