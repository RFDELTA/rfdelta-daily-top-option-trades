import type { Metadata } from "next";
import { isSubstantialPublicReport } from "@/lib/monetization";
import type { OptionsReport } from "@/lib/report/types";
import {
  absoluteSiteUrl,
  ADSENSE_ACCOUNT_META_NAME,
  ADSENSE_CLIENT,
  reportPath,
  SITE_NAME
} from "@/lib/site";

export function buildReportMetadata(report: OptionsReport): Metadata {
  const canonicalPath = reportPath(report.runMetadata.reportDate);
  const title = `Top Option Trades — ${formatReportDate(report.runMetadata.reportDate)}`;
  const description = compactDescription(report.executiveSummary.standfirst);
  const monetizable = isSubstantialPublicReport(report);

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    authors: [{ name: "RFDELTA LLC", url: "https://rfdelta.com" }],
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1
      }
    },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title,
      description,
      url: canonicalPath,
      publishedTime: report.runMetadata.generatedAtUtc,
      modifiedTime: report.runMetadata.generatedAtUtc,
      authors: ["RFDELTA LLC"]
    },
    twitter: {
      card: "summary",
      title,
      description
    },
    ...(monetizable
      ? { other: { [ADSENSE_ACCOUNT_META_NAME]: ADSENSE_CLIENT } }
      : {})
  };
}

export function buildReportStructuredData(report: OptionsReport) {
  const canonicalUrl = absoluteSiteUrl(reportPath(report.runMetadata.reportDate));
  const description = compactDescription(report.executiveSummary.standfirst);
  const symbols = [...new Set(report.topTrades.map((trade) => trade.symbol))];
  const citations = [...new Set(report.marketRead?.newsRadar.map((item) => item.url) ?? [])];

  return {
    "@context": "https://schema.org",
    "@type": ["Article", "Report"],
    "@id": `${canonicalUrl}#report`,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl
    },
    url: canonicalUrl,
    headline: report.executiveSummary.headline,
    name: `RFDELTA Top Option Trades — ${formatReportDate(report.runMetadata.reportDate)}`,
    description,
    datePublished: report.runMetadata.generatedAtUtc,
    dateModified: report.runMetadata.generatedAtUtc,
    isAccessibleForFree: true,
    inLanguage: "en-US",
    articleSection: "Market intelligence",
    keywords: ["defined-risk options", "market intelligence", "option spreads", ...symbols].join(", "),
    author: {
      "@type": "Organization",
      name: "RFDELTA LLC",
      url: "https://rfdelta.com"
    },
    publisher: {
      "@type": "Organization",
      name: "RFDELTA LLC",
      url: "https://rfdelta.com"
    },
    about: symbols.length
      ? symbols.map((symbol) => ({ "@type": "Thing", name: `${symbol} options` }))
      : [{ "@type": "Thing", name: "Defined-risk option market screening" }],
    ...(citations.length ? { citation: citations } : {}),
    potentialAction: {
      "@type": "ReadAction",
      target: canonicalUrl
    }
  };
}

export function unavailableReportMetadata(): Metadata {
  return {
    title: "Report not found",
    description: "The requested RFDELTA Top Option Trades report is not available.",
    robots: { index: false, follow: false }
  };
}

function compactDescription(value: string, maxLength = 180) {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).replace(/\s+\S*$/u, "")}…`;
}

function formatReportDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
}
