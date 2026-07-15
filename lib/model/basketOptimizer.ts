import { ModelSettings } from "@/lib/model/settings";
import { TradeIdeaScore } from "@/lib/model/types";

export function buildPublishBasket(
  rankedIdeas: TradeIdeaScore[],
  settings: ModelSettings
): TradeIdeaScore[] {
  const eligible = rankedIdeas.filter((idea) => idea.publicationEligible && idea.inference.hardGateFailures.length === 0);

  const selected: TradeIdeaScore[] = [];
  const add = (idea: TradeIdeaScore | undefined) => {
    if (!idea) return false;
    if (selected.some((x) => x.id === idea.id || x.symbol === idea.symbol)) return false;
    const sameBucket = selected.filter((x) => x.correlationBucket === idea.correlationBucket).length;
    if (sameBucket >= 2) return false;
    const totalRisk = selected.reduce((sum, x) => sum + x.maxLossDollars, 0) + idea.maxLossDollars;
    if (totalRisk <= settings.maxTotalBasketRiskDollars) {
      selected.push(idea);
      return true;
    }
    return false;
  };

  const credits = eligible
    .filter((x) => x.structureType === "Credit")
    .sort(compareIdeas);
  const debits = eligible
    .filter((x) => x.structureType === "Debit")
    .sort(compareIdeas);

  for (let i = 0; i < settings.forceMinCreditSpreads; i += 1) add(credits[i]);
  for (let i = 0; i < settings.forceMinDebitSpreads; i += 1) add(debits[i]);

  for (const idea of eligible.sort(compareIdeas)) {
    if (selected.length >= settings.publishIdeaCount) break;
    add(idea);
  }

  return selected
    .slice(0, settings.publishIdeaCount)
    .sort(compareIdeas)
    .map((idea, idx) => ({ ...idea, rank: idx + 1 }));
}

function compareIdeas(a: TradeIdeaScore, b: TradeIdeaScore) {
  return b.score - a.score || b.expectedValueDollars - a.expectedValueDollars || a.id.localeCompare(b.id);
}
