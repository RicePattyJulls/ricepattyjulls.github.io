import SceneBackground from "@/components/canvas/SceneBackground";
import { Nav } from "@/components/layout/Nav";
import { Hero } from "@/components/sections/Hero";
import { Methodology } from "@/components/sections/Methodology";
import { AttackChains } from "@/components/sections/AttackChains";
import { LabsResearch } from "@/components/sections/LabsResearch";
import { Contact } from "@/components/sections/Contact";

export default function Home() {
  return (
    <>
      <SceneBackground />
      <Nav />
      <main className="relative z-10">
        {/* Navigation hub: a fanned deck of the domain cards over a dimmed
            starfield. Hover brings a card to the front; click opens the domain. */}
        <Hero />
        {/* How I think */}
        <Methodology />
        {/* Flagship offering */}
        <AttackChains />
        <LabsResearch />
        {/* Engagement */}
        <Contact />
      </main>
    </>
  );
}
