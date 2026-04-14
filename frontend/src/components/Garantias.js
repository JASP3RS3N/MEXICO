import React from 'react';
import { ScrollReveal } from './ScrollReveal';
import { CheckCircle2, ShieldCheck, FileSearch, ShieldAlert } from 'lucide-react';

export const Garantias = () => {
  const garantias = [
    {
      icon: <CheckCircle2 className="w-10 h-10 text-cyan" />,
      title: "Cumplimiento IATF 16949 automatizado",
      desc: "LPAs, 8Ds, control documental, SOPs y Core Tools digitalizados con trazabilidad completa."
    },
    {
      icon: <ShieldCheck className="w-10 h-10 text-cyan" />,
      title: "Listo para auditoría OEM",
      desc: "Evidencia con timestamp, firma digital, historial exportable en formato que GM, Ford y Stellantis requieren."
    },
    {
      icon: <FileSearch className="w-10 h-10 text-cyan" />,
      title: "Trazabilidad documental de punta a punta",
      desc: "Cada cambio, cada revisión, cada aprobación queda registrada automáticamente."
    },
    {
      icon: <ShieldAlert className="w-10 h-10 text-cyan" />,
      title: "Compliance sin esfuerzo manual",
      desc: "La IA detecta discrepancias, escala hallazgos y genera reportes ejecutivos en español automáticamente."
    }
  ];

  return (
    <section id="garantias" className="py-24 px-6 bg-background relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-px bg-cyan"></div>
            <span className="font-mono text-xs uppercase tracking-widest text-cyan">Qué Garantizamos</span>
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-textBright mb-16 max-w-2xl leading-tight">
            La certeza de estar siempre listo
          </h2>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {garantias.map((g, i) => (
            <ScrollReveal key={i} delay={i * 0.1}>
              <div className="glass-panel p-10 h-full hover:border-cyan/30 hover:bg-cyan/5 transition-colors">
                <div className="mb-6 bg-surface3 w-20 h-20 rounded-2xl flex items-center justify-center">
                  {g.icon}
                </div>
                <h3 className="font-display text-2xl font-bold text-textBright mb-4">{g.title}</h3>
                <p className="text-textDim text-lg leading-relaxed">{g.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};
