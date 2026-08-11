export const SITE_NAME = "RFDELTA Top Option Trades";
export const SITE_ORIGIN = "https://www.trade.rfdelta.com";
export const SITE_DESCRIPTION =
  "Daily defined-risk option spread rankings, market commentary, payoff analysis and prior-basket accountability.";

export const ADSENSE_CLIENT = "ca-pub-2668057120623042";
export const ADSENSE_ACCOUNT_META_NAME = "google-adsense-account";
export const ADSENSE_SCRIPT_URL =
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

export function absoluteSiteUrl(pathname: string) {
  return new URL(pathname, SITE_ORIGIN).toString();
}

export function reportPath(date: string) {
  return `/reports/${date}`;
}
