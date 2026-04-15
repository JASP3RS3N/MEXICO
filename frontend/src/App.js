import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import CountUp from "react-countup";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Factory,
  Instagram,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MonitorCog,
  Music2,
  Phone,
  ShieldCheck,
  Stethoscope,
  UtensilsCrossed,
  Wrench,
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Toaster, toast } from "sonner";
import "@/App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_parallax-hub-1/artifacts/pqar40rk__d5fcac66-4482-409e-9783-60041537e5b6.jpg";
const WHATSAPP_URL =
  "https://wa.me/528448817425?text=Hola%20IAtipsMX%2C%20quiero%20una%20consulta%20gratis%20para%20mi%20negocio.";

const navItems = [
  { id: "hero", label: "Inicio" },
  { id: "problem", label: "Problema" },
  { id: "sectors", label: "Sectores" },
  { id: "services", label: "Servicios" },
  { id: "process", label: "Proceso" },
  { id: "pricing", label: "Precios" },
  { id: "testimonials", label: "Testimonios" },
  { id: "coverage", label: "Cobertura" },
  { id: "contact", label: "Contacto" },
];

const metrics = [
  { value: 7, suffix: " días", label: "Para estar operando" },
  { value: 24, suffix: "/7", label: "Atención automática" },
  { value: 30, suffix: " días", label: "Para ver impacto visible" },
];

const painPoints = [
  {
    label: "Todos los sectores",
    title: "Clientes que no regresan",
    description:
      "Sin seguimiento automático, el cliente se enfría y termina buscando a la competencia.",
  },
  {
    label: "Todos los sectores",
    title: "Cobros tardíos o perdidos",
    description:
      "Persigues pagos en vez de operar. El flujo de caja se resiente por tareas manuales.",
  },
  {
    label: "Consultorios y restaurantes",
    title: "Agenda caótica y espacios vacíos",
    description:
      "Citas y reservas que no se presentan significan tiempo muerto, desorden y dinero perdido.",
  },
  {
    label: "Oficios y servicios",
    title: "Invisible en internet",
    description:
      "El cliente que te necesita no te encuentra, no ve reseñas y no entiende por qué confiar.",
  },
  {
    label: "Operación diaria",
    title: "Sin tiempo para crecer",
    description:
      "El dueño sigue haciendo seguimiento, agenda y contenido en lugar de enfocarse en vender más.",
  },
  {
    label: "Reputación local",
    title: "Reseñas sin gestionar",
    description:
      "Una opinión sin respuesta puede enfriar la decisión del siguiente prospecto que te busca en Google.",
  },
];

