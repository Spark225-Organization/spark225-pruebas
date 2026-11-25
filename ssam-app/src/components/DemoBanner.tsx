// Aviso flotante del modo demo: recuerda que los datos son ficticios y deja
// cambiar de rol sin buscar el menú.
import { Repeat } from "lucide-react";
import { DEMO, rolDemo, salirDemo } from "@/lib/demo/demoState";

const DemoBanner = () => {
  if (!DEMO || !rolDemo()) return null;
  const rol = rolDemo() === "client" ? "cliente" : "administrador";
  return (
    <div className="fixed bottom-10 left-4 z-[60] flex items-center gap-3 rounded-full border border-[#DBDBDB] bg-white/95 py-1.5 pl-4 pr-1.5 text-xs shadow-card backdrop-blur">
      <span className="text-[#4E5964]">
        Demo como <b className="text-[#0E1E2A]">{rol}</b> · datos ficticios
      </span>
      <button
        type="button"
        onClick={salirDemo}
        className="inline-flex items-center gap-1 rounded-full bg-[#0E1E2A] px-3 py-1 font-semibold text-white hover:bg-[#E37439] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E37439]"
      >
        <Repeat className="h-3.5 w-3.5" />
        Cambiar rol
      </button>
    </div>
  );
};

export default DemoBanner;
