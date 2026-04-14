# Development Plan — Factor·IA Dark Animated Landing Page (React + Tailwind + Framer Motion)

## 1) Objectives
- Deliver a dark-themed, highly animated, Spanish landing page for **Factor·IA** matching the provided structure/text (hero → sections → CTA → footer).
- Implement fluid, performant animations (entrances, scroll reveals, subtle ambient motion) with **Framer Motion**.
- Build a clean, componentized React codebase using **Tailwind CSS** (responsive, accessible, Lighthouse-friendly).
- Ship a V1 that is visually close to the reference, with smooth navigation and a working contact CTA.

## 2) Implementation Steps

### Phase 1 — Core Animation + Layout POC (isolation)
Goal: prove the “hard” part (animated hero + scroll reveal system) feels right before building every section.

**User stories**
1. As a visitor, I see an immediate animated hero message that explains the value prop in <5 seconds.
2. As a visitor, scrolling reveals sections smoothly without jank.
3. As a visitor, I can use the sticky nav to jump to sections reliably.
4. As a visitor on mobile, animations remain smooth and do not block reading.
5. As a visitor with reduced-motion enabled, animations are toned down.

**Steps**
- Initialize frontend stack: React + Tailwind + Framer Motion; define design tokens (colors, gradients, typography).
- Build a **POC page** with:
  - Sticky top nav (anchor links + active section highlight optional).
  - Hero section with layered background (radial gradients / noise) + headline animation.
  - 2–3 placeholder sections using a reusable `ScrollReveal` wrapper.
- Add a global animation system:
  - `prefers-reduced-motion` handling.
  - Shared motion variants (fade/slide/stagger) + viewport triggers.
- Performance pass: avoid heavy filters, keep transforms GPU-friendly, verify 60fps on typical laptop.
- POC acceptance check: scroll + hero animations feel “premium” and consistent.

### Phase 2 — V1 App Development (full landing page)
Goal: build the complete landing page with final copy/structure, responsive styling, and working CTAs.

**User stories**
1. As a visitor, I can quickly understand what Factor·IA is and what problems it solves.
2. As a visitor, I can scan services/capabilities in well-structured sections.
3. As a visitor, I can navigate to “Contacto/Demo” from anywhere.
4. As a mobile visitor, the layout is readable and navigation is usable.
5. As a visitor, I can trust the offer due to clear “privacy/on-prem” messaging and credibility cues.

**Steps**
- Create page component structure (single-page app):
  - `TopNav` (desktop + mobile drawer)
  - `Hero`
  - `Proof/Numbers` (if in source)
  - `Services` (cards grid)
  - `HowItWorks / Interface` section
  - `UseCases` / `Industries`
  - `Pricing/Packages` (if specified)
  - `FAQ`
  - `FinalCTA`
  - `Footer`
- Implement consistent section scaffolding:
  - `SectionHeader` (label/title/desc)
  - `Card` primitives (hover glow, border transitions)
- Animations:
  - Stagger card entrances per section.
  - Hover micro-interactions (tilt/glow) with motion-safe constraints.
  - Scroll progress accents where beneficial (subtle, not distracting).
- Content wiring:
  - Ensure **exact Spanish text** per the provided structure.
  - Add mailto/WhatsApp link (or contact form if requested) for CTA.
- Accessibility:
  - Keyboard navigable nav + focus states.
  - Semantic headings, aria labels for menu.
- End of Phase 2: run 1 full pass of end-to-end UI testing (desktop + mobile) to confirm navigation, responsiveness, and no broken animations.

### Phase 3 — Enhancements / Production Hardening
Goal: polish, reliability, and maintainability (without overbuilding).

**User stories**
1. As a visitor, I experience fast load times even on mobile data.
2. As a visitor, I can share the page and previews look good on social.
3. As a visitor, I can print/save key info without broken layout.
4. As a stakeholder, I can update service cards and sections from a single config file.
5. As a visitor, I never see layout shifts while fonts load.

**Steps**
- Refactor content into a `content.ts` config (arrays for cards/FAQ) to reduce duplication.
- Add SEO basics: OpenGraph/Twitter meta, favicon, correct titles/descriptions.
- Optimize assets: font loading strategy, optional local fonts, reduce CSS/JS where possible.
- Add `ErrorBoundary` + safe guards for motion viewport triggers.
- Visual QA: cross-browser (Chrome/Safari/Firefox), reduced-motion, small screens.
- End of Phase 3: run another end-to-end testing round focusing on regressions, performance, and accessibility.

### Phase 4 — Optional Add-ons (only if requested)
- Contact form with validation + backend email relay (adds integration complexity).
- Analytics (Plausible/GA) with consent-friendly setup.
- Multi-language toggle (ES/EN) if needed.

## 3) Next Actions
- Confirm: Do you want **pure landing (no backend)** with `mailto:`/WhatsApp CTA, or a **contact form** submission endpoint?
- Confirm: Should the build match the provided HTML artifact 1:1, or can we simplify while keeping the same look/feel?
- Proceed with Phase 1 POC: implement hero + scroll reveal + sticky nav and validate animation quality.

## 4) Success Criteria
- The landing page matches the intended dark aesthetic and section structure, with accurate Spanish copy.
- Animations are smooth (no jank), consistent, and respect `prefers-reduced-motion`.
- Fully responsive: mobile/tablet/desktop layouts are readable and usable.
- CTAs work (navigate to contact target) and nav anchors scroll to correct sections.
- No console errors; basic Lighthouse checks pass (good accessibility + no major performance red flags).