const sectors = [
  {
    id: "consultorios",
    shortLabel: "Consultorio",
    label: "Consultorios y clínicas",
    icon: Stethoscope,
    audience:
      "Medicina general, dental, dermatología, ginecología, pediatría, nutrición y psicología.",
    summary: "Bot de citas + follow-up + reactivación de pacientes.",
    problems: [
      "Pacientes que agendan y no llegan.",
      "Agenda con huecos y recepcionista saturada.",
      "Reseñas sin respuesta y redes abandonadas.",
      "Pacientes que no regresan a revisión.",
    ],
    modules: [
      {
        title: "WhatsApp Bot de Citas",
        benefit:
          "Agenda, confirma y reprograma con recordatorio automático 24 horas antes.",
        impact: "Hasta 40% menos citas perdidas el primer mes.",
      },
      {
        title: "Gestión de reseñas",
        benefit:
          "Respuesta automática y personalizada a reseñas de Google y Doctoralia.",
        impact: "Perfil activo = más pacientes orgánicos.",
      },
      {
        title: "Contenido para redes",
        benefit:
          "Posts educativos, tips de salud y promociones generados por IA.",
        impact: "16 posts al mes sin cargar al equipo.",
      },
      {
        title: "Reactivación de pacientes",
        benefit:
          "Detecta pacientes dormidos y los vuelve a contactar.",
        impact: "20–30% de pacientes inactivos regresan.",
      },
    ],
  },
  {
    id: "restaurantes",
    shortLabel: "Restaurante",
    label: "Restaurantes y fondas",
    icon: UtensilsCrossed,
    audience:
      "Comida corrida, restaurantes de especialidad, marisquerías, taquerías, cafeterías y fondas.",
    summary: "Reservas + menú IA + contenido gastronómico + reseñas.",
    problems: [
      "Reservas por llamada que se pierden.",
      "Mesas vacías por faltas de confirmación.",
      "Reseñas negativas sin respuesta.",
      "No saber qué platillos dejan más margen.",
    ],
    modules: [
      {
        title: "Reservas por WhatsApp",
        benefit: "Reserva, confirmación y recordatorio automático en un solo flujo.",
        impact: "Menos mesas vacías, más ventas por turno.",
      },
      {
        title: "Ingeniería de menú con IA",
        benefit: "Analiza menú por demanda y margen con enfoque comercial.",
        impact: "+10–20% de margen sin subir precios visibles.",
      },
      {
        title: "Contenido gastronómico",
        benefit: "Fotos, captions y promociones listos para publicar.",
        impact: "Instagram activo sin pagar community manager.",
      },
      {
        title: "Reseñas Google & Maps",
        benefit: "Respuesta automática e incentivo post-visita.",
        impact: "Mejor posición local en Google Maps.",
      },
    ],
  },
  {
    id: "construccion",
    shortLabel: "Construcción",
    label: "Constructoras y contratistas",
    icon: Building2,
    audience:
      "Construcción residencial y comercial, remodelación, arquitectura, acabados, herrería y carpintería.",
    summary: "Cotizador rápido + cobros automáticos + portfolio + seguimiento.",
    problems: [
      "Cotizaciones lentas que enfrían al prospecto.",
      "Cobros atrasados y flujo de caja inestable.",
      "Fotos de obra sin convertirse en material comercial.",
      "Leads y referidos perdidos por falta de seguimiento.",
    ],
    modules: [
      {
        title: "Cotizador asistido por IA",
        benefit: "Entrega un estimado inicial por WhatsApp en minutos.",
        impact: "De 3 días a 20 minutos por cotización.",
      },
      {
        title: "Recordatorios de cobro",
        benefit: "Mensajes cordiales programados según calendario de avance.",
        impact: "Menos mora y caja más sana.",
      },
      {
        title: "Portfolio digital",
        benefit: "Transforma fotos de obra en piezas profesionales para vender.",
        impact: "Un portafolio que ayuda a cerrar contratos.",
      },
      {
        title: "Seguimiento de prospectos",
        benefit: "CRM simple con estado de negociación y follow-up automático.",
        impact: "Más proyectos cerrados, menos leads perdidos.",
      },
    ],
  },
  {
    id: "oficios",
    shortLabel: "Oficios",
    label: "Electricistas, plomeros y técnicos",
    icon: Wrench,
    audience:
      "Electricidad residencial e industrial, plomería, gas, aire acondicionado, cerrajería y servicios técnicos especializados.",
    summary: "Agenda + presencia online + reseñas + cotización rápida.",
    problems: [
      "Llamadas perdidas mientras estás en una instalación.",
      "Sin agenda clara para visitas y seguimientos.",
      "Cero presencia en Google Maps y reseñas escasas.",
      "Cotizaciones improvisadas que no cierran.",
    ],
    modules: [
      {
        title: "Bot de contacto 24/7",
        benefit: "Recibe clientes, entiende el problema y agenda visita automáticamente.",
        impact: "Ninguna llamada perdida se va con la competencia.",
      },
      {
        title: "Presencia en Google Maps",
        benefit: "Configuración y optimización del perfil local.",
        impact: "Clientes nuevos sin pagar publicidad.",
      },
      {
        title: "Solicitud de reseñas",
        benefit: "Pide reseña después del servicio con flujo simple.",
        impact: "Más confianza y cierres más rápidos.",
      },
      {
        title: "Cotización por WhatsApp",
        benefit: "Plantillas rápidas y profesionales para servicios frecuentes.",
        impact: "Cotizaciones que cierran mejor.",
      },
    ],
  },
  {
    id: "servicios-generales",
    shortLabel: "Servicios generales",
    label: "Servicios generales y atención directa",
    icon: Factory,
    audience:
      "Estéticas, talleres, lavanderías, guarderías, tutorías, limpieza, reparación de electrodomésticos y más.",
    summary: "CRM simple + retención + referidos + contenido constante.",
    problems: [
      "Clientes que van una vez y no vuelven.",
      "Sin historial ni seguimiento post-servicio.",
      "Cobros irregulares y atención manual al 100%.",
      "Redes sin estrategia y referidos desaprovechados.",
    ],
    modules: [
      {
        title: "CRM simple de retención",
        benefit: "Registra historial y detecta clientes inactivos.",
        impact: "Retención +25% sin contratar a nadie.",
      },
      {
        title: "Seguimiento post-servicio",
        benefit: "Mensaje 24–48 horas después para detectar fricción a tiempo.",
        impact: "Menos quejas públicas y mayor lealtad.",
      },
      {
        title: "Programa de referidos",
        benefit: "Activa un flujo automático que premia a quien recomienda.",
        impact: "Clientes nuevos a costo cero.",
      },
      {
        title: "Contenido para redes",
        benefit: "Posts, historias y promociones para mantener presencia digital.",
        impact: "Constancia sin esfuerzo operativo.",
      },
    ],
  },
];

const services = [
  {
    label: "WhatsApp 24/7",
    title: "Agente de WhatsApp",
    description:
      "Recibe clientes, agenda, cotiza, responde preguntas y hace seguimiento sin cortar tu operación.",
    icon: MessageCircle,
  },
  {
    label: "Reputación local",
    title: "Gestión de reseñas",
    description:
      "Respuesta automática en Google, Doctoralia, Maps y plataformas clave según tu sector.",
    icon: ShieldCheck,
  },
  {
    label: "Contenido constante",
    title: "Contenido para redes",
    description:
      "Posts, historias, promociones y piezas listas para Instagram, Facebook, TikTok o YouTube.",
    icon: MonitorCog,
  },
  {
    label: "Cobranza ligera",
    title: "Cobros y recordatorios",
    description:
      "Recordatorios automáticos por WhatsApp para reducir mora y perseguir menos pagos.",
    icon: Clock3,
  },
  {
    label: "Retención",
    title: "Reactivación de clientes",
    description:
      "Detecta clientes dormidos, reactívalos y crea rutinas de seguimiento post-servicio.",
    icon: Bot,
  },
  {
    label: "Reporte ejecutivo",
    title: "Reportes y dashboard",
    description:
      "Visibilidad sobre leads, conversiones, reseñas y retención para decidir con números.",
    icon: BadgeCheck,
  },
];

const processSteps = [
  {
    step: "01",
    title: "Diagnóstico gratuito",
    description:
      "30 minutos por videollamada o en tu negocio para detectar fugas de clientes y prioridades reales.",
  },
  {
    step: "02",
    title: "Propuesta personalizada",
    description:
      "Definimos qué módulos activar primero según tu sector. Sin paquetes genéricos.",
  },
  {
    step: "03",
    title: "Implementación en 7 días",
    description:
      "Configuramos WhatsApp, Google, reseñas, redes o cobros y hacemos pruebas contigo.",
  },
  {
    step: "04",
    title: "Resultados en 30 días",
    description:
      "Menos citas perdidas, más reseñas, seguimiento automático y claridad comercial con reporte incluido.",
  },
];

