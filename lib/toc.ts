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
  let fence: string | null = null;
  for (const line of md.split("\n")) {
    const marker = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (marker) {
      if (!fence) fence = marker[1][0];
      else if (fence === marker[1][0] && !marker[2].trim()) fence = null;
      continue;
    }
    if (fence) continue;
    const m = /^##\s+(?!#)(.+?)\s*$/.exec(line);
    if (m) {
      const text = m[1].replace(/`/g, "").trim();
      items.push({ text, id: slugifyHeading(text) });
    }
  }
  return items;
}
