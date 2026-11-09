"use client";

import Link from "next/link";
import { useRef, type ComponentProps, type CSSProperties, type PointerEvent } from "react";

type Props = ComponentProps<typeof Link> & { accent?: string };

/** Native link semantics, with pointer feedback that never causes React renders. */
export function DepthCard({ children, className = "", accent = "#a78bfa", style, ...props }: Props) {
  const rect = useRef<DOMRect | null>(null);
  const reset = (event: PointerEvent<HTMLAnchorElement>) => {
    rect.current = null;
    event.currentTarget.style.setProperty("--card-rx", "0deg");
    event.currentTarget.style.setProperty("--card-ry", "0deg");
    event.currentTarget.style.setProperty("--card-x", "50%");
    event.currentTarget.style.setProperty("--card-y", "25%");
  };
  const move = (event: PointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = rect.current ?? event.currentTarget.getBoundingClientRect();
    rect.current = box;
    const x = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    const y = Math.max(0, Math.min(1, (event.clientY - box.top) / box.height));
    const card = event.currentTarget;
    card.style.setProperty("--card-x", `${x * 100}%`);
    card.style.setProperty("--card-y", `${y * 100}%`);
    card.style.setProperty("--card-rx", `${(0.5 - y) * 5}deg`);
    card.style.setProperty("--card-ry", `${(x - 0.5) * 6}deg`);
  };
  return <Link {...props}
    className={`depth-card group ${className}`}
    style={{ "--card-accent": accent, ...style } as CSSProperties}
    onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset}>
    <div className="depth-card__content">{children}</div>
  </Link>;
}
