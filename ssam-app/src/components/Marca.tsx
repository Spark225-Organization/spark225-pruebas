// Marca Spark225 en horizontal: símbolo + palabra «SPARK 225», sin «Consulting
// Firm» (las guías de marca piden quitarlo en tamaños pequeños). Sale de los
// archivos oficiales servidos por el propio sitio (public/marca), así que no
// depende de servidores externos ni se recorta.
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL || "/";
const LOGO = `${BASE}marca/logo.png`; // 800×436: símbolo arriba, palabra abajo (y 258–436)
const SIMBOLO = `${BASE}marca/simbolo.png`;
const PROP_PALABRA = 178 / 800; // alto/ancho de la franja de la palabra

export function Marca({
  tono = "claro",
  ancho = 112,
  className,
}: {
  /** "claro": letras blancas (fondos oscuros). "oscuro": colores oficiales (fondos claros). */
  tono?: "claro" | "oscuro";
  /** Ancho de la palabra en px. */
  ancho?: number;
  className?: string;
}) {
  const alto = Math.round(ancho * PROP_PALABRA);
  const tamLogo = `${ancho}px auto`;
  const palabra =
    tono === "claro"
      ? {
          // La palabra recortada del logo oficial, pintada en blanco.
          backgroundColor: "#FFFFFF",
          WebkitMaskImage: `url(${LOGO})`,
          maskImage: `url(${LOGO})`,
          WebkitMaskSize: tamLogo,
          maskSize: tamLogo,
          WebkitMaskPosition: "0 100%",
          maskPosition: "0 100%",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
        }
      : {
          backgroundImage: `url(${LOGO})`,
          backgroundSize: tamLogo,
          backgroundPosition: "0 100%",
          backgroundRepeat: "no-repeat",
        };
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)} role="img" aria-label="Spark225">
      <img src={SIMBOLO} alt="" className="h-8 w-auto shrink-0" style={{ height: Math.round(alto * 1.25) }} />
      <span aria-hidden="true" className="block shrink-0" style={{ width: ancho, height: alto, ...palabra }} />
    </span>
  );
}
