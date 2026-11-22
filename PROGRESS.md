# Progreso del proyecto

## Fase actual: 2 - Pipeline de datos geográficos

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

## Fase 2 - Pipeline de datos geográficos

### Plan
- Consultar fuentes geográficas verificables para definir el rectángulo de `cc-monumental` y documentar procedencia/licencia.
- Añadir configuración de región, descarga con reintentos y caché local, normalización y proyección EPSG:25829.
- Generar chunks/manifest deterministas, informe de fidelidad, revisión de marcas e inspector 2D sin llamadas de red durante el juego.
- Probar con fixtures sin red y verificar hashes/estabilidad; después ejecutar lint, typecheck, pruebas y build.

### Pendiente
- Implementar la fase geográfica; no fabricar datos cuando falte una fuente verificable.
