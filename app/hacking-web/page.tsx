import type { Metadata } from "next";
import SceneBackground from "@/components/canvas/SceneBackground";
import { PageBackdrop } from "@/components/layout/PageBackdrop";
import { Nav } from "@/components/layout/Nav";
import { TechniqueHub } from "@/components/labs/TechniqueHub";
import { Contact } from "@/components/sections/Contact";
import { webSections, webTechniquesBySection } from "@/content/hacking-web";

export const metadata: Metadata = {
  title: "Hacking Web — RicePattyJulls",
  description:
    "Real-time recon, business-logic account takeover, and infrastructure misconfiguration — where application logic and identity break under real conditions.",
};

const sections = Object.entries(webSections).map(([key, s]) => ({ key, ...s }));

export default function Page() {
  return (
    <>
      <SceneBackground />
      <PageBackdrop />
      <Nav />
      <main className="relative z-10">
        <TechniqueHub
          basePath="/hacking-web"
          kicker="Application Layer"
          title="Hacking Web"
          blurb="Where business logic meets identity — chaining recon, access-control, and infrastructure misconfiguration into real impact. Field writeups, not payload dumps."
          accent="cyan"
          sections={sections}
          techniquesBySection={webTechniquesBySection}
        />
        <Contact />
      </main>
    </>
  );
}
