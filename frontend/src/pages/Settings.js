import React, { useEffect, useState } from "react";
import { Save, Settings as SettingsIcon, Monitor } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Btn, Card, CardHead, Input, Select, Field, Toggle, PageLoader } from "@/components/kit";

const CURRENCIES = ["MXN", "USD", "EUR", "COP", "ARS", "CLP", "PEN"];

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/settings")
      .then(({ data }) => setSettings({ tax_rate: 0.16, tax_included: true, currency: "MXN", restaurant_name: "", ...data }))
      .catch(() => toast.error("No se pudo cargar la configuración"));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/settings", {
        restaurant_name: settings.restaurant_name,
        currency: settings.currency,
        tax_rate: Number(settings.tax_rate),
        tax_included: settings.tax_included,
      });
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
        <CardHead title="Pantalla de cliente" subtitle="Tablero público con el estado de las comandas" />
        <div className="p-5">
          <p className="text-sm text-textMain mb-4">
            Abre esta pantalla en un monitor o TV para que los clientes vean el número de su orden y cuándo está lista.
            No requiere iniciar sesión.
          </p>
          <a href="/pantalla" target="_blank" rel="noreferrer">
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
