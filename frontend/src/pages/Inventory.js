import React, { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Boxes, AlertTriangle, PackagePlus, PackageMinus } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Btn, Card, Input, Select, Field, Modal, EmptyState, PageLoader, Toggle, Stat } from "@/components/kit";
import { money, num } from "@/lib/format";

const UNITS = ["kg", "g", "lt", "ml", "pza", "caja", "paquete", "bolsa"];
const emptyMat = { sku: "", name: "", unit: "kg", category: "General", cost_per_unit: "", current_stock: "", min_stock: "", par_stock: "", min_order: "", supplier: "", active: true };

export default function Inventory() {
  const [materials, setMaterials] = useState([]);
  const [currency, setCurrency] = useState("MXN");
  const [loading, setLoading] = useState(true);
  const [onlyLow, setOnlyLow] = useState(false);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [adjust, setAdjust] = useState(null); // {material, qty, reason}

  const load = async () => {
    try {
      const [m, s] = await Promise.all([api.get("/materials"), api.get("/settings")]);
      setMaterials(m.data);
      if (s.data?.currency) setCurrency(s.data.currency);
    } catch {
      toast.error("No se pudo cargar el inventario");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLow = (m) => Number(m.current_stock) <= Number(m.min_stock);
  const shown = useMemo(() => (onlyLow ? materials.filter(isLow) : materials), [materials, onlyLow]);
  const totalValue = materials.reduce((s, m) => s + Number(m.current_stock) * Number(m.cost_per_unit), 0);
  const lowCount = materials.filter(isLow).length;

  const save = async () => {
    if (!modal.name) return toast.error("El nombre es obligatorio");
    setSaving(true);
    const body = {
      sku: modal.sku,
      name: modal.name,
      unit: modal.unit,
      category: modal.category,
      supplier: modal.supplier,
      active: modal.active,
      cost_per_unit: Number(modal.cost_per_unit || 0),
      current_stock: Number(modal.current_stock || 0),
      min_stock: Number(modal.min_stock || 0),
      par_stock: Number(modal.par_stock || 0),
      min_order: Number(modal.min_order || 0),
    };
    try {
      if (modal.id) await api.put(`/materials/${modal.id}`, body);
      else await api.post("/materials", body);
      toast.success("Materia prima guardada");
      setModal(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("¿Eliminar esta materia prima?")) return;
    await api.delete(`/materials/${id}`);
    toast.success("Eliminada");
    load();
  };

  const doAdjust = async () => {
    const qty = Number(adjust.qty);
    if (!qty) return toast.error("Ingresa una cantidad distinta de cero");
    try {
      await api.post(`/materials/${adjust.material.id}/adjust`, { qty, reason: adjust.reason || "Ajuste manual" });
      toast.success("Stock ajustado");
      setAdjust(null);
      load();
    } catch {
      toast.error("No se pudo ajustar");
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Inventario · Materia prima"
        subtitle="Data maestra, existencias y costos"
        actions={<Btn onClick={() => setModal({ ...emptyMat })}><Plus className="h-4 w-4" /> Nueva materia prima</Btn>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Stat label="Valor de inventario" value={money(totalValue, currency)} icon={Boxes} accent="purple" />
        <Stat label="Insumos registrados" value={num(materials.length)} icon={PackagePlus} accent="blue" />
        <Stat label="En bajo stock" value={num(lowCount)} icon={AlertTriangle} accent={lowCount ? "red" : "green"} />
      </div>

      <div className="flex items-center justify-between mb-4">
        <Toggle checked={onlyLow} onChange={setOnlyLow} label="Mostrar solo bajo stock" />
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={Boxes} title="Sin materia prima" subtitle="Registra tus insumos con su data maestra." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-textDim border-b border-border">
                  <th className="px-4 py-3 font-medium">Insumo</th>
                  <th className="px-4 py-3 font-medium">Categoría</th>
                  <th className="px-4 py-3 font-medium text-right">Existencia</th>
                  <th className="px-4 py-3 font-medium text-right">Mín / Par</th>
                  <th className="px-4 py-3 font-medium text-right">Costo</th>
                  <th className="px-4 py-3 font-medium text-right">Valor</th>
                  <th className="px-4 py-3 font-medium">Proveedor</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => (
                  <tr key={m.id} className={`border-b border-border/60 hover:bg-surface2/50 ${isLow(m) ? "bg-red-500/5" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="text-textBright font-medium">{m.name}</p>
                      {m.sku && <p className="text-xs text-textDim">SKU: {m.sku}</p>}
                    </td>
                    <td className="px-4 py-3 text-textMain">{m.category}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={isLow(m) ? "text-red-400 font-semibold" : "text-textBright"}>
                        {num(m.current_stock, 2)} {m.unit}
                      </span>
                      {isLow(m) && <AlertTriangle className="inline h-3.5 w-3.5 text-red-400 ml-1" />}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-textDim">{num(m.min_stock, 0)} / {num(m.par_stock, 0)}</td>
                    <td className="px-4 py-3 text-right font-mono text-money">{money(m.cost_per_unit, currency)}</td>
                    <td className="px-4 py-3 text-right font-mono text-money">{money(Number(m.current_stock) * Number(m.cost_per_unit), currency)}</td>
                    <td className="px-4 py-3 text-textMain truncate max-w-[140px]">{m.supplier || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setAdjust({ material: m, qty: "", reason: "" })} title="Ajustar stock" className="text-textDim hover:text-cyan p-1.5"><PackageMinus className="h-4 w-4" /></button>
                        <button onClick={() => setModal({ ...emptyMat, ...m, cost_per_unit: String(m.cost_per_unit), current_stock: String(m.current_stock), min_stock: String(m.min_stock), par_stock: String(m.par_stock), min_order: String(m.min_order ?? "") })} className="text-textDim hover:text-amber-400 p-1.5"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(m.id)} className="text-textDim hover:text-red-400 p-1.5"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Material modal */}
      <Modal
        open={!!modal}
        onClose={() => !saving && setModal(null)}
        title={modal?.id ? "Editar materia prima" : "Nueva materia prima"}
        size="lg"
        footer={<><Btn variant="ghost" onClick={() => setModal(null)} disabled={saving}>Cancelar</Btn><Btn loading={saving} onClick={save}>Guardar</Btn></>}
      >
        {modal && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre" className="sm:col-span-2"><Input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} /></Field>
            <Field label="SKU / Código"><Input value={modal.sku} onChange={(e) => setModal({ ...modal, sku: e.target.value })} /></Field>
            <Field label="Categoría"><Input value={modal.category} onChange={(e) => setModal({ ...modal, category: e.target.value })} /></Field>
            <Field label="Unidad de medida">
              <Select value={modal.unit} onChange={(e) => setModal({ ...modal, unit: e.target.value })}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
            </Field>
            <Field label="Costo por unidad"><Input type="number" step="0.01" value={modal.cost_per_unit} onChange={(e) => setModal({ ...modal, cost_per_unit: e.target.value })} /></Field>
            <Field label="Existencia actual" hint={modal.id ? "Usa 'ajustar' para movimientos" : undefined}><Input type="number" step="0.001" value={modal.current_stock} onChange={(e) => setModal({ ...modal, current_stock: e.target.value })} /></Field>
            <Field label="Stock mínimo (alerta)"><Input type="number" step="0.001" value={modal.min_stock} onChange={(e) => setModal({ ...modal, min_stock: e.target.value })} /></Field>
            <Field label="Stock par (objetivo)"><Input type="number" step="0.001" value={modal.par_stock} onChange={(e) => setModal({ ...modal, par_stock: e.target.value })} /></Field>
            <Field label="Mínimo de compra (MOQ)" hint="Cantidad mínima al generar una orden de compra"><Input type="number" step="0.001" value={modal.min_order} onChange={(e) => setModal({ ...modal, min_order: e.target.value })} /></Field>
            <Field label="Proveedor"><Input value={modal.supplier} onChange={(e) => setModal({ ...modal, supplier: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Toggle checked={modal.active} onChange={(v) => setModal({ ...modal, active: v })} label="Activo" /></div>
          </div>
        )}
      </Modal>

      {/* Adjust modal */}
      <Modal
        open={!!adjust}
        onClose={() => setAdjust(null)}
        title={`Ajustar stock · ${adjust?.material?.name ?? ""}`}
        footer={<><Btn variant="ghost" onClick={() => setAdjust(null)}>Cancelar</Btn><Btn onClick={doAdjust}>Aplicar</Btn></>}
      >
        {adjust && (
          <div className="space-y-4">
            <p className="text-sm text-textDim">
              Existencia actual: <span className="font-mono text-textBright">{num(adjust.material.current_stock, 2)} {adjust.material.unit}</span>
            </p>
            <Field label="Cantidad (+ entra / − sale)" hint="Ej. 5 para agregar, -2 para descontar merma">
              <Input type="number" step="0.001" value={adjust.qty} onChange={(e) => setAdjust({ ...adjust, qty: e.target.value })} />
            </Field>
            <Field label="Motivo"><Input value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} placeholder="Merma, conteo físico, etc." /></Field>
            <div className="flex gap-2">
              <Btn variant="secondary" className="flex-1" onClick={() => setAdjust({ ...adjust, qty: String(Math.abs(Number(adjust.qty || 0)) || 1) })}><PackagePlus className="h-4 w-4" /> Entrada</Btn>
              <Btn variant="secondary" className="flex-1" onClick={() => setAdjust({ ...adjust, qty: String(-(Math.abs(Number(adjust.qty || 0)) || 1)) })}><PackageMinus className="h-4 w-4" /> Salida</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
