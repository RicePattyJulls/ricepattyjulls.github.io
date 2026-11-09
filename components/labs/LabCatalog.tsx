import { documentsForLab, labGroups } from "@/content/lab-library";
import { LabExplorer } from "@/components/labs/LabExplorer";

export function LabCatalog({ slug, onlyGroup }: { slug: string; onlyGroup?: string }) {
  const documents = documentsForLab(slug).filter(d => !onlyGroup || d.group === onlyGroup)
    .map(({ title, description, href, group, page }) => ({ title, description, href, group, page }));
  const groups = labGroups.filter(g => documents.some(d => d.group === g.key));
  return <LabExplorer key={`${slug}/${onlyGroup ?? "all"}`} documents={documents} groups={[...groups]} />;
}
