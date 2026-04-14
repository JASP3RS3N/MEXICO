import React, { useState } from 'react';
import { ScrollReveal } from './ScrollReveal';
import { ChevronDown, ChevronUp, Layers, Box, Truck, FileText, Settings, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Servicios = () => {
  const [open, setOpen] = useState(0);

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
          <h2 className="font-display text-3xl md:text-5xl font-bold text-textBright mb-16 leading-tight">
            Todo lo que necesitas, <span className="text-cyan">en un solo lugar</span>
          </h2>
        </ScrollReveal>

        <div className="space-y-4">
          {categorias.map((cat, i) => (
            <ScrollReveal key={i} delay={i * 0.05}>
              <div className="glass-panel border border-border rounded-xl overflow-hidden">
                <button 
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 hover:bg-surface3 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-surface3 p-3 rounded-xl">{cat.icon}</div>
                    <h3 className="font-display font-bold text-textBright text-xl md:text-2xl">{cat.titulo}</h3>
                  </div>
                  {open === i ? <ChevronUp className="text-textDim" /> : <ChevronDown className="text-textDim" />}
                </button>
                <AnimatePresence>
                  {open === i && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border overflow-hidden"
                    >
                      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {cat.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-cyan/50"></span>
                            <span className="font-mono text-sm text-textMain">{item}</span>
                          </div>
                        ))}
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
