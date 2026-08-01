import React, { createContext, useCallback, useContext, useEffect } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const ThemeContext = createContext(null);

// --- color helpers ---
const hexToRgb = (hex) => {
  if (!hex) return null;
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const triplet = (rgb) => `${rgb[0]} ${rgb[1]} ${rgb[2]}`;
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const lighten = (rgb, t) => mix(rgb, [255, 255, 255], t);

const VARS = ["--c-bg", "--c-surface", "--c-surface2", "--c-surface3", "--c-sidebar", "--c-border", "--c-borderhover", "--c-textmain", "--c-textbright", "--c-textdim"];

export function ThemeProvider({ children }) {
  const { user } = useAuth();

  const applyTheme = useCallback((settings) => {
    const root = document.documentElement;
    // Reset to CSS defaults first.
    VARS.forEach((v) => root.style.removeProperty(v));
    if (!settings) return;

    const bg = hexToRgb(settings.theme_bg);
    const sidebar = hexToRgb(settings.theme_sidebar);
    const text = hexToRgb(settings.theme_text);

    if (bg) {
      root.style.setProperty("--c-bg", triplet(bg));
      root.style.setProperty("--c-surface", triplet(lighten(bg, 0.06)));
      root.style.setProperty("--c-surface2", triplet(lighten(bg, 0.1)));
      root.style.setProperty("--c-surface3", triplet(lighten(bg, 0.16)));
      root.style.setProperty("--c-border", triplet(lighten(bg, 0.24)));
      root.style.setProperty("--c-borderhover", triplet(lighten(bg, 0.34)));
      root.style.setProperty("--c-sidebar", triplet(lighten(bg, 0.05)));
    }
    if (sidebar) root.style.setProperty("--c-sidebar", triplet(sidebar));
    if (text) {
      const base = bg || [8, 12, 20];
      root.style.setProperty("--c-textmain", triplet(text));
      root.style.setProperty("--c-textbright", triplet(lighten(text, 0.2)));
      root.style.setProperty("--c-textdim", triplet(mix(text, base, 0.5)));
    }
  }, []);

  useEffect(() => {
    if (!user) {
      applyTheme(null);
      return;
    }
    api.get("/settings").then(({ data }) => applyTheme(data)).catch(() => {});
  }, [user, applyTheme]);

  return <ThemeContext.Provider value={{ applyTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
