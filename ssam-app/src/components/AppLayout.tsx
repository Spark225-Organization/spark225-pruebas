import React, { Suspense } from "react";
import { Sidebar } from "./Sidebar";
import { Bell, Search, LogOut } from "lucide-react";
import { Marca } from "./Marca";
import { BuscadorGlobal } from "./BuscadorGlobal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth, ROLE_LABELS, ROLE_COLORS } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { CalidadDatosBanner } from "./CalidadDatosBanner";
import { RealtimeIndicator } from "./RealtimeIndicator";
import { startRealtime } from "@/data/operacion";

// Mientras se descarga una sección, el menú y la barra se quedan en su lugar.
const Cargando = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#E37439] border-t-transparent" />
  </div>
);

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, signOut } = useAuth();

  // Arranca la suscripción Realtime única (viva mientras hay sesión).
  React.useEffect(() => {
    startRealtime();
  }, []);

  // El cliente solo tiene una sección: sin barra lateral ni buscador global,
  // una barra superior limpia y el contenido centrado.
  if (user?.role === "client") {
    return (
      <div className="min-h-screen bg-[#F6F7F8] text-[#1F2124] font-sans antialiased">
        <header className="sticky top-0 z-30 border-b border-[#E3E6EA] bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
            <Marca tono="oscuro" ancho={104} />
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold leading-tight text-[#0E1E2A]">{user.name}</p>
                <p className="text-[11px] text-[#7A8590]">Portal de materiales</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E37439] text-xs font-bold text-white">{user.avatar}</div>
              <button type="button" onClick={() => signOut()} className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#4E5964] hover:bg-[#F3F4F6]" aria-label="Salir">
                <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8"><Suspense fallback={<Cargando />}>{children}</Suspense></main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FA] text-[#1F2124] font-sans antialiased">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top Header: Clean white background, 1px border #DBDBDB */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#DBDBDB] bg-white px-6 gap-4">
          <div className="flex w-full max-w-md items-center gap-3">
            <BuscadorGlobal />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Tag SSAM oficial */}
            <div className="hidden items-center gap-2 rounded-full border border-[#DBDBDB] bg-[#F8F9FA] px-3 py-1 md:flex">
              <span className="h-2 w-2 rounded-full bg-[#E37439]" />
              <span className="text-[11px] font-bold text-[#0E1E2A] tracking-wider uppercase">
                SSAM
              </span>
            </div>

            <div className="hidden md:block">
              <RealtimeIndicator />
            </div>

            <ThemeToggle />

            <div className="h-6 w-px bg-[#DBDBDB]" />

            {user && (
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E37439] font-bold text-white text-xs">
                  {user.avatar}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-[#0E1E2A] leading-tight">
                    {user.name}
                  </p>
                  <Badge
                    className={cn(
                      "mt-0.5 text-[9px] font-semibold px-1.5 py-0 h-4 border-0 inline-flex items-center",
                      ROLE_COLORS[user.role],
                    )}
                  >
                    {ROLE_LABELS[user.role]}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Content Area: #F8F9FA, ample white space */}
        <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-6 lg:p-8">
          <CalidadDatosBanner />
          <Suspense fallback={<Cargando />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
};
