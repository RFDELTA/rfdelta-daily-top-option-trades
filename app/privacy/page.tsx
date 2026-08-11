import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Privacy & advertising",
  description: "How RFDELTA Top Option Trades uses analytics, cookies and Google AdSense on public report pages.",
  alternates: { canonical: "/privacy" },
  robots: { index: false, follow: true }
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="legal-page">
        <div className="content-width legal-content">
          <p className="eyebrow">Publisher information</p>
          <h1>Privacy &amp; advertising</h1>
          <p className="legal-updated">Last updated August 11, 2026</p>

          <section>
            <h2>Public report analytics</h2>
            <p>
              RFDELTA uses Vercel Web Analytics to understand aggregate page usage and improve the publication. The site does
              not require an account to read public reports.
            </p>
          </section>

          <section>
            <h2>Google AdSense</h2>
            <p>
              Substantive public report editions may load Google AdSense Auto Ads. Google and its advertising partners may use
              cookies, device identifiers or similar technologies to serve, measure and limit advertising. Ads are excluded from
              this privacy page, API responses, embedded widgets, errors and unavailable-report states.
            </p>
            <p>
              Depending on a visitor&apos;s region and consent choices, Google may show personalized or non-personalized ads.
              Learn how Google uses information from publisher sites in
              {" "}<a href="https://policies.google.com/technologies/partner-sites">Google&apos;s partner-sites policy</a> and manage
              advertising preferences in <a href="https://myadcenter.google.com/">My Ad Center</a>.
            </p>
          </section>

          <section>
            <h2>Consent and browser controls</h2>
            <p>
              Where consent is required, Google&apos;s certified consent tooling may present privacy choices before personalized
              advertising is used. Visitors can also block or delete cookies through browser settings. Blocking advertising
              storage does not prevent access to RFDELTA&apos;s public reports.
            </p>
          </section>

          <section>
            <h2>Authorized seller record</h2>
            <p>
              The local <a href="/ads.txt">ads.txt mirror</a> identifies RFDELTA&apos;s authorized Google seller account. The
              authoritative estate-wide record remains <a href="https://rfdelta.com/ads.txt">rfdelta.com/ads.txt</a>.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
