import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Lock,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SparkLogo } from "@/components/SparkLogo";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { updatePassword, user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // El enlace de invitación/recuperación abre sesión vía Supabase Auth antes
  // de llegar aquí; updatePassword requiere esa sesión activa.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    setDone(true);
    toast.success("Contraseña actualizada.");
    setTimeout(() => navigate(user ? "/" : "/login"), 1500);
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-[#F8F9FA] font-sans text-[#1F2124]">
      <div
        className="h-1 w-full bg-gradient-spark-brand shrink-0"
        aria-hidden="true"
      />
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full max-w-md overflow-hidden rounded-[10px] border border-[#DBDBDB] bg-white shadow-card">
          <div className="bg-[#0E1E2A] px-8 py-8 text-center">
            <div className="flex justify-center">
              <SparkLogo variant="white" size="md" alt="Spark225" />
            </div>
            <h1 className="mt-5 text-lg font-bold text-white">
              Definir contraseña
            </h1>
            <p className="mt-1 text-xs text-[#B4BAC2]">
              Establece o restablece tu contraseña de acceso a SSAM.
            </p>
          </div>

          <div className="p-8">
            {done ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 className="h-10 w-10 text-[#2E9E5B]" />
                <p className="font-semibold text-[#0E1E2A]">
                  Contraseña actualizada
                </p>
                <p className="text-xs text-[#4E5964]">
                  Te redirigimos a la plataforma.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-2 rounded-[8px] bg-[#F8F9FA] border border-[#DBDBDB] px-3 py-2.5 text-[11px] text-[#4E5964]">
                  <ShieldCheck className="h-4 w-4 text-[#E37439] shrink-0" />
                  Este enlace sirve también para aceptar invitaciones a la
                  plataforma.
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="password"
                    className="text-xs font-semibold text-[#0E1E2A]"
                  >
                    Nueva contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4E5964]" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="pl-9 pr-10 h-10 border-[#DBDBDB] bg-white text-xs rounded-[8px] focus-visible:ring-[#E37439]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#4E5964] hover:text-[#0E1E2A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E37439]"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="confirm"
                    className="text-xs font-semibold text-[#0E1E2A]"
                  >
                    Confirmar contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4E5964]" />
                    <Input
                      id="confirm"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repite la contraseña"
                      className="pl-9 pr-10 h-10 border-[#DBDBDB] bg-white text-xs rounded-[8px] focus-visible:ring-[#E37439]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={
                        showConfirm
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#4E5964] hover:text-[#0E1E2A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E37439]"
                    >
                      {showConfirm ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 gap-2 rounded-[8px] bg-[#E37439] text-white font-semibold hover:bg-[#C45B24] transition-colors shadow-soft"
                >
                  {loading ? "Guardando..." : "Guardar contraseña"}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
