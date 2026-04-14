import React from 'react';
import { TopNav } from './components/TopNav';
import { Hero } from './components/Hero';
import { Problema } from './components/Problema';
import { Garantias } from './components/Garantias';
import { Porque } from './components/Porque';
import { Mision } from './components/Mision';
import { Servicios } from './components/Servicios';
import { Contacto } from './components/Contacto';
import { Internacional } from './components/Internacional';
import { Footer } from './components/Footer';

function App() {
  return (
    <div className="bg-background min-h-screen text-textMain selection:bg-cyan/25 selection:text-white">
      <TopNav />
      <main>
        <Hero />
        <Problema />
        <Garantias />
        <Porque />
        <Mision />
        <Servicios />
        <Contacto />
        <Internacional />
      </main>
      <Footer />
    </div>
  );
}

export default App;
