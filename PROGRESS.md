# Progreso del proyecto

## Fase actual: 3 - Terreno y chunks

### Hecho
- Repositorio inicializado desde `hhg-ptm/CTA`.
- Leída la guía de fases: comienza con una base Vite/TypeScript y no añade juego todavía.
- Esqueleto Vite/TypeScript estricto, Three.js/WebGL2 y GitHub Actions para Pages.
- Escena de diagnóstico y panel FPS/draw calls/triángulos con tecla F3.
- Documentos `AGENTS.md`, `PROGRESS.md`, `DECISIONS.md` y `ATTRIBUTION.md`.
- Validación local: lint, typecheck, 1 prueba unitaria, build y comprobación visual en navegador.
- Fase 1: bucle fijo a 60 Hz con guardia de cinco pasos y render interpolado.
- ECS de capacidad fija con arreglos tipados, handles generacionales y recorrido sin crear objetos transform por entidad.
- EventBus tipado, logger con niveles, calidad por presets, entrada WASD/ratón/gamepad, cámaras libre y orbital.
- AssetManager con caché, prioridad de carga GLB, progreso, KTX2, Meshopt y transcodificador Basis local.
- Pruebas de ECS, eventos y orden/determinismo del bucle; 10.000 pasos reproducibles.
- Validación fase 1: lint, typecheck, 6 pruebas y build pasan; escena local observada a 75 FPS con 2 draw calls.

### Pendiente
- Activar GitHub Pages con origen GitHub Actions en Settings > Pages. El despliegue requiere publicar el commit de la fase 0 en `main`.

### Cómo probar
- `npm install`
- `npm run dev`
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- Despliegue en GitHub Actions a Pages tras habilitar Pages desde Actions en la configuración del repositorio.

## Fase 2 - Pipeline de datos geográficos (completada)

### Plan
- Definir `cc-monumental` alrededor de Plaza Mayor en EPSG:25829 y documentar OpenStreetMap ODbL y CNIG MDT05 CC BY 4.0.
- Implementar consulta Overpass con caché local, conversión de geometría, proyección UTM, normalización de categorías, filtro de marcas y empaquetado CTA2 comprimido.
- Añadir lector local de ESRI ASCII Grid, manifiesto con hashes, informes de fidelidad/marcas e inspector 2D.
- Añadir fixtures locales para proyección, muestreo de elevación, normalización y sustitución de nombres comerciales.
- Descargar y validar el extracto OSM (4.549 elementos) y una malla regional MDT05 servida por WCS oficial IGN/CNIG en EPSG:25829.
- Generar 16 chunks deterministas con cabecera CTA2, hashes SHA-256, malla de terreno cuantizada y geometría normalizada.
- Validación local: lint, typecheck, 11 pruebas y build pasan; cero muestras de terreno ausentes.

Los datos fuente se guardan en caché local ignorada por git; el juego usa los chunks estáticos y no consulta servicios remotos. El informe registra edificios sin altura y comercios por revisar, sin inventar alturas ni conservar nombres reales de negocios.

### Cómo probar la fase 2
- `npm run data:build` usa cachés locales; descarga automáticamente el extracto OSM o MDT05 que falte.
- `npm run data:build:fresh` vuelve a descargar ambas fuentes oficiales.
- `npm run data:elevation` renueva solo la tesela MDT05 acotada de la región.
- Abrir `/debug/map.html` con el servidor Vite después de generar el manifest.
