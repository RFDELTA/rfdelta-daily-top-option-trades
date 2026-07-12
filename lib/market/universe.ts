const DEFAULT_UNIVERSE = [
  "SPY", "QQQ", "IWM", "AAPL", "MSFT", "NVDA", "AMD", "AMZN", "META", "GOOGL",
  "TSLA", "PLTR", "AVGO", "COIN", "MSTR", "SMH", "XLE", "GLD", "TLT", "SOFI"
];

const PROFILE: Record<string, { theme: string; correlationBucket: string }> = {
  SPY: { theme: "broad-market risk", correlationBucket: "broad-market" },
  QQQ: { theme: "large-cap growth", correlationBucket: "large-cap-growth" },
  IWM: { theme: "small-cap breadth", correlationBucket: "broad-market" },
  AAPL: { theme: "consumer technology", correlationBucket: "large-cap-growth" },
  MSFT: { theme: "cloud and enterprise AI", correlationBucket: "large-cap-growth" },
  NVDA: { theme: "AI compute", correlationBucket: "semiconductors" },
  AMD: { theme: "AI compute", correlationBucket: "semiconductors" },
  AVGO: { theme: "connectivity and AI infrastructure", correlationBucket: "semiconductors" },
  SMH: { theme: "semiconductor complex", correlationBucket: "semiconductors" },
  AMZN: { theme: "cloud and consumer demand", correlationBucket: "large-cap-growth" },
  META: { theme: "digital advertising and AI", correlationBucket: "large-cap-growth" },
  GOOGL: { theme: "search, cloud and AI", correlationBucket: "large-cap-growth" },
  TSLA: { theme: "mobility and high-beta growth", correlationBucket: "high-beta-growth" },
  PLTR: { theme: "defense software and AI", correlationBucket: "high-beta-growth" },
  COIN: { theme: "digital-asset market structure", correlationBucket: "digital-assets" },
  MSTR: { theme: "bitcoin-linked corporate exposure", correlationBucket: "digital-assets" },
  XLE: { theme: "energy", correlationBucket: "real-assets" },
  GLD: { theme: "precious metals", correlationBucket: "real-assets" },
  TLT: { theme: "long-duration rates", correlationBucket: "rates" },
  SOFI: { theme: "consumer finance", correlationBucket: "high-beta-growth" },
  SPCE: { theme: "commercial space", correlationBucket: "high-beta-growth" },
  OPEN: { theme: "housing technology", correlationBucket: "high-beta-growth" },
  QUBT: { theme: "quantum computing", correlationBucket: "quantum" },
  RGTI: { theme: "quantum computing", correlationBucket: "quantum" },
  SOUN: { theme: "voice AI", correlationBucket: "high-beta-growth" },
  MARA: { theme: "bitcoin mining", correlationBucket: "digital-assets" },
  SMCI: { theme: "AI servers", correlationBucket: "semiconductors" },
  AMC: { theme: "event-driven consumer", correlationBucket: "high-beta-growth" }
};

export function getUniverse(): string[] {
  const configured = process.env.OPTIONS_UNIVERSE?.split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
  return [...new Set(configured?.length ? configured : DEFAULT_UNIVERSE)];
}

export function getSymbolProfile(symbol: string) {
  return PROFILE[symbol] ?? {
    theme: "liquid U.S. equity options",
    correlationBucket: "other"
  };
}
