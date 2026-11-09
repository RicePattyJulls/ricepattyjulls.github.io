import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LabOverview } from "@/components/labs/LabOverview";
import { labCases } from "@/content/case-studies";

export function generateStaticParams() { return labCases.map(c => ({ slug: c.slug })); }
export const dynamicParams = false;
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = labCases.find(c => c.slug === slug);
  return entry ? { title: `${entry.title} — RicePattyJulls`, description: entry.description } : {};
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = labCases.find(c => c.slug === slug);
  if (!entry) notFound();
  return <LabOverview entry={entry} />;
}
