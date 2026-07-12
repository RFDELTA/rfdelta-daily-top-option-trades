export type EquityQuote = {
  symbol: string;
  last: number;
  bid: number;
  ask: number;
  previousClose: number;
  changePct: number;
  volume: number;
  tradeTimeUtc: string;
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

export type MarketSnapshot = {
  provider: string;
  providerAttribution: string;
  reportDate: string;
  sessionDate: string;
  asOfUtc: string;
  universe: string[];
  symbols: MarketSymbolSnapshot[];
  excludedSymbols: Array<{ symbol: string; reason: string }>;
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
