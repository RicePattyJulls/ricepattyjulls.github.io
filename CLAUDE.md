# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server at localhost:4321
npm run build      # Build to ./dist/
npm run preview    # Preview production build locally
```

Node >= 22.12.0 is required.

## Architecture

This is an **Astro 6** static site — a personal offensive security documentation portfolio for RicePattyJulls. It has no framework integrations (no React/Vue/Svelte); all components are `.astro` files.

### Content model

Content lives in `src/content/` and is defined via Astro Content Collections in `src/content.config.ts`. The collections are:

| Collection | Path | Purpose |
|---|---|---|
| `labs` | `src/content/labs/` | Lab writeups (gcb-lab, crto-lab) |
| `ad` | `src/content/ad/` | Active Directory technique notes |
| `azure` | `src/content/azure/` | Azure attack technique notes |
| `notes` | `src/content/notes/` | General notes |
| `posts` | `src/content/posts/` | Blog posts |

All collections share the same minimal frontmatter schema: `title`, `description`, `draft` (all optional).

The **GCB Lab** is the primary content and has a structured sub-hierarchy under `src/content/labs/gcb-lab/`:
- `hosts/` — per-host writeups (foothold, lateral movement steps, post-exploitation)
- `domains/` — per-domain documentation
- `paths/` — multi-hop attack path writeups
- `loot.md`, `deteccion-y-telemetria.md`, `mitigacion-y-remediacion.md` — cross-cutting docs

### Routing

Pages in `src/pages/` mirror the URL structure. Dynamic routes use `[slug].astro` with `getStaticPaths()` built via `import.meta.glob` — **not** via `getCollection()`. Example: `src/pages/labs/gcb-lab/hosts/[slug].astro` globs `src/content/labs/gcb-lab/hosts/*.md` directly and maps filename → slug.

### Layouts

| Layout | Use |
|---|---|
| `BaseLayout.astro` | Minimal HTML shell, imports `global.css`, accepts `title` prop |
| `Layout.astro` | (legacy/unused) |
| `ContentLayout.astro`, `LabLayout.astro`, `PostLayout.astro`, `WideLayout.astro` | Currently empty stubs |

In practice, most pages use `BaseLayout` directly with inline structure — the other layouts are not yet in use.

### Styling

All styles are in `src/assets/styles/global.css` (imported once in `BaseLayout`). There is no Tailwind or CSS framework. The design system uses CSS custom properties defined in `:root`:

- `--bg`, `--bg-soft` — page backgrounds
- `--panel`, `--panel-2` — card backgrounds
- `--accent`, `--accent-soft` — purple accent (`#8b7cff`)
- `--border`, `--border-strong` — border colors
- `--text`, `--muted`, `--muted-2` — text colors

Key utility classes: `.card`, `.card.link-card`, `.grid`, `.prose`, `.hero`, `.section-block`, `.back-link`, `.page-header`, `.eyebrow`.

The `.prose` class styles rendered Markdown content (headings, code blocks, tables, blockquotes).

### Trust map

`public/trust-maps/gcb-lab/trust-map.html` is a standalone HTML file (likely a BloodHound/draw.io export) embedded via `src/components/content/TrustMapEmbed.astro` in an iframe on the GCB Lab index page.

### Components

`src/components/` is split into three folders:
- `ui/` — generic primitives (`Card`, `Badge`, `Button`, `GlowPanel`, `SectionTitle`)
- `layout/` — structural pieces (`Navbar`, `Footer`, `PageHero`, `Sidebar`)
- `content/` — domain-specific (`LabCard`, `ProjectCard`, `TimelineItem`, `TrustMapEmbed`)

Most of these are stubs not yet used in pages — current pages build UI inline.
