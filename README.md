# RicePattyJulls — Offensive Security Portfolio

Portfolio y base de conocimiento de seguridad ofensiva de RicePattyJulls, construido con [Next.js](https://nextjs.org) (App Router) y desplegado como sitio estático en GitHub Pages.

## Contenido

- **Active Directory** — técnicas de credential access, delegation, domain dominance y trusts.
- **Azure / Entra ID** — abuso de Graph API, managed identities, key vault, cross-tenant/B2B, hybrid AD paths, etc.
- **Attack Chains** — cadenas de ataque end-to-end.
- **Hacking Web** — notas y técnicas de explotación web.
- **OSINT, Tools, Reports** — recursos y utilidades complementarias.

El contenido en Markdown vive en `content/labs/<dominio>/` y se renderiza mediante `lib/labs.ts` mas los componentes en `components/labs/`.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- react-three-fiber / drei / three para el fondo 3D
- framer-motion / gsap para animaciones
- react-markdown + remark-gfm + rehype-slug/highlight para el contenido de los labs
- Export estático (`output: "export"`) desplegado a GitHub Pages vía `.github/workflows/deploy.yml`

## Desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
```

Genera el sitio estático en `./out` (el mismo artefacto que sube el workflow de deploy).

## Estructura

```
app/            rutas (App Router)
components/     componentes de UI, layout, canvas y secciones
content/labs/   contenido Markdown de los labs
lib/            helpers (carga de labs, motion, scroll, tabla de contenidos)
docs/           notas internas de referencia
```
