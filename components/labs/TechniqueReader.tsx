"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy, List } from "lucide-react";
import { extractToc, slugifyHeading, type TocItem } from "@/lib/toc";

/* flatten React children (may include inline <code>) to a plain string */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in node)
    return textOf((node as { props: { children?: ReactNode } }).props.children);
  return "";
}

function CopyPre({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  // language label from the inner <code class="language-xxx">
  const lang = useMemo(() => {
    const child = Array.isArray(children) ? children[0] : children;
    const cls =
      (child as { props?: { className?: string } } | undefined)?.props
        ?.className ?? "";
    const m = /language-(\w+)/.exec(cls);
    return m ? m[1] : "";
  }, [children]);

  const copy = async () => {
    const text = ref.current?.innerText ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  return (
    <div className="code-block group/code">
      <div className="code-bar">
        <span className="code-lang">{lang || "shell"}</span>
        <button type="button" onClick={copy} className="code-copy" aria-label="Copy code">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre ref={ref}>{children}</pre>
    </div>
  );
}

function TableOfContents({ toc, activeId }: { toc: TocItem[]; activeId: string }) {
  if (toc.length < 2) return null;
  return (
    <nav className="sticky top-28 hidden max-h-[calc(100vh-9rem)] w-56 shrink-0 overflow-auto xl:block">
      <div className="font-mono mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-text-mute">
        <List size={12} /> On this page
      </div>
      <ul className="space-y-1 border-l border-[color:var(--border)]">
        {toc.map((t) => (
          <li key={t.id}>
            <a
              href={`#${t.id}`}
              className={`-ml-px block border-l-2 py-1 pl-3 text-[12.5px] leading-snug transition-colors ${
                activeId === t.id
                  ? "border-[color:var(--violet)] text-white"
                  : "border-transparent text-text-mute hover:text-text-dim"
              }`}
            >
              {t.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function TechniqueReader({ markdown }: { markdown: string }) {
  const toc = useMemo(() => extractToc(markdown), [markdown]);
  const [activeId, setActiveId] = useState("");
  const articleRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: articleRef,
    offset: ["start 0.15", "end 0.9"],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  // scroll-spy across the ## headings
  useEffect(() => {
    const els = toc
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [toc]);

  return (
    <>
      {/* reading progress */}
      <motion.div
        aria-hidden
        className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left"
        style={{
          scaleX: progress,
          background: "linear-gradient(90deg, var(--violet), var(--blue))",
        }}
      />

      <div className="flex gap-10">
        <motion.article
          ref={articleRef}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="lab-prose min-w-0 flex-1"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
            components={{
              h2: ({ children }) => (
                <h2 id={slugifyHeading(textOf(children))}>{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 id={slugifyHeading(textOf(children))}>{children}</h3>
              ),
              pre: ({ children }) => <CopyPre>{children}</CopyPre>,
            }}
          >
            {markdown}
          </ReactMarkdown>
        </motion.article>

        <TableOfContents toc={toc} activeId={activeId} />
      </div>
    </>
  );
}
