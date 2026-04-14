import React, { useState, useEffect } from 'react';
import { Menu, X, Store } from 'lucide-react';

export const TopNav = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const links = [
    { label: "Problema", href: "#problema" },
    { label: "Garantías", href: "#garantias" },
    { label: "Por Qué", href: "#porque" },
    { label: "Servicios", href: "#servicios" },
    { label: "Precios", href: "#precios" },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-background/90 backdrop-blur-md border-b border-border py-3' : 'bg-transparent py-5'}`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <a href="#" className="font-mono text-xl font-bold text-textBright flex items-center gap-2">
          <span>Factor<span className="text-cyan">·IA</span></span>
        </a>
        
        {/* Desktop Nav */}
        <div className="hidden md:flex items-center space-x-4 lg:space-x-6">
          {links.map(link => (
            <a key={link.href} href={link.href} className="font-mono text-xs uppercase tracking-widest text-textDim hover:text-cyan hover:bg-cyan-dim px-3 py-2 rounded-md transition-colors">
              {link.label}
            </a>
          ))}
          
          <div className="w-px h-4 bg-border mx-2"></div>
          
          <a href="iatipsmx-canal1.html" className="font-mono text-xs font-bold text-[#C8F047] flex items-center gap-2 border border-[#C8F047]/20 bg-[#C8F047]/5 px-3 py-2 rounded-lg hover:bg-[#C8F047]/10 transition-colors">
            <Store size={14} />
            IAtipsMX — Negocios Locales
          </a>
          
          <a href="#contacto" className="font-mono text-xs uppercase tracking-widest font-bold bg-grad-main text-background px-4 py-2 rounded-md hover:opacity-90 transition-opacity ml-2">
            Diagnóstico →
          </a>
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-textMain p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-surface2 border-b border-border shadow-xl overflow-hidden">
          <div className="flex flex-col px-6 py-4 space-y-4">
            {links.map(link => (
              <a key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="font-mono text-sm uppercase tracking-widest text-textDim hover:text-cyan transition-colors">
                {link.label}
              </a>
            ))}
            
            <div className="w-full h-px bg-border my-2"></div>
            
            <a href="iatipsmx-canal1.html" onClick={() => setMobileOpen(false)} className="font-mono text-sm font-bold text-[#C8F047] flex items-center gap-2 py-2">
              <Store size={16} />
              IAtipsMX — Negocios Locales
            </a>
            
            <a href="#contacto" onClick={() => setMobileOpen(false)} className="font-mono text-sm uppercase tracking-widest font-bold text-cyan mt-4 pt-4 border-t border-border">
              Diagnóstico Gratuito →
            </a>
          </div>
        </div>
      )}
    </nav>
  );
};
