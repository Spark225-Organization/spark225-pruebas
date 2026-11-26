// Entrada del modo demo: se elige el rol en lugar de escribir contraseña.
// Solo existe en el sitio de pruebas (VITE_SSAM_DEMO=1).
import { Building2, ShieldCheck, RotateCcw, Palette } from "lucide-react";
import { Marca } from "@/components/Marca";
import { entrarDemo, DEMO_LABORATORIOS } from "@/lib/demo/demoState";
import { reiniciarDemo } from "@/lib/demo/fakeSupabase";
import { toast } from "sonner";

const opciones = [
  {
    rol: "admin" as const,
    icono: ShieldCheck,
    titulo: "Entrar como administrador",
    texto: "Lo que ve Carlos: todos los clientes, el tablero, el kanban, el riesgo, la planeación y los reportes.",
  },
  {
    rol: "disenador" as const,
    icono: Palette,
    titulo: "Entrar como Paco",
    texto: "Diseño y cuenta directa con el cliente: sus clientes en carpetas, subir versiones, corregir lo que pide el cliente, cambiar estatus y conversar.",
  },
  {
    rol: "client" as const,
    icono: Building2,
    titulo: "Entrar como cliente",
    texto: "Lo que ve un laboratorio en su portal: revisa, marca correcciones sobre la pieza y aprueba o rechaza. Elige el laboratorio:",
  },
];

const SelectorDemo = () => (
  <div className="relative flex min-h-screen flex-col bg-[#F8F9FA] font-sans text-[#1F2124]">
    <div className="h-1 w-full bg-gradient-spark-brand shrink-0" aria-hidden="true" />
    <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl">
        <div className="mb-8 flex flex-col items-start gap-4">
          <Marca tono="oscuro" ancho={120} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0E1E2A] sm:text-3xl">
              Sistema de Aprobación de Materiales
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[#4E5964]">
              Versión de prueba con datos ficticios. Elige cómo quieres verlo; puedes cambiar de rol cuando quieras.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {opciones.map(({ rol, icono: Icono, titulo, texto }) =>
            rol === "client" ? (
              <div key={rol} className="flex flex-col items-start gap-3 rounded-[10px] border border-[#DBDBDB] bg-white p-6 text-left shadow-card">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#E37439]/10 text-[#E37439]">
                  <Icono className="h-5 w-5" />
                </span>
                <span className="text-base font-bold text-[#0E1E2A]">{titulo}</span>
                <span className="text-xs leading-relaxed text-[#4E5964]">{texto}</span>
                <div className="mt-1 flex w-full flex-col gap-1.5">
                  {DEMO_LABORATORIOS.map((l) => (
                    <button
                      key={l.empresa}
                      type="button"
                      onClick={() => entrarDemo("client", l.empresa)}
                      className="rounded-lg border border-[#DBDBDB] px-3 py-2 text-left text-xs font-semibold text-[#0E1E2A] transition-colors hover:border-[#E37439] hover:text-[#E37439] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E37439]"
                    >
                      {l.nombre}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
            <button
              key={rol}
              type="button"
              onClick={() => entrarDemo(rol)}
              className="group flex flex-col items-start gap-3 rounded-[10px] border border-[#DBDBDB] bg-white p-6 text-left shadow-card transition-colors hover:border-[#E37439] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E37439]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#E37439]/10 text-[#E37439]">
                <Icono className="h-5 w-5" />
              </span>
              <span className="text-base font-bold text-[#0E1E2A] group-hover:text-[#E37439]">{titulo}</span>
              <span className="text-xs leading-relaxed text-[#4E5964]">{texto}</span>
            </button>
            ),
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-[#8894A0]">
          <span>Los cambios que hagas se guardan solo en este navegador.</span>
          <button
            type="button"
            onClick={() => {
              reiniciarDemo();
              toast.success("Datos de prueba restablecidos");
            }}
            className="inline-flex items-center gap-1.5 font-semibold text-[#4E5964] hover:text-[#E37439]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restablecer datos de prueba
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default SelectorDemo;
