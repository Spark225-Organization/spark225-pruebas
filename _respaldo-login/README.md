# Respaldo del login del SSAM

`auth.original.tsx` es el archivo de login exportado de AI Studio el 24 nov 2026, sin cambios.

En pruebas el login está desactivado con la variable `VITE_SSAM_BYPASS_LOGIN: "1"` en `.github/workflows/pages.yml`: la app entra directo como admin. Para volver al login real con Supabase solo hay que borrar esa línea; el código de login sigue completo en `ssam-app/src/lib/auth.tsx`.
