import React from 'react';
import { motion } from 'framer-motion';
import { ScrollReveal } from './ScrollReveal';
import CountUp from './CountUp';

export const Hero = () => {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-16 overflow-hidden">
      {/* Background gradients and particles */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.05, 1],
            opacity: [0.3, 0.4, 0.3],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[10%] left-[20%] w-[600px] h-[600px] bg-cyan/10 rounded-full blur-[120px]"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-[10%] right-[15%] w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[150px]"
        />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="font-mono text-xs uppercase tracking-widest text-cyan bg-cyan-dim border border-cyan/20 px-4 py-2 rounded-full mb-8 flex items-center gap-2 shadow-[0_0_15px_rgba(0,229,160,0.15)]"
        >
          <span className="w-2 h-2 rounded-full bg-cyan animate-pulse"></span>
          Corredor Industrial Saltillo — Monterrey
        </motion.div>

        <ScrollReveal yOffset={30}>
          <h1 className="font-display text-4xl md:text-6xl lg:text-[4.5rem] font-bold text-textBright leading-[1.1] mb-6 tracking-tight">
            Tu OEM te va a auditar. <br className="hidden md:block"/>
            <span className="bg-grad-main text-transparent bg-clip-text relative inline-block">
              Con Factor·IA, ya cumples.
              <motion.span 
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
                className="absolute inset-0 bg-background"
              />
            </span>
          </h1>
        </ScrollReveal>

        <ScrollReveal yOffset={20} delay={0.2}>
          <p className="text-lg md:text-xl text-textDim max-w-2xl mx-auto mb-10 leading-relaxed">
            Plataforma de IA privada que automatiza cumplimiento IATF 16949, trazabilidad documental y compliance para proveedores automotrices. Sin nube pública. 100% en español. NDA desde el Día 1.
          </p>
        </ScrollReveal>

        <ScrollReveal yOffset={20} delay={0.3} className="flex flex-col sm:flex-row gap-4 mb-16 w-full justify-center">
          <a href="#contacto" className="font-mono text-sm uppercase tracking-widest font-bold bg-grad-main text-background px-8 py-4 rounded-lg hover:opacity-90 transition-all transform hover:-translate-y-1 shadow-[0_0_20px_rgba(0,229,160,0.25)] hover:shadow-[0_0_30px_rgba(0,229,160,0.4)]">
            Agenda tu Diagnóstico Gratuito →
          </a>
          <a href="#servicios" className="font-mono text-sm uppercase tracking-widest font-bold text-textBright bg-surface2 border border-border px-8 py-4 rounded-lg hover:bg-surface3 hover:border-cyan/30 transition-all">
            Ver Servicios ↓
          </a>
        </ScrollReveal>

        <ScrollReveal yOffset={20} delay={0.4} className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full max-w-4xl pt-10 border-t border-border relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-cyan to-transparent"></div>
          
          <div className="flex flex-col items-center group">
            <span className="font-mono text-4xl md:text-5xl font-bold text-textBright mb-2 group-hover:text-cyan transition-colors"><CountUp end={20} /></span>
            <span className="text-xs md:text-sm text-textDim font-mono uppercase tracking-wider">Servicios IA</span>
          </div>
          <div className="flex flex-col items-center group">
            <span className="font-mono text-4xl md:text-5xl font-bold text-textBright mb-2 group-hover:text-cyan transition-colors"><CountUp end={0} /></span>
            <span className="text-xs md:text-sm text-textDim font-mono uppercase tracking-wider">Nube Pública</span>
          </div>
          <div className="flex flex-col items-center group">
            <span className="font-mono text-4xl md:text-5xl font-bold text-textBright mb-2 group-hover:text-cyan transition-colors"><CountUp end={100} suffix="%" /></span>
            <span className="text-xs md:text-sm text-textDim font-mono uppercase tracking-wider">Español</span>
          </div>
          <div className="flex flex-col items-center group">
            <span className="font-mono text-4xl md:text-5xl font-bold text-textBright mb-2 group-hover:text-cyan transition-colors">Sí</span>
            <span className="text-xs md:text-sm text-textDim font-mono uppercase tracking-wider">NDA Firmado</span>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};
