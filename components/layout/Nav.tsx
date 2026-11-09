"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X, Terminal } from "lucide-react";
import { nav } from "@/content/site";
import { accentColor } from "@/components/ui/primitives";

function isActive(pathname: string, item: (typeof nav)[number]) {
  if (item.href === "/") return pathname === "/";
  const m = item.match ?? item.href;
  return pathname === m || pathname.startsWith(m + "/");
}

export function Nav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // close the mobile menu on route change
  useEffect(() => setOpen(false), [pathname]);

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <nav
        className={`panel flex w-full max-w-7xl items-center justify-between rounded-2xl border py-2.5 pl-4 pr-3 transition-all duration-300 ${
          scrolled
            ? "border-[color:var(--border-strong)] shadow-[0_10px_40px_-20px_rgba(124,92,255,0.5)]"
            : "border-[color:var(--border)]"
        }`}
      >
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span
            className="grid h-8 w-8 place-items-center rounded-lg"
            style={{
              background: "linear-gradient(135deg, var(--violet), var(--blue))",
              boxShadow: "0 0 20px -4px rgba(124,92,255,0.8)",
            }}
          >
            <Terminal size={16} strokeWidth={2.4} color="#fff" />
          </span>
          <span className="font-display text-sm font-semibold tracking-tight">
            RicePattyJulls
          </span>
        </Link>

        {/* desktop links */}
        <div className="hidden items-center gap-0.5 xl:flex">
          {nav.map((item) => {
            const active = isActive(pathname, item);
            const color = item.accent ? accentColor[item.accent] : "var(--violet)";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative rounded-lg px-2 py-1.5 font-mono text-[11px] tracking-wide transition-colors ${
                  active ? "text-white" : "text-text-dim hover:text-white"
                }`}
              >
                {item.label}
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full"
                    style={{ background: color, boxShadow: `0 0 10px ${color}` }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/#contact"
            className="hidden rounded-full px-4 py-2 text-[13px] font-medium text-white sm:inline-flex"
            style={{
              background: "linear-gradient(135deg, var(--violet), var(--blue))",
              boxShadow: "0 8px 30px -12px rgba(124,92,255,0.8)",
            }}
          >
            Engage
          </Link>
          <button
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--border-strong)] text-text-dim xl:hidden"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-navigation"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="panel absolute inset-x-4 top-20 z-40 flex max-h-[calc(100dvh-6rem)] flex-col gap-1 overflow-y-auto p-3 xl:hidden"
          >
            {nav.map((item) => {
              const active = isActive(pathname, item);
              const color = item.accent ? accentColor[item.accent] : "var(--violet)";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-mono text-sm transition-colors ${
                    active ? "bg-white/[0.04] text-white" : "text-text-dim hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: item.accent ? color : "var(--text-mute)",
                      boxShadow: active && item.accent ? `0 0 8px ${color}` : "none",
                    }}
                  />
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/#contact"
              className="mt-1 rounded-lg px-3 py-2.5 text-center text-sm font-medium text-white"
              style={{ background: "linear-gradient(135deg, var(--violet), var(--blue))" }}
            >
              Engage
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
