import assert from "node:assert/strict";
import { rankMarketNews, type RawNewsItem } from "../lib/market/news";

const asOfUtc = "2026-07-13T16:00:00.000Z";
const records: RawNewsItem[] = [
  {
    title: "Fed rate path and Treasury yields reset the stock market debate",
    publisher: "Reuters",
    link: "https://example.com/reuters-fed-market",
    providerPublishTime: Date.parse("2026-07-13T15:20:00.000Z") / 1_000,
    type: "STORY"
  },
  {
    title: "Nasdaq chip leadership puts QQQ volatility back in focus",
    publisher: "Yahoo Finance",
    link: "https://example.com/yahoo-qqq-volatility",
    providerPublishTime: Date.parse("2026-07-13T14:45:00.000Z") / 1_000,
    type: "STORY"
  },
  {
    title: "Fed rate path and Treasury yields reset the stock market debate",
    publisher: "Yahoo Finance",
    link: "https://example.com/duplicate-fed-market",
    providerPublishTime: Date.parse("2026-07-13T15:25:00.000Z") / 1_000,
    type: "STORY"
  },
  {
    title: "This stock could make you rich overnight",
    publisher: "Motley Fool",
    link: "https://example.com/unranked-source",
    providerPublishTime: Date.parse("2026-07-13T15:50:00.000Z") / 1_000,
    type: "STORY"
  },
  {
    title: "Should QQQ shares be in your portfolio ahead of earnings?",
    publisher: "Zacks",
    link: "https://example.com/promotional-portfolio",
    providerPublishTime: Date.parse("2026-07-13T15:40:00.000Z") / 1_000,
    type: "STORY"
  },
  {
    title: "Future stock market headline must not enter an as-of report",
    publisher: "Reuters",
    link: "https://example.com/future-market",
    providerPublishTime: Date.parse("2026-07-13T17:00:00.000Z") / 1_000,
    type: "STORY"
  }
];

const ranked = rankMarketNews(records, { symbols: ["QQQ"], asOfUtc, maxItems: 6 });
assert.equal(ranked.length, 2);
assert.equal(ranked[0]?.publisher, "Reuters");
assert.equal(ranked[0]?.topic, "rates");
assert.equal(ranked[1]?.topic, "technology");
assert.ok(ranked.every((item) => item.url.startsWith("https://")));
assert.ok(ranked.every((item) => item.publishedAtUtc <= asOfUtc));
console.log(`[test:market-news] selected=${ranked.length} topics=${ranked.map((item) => item.topic).join(",")}`);
