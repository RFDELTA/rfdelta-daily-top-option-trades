type SymbolProfile = { theme: string; correlationBucket: string };

export const UNIVERSE_GROUPS = {
  marketAndSectorEtfs: [
    "SPY", "QQQ", "IWM", "DIA", "RSP", "MDY", "EEM", "FXI", "ARKK", "HYG",
    "TLT", "GLD", "SLV", "USO", "XLE", "XLF", "XLK", "SMH", "XBI"
  ],
  technologyAndAi: [
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA", "PLTR", "ORCL", "CRM",
    "NOW", "ADBE", "NFLX", "UBER", "SHOP", "SNOW", "PANW", "CRWD", "DDOG", "NET",
    "APP", "IBM", "DELL"
  ],
  semiconductors: [
    "AMD", "AVGO", "TSM", "ASML", "QCOM", "INTC", "ARM", "AMAT", "LRCX", "KLAC",
    "MRVL", "ON", "TXN", "MU", "SMCI"
  ],
  financeAndDigitalAssets: [
    "JPM", "BAC", "WFC", "GS", "MS", "C", "V", "MA", "AXP", "COF", "PYPL", "HOOD",
    "SOFI", "COIN", "MSTR", "MARA", "RIOT"
  ],
  defenseAndSpace: [
    "LMT", "RTX", "NOC", "GD", "BA", "HII", "LHX", "LDOS", "RKLB", "ASTS", "SPCE"
  ],
  healthcareAndBiotech: [
    "LLY", "UNH", "JNJ", "PFE", "MRK", "ABBV", "TMO", "AMGN", "GILD", "MRNA"
  ],
  industrialsEnergyAndMaterials: [
    "CAT", "DE", "GE", "ETN", "HON", "UPS", "FDX", "XOM", "CVX", "COP", "OXY", "SLB",
    "HAL", "FCX", "NEM", "NUE"
  ],
  consumerAndCommunications: [
    "WMT", "COST", "HD", "LOW", "TGT", "MCD", "SBUX", "NKE", "DIS", "CMCSA", "T", "VZ",
    "SNAP", "RBLX", "GM", "F"
  ],
  emergingAndHighBeta: [
    "RGTI", "QUBT", "IONQ", "QBTS", "SOUN", "OPEN", "AMC", "GME", "CVNA", "RIVN", "LCID",
    "ACHR", "JOBY"
  ]
} as const;

const GROUP_PROFILES: Record<keyof typeof UNIVERSE_GROUPS, SymbolProfile> = {
  marketAndSectorEtfs: { theme: "cross-asset and sector positioning", correlationBucket: "market-etfs" },
  technologyAndAi: { theme: "technology and AI leadership", correlationBucket: "large-cap-growth" },
  semiconductors: { theme: "semiconductors and compute infrastructure", correlationBucket: "semiconductors" },
  financeAndDigitalAssets: { theme: "financial and digital-market structure", correlationBucket: "financials" },
  defenseAndSpace: { theme: "defense, aerospace and space systems", correlationBucket: "defense-space" },
  healthcareAndBiotech: { theme: "healthcare and biotechnology", correlationBucket: "healthcare" },
  industrialsEnergyAndMaterials: { theme: "industrial, energy and materials cycle", correlationBucket: "cyclicals" },
  consumerAndCommunications: { theme: "consumer and communications demand", correlationBucket: "consumer" },
  emergingAndHighBeta: { theme: "emerging technology and high-beta growth", correlationBucket: "high-beta-growth" }
};

const PROFILE: Record<string, SymbolProfile> = Object.fromEntries(
  Object.entries(UNIVERSE_GROUPS).flatMap(([group, symbols]) =>
    symbols.map((symbol) => [symbol, GROUP_PROFILES[group as keyof typeof UNIVERSE_GROUPS]])
  )
);

Object.assign(PROFILE, {
  SPY: { theme: "broad-market risk", correlationBucket: "broad-market" },
  QQQ: { theme: "large-cap growth", correlationBucket: "large-cap-growth" },
  IWM: { theme: "small-cap breadth", correlationBucket: "broad-market" },
  DIA: { theme: "industrial blue chips", correlationBucket: "broad-market" },
  NVDA: { theme: "AI compute", correlationBucket: "semiconductors" },
  AMD: { theme: "AI compute", correlationBucket: "semiconductors" },
  AVGO: { theme: "connectivity and AI infrastructure", correlationBucket: "semiconductors" },
  SMH: { theme: "semiconductor complex", correlationBucket: "semiconductors" },
  PLTR: { theme: "defense software and AI", correlationBucket: "defense-space" },
  COIN: { theme: "digital-asset market structure", correlationBucket: "digital-assets" },
  MSTR: { theme: "bitcoin-linked corporate exposure", correlationBucket: "digital-assets" },
  MARA: { theme: "bitcoin mining", correlationBucket: "digital-assets" },
  RIOT: { theme: "bitcoin mining", correlationBucket: "digital-assets" },
  XLE: { theme: "energy", correlationBucket: "real-assets" },
  GLD: { theme: "precious metals", correlationBucket: "real-assets" },
  SLV: { theme: "precious metals", correlationBucket: "real-assets" },
  TLT: { theme: "long-duration rates", correlationBucket: "rates" },
  LMT: { theme: "defense systems", correlationBucket: "defense-space" },
  RTX: { theme: "aerospace and defense systems", correlationBucket: "defense-space" },
  RKLB: { theme: "launch and space systems", correlationBucket: "defense-space" },
  ASTS: { theme: "space-based communications", correlationBucket: "defense-space" },
  RGTI: { theme: "quantum computing", correlationBucket: "quantum" },
  QUBT: { theme: "quantum computing", correlationBucket: "quantum" },
  IONQ: { theme: "quantum computing", correlationBucket: "quantum" },
  QBTS: { theme: "quantum computing", correlationBucket: "quantum" }
} satisfies Record<string, SymbolProfile>);

const DEFAULT_UNIVERSE = Object.values(UNIVERSE_GROUPS).flat();

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
