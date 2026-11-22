# Decisiones técnicas

## 2026-11-22 - Base de fase 0
- Usar Vite, TypeScript estricto y Three.js para el esqueleto WebGL 2 solicitado.
- Mantener la UI de depuración en DOM/CSS, separada del canvas 3D.
- GitHub Pages publica `dist/` mediante Actions. Se usan URLs relativas para que los assets funcionen en el subdirectorio del repositorio.
- La escena de diagnóstico con cubo se retira al sustituirse por terreno real en la fase 3.
- ECS usa capacidad fija, SoA en arreglos tipados y handles con generación para evitar asignaciones por entidad en el bucle caliente.
- La simulación corre a 60 Hz, limita la recuperación a cinco pasos por fotograma y el render interpola el giro de diagnóstico.
- GLB se carga con MeshoptDecoder; KTX2 usa el transcodificador Basis servido desde el mismo sitio y se atribuye por separado.
# Fase 2 - datos geográficos

- La región inicial es un rectángulo proyectado de 1 km centrado en Plaza Mayor; EPSG:25829 permite medir chunks y huellas en metros.
- Overpass se usa solo durante la preparación de datos. La respuesta se conserva localmente bajo `data/raw/` (ignorada por git); el cliente del juego consume los chunks estáticos.
- El terreno requiere el MDT05 CNIG reproyectado a EPSG:25829 en formato ESRI ASCII Grid. El constructor falla cuando falta para impedir elevaciones inventadas.
- Se empaquetan chunks con cabecera `CTA2`, versión, tamaño sin comprimir y payload JSON deflate para facilitar una futura carga selectiva.
- Los nombres de negocios se reemplazan por identidades ficticias; nombres reales detectados se reportan por id OSM/categoría sin conservar el nombre original en el reporte.
- Overpass entregó el extracto para el bbox el 2026-11-22; el JSON se conserva en caché local ignorada por Git.
- El WCS oficial IGN/CNIG sirve `Elevacion25830_5` recortada y reproyectada a EPSG:25829 como ASCII Grid; se conserva su hash, tamaño de celda y fecha en metadatos locales.
- El proveedor WCS entrega `dx` y `dy` independientes sin siempre incluir `NODATA_value`; el lector admite ambos formatos y clampa al centro de celda en el borde para cubrir la malla solicitada sin huecos.

# Fase 3 - terreno y streaming

- `@dimforge/rapier3d-compat` 0.12.0 se declara como dependencia de ejecución para crear heightfields; su licencia Apache-2.0 se revisó en los metadatos oficiales del paquete.
- El worker del navegador verifica la cabecera CTA2 y tamaño antes de descomprimir; también construye niveles de detalle de 2, 4 y 8 m, normales, colores de superficies OSM y skirts de 4 m.
- Se carga dentro de 512 m del centro de chunk y se conserva hasta 614 m (histéresis); heightfields Rapier solo se crean dentro de 192 m.
- El worker procesa descompresión y malla; el hilo principal anexa geometría con presupuesto aproximado de 5 ms por frame. El panel F4 muestra memoria de buffers de geometría estimada, chunks, colliders y pico de frame.
- El color base es hierba si no hay polígono superficial OSM en el punto. Esto es solo un valor visual; no cambia los datos de elevación ni la geometría.
- Rapier 0.12 espera el número de celdas por eje (`samples - 1`) y una matriz column-major de `samples * samples`; la prueba integrada crea un collider real para evitar que una incompatibilidad de dimensiones llegue al navegador.
- La validación automatizada de cinco minutos con el overlay F4 activo muestra frames de streaming de hasta 14,7 ms, cero intervalos >16 ms y buffers geométricos estimados de 6,9–16,5 MiB; la fase de inicialización previa al primer chunk se registra aparte.
- Los bordes de depuración F4 siguen la elevación muestreada de cada perímetro y se elevan 0,15 m sobre la malla; sus buffers cuentan en la estimación de memoria mientras el overlay está visible.
