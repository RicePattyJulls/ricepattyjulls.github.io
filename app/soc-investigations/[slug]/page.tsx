import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseStudyPage } from "@/components/labs/CaseStudyPage";
import { socCases } from "@/content/case-studies";

export function generateStaticParams() { return socCases.map(c => ({ slug: c.slug })); }
export const dynamicParams = false;
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = socCases.find(c => c.slug === slug);
  return entry ? { title: `${entry.title} — RicePattyJulls`, description: entry.description } : {};
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = socCases.find(c => c.slug === slug);
  if (!entry) notFound();
  return <CaseStudyPage entry={entry} entries={socCases} basePath="/soc-investigations" domain="soc-investigations"
    hubTitle="SOC Investigations" />;
}
