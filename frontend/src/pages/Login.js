import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, LogIn } from "lucide-react";
import { toast } from "sonner";
import { useAuth, HOME_BY_ROLE } from "@/context/AuthContext";
import { Btn, Input, Field, Card } from "@/components/kit";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const doLogin = async (u, p) => {
    setLoading(true);
    try {
      const user = await login(u, p);
      toast.success(`Bienvenido, ${user.name}`);
      navigate(HOME_BY_ROLE[user.role] || "/", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!username || !password) return toast.error("Ingresa usuario y contraseña");
    doLogin(username, password);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-orange-900/50 mb-4">
            <Flame className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-textBright">Smokehouse OS</h1>
          <p className="text-textDim text-sm mt-1">Control financiero, inventario y operación</p>
        </div>

        <Card className="p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Usuario">
              <Input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="dueno"
                autoComplete="username"
              />
            </Field>
            <Field label="Contraseña">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </Field>
            <Btn type="submit" size="lg" loading={loading} className="w-full">
              <LogIn className="h-4 w-4" /> Entrar
            </Btn>
          </form>
        </Card>
      </div>
    </div>
  );
}
