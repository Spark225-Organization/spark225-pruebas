import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Lock,
  Mail,
  ArrowRight,
  CheckCircle2,
  Wand2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SparkLogo } from "@/components/SparkLogo";
import { Marca } from "@/components/Marca";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Mode = "signin" | "forgot";

function translateAuthError(message: string): string {
  if (!message) return "Ocurrió un error. Intenta de nuevo.";
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "Correo o contraseña incorrectos.";
  if (m.includes("failed to fetch") || m.includes("fetch"))
    return "No hay conexión con el servidor. Revisa tu internet o desactiva bloqueadores (AdBlock/VPN) e intenta de nuevo.";
  if (m.includes("email not confirmed"))
    return "Tu correo aún no está confirmado.";
  return message;
}

const Login = () => {
  const navigate = useNavigate();
  const { signInWithPassword, signInWithOtp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  const normalizeEmail = (value: string) => value.trim().toLowerCase();

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !password.trim()) {
      toast.error("Ingresa correo y contraseña.");
      return;
    }
    setLoading(true);
    const { error } = await signInWithPassword(cleanEmail, password);
    setLoading(false);
    if (error) {
      toast.error(translateAuthError(error));
      return;
    }
    // onAuthStateChange will load the profile; navigate to home
    navigate("/");
  };

  const handleMagic = async () => {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) {
      toast.error("Ingresa tu correo para enviar el enlace mágico.");
      return;
    }
    setLoading(true);
    const { error } = await signInWithOtp(cleanEmail);
    setLoading(false);
    if (error) {
      toast.error(translateAuthError(error));
      return;
    }
    setMagicSent(true);
    toast.success("Te enviamos un enlace mágico a tu correo.");
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) {
      toast.error("Ingresa tu correo.");
      return;
    }
    setLoading(true);
    const { error } = await resetPassword(cleanEmail);
    setLoading(false);
    if (error) {
      toast.error(translateAuthError(error));
      return;
    }
    toast.success("Te enviamos un enlace para restablecer tu contraseña.");
    setMode("signin");
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-[#F8F9FA] font-sans text-[#1F2124]">
      <div
        className="h-1 w-full bg-gradient-spark-brand shrink-0"
        aria-hidden="true"
      />

      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[10px] border border-[#DBDBDB] bg-white shadow-card lg:grid-cols-2">
          {/* Panel Izquierdo: Navy */}
          <div className="flex flex-col justify-between bg-[#0E1E2A] p-8 text-white sm:p-10 lg:p-12">
            <div>
              <div className="mb-8">
                <SparkLogo variant="white" size="lg" alt="Spark225" />
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Sistema de Aprobación <br />
                de Materiales{" "}
                <span className="text-[#E37439] font-extrabold">(SSAM)</span>
              </h1>

              <p className="mt-4 text-sm font-medium text-[#B4BAC2] leading-relaxed">
                Visibilidad total de cada material, de la solicitud a la
                implementación.
              </p>

              <div className="mt-8 space-y-3">
                {[
                  "Trazabilidad completa por etapa y responsable",
                  "Integración con el sistema de aprobación de cada laboratorio",
                  "Aprobación colaborativa médico-gráfica",
                  "Auditoría histórica con control de versiones",
                ].map((feat, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 text-xs text-[#E1E5E9]"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#E37439]" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 border-t border-[#1F3345] pt-6">
              <p className="text-xs font-semibold text-[#8894A0] tracking-wide">
                Spark225 · Consultoría y Marketing Digital en Salud
              </p>
            </div>
          </div>

          {/* Panel Derecho: Blanco */}
          <div className="flex flex-col justify-between bg-white p-8 sm:p-10 lg:p-12">
            <div>
              <div className="mb-6 lg:hidden">
                <Marca tono="oscuro" ancho={120} />
              </div>

              {mode === "signin" ? (
                <>
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold text-[#0E1E2A] sm:text-2xl">
                      Acceso a la Plataforma
                    </h2>
                    <p className="text-xs text-[#4E5964]">
                      Ingresa con tu correo y contraseña. Las cuentas se crean
                      solo por invitación.
                    </p>
                  </div>

                  <form onSubmit={handlePassword} className="mt-6 space-y-4">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="email"
                        className="text-xs font-semibold text-[#0E1E2A]"
                      >
                        Correo Electrónico
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4E5964]" />
                        <Input
                          id="email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="nombre@empresa.com"
                          className="pl-9 h-10 border-[#DBDBDB] bg-white text-xs text-[#1F2124] rounded-[8px] focus-visible:ring-[#E37439]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="password"
                          className="text-xs font-semibold text-[#0E1E2A]"
                        >
                          Contraseña
                        </Label>
                        <button
                          type="button"
                          onClick={() => setMode("forgot")}
                          className="text-[11px] font-semibold text-[#E37439] hover:underline"
                        >
                          Olvidé mi contraseña
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4E5964]" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
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

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-11 gap-2 rounded-[8px] bg-[#E37439] text-white font-semibold hover:bg-[#C45B24] transition-colors shadow-soft"
                    >
                      {loading ? "Autenticando..." : "Ingresar"}
                      {!loading && <ArrowRight className="h-4 w-4" />}
                    </Button>
                  </form>

                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-[#DBDBDB]" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-white px-3 text-[10px] font-semibold uppercase tracking-wider text-[#4E5964]">
                        o
                      </span>
                    </div>
                  </div>

                  {magicSent ? (
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-[8px] border border-[#2E9E5B]/30 bg-[#2E9E5B]/10 px-3 py-2.5 text-xs text-[#2E9E5B]",
                      )}
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Revisa tu correo y sigue el enlace para entrar.
                    </div>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleMagic}
                      disabled={loading}
                      variant="outline"
                      className="w-full h-11 gap-2 rounded-[8px] border-[#DBDBDB] text-[#0E1E2A] hover:bg-[#F8F9FA]"
                    >
                      <Wand2 className="h-4 w-4 text-[#E37439]" />
                      Entrar con enlace mágico
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold text-[#0E1E2A] sm:text-2xl">
                      Restablecer contraseña
                    </h2>
                    <p className="text-xs text-[#4E5964]">
                      Te enviaremos un enlace a tu correo para definir una nueva
                      contraseña.
                    </p>
                  </div>
                  <form onSubmit={handleForgot} className="mt-6 space-y-4">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="forgot-email"
                        className="text-xs font-semibold text-[#0E1E2A]"
                      >
                        Correo Electrónico
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4E5964]" />
                        <Input
                          id="forgot-email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="nombre@empresa.com"
                          className="pl-9 h-10 border-[#DBDBDB] bg-white text-xs text-[#1F2124] rounded-[8px] focus-visible:ring-[#E37439]"
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-11 gap-2 rounded-[8px] bg-[#E37439] text-white font-semibold hover:bg-[#C45B24] transition-colors shadow-soft"
                    >
                      {loading ? "Enviando..." : "Enviar enlace"}
                      {!loading && <ArrowRight className="h-4 w-4" />}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setMode("signin")}
                      className="w-full text-center text-[11px] font-semibold text-[#4E5964] hover:text-[#0E1E2A]"
                    >
                      Volver a iniciar sesión
                    </button>
                  </form>
                </>
              )}
            </div>

            <div className="mt-8 border-t border-[#DBDBDB] pt-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#4E5964]">
                <Shield className="h-3.5 w-3.5 text-[#2E9E5B]" />
                <span>Acceso Corporativo Seguro · Cifrado TLS 1.3</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
