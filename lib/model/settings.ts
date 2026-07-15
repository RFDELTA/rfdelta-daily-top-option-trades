export type ModelSettings = {
  publishIdeaCount: number;
  forceMinCreditSpreads: number;
  forceMinDebitSpreads: number;
  maxSingleTradeRiskDollars: number;
  maxTotalBasketRiskDollars: number;
  pathsPerCandidate: number;
  riskFreeRate: number;
  deterministicSeed: number;
  minCreditReceivedWidthPct: number;
  minProfitProbabilityCredit: number;
  minProfitProbabilityDebit: number;
  regimeShockWeight: number;
  jumpShockProbability: number;
  minPublicationScore: number;
  minProbabilityMargin: number;
  minPositiveModels: number;
  minConservativeExpectedValueDollars: number;
  minLiquidityScore: number;
  minMultiHorizonAlignment: number;
  minSessionConfirmationMovePct: number;
  requireCompleteLegData: boolean;
  requireSessionConfirmation: boolean;
};

function num(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (value === undefined || value === "") return fallback;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return fallback;
}

export function getDefaultModelSettings(): ModelSettings {
  return {
    publishIdeaCount: num("PUBLISH_IDEA_COUNT", 5),
    forceMinCreditSpreads: num("PUBLISH_FORCE_MIN_CREDIT_SPREADS", 1),
    forceMinDebitSpreads: num("PUBLISH_FORCE_MIN_DEBIT_SPREADS", 2),
    maxSingleTradeRiskDollars: num("PUBLISH_MAX_SINGLE_TRADE_RISK_DOLLARS", 250),
    maxTotalBasketRiskDollars: num("PUBLISH_MAX_TOTAL_BASKET_RISK_DOLLARS", 800),
    pathsPerCandidate: num("MODEL_PATHS_PER_CANDIDATE", 100000),
    riskFreeRate: num("MODEL_DEFAULT_RISK_FREE_RATE", 0.045),
    deterministicSeed: num("MODEL_DETERMINISTIC_SEED", 6192026),
    minCreditReceivedWidthPct: num("MODEL_MIN_CREDIT_RECEIVED_WIDTH_PCT", 0.2),
    minProfitProbabilityCredit: num("MODEL_MIN_PROFIT_PROBABILITY_CREDIT", 0.52),
    minProfitProbabilityDebit: num("MODEL_MIN_PROFIT_PROBABILITY_DEBIT", 0.25),
    regimeShockWeight: num("MODEL_REGIME_SHOCK_WEIGHT", 0.35),
    jumpShockProbability: num("MODEL_JUMP_SHOCK_PROBABILITY", 0.06),
    minPublicationScore: num("MODEL_MIN_PUBLICATION_SCORE", 70),
    minProbabilityMargin: num("MODEL_MIN_PROBABILITY_MARGIN", 0.05),
    minPositiveModels: num("MODEL_MIN_POSITIVE_MODELS", 3),
    minConservativeExpectedValueDollars: num("MODEL_MIN_CONSERVATIVE_EV_DOLLARS", 0),
    minLiquidityScore: num("MODEL_MIN_LIQUIDITY_SCORE", 0.8),
    minMultiHorizonAlignment: num("MODEL_MIN_MULTI_HORIZON_ALIGNMENT", 0.5),
    minSessionConfirmationMovePct: num("MODEL_MIN_SESSION_CONFIRMATION_MOVE_PCT", 0.0015),
    requireCompleteLegData: bool("MODEL_REQUIRE_COMPLETE_LEG_DATA", true),
    requireSessionConfirmation: bool("MODEL_REQUIRE_SESSION_CONFIRMATION", true)
  };
}
