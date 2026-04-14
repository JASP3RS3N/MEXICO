# Development Plan — Factor·IA Dark Animated Landing Page (React + Tailwind + Framer Motion)

## 1) Objectives
- Deliver a dark, modern, animated **Spanish-first** landing page for **Factor·IA** centered on the core promise: **cumplimiento IATF 16949 + compliance + trazabilidad automática** para proveedores **Tier 2/Tier 3**.
- Ensure the message is unmistakable across hero + section headers: **“Tu cliente OEM te va a auditar. Con Factor·IA, ya cumples.”**
- Implement fluid, performant motion using **Framer Motion**:
  - Scroll reveal (fade-in + slide-up) in every section
  - Hero counters (CountUp)
  - Hover elevation + border/glow on cards
  - Subtle animated gradient/particles/noise in hero
  - Optional typing/reveal on a key phrase (motion-safe)
- Maintain strict content rules:
  - **Misión / Visión / Valores must be reproduced verbatim** (no edits).
  - Main content in Spanish; **International** section includes English copy.
  - **Contacto** uses **factor.iaops@gmail.com** across the site.
- Incorporate requirements confirmed from the reference artifact:
  - Add **Precios** section with **published prices** and included items.
  - Keep the **IAtipsMX canal 1** link visible and reachable from nav: `iatipsmx-canal1.html`.
- Keep a professional “piso de planta” tone: direct, industrial, compliance-first (not “IA genérica”).
- Mobile-first: everything must work perfectly on mobile, including sticky nav and animations.

## 2) Implementation Steps

### Phase 1 — Core Animation + Layout POC (Completed)
Goal: prove the animation system + structure before final polish.

**User stories (validated)**
1. As a visitor, I see a high-impact hero in <5 seconds.
2. As a visitor, scrolling reveals sections smoothly.
3. As a visitor, sticky nav jumps to sections.
4. As a mobile visitor, the page remains readable and fast.
5. As a visitor with reduced motion, animations degrade gracefully.

**Completed work (current state of repo)**
- Set up React + Tailwind + Framer Motion.
- Implemented reusable `ScrollReveal` wrapper.
- Built sticky `TopNav` (desktop + mobile).
- Built Hero with animated badge + scroll-reveal headline and **animated count-up counters** (via `CountUp`).
- Implemented required core sections and order (except pricing):
  - Problema, Garantías, Por qué, Misión/Visión/Valores (verbatim), Servicios (accordion), Contacto, Internacional, Footer.
- Confirmed basic functionality through frontend testing:
  - Responsive layout, anchors, mobile menu, scroll reveals.

### Phase 2 — V1 Completion (In Progress → Updated with final spec + pricing + nav)
Goal: ship the **complete** landing page matching the user’s spec, including **Precios** and **IAtipsMX canal 1 link**, plus UI polish.

**User stories**
1. As a Tier 2/Tier 3 leader, I immediately understand this is about **OEM audit readiness**: IATF 16949 + compliance + traceability.
2. As a visitor, I can scan guarantees/differentiators/services quickly (cards + accordion).
3. As a visitor, I can access contact/diagnóstico CTA from anywhere.
4. As a stakeholder, I see **published fixed monthly pricing** clearly.
5. As a visitor, I can access **IAtipsMX — Negocios Locales (canal 1)** from the sticky nav.

**Steps (revised to incorporate confirmed new info)**

1) **Navigation updates (TopNav)**
- Add anchor link to **#precios**.
- Add external link in nav:
  - Label: **“🏪 IAtipsMX — Negocios Locales”**
  - `href="iatipsmx-canal1.html"`
  - Ensure it is visible on desktop and accessible from the mobile menu.

2) **Add missing section: PRECIOS**
- Create `src/components/Precios.js`.
- Insert into the page flow (recommended: after `Servicios`, before `Contacto`) and add `id="precios"`.
- Use the **exact tiers + copy constraints** below (no rounding / no rewording of plan contents):
  - **Inicio — $85K MXN/mes** (5 servicios core)
    - Asistente Piso de Planta
    - Reportes Automáticos Calidad
    - Traductor Técnico EN↔ES
    - LPA Digitalizado con IA
    - Asistente Legal LFT
  - **Profesional — $185K MXN/mes** (11 servicios + 1 dashboard)
    - Todo de Inicio +
    - Motor de Análisis de RFQs
    - Monitor de Riesgo SC
    - Auditor de Inventario Inteligente
    - App Captura Calidad + Pareto
    - MRO + Entrenador Virtual
    - Dashboard Gerencia + Corte Financiero
  - **Enterprise — $320K MXN/mes** (16 servicios + 2 dashboards)
    - Todo de Profesional +
    - App 8D / 7-Step Kaizen
    - Generadores IA (Flujos, Puestos, SOPs)
    - Dashboard Director Multi-Planta
    - Control de Cambios (ECM)
    - Optimizador de Rutas RH
    - Soporte prioritario
  - **Total Plataforma — $450K+ MXN/mes** (20 servicios completos)
    - Todo incluido… (mantener el concepto “Todo incluido” + bullets claros)
