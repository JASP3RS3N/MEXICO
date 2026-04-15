# plan.md (actualizado)

## 1) Objectives
- Entregar una **landing one-page premium** para **IAtipsMX / ConsultorIA Services (by Factor·IA)** basada en los TXT provistos y inputs finales del usuario.
- Lograr **alto impacto visual**: parallax suave, partículas/grids y gradientes radiales sutiles, glassmorphism controlado, glow en bordes y estética “dashboard industrial”.
- UX clara con **selector interactivo de sector** (consultorios, restaurantes, construcción, oficios, servicios generales) que **despliega contenido dinámico**.
- CTAs funcionales: **botón WhatsApp** (wa.me) + **formulario** que guarda leads en **FastAPI + MongoDB**.
- Tipografía aplicada: **serif** (títulos), **sans** (cuerpo), **monospace** (labels/datos técnicos).
- **Mobile-first**: todo usable y legible en móvil con animaciones que respetan `prefers-reduced-motion`.
- POC: **No requerido** (se implementó directamente V1 porque no hay integraciones externas complejas).

**Estado actual:** Objetivos cumplidos (V1 listo).

---

## 2) Implementation Steps

### Phase 2 — V1 App Development (core build directo, sin POC) ✅ COMPLETADO
**User stories (V1) — cubiertas**
1. Hero con promesa clara + **métricas con contadores animados**.
2. Selector de sector para ver **soluciones y módulos** sin salir de la página.
3. CTA WhatsApp de 1 tap desde hero/contacto y **botón flotante**.
4. Formulario corto con confirmación inmediata.
5. Leads guardados en MongoDB para seguimiento.

**Frontend (React) — implementado**
- Landing one-page con secciones completas:
  - **Sticky Nav** con anchors + CTA “Consulta gratis” + botón “Volver a Factor·IA”.
  - **Hero**: copy oficial, CTAs, **typing/reveal**, contadores, grid/partículas sutiles y micro-parallax.
  - **Problema / Pain Points**: cards con hover lift + glow.
  - **Sectores (selector interactivo 5)**: panel dinámico con problemas/solución/módulos y transición animada.
  - **Servicios (6 módulos)**: grid con hover effects.
  - **Proceso (4 pasos)**: cards animadas.
  - **Precios (3 planes)**: cards con “Más elegido” y CTA WhatsApp por plan.
  - **Testimonios (3)**: carrusel/grid responsive.
  - **Cobertura**: ubicaciones + visual estilo mapa.
  - **Contacto**: WhatsApp + correo + redes + **formulario funcional**.
  - **Footer**: resumen, enlaces, redes y regreso a Factor·IA.
- Identidad y enlaces reales integrados:
  - WhatsApp: **+52 844 881 7425**
  - Email: **factor.iaops@gmail.com**
  - Instagram: https://www.instagram.com/iatipsmx/
  - TikTok: https://www.tiktok.com/@iatipsmx
  - YouTube: https://www.youtube.com/@IAtipsMX
  - Factor·IA: https://www.factorai.mx
- Estilo visual aplicado según guías: fondo industrial dark, glass cards, glow sutil, sin gradients invasivos.
- Animaciones obligatorias: **scroll reveal**, contadores, hover glow/lift, hero partículas/grids, smooth transitions, typing/reveal.

**Backend (FastAPI + MongoDB) — implementado**
- `GET /api/health` ✅
- `POST /api/leads` ✅ (validación Pydantic, guarda en MongoDB con `createdAt`)
- `GET /api/leads?limit=` ✅ (lista últimos leads)
- Índices MongoDB: `createdAt`, `sector` ✅
- Serialización robusta de fechas/ids ✅

**Fix incluido post-testing**
- Menú móvil: se volvió **controlado** y ahora **cierra antes de navegar** (mejora UX mobile) ✅

**V1 Testing & Validation** ✅ COMPLETADO
- testing_agent iteration_1: 1 issue **LOW** (overlay menú móvil) → corregido.
- testing_agent iteration_2: **verificación completa**
  - Frontend 100%, Mobile 100%, Integración 100%
  - Sin bugs de UI/integración/diseño pendientes.
- Nota restante (informativa): sector inválido devuelve **422** (Pydantic) en lugar de 400; **sin impacto funcional**.

---

### Phase 3 — Hardening, polish & performance (opcional / bajo solicitud)
**User stories (polish)**
1. Mejorar rendimiento percibido en móvil (optimizar animaciones y repaints).
2. Accesibilidad: focus states audit, contraste, navegación teclado.
3. Antispam en formulario (honeypot + rate limit) si se requiere.
4. Export/consulta de leads para operación comercial.
5. SEO básico y OpenGraph.

**Posibles mejoras**
- Performance:
  - Optimizar partículas (densidad y CPU), lazy-load de secciones pesadas.
  - Asegurar `prefers-reduced-motion` en todas las animaciones.
- UX:
  - Confirmación post-submit con fallback `mailto:`.
  - Ajustes de microcopy según conversion rate.
- Backend:
  - Endpoint opcional `GET /api/leads.csv` o paginación.
  - Rate-limit/honeypot.
- SEO:
  - Meta title/description, OG tags, schema (LocalBusiness) si aplica.

**Testing**
- Ronda adicional e2e enfocada en performance móvil + accesibilidad.

---

### Phase 4 — Optional enhancements (solo si el usuario aprueba)
**Ideas**
1. FAQ para objeciones comunes.
2. Integración de agenda (Calendly/Google Calendar).
3. Notificación de lead (email/Slack).
4. Variantes A/B del hero.
5. Mini-panel interno para ver leads (requiere auth).

**Nota:** Auth, notificaciones externas o integraciones de calendario pueden requerir mini-POC.

---

## 3) Next Actions
- ✅ Entrega V1 lista (Phase 2 completada).
- (Opcional) Definir si se necesita:
  - exportación de leads,
  - notificaciones al recibir lead,
  - FAQ,
  - ajuste fino de copy o SEO.

---

## 4) Success Criteria
- ✅ One-page responsive con todas las secciones y copy requerido.
- ✅ Animaciones obligatorias implementadas (reveal, counters, hover glow/lift, hero partículas/grids, typing/reveal).
- ✅ Selector de sectores funcional (5 sectores + panel dinámico).
- ✅ Botón WhatsApp funcional (wa.me) + redes sociales abren links reales + botón regreso a Factor·IA.
- ✅ Formulario funcional: valida, envía, muestra feedback y **guarda lead en MongoDB**.
- ✅ Testing e2e completado con issues corregidos (mobile menu fix verificado).