const pricingPlans = [
  {
    id: "basico",
    name: "Básico",
    price: "$3,500",
    cadence: "MXN / mes",
    setup: "+ $2,000 setup único",
    description: "Para empezar a automatizar lo esencial.",
    featured: false,
    items: [
      "WhatsApp Bot básico (citas o contacto)",
      "Recordatorio automático 24 horas antes",
      "Respuesta a reseñas de Google",
      "8 posts para redes por mes",
      "Soporte por WhatsApp de lunes a viernes",
      "Reporte mensual básico",
    ],
  },
  {
    id: "profesional",
    name: "Profesional",
    price: "$7,500",
    cadence: "MXN / mes",
    setup: "Setup incluido",
    description: "El plan más elegido para llenar agenda o local.",
    featured: true,
    items: [
      "Todo lo del plan Básico",
      "WhatsApp avanzado + follow-up",
      "Gestión completa de reseñas",
      "16 posts + calendario editorial",
      "Retención y reactivación de clientes",
      "Recordatorios de cobro automáticos",
      "Dashboard semanal de resultados",
      "Hasta 2 colaboradores incluidos",
    ],
  },
  {
    id: "total",
    name: "Total",
    price: "$14,000",
    cadence: "MXN / mes",
    setup: "Setup incluido · hasta 3 sucursales",
    description: "Para negocios con más volumen o varias ubicaciones.",
    featured: false,
    items: [
      "Todo lo del plan Profesional",
      "Hasta 3 sucursales / ubicaciones",
      "Equipo ilimitado",
      "Contenido ilimitado para redes",
      "Integración con sistema existente",
      "Reportes ejecutivos semanales",
      "Soporte prioritario 7 días",
      "Consultoría de crecimiento mensual",
    ],
  },
];

const testimonials = [
  {
    quote:
      "Antes yo misma confirmaba cada cita por WhatsApp. Ahora el sistema manda el recordatorio solo y los no-shows bajaron a casi cero.",
    name: "Dra. Sandra Morales",
    role: "Odontóloga · Saltillo, Coah.",
    business: "Consultorio Dental",
  },
  {
    quote:
      "Los viernes teníamos mesas reservadas vacías. Ahora la gente confirma o cancela con tiempo y el contenido de Instagram se ve mucho más profesional.",
    name: "Roberto Guerrero",
    role: "Propietario · Restaurante El Norteño",
    business: "Restaurante",
  },
  {
    quote:
      "Siempre se me iba el cliente porque no contestaba cuando estaba en una instalación. Con el bot de WhatsApp ya no pierdo servicios.",
    name: "Ing. Marco Reyes",
    role: "Electricista · Ramos Arizpe, Coah.",
    business: "Servicios Técnicos",
  },
];

const coverageLocations = [
  "Saltillo",
  "Ramos Arizpe",
  "Arteaga",
  "Monterrey",
  "San Pedro GG",
  "García, NL",
];

const coverageHighlights = [
  "Somos locales, no tickets. Soporte presencial cuando importa.",
  "100% en español norteño y tono natural para tus clientes.",
  "Datos protegidos y procesos claros para tu operación.",
  "Operando en 7 días y con números visibles en 30 días.",
];

const socialLinks = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/iatipsmx/",
    icon: Instagram,
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@iatipsmx",
    icon: Music2,
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@IAtipsMX",
    icon: Youtube,
  },
];

const initialFormState = {
  nombre: "",
  negocio: "",
  sector: "consultorios",
  ciudad: "",
  telefono: "",
  email: "",
  mensaje: "",
};

const revealTransition = {
  duration: 0.6,
  ease: [0.22, 1, 0.36, 1],
};

function useTypewriter(words, reducedMotion) {
  const [wordIndex, setWordIndex] = useState(0);
  const [displayText, setDisplayText] = useState(reducedMotion ? words[0] : "");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayText(words[0]);
      return undefined;
    }

    const current = words[wordIndex % words.length];
    const atEnd = displayText === current;
    const atStart = displayText.length === 0;
    const delay = deleting ? 35 : 65;
    const hold = atEnd ? 1100 : atStart && deleting ? 250 : delay;

    const timeout = window.setTimeout(() => {
      if (!deleting && !atEnd) {
        setDisplayText(current.slice(0, displayText.length + 1));
        return;
      }

      if (!deleting && atEnd) {
        setDeleting(true);
        return;
      }

      if (deleting && !atStart) {
        setDisplayText(current.slice(0, displayText.length - 1));
        return;
      }

      setDeleting(false);
      setWordIndex((prev) => (prev + 1) % words.length);
    }, hold);

    return () => window.clearTimeout(timeout);
  }, [deleting, displayText, reducedMotion, wordIndex, words]);

  return displayText;
}

function useActiveSection(ids) {
  const [activeId, setActiveId] = useState(ids[0]);

  useEffect(() => {
    const observers = [];
    ids.forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveId(id);
          }
        },
        { rootMargin: "-35% 0px -45% 0px", threshold: 0.15 }
      );

      observer.observe(element);
      observers.push(observer);
    });

    return () => observers.forEach((observer) => observer.disconnect());
  }, [ids]);

  return activeId;
}

function scrollToSection(sectionId) {
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function buildPlanMessage(planName) {
  return `Hola IAtipsMX, quiero información del plan ${planName} para mi negocio.`;
}

function Reveal({ children, className = "", delay = 0, reducedMotion = false }) {
  return (
    <motion.div
      className={className}
      initial={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={reducedMotion ? { duration: 0.01 } : { ...revealTransition, delay }}
    >
      {children}
    </motion.div>
  );
}

function SectionHeader({ kicker, title, description }) {
  return (
    <div className="section-header">
      <span className="eyebrow">{kicker}</span>
      <h2 className="section-title">{title}</h2>
      <p className="section-description">{description}</p>
    </div>
  );
}

function ParticleField({ reducedMotion }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, index) => ({
        id: index,
        left: `${(index * 13 + 7) % 100}%`,
        top: `${(index * 17 + 11) % 100}%`,
        delay: `${index * 0.45}s`,
        duration: `${6 + (index % 5)}s`,
      })),
    []
  );

  if (reducedMotion) {
    return <div className="hero-grid" aria-hidden="true" />;
  }

  return (
    <div className="particle-layer" aria-hidden="true">
      <div className="hero-grid" />
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="hero-particle"
          style={{
            left: particle.left,
            top: particle.top,
            animationDelay: particle.delay,
            animationDuration: particle.duration,
          }}
        />
      ))}
    </div>
  );
}

