import { notFound } from "next/navigation";
import { EMBED_SECTIONS, EmbedSection, type EmbedSectionName } from "@/components/EmbedSection";
import { getPresentationReport } from "@/lib/report/presentation";

export function generateStaticParams() {
  return EMBED_SECTIONS.map((section) => ({ section }));
}

export default async function EmbedPage({
  params,
  searchParams
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ frame?: string }>;
}) {
  const { section } = await params;
  if (!EMBED_SECTIONS.includes(section as EmbedSectionName)) notFound();
  const query = await searchParams;
  const frameId = query.frame?.replace(/[^a-zA-Z0-9_-]/gu, "").slice(0, 80) || `rfdelta-${section}`;
  return <EmbedSection report={await getPresentationReport()} section={section as EmbedSectionName} frameId={frameId} />;
}
