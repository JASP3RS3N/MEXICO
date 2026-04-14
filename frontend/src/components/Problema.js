import React from 'react';
import { motion } from 'framer-motion';
import { ScrollReveal } from './ScrollReveal';
import { AlertTriangle, Clock, FileSpreadsheet, RefreshCcw } from 'lucide-react';

export const Problema = () => {
  const problems = [
    {
      icon: <Clock className="text-red-400 w-8 h-8" />,
      text: "Te piden 8Ds en 24 horas y tu equipo tarda 5 días en Word"
    },
    {
      icon: <AlertTriangle className="text-amber-400 w-8 h-8" />,
      text: "La auditoría IATF es en 3 semanas y faltan 40 LPAs sin cerrar"
    },
    {
      icon: <FileSpreadsheet className="text-blue-400 w-8 h-8" />,
      text: "GM requiere trazabilidad completa y tú llevas control en Excel"
    },
    {
      icon: <RefreshCcw className="text-purple-400 w-8 h-8" />,
      text: "El ECN del cliente llegó y nadie sabe si la línea ya aplicó el cambio"
    }
  ];

  return (
    <section id="problema" className="py-24 px-6 relative bg-surface border-y border-border">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-px bg-red-400"></div>
            <span className="font-mono text-xs uppercase tracking-widest text-red-400">El Problema Que Resolvemos</span>
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-textBright mb-16 max-w-2xl leading-tight">
            El dolor real del Tier 2/Tier 3 mexicano
          </h2>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
          {problems.map((prob, i) => (
            <ScrollReveal key={i} delay={i * 0.1}>
              <div className="glass-panel p-8 hover:-translate-y-2 transition-transform duration-300 hover:border-red-400/30 group">
                <div className="w-16 h-16 bg-surface3 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {prob.icon}
                </div>
                <p className="text-xl md:text-2xl text-textBright font-body font-medium leading-relaxed">
                  "{prob.text}"
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal yOffset={30}>
          <div className="text-center bg-gradient-to-r from-cyan/10 via-blue/10 to-cyan/10 border border-cyan/20 rounded-2xl p-10 md:p-16">
            <h3 className="font-display text-2xl md:text-4xl font-bold text-textBright mb-4">
              Factor·IA resuelve todo esto.
            </h3>
            <p className="font-mono text-lg md:text-xl text-cyan uppercase tracking-widest">
              Automatizado. Trazable. Auditable.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};
