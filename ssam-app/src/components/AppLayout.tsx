import React from "react";
import { Sidebar } from "./Sidebar";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth, ROLE_LABELS, ROLE_COLORS } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { CalidadDatosBanner } from "./CalidadDatosBanner";
import { RealtimeIndicator } from "./RealtimeIndicator";
import { startRealtime } from "@/data/operacion";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user } = useAuth();

  // Arranca la suscripción Realtime única (viva mientras hay sesión).
  React.useEffect(() => {
    startRealtime();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FA] text-[#1F2124] font-sans antialiased">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top Header: Clean white background, 1px border #DBDBDB */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#DBDBDB] bg-white px-6 gap-4">
          <div className="flex w-full max-w-md items-center gap-3">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4E5964]" />
              <Input
                placeholder="Buscar materiales, clientes o productos..."
                className="w-full h-9 border-[#DBDBDB] bg-[#F8F9FA] pl-9 text-xs text-[#1F2124] rounded-[8px] focus-visible:ring-[#E37439]"
              />
            </div>
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

            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 rounded-full text-[#4E5964] hover:bg-[#F8F9FA] hover:text-[#0E1E2A]"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#E37439] ring-2 ring-white" />
              </Button>
            </div>

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
          {children}
        </main>
      </div>
    </div>
  );
};
