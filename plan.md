# plan.md

## 1) Objectives
- Construir una **landing one-page premium** para **IAtipsMX / ConsultorIA Services (by Factor·IA)** basada 100% en los TXT provistos.
- Lograr **alto impacto visual**: parallax, partículas/gradientes animados, glassmorphism sutil, glow en bordes, estilo “dashboard industrial”.
- UX clara con **selector de sector interactivo** (consultorios, restaurantes, construcción, oficios, servicios generales) que **despliega contenido dinámico**.
- CTAs funcionales: **botón WhatsApp** (wa.me) + **formulario** que guarda leads en **FastAPI + MongoDB**.
- Tipografía: **serif** (títulos), **sans** (cuerpo), **monospace** (labels/datos técnicos).
- Mobile-first: rendimiento y legibilidad perfectos en móvil.
- Definir POC: **No se requiere POC** (no hay integraciones externas complejas; core = UI + persistencia simple de leads).

---

## 2) Implementation Steps

### Phase 2 — V1 App Development (core build directo, sin POC)
**User stories (V1)**
1. Como dueño de negocio, quiero ver en el hero una promesa clara y métricas animadas para entender el valor en 5 segundos.
2. Como prospecto, quiero seleccionar mi sector y ver soluciones/módulos específicos sin navegar a otra página.
3. Como prospecto móvil, quiero contactar por WhatsApp con 1 tap desde cualquier sección.
4. Como prospecto, quiero llenar un formulario corto y recibir confirmación inmediata de envío.
5. Como administrador, quiero que los leads queden guardados en MongoDB para seguimiento comercial.

**Frontend (React) — estructura one-page**
- Setup: React + Vite, Tailwind (o CSS modules) + Framer Motion.
- Layout/secciones (todas con scroll reveal fade-in + slide-up):
  - **Sticky Nav**: links a secciones + botón “Consulta Gratis” + botón “← Volver a Factor·IA” (https://www.factorai.mx).
  - **Hero**: título/copy oficial + CTA principal + métricas con **contadores animados** + fondo con **gradiente radial animado** + partículas sutiles.
  - **Problema / Pain Points**: cards con hover (elevación + glow + border).
  - **Sectores (selector interactivo)**: tabs/pills (5) + panel dinámico con:
    - Problemas del sector
    - Solución resumida
    - Módulos/beneficios cuantificados (según TXT)
  - **Servicios (6 módulos generales)**: grid con iconos, hover effects.
  - **Proceso (4 pasos)**: timeline/cards con animación de transición.
  - **Precios (3 planes)**: pricing cards con “Más elegido”, toggles/hover, CTA por plan.
  - **Testimonios (3)**: carrusel o grid responsive.
  - **Cobertura (Saltillo/Noreste + puntos clave)**: mapa estilizado/ilustración abstracta + lista.
  - **Consulta Gratis (Contacto)**: botón WhatsApp + **formulario**.
  - **Footer**: resumen, links, redes (IG/TikTok/YT), correo.

**Animaciones obligatorias (checklist de implementación)**
- Scroll reveal por sección (IntersectionObserver + Framer Motion).
- Hero: gradiente animado y/o canvas de partículas (ligero) + micro-parallax en capas.
- Contadores animados: 3 métricas del hero con easing.
- Hover en tarjetas: translateY + shadow + glow + border-color.
- Transiciones suaves: scroll-to anchors + motion transitions.
- Typing/reveal: en una frase clave del hero o en el CTA (“automatización de verdad”).

**Branding & assets**
- Incluir **logo IAtipsMX** (asset subido) y usar paleta alineada a FactorAI (negros/grises + acentos verde/rojo sutiles del logo).
- Si no hay fotos: usar **visuales abstractos premium** (grids, noise, blobs, luces) para mantener coherencia industrial.

**Contactos y enlaces (reales)**
- WhatsApp: **+52 844 881 7425** → `https://wa.me/528448817425?text=...`
- Email: **factor.iaops@gmail.com**
- Instagram: https://www.instagram.com/iatipsmx/
- TikTok: https://www.tiktok.com/@iatipsmx
- YouTube: https://www.youtube.com/@IAtipsMX

**Backend (FastAPI + MongoDB) — leads**
- Endpoint `POST /api/leads`:
  - payload: nombre, negocio, sector, ciudad, telefono/whatsapp, email, mensaje, origen/utm, timestamp.
  - validación (Pydantic), rate-limit básico (opcional), sanitización.
- Endpoint `GET /api/health` para verificación.
- MongoDB collection: `leads` con índices por `createdAt`, `sector`.
- Respuesta frontend: estado loading/success/error + mensaje claro.

**V1 Testing & Validation (1 ronda e2e)**
- Verificar: navegación anchor, selector de sectores, animaciones (sin jank), CTAs WhatsApp, envío de formulario, guardado en Mongo, responsive.

---

### Phase 3 — Hardening, polish & performance
**User stories (polish)**
1. Como usuario móvil, quiero que las animaciones no afecten el rendimiento ni el scroll.
2. Como prospecto, quiero que el sitio cargue rápido incluso con efectos visuales.
3. Como negocio, quiero que el formulario evite spam y errores de captura.
4. Como administrador, quiero exportar leads fácilmente.
5. Como usuario, quiero accesibilidad básica (contraste, focus states, reduced motion).

- Performance:
  - Lazy-load secciones pesadas, optimizar canvas/partículas, reducir repaints.
  - `prefers-reduced-motion` para desactivar animaciones intensas.
- UX:
  - Sticky “WhatsApp” floating button.
  - Confirmación post-submit + fallback mailto.
- Backend:
  - Endpoint `GET /api/leads.csv` (simple) o `GET /api/leads` paginado (si se requiere).
  - Honeypot/recaptcha (solo si el usuario lo pide; puede dificultar testing).
- SEO básico: titles, meta, OpenGraph, schema LocalBusiness (opcional).

**Testing**
- Segunda ronda e2e: mobile Safari/Chrome emulation, validación de accesibilidad y errores.

---

### Phase 4 — Optional enhancements (solo si el usuario aprueba)
**User stories (extras)**
1. Como prospecto, quiero un FAQ para resolver dudas comunes sin escribir.
2. Como prospecto, quiero agendar una llamada desde Calendly/Google Calendar.
3. Como equipo comercial, quiero notificación por email/Slack al recibir lead.
4. Como marca, quiero variantes A/B del hero/CTA.
5. Como admin, quiero panel interno para ver leads (requiere auth).

- Nota: Cualquier **auth**, notificaciones externas o calendar integraciones podrían requerir POC.

---

## 3) Next Actions
- Confirmar copy final de WhatsApp prellenado (mensaje inicial) y campos exactos del formulario.
- Confirmar si se desea incluir “Factor·IA Manufactura” como link adicional o solo `factorai.mx`.
- Construir V1: frontend + backend leads + despliegue local.
- Ejecutar testing e2e y ajustar.

---

## 4) Success Criteria
- One-page responsive con todas las secciones y copy de los TXT, sin contenido faltante.
- Animaciones obligatorias implementadas: scroll reveal, counters, hover glow, hero partículas/gradiente, typing/reveal.
- Selector de sectores funcional y claro (5 sectores con panel dinámico completo).
- Botón WhatsApp funcional (wa.me) y redes sociales abren links reales.
- Formulario funcional: valida, envía, muestra feedback y **guarda lead en MongoDB**.
- Lighthouse (objetivo orientativo): Performance ≥ 80 en móvil, Accessibility ≥ 85 (con reduced motion).