import React from 'react';
import { ScrollReveal } from './ScrollReveal';
import { Lock, DollarSign, CloudOff, Languages } from 'lucide-react';

export const Porque = () => {
  const motivos = [
    {
      icon: <Lock className="w-8 h-8 text-blue-400" />,
      title: "Soberanía de Datos",
      desc: "NDA firmado Día 1. Infraestructura privada en México. Cero nube pública. Cero servidores en EE.UU."
    },
    {
      icon: <DollarSign className="w-8 h-8 text-blue-400" />,
      title: "Costo Fijo Predecible",
      desc: "Licencia mensual fija. Sin cobro por token, por usuario ni por consulta. 500 usuarios = mismo costo."
    },
    {
      icon: <CloudOff className="w-8 h-8 text-blue-400" />,
      title: "Sin Nube Pública",
      desc: "Procesamiento privado en el corredor Saltillo–Monterrey. Accesible por navegador web sin instalar nada."
    },
    {
      icon: <Languages className="w-8 h-8 text-blue-400" />,
      title: "100% en Español Nativo",
      desc: "No somos traducción de plataforma gringa. IA optimizada para terminología automotriz mexicana."
    }
  ];

  return (
    <section id="porque" className="py-24 px-6 bg-surface border-y border-border relative">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-px bg-blue-400"></div>
            <span className="font-mono text-xs uppercase tracking-widest text-blue-400">Diferenciadores</span>
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-textBright mb-16 max-w-2xl leading-tight">
            Por qué Factor·IA y no otro
          </h2>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {motivos.map((m, i) => (
            <ScrollReveal key={i} delay={i * 0.1}>
              <div className="glass-panel p-8 h-full hover:border-blue-400/30 transition-colors group">
                <div className="w-14 h-14 bg-surface3 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {m.icon}
                </div>
                <h3 className="font-display text-xl font-bold text-textBright mb-3">{m.title}</h3>
                <p className="text-textDim text-sm md:text-base leading-relaxed">{m.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};
