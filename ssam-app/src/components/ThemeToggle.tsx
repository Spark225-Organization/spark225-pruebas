// Selector de tema para el header: alterna entre "Light Corporate" (claro)
// y "Obsidian Slate" (oscuro). Usa next-themes, que aplica la clase .dark en
// el <html> y persiste la preferencia del usuario.
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = theme === "dark";
  const label = isDark ? "Activar modo claro" : "Activar modo oscuro";

  const toggle = () => {
    const html = document.documentElement;
    html.classList.add("theme-transition");
    setTheme(isDark ? "light" : "dark");
    window.setTimeout(() => html.classList.remove("theme-transition"), 220);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={toggle}
          className="h-9 w-9 rounded-full text-[#4E5964] hover:bg-[#F8F9FA] hover:text-[#0E1E2A]"
        >
          {mounted ? (
            isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {isDark
          ? "Modo claro (Light Corporate)"
          : "Modo oscuro (Obsidian Slate)"}
      </TooltipContent>
    </Tooltip>
  );
}
