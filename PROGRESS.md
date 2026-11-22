# Progreso del proyecto

## Fase actual: 3 - Terreno y chunks (completada)

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

## Fase 3 - Terreno y streaming de chunks (completada)

### Plan
- Añadir `src/world/` para cargar el manifest y gestionar chunks con radio de carga/descarga con histéresis y prioridad por distancia.
- Añadir un Web Worker para descomprimir CTA2, crear mallas con normales, colores de suelo desde superficies OSM, LOD 3 niveles y skirts anti-grietas.
- Añadir Rapier heightfields solo en chunks próximos, eventos de carga/descarga y límites por presupuesto de trabajo.
- Sustituir el cubo de diagnóstico en `src/main.ts` por el terreno, niebla, controles de cámara y panel F4 con bordes de chunk y contadores.
- Registrar licencia/dependencia en `DECISIONS.md` y progreso; validar chunks reales, navegación, lint, typecheck, tests y build.

### Hecho
- Mallas de terreno con normales, color según superficies OSM, tres niveles de detalle (2/4/8 m) y skirts de 4 m.
- Web Worker para verificar CTA2, descomprimir, validar tamaños y construir las mallas; SHA-256 y límites de tamaño comprobados antes de enviar datos al worker.
- Carga con prioridad por distancia, radio de 512 m y descarga a 614 m; colliders heightfield Rapier solo hasta 192 m; eventos de carga/descarga y panel F4 que dibuja perímetros elevados siguiendo las muestras del terreno.
- Corregido el número de celdas del heightfield: Rapier recibe `samples - 1` por eje junto a la matriz completa de muestras.
- Verificador Playwright repetible en `tools/verify-streaming.mjs` y `npm run verify:streaming`.

### Validación de fase 3
- `eslint`, `tsc -b`, 15 pruebas Vitest y build Vite pasan; build inicial gzip de 875 kB, inferior al límite de 25 MB.
- Navegación automatizada de 5 minutos en Edge con bordes F4 visibles: las 16 teselas descargadas, de 5 a 12 chunks activos, cero errores, máximo frame durante streaming 14,7 ms y cero intervalos mayores de 16 ms.
- Memoria geométrica estimada durante el recorrido: 6,9–16,5 MiB; al terminar queda en 11,0 MiB con 8 chunks activos. El contador incluye buffers CPU del overlay F4 y no memoria del driver GPU.
- En el arranque previo al primer chunk se midieron frames de 80,1 y 26,8 ms mientras se inicializaban física y terreno; no ocurrieron con el terreno activo.

### Cómo validar el streaming
- Inicia Vite en `http://127.0.0.1:5173/`.
- Ejecuta `npm run verify:streaming`; el recorrido automatizado dura 5 minutos y falla ante errores, frames activos >16 ms o teselas no visitadas. Se puede pasar una duración en milisegundos a `node tools/verify-streaming.mjs` para una comprobación breve.
- Prueba unitaria: la geometría del borde usa muestras de elevación y se eleva 0,15 m para evitar z-fighting.
- F4 alterna el panel y los bordes; la geometría de borde se eleva 0,15 m siguiendo el MDT05 para evitar z-fighting.

## Fase 4 - Red viaria (pendiente)

### Plan
- Ampliar la normalización OSM con nodos compartidos, sentidos, carriles, superficie, aceras, rampas, puentes, túneles, escaleras y nodos de cruce/señal; actualizar la consulta y refrescar solo la fuente OSM oficial necesaria.
- Generar un grafo navegable estable con nodos, segmentos por carril y conexiones de intersección, listo para IA futura; guardar hash y atribución.
- Añadir geometría fusionada por chunk para calzadas, aceras, bordillos, intersecciones, pasos peatonales y escaleras, ajustada a elevación MDT05 y con materiales repetibles por superficie.
- Añadir señalización vertical y semáforos instanciados en nodos OSM; crear colisionadores viales simplificados solo cerca del jugador.
- Integrar los datos y mallas en el worker/streaming y mostrar la ruta Plaza Mayor → Arco de la Estrella → Plaza de San Jorge en el inspector.
- Validar posición/topología contra OSM, ausencia de parpadeo entre superficies, presupuesto de draw calls, lint, typecheck, tests y build; registrar límites de datos ausentes sin inventarlos.

Alcance excluido en esta fase: vehículos y tráfico de IA.
