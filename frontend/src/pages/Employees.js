import React, { useEffect, useState } from "react";
import { Plus, Contact, Pencil, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Btn, Card, Input, Field, Modal, Badge, EmptyState, PageLoader } from "@/components/kit";
import { money, fmtDate, todayInput } from "@/lib/format";

const empty = { name: "", position: "", phone: "", email: "", wage: "", hire_date: "", notes: "" };
const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Activos" },
  { key: "inactive", label: "Bajas" },
];

export default function Employees() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [currency, setCurrency] = useState("MXN");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [term, setTerm] = useState(null); // termination modal

  const load = async () => {
    try {
      const params = filter === "all" ? {} : { status: filter };
      const [e, s] = await Promise.all([api.get("/employees", { params }), api.get("/settings")]);
      setItems(e.data);
      if (s.data?.currency) setCurrency(s.data.currency);
    } catch {
      toast.error("No se pudo cargar");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const save = async () => {
    if (!modal.name) return toast.error("El nombre es obligatorio");
    setSaving(true);
    try {
      const body = { ...modal, wage: Number(modal.wage || 0) };
      if (modal.id) await api.put(`/employees/${modal.id}`, body);
      else await api.post("/employees", body);
      toast.success("Empleado guardado");
      setModal(null);
      load();
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const doTerminate = async () => {
    try {
      await api.post(`/employees/${term.id}/terminate`, { reason: term.reason, termination_date: term.date });
      toast.success("Baja registrada");
      setTerm(null);
      load();
    } catch {
      toast.error("No se pudo dar de baja");
    }
  };

  const reactivate = async (id) => {
    await api.post(`/employees/${id}/reactivate`);
    toast.success("Empleado reactivado");
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Empleados"
        subtitle="Altas y bajas · se conserva el historial de quienes han trabajado aquí"
        actions={<Btn onClick={() => setModal({ ...empty, hire_date: todayInput() })}><Plus className="h-4 w-4" /> Alta de empleado</Btn>}
      />

      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`px-4 py-1.5 rounded-full text-sm border transition ${filter === f.key ? "bg-amber-500/15 border-amber-500/40 text-amber-300" : "bg-surface2 border-border text-textMain hover:text-textBright"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Contact} title="Sin empleados" subtitle="Registra a tu personal." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-textDim border-b border-border">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Puesto</th>
                  <th className="px-4 py-3 font-medium">Ingreso</th>
                  <th className="px-4 py-3 font-medium">Baja</th>
                  <th className="px-4 py-3 font-medium text-right">Sueldo</th>
                  <th className="px-4 py-3 font-medium text-center">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id} className="border-b border-border/60 hover:bg-surface2/50">
                    <td className="px-4 py-3">
                      <p className="text-textBright font-medium">{e.name}</p>
                      {e.phone && <p className="text-xs text-textDim">{e.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-textMain">{e.position || "—"}</td>
                    <td className="px-4 py-3 text-textMain">{fmtDate(e.hire_date)}</td>
                    <td className="px-4 py-3 text-textDim">{e.termination_date ? fmtDate(e.termination_date) : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-textMain">{e.wage ? money(e.wage, currency) : "—"}</td>
                    <td className="px-4 py-3 text-center">
                      {e.status === "active" ? <Badge color="green">Activo</Badge> : <Badge color="gray">Baja</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setModal({ ...empty, ...e, wage: String(e.wage ?? "") })} className="text-textDim hover:text-amber-400 p-1.5" title="Editar"><Pencil className="h-4 w-4" /></button>
                        {e.status === "active" ? (
                          <button onClick={() => setTerm({ id: e.id, name: e.name, reason: "", date: todayInput() })} className="text-textDim hover:text-red-400 p-1.5" title="Dar de baja"><UserMinus className="h-4 w-4" /></button>
                        ) : (
                          <button onClick={() => reactivate(e.id)} className="text-textDim hover:text-cyan p-1.5" title="Reactivar"><UserPlus className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={!!modal}
        onClose={() => !saving && setModal(null)}
        title={modal?.id ? "Editar empleado" : "Alta de empleado"}
        footer={<><Btn variant="ghost" onClick={() => setModal(null)} disabled={saving}>Cancelar</Btn><Btn loading={saving} onClick={save}>Guardar</Btn></>}
      >
        {modal && (
          <div className="space-y-4">
            <Field label="Nombre completo"><Input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Puesto"><Input value={modal.position} onChange={(e) => setModal({ ...modal, position: e.target.value })} placeholder="Cocina, caja…" /></Field>
              <Field label="Sueldo"><Input type="number" value={modal.wage} onChange={(e) => setModal({ ...modal, wage: e.target.value })} /></Field>
              <Field label="Teléfono"><Input value={modal.phone} onChange={(e) => setModal({ ...modal, phone: e.target.value })} /></Field>
              <Field label="Email"><Input value={modal.email} onChange={(e) => setModal({ ...modal, email: e.target.value })} /></Field>
            </div>
            {!modal.id && <Field label="Fecha de ingreso"><Input type="date" value={modal.hire_date} onChange={(e) => setModal({ ...modal, hire_date: e.target.value })} /></Field>}
            <Field label="Notas"><Input value={modal.notes} onChange={(e) => setModal({ ...modal, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      <Modal
        open={!!term}
        onClose={() => setTerm(null)}
        title={`Dar de baja · ${term?.name ?? ""}`}
        footer={<><Btn variant="ghost" onClick={() => setTerm(null)}>Cancelar</Btn><Btn variant="danger" onClick={doTerminate}>Confirmar baja</Btn></>}
      >
        {term && (
          <div className="space-y-4">
            <p className="text-sm text-textDim">El registro se conserva en el historial (no se borra).</p>
            <Field label="Fecha de baja"><Input type="date" value={term.date} onChange={(e) => setTerm({ ...term, date: e.target.value })} /></Field>
            <Field label="Motivo"><Input value={term.reason} onChange={(e) => setTerm({ ...term, reason: e.target.value })} placeholder="Renuncia, término de contrato…" /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
