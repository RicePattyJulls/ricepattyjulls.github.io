import type { Metadata } from "next";
import SceneBackground from "@/components/canvas/SceneBackground";
import { PageBackdrop } from "@/components/layout/PageBackdrop";
import { Nav } from "@/components/layout/Nav";
import { TechniqueHub } from "@/components/labs/TechniqueHub";
import { Contact } from "@/components/sections/Contact";
import { azureSections, azureTechniquesBySection } from "@/content/azure-entra";

export const metadata: Metadata = {
  title: "Azure / Entra ID — RicePattyJulls",
  description:
    "Token tradecraft, Microsoft Graph and ARM abuse, Key Vault, managed identities, hybrid attack paths, and cross-tenant pivoting across Entra ID and Azure.",
};

const sections = Object.entries(azureSections).map(([key, s]) => ({ key, ...s }));

export default function Page() {
  return (
    <>
      <SceneBackground />
      <PageBackdrop />
      <Nav />
      <main className="relative z-10">
        <TechniqueHub
          basePath="/azure-entra"
          kicker="Tenant Exposure"
          title="Azure / Entra ID"
          blurb="Cloud identity is the new perimeter. Token tradecraft, Microsoft Graph and ARM abuse, Key Vault and managed-identity paths, hybrid pivots, and cross-tenant reach across the tenant."
          accent="blue"
          sections={sections}
          techniquesBySection={azureTechniquesBySection}
        />
        <Contact />
      </main>
    </>
  );
}
