import React, { useEffect, useState } from "react";
import { Plus, Handshake, Pencil, Trash2, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Btn, Card, Input, Field, Modal, EmptyState, PageLoader, Toggle } from "@/components/kit";

const empty = { name: "", contact: "", phone: "", email: "", notes: "", active: true };

export default function Suppliers() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/suppliers");
      setItems(data);
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

  const save = async () => {
    if (!modal.name) return toast.error("El nombre es obligatorio");
    setSaving(true);
    try {
      if (modal.id) await api.put(`/suppliers/${modal.id}`, modal);
      else await api.post("/suppliers", modal);
      toast.success("Proveedor guardado");
      setModal(null);
      load();
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("¿Eliminar proveedor?")) return;
    await api.delete(`/suppliers/${id}`);
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Proveedores"
        subtitle="Directorio de proveedores para tus compras"
        actions={<Btn onClick={() => setModal({ ...empty })}><Plus className="h-4 w-4" /> Nuevo proveedor</Btn>}
      />

      {items.length === 0 ? (
        <EmptyState icon={Handshake} title="Sin proveedores" subtitle="Da de alta a tus proveedores." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-textBright font-semibold truncate">{s.name}</p>
                  {s.contact && <p className="text-xs text-textDim">{s.contact}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setModal({ ...empty, ...s })} className="text-textDim hover:text-amber-400 p-1.5"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(s.id)} className="text-textDim hover:text-red-400 p-1.5"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm text-textMain">
                {s.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-textDim" /> {s.phone}</p>}
                {s.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-textDim" /> {s.email}</p>}
                {s.notes && <p className="text-xs text-textDim mt-2">{s.notes}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => !saving && setModal(null)}
        title={modal?.id ? "Editar proveedor" : "Nuevo proveedor"}
        footer={<><Btn variant="ghost" onClick={() => setModal(null)} disabled={saving}>Cancelar</Btn><Btn loading={saving} onClick={save}>Guardar</Btn></>}
      >
        {modal && (
          <div className="space-y-4">
            <Field label="Nombre"><Input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} /></Field>
            <Field label="Contacto"><Input value={modal.contact} onChange={(e) => setModal({ ...modal, contact: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Teléfono"><Input value={modal.phone} onChange={(e) => setModal({ ...modal, phone: e.target.value })} /></Field>
              <Field label="Email"><Input value={modal.email} onChange={(e) => setModal({ ...modal, email: e.target.value })} /></Field>
            </div>
            <Field label="Notas"><Input value={modal.notes} onChange={(e) => setModal({ ...modal, notes: e.target.value })} /></Field>
            {modal.id && <Toggle checked={modal.active !== false} onChange={(v) => setModal({ ...modal, active: v })} label="Activo" />}
          </div>
        )}
      </Modal>
    </div>
  );
}
