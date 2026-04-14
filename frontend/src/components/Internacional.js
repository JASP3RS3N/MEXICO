import React from 'react';
import { ScrollReveal } from './ScrollReveal';
import { Globe2 } from 'lucide-react';

export const Internacional = () => {
  return (
    <section className="py-24 px-6 bg-surface border-y border-border relative">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <ScrollReveal>
            <div className="glass-panel p-10 border border-border hover:border-cyan/30 transition-colors relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Globe2 className="w-40 h-40 text-cyan" />
              </div>
              <h3 className="font-display text-2xl font-bold text-textBright mb-4">Global HQ?</h3>
              <p className="text-textDim text-lg font-mono mb-6">"You're global. Your plant in Mexico needs local AI."</p>
              <a href="mailto:factor.iaops@gmail.com" className="text-cyan font-bold font-mono text-sm hover:underline">Contact our corporate team →</a>
            </div>
          </ScrollReveal>
          
          <ScrollReveal delay={0.1}>
            <div className="glass-panel p-10 border border-border hover:border-blue-400/30 transition-colors relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Globe2 className="w-40 h-40 text-blue-400" />
              </div>
              <h3 className="font-display text-2xl font-bold text-textBright mb-4">Expansión LATAM</h3>
              <p className="text-textDim text-lg font-mono mb-6">Únete a nuestra lista de espera para disponibilidad en el resto de América Latina.</p>
              <a href="mailto:factor.iaops@gmail.com?subject=Waitlist%20LATAM" className="text-blue-400 font-bold font-mono text-sm hover:underline">Unirse a la waitlist →</a>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
};
