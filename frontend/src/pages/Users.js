import React, { useEffect, useState } from "react";
import { Plus, Users as UsersIcon, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth, ROLE_LABELS } from "@/context/AuthContext";
import { PageHeader } from "@/components/Layout";
import { Btn, Card, Input, Select, Field, Modal, Badge, EmptyState, PageLoader, Toggle } from "@/components/kit";

const ROLE_COLORS = { owner: "amber", cashier: "green", prep: "blue" };
const ROLE_DESC = {
  owner: "Acceso total, incluidas finanzas y P&L",
  cashier: "Levanta órdenes y cobra",
  prep: "Acepta y prepara comandas",
};

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/users");
      setUsers(data);
    } catch {
      toast.error("No se pudo cargar usuarios");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNew = () => setModal({ username: "", name: "", role: "cashier", password: "", active: true });
  const openEdit = (u) => setModal({ ...u, password: "" });

  const save = async () => {
    if (!modal.name || !modal.role) return toast.error("Nombre y rol son obligatorios");
    if (!modal.id && (!modal.username || !modal.password)) return toast.error("Usuario y contraseña son obligatorios");
    setSaving(true);
    try {
      if (modal.id) {
        const body = { name: modal.name, role: modal.role, active: modal.active };
        if (modal.password) body.password = modal.password;
        await api.put(`/users/${modal.id}`, body);
      } else {
        await api.post("/users", { username: modal.username, name: modal.name, role: modal.role, password: modal.password });
      }
      toast.success("Usuario guardado");
      setModal(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`¿Eliminar a ${u.name}?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success("Usuario eliminado");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo eliminar");
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Usuarios y roles"
        subtitle="Crea cuentas para cajeras, preparación y dueños"
        actions={<Btn onClick={openNew}><Plus className="h-4 w-4" /> Nuevo usuario</Btn>}
      />

      {users.length === 0 ? (
        <EmptyState icon={UsersIcon} title="Sin usuarios" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {users.map((u) => (
            <Card key={u.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-surface3 flex items-center justify-center text-amber-300 font-bold">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-textBright font-semibold flex items-center gap-1.5">
                      {u.name}
                      {u.id === me?.id && <span className="text-[10px] text-textDim">(tú)</span>}
                    </p>
                    <p className="text-xs text-textDim">@{u.username}</p>
                  </div>
                </div>
                <Badge color={u.active === false ? "gray" : ROLE_COLORS[u.role]}>
                  {u.role === "owner" && <ShieldCheck className="h-3 w-3" />}
                  {ROLE_LABELS[u.role]}
                </Badge>
              </div>
              <p className="text-xs text-textDim mt-3">{ROLE_DESC[u.role]}</p>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <span className={`text-xs ${u.active === false ? "text-red-400" : "text-cyan"}`}>
                  {u.active === false ? "Inactivo" : "Activo"}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(u)} className="text-textDim hover:text-amber-400 p-1.5"><Pencil className="h-4 w-4" /></button>
                  {u.id !== me?.id && (
                    <button onClick={() => remove(u)} className="text-textDim hover:text-red-400 p-1.5"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => !saving && setModal(null)}
        title={modal?.id ? "Editar usuario" : "Nuevo usuario"}
        footer={<><Btn variant="ghost" onClick={() => setModal(null)} disabled={saving}>Cancelar</Btn><Btn loading={saving} onClick={save}>Guardar</Btn></>}
      >
        {modal && (
          <div className="space-y-4">
            <Field label="Nombre completo"><Input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} /></Field>
            <Field label="Usuario" hint={modal.id ? "No se puede cambiar" : "Con este usuario inicia sesión"}>
              <Input value={modal.username} disabled={!!modal.id} onChange={(e) => setModal({ ...modal, username: e.target.value })} />
            </Field>
            <Field label="Rol">
              <Select value={modal.role} onChange={(e) => setModal({ ...modal, role: e.target.value })}>
                <option value="owner">Dueño</option>
                <option value="cashier">Cajera</option>
                <option value="prep">Preparación</option>
              </Select>
            </Field>
            <Field label={modal.id ? "Nueva contraseña (opcional)" : "Contraseña"}>
              <Input type="password" value={modal.password} onChange={(e) => setModal({ ...modal, password: e.target.value })} placeholder={modal.id ? "Dejar en blanco para no cambiar" : ""} />
            </Field>
            {modal.id && <Toggle checked={modal.active !== false} onChange={(v) => setModal({ ...modal, active: v })} label="Usuario activo" />}
          </div>
        )}
      </Modal>
    </div>
  );
}
