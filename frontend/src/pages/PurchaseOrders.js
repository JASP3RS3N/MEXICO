import React, { useEffect, useState } from "react";
import { Plus, Truck, Trash2, PackageCheck, Sparkles, ChevronDown, ChevronRight, XCircle } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Btn, Card, Input, Select, Field, Modal, Badge, EmptyState, PageLoader, Textarea } from "@/components/kit";
import { money, fmtDate, num } from "@/lib/format";

const PO_STATUS = {
  draft: { label: "Borrador", color: "gray" },
  ordered: { label: "Ordenada", color: "blue" },
  received: { label: "Recibida", color: "green" },
  cancelled: { label: "Cancelada", color: "red" },
};

const emptyPO = { supplier: "", notes: "", items: [] };

export default function PurchaseOrders() {
  const [pos, setPos] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [currency, setCurrency] = useState("MXN");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    try {
      const [p, m, s] = await Promise.all([api.get("/purchase-orders"), api.get("/materials"), api.get("/settings")]);
      setPos(p.data);
      setMaterials(m.data);
      if (s.data?.currency) setCurrency(s.data.currency);
    } catch {
      toast.error("No se pudo cargar");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNew = () => setModal({ ...emptyPO, items: [] });

  const loadSuggestions = async () => {
    try {
      const { data } = await api.get("/purchase-orders/suggestions");
      if (!data.length) return toast.info("No hay insumos en bajo stock");
      setModal({
        supplier: data[0]?.supplier || "",
        notes: "Reorden sugerido por bajo stock",
        items: data.map((s) => ({ material_id: s.material_id, qty: String(s.suggested_qty), unit_cost: String(s.unit_cost) })),
      });
      toast.success(`${data.length} insumo(s) sugeridos`);
    } catch {
      toast.error("No se pudieron cargar sugerencias");
    }
  };

  const addRow = () => setModal((m) => ({ ...m, items: [...m.items, { material_id: "", qty: "", unit_cost: "" }] }));
  const setRow = (i, key, val) =>
    setModal((m) => ({
      ...m,
      items: m.items.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, [key]: val };
        if (key === "material_id") {
          const mat = materials.find((x) => x.id === val);
          if (mat && !next.unit_cost) next.unit_cost = String(mat.cost_per_unit);
        }
        return next;
      }),
    }));
  const removeRow = (i) => setModal((m) => ({ ...m, items: m.items.filter((_, idx) => idx !== i) }));

  const modalTotal = (modal?.items || []).reduce((s, r) => s + Number(r.qty || 0) * Number(r.unit_cost || 0), 0);

  const save = async () => {
    const items = modal.items.filter((r) => r.material_id && Number(r.qty) > 0);
    if (!items.length) return toast.error("Agrega al menos un insumo con cantidad");
    setSaving(true);
    try {
      await api.post("/purchase-orders", {
        supplier: modal.supplier,
        notes: modal.notes,
        items: items.map((r) => ({ material_id: r.material_id, qty: Number(r.qty), unit_cost: Number(r.unit_cost || 0) })),
      });
      toast.success("Orden de compra creada");
      setModal(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo crear");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id, status) => {
    try {
      await api.put(`/purchase-orders/${id}/status`, { status });
      toast.success(status === "received" ? "Recibida · inventario actualizado" : "Actualizada");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo actualizar");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("¿Eliminar orden de compra?")) return;
    try {
      await api.delete(`/purchase-orders/${id}`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo eliminar");
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Órdenes de compra"
        subtitle="Reabastece materia prima y actualiza inventario al recibir"
        actions={
          <>
            <Btn variant="secondary" onClick={loadSuggestions}><Sparkles className="h-4 w-4" /> Sugerir reorden</Btn>
            <Btn onClick={openNew}><Plus className="h-4 w-4" /> Nueva OC</Btn>
          </>
        }
      />

      {pos.length === 0 ? (
        <EmptyState icon={Truck} title="Sin órdenes de compra" subtitle="Genera una OC para reabastecer tus insumos." action={<Btn onClick={openNew}><Plus className="h-4 w-4" /> Nueva OC</Btn>} />
      ) : (
        <div className="space-y-3">
          {pos.map((po) => {
            const meta = PO_STATUS[po.status] || { label: po.status, color: "gray" };
            const isOpen = expanded === po.id;
            return (
              <Card key={po.id}>
                <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(isOpen ? null : po.id)}>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-textDim" /> : <ChevronRight className="h-4 w-4 text-textDim" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-textBright">{po.po_number}</span>
                      <Badge color={meta.color}>{meta.label}</Badge>
                    </div>
                    <p className="text-xs text-textDim mt-0.5">
                      {po.supplier || "Sin proveedor"} · {po.items.length} insumo(s) · {fmtDate(po.created_at)}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-money">{money(po.total, currency)}</span>
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-border pt-3">
                    <table className="w-full text-sm mb-3">
                      <thead>
                        <tr className="text-left text-textDim">
                          <th className="py-1 font-medium">Insumo</th>
                          <th className="py-1 font-medium text-right">Cantidad</th>
                          <th className="py-1 font-medium text-right">Costo unit.</th>
                          <th className="py-1 font-medium text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {po.items.map((it, i) => (
                          <tr key={i} className="text-textMain">
                            <td className="py-1">{it.name}</td>
                            <td className="py-1 text-right font-mono">{num(it.qty, 2)} {it.unit}</td>
                            <td className="py-1 text-right font-mono">{money(it.unit_cost, currency)}</td>
                            <td className="py-1 text-right font-mono">{money(it.subtotal, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {po.notes && <p className="text-xs text-textDim italic mb-3">Nota: {po.notes}</p>}
                    <div className="flex flex-wrap gap-2 justify-end">
                      {po.status === "draft" && <Btn size="sm" variant="secondary" onClick={() => setStatus(po.id, "ordered")}>Marcar ordenada</Btn>}
                      {(po.status === "draft" || po.status === "ordered") && (
                        <>
                          <Btn size="sm" variant="ghost" onClick={() => setStatus(po.id, "cancelled")}><XCircle className="h-3.5 w-3.5" /> Cancelar</Btn>
                          <Btn size="sm" variant="success" onClick={() => setStatus(po.id, "received")}><PackageCheck className="h-3.5 w-3.5" /> Recibir</Btn>
                        </>
                      )}
                      {po.status !== "received" && (
                        <Btn size="sm" variant="ghost" onClick={() => remove(po.id)}><Trash2 className="h-3.5 w-3.5" /></Btn>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => !saving && setModal(null)}
        title="Nueva orden de compra"
        size="lg"
        footer={<><Btn variant="ghost" onClick={() => setModal(null)} disabled={saving}>Cancelar</Btn><Btn loading={saving} onClick={save}>Crear OC · {money(modalTotal, currency)}</Btn></>}
      >
        {modal && (
          <div className="space-y-4">
            <Field label="Proveedor"><Input value={modal.supplier} onChange={(e) => setModal({ ...modal, supplier: e.target.value })} /></Field>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-textMain font-medium">Insumos</p>
                <Btn size="sm" variant="secondary" onClick={addRow}><Plus className="h-3.5 w-3.5" /> Renglón</Btn>
              </div>
              <div className="space-y-2">
                {modal.items.length === 0 && <p className="text-xs text-textDim">Agrega insumos o usa "Sugerir reorden".</p>}
                {modal.items.map((r, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Select value={r.material_id} onChange={(e) => setRow(i, "material_id", e.target.value)} className="flex-1">
                      <option value="">Insumo…</option>
                      {materials.map((mt) => <option key={mt.id} value={mt.id}>{mt.name} ({mt.unit})</option>)}
                    </Select>
                    <Input type="number" step="0.001" placeholder="Cant." value={r.qty} onChange={(e) => setRow(i, "qty", e.target.value)} className="w-20" />
                    <Input type="number" step="0.01" placeholder="$/u" value={r.unit_cost} onChange={(e) => setRow(i, "unit_cost", e.target.value)} className="w-24" />
                    <button onClick={() => removeRow(i)} className="text-textDim hover:text-red-400 p-2"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </div>
            <Field label="Notas"><Textarea value={modal.notes} onChange={(e) => setModal({ ...modal, notes: e.target.value })} /></Field>
            <div className="flex justify-between border-t border-border pt-3">
              <span className="text-textMain">Total estimado</span>
              <span className="font-mono font-bold text-money">{money(modalTotal, currency)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
