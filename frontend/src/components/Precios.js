import React from 'react';
import { ScrollReveal } from './ScrollReveal';
import { Check } from 'lucide-react';

export const Precios = () => {
  const planes = [
    {
      nombre: "Inicio",
      precio: "$85K",
      desc: "5 servicios core",
      target: "Plantas que inician su transformación digital",
      bullets: [
        "Asistente Piso de Planta",
        "Reportes Automáticos Calidad",
        "Traductor Técnico EN↔ES",
        "LPA Digitalizado con IA",
        "Asistente Legal LFT"
      ],
      featured: false
    },
    {
      nombre: "Profesional",
      precio: "$185K",
      desc: "11 servicios + 1 dashboard",
      target: "Plantas que buscan eficiencia integral",
      includes: "Todo de Inicio +",
      bullets: [
        "Motor de Análisis de RFQs",
        "Monitor de Riesgo SC",
        "Auditor de Inventario Inteligente",
        "App Captura Calidad + Pareto",
        "MRO + Entrenador Virtual",
        "Dashboard Gerencia + Corte Financiero"
      ],
      featured: true
    },
    {
      nombre: "Enterprise",
      precio: "$320K",
      desc: "16 servicios + 2 dashboards",
      target: "Operaciones multi-planta con visión estratégica",
      includes: "Todo de Profesional +",
      bullets: [
        "App 8D / 7-Step Kaizen",
        "Generadores IA (Flujos, Puestos, SOPs)",
        "Dashboard Director Multi-Planta",
        "Control de Cambios (ECM)",
        "Optimizador de Rutas RH",
        "Soporte prioritario"
      ],
      featured: false
    },
    {
      nombre: "Total Plataforma",
      precio: "$450K+",
      desc: "20 servicios completos",
      target: "Transformación digital completa de la operación",
      includes: "Todo incluido:",
      bullets: [
        "Los 20 servicios completos",
        "Ambos dashboards ejecutivos",
        "Customización + RH + Finanzas IA",
        "Capacitación intensiva + ECM IA",
        "Account manager dedicado"
      ],
      featured: false
    }
  ];

  return (
    <section id="precios" className="py-24 px-6 bg-background relative overflow-hidden">
      {/* Background ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan/5 rounded-full blur-[100px] transform translate-x-1/3 -translate-y-1/4"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <ScrollReveal className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-12 h-px bg-cyan"></div>
            <span className="font-mono text-xs uppercase tracking-widest text-cyan">Inversión Predecible</span>
            <div className="w-12 h-px bg-cyan"></div>
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-textBright mb-6 leading-tight max-w-3xl mx-auto">
            Resultados desde el mes 1.
          </h2>
          <p className="text-lg text-textDim max-w-2xl mx-auto">
            Sin costo por token. Sin costo por usuario. Licencia mensual fija que incluye todo: plataforma, IA, soporte y actualizaciones.
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {planes.map((plan, i) => (
            <ScrollReveal key={i} delay={i * 0.1}>
              <div className={`h-full flex flex-col p-8 rounded-2xl border transition-all duration-300 relative group
                ${plan.featured 
                  ? 'bg-surface2 border-cyan/50 shadow-[0_0_30px_rgba(0,229,160,0.1)] hover:shadow-[0_0_40px_rgba(0,229,160,0.2)] hover:-translate-y-2' 
                  : 'bg-surface border-border hover:border-cyan/30 hover:bg-surface2 hover:-translate-y-1'
                }`}
              >
                {plan.featured && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-cyan text-background font-mono text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Recomendado
                  </div>
                )}
                
                <h3 className={`font-mono text-sm uppercase tracking-widest mb-4 font-bold ${plan.featured ? 'text-cyan' : 'text-textBright'}`}>
                  {plan.nombre}
                </h3>
                
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="font-display text-4xl font-bold text-textBright">{plan.precio}</span>
                  <span className="text-sm font-mono text-textDim uppercase">MXN/mes</span>
                </div>
                
                <div className="text-sm font-medium text-textMain mb-8 bg-surface3/50 inline-block px-3 py-1 rounded border border-border/50">
                  {plan.desc}
                </div>

                {plan.includes && (
                  <div className="text-xs font-mono font-bold text-textBright mb-4">{plan.includes}</div>
                )}

                <ul className="space-y-4 mb-10 flex-grow">
                  {plan.bullets.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-textDim leading-relaxed group-hover:text-textMain transition-colors">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.featured ? 'text-cyan' : 'text-textDim/50 group-hover:text-cyan'}`} />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-6 border-t border-border/50 text-xs font-mono text-textDim leading-relaxed">
                  {plan.target}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
        
        <ScrollReveal yOffset={20} delay={0.4} className="mt-12 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-textDim bg-surface2 border border-border inline-block px-6 py-3 rounded-full">
            Operación Multi-Planta: Cada planta adicional se integra con descuentos escalonados (10% a 20%+).
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
};
