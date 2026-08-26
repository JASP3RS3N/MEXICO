import React, { useEffect, useState } from "react";
import { Bell, AlertTriangle, Check, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Btn, Card, Badge, EmptyState, PageLoader, Toggle } from "@/components/kit";
import { fmtDateTime, num } from "@/lib/format";

export default function Alerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/alerts", { params: { include_resolved: showResolved } });
      setAlerts(data);
    } catch {
      toast.error("No se pudieron cargar las alertas");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResolved]);

  const resolve = async (id) => {
    await api.post(`/alerts/${id}/resolve`);
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Alertas de inventario"
        subtitle="Insumos en o por debajo del mínimo"
        actions={<Toggle checked={showResolved} onChange={setShowResolved} label="Incluir resueltas" />}
      />

      {alerts.length === 0 ? (
        <EmptyState icon={Bell} title="Sin alertas" subtitle="Todo el inventario está por encima del mínimo. 👍" />
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <Card key={a.id} className={`p-4 ${a.resolved ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-4">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${a.level === "critical" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"}`}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-textBright font-medium truncate">{a.name}</p>
                    <Badge color={a.level === "critical" ? "red" : "amber"}>{a.level === "critical" ? "Crítico" : "Bajo"}</Badge>
                    {a.resolved && <Badge color="green">Resuelta</Badge>}
                  </div>
                  <p className="text-sm text-textDim mt-0.5">
                    Existencia {num(a.current_stock, 2)} {a.unit} · mínimo {num(a.min_stock, 2)} · sugerido comprar <span className="text-amber-300 font-medium">{num(a.suggested_qty, 2)} {a.unit}</span>
                    {a.supplier ? ` · ${a.supplier}` : ""}
                  </p>
                  <p className="text-[11px] text-textDim mt-0.5">{fmtDateTime(a.created_at)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Btn size="sm" variant="secondary" onClick={() => navigate("/compras")}><Truck className="h-3.5 w-3.5" /> Comprar</Btn>
                  {!a.resolved && <Btn size="sm" variant="ghost" onClick={() => resolve(a.id)}><Check className="h-3.5 w-3.5" /> Resolver</Btn>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
