import type { Metadata } from "next";
import SceneBackground from "@/components/canvas/SceneBackground";
import { PageBackdrop } from "@/components/layout/PageBackdrop";
import { Nav } from "@/components/layout/Nav";
import { TechniqueHub } from "@/components/labs/TechniqueHub";
import { Contact } from "@/components/sections/Contact";
import { socCases, socSections, groupCases } from "@/content/case-studies";

export const metadata: Metadata = { title: "SOC Investigations — RicePattyJulls", description: "Dos investigaciones CDSA con Elastic y Splunk. Consultas, cronología y valoración de evidencias, sin flags ni respuestas de evaluación." };
export default function Page() {
  return <><SceneBackground /><PageBackdrop /><Nav /><main className="relative z-10">
    <TechniqueHub basePath="/soc-investigations" kicker="Detection & Investigation" title="SOC Investigations"
      blurb="Dos investigaciones CDSA con Elastic y Splunk. Consultas, cronología y valoración de evidencias, sin flags ni respuestas de evaluación." accent="cyan"
      itemLabel="Investigations" sectionLabel="Platforms"
      sections={Object.entries(socSections).map(([key, s]) => ({ key, ...s }))}
      techniquesBySection={groupCases(socCases)} />
    <Contact /></main></>;
}