function Hero({ reducedMotion }) {
  const { scrollYProgress } = useScroll();
  const translateY = useTransform(scrollYProgress, [0, 0.3], [0, reducedMotion ? 0 : -60]);
  const scale = useTransform(scrollYProgress, [0, 0.4], [1, reducedMotion ? 1 : 1.08]);
  const typedText = useTypewriter(
    [
      "automatización de verdad",
      "atención 24/7",
      "seguimiento que sí convierte",
    ],
    reducedMotion
  );

  return (
    <section id="hero" className="hero-section section-shell noise-surface">
      <ParticleField reducedMotion={reducedMotion} />
      <div className="hero-radial hero-radial-left" />
      <div className="hero-radial hero-radial-right" />
      <div className="container hero-layout">
        <div className="hero-copy-block">
          <Reveal reducedMotion={reducedMotion}>
            <span className="eyebrow" data-testid="hero-kicker-label">
              IA tips MX · by Factor·IA · Noreste de México
            </span>
          </Reveal>
          <Reveal reducedMotion={reducedMotion} delay={0.08}>
            <h1 className="hero-title">Tu negocio merece automatización de verdad</h1>
          </Reveal>
          <Reveal reducedMotion={reducedMotion} delay={0.14}>
            <div className="hero-dynamic-line" data-testid="hero-dynamic-phrase">
              <span className="hero-dynamic-label">Activamos:</span>
              <span className="accent-text">{typedText}</span>
              <span className="typing-caret" aria-hidden="true" />
            </div>
          </Reveal>
          <Reveal reducedMotion={reducedMotion} delay={0.2}>
            <p className="hero-description">
              Seguimiento de clientes, cobros automáticos, atención 24/7 y contenido
              para redes — sin contratar más personal. Para consultorios,
              restaurantes, constructoras, oficios y servicios en general.
            </p>
          </Reveal>
          <Reveal reducedMotion={reducedMotion} delay={0.28}>
            <div className="hero-actions">
              <Button
                className="primary-cta-button"
                data-testid="hero-whatsapp-cta-button"
                onClick={() => window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer")}
              >
                Pedir diagnóstico por WhatsApp
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="secondary-cta-button"
                data-testid="hero-view-sectors-button"
                onClick={() => scrollToSection("sectors")}
              >
                Ver sectores
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Reveal>
          <Reveal reducedMotion={reducedMotion} delay={0.36}>
            <div className="metrics-grid">
              {metrics.map((metric, index) => (
                <Card className="metric-card" key={metric.label}>
                  <CardContent className="metric-card-content">
                    <div className="metric-number" data-testid={`hero-metric-${index + 1}`}>
                      <CountUp
                        end={metric.value}
                        duration={reducedMotion ? 0 : 2.1}
                        enableScrollSpy={!reducedMotion}
                        scrollSpyDelay={150}
                      />
                      <span>{metric.suffix}</span>
                    </div>
                    <p className="metric-label">{metric.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Reveal>
        </div>

        <motion.div className="hero-visual-shell" style={{ y: translateY, scale }}>
          <Reveal reducedMotion={reducedMotion}>
            <Card className="hero-showcase-card">
              <CardContent className="hero-showcase-content">
                <div className="hero-brand-row">
                  <img src={LOGO_URL} alt="Logo de IAtipsMX" className="hero-logo" />
                  <div>
                    <p className="hero-brand-name">ConsultorIA Services</p>
                    <p className="hero-brand-meta">Landing B2B local · by Factor·IA</p>
                  </div>
                </div>

                <div className="hero-status-strip">
                  <span className="status-pill">Implementación rápida</span>
                  <span className="status-pill">Atención local</span>
                  <span className="status-pill">Operación industrial</span>
                </div>

                <div className="hero-panel-grid">
                  <div className="hero-panel hero-panel-large">
                    <span className="panel-label">Sectores activos</span>
                    <div className="hero-sector-stack">
                      {sectors.map((sector) => {
                        const Icon = sector.icon;
                        return (
                          <div key={sector.id} className="hero-sector-chip">
                            <Icon className="h-4 w-4" />
                            <span>{sector.shortLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="hero-panel">
                    <span className="panel-label">Módulos clave</span>
                    <p>WhatsApp, reseñas, contenido, cobros, retención y reportes.</p>
                  </div>
                  <div className="hero-panel">
                    <span className="panel-label">Cobertura</span>
                    <p>Saltillo, Ramos Arizpe, Arteaga, Monterrey y entorno.</p>
                  </div>
                  <div className="hero-panel hero-panel-cta">
                    <span className="panel-label">Consulta gratis</span>
                    <Button
                      variant="outline"
                      className="mini-cta-button"
                      data-testid="hero-contact-scroll-button"
                      onClick={() => scrollToSection("contact")}
                    >
                      Hablar ahora <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Reveal>
        </motion.div>
      </div>
    </section>
  );
}

function StickyNav({ activeSection }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleMobileNavigate = (targetId) => {
    setIsMenuOpen(false);
    window.setTimeout(() => {
      scrollToSection(targetId);
    }, 80);
  };

  return (
    <header className="sticky-nav">
      <div className="container nav-inner">
        <button
          type="button"
          className="brand-lockup"
          data-testid="nav-brand-home-button"
          onClick={() => scrollToSection("hero")}
        >
          <img src={LOGO_URL} alt="IAtipsMX" className="nav-logo" />
          <div>
            <span className="nav-brand-title">iatipsmx</span>
            <span className="nav-brand-subtitle">by Factor·IA</span>
          </div>
        </button>

        <nav className="desktop-nav" aria-label="Navegación principal">
          {navItems.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`nav-link ${activeSection === item.id ? "nav-link-active" : ""}`}
              data-testid={`sticky-nav-${item.id}-button`}
              onClick={() => scrollToSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="nav-actions">
          <Button
            variant="outline"
            className="desktop-factor-button"
            data-testid="sticky-nav-factorai-button"
            onClick={() => window.open("https://www.factorai.mx", "_blank", "noopener,noreferrer")}
          >
            Volver a Factor·IA
          </Button>
          <Button
            className="desktop-contact-button"
            data-testid="sticky-nav-consulta-gratis-button"
            onClick={() => scrollToSection("contact")}
          >
            Consulta gratis
          </Button>

          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="mobile-menu-button"
                aria-label="Abrir menú"
                data-testid="mobile-menu-trigger-button"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="mobile-menu-sheet">
              <SheetHeader>
                <SheetTitle>IA tips MX</SheetTitle>
                <SheetDescription>
                  Automatización con inteligencia artificial para negocios locales.
                </SheetDescription>
              </SheetHeader>
              <div className="mobile-menu-links">
                {navItems.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className="mobile-menu-link"
                    data-testid={`mobile-nav-${item.id}-button`}
                    onClick={() => handleMobileNavigate(item.id)}
                  >
                    {item.label}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ))}
              </div>
              <div className="mobile-menu-footer">
                <Button
                  className="w-full"
                  data-testid="mobile-menu-contact-button"
                  onClick={() => handleMobileNavigate("contact")}
                >
                  Consulta gratis
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  data-testid="mobile-menu-factorai-button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    window.open("https://www.factorai.mx", "_blank", "noopener,noreferrer");
                  }}
                >
                  Volver a Factor·IA
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function ProblemSection({ reducedMotion }) {
  return (
    <section id="problem" className="content-section section-shell">
      <div className="container">
        <Reveal reducedMotion={reducedMotion}>
          <SectionHeader
            kicker="El problema"
            title="¿Te suena familiar?"
            description="Los negocios locales pierden clientes todos los días por falta de seguimiento y automatización. No por falta de calidad en el servicio."
          />
        </Reveal>
        <div className="problem-grid">
          {painPoints.map((item, index) => (
            <Reveal key={item.title} reducedMotion={reducedMotion} delay={index * 0.05}>
              <Card className="glass-card hover-lift-card problem-card">
                <CardContent className="problem-card-content">
                  <span className="card-tag">{item.label}</span>
                  <h3 className="card-title">{item.title}</h3>
                  <p className="card-copy">{item.description}</p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectorSelector({ reducedMotion, selectedSector, onSectorChange }) {
  const activeSector = selectedSector;
  const currentSector = sectors.find((sector) => sector.id === activeSector) || sectors[0];
  const Icon = currentSector.icon;

  return (
    <section id="sectors" className="content-section section-shell section-with-divider">
      <div className="container">
        <Reveal reducedMotion={reducedMotion}>
          <SectionHeader
            kicker="Por sector"
            title="Soluciones para tu tipo de negocio"
            description="No es una solución genérica. Entendemos los problemas específicos de cada sector y activamos módulos concretos para que se note en operación y ventas."
          />
        </Reveal>

        <Reveal reducedMotion={reducedMotion} delay={0.08}>
          <div className="sector-toggle-row" role="tablist" aria-label="Sectores disponibles">
            {sectors.map((sector) => {
              const SectorIcon = sector.icon;
              const isActive = sector.id === activeSector;
              return (
                <button
                  type="button"
                  key={sector.id}
                  className={`sector-toggle ${isActive ? "sector-toggle-active" : ""}`}
                  data-testid={`sector-selector-tab-${sector.id}`}
                  onClick={() => onSectorChange(sector.id)}
                >
                  <SectorIcon className="h-4 w-4" />
                  <span>{sector.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </Reveal>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentSector.id}
            initial={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -12 }}
            transition={reducedMotion ? { duration: 0.01 } : revealTransition}
            className="sector-panel glass-card"
            data-testid="sector-selector-panel"
          >
            <div className="sector-panel-head">
              <div>
                <span className="eyebrow">{currentSector.shortLabel}</span>
                <h3 className="sector-panel-title">{currentSector.label}</h3>
                <p className="sector-panel-copy">{currentSector.audience}</p>
              </div>
              <div className="sector-icon-box">
                <Icon className="h-8 w-8" />
              </div>
            </div>

            <div className="sector-snapshot-grid">
              <div className="sector-summary-box">
                <span className="card-tag">Solución central</span>
                <p>{currentSector.summary}</p>
              </div>
              <div className="sector-summary-box">
                <span className="card-tag">Qué resolvemos</span>
                <ul className="bullet-list compact-list">
                  {currentSector.problems.map((problem) => (
                    <li key={problem}>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{problem}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="sector-module-grid">
              {currentSector.modules.map((module) => (
                <Card key={module.title} className="glass-card hover-lift-card sector-module-card">
                  <CardContent className="sector-module-content">
                    <span className="card-tag">Módulo activable</span>
                    <h4 className="card-title small-title">{module.title}</h4>
                    <p className="card-copy">{module.benefit}</p>
                    <p className="impact-copy">{module.impact}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="sector-panel-actions">
              <Button
                className="primary-cta-button"
                data-testid="sector-panel-contact-button"
                onClick={() => scrollToSection("contact")}
              >
                Quiero esta solución
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="secondary-cta-button"
                data-testid="sector-panel-whatsapp-button"
                onClick={() =>
                  window.open(
                    `https://wa.me/528448817425?text=${encodeURIComponent(
                      `Hola IAtipsMX, quiero automatizar mi negocio del sector ${currentSector.shortLabel}.`
                    )}`,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
              >
                WhatsApp para {currentSector.shortLabel}
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function ServicesSection({ reducedMotion }) {
  return (
    <section id="services" className="content-section section-shell">
      <div className="container">
        <Reveal reducedMotion={reducedMotion}>
          <SectionHeader
            kicker="Servicios"
            title="Lo que activamos en tu negocio"
            description="Seis módulos que aplican a todos los sectores, configurados específicamente para tu operación y tipo de cliente."
          />
        </Reveal>

        <div className="services-grid">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <Reveal key={service.title} reducedMotion={reducedMotion} delay={index * 0.05}>
                <Card className="glass-card hover-lift-card service-card">
                  <CardContent className="service-card-content">
                    <div className="service-icon-box">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="card-tag">{service.label}</span>
                    <h3 className="card-title">{service.title}</h3>
                    <p className="card-copy">{service.description}</p>
                  </CardContent>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProcessSection({ reducedMotion }) {
  return (
    <section id="process" className="content-section section-shell section-with-divider">
      <div className="container">
        <Reveal reducedMotion={reducedMotion}>
          <SectionHeader
            kicker="Proceso"
            title="De cero a automatizado en 7 días"
            description="Sin técnicos, sin configuraciones complejas y sin que tengas que aprender sistemas nuevos. Nosotros nos encargamos de todo."
          />
        </Reveal>

        <div className="timeline-grid">
          {processSteps.map((step, index) => (
            <Reveal key={step.step} reducedMotion={reducedMotion} delay={index * 0.08}>
              <Card className="glass-card hover-lift-card timeline-card">
                <CardContent className="timeline-card-content">
                  <span className="timeline-step">{step.step}</span>
                  <h3 className="card-title">{step.title}</h3>
                  <p className="card-copy">{step.description}</p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection({ reducedMotion }) {
  return (
    <section id="pricing" className="content-section section-shell">
      <div className="container">
        <Reveal reducedMotion={reducedMotion}>
          <SectionHeader
            kicker="Precios"
            title="Inversión clara, sin sorpresas"
            description="Precio fijo mensual en pesos mexicanos. Sin cargos por cliente, sin letra chica y con la flexibilidad de crecer según tu operación."
          />
        </Reveal>

        <div className="pricing-grid">
          {pricingPlans.map((plan, index) => (
            <Reveal key={plan.id} reducedMotion={reducedMotion} delay={index * 0.08}>
              <Card className={`glass-card pricing-card ${plan.featured ? "pricing-card-featured" : ""}`}>
                <CardContent className="pricing-card-content">
                  <div className="pricing-top">
                    <div>
                      <span className="card-tag">{plan.featured ? "Más elegido" : "Plan"}</span>
                      <h3 className="pricing-title">{plan.name}</h3>
                      <p className="pricing-description">{plan.description}</p>
                    </div>
                    {plan.featured && <span className="featured-badge">Recomendado</span>}
                  </div>
                  <div className="pricing-amount-row">
                    <span className="pricing-amount">{plan.price}</span>
                    <span className="pricing-cadence">{plan.cadence}</span>
                  </div>
                  <p className="pricing-setup">{plan.setup}</p>
                  <ul className="bullet-list pricing-list">
                    {plan.items.map((item) => (
                      <li key={item}>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pricing-actions">
                    <Button
                      className="primary-cta-button"
                      data-testid={`pricing-plan-${plan.id}-whatsapp-button`}
                      onClick={() =>
                        window.open(
                          `https://wa.me/528448817425?text=${encodeURIComponent(buildPlanMessage(plan.name))}`,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                    >
                      Quiero {plan.name}
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection({ reducedMotion }) {
  return (
    <section id="testimonials" className="content-section section-shell section-with-divider">
      <div className="container">
        <Reveal reducedMotion={reducedMotion}>
          <SectionHeader
            kicker="Testimonios"
            title="Negocios que ya automatizaron"
            description="Casos reales de clientes del Noreste de México que ya redujeron fricción operativa y ganaron tiempo para vender mejor."
          />
        </Reveal>

        <div className="testimonials-scroll" data-testid="testimonials-carousel">
          {testimonials.map((testimonial, index) => (
            <Reveal key={testimonial.name} reducedMotion={reducedMotion} delay={index * 0.05}>
              <Card className="glass-card hover-lift-card testimonial-card">
                <CardContent className="testimonial-card-content">
                  <div className="testimonial-rating">★★★★★</div>
                  <p className="testimonial-quote">“{testimonial.quote}”</p>
                  <div className="testimonial-meta">
                    <div className="avatar-chip">{testimonial.name.charAt(0)}</div>
                    <div>
                      <p className="testimonial-name">{testimonial.name}</p>
                      <p className="testimonial-role">{testimonial.role}</p>
                      <p className="testimonial-business">{testimonial.business}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CoverageSection({ reducedMotion }) {
  return (
    <section id="coverage" className="content-section section-shell">
      <div className="container coverage-layout">
        <Reveal reducedMotion={reducedMotion}>
          <div>
            <SectionHeader
              kicker="Cobertura"
              title="Locales como tú. Saltillo y Noreste."
              description="No somos una empresa de otro país o de Silicon Valley. Somos de Saltillo. Conocemos tu mercado, tu tipo de cliente y tu competencia porque también vivimos aquí."
            />
            <div className="coverage-badges">
              {coverageLocations.map((location) => (
                <span key={location} className="coverage-pill">
                  <MapPin className="h-3.5 w-3.5" />
                  {location}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal reducedMotion={reducedMotion} delay={0.12}>
          <Card className="glass-card coverage-card">
            <CardContent className="coverage-card-content">
              <div className="coverage-map">
                <span className="coverage-ring coverage-ring-a" />
                <span className="coverage-ring coverage-ring-b" />
                <span className="coverage-core" />
                <div className="coverage-node node-saltillo">Saltillo</div>
                <div className="coverage-node node-ramos">Ramos Arizpe</div>
                <div className="coverage-node node-arteaga">Arteaga</div>
                <div className="coverage-node node-monterrey">Monterrey</div>
              </div>
              <div className="coverage-highlights">
                {coverageHighlights.map((item) => (
                  <div key={item} className="coverage-highlight-item">
                    <BadgeCheck className="h-4 w-4" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </section>
  );
}

function ContactSection({ reducedMotion, selectedSector, onLeadSubmitted }) {
  const [formData, setFormData] = useState({ ...initialFormState, sector: selectedSector });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormData((current) => ({ ...current, sector: selectedSector }));
  }, [selectedSector]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.nombre || !formData.negocio || !formData.ciudad || !formData.telefono || !formData.mensaje) {
      toast.error("Completa los campos obligatorios para enviarte una propuesta útil.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.post(`${API}/leads`, {
        ...formData,
        origen: "landing-contact",
      });
      toast.success("Tu solicitud fue enviada. Te contactamos en horario laboral.");
      setFormData({ ...initialFormState, sector: selectedSector });
      onLeadSubmitted(response.data);
    } catch (error) {
      toast.error(
        error?.response?.data?.detail ||
          "No se pudo enviar tu solicitud. Usa WhatsApp y lo resolvemos de inmediato."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="content-section section-shell section-with-divider">
      <div className="container contact-layout">
        <Reveal reducedMotion={reducedMotion}>
          <div className="contact-copy-panel glass-card">
            <div className="contact-copy-content">
              <span className="eyebrow">Consulta gratuita</span>
              <h2 className="section-title left">¿Tu negocio necesita automatización?</h2>
              <p className="section-description left">
                Te mostramos exactamente cómo funciona para tu tipo de negocio — sin
                compromiso y sin tecnicismos. En 30 minutos sabes si es para ti.
              </p>

              <div className="contact-quick-actions">
                <Button
                  className="primary-cta-button full-width-mobile"
                  data-testid="contact-whatsapp-button"
                  onClick={() => window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer")}
                >
                  Escríbenos por WhatsApp
                  <MessageCircle className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="secondary-cta-button full-width-mobile"
                  data-testid="contact-factorai-button"
                  onClick={() => window.open("https://www.factorai.mx", "_blank", "noopener,noreferrer")}
                >
                  Regresar a factorai.mx
                </Button>
              </div>

              <div className="contact-details-grid">
                <a
                  href="mailto:factor.iaops@gmail.com"
                  className="contact-detail-card"
                  data-testid="contact-email-link"
                >
                  <Mail className="h-4 w-4" />
                  <div>
                    <span className="card-tag">Correo</span>
                    <p>factor.iaops@gmail.com</p>
                  </div>
                </a>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="contact-detail-card"
                  data-testid="contact-phone-link"
                >
                  <Phone className="h-4 w-4" />
                  <div>
                    <span className="card-tag">WhatsApp</span>
                    <p>+52 844 881 7425</p>
                  </div>
                </a>
                <div className="contact-detail-card static-detail-card">
                  <Clock3 className="h-4 w-4" />
                  <div>
                    <span className="card-tag">Respuesta</span>
                    <p>Menos de 2 horas en horario laboral</p>
                  </div>
                </div>
                <div className="contact-detail-card static-detail-card">
                  <MapPin className="h-4 w-4" />
                  <div>
                    <span className="card-tag">Base local</span>
                    <p>Saltillo, Coahuila</p>
                  </div>
                </div>
              </div>

              <div className="social-row">
                {socialLinks.map((social) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noreferrer"
                      className="social-link"
                      aria-label={social.label}
                      data-testid={`social-link-${social.label.toLowerCase()}`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{social.label}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal reducedMotion={reducedMotion} delay={0.12}>
          <Card className="glass-card contact-form-card">
            <CardContent className="contact-form-content">
              <div className="form-head">
                <span className="eyebrow">Lead capture</span>
                <h3 className="section-title left compact">Solicita tu propuesta</h3>
                <p className="section-description left compact">
                  Cuéntanos tu giro y te devolvemos una propuesta clara, pensada para tu operación real.
                </p>
              </div>

              <form className="lead-form" onSubmit={handleSubmit}>
                <div className="form-two-col">
                  <div>
                    <label htmlFor="nombre" className="form-label">Nombre *</label>
                    <Input
                      id="nombre"
                      name="nombre"
                      placeholder="Tu nombre"
                      value={formData.nombre}
                      onChange={handleChange}
                      className="premium-input"
                      data-testid="lead-form-name-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="negocio" className="form-label">Negocio *</label>
                    <Input
                      id="negocio"
                      name="negocio"
                      placeholder="Nombre de tu negocio"
                      value={formData.negocio}
                      onChange={handleChange}
                      className="premium-input"
                      data-testid="lead-form-business-input"
                    />
                  </div>
                </div>

                <div className="form-two-col">
                  <div>
                    <label htmlFor="sector" className="form-label">Sector *</label>
                    <Select
                      value={formData.sector}
                      onValueChange={(value) => setFormData((current) => ({ ...current, sector: value }))}
                    >
                      <SelectTrigger className="premium-input" data-testid="lead-form-sector-select-trigger">
                        <SelectValue placeholder="Selecciona tu sector" />
                      </SelectTrigger>
                      <SelectContent>
                        {sectors.map((sector) => (
                          <SelectItem key={sector.id} value={sector.id}>
                            {sector.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="ciudad" className="form-label">Ciudad *</label>
                    <Input
                      id="ciudad"
                      name="ciudad"
                      placeholder="Saltillo, Monterrey..."
                      value={formData.ciudad}
                      onChange={handleChange}
                      className="premium-input"
                      data-testid="lead-form-city-input"
                    />
                  </div>
                </div>

                <div className="form-two-col">
                  <div>
                    <label htmlFor="telefono" className="form-label">WhatsApp / teléfono *</label>
                    <Input
                      id="telefono"
                      name="telefono"
                      placeholder="844 881 7425"
                      value={formData.telefono}
                      onChange={handleChange}
                      className="premium-input"
                      data-testid="lead-form-phone-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="form-label">Correo</label>
                    <Input
                      id="email"
                      type="email"
                      name="email"
                      placeholder="tu@negocio.com"
                      value={formData.email}
                      onChange={handleChange}
                      className="premium-input"
                      data-testid="lead-form-email-input"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="mensaje" className="form-label">¿Qué quieres automatizar? *</label>
                  <Textarea
                    id="mensaje"
                    name="mensaje"
                    placeholder="Ej. citas, reservas, cobros, reseñas, seguimiento de clientes o contenido para redes"
                    value={formData.mensaje}
                    onChange={handleChange}
                    className="premium-input premium-textarea"
                    data-testid="lead-form-message-input"
                  />
                </div>

                <div className="form-footer">
                  <p className="privacy-copy">
                    Al enviar, aceptas que IAtipsMX use tus datos para darte seguimiento comercial.
                  </p>
                  <Button
                    type="submit"
                    className="primary-cta-button"
                    disabled={isSubmitting}
                    data-testid="lead-form-submit-button"
                  >
                    {isSubmitting ? "Enviando..." : "Solicitar consulta gratis"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-layout">
        <div className="footer-brand-block">
          <img src={LOGO_URL} alt="IAtipsMX" className="footer-logo" />
          <div>
            <h3 className="footer-brand-title">IA tips MX</h3>
            <p className="footer-copy">
              Automatización con inteligencia artificial para negocios locales del
              Noreste de México. Más clientes, mejor atención, menos estrés.
            </p>
          </div>
        </div>

        <div className="footer-links-grid">
          <div>
            <span className="footer-heading">Secciones</span>
            <div className="footer-link-list">
              {navItems.slice(1).map((item) => (
                <button key={item.id} type="button" className="footer-link" onClick={() => scrollToSection(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="footer-heading">Contacto</span>
            <div className="footer-link-list">
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="footer-link">
                WhatsApp
              </a>
              <a href="mailto:factor.iaops@gmail.com" className="footer-link">
                factor.iaops@gmail.com
              </a>
              {socialLinks.map((social) => (
                <a key={social.label} href={social.href} target="_blank" rel="noreferrer" className="footer-link">
                  {social.label}
                </a>
              ))}
            </div>
          </div>
          <div>
            <span className="footer-heading">Factor·IA</span>
            <div className="footer-link-list">
              <a href="https://www.factorai.mx" target="_blank" rel="noreferrer" className="footer-link">
                Volver al sitio principal
              </a>
              <p className="footer-copy small">
                ConsultorIA Services · powered by Factor·IA · Hecho en Saltillo, Coahuila.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        © 2026 ConsultorIA Services by Factor·IA. Todos los derechos reservados.
      </div>
    </footer>
  );
}

function FloatingWhatsApp() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noreferrer"
      className="floating-whatsapp-button"
      aria-label="Escribir por WhatsApp"
      data-testid="floating-mobile-whatsapp-button"
    >
      <MessageCircle className="h-5 w-5" />
      <span>WhatsApp</span>
    </a>
  );
}

function AppShell() {
  const reducedMotion = useReducedMotion();
  const activeSection = useActiveSection(navItems.map((item) => item.id));
  const [latestLead, setLatestLead] = useState(null);
  const [status, setStatus] = useState({ text: "Conectando con la API...", ok: false });
  const [selectedSector, setSelectedSector] = useState(sectors[0].id);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        await axios.get(`${API}/health`);
        setStatus({ text: "API lista para capturar leads", ok: true });
      } catch (error) {
        setStatus({ text: "Formulario disponible; validando API", ok: false });
      }
    };

    fetchHealth();
  }, []);

  return (
    <div className="app-shell">
      <Toaster richColors position="top-right" />
      <StickyNav activeSection={activeSection} />
      <main>
        <Hero reducedMotion={reducedMotion} />
        <section className="status-band">
          <div className="container status-band-inner">
            <div className={`status-band-pill ${status.ok ? "ok" : "pending"}`} data-testid="backend-status-pill">
              <span className="status-dot" />
              <span>{status.text}</span>
            </div>
            {latestLead && (
              <div className="status-band-lead" data-testid="latest-lead-feedback">
                Lead recibido: {latestLead.negocio} · {latestLead.ciudad}
              </div>
            )}
          </div>
        </section>
        <ProblemSection reducedMotion={reducedMotion} />
        <SectorSelector
          reducedMotion={reducedMotion}
          selectedSector={selectedSector}
          onSectorChange={setSelectedSector}
        />
        <ServicesSection reducedMotion={reducedMotion} />
        <ProcessSection reducedMotion={reducedMotion} />
        <PricingSection reducedMotion={reducedMotion} />
        <TestimonialsSection reducedMotion={reducedMotion} />
        <CoverageSection reducedMotion={reducedMotion} />
        <ContactSection
          reducedMotion={reducedMotion}
          selectedSector={selectedSector}
          onLeadSubmitted={setLatestLead}
        />
      </main>
      <Footer />
      <FloatingWhatsApp />
    </div>
  );
}

export default function App() {
  return <AppShell />;
}
