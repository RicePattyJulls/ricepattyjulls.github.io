"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/* WebGL is client-only and lazy — keeps it out of the server bundle and
   off the critical path. A CSS poster covers first paint + reduced-motion. */
const Scene = dynamic(() => import("./Scene"), { ssr: false });

function Poster() {
  return (
    <div className="scene-layer" aria-hidden>
      <div
        className="absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(124,92,255,0.14), rgba(59,130,246,0.06) 45%, transparent 70%)",
        }}
      />
    </div>
  );
}

export default function SceneBackground() {
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  if (reduced || !ready) return <Poster />;
  return <Scene />;
}
