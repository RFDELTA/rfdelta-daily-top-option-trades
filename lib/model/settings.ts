export type ModelSettings = {
  publishIdeaCount: number;
  forceMinCreditSpreads: number;
  forceMinDebitSpreads: number;
  maxSingleTradeRiskDollars: number;
  maxTotalBasketRiskDollars: number;
  pathsPerCandidate: number;
  riskFreeRate: number;
  deterministicSeed: number;
  creditSpreadPriorBoost: number;
  debitLotteryPenalty: number;
  minCreditReceivedWidthPct: number;
  minProfitProbabilityCredit: number;
  minProfitProbabilityDebit: number;
  regimeShockWeight: number;
  jumpShockProbability: number;
};

function num(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getDefaultModelSettings(): ModelSettings {
  return {
    publishIdeaCount: num("PUBLISH_IDEA_COUNT", 5),
    forceMinCreditSpreads: num("PUBLISH_FORCE_MIN_CREDIT_SPREADS", 1),
    forceMinDebitSpreads: num("PUBLISH_FORCE_MIN_DEBIT_SPREADS", 2),
    maxSingleTradeRiskDollars: num("PUBLISH_MAX_SINGLE_TRADE_RISK_DOLLARS", 150),
    maxTotalBasketRiskDollars: num("PUBLISH_MAX_TOTAL_BASKET_RISK_DOLLARS", 500),
    pathsPerCandidate: num("MODEL_PATHS_PER_CANDIDATE", 100000),
    riskFreeRate: num("MODEL_DEFAULT_RISK_FREE_RATE", 0.045),
    deterministicSeed: num("MODEL_DETERMINISTIC_SEED", 6192026),
    creditSpreadPriorBoost: num("MODEL_CREDIT_SPREAD_PRIOR_BOOST", 0.18),
    debitLotteryPenalty: num("MODEL_DEBIT_LOTTERY_PENALTY", 0.12),
    minCreditReceivedWidthPct: num("MODEL_MIN_CREDIT_RECEIVED_WIDTH_PCT", 0.2),
    minProfitProbabilityCredit: num("MODEL_MIN_PROFIT_PROBABILITY_CREDIT", 0.52),
    minProfitProbabilityDebit: num("MODEL_MIN_PROFIT_PROBABILITY_DEBIT", 0.25),
    regimeShockWeight: num("MODEL_REGIME_SHOCK_WEIGHT", 0.35),
    jumpShockProbability: num("MODEL_JUMP_SHOCK_PROBABILITY", 0.06)
  };
}
