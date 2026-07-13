import type { MarketNewsItem } from "@/lib/report/types";

type NewsDiscoveryOptions = {
  symbols: string[];
  asOfUtc: string;
  maxItems?: number;
  fetcher?: typeof fetch;
};

export type RawNewsItem = {
  title?: unknown;
  publisher?: unknown;
  link?: unknown;
  providerPublishTime?: unknown;
  type?: unknown;
};

const TRUSTED_PUBLISHERS = new Map([
  ["reuters", 100],
  ["associated press", 96],
  ["bloomberg", 94],
  ["financial times", 92],
  ["the wall street journal", 90],
  ["cnbc", 88],
  ["marketwatch", 86],
  ["barrons.com", 84],
  ["yahoo finance", 82],
  ["investor's business daily", 78],
  ["morningstar", 76],
  ["investopedia", 74],
  ["mt newswires", 72],
  ["zacks", 70]
]);

const TOPIC_PATTERNS: Array<[MarketNewsItem["topic"], RegExp]> = [
  ["rates", /\b(fed|federal reserve|interest rate|inflation|treasury|yield|bond|cpi|pce|jobs report|payroll)\b/iu],
  ["earnings", /\b(earnings|revenue|profit|guidance|quarter|sales|forecast)\b/iu],
  ["energy", /\b(oil|crude|energy|opec|natural gas|refinery|pipeline)\b/iu],
  ["policy", /\b(tariff|trade policy|regulation|sec |antitrust|tax|congress|white house)\b/iu],
  ["geopolitics", /\b(war|strike|iran|russia|ukraine|china|taiwan|sanction|geopolit)\b/iu],
  ["technology", /\b(ai|artificial intelligence|semiconductor|chip|software|cyber|technology|nasdaq)\b/iu]
];

const MARKET_RELEVANCE = /\b(stock|market|s&p|nasdaq|dow|russell|investor|equity|option|volatility|fed|inflation|yield|earnings|oil|dollar|tariff|bank|economy|economic)\b/giu;
const PROMOTIONAL_FRAMING = /\b(should you buy|should.{0,60}\bportfolio|which.{0,60}\bstock|more upside|buy, hold or sell|could make you|make you rich|set you up for life|best stock|top stock to buy|one stock|1 stock)\b/iu;

export async function discoverMarketNews(options: NewsDiscoveryOptions): Promise<MarketNewsItem[]> {
  if (process.env.MARKET_NEWS_ENABLED?.toLowerCase() === "false") return [];
  const fetcher = options.fetcher ?? fetch;
  const symbols = [...new Set(options.symbols.map((symbol) => symbol.toUpperCase()).filter((symbol) => /^[A-Z.]{1,6}$/u.test(symbol)))];
  const queries = [...new Set(["SPY", "QQQ", "IWM", ...symbols.slice(0, 3)])];
  const responses = await Promise.all(queries.map(async (query) => {
    const url = new URL("https://query1.finance.yahoo.com/v1/finance/search");
    url.searchParams.set("q", query);
    url.searchParams.set("quotesCount", "0");
    url.searchParams.set("newsCount", "12");
    url.searchParams.set("enableFuzzyQuery", "false");
    try {
      const response = await fetcher(url, {
        headers: { "user-agent": "RFDELTA-Public-Market-Report/1.0" },
        signal: AbortSignal.timeout(8_000)
      });
      if (!response.ok) return [];
      const payload = await response.json() as { news?: RawNewsItem[] };
      return Array.isArray(payload.news) ? payload.news : [];
    } catch {
      return [];
    }
  }));
  const ranked = rankMarketNews(responses.flat(), {
    symbols,
    asOfUtc: options.asOfUtc,
    maxItems: options.maxItems ?? envInteger("MARKET_NEWS_MAX_ITEMS", 6, 1, 8)
  });
  console.log(`[market-news] queries=${queries.length} candidates=${responses.flat().length} selected=${ranked.length}`);
  return ranked;
}

export function rankMarketNews(
  records: RawNewsItem[],
  options: Pick<NewsDiscoveryOptions, "symbols" | "asOfUtc" | "maxItems">
): MarketNewsItem[] {
  const asOf = Date.parse(options.asOfUtc);
  const earliest = asOf - 72 * 60 * 60 * 1_000;
  const latest = asOf;
  const symbols = options.symbols.map((symbol) => symbol.toUpperCase());
  const deduped = new Map<string, MarketNewsItem & { score: number }>();

  for (const record of records) {
    if (record.type !== undefined && record.type !== "STORY") continue;
    if (typeof record.title !== "string" || typeof record.publisher !== "string" || typeof record.link !== "string") continue;
    if (typeof record.providerPublishTime !== "number" || !Number.isFinite(record.providerPublishTime)) continue;
    const headline = cleanText(record.title);
    const publisher = cleanText(record.publisher);
    const publisherScore = TRUSTED_PUBLISHERS.get(publisher.toLowerCase());
    const publishedMs = record.providerPublishTime * 1_000;
    if (!publisherScore || headline.length < 18 || headline.length > 220 || PROMOTIONAL_FRAMING.test(headline) || publishedMs < earliest || publishedMs > latest) continue;
    if (!isSafeHttpsUrl(record.link)) continue;
    const marketTerms = headline.match(MARKET_RELEVANCE)?.length ?? 0;
    const symbolMatches = symbols.filter((symbol) => new RegExp(`\\b${escapeRegex(symbol)}\\b`, "iu").test(headline)).length;
    if (marketTerms === 0 && symbolMatches === 0) continue;
    const topic = classifyTopic(headline);
    const hoursOld = Math.max(0, (asOf - publishedMs) / 3_600_000);
    const score = publisherScore * 10 + marketTerms * 40 + symbolMatches * 60 + Math.max(0, 72 - hoursOld);
    const item = {
      headline,
      publisher,
      url: record.link,
      publishedAtUtc: new Date(publishedMs).toISOString(),
      topic,
      score
    };
    const key = normalizeHeadline(headline);
    const previous = deduped.get(key);
    if (!previous || item.score > previous.score || (item.score === previous.score && item.url.localeCompare(previous.url) < 0)) {
      deduped.set(key, item);
    }
  }

  const ranked = [...deduped.values()].sort((a, b) =>
    b.score - a.score || b.publishedAtUtc.localeCompare(a.publishedAtUtc) || a.url.localeCompare(b.url)
  );
  const selected: MarketNewsItem[] = [];
  const publisherCounts = new Map<string, number>();
  const topicCounts = new Map<MarketNewsItem["topic"], number>();
  const limit = Math.max(1, Math.min(8, options.maxItems ?? 6));
  for (const candidate of ranked) {
    const item: MarketNewsItem = {
      headline: candidate.headline,
      publisher: candidate.publisher,
      url: candidate.url,
      publishedAtUtc: candidate.publishedAtUtc,
      topic: candidate.topic
    };
    const publisherCount = publisherCounts.get(item.publisher) ?? 0;
    const topicCount = topicCounts.get(item.topic) ?? 0;
    if (publisherCount >= 1 || topicCount >= 2) continue;
    selected.push(item);
    publisherCounts.set(item.publisher, publisherCount + 1);
    topicCounts.set(item.topic, topicCount + 1);
    if (selected.length === limit) break;
  }
  return selected;
}

function classifyTopic(headline: string): MarketNewsItem["topic"] {
  return TOPIC_PATTERNS.find(([, pattern]) => pattern.test(headline))?.[0] ?? "broad_market";
}

function isSafeHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function cleanText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function normalizeHeadline(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function envInteger(name: string, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.round(parsed))) : fallback;
}
