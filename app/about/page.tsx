import type { Metadata } from "next";
import SceneBackground from "@/components/canvas/SceneBackground";
import { PageBackdrop } from "@/components/layout/PageBackdrop";
import { Nav } from "@/components/layout/Nav";
import { AboutContent } from "@/components/sections/AboutContent";
import { Contact } from "@/components/sections/Contact";

export const metadata: Metadata = {
  title: "About — RicePattyJulls",
  description:
    "Red team operator and offensive security researcher — Active Directory, Entra ID / Azure, and web exploitation. CRTO, CRTM, and CARTE certified.",
};

export default function Page() {
  return (
    <>
      <SceneBackground />
      <PageBackdrop />
      <Nav />
      <main className="relative z-10">
        <AboutContent />
        <Contact />
      </main>
    </>
  );
}
