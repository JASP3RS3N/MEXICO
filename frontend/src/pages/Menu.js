import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, UtensilsCrossed, Tag, Check, X, Layers } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Btn, Card, Input, Select, Field, Modal, Badge, EmptyState, PageLoader, Toggle } from "@/components/kit";
import { money, pct } from "@/lib/format";

const STATIONS = ["cocina", "ahumador", "parrilla", "barra", "postres"];
const emptyProduct = { name: "", category_id: "", price: "", description: "", station: "cocina", active: true, recipe: [] };

export default function Menu() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [currency, setCurrency] = useState("MXN");
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState(null); // product being edited or emptyProduct
  const [saving, setSaving] = useState(false);
  const [catModal, setCatModal] = useState(false);
  const [priceEdit, setPriceEdit] = useState({ id: null, value: "" });

  const load = async () => {
    try {
      const [p, c, mtl, s] = await Promise.all([
        api.get("/products"),
        api.get("/categories"),
        api.get("/materials"),
        api.get("/settings"),
      ]);
      setProducts(p.data);
      setCategories(c.data);
      setMaterials(mtl.data);
      if (s.data?.currency) setCurrency(s.data.currency);
    } catch {
      toast.error("No se pudo cargar el menú");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const catName = (id) => categories.find((c) => c.id === id)?.name || "Sin categoría";

  const saveProduct = async () => {
    if (!modal.name || modal.price === "") return toast.error("Nombre y precio son obligatorios");
    setSaving(true);
    const body = {
      name: modal.name,
      category_id: modal.category_id || null,
      price: Number(modal.price),
      description: modal.description,
      station: modal.station,
      active: modal.active,
      recipe: modal.recipe.filter((r) => r.material_id && r.qty).map((r) => ({ material_id: r.material_id, qty: Number(r.qty) })),
    };
    try {
      if (modal.id) await api.put(`/products/${modal.id}`, body);
      else await api.post("/products", body);
      toast.success("Producto guardado");
      setModal(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async (id) => {
    if (!window.confirm("¿Eliminar este producto?")) return;
    await api.delete(`/products/${id}`);
    toast.success("Producto eliminado");
    load();
  };

  const savePrice = async (id) => {
    try {
      await api.patch(`/products/${id}/price`, { price: Number(priceEdit.value) });
      toast.success("Precio actualizado");
      setPriceEdit({ id: null, value: "" });
      load();
    } catch {
      toast.error("No se pudo actualizar el precio");
    }
  };

  // recipe row helpers inside modal
  const addRecipeRow = () => setModal((m) => ({ ...m, recipe: [...m.recipe, { material_id: "", qty: "" }] }));
  const setRecipeRow = (i, key, val) =>
    setModal((m) => ({ ...m, recipe: m.recipe.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)) }));
  const removeRecipeRow = (i) => setModal((m) => ({ ...m, recipe: m.recipe.filter((_, idx) => idx !== i) }));

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Menú y precios"
        subtitle="Crea productos, ajusta precios y define recetas (materia prima)"
        actions={
          <>
            <Btn variant="secondary" onClick={() => setCatModal(true)}>
              <Layers className="h-4 w-4" /> Categorías
            </Btn>
            <Btn onClick={() => setModal({ ...emptyProduct })}>
              <Plus className="h-4 w-4" /> Nuevo producto
            </Btn>
          </>
        }
      />

      {products.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title="Sin productos" subtitle="Crea tu primer producto del menú." action={<Btn onClick={() => setModal({ ...emptyProduct })}><Plus className="h-4 w-4" /> Nuevo producto</Btn>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-textDim border-b border-border">
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Categoría</th>
                  <th className="px-4 py-3 font-medium">Estación</th>
                  <th className="px-4 py-3 font-medium text-right">Costo</th>
                  <th className="px-4 py-3 font-medium text-right">Precio</th>
                  <th className="px-4 py-3 font-medium text-right">Margen</th>
                  <th className="px-4 py-3 font-medium text-center">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const margin = p.price ? ((p.price - (p.cost || 0)) / p.price) * 100 : 0;
                  return (
                    <tr key={p.id} className="border-b border-border/60 hover:bg-surface2/50">
                      <td className="px-4 py-3">
                        <p className="text-textBright font-medium">{p.name}</p>
                        {p.description && <p className="text-xs text-textDim truncate max-w-[220px]">{p.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-textMain">{catName(p.category_id)}</td>
                      <td className="px-4 py-3"><Badge color="gray">{p.station}</Badge></td>
                      <td className="px-4 py-3 text-right font-mono text-textDim">{money(p.cost, currency)}</td>
                      <td className="px-4 py-3 text-right">
                        {priceEdit.id === p.id ? (
                          <div className="flex items-center gap-1 justify-end">
                            <Input
                              type="number"
                              autoFocus
                              value={priceEdit.value}
                              onChange={(e) => setPriceEdit({ id: p.id, value: e.target.value })}
                              className="h-8 w-24 text-right"
                              onKeyDown={(e) => e.key === "Enter" && savePrice(p.id)}
                            />
                            <button onClick={() => savePrice(p.id)} className="text-cyan p-1"><Check className="h-4 w-4" /></button>
                            <button onClick={() => setPriceEdit({ id: null, value: "" })} className="text-textDim p-1"><X className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPriceEdit({ id: p.id, value: String(p.price) })}
                            className="font-mono text-cyan hover:underline inline-flex items-center gap-1"
                            title="Editar precio"
                          >
                            <Tag className="h-3 w-3" /> {money(p.price, currency)}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={margin >= 60 ? "text-cyan" : margin >= 30 ? "text-amber-400" : "text-red-400"}>
                          {pct(margin)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.active !== false ? <Badge color="green">Activo</Badge> : <Badge color="gray">Inactivo</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setModal({ ...emptyProduct, ...p, price: String(p.price), recipe: (p.recipe || []).map((r) => ({ ...r, qty: String(r.qty) })) })} className="text-textDim hover:text-amber-400 p-1.5">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => removeProduct(p.id)} className="text-textDim hover:text-red-400 p-1.5">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Product modal */}
      <Modal
        open={!!modal}
        onClose={() => !saving && setModal(null)}
        title={modal?.id ? "Editar producto" : "Nuevo producto"}
        size="lg"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setModal(null)} disabled={saving}>Cancelar</Btn>
            <Btn loading={saving} onClick={saveProduct}>Guardar</Btn>
          </>
        }
      >
        {modal && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombre"><Input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} /></Field>
              <Field label="Precio de venta"><Input type="number" value={modal.price} onChange={(e) => setModal({ ...modal, price: e.target.value })} /></Field>
              <Field label="Categoría">
                <Select value={modal.category_id || ""} onChange={(e) => setModal({ ...modal, category_id: e.target.value })}>
                  <option value="">Sin categoría</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Estación de preparación">
                <Select value={modal.station} onChange={(e) => setModal({ ...modal, station: e.target.value })}>
                  {STATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Descripción"><Input value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} /></Field>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-textMain font-medium">Receta (descuenta inventario al vender)</p>
                <Btn size="sm" variant="secondary" onClick={addRecipeRow}><Plus className="h-3.5 w-3.5" /> Insumo</Btn>
              </div>
              <div className="space-y-2">
                {modal.recipe.length === 0 && <p className="text-xs text-textDim">Sin insumos. Opcional, pero necesario para costeo y control de inventario.</p>}
                {modal.recipe.map((r, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Select value={r.material_id} onChange={(e) => setRecipeRow(i, "material_id", e.target.value)} className="flex-1">
                      <option value="">Selecciona materia prima…</option>
                      {materials.map((mt) => <option key={mt.id} value={mt.id}>{mt.name} ({mt.unit})</option>)}
                    </Select>
                    <Input type="number" step="0.001" placeholder="Cant." value={r.qty} onChange={(e) => setRecipeRow(i, "qty", e.target.value)} className="w-24" />
                    <button onClick={() => removeRecipeRow(i)} className="text-textDim hover:text-red-400 p-2"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </div>

            <Toggle checked={modal.active} onChange={(v) => setModal({ ...modal, active: v })} label="Producto activo (visible en el menú)" />
          </div>
        )}
      </Modal>

      <CategoriesModal open={catModal} onClose={() => setCatModal(false)} categories={categories} reload={load} />
    </div>
  );
}

function CategoriesModal({ open, onClose, categories, reload }) {
  const [name, setName] = useState("");
  const add = async () => {
    if (!name.trim()) return;
    await api.post("/categories", { name, sort_order: categories.length });
    setName("");
    reload();
  };
  const remove = async (id) => {
    await api.delete(`/categories/${id}`);
    reload();
  };
  return (
    <Modal open={open} onClose={onClose} title="Categorías del menú">
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Nueva categoría" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <Btn onClick={add}><Plus className="h-4 w-4" /></Btn>
        </div>
        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between bg-surface2 rounded-lg px-3 py-2">
              <span className="text-textBright text-sm">{c.name}</span>
              <button onClick={() => remove(c.id)} className="text-textDim hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {categories.length === 0 && <p className="text-textDim text-sm text-center py-4">Sin categorías aún</p>}
        </div>
      </div>
    </Modal>
  );
}
