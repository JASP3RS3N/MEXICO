import React, { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, CheckCircle2, AlertTriangle, User, Wrench } from "lucide-react";
import api from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Btn, Card, Badge, Spinner } from "@/components/kit";

const QUICK_PROMPTS = [
  "¿Cómo va la venta de hoy? Dame el corte con utilidad.",
  "Revisa el inventario y crea una orden de compra con lo que esté bajo de stock.",
  "Analiza mi menú: márgenes bajos y sugerencias de precio.",
  "¿Cuáles fueron los 5 productos más vendidos este mes?",
];

export default function Assistant() {
  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    api.get("/ai/status").then(({ data }) => setStatus(data)).catch(() => setStatus({ enabled: false, connected: false, detail: "No disponible" }));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const history = [...messages, { role: "user", content }];
    setMessages(history);
    setInput("");
    setLoading(true);
    try {
      const { data } = await api.post("/ai/chat", {
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages([...history, { role: "assistant", content: data.reply, actions: data.actions || [] }]);
    } catch (err) {
      const detail = err?.response?.data?.detail || "No se pudo contactar a la IA";
      setMessages([...history, { role: "assistant", content: `⚠️ ${detail}`, actions: [], error: true }]);
    } finally {
      setLoading(false);
    }
  };

  const connected = status?.connected;

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <PageHeader
        title="Asistente IA"
        subtitle="Tu copiloto local (LM Studio) · privado y solo para el dueño"
        actions={
          status ? (
            connected ? (
              <Badge color="green"><CheckCircle2 className="h-3 w-3" /> Conectado · {status.model || "modelo"}</Badge>
            ) : (
              <Badge color="red"><AlertTriangle className="h-3 w-3" /> Sin conexión</Badge>
            )
          ) : null
        }
      />

      {status && !connected && (
        <Card className="p-4 mb-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-textMain">
              <p className="font-medium text-textBright">La IA no está conectada.</p>
              <p className="mt-1">{status.detail || "Verifica LM Studio."}</p>
              <ol className="list-decimal ml-4 mt-2 space-y-1 text-textDim">
                <li>Abre <b>LM Studio</b>, carga un modelo y ve a la pestaña <b>Developer / Local Server</b>.</li>
                <li>Enciende el servidor y activa <b>“Serve on Local Network”</b>.</li>
                <li>Ajusta <code>LMSTUDIO_BASE_URL</code> (por Tailscale: <code>http://TU-IP-TAILSCALE:1234/v1</code>) y reinicia el backend.</li>
              </ol>
            </div>
          </div>
        </Card>
      )}

      <Card className="flex-1 flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-4">
                <Bot className="h-7 w-7 text-white" />
              </div>
              <p className="text-textBright font-semibold">¿En qué te ayudo hoy?</p>
              <p className="text-textDim text-sm mt-1 max-w-md">
                Puedo revisar finanzas, analizar tu menú, crear órdenes de compra y levantar pedidos.
              </p>
              <div className="grid sm:grid-cols-2 gap-2 mt-5 w-full max-w-lg">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    disabled={loading}
                    className="text-left text-sm p-3 rounded-xl bg-surface2 border border-border hover:border-amber-500/40 text-textMain hover:text-textBright transition disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${m.role === "user" ? "bg-surface3 text-textBright" : "bg-gradient-to-br from-amber-500 to-orange-600 text-white"}`}>
                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={`max-w-[80%] ${m.role === "user" ? "items-end" : ""}`}>
                <div className={`rounded-2xl px-4 py-2.5 whitespace-pre-wrap text-sm ${m.role === "user" ? "bg-surface3 text-textBright" : m.error ? "bg-red-500/10 text-red-200 border border-red-500/20" : "bg-surface2 text-textMain border border-border"}`}>
                  {m.content}
                </div>
                {m.actions?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {m.actions.map((a, j) => (
                      <div key={j} className="flex items-center gap-2 text-xs text-cyan bg-cyan-dim border border-cyan/20 rounded-lg px-2.5 py-1.5">
                        <Wrench className="h-3.5 w-3.5 shrink-0" /> {a}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="rounded-2xl px-4 py-3 bg-surface2 border border-border flex items-center gap-2 text-textDim text-sm">
                <Spinner className="h-4 w-4" /> Pensando…
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border">
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={connected ? "Escribe tu instrucción…  (Enter para enviar)" : "Conéctate a LM Studio para chatear…"}
              rows={1}
              disabled={loading}
              className="flex-1 resize-none bg-surface2 border border-border rounded-xl px-3 py-2.5 text-sm text-textBright placeholder:text-textDim focus:outline-none focus:border-amber-500/50 max-h-32"
            />
            <Btn onClick={() => send()} loading={loading} disabled={!input.trim()} size="lg">
              <Send className="h-4 w-4" />
            </Btn>
          </div>
          <p className="text-[11px] text-textDim mt-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> La IA puede crear órdenes de compra y levantar pedidos reales. Revisa lo que ejecute.
          </p>
        </div>
      </Card>
    </div>
  );
}
