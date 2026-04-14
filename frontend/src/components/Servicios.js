import React, { useState } from 'react';
import { ScrollReveal } from './ScrollReveal';
import { ChevronDown, ChevronUp, Layers, Box, Truck, FileText, Settings, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Servicios = () => {
  const [openIndex, setOpenIndex] = useState(0);

  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? -1 : index);
  };

  const categorias = [
    {
      icon: <Layers className="w-6 h-6 text-cyan" />,
      titulo: "Calidad & Mejora Continua",
      items: ["LPA Digital", "8D/Kaizen AI", "Traducción Técnica IATF"]
    },
    {
      icon: <Box className="w-6 h-6 text-blue-400" />,
      titulo: "Producción & Planeación",
      items: ["Planeación de Producción", "Smoothing MRP", "Dashboard Multi-Planta"]
    },
    {
      icon: <Truck className="w-6 h-6 text-purple-400" />,
      titulo: "Cadena de Suministro",
      items: ["Riesgo de Proveedores MRP", "Comparador de Cotizaciones", "Inventario Inteligente"]
    },
    {
      icon: <FileText className="w-6 h-6 text-amber-400" />,
      titulo: "Documentación & Conocimiento",
      items: ["SOPs con IA", "Generador de Descripciones de Puesto", "Onboarding Digital"]
    },
    {
      icon: <Settings className="w-6 h-6 text-red-400" />,
      titulo: "Ingeniería & Cambios",
      items: ["ECM/ECN Automatizado", "AMEF Digital", "Validación de Proceso"]
    },
    {
      icon: <Activity className="w-6 h-6 text-emerald-400" />,
      titulo: "IoT & Monitoreo",
      items: ["Gateway ESP32", "Sensores AI", "Dashboard Tiempo Real"]
    }
  ];

  return (
    <section id="servicios" className="py-24 px-6 bg-surface border-y border-border relative">
      <div className="max-w-5xl mx-auto">
        <ScrollReveal>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-px bg-cyan"></div>
            <span className="font-mono text-xs uppercase tracking-widest text-cyan">20 Servicios IA</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <h2 className="font-display text-3xl md:text-5xl font-bold text-textBright leading-tight max-w-2xl">
              Todo lo que necesitas, <span className="text-cyan">en un solo lugar</span>
            </h2>
            <button 
              onClick={() => setOpenIndex(openIndex === -1 ? 0 : -1)}
              className="font-mono text-xs uppercase tracking-widest text-textDim hover:text-cyan transition-colors"
            >
              {openIndex === -1 ? "Expandir Primero" : "Colapsar Todo"}
            </button>
          </div>
        </ScrollReveal>

        <div className="space-y-4">
          {categorias.map((cat, index) => (
            <ScrollReveal key={index} delay={index * 0.05}>
              <div className={`glass-panel border rounded-xl overflow-hidden transition-colors ${openIndex === index ? 'border-cyan/30 bg-surface3/50' : 'border-border'}`}>
                <button 
                  onClick={() => toggleAccordion(index)}
                  className="w-full flex items-center justify-between p-6 hover:bg-surface3 transition-colors text-left"
                >
                  <div className="flex items-center gap-5">
                    <div className={`p-3 rounded-xl transition-colors ${openIndex === index ? 'bg-background' : 'bg-surface3'}`}>
                      {cat.icon}
                    </div>
                    <h3 className="font-display font-bold text-textBright text-xl md:text-2xl">{cat.titulo}</h3>
                  </div>
                  {openIndex === index ? <ChevronUp className="text-cyan w-6 h-6" /> : <ChevronDown className="text-textDim w-6 h-6" />}
                </button>
                <AnimatePresence initial={false}>
                  {openIndex === index && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="border-t border-border/50">
                        <div className="p-6 pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                          {cat.items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan/50 shrink-0"></span>
                              <span className="font-mono text-sm md:text-base text-textMain">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};
