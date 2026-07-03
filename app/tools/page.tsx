import type { Metadata } from "next";
import SceneBackground from "@/components/canvas/SceneBackground";
import { PageBackdrop } from "@/components/layout/PageBackdrop";
import { Nav } from "@/components/layout/Nav";
import { ToolsPage } from "@/components/sections/ToolsPage";
import { Contact } from "@/components/sections/Contact";
import { toolsMeta } from "@/content/tools";

export const metadata: Metadata = {
  title: "Tools — RicePattyJulls",
  description: toolsMeta.blurb,
};

export default function Page() {
  return (
    <>
      <SceneBackground />
      <PageBackdrop />
      <Nav />
      <main className="relative z-10">
        <ToolsPage />
        <Contact />
      </main>
    </>
  );
}
