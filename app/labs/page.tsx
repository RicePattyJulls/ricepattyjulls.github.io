import type { Metadata } from "next";
import SceneBackground from "@/components/canvas/SceneBackground";
import { PageBackdrop } from "@/components/layout/PageBackdrop";
import { Nav } from "@/components/layout/Nav";
import { TechniqueHub } from "@/components/labs/TechniqueHub";
import { Contact } from "@/components/sections/Contact";
import { labCases, labSections, groupCases } from "@/content/case-studies";

export const metadata: Metadata = { title: "Security Labs — RicePattyJulls", description: "Laboratorios de seguridad ofensiva: operaciones con Cobalt Strike y rutas de ataque en Active Directory, con evidencias, resultados y remediación." };
export default function Page() {
  return <><SceneBackground /><PageBackdrop /><Nav /><main className="relative z-10">
    <TechniqueHub basePath="/labs" kicker="Offensive Security" title="Security Labs"
      blurb="Laboratorios de seguridad ofensiva: operaciones con Cobalt Strike y rutas de ataque en Active Directory, con evidencias, resultados y remediación." accent="violet"
      itemLabel="Labs" sectionLabel="Specialties"
      sections={Object.entries(labSections).map(([key, s]) => ({ key, ...s }))}
      techniquesBySection={groupCases(labCases)} />
    <Contact /></main></>;
}
