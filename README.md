# RicePattyJulls — Offensive Security Portfolio

Portfolio and knowledge base for RicePattyJulls' offensive security work, built with [Next.js](https://nextjs.org) (App Router) and deployed as a static site on GitHub Pages.

## Contents

- **Active Directory** — credential access, delegation, domain dominance and trust abuse techniques.
- **Azure / Entra ID** — Graph API abuse, managed identities, key vault, cross-tenant/B2B, hybrid AD paths, etc.
- **Attack Chains** — end-to-end attack chains.
- **Hacking Web** — web exploitation notes and techniques.
- **OSINT, Tools, Reports** — supporting resources and utilities.

Markdown content lives in `content/labs/<domain>/` and is rendered via `lib/labs.ts` plus the components in `components/labs/`.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- react-three-fiber / drei / three for the 3D background
- framer-motion / gsap for animations
- react-markdown + remark-gfm + rehype-slug/highlight for lab content
- Static export (`output: "export"`) deployed to GitHub Pages via `.github/workflows/deploy.yml`

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
```

Generates the static site in `./out` (the same artifact uploaded by the deploy workflow).

## Structure

```
app/            routes (App Router)
components/     UI, layout, canvas and section components
content/labs/   lab Markdown content
lib/            helpers (lab loading, motion, scroll, table of contents)
docs/           internal reference notes
```
