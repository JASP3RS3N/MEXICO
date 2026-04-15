{
  "design_system_name": "IAtipsMX × Factor·IA — Industrial Glass Landing (One-page)",
  "brand_attributes": [
    "premium industrial",
    "tecnológico y local (Noreste MX)",
    "claridad comercial (lead-first)",
    "movimiento sutil + microinteracciones",
    "glassmorphism controlado (no transparente total)",
    "dashboard industrial (métricas, módulos, precisión)"
  ],
  "inspiration_refs": {
    "search_notes": [
      "Tendencia 2026: glassmorphism aplicado a dashboards/landing con capas translúcidas, blur y sombras suaves; parallax + partículas en hero; contadores animados para métricas.",
      "Usar estética 'industrial dashboard': grillas, etiquetas monospace, tarjetas con borde luminoso sutil, fondos con textura/noise y gradientes radiales discretos (solo decorativos)."
    ],
    "urls": [
      {
        "title": "Dribbble — Glassmorphism landing search",
        "url": "https://dribbble.com/search/glass-morphism-landing"
      },
      {
        "title": "Dribbble — Parallax hero with particles (shot)",
        "url": "https://dribbble.com/shots/22642907-Beyond-The-Void-Parallax-Hero-With-Particles"
      },
      {
        "title": "Behance — Glassmorphism dashboard search",
        "url": "https://www.behance.net/search/projects/GLASSMORPHISM%20DASHBOARD"
      }
    ]
  },
  "information_architecture_one_page": {
    "sticky_nav": [
      "Logo IAtipsMX (izq)",
      "Links ancla: Inicio, Problema, Sectores, Servicios, Proceso, Precios, Testimonios, Cobertura, Contacto",
      "CTA: 'Consulta gratis' (abre modal o scroll a formulario)",
      "Botón secundario: 'Volver a Factor·IA' (link externo a https://www.factorai.mx)"
    ],
    "sections": [
      {
        "id": "hero",
        "goal": "Impacto visual + propuesta de valor + métricas animadas + CTA WhatsApp",
        "must_have": [
          "Partículas sutiles o gradiente animado SOLO en hero",
          "Contadores animados (3–4 métricas)",
          "Typing/reveal en 1 frase clave",
          "Botón WhatsApp principal +52 844 881 7425",
          "Botón 'Ver sectores' (scroll)"
        ]
      },
      {
        "id": "problem",
        "goal": "Dolor del negocio local + por qué IA aplicada",
        "must_have": [
          "Cards con bullets (antes/después)",
          "Mini-diagrama tipo 'pipeline' (texto + iconos)"
        ]
      },
      {
        "id": "sectors",
        "goal": "Selector interactivo de 5 sectores con despliegue dinámico",
        "must_have": [
          "Tabs o ToggleGroup con 5 opciones: Consultorio, Restaurante, Construcción, Oficios, Servicios generales",
          "Panel dinámico: casos de uso + beneficios + mini-CTA",
          "Animación de transición entre paneles (fade/slide)"
        ]
      },
      {
        "id": "services",
        "goal": "Módulos/servicios (cards) con hover glow",
        "must_have": [
          "Grid bento (2 columnas mobile->1, desktop->3/4)",
          "Cada card con etiqueta monospace + título serif + descripción sans"
        ]
      },
      {
        "id": "process",
        "goal": "Proceso claro (4–6 pasos) con scroll reveal",
        "must_have": [
          "Timeline vertical en mobile, horizontal en desktop",
          "Micro-animación en step activo"
        ]
      },
      {
        "id": "pricing",
        "goal": "Precios (3 planes) + comparativa",
        "must_have": [
          "Plan recomendado con borde/acento",
          "Botón WhatsApp por plan",
          "Tabla comparativa colapsable en mobile"
        ]
      },
      {
        "id": "testimonials",
        "goal": "Prueba social",
        "must_have": [
          "Carousel en mobile",
          "Cards con avatar/initials",
          "Rating visual (iconos)"
        ]
      },
      {
        "id": "coverage",
        "goal": "Cobertura regional (Noreste MX)",
        "must_have": [
          "Mapa estilizado (simple SVG) o lista por estados/ciudades",
          "Badges por región",
          "CTA: '¿Tu ciudad?'"
        ]
      },
      {
        "id": "contact",
        "goal": "Captura de leads + WhatsApp + redes",
        "must_have": [
          "Formulario (nombre, negocio, sector, ciudad, teléfono, mensaje)",
          "Botón WhatsApp fijo (floating) en mobile",
          "Links reales: Instagram, TikTok, YouTube",
          "Aviso de privacidad breve"
        ]
      },
      {
        "id": "footer",
        "goal": "Cierre premium + navegación + Factor·IA",
        "must_have": [
          "Logo + tagline",
          "Links ancla",
          "Botón 'Volver a Factor·IA'",
          "Redes"
        ]
      }
    ]
  },
  "typography": {
    "font_pairing": {
      "serif_titles": {
        "google_font": "Spectral",
        "fallback": "ui-serif, Georgia, serif",
        "usage": "H1/H2, títulos de cards, quotes"
      },
      "sans_body": {
        "google_font": "Manrope",
        "fallback": "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        "usage": "cuerpo, descripciones, UI"
      },
      "mono_labels": {
        "google_font": "IBM Plex Mono",
        "fallback": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        "usage": "labels, tags, métricas, breadcrumbs, datos técnicos"
      }
    },
    "scale_tailwind": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight",
      "h2": "text-base md:text-lg font-medium text-muted-foreground",
      "h3": "text-xl md:text-2xl font-semibold",
      "body": "text-sm md:text-base leading-relaxed",
      "small": "text-xs md:text-sm text-muted-foreground",
      "mono_tag": "font-mono text-[11px] tracking-[0.18em] uppercase"
    }
  },
  "color_system": {
    "mode": "dark-first (industrial) con cards claras translúcidas; NO fondo transparente",
    "tokens_hsl": {
      "background": "220 18% 6%",
      "foreground": "210 20% 96%",
      "card": "220 18% 10%",
      "card-foreground": "210 20% 96%",
      "popover": "220 18% 10%",
      "popover-foreground": "210 20% 96%",
      "primary": "186 92% 42%",
      "primary-foreground": "220 18% 6%",
      "secondary": "220 14% 16%",
      "secondary-foreground": "210 20% 96%",
      "muted": "220 12% 14%",
      "muted-foreground": "215 16% 70%",
      "accent": "34 92% 56%",
      "accent-foreground": "220 18% 6%",
      "destructive": "0 72% 52%",
      "destructive-foreground": "210 20% 96%",
      "border": "220 14% 22%",
      "input": "220 14% 22%",
      "ring": "186 92% 42%",
      "radius": "0.9rem"
    },
    "semantic": {
      "success": "152 62% 44%",
      "warning": "38 92% 56%",
      "info": "200 92% 52%",
      "focus": "186 92% 42%"
    },
    "palette_notes": [
      "Acento principal: teal/cyan industrial (no morado).",
      "Acento secundario: ámbar/naranja para CTAs secundarios y highlights.",
      "Fondos: carbón azulado (industrial) + textura/noise.",
      "Cards: glass sutil con borde luminoso (ring teal al hover)."
    ]
  },
  "gradients_and_textures": {
    "rules": {
      "max_viewport_coverage": "<= 20%",
      "allowed": [
        "solo en hero como overlay decorativo",
        "separadores de sección (bandas finas)",
        "glows detrás de elementos grandes (no detrás de párrafos largos)"
      ],
      "prohibited": [
        "gradientes saturados oscuros tipo purple/pink",
        "gradientes en elementos pequeños (<100px)",
        "gradientes en áreas de lectura"
      ]
    },
    "recommended_gradients_css": {
      "hero_radial_overlay": "radial-gradient(600px circle at 20% 10%, hsla(186,92%,42%,0.22), transparent 55%), radial-gradient(520px circle at 80% 30%, hsla(34,92%,56%,0.16), transparent 60%), radial-gradient(700px circle at 50% 90%, hsla(200,92%,52%,0.10), transparent 60%)",
      "section_divider": "linear-gradient(90deg, transparent, hsla(186,92%,42%,0.35), transparent)"
    },
    "noise": {
      "approach": "CSS pseudo-element overlay con noise (opacity 0.06–0.10) para evitar look plano",
      "css_snippet": ":root{--noise-opacity:0.08;} .noise:before{content:'';position:absolute;inset:0;background-image:url('https://images.unsplash.com/photo-1540397521216-0b56cdc2f177?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=60');background-size:cover;opacity:var(--noise-opacity);mix-blend-mode:overlay;pointer-events:none;filter:grayscale(1) contrast(1.2);}",
      "note": "Usar imagen de textura como overlay MUY sutil (blur 2px opcional)."
    }
  },
  "layout_and_grid": {
    "container": "max-w-6xl mx-auto px-4 sm:px-6",
    "section_spacing": "py-16 sm:py-20 lg:py-24",
    "grid_patterns": {
      "hero": "grid grid-cols-1 lg:grid-cols-12 gap-10 items-center",
      "bento_services": "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4",
      "pricing": "grid grid-cols-1 lg:grid-cols-3 gap-4",
      "testimonials": "mobile carousel; desktop grid grid-cols-3 gap-4"
    },
    "sticky_nav": {
      "style": "backdrop-blur-md bg-background/70 border-b border-border/60",
      "height": "h-14 sm:h-16",
      "shadow": "shadow-[0_10px_30px_-20px_rgba(0,0,0,0.8)]"
    }
  },
  "components_to_use_shadcn": {
    "paths": [
      "/app/frontend/src/components/ui/button.jsx",
      "/app/frontend/src/components/ui/card.jsx",
      "/app/frontend/src/components/ui/badge.jsx",
      "/app/frontend/src/components/ui/tabs.jsx",
      "/app/frontend/src/components/ui/toggle-group.jsx",
      "/app/frontend/src/components/ui/accordion.jsx",
      "/app/frontend/src/components/ui/carousel.jsx",
      "/app/frontend/src/components/ui/dialog.jsx",
      "/app/frontend/src/components/ui/sheet.jsx",
      "/app/frontend/src/components/ui/input.jsx",
      "/app/frontend/src/components/ui/textarea.jsx",
      "/app/frontend/src/components/ui/label.jsx",
      "/app/frontend/src/components/ui/separator.jsx",
      "/app/frontend/src/components/ui/tooltip.jsx",
      "/app/frontend/src/components/ui/sonner.jsx"
    ],
    "mapping": {
      "sector_selector": "Tabs (desktop) + ToggleGroup (mobile) con panel Card",
      "pricing_details": "Accordion para FAQs/condiciones",
      "testimonials": "Carousel",
      "lead_form": "Form + Input + Textarea + Select",
      "mobile_menu": "Sheet",
      "consult_modal": "Dialog",
      "toast": "Sonner"
    }
  },
  "component_specs": {
    "glass_card": {
      "base_class": "relative rounded-[var(--radius)] border border-border/70 bg-card/55 backdrop-blur-xl shadow-[0_18px_60px_-40px_rgba(0,0,0,0.85)]",
      "hover": "hover:border-ring/50 hover:shadow-[0_22px_70px_-45px_rgba(0,0,0,0.9)]",
      "glow_pseudo": "after:absolute after:inset-0 after:rounded-[inherit] after:pointer-events-none after:opacity-0 hover:after:opacity-100 after:transition-opacity after:duration-300 after:bg-[radial-gradient(420px_circle_at_30%_20%,hsla(186,92%,42%,0.18),transparent_55%)]"
    },
    "primary_button": {
      "shape": "rounded-xl",
      "classes": "rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_10px_30px_-18px_hsla(186,92%,42%,0.55)] hover:shadow-[0_14px_40px_-18px_hsla(186,92%,42%,0.65)] active:scale-[0.98] transition-[box-shadow,background-color,color] duration-200",
      "focus": "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]"
    },
    "secondary_button_glass": {
      "classes": "rounded-xl border border-border/70 bg-background/30 backdrop-blur-md hover:bg-background/40 transition-[background-color,border-color,box-shadow] duration-200",
      "note": "Usar para 'Volver a Factor·IA' y CTAs secundarios"
    },
    "metric_chip": {
      "classes": "rounded-xl border border-border/70 bg-background/25 backdrop-blur-md px-4 py-3",
      "number": "font-mono text-2xl tracking-tight",
      "label": "font-mono text-[11px] tracking-[0.18em] uppercase text-muted-foreground"
    },
    "nav_link": {
      "classes": "text-sm text-muted-foreground hover:text-foreground transition-[color] duration-200",
      "active": "text-foreground"
    }
  },
  "motion_and_interactions": {
    "libraries": {
      "framer_motion": {
        "install": "npm i framer-motion",
        "usage": "Scroll reveal (fade-in + slide-up), stagger en grids, hover micro-lift"
      },
      "particles": {
        "recommended": "tsparticles",
        "install": "npm i react-tsparticles tsparticles",
        "usage": "Partículas sutiles en hero (densidad baja, velocidad lenta)"
      },
      "countup": {
        "recommended": "react-countup",
        "install": "npm i react-countup",
        "usage": "Métricas animadas en hero"
      },
      "parallax": {
        "recommended": "react-scroll-parallax",
        "install": "npm i react-scroll-parallax",
        "usage": "Parallax suave en glows/ilustraciones del hero y separadores"
      }
    },
    "principles": [
      "Cada sección entra con fade-in + slide-up al hacer scroll (stagger 80–120ms).",
      "Hover en tarjetas: elevación 2–6px + borde ring/50 + glow radial sutil.",
      "Botones: press scale 0.98 + sombra cambia (no transition: all).",
      "Transiciones entre paneles del selector: crossfade + slide 8–12px.",
      "Typing/reveal: solo 1 línea clave en hero (2–3s), con cursor sutil.",
      "Respetar prefers-reduced-motion: desactivar parallax/particles y reducir durations."
    ],
    "scroll_reveal_scaffold_js": "// Example (JS):\nimport { motion } from 'framer-motion';\n\nexport const Reveal = ({ children, delay = 0 }) => (\n  <motion.div\n    initial={{ opacity: 0, y: 18 }}\n    whileInView={{ opacity: 1, y: 0 }}\n    viewport={{ once: true, margin: '-80px' }}\n    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}\n  >\n    {children}\n  </motion.div>\n);\n"
  },
  "accessibility": {
    "requirements": [
      "Contraste AA: texto principal sobre fondo oscuro >= 4.5:1.",
      "Focus visible en todos los controles (ring teal).",
      "Targets táctiles >= 44px.",
      "prefers-reduced-motion: apagar partículas/parallax y usar reveal instantáneo o duration 0.01.",
      "Aria-labels en icon buttons (redes, menú)."
    ]
  },
  "data_testid_convention": {
    "rule": "Todos los elementos interactivos y de info clave deben incluir data-testid en kebab-case.",
    "examples": [
      "data-testid=\"sticky-nav-consulta-gratis-button\"",
      "data-testid=\"hero-whatsapp-cta-button\"",
      "data-testid=\"sector-selector-tab-restaurante\"",
      "data-testid=\"pricing-plan-pro-whatsapp-button\"",
      "data-testid=\"lead-form-submit-button\"",
      "data-testid=\"floating-mobile-whatsapp-button\""
    ]
  },
  "image_urls": {
    "hero_background_texture_optional": [
      {
        "url": "https://images.unsplash.com/photo-1540397521216-0b56cdc2f177?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
        "description": "Textura oscura tipo metal/industrial para overlay noise (muy baja opacidad).",
        "category": "texture"
      }
    ],
    "services_supporting_images": [
      {
        "url": "https://images.unsplash.com/photo-1581093804475-577d72e38aa0?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
        "description": "Persona trabajando con laptop en entorno técnico; útil para sección Servicios/Proceso.",
        "category": "services"
      },
      {
        "url": "https://images.unsplash.com/photo-1606206873764-fd15e242df52?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
        "description": "Laptop/entorno industrial (abstracto) para hero lateral o background card.",
        "category": "hero"
      }
    ],
    "sector_images_optional": [
      {
        "url": "https://images.unsplash.com/photo-1601822499690-afba3e54a5a4?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
        "description": "Construcción (grúa) para panel del sector Construcción.",
        "category": "sector-construccion"
      }
    ]
  },
  "content_and_copy_tone": {
    "tone": [
      "directo",
      "orientado a resultados",
      "sin tecnicismos innecesarios",
      "con guiños 'industrial' en labels (monospace)"
    ],
    "microcopy_examples": {
      "hero_kicker": "IA aplicada a negocios reales del Noreste",
      "hero_headline": "Automatiza, vende más y atiende mejor — sin complicarte",
      "hero_sub": "Implementaciones rápidas para consultorios, restaurantes, construcción, oficios y servicios generales.",
      "cta_primary": "Pedir diagnóstico por WhatsApp",
      "cta_secondary": "Ver sectores",
      "pricing_note": "Precios orientativos. Ajustamos por volumen y canales."
    }
  },
  "implementation_notes_for_main_agent": {
    "global_css": [
      "Actualizar /app/frontend/src/index.css tokens :root y .dark para que coincidan con tokens_hsl (industrial dark).",
      "Eliminar estilos centrados del template CRA en App.css; no usar .App { text-align:center }.",
      "Crear utilidades: .noise, .section-divider, .glass-card.",
      "No usar transition: all; usar transition-[color,background-color,border-color,box-shadow,opacity]."
    ],
    "react_structure_js": [
      "Crear componentes en JS (no TSX): NavbarSticky, Hero, Problem, SectorSelector, ServicesBento, ProcessTimeline, Pricing, Testimonials, Coverage, ContactForm, Footer, FloatingWhatsApp.",
      "Usar react-scroll (o anchors) para navegación one-page; resaltar link activo con IntersectionObserver.",
      "Sector selector: Tabs con contenido dinámico (array de sectores).",
      "Formulario: validar básico; submit -> toast sonner + (si backend existe) POST a endpoint; si no, dejar preparado sin romper backend.",
      "Botón Factor·IA: link externo con rel=\"noreferrer\" target=\"_blank\"."
    ],
    "motion": [
      "Wrap app con ParallaxProvider.",
      "Particles solo en hero y desactivables por reduced motion.",
      "Reveal component para todas las secciones."
    ],
    "icons": [
      "Usar lucide-react (ya en shadcn) para iconos: Phone, Mail, MapPin, Instagram, Youtube, MessageCircle, Hammer, Utensils, Stethoscope, Wrench, Building2.",
      "No emojis."
    ],
    "required_links": {
      "whatsapp": "+52 844 881 7425",
      "instagram": "https://www.instagram.com/iatipsmx/",
      "tiktok": "https://www.tiktok.com/@iatipsmx",
      "youtube": "https://www.youtube.com/@IAtipsMX",
      "factorai": "https://www.factorai.mx"
    }
  },
  "footer_and_contact": {
    "whatsapp_link_format": "https://wa.me/528448817425?text=Hola%20IAtipsMX%2C%20quiero%20una%20consulta%20gratis%20para%20mi%20negocio.",
    "socials": [
      "Instagram",
      "TikTok",
      "YouTube"
    ]
  },
  "appendix_general_ui_ux_design_guidelines": "<General UI UX Design Guidelines>  \n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
