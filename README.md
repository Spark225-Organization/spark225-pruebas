# pruebas.spark225.com

Sitio de pruebas de spark225.com. Aquí se hacen los experimentos; Google no lo indexa (noindex + robots.txt) y tiene una barra naranja de «SITIO DE PRUEBAS».

Flujo: `spark/sitio-herramientas/sincronizar.py a-pruebas` copia producción aquí; `a-produccion` pasa lo aprobado a `spark225-web` (quita la barra y el noindex y regresa el dominio).
