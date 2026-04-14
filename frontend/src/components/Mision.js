import React from 'react';
import { ScrollReveal } from './ScrollReveal';

export const Mision = () => {
  const valores = [
    { title: "Soberanía de Datos", desc: "Los datos de nuestros clientes son sagrados. Nunca salen de su infraestructura. La privacidad no es una feature — es un derecho." },
    { title: "Piso de Planta Primero", desc: "Cada decisión se valida con una pregunta: ¿esto le sirve al operador del turno 2 a las 3 de la mañana? Si no, no se construye." },
    { title: "Transparencia Radical", desc: "Precio fijo publicado. Sin costos ocultos por usuario, por token, por API call o por GB. El cliente sabe exactamente lo que paga desde el día uno." },
    { title: "Velocidad sobre Perfección", desc: "Entregamos valor medible en semanas, no en trimestres. Iteramos con el cliente en vivo, no en salas de juntas." },
    { title: "Español Sin Disculpas", desc: "No somos una traducción de una plataforma gringa. Somos nativos. Nuestra IA piensa, responde y reporta en el idioma de la manufactura mexicana." },
    { title: "Conocimiento Compartido", desc: "El expertise de piso de planta no se guarda — se multiplica. Cada implementación alimenta mejores prácticas que benefician a todo el ecosistema." }
  ];

  return (
    <section className="py-24 px-6 bg-background relative overflow-hidden">
      <div className="max-w-4xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-20">
            <h2 className="font-display text-3xl md:text-5xl font-bold text-textBright mb-8 leading-tight">
              "No somos una empresa de tecnología que descubrió la manufactura. <span className="bg-grad-main text-transparent bg-clip-text">Somos manufactura que domina la tecnología.</span>"
            </h2>
          </div>
        </ScrollReveal>

        <div className="space-y-16">
          <ScrollReveal>
            <div className="glass-panel p-10 border-l-4 border-l-cyan">
              <h3 className="font-mono text-sm uppercase tracking-widest text-cyan mb-4">Misión — Lo que hacemos hoy</h3>
              <p className="text-textBright text-lg md:text-xl leading-relaxed">
                "Democratizar la inteligencia artificial industrial para la manufactura en México, entregando tecnología de clase mundial con infraestructura privada, en español, a un precio justo — para que cada planta, sin importar su tamaño, tome decisiones basadas en datos en tiempo real y no en intuición o papel."
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="glass-panel p-10 border-l-4 border-l-blue-400">
              <h3 className="font-mono text-sm uppercase tracking-widest text-blue-400 mb-4">Visión — Lo que construimos para 2030</h3>
              <p className="text-textBright text-lg md:text-xl leading-relaxed">
                "Ser la plataforma de IA industrial de referencia en Latinoamérica para 2030, reconocida por haber transformado la operación de más de 100 plantas manufactureras con tecnología soberana, privada y accesible — demostrando que la innovación no necesita nube pública ni presupuestos de Fortune 500."
              </p>
            </div>
          </ScrollReveal>
        </div>

        <div className="mt-24">
          <ScrollReveal>
            <div className="flex items-center gap-4 mb-10 justify-center">
              <div className="w-12 h-px bg-purple-400"></div>
              <span className="font-mono text-xs uppercase tracking-widest text-purple-400">6 Valores</span>
              <div className="w-12 h-px bg-purple-400"></div>
            </div>
          </ScrollReveal>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {valores.map((v, i) => (
              <ScrollReveal key={i} delay={i * 0.05}>
                <div className="p-6 rounded-xl bg-surface2 border border-border hover:border-purple-400/30 transition-colors h-full">
                  <h4 className="font-display font-bold text-textBright text-xl mb-3">{v.title}</h4>
                  <p className="text-textDim leading-relaxed">{v.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
