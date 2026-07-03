import type { Metadata } from "next";
import SceneBackground from "@/components/canvas/SceneBackground";
import { PageBackdrop } from "@/components/layout/PageBackdrop";
import { Nav } from "@/components/layout/Nav";
import { TechniqueHub } from "@/components/labs/TechniqueHub";
import { Contact } from "@/components/sections/Contact";
import { adSections, adTechniquesBySection } from "@/content/active-directory";

export const metadata: Metadata = {
  title: "Active Directory — RicePattyJulls",
  description:
    "Credential access, Kerberos abuse, delegation, domain dominance, and trust exploitation across Active Directory.",
};

const sections = Object.entries(adSections).map(([key, s]) => ({ key, ...s }));

export default function Page() {
  return (
    <>
      <SceneBackground />
      <PageBackdrop />
      <Nav />
      <main className="relative z-10">
        <TechniqueHub
          basePath="/active-directory"
          kicker="Internal Domain"
          title="Active Directory"
          blurb="Credential access, Kerberos abuse, delegation attacks, domain dominance, and trust exploitation — the full internal kill chain from a foothold to forest control."
          accent="violet"
          sections={sections}
          techniquesBySection={adTechniquesBySection}
        />
        <Contact />
      </main>
    </>
  );
}
