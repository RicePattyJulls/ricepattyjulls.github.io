import type { Metadata } from "next";
import SceneBackground from "@/components/canvas/SceneBackground";
import { PageBackdrop } from "@/components/layout/PageBackdrop";
import { Nav } from "@/components/layout/Nav";
import { TechniqueHub } from "@/components/labs/TechniqueHub";
import { Contact } from "@/components/sections/Contact";
import { chainSections, chainsBySection } from "@/content/attack-chains";

export const metadata: Metadata = {
  title: "Attack Chains — RicePattyJulls",
  description:
    "Real, reported, and sanitized engagements chained from a black-box entry point to full tenant compromise.",
};

const sections = Object.entries(chainSections).map(([key, s]) => ({ key, ...s }));

export default function Page() {
  return (
    <>
      <SceneBackground />
      <PageBackdrop />
      <Nav />
      <main className="relative z-10">
        <TechniqueHub
          basePath="/attack-chains"
          kicker="Signature Engagement"
          title="Attack Chains"
          blurb="Black-box to full tenant compromise — real engagements, reported responsibly and sanitized for publication. No live secrets, no real domains: the logic, endpoints, and impact are faithful to what happened."
          accent="danger"
          sections={sections}
          techniquesBySection={chainsBySection}
        />
        <Contact />
      </main>
    </>
  );
}
