import {
  LessonEvent,
  LessonSnapshot,
  SpreadStyle,
  StrategyPosterior,
  TradeIdeaScore
} from "@/lib/model/types";

export function createInitialLessonSnapshot(asOfUtc = new Date().toISOString()): LessonSnapshot {
  const posterior = (meanScore: number): StrategyPosterior => ({
    alpha: 2,
    beta: 2,
    sampleCount: 0,
    realizedPnlDollars: 0,
    meanScore,
    lastUpdatedUtc: asOfUtc
  });

  return {
    strategyPosteriors: {
      call_debit: posterior(0.5),
      put_debit: posterior(0.48),
      put_credit: posterior(0.5),
      call_credit: posterior(0.45)
    },
    latestNarrative:
      "Initial model state. Strategy priors are neutral until realized basket outcomes are applied.",
    events: []
  };
}

export type RealizedTradeOutcome = {
  id: string;
  style: SpreadStyle;
  realizedPnlDollars: number;
  wasWinner: boolean;
};

export function applyRealizedBasketLesson(
  snapshot: LessonSnapshot,
  basketId: string,
  outcomes: RealizedTradeOutcome[],
  asOfUtc = new Date().toISOString()
): LessonSnapshot {
  const next: LessonSnapshot = JSON.parse(JSON.stringify(snapshot));
  const debitPnl = outcomes
    .filter((x) => x.style.includes("debit"))
    .reduce((sum, x) => sum + x.realizedPnlDollars, 0);
  const creditPnl = outcomes
    .filter((x) => x.style.includes("credit"))
    .reduce((sum, x) => sum + x.realizedPnlDollars, 0);
  const totalPnl = debitPnl + creditPnl;
  const adjustments: string[] = [];

  for (const outcome of outcomes) {
    const post = next.strategyPosteriors[outcome.style];
    post.sampleCount += 1;
    post.realizedPnlDollars += outcome.realizedPnlDollars;
    post.alpha += outcome.wasWinner ? 1 : 0;
    post.beta += outcome.wasWinner ? 0 : 1;
    post.meanScore = post.alpha / (post.alpha + post.beta);
    post.lastUpdatedUtc = asOfUtc;
  }

  if (creditPnl > 0 && debitPnl < 0 && creditPnl > Math.abs(debitPnl)) {
    const creditPost = next.strategyPosteriors.put_credit;
    creditPost.alpha += 1.25;
    creditPost.meanScore = creditPost.alpha / (creditPost.alpha + creditPost.beta);
    adjustments.push(
      "Credit spread survivor sleeve increased because credit P/L carried the basket while debit spreads underperformed."
    );
  }

  if (debitPnl < 0) {
    const callDebit = next.strategyPosteriors.call_debit;
    callDebit.beta += 0.75;
    callDebit.meanScore = callDebit.alpha / (callDebit.alpha + callDebit.beta);
    adjustments.push(
      "Debit lottery penalty increased after multiple call debit spreads expired worthless."
    );
  }

  const narrative =
    creditPnl > debitPnl
      ? "Prior basket was carried by the credit-spread sleeve. The model will preserve credit-spread candidates when liquidity, credit-to-width, and short-strike distance are acceptable."
      : "Prior basket favored debit spread convexity. The model will continue to prioritize positive convexity while monitoring realized decay risk.";

  const event: LessonEvent = {
    id: basketId,
    createdAtUtc: asOfUtc,
    basketId,
    narrative,
    realizedPnlDollars: totalPnl,
    debitPnlDollars: debitPnl,
    creditPnlDollars: creditPnl,
    adjustments
  };

  next.events = [event, ...next.events].slice(0, 100);
  next.latestNarrative = narrative;
  return next;
}

export function getStylePosteriorAdjustment(snapshot: LessonSnapshot, style: SpreadStyle): number {
  const post = snapshot.strategyPosteriors[style];
  const posteriorMean = post.alpha / (post.alpha + post.beta);
  return (posteriorMean - 0.5) * 20;
}

export function explainLessonAdjustment(snapshot: LessonSnapshot, idea: TradeIdeaScore): string[] {
  const posterior = snapshot.strategyPosteriors[idea.style];
  const msgs = [
    `${idea.style} posterior mean ${(posterior.alpha / (posterior.alpha + posterior.beta)).toFixed(2)} from ${posterior.sampleCount} realized samples.`
  ];

  const latest = snapshot.events[0];
  if (latest?.adjustments.length) {
    msgs.push(...latest.adjustments);
  }

  return msgs;
}
