import React, { useEffect, useState } from "react";
import { Plus, Wallet, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Btn, Card, Input, Select, Field, Modal, Badge, EmptyState, PageLoader, Stat } from "@/components/kit";
import { money, fmtDate, monthRange, todayInput } from "@/lib/format";

const CATEGORIES = ["Renta", "Nómina", "Servicios", "Insumos", "Mantenimiento", "Marketing", "Impuestos", "General"];

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [currency, setCurrency] = useState("MXN");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const [payroll, setPayroll] = useState(0);

  const load = async () => {
    try {
      const range = monthRange(new Date());
      const [e, s, emp] = await Promise.all([
        api.get("/expenses", { params: { start: range.start, end: range.end } }),
        api.get("/settings"),
        api.get("/employees", { params: { status: "active" } }),
      ]);
      setExpenses(e.data);
      if (s.data?.currency) setCurrency(s.data.currency);
      setPayroll(emp.data.reduce((sum, x) => sum + Number(x.wage || 0), 0));
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

  const manualTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const total = manualTotal + payroll;

  const openNew = () => setModal({ category: "General", description: "", amount: "", date: todayInput() });

  const save = async () => {
    if (!modal.description || !modal.amount) return toast.error("Descripción y monto son obligatorios");
    setSaving(true);
    try {
      await api.post("/expenses", {
        category: modal.category,
        description: modal.description,
        amount: Number(modal.amount),
        date: modal.date,
      });
      toast.success("Gasto registrado");
      setModal(null);
      load();
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    await api.delete(`/expenses/${id}`);
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Gastos operativos"
        subtitle="Del mes en curso · alimentan el P&L"
        actions={<Btn onClick={openNew}><Plus className="h-4 w-4" /> Registrar gasto</Btn>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Total del mes" value={money(total, currency)} icon={Wallet} accent="red" />
        <Stat label="Gastos capturados" value={money(manualTotal, currency)} icon={Wallet} accent="amber" />
        <Stat label="Nómina (activos)" value={money(payroll, currency)} sub="Auto · desde Empleados" icon={Users} accent="purple" />
        <Stat label="Registros" value={expenses.length} icon={Wallet} accent="blue" />
      </div>

      {payroll > 0 && (
        <Card className="p-4 mb-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0"><Users className="h-5 w-5" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-textBright text-sm font-medium">Nómina de personal activo (automática)</p>
            <p className="text-textDim text-xs">Se calcula con los sueldos del personal activo en Empleados y se suma a los gastos del mes.</p>
          </div>
          <span className="font-mono font-bold text-money shrink-0">{money(payroll, currency)}</span>
        </Card>
      )}

      {expenses.length === 0 ? (
        <EmptyState icon={Wallet} title="Sin gastos este mes" subtitle="Registra renta, nómina, servicios y más." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-textDim border-b border-border">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Categoría</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 font-medium text-right">Monto</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-border/60 hover:bg-surface2/50">
                    <td className="px-4 py-3 text-textMain">{fmtDate(e.date)}</td>
                    <td className="px-4 py-3"><Badge color="gray">{e.category}</Badge></td>
                    <td className="px-4 py-3 text-textBright">{e.description}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-400">{money(e.amount, currency)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => remove(e.id)} className="text-textDim hover:text-red-400 p-1.5"><Trash2 className="h-4 w-4" /></button>
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
        title="Registrar gasto"
        footer={<><Btn variant="ghost" onClick={() => setModal(null)} disabled={saving}>Cancelar</Btn><Btn loading={saving} onClick={save}>Guardar</Btn></>}
      >
        {modal && (
          <div className="space-y-4">
            <Field label="Categoría">
              <Select value={modal.category} onChange={(e) => setModal({ ...modal, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Descripción"><Input value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Monto"><Input type="number" step="0.01" value={modal.amount} onChange={(e) => setModal({ ...modal, amount: e.target.value })} /></Field>
              <Field label="Fecha"><Input type="date" value={modal.date} onChange={(e) => setModal({ ...modal, date: e.target.value })} /></Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
