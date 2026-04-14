import React from 'react';
import { motion } from 'framer-motion';
import { ScrollReveal } from './ScrollReveal';

import CountUp from './CountUp';

export const Hero = () => {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-16 overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[800px] h-[500px] bg-cyan/5 rounded-full blur-[100px] transform -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-blue/5 rounded-full blur-[120px] transform translate-x-1/2 translate-y-1/2"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="font-mono text-xs uppercase tracking-widest text-cyan bg-cyan-dim border border-cyan/20 px-4 py-2 rounded-full mb-8 flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-cyan animate-pulse"></span>
          Corredor Industrial Saltillo — Monterrey
        </motion.div>

        <ScrollReveal yOffset={20}>
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-textBright leading-[1.1] mb-6">
            Tu OEM te va a auditar. <br className="hidden md:block"/>
            <span className="bg-grad-main text-transparent bg-clip-text">Con Factor·IA, ya cumples.</span>
          </h1>
        </ScrollReveal>

        <ScrollReveal yOffset={20} delay={0.1}>
          <p className="text-lg md:text-xl text-textDim max-w-2xl mx-auto mb-10 leading-relaxed">
            Plataforma de IA privada que automatiza cumplimiento IATF 16949, trazabilidad documental y compliance para proveedores automotrices. Sin nube pública. 100% en español. NDA desde el Día 1.
          </p>
        </ScrollReveal>

        <ScrollReveal yOffset={20} delay={0.2} className="flex flex-col sm:flex-row gap-4 mb-16 w-full justify-center">
          <a href="#contacto" className="font-mono text-sm uppercase tracking-widest font-bold bg-grad-main text-background px-8 py-4 rounded-lg hover:opacity-90 transition-all transform hover:-translate-y-1 shadow-[0_0_20px_rgba(0,229,160,0.3)]">
            Agenda tu Diagnóstico Gratuito →
          </a>
          <a href="#servicios" className="font-mono text-sm uppercase tracking-widest font-bold text-textBright bg-surface2 border border-border px-8 py-4 rounded-lg hover:bg-border transition-all">
            Ver Servicios ↓
          </a>
        </ScrollReveal>

        <ScrollReveal yOffset={20} delay={0.3} className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-3xl pt-8 border-t border-border">
          <div className="flex flex-col items-center">
            <span className="font-mono text-3xl md:text-4xl font-bold text-textBright mb-1"><CountUp end={20} /></span>
            <span className="text-xs md:text-sm text-textDim font-mono uppercase tracking-wider">Servicios IA</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-mono text-3xl md:text-4xl font-bold text-textBright mb-1"><CountUp end={0} /></span>
            <span className="text-xs md:text-sm text-textDim font-mono uppercase tracking-wider">Nube Pública</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-mono text-3xl md:text-4xl font-bold text-textBright mb-1"><CountUp end={100} suffix="%" /></span>
            <span className="text-xs md:text-sm text-textDim font-mono uppercase tracking-wider">Español</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-mono text-3xl md:text-4xl font-bold text-textBright mb-1">Sí</span>
            <span className="text-xs md:text-sm text-textDim font-mono uppercase tracking-wider">NDA Firmado</span>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};