- Apply the same interaction pattern as the rest of the site:
  - Scroll reveal on section header + each card
  - Hover elevation + glow + border intensification
  - Featured styling for “Profesional” (como “best value”)

3) **Hero modern UI polish (no content drift)**
- Keep hero headline/subtitle/badge/CTAs exactly aligned with the provided identity.
- Improve background feel:
  - Add subtle animated gradient movement (CSS background-position animation) and/or noise overlay.
  - Ensure no performance regressions and keep readability high.
- Add a short “typing/reveal” effect on a key phrase (e.g., “ya cumples”), with `prefers-reduced-motion` fallback.

4) **Servicios section robustness fix**
- Fix the reported minor issue: first accordion item occasionally not expanding on first click.
- Ensure deterministic open/close state (avoid `null` pitfalls, ensure correct keys, handle initial open state).
- Optional UX improvement: add “Expandir todo / Colapsar todo” for mobile if it doesn’t clutter.

5) **UI consistency pass (modernize glassmorphism)**
- Allowed minor palette modernization while preserving brand anchors:
  - Base background: `#080c14`
  - Primary accent: `#00e5a0`
  - Secondary: `#0ea5e9`
  - Text: `#e8edf2`, `#b8c5d3`
- Polish tokens/styles:
  - Harmonize border opacity, hover glow, shadow softness
  - Normalize card radii and padding across sections
  - Maintain “industrial dashboard” vibe (glass panels, subtle gradients, technical mono labels)

6) **QA + strict compliance checks**
- Verify **Misión/Visión/Valores** are verbatim (exact quotes).
- Verify every email is `factor.iaops@gmail.com`.
- Verify International section includes the English line exactly:
  - “You're global. Your plant in Mexico needs local AI.”
- Verify anchors and nav:
  - `#problema #garantias #porque #servicios #precios #contacto`
- Run a final responsive + animation pass:
  - Desktop/tablet/mobile
  - Reduced-motion
  - Ensure counters animate once, scroll reveals trigger once, no layout shift.

### Phase 3 — Enhancements / Production Hardening (Planned)
Goal: polish, maintainability, SEO, performance, and long-term editing.

**User stories**
1. As a visitor, the page loads fast on mobile.
2. As a visitor, social previews look correct.
3. As a stakeholder, editing pricing/services is easy and safe.
4. As an auditor-minded buyer, the site feels consistent and trustworthy.
5. As a visitor, the UI remains smooth (no jank) with animations.

**Steps**
- Refactor structured content into a config file (`content.js/ts`) for:
  - Problema cards, Garantías, Diferenciadores, Valores, Servicios categories, **Pricing plans**.
- SEO: OpenGraph/Twitter meta, favicon, title/description emphasizing IATF/compliance/traceability.
- Performance: ensure hero ambient effects are lightweight; audit blur usage; check bundle size.
- Accessibility: focus states, aria labels for mobile menu, semantic headings/lists.
- Final regression testing including:
  - Pricing correctness
  - IAtipsMX link correctness
  - Accordion reliability

### Phase 4 — Optional Add-ons (Only if requested)
- Contact form with validation + backend email relay.
- Analytics (Plausible/GA) with privacy-friendly defaults.
- Multilingual toggle (ES/EN) beyond the International section.

## 3) Next Actions
1. Implement `Precios.js` with the **exact** tiers and amounts:
   - Inicio $85K, Profesional $185K, Enterprise $320K, Total $450K+ (MXN/mes)
2. Add `#precios` to nav and add **IAtipsMX — Negocios Locales** link to `iatipsmx-canal1.html` in `TopNav` (desktop + mobile).
3. Fix Servicios accordion first-click inconsistency.
4. Apply final modern UI polish (glow, glass, hero ambient motion) without changing required text.
5. Run final QA sweep (responsive + reduced-motion + anchors + console).

## 4) Success Criteria
- The landing page follows the required section order and keeps the central IATF/compliance/traceability positioning.
- **Misión/Visión/Valores are reproduced exactly** (verbatim).
- Animations meet requirements: scroll reveal + hero counters + hover glow + subtle hero ambient motion; respects `prefers-reduced-motion`.
- **Pricing is present and matches the published tiers exactly**:
  - Inicio $85K, Profesional $185K, Enterprise $320K, Total $450K+ MXN/mes.
- Nav includes the **IAtipsMX canal 1** link and all anchors work on mobile.
- No console errors; mobile performance is strong; accessibility is solid.
