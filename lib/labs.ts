import fs from "node:fs";
import path from "node:path";

/* Server-only content loader for the ported technique knowledge base.
   Markdown lives under content/labs/<domain>/<slug>.md (migrated verbatim
   from the previous Astro site — text/code/tables are unchanged). */

const LABS_ROOT = path.join(process.cwd(), "content", "labs");

/* The source used GFM task-list bullets ("- [ ] OPSEC") as pseudo-headings.
   Promote them to real h4 subheadings so they style and outline correctly,
   and drop any leading frontmatter block. */
function preprocess(md: string): string {
  let out = md;
  if (out.startsWith("---")) {
    const end = out.indexOf("\n---", 3);
    if (end !== -1) out = out.slice(out.indexOf("\n---", 3) + 4);
  }
  out = out.replace(/^\s*-\s*\[[ xX]\]\s+(.+)$/gm, "\n#### $1\n");
  return out.trimStart();
}

export function getTechniqueMarkdown(domain: string, slug: string): string {
  const file = path.join(LABS_ROOT, domain, `${slug}.md`);
  return preprocess(fs.readFileSync(file, "utf8"));
}
