import { useAuth } from "@/lib/auth";
import { ManagementDashboard } from "./ManagementDashboard";
import { OperationalDashboard } from "./OperationalDashboard";

const Index = () => {
  const { user } = useAuth();
  // Admin: dashboard de dirección. Roles operativos: dashboard operativo.
  return user?.role === "admin" ? (
    <ManagementDashboard />
  ) : (
    <OperationalDashboard />
  );
};

export default Index;
