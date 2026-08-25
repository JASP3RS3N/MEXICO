import React, { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Boxes, AlertTriangle, PackagePlus, PackageMinus } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Btn, Card, Input, Select, Field, Modal, EmptyState, PageLoader, Toggle, Stat } from "@/components/kit";
import { money, num } from "@/lib/format";

const UNITS = ["kg", "g", "lt", "ml", "pza", "caja", "paquete", "bolsa"];
const emptyMat = { sku: "", name: "", unit: "kg", category: "General", cost_per_unit: "", current_stock: "", min_stock: "", par_stock: "", min_order: "", active: true };
const emptyOffering = { supplier_id: "", cost_per_unit: "", min_order: "", lead_time_days: "3" };

export default function Inventory() {
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [currency, setCurrency] = useState("MXN");
  const [loading, setLoading] = useState(true);
  const [onlyLow, setOnlyLow] = useState(false);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [adjust, setAdjust] = useState(null); // {material, qty, reason}

  // Proveedores de este insumo (offerings), scoped to whichever material is
  // open in the edit modal — see the useEffect below that (re)loads them.
  const [offerings, setOfferings] = useState([]);
  const [offeringsLoading, setOfferingsLoading] = useState(false);
  const [newOffering, setNewOffering] = useState(emptyOffering);

  const load = async () => {
    try {
      const [m, s, sup] = await Promise.all([api.get("/materials"), api.get("/settings"), api.get("/suppliers")]);
      setMaterials(m.data);
      setSuppliers((sup.data || []).filter((x) => x.active !== false));
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

  const loadOfferings = async (materialId) => {
    setOfferingsLoading(true);
    try {
      const { data } = await api.get(`/materials/${materialId}/offerings`);
      setOfferings(data);
    } catch {
      toast.error("No se pudieron cargar los proveedores de este insumo");
    } finally {
      setOfferingsLoading(false);
    }
  };

  // A brand-new material (no id yet) can't have offerings attached, so this
  // only fires when editing an existing one.
  useEffect(() => {
    setNewOffering(emptyOffering);
    if (modal?.id) loadOfferings(modal.id);
    else setOfferings([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal?.id]);

  const editOfferingField = (id, field, value) => {
    setOfferings((prev) => prev.map((o) => (o.id === id ? { ...o, [field]: value } : o)));
  };

  const addOffering = async () => {
    if (!newOffering.supplier_id) return toast.error("Selecciona un proveedor");
    if (!newOffering.cost_per_unit) return toast.error("Ingresa el costo por unidad");
    try {
      await api.post("/supplier-offerings", {
        supplier_id: newOffering.supplier_id,
        material_id: modal.id,
        cost_per_unit: Number(newOffering.cost_per_unit),
        min_order: Number(newOffering.min_order || 0),
        lead_time_days: Number(newOffering.lead_time_days || 3),
      });
      toast.success("Proveedor agregado");
      setNewOffering(emptyOffering);
      loadOfferings(modal.id);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo agregar el proveedor");
    }
  };

  const saveOffering = async (offering) => {
    try {
      await api.put(`/supplier-offerings/${offering.id}`, {
        cost_per_unit: Number(offering.cost_per_unit),
        min_order: Number(offering.min_order),
        lead_time_days: Number(offering.lead_time_days),
      });
      toast.success("Oferta actualizada");
      loadOfferings(modal.id);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo actualizar la oferta");
    }
  };

  const deactivateOffering = async (offeringId) => {
    if (!window.confirm("¿Desactivar esta oferta de proveedor?")) return;
    try {
      await api.put(`/supplier-offerings/${offeringId}`, { active: false });
      toast.success("Oferta desactivada");
      loadOfferings(modal.id);
    } catch {
      toast.error("No se pudo desactivar la oferta");
    }
  };

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
          <div className="space-y-6">
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
              <div className="sm:col-span-2"><Toggle checked={modal.active} onChange={(v) => setModal({ ...modal, active: v })} label="Activo" /></div>
            </div>

            {modal.id && (
              <div className="border-t border-border pt-5">
                <h4 className="text-sm font-semibold text-textBright">Proveedores de este insumo</h4>
                <p className="text-xs text-textDim mb-3">Costo, MOQ y tiempo de entrega por proveedor. La oferta más barata queda resaltada.</p>

                {offeringsLoading ? (
                  <p className="text-sm text-textDim">Cargando…</p>
                ) : offerings.length === 0 ? (
                  <p className="text-sm text-textDim mb-3">Sin proveedores registrados para este insumo todavía.</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {offerings.map((o, i) => (
                      <Card key={o.id} className={`p-3 ${i === 0 ? "border-cyan/40 bg-cyan-dim/20" : ""}`}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-sm font-medium text-textBright truncate">
                            {o.supplier_name || "Proveedor"}
                            {i === 0 && (
                              <span className="ml-2 text-[10px] uppercase tracking-wide text-cyan font-semibold">Más barato</span>
                            )}
                          </p>
                          <button
                            onClick={() => deactivateOffering(o.id)}
                            title="Desactivar oferta"
                            className="text-textDim hover:text-red-400 p-1 shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Field label="Costo/unidad">
                            <Input type="number" step="0.01" value={o.cost_per_unit} onChange={(e) => editOfferingField(o.id, "cost_per_unit", e.target.value)} />
                          </Field>
                          <Field label="MOQ">
                            <Input type="number" step="0.001" value={o.min_order} onChange={(e) => editOfferingField(o.id, "min_order", e.target.value)} />
                          </Field>
                          <Field label="Lead time (días)">
                            <Input type="number" step="1" value={o.lead_time_days} onChange={(e) => editOfferingField(o.id, "lead_time_days", e.target.value)} />
                          </Field>
                        </div>
                        <div className="flex justify-end mt-2">
                          <Btn size="sm" variant="secondary" onClick={() => saveOffering(o)}>Guardar</Btn>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                <Card className="p-3 bg-surface2/50">
                  <p className="text-xs text-textDim font-medium mb-2">Agregar proveedor</p>
                  <div className="flex flex-wrap gap-2 items-end">
                    <Field label="Proveedor" className="flex-1 min-w-[160px]">
                      <Select value={newOffering.supplier_id} onChange={(e) => setNewOffering({ ...newOffering, supplier_id: e.target.value })}>
                        <option value="">Selecciona…</option>
                        {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </Select>
                    </Field>
                    <Field label="Costo/unidad" className="w-28">
                      <Input type="number" step="0.01" value={newOffering.cost_per_unit} onChange={(e) => setNewOffering({ ...newOffering, cost_per_unit: e.target.value })} />
                    </Field>
                    <Field label="MOQ" className="w-24">
                      <Input type="number" step="0.001" value={newOffering.min_order} onChange={(e) => setNewOffering({ ...newOffering, min_order: e.target.value })} />
                    </Field>
                    <Field label="Lead time (d)" className="w-24">
                      <Input type="number" step="1" value={newOffering.lead_time_days} onChange={(e) => setNewOffering({ ...newOffering, lead_time_days: e.target.value })} />
                    </Field>
                    <Btn size="sm" onClick={addOffering}><Plus className="h-3.5 w-3.5" /> Agregar</Btn>
                  </div>
                </Card>
              </div>
            )}
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
