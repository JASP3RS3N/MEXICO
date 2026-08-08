import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Delete, LogIn } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Btn, Card } from "@/components/kit";

const PIN_MAX = 6;

// Where a PIN-authenticated staff member lands.
const HOME_BY_PIN_ROLE = {
  cashier: "/pos",
  prep: "/cocina",
};

export default function PinEntry() {
  const { deviceActivated, loginPin } = useAuth();
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = useCallback(
    async (value) => {
      if (loading || !value) return;
      setLoading(true);
      try {
        const user = await loginPin(value);
        navigate(HOME_BY_PIN_ROLE[user.role] || "/", { replace: true });
      } catch (err) {
        toast.error(err?.response?.data?.detail || "PIN incorrecto");
        setPin("");
      } finally {
        setLoading(false);
      }
    },
    [loading, loginPin, navigate]
  );

  // Auto-submit as soon as the PIN reaches its full length.
  useEffect(() => {
    if (pin.length === PIN_MAX) submit(pin);
  }, [pin, submit]);

  const press = (digit) => {
    if (loading) return;
    setPin((p) => (p.length >= PIN_MAX ? p : p + digit));
  };
  const backspace = () => setPin((p) => p.slice(0, -1));
  const clear = () => setPin("");

  // --- Device not activated: staff cannot enter until the owner logs in once.
  if (!deviceActivated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="flex flex-col items-center mb-6">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-orange-900/50 mb-4">
              <Flame className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-textBright">Smokehouse OS</h1>
          </div>
          <Card className="p-6">
            <p className="text-textDim">
              Este dispositivo no está activado. Pide al dueño que inicie sesión primero.
            </p>
            <Btn size="lg" className="w-full mt-6" onClick={() => navigate("/login")}>
              <LogIn className="h-4 w-4" /> Ir a inicio de sesión
            </Btn>
          </Card>
        </div>
      </div>
    );
  }

  // --- Device activated: show the numeric keypad.
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-orange-900/50 mb-4">
            <Flame className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-textBright">Ingresa tu PIN</h1>
          <p className="text-textDim text-sm mt-1">Toca los números para iniciar tu turno</p>
        </div>

        {/* PIN masked as dots for privacy. */}
        <div className="flex justify-center gap-3 mb-6" aria-label="PIN">
          {Array.from({ length: PIN_MAX }).map((_, i) => (
            <span
              key={i}
              className={
                "h-4 w-4 rounded-full transition-colors " +
                (i < pin.length ? "bg-amber-500" : "bg-white/15")
              }
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              disabled={loading}
              className="h-16 rounded-xl bg-surface border border-white/10 text-2xl font-semibold text-textBright active:scale-95 transition-transform disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            >
              {k}
            </button>
          ))}
          <button
            type="button"
            onClick={clear}
            disabled={loading}
            className="h-16 rounded-xl bg-surface border border-white/10 text-base font-medium text-textDim active:scale-95 transition-transform disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => press("0")}
            disabled={loading}
            className="h-16 rounded-xl bg-surface border border-white/10 text-2xl font-semibold text-textBright active:scale-95 transition-transform disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          >
            0
          </button>
          <button
            type="button"
            onClick={backspace}
            disabled={loading}
            className="h-16 rounded-xl bg-surface border border-white/10 flex items-center justify-center text-textDim active:scale-95 transition-transform disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            aria-label="Borrar"
          >
            <Delete className="h-6 w-6" />
          </button>
        </div>

        {/* Explicit submit for PINs shorter than the max length. */}
        <Btn
          size="lg"
          loading={loading}
          disabled={pin.length === 0}
          className="w-full mt-4 h-16 text-lg"
          onClick={() => submit(pin)}
        >
          Entrar
        </Btn>
      </div>
    </div>
  );
}
