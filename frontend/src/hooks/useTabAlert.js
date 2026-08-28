import { useEffect, useRef } from "react";

// Aviso en la pestaña del navegador cuando hay solicitudes atrasadas.
//
// El tablero de almacén casi siempre está en segundo plano (la tablet tiene
// otra cosa al frente), así que la alerta tiene que salirse de la página:
// el título parpadea y el favicon se repinta con el contador en rojo.
//
// Todo se restaura al desmontar o cuando el contador vuelve a cero.

const FLASH_INTERVAL_MS = 1200;

/** Dibuja un favicon con el contador en rojo. Null si el canvas no está disponible. */
function drawBadgeFavicon(count) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Más de 9 no cabe legible en 64px; se corta a "9+".
    ctx.fillText(count > 9 ? "9+" : String(count), 32, 36);

    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function setFavicon(href) {
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href;
}

/**
 * @param {number} count   Solicitudes en rojo. 0 = todo tranquilo.
 * @param {string} baseTitle  Título normal de la pestaña.
 */
export default function useTabAlert(count, baseTitle = "Almacén · Smokehouse OS") {
  // El favicon y el título originales se guardan una sola vez, al montar, para
  // poder devolverlos exactamente como estaban.
  const originalRef = useRef(null);

  useEffect(() => {
    if (originalRef.current === null) {
      const link = document.querySelector("link[rel='icon']");
      originalRef.current = { title: document.title, favicon: link ? link.href : null };
    }
    const original = originalRef.current;

    const restore = () => {
      document.title = baseTitle;
      if (original.favicon) setFavicon(original.favicon);
    };

    if (!count || count <= 0) {
      restore();
      return undefined;
    }

    const badge = drawBadgeFavicon(count);
    if (badge) setFavicon(badge);

    const alertTitle = `(${count}) ⚠ Solicitudes atrasadas`;
    let showingAlert = false;
    document.title = alertTitle;

    const timer = setInterval(() => {
      showingAlert = !showingAlert;
      document.title = showingAlert ? alertTitle : baseTitle;
    }, FLASH_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      restore();
    };
  }, [count, baseTitle]);
}
