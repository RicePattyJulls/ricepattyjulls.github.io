/* Pure heading helpers — safe to import from client components
   (no node:fs, unlike lib/labs.ts). */

export type TocItem = { text: string; id: string };

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/* Outline from the top-level (##) headings, in document order. */
export function extractToc(md: string): TocItem[] {
  const items: TocItem[] = [];
  for (const line of md.split("\n")) {
    const m = /^##\s+(?!#)(.+?)\s*$/.exec(line);
    if (m) {
      const text = m[1].replace(/`/g, "").trim();
      items.push({ text, id: slugifyHeading(text) });
    }
  }
  return items;
}
