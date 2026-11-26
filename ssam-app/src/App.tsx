import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { queryClient } from "@/data/operacion";
import Login from "./pages/Login";
import SelectorDemo from "./pages/SelectorDemo";
import DemoBanner from "./components/DemoBanner";
import { DEMO } from "./lib/demo/demoState";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import { AppLayout } from "./components/AppLayout";
import { AuthProvider, useAuth, type RolePermissions } from "./lib/auth";
import { lazy, Suspense } from "react";

// Cada sección se descarga al abrirla: el cliente no baja los tableros internos.
const Index = lazy(() => import("./pages/Index"));
const Materials = lazy(() => import("./pages/Materials"));
const MaterialDetail = lazy(() => import("./pages/MaterialDetail"));
const Clients = lazy(() => import("./pages/Clients"));
const Products = lazy(() => import("./pages/Products"));
const Indications = lazy(() => import("./pages/Indications"));
const Team = lazy(() => import("./pages/Team"));
const Reports = lazy(() => import("./pages/Reports"));
const RoleManagement = lazy(() => import("./pages/RoleManagement"));
const Kanban = lazy(() => import("./pages/Kanban"));
const Riesgo = lazy(() => import("./pages/Riesgo"));
const Planeacion = lazy(() => import("./pages/Planeacion"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const Calidad = lazy(() => import("./pages/Calidad"));
const MisClientes = lazy(() => import("./pages/MisClientes"));

const PendingActivation = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8F9FA] p-6 text-center">
    <div className="rounded-full bg-[#F5C245]/15 p-6">
      <span className="text-3xl">⏳</span>
    </div>
    <h1 className="text-2xl font-bold text-[#0E1E2A]">
      Cuenta pendiente de activación
    </h1>
    <p className="max-w-sm text-sm text-[#4E5964]">
      Tu cuenta está pendiente de activación por un administrador. Cuando se te
      asigne un rol o un cliente, podrás acceder a la plataforma.
    </p>
  </div>
);

const ProtectedRoute = ({
  children,
  permission,
}: {
  children: React.ReactNode;
  permission?: keyof RolePermissions;
}) => {
  const { user, can } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !can(permission)) {
    // Un cliente externo que intenta abrir una ruta interna va a su portal.
    if (can("clientPortal")) return <Navigate to="/portal" replace />;
    // Paco (diseño y cuentas) empieza en sus clientes, sin tableros internos.
    if (can("misClientes")) return <Navigate to="/mis-clientes" replace />;
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
          <div className="rounded-full bg-destructive/10 p-6">
            <span className="text-4xl">🔒</span>
          </div>
          <h2 className="text-2xl font-bold">Acceso Restringido</h2>
          <p className="text-muted-foreground max-w-sm">
            No tienes permisos para ver esta sección. Contacta al administrador
            para solicitar acceso.
          </p>
        </div>
      </AppLayout>
    );
  }
  return <AppLayout>{children}</AppLayout>;
};

const AppRoutes = () => {
  const { user, loading, pendingActivation, can } = useAuth();
  const homePath = can("clientPortal") ? "/portal" : !can("dashboard") && can("misClientes") ? "/mis-clientes" : "/";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E37439] border-t-transparent" />
      </div>
    );
  }

  if (pendingActivation) return <PendingActivation />;

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={homePath} replace /> : DEMO ? <SelectorDemo /> : <Login />}
      />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/"
        element={
          <ProtectedRoute permission="dashboard">
            <Index />
          </ProtectedRoute>
        }
      />
      <Route
        path="/planeacion"
        element={
          <ProtectedRoute permission="planeacion">
            <Planeacion />
          </ProtectedRoute>
        }
      />
      <Route
        path="/materials"
        element={
          <ProtectedRoute permission="materials">
            <Materials />
          </ProtectedRoute>
        }
      />
      <Route
        path="/materials/:id"
        element={
          <ProtectedRoute permission="materials">
            <MaterialDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients"
        element={
          <ProtectedRoute permission="clients">
            <Clients />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute permission="products">
            <Products />
          </ProtectedRoute>
        }
      />
      <Route
        path="/indications"
        element={
          <ProtectedRoute permission="indications">
            <Indications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/team"
        element={
          <ProtectedRoute permission="team">
            <Team />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute permission="reports">
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/roles"
        element={
          <ProtectedRoute permission="roles">
            <RoleManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kanban"
        element={
          <ProtectedRoute permission="advanceStage">
            <Kanban />
          </ProtectedRoute>
        }
      />
      <Route
        path="/riesgo"
        element={
          <ProtectedRoute permission="risk">
            <Riesgo />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calidad"
        element={
          <ProtectedRoute permission="roles">
            <Calidad />
          </ProtectedRoute>
        }
      />
      <Route
        path="/portal"
        element={
          <ProtectedRoute permission="clientPortal">
            <ClientPortal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mis-clientes"
        element={
          <ProtectedRoute permission="misClientes">
            <MisClientes />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// El portal del cliente está diseñado solo en claro y no tiene selector de
// tema; si en ese navegador alguien dejó el modo oscuro del admin, se mezclaban
// los dos. Para un cliente el tema queda fijo en claro.
const TemaSegunRol = ({ children }: { children: React.ReactNode }) => {
  const { user, can } = useAuth();
  const cliente = !!user && can("clientPortal") && !can("dashboard");
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme={cliente ? "light" : undefined}>
      {children}
    </ThemeProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TemaSegunRol>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Suspense
              fallback={
                <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA]">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E37439] border-t-transparent" />
                </div>
              }
            >
              <AppRoutes />
            </Suspense>
            <DemoBanner />
          </BrowserRouter>
        </TooltipProvider>
      </TemaSegunRol>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
