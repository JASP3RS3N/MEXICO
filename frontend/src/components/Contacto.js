import React from 'react';
import { ScrollReveal } from './ScrollReveal';
import { Mail, Phone, Globe, MapPin } from 'lucide-react';

export const Contacto = () => {
  return (
    <section id="contacto" className="py-24 px-6 bg-background relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <ScrollReveal>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-px bg-cyan"></div>
                <span className="font-mono text-xs uppercase tracking-widest text-cyan">Contacto</span>
              </div>
              <h2 className="font-display text-3xl md:text-5xl font-bold text-textBright mb-8 leading-tight">
                ¿Listo para automatizar el cumplimiento en tu planta?
              </h2>
            </ScrollReveal>
            
            <ScrollReveal delay={0.1}>
              <div className="space-y-6 mt-10">
                <a href="mailto:factor.iaops@gmail.com" className="flex items-center gap-4 text-textMain hover:text-cyan transition-colors font-mono group">
                  <div className="bg-surface2 p-4 rounded-xl group-hover:bg-cyan-dim border border-border group-hover:border-cyan/30 transition-all">
                    <Mail className="w-6 h-6" />
                  </div>
                  <span className="text-lg">factor.iaops@gmail.com</span>
                </a>
                <a href="tel:+528441024484" className="flex items-center gap-4 text-textMain hover:text-cyan transition-colors font-mono group">
                  <div className="bg-surface2 p-4 rounded-xl group-hover:bg-cyan-dim border border-border group-hover:border-cyan/30 transition-all">
                    <Phone className="w-6 h-6" />
                  </div>
                  <span className="text-lg">+52 (844) 102 4484</span>
                </a>
                <a href="https://www.factorai.mx" target="_blank" rel="noreferrer" className="flex items-center gap-4 text-textMain hover:text-cyan transition-colors font-mono group">
                  <div className="bg-surface2 p-4 rounded-xl group-hover:bg-cyan-dim border border-border group-hover:border-cyan/30 transition-all">
                    <Globe className="w-6 h-6" />
                  </div>
                  <span className="text-lg">www.factorai.mx</span>
                </a>
                <div className="flex items-center gap-4 text-textMain font-mono">
                  <div className="bg-surface2 p-4 rounded-xl border border-border">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <span className="text-lg">Corredor Industrial Saltillo – Monterrey</span>
                </div>
              </div>
            </ScrollReveal>
          </div>
          
          <ScrollReveal delay={0.2}>
            <div className="glass-panel p-10 flex flex-col items-center justify-center text-center relative overflow-hidden">
              {/* Gradient bg */}
              <div className="absolute inset-0 bg-grad-main opacity-5 pointer-events-none"></div>
              
              <h3 className="font-display text-2xl font-bold text-textBright mb-4">Empieza Hoy Mismo</h3>
              <p className="text-textDim mb-10">Agenda un diagnóstico sin costo y descubre cómo Factor·IA puede blindar tu cumplimiento IATF en semanas.</p>
              
              <div className="flex flex-col gap-4 w-full max-w-sm">
                <a href="mailto:factor.iaops@gmail.com" className="w-full text-center font-mono text-sm uppercase tracking-widest font-bold bg-grad-main text-background px-8 py-4 rounded-lg hover:opacity-90 transition-all shadow-[0_0_20px_rgba(0,229,160,0.3)]">
                  Agenda tu Diagnóstico Gratuito
                </a>
                <a href="tel:+528441024484" className="w-full text-center font-mono text-sm uppercase tracking-widest font-bold text-textBright bg-surface2 border border-border px-8 py-4 rounded-lg hover:bg-border transition-all">
                  Llamar Ahora
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
};
