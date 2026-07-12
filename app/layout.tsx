import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RFDELTA Top Option Trades",
    template: "%s | RFDELTA"
  },
  description: "Daily defined-risk option spread rankings, market commentary, payoff analysis and prior-basket accountability.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://rfdelta-daily-top-option-trades.vercel.app"),
  openGraph: {
    title: "RFDELTA Top Option Trades",
    description: "Daily defined-risk option spread rankings and accountability.",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
