import React, { useEffect, useState } from "react";
import { Save, Settings as SettingsIcon, Monitor, Palette, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/Layout";
import { Btn, Card, CardHead, Input, Select, Field, Toggle, PageLoader } from "@/components/kit";

const CURRENCIES = ["MXN", "USD", "EUR", "COP", "ARS", "CLP", "PEN"];
const THEME_DEFAULTS = {
  theme_bg: "#080c14", theme_sidebar: "#0d1420", theme_text: "#b8c5d3", theme_money: "#00e5a0",
  display_bg: "#080c14", display_text: "#e8edf2", display_prep: "#f59e0b", display_ready: "#00e5a0",
};

export default function SettingsPage() {
  const { applyTheme } = useTheme();
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/settings")
      .then(({ data }) => setSettings({ tax_rate: 0.16, tax_included: true, currency: "MXN", restaurant_name: "", ...data }))
      .catch(() => toast.error("No se pudo cargar la configuración"));
  }, []);

  // Live preview of theme changes.
  const setColor = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    applyTheme?.(next);
  };

  const resetColors = () => {
    const next = { ...settings, theme_bg: "", theme_sidebar: "", theme_text: "", theme_money: "" };
    setSettings(next);
    applyTheme?.(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/settings", {
        restaurant_name: settings.restaurant_name,
        currency: settings.currency,
        tax_rate: Number(settings.tax_rate),
        tax_included: settings.tax_included,
        theme_bg: settings.theme_bg || "",
        theme_sidebar: settings.theme_sidebar || "",
        theme_text: settings.theme_text || "",
        theme_money: settings.theme_money || "",
        display_bg: settings.display_bg || "",
        display_text: settings.display_text || "",
        display_prep: settings.display_prep || "",
        display_ready: settings.display_ready || "",
      });
      applyTheme?.(settings);
      toast.success("Configuración guardada");
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <PageLoader />;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Ajustes" subtitle="Configuración general del negocio" />

      <Card>
        <CardHead title="Negocio" subtitle="Nombre, moneda e impuestos" />
        <div className="p-5 space-y-4">
          <Field label="Nombre del restaurante">
            <Input value={settings.restaurant_name} onChange={(e) => setSettings({ ...settings, restaurant_name: e.target.value })} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Moneda">
              <Select value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Tasa de impuesto (IVA %)" hint="Ej. 16 para 16%">
              <Input
                type="number"
                step="0.01"
                value={Math.round(Number(settings.tax_rate) * 10000) / 100}
                onChange={(e) => setSettings({ ...settings, tax_rate: Number(e.target.value) / 100 })}
              />
            </Field>
          </div>

          <div className="bg-surface2 rounded-xl p-4">
            <Toggle
              checked={settings.tax_included}
              onChange={(v) => setSettings({ ...settings, tax_included: v })}
              label="Los precios ya incluyen impuesto"
            />
            <p className="text-xs text-textDim mt-2">
              {settings.tax_included
                ? "El IVA se desglosa a partir del precio de venta."
                : "El IVA se agrega sobre el precio de venta al cobrar."}
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Btn loading={saving} onClick={save}><Save className="h-4 w-4" /> Guardar cambios</Btn>
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHead
          title="Colores (tema)"
          subtitle="Personaliza los colores de la app"
          action={<Btn size="sm" variant="ghost" onClick={resetColors}><RotateCcw className="h-3.5 w-3.5" /> Restablecer</Btn>}
        />
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ColorField label="Fondo" value={settings.theme_bg || THEME_DEFAULTS.theme_bg} onChange={(v) => setColor("theme_bg", v)} />
          <ColorField label="Barra lateral" value={settings.theme_sidebar || THEME_DEFAULTS.theme_sidebar} onChange={(v) => setColor("theme_sidebar", v)} />
          <ColorField label="Letras" value={settings.theme_text || THEME_DEFAULTS.theme_text} onChange={(v) => setColor("theme_text", v)} />
          <ColorField label="Cifras / dinero" value={settings.theme_money || THEME_DEFAULTS.theme_money} onChange={(v) => setColor("theme_money", v)} />
          <p className="sm:col-span-3 text-xs text-textDim flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5" /> Los cambios se ven al instante. Presiona “Guardar cambios” arriba para conservarlos.
          </p>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHead title="Colores de la pantalla de cliente" subtitle="Los colores del tablero público (/pantalla)" />
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ColorField label="Fondo" value={settings.display_bg || THEME_DEFAULTS.display_bg} onChange={(v) => setColor("display_bg", v)} />
          <ColorField label="Letras" value={settings.display_text || THEME_DEFAULTS.display_text} onChange={(v) => setColor("display_text", v)} />
          <ColorField label="En preparación" value={settings.display_prep || THEME_DEFAULTS.display_prep} onChange={(v) => setColor("display_prep", v)} />
          <ColorField label="Listo" value={settings.display_ready || THEME_DEFAULTS.display_ready} onChange={(v) => setColor("display_ready", v)} />
          <p className="sm:col-span-2 lg:col-span-4 text-xs text-textDim">
            Guarda los cambios y abre la <a href={`/pantalla/${user?.tenant_slug}`} target="_blank" rel="noreferrer" className="text-money underline">pantalla de cliente</a> para verlos (se actualiza sola cada minuto).
          </p>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHead title="Pantalla de cliente" subtitle="Tablero público con el estado de las comandas" />
        <div className="p-5">
          <p className="text-sm text-textMain mb-4">
            Abre esta pantalla en un monitor o TV para que los clientes vean el número de su orden y cuándo está lista.
            No requiere iniciar sesión.
          </p>
          <a href={`/pantalla/${user?.tenant_slug}`} target="_blank" rel="noreferrer">
            <Btn variant="secondary"><Monitor className="h-4 w-4" /> Abrir pantalla de cliente</Btn>
          </a>
        </div>
      </Card>

      <div className="flex items-center gap-2 text-textDim text-xs mt-6 justify-center">
        <SettingsIcon className="h-3.5 w-3.5" /> Smokehouse OS · v1.0
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 rounded-lg border border-border bg-surface2 cursor-pointer p-1"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </Field>
  );
}
