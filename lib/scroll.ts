"use client";

import { useEffect, useRef } from "react";

/* Shared, throttled scroll progress (0..1 of full page) via rAF.
   Used by the WebGL scene so it reacts to page position without
   re-rendering React on every scroll event. */
export function useScrollProgressRef() {
  const ref = useRef(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      ref.current = max > 0 ? window.scrollY / max : 0;
      frame = 0;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return ref;
}
