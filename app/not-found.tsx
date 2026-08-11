import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false }
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="legal-page">
        <div className="content-width legal-content">
          <p className="eyebrow">404</p>
          <h1>Report not found</h1>
          <p>The requested report is not in the public archive.</p>
          <p><a href="/archive">Browse published editions</a></p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
