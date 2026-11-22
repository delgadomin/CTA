# Progreso del proyecto

## Fase actual: 5 - Edificios

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

## Fase 4 - Red viaria (completada)

### Plan
- Ampliar la normalización OSM con nodos compartidos, sentidos, carriles, superficie, aceras, rampas, puentes, túneles, escaleras y nodos de cruce/señal; actualizar la consulta y refrescar solo la fuente OSM oficial necesaria.
- Generar un grafo navegable estable con nodos, segmentos por carril y conexiones de intersección, listo para IA futura; guardar hash y atribución.
- Añadir geometría fusionada por chunk para calzadas, aceras, bordillos, intersecciones, pasos peatonales, flechas, marcas de stop/ceda y escaleras, ajustada a elevación MDT05 y con materiales repetibles por superficie.
- Añadir señalización vertical y semáforos instanciados en nodos OSM; crear colisionadores viales simplificados solo cerca del jugador.
- Integrar los datos y mallas en el worker/streaming y mostrar la ruta Plaza Mayor → Arco de la Estrella → Plaza de San Jorge en el inspector.
- Validar posición/topología contra OSM, ausencia de parpadeo entre superficies, presupuesto de draw calls, lint, typecheck, tests y build; registrar límites de datos ausentes sin inventarlos.

### Hecho
- Consulta Overpass actualizada y renovada: 4.561 elementos; se incluyen 156 nodos de cruce, 10 semáforos y 6 cedas el paso.
- Las 689 vías conservan nodos, sentidos, carriles, anchos/superficies conocidos, aceras y atributos de puentes/túneles/escaleras.
- `road-network.json` generado con 2.433 nodos, 2.744 segmentos, 569 intersecciones y 4.144 conexiones; manifiesto guarda tamaño y SHA-256.
- Mallas de calzada por superficie con UV repetibles y desgaste de vértice estable, aceras/bordillos inferidos, áreas peatonales rellenas, parches de intersección, curvas limitadas a 0,3 m, pasos zebra, carriles, flechas y líneas de stop/ceda.
- Puentes con perfil de tablero visual y rampas; túneles conservan la cota MDT05 mientras se difiere la excavación del terreno. Pasos `highway=steps` tienen peldaños individuales.
- Semáforos, cedas, stops y farolas se dibujan como lotes instanciados; los colliders triangulares de calles se activan junto a la altura del terreno en chunks cercanos.
- El inspector 2D resalta el trayecto de 403 m Plaza Mayor → Arco de la Estrella → Plaza de San Jorge desde elementos OSM confirmados; el manifiesto y el verificador validan tamaño, SHA-256 y referencias del grafo/ruta.

### Validación de fase 4
- `eslint .`, `tsc -b --pretty`, 26 pruebas Vitest y build Vite pasan; el build gzip de 887,8 kB permanece debajo del máximo de 25 MB.
- Recorrido automatizado de 5 minutos con carrera de QA: 16/16 chunks descargados; 5–16 activos; 75 FPS; máximo 53 llamadas de dibujo y 186.927 triángulos, frente a límites de 300 y 600.000.
- Máximo de frame durante streaming: 15,7 ms; cero intervalos >16 ms. Memoria geométrica estimada: 9–28,7 MiB, termina en 14,6 MiB con 8 chunks activos. Dos intervalos iniciales (20,5 y 93,4 ms) ocurrieron antes del primer chunk mientras arrancaba Rapier.
- El inspector confirma 689 calles, 2.847 edificios, 5.156 elementos y la ruta de referencia de 403 m; el grafo conserva one-way para futura IA y la ruta peatonal admite ambos sentidos.

### Cómo validar la fase 4
- `npm run data:build` reconstruye los chunks y el grafo desde cachés locales.
- `node tools/verify-world.mjs` comprueba integridad/hash, topología, ruta y nombres bloqueados.
- `npm run dev` y abrir `/debug/map.html` para comparar el trayecto con OpenStreetMap.
- `node tools/verify-streaming.mjs` hace el barrido de cinco minutos; falla si no visita las 16 teselas, rebasa 300 llamadas/600.000 triángulos, supera 16 ms durante streaming o no carga la ruta del inspector.
- Alcance excluido de la fase 4: vehículos y tráfico de IA.

## Fase actual: 6 - Hitos y fidelidad (en curso)

## Fase 5 - Edificios (completada)

### Plan
- Conservar id OSM/Catastro, huella, altura/planta, `roof:shape`, tipo y zona; extraer geometría comercial para reservar una cara de rótulo y puntos de tejado para hitos de fase 6.
- Implementar extrusión de huellas con jerarquía `height=*` → `building:levels * 3 m` → default por zona/tipo, y cubiertas planas/a dos/a cuatro aguas por etiqueta y heurística de huella.
- Crear atlas procedural modular de fachada por zona, sembrado por id de edificio, con zócalo, plantas, balcones/ventanas/cornisa, ventanas emisivas deterministas y geometría low-poly de escudos/portadas sin textos.
- Generar tres LOD (fachada, caja texturizada, silueta) fusionados por chunk/material, colisiones simplificadas por huella y sustitución automática cuando exista `public/landmarks/<id>.glb`.
- Integrar los edificios en worker y streaming, ampliar el inspector 2D y verificar la silueta monumental, la distinción casco/ensanche/periferia, draw calls, triángulos, tests, lint, typecheck y build.

### Hecho hasta ahora
- Extraída la especificación del PDF (página 10): el alcance excluye modelos de hitos y rótulos finales, que corresponden a las fases 6 y 7.
- Las 2.847 huellas fuente conservan id OSM, etiquetas de altura/plantas, tipo, cubierta, material y etiqueta comercial; 2.811 caen en el recorte de chunks. Los 36 edificios exteriores permanecen fuera del mundo jugable. Los defaults visuales no sustituyen los valores OSM faltantes.
- Zonas heurísticas casco/ensanche/periferia por tipos monumentales y distancia al origen: 447 / 1.904 / 460 edificios dentro del mundo.
- Tres LOD de edificios fusionados por chunk/material; extrusión de huella, fachadas modulares por zona, zócalos, ventanas, balcones, cornisa, cubiertas planas/a dos/a cuatro aguas y colisión perimetral simplificada.
- Semilla estable por id para variación de fachada y emisividad de ventanas; reserva de cara comercial hacia la calle y anclas de tejado del casco para fase 6.
- Reemplazo opcional por `public/landmarks/<id>.glb`; el constructor limita tamaño, estructura, extensiones, número de vértices/texturas y URIs a recursos embebidos PNG/JPEG.
- Inspector 2D colorea las tres zonas; los chunks y el informe de fidelidad guardan la clasificación y los valores visuales inferidos.

### Validación de fase 5
- `eslint .`, `tsc -b --pretty`, 32 pruebas Vitest, `vite build` y `node tools/verify-world.mjs` pasan. Bundle inicial gzip: 944,2 kB; debajo de 25 MB.
- Verificación automatizada de 5 minutos: 16/16 chunks; 5–16 activos; 75 FPS; máximo 85 draw calls y 303.477 triángulos; pico de frame durante streaming 15,6 ms y cero intervalos >16 ms.
- Memoria geométrica estimada: 23,9–70,8 MiB; termina en 32,4 MiB con 8 chunks. El arranque previo al primer chunk tuvo frames de 26,6, 93,4, 26,7 y 40 ms durante inicialización de física, fuera del streaming.
- No hay GLB de hitos en el repositorio, así que el reemplazo se valida con fixtures acotados; modelos manuales y rótulos visibles quedan fuera de esta fase.

### Cómo validar la fase 5
- `node tools/data-build.mjs` regenera los chunks desde las cachés OSM/MDT05 locales; `node tools/verify-world.mjs` valida integridad, conteos de zona y referencias.
- Ejecutar `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` y `node tools/verify-streaming.mjs` desde la raíz del repositorio.
- `/debug/map.html` compara las huellas y zonas con OSM; el QA 3D comprueba streaming, LOD y presupuesto visible.

## Fase 6 - Hitos y fidelidad (en curso)

### Hecho hasta ahora
- Añadido un catálogo de hitos de referencia basado en la lista de la guía. Los objetivos de `cc-monumental` se distinguen de los que requieren una futura región de ciudad.
- El pipeline audita nombres OSM de vías, edificios no comerciales, superficies y POIs con coincidencia exacta normalizada; el informe enlaza los IDs fuente.
- La consulta incluye plazas (`place=square`) y relaciones históricas. La normalización conserva sus IDs como `r<number>` y calcula un centro de referencia desde miembros exteriores, sin usarlo como huella.
- Se confirmó la relación OSM `r5728957` del Palacio de los Golfines de Abajo; no se confunde con el Palacio de los Golfines de Arriba.
- Los 13 de 13 hitos de `cc-monumental` aparecen en el extracto OSM regenerado. Las otras 6 referencias quedan fuera del alcance de esta región.
- Añadida una silueta procedural low-poly del Arco de la Estrella anclada al POI OSM y orientada desde la vía más cercana, además de almenado aproximado para torres. Se añadió un material procedural de piedra y un fallback visual de 7 plantas solo para torres sin altura/plantas fuente.
- Las áreas `place=square` ya se procesan como superficies y POIs: sus huellas OSM se renderizan en el terreno con la clasificación de piedra.
- Las líneas `barrier=city_wall` se conservan y reciben una silueta de muralla sobre su trazado OSM, con medidas visuales aproximadas documentadas por ausencia de cotas.
- El informe de hitos ahora indica la geometría fuente disponible (huella, polígono, trazado, vía o punto/centro); evita tratar un POI sin huella como si fuera un edificio modelable.
- Añadido el catálogo canónico de fase 6 con 19 entradas, una ficha Markdown por hito y `status.json` en pendiente. El pipeline incorpora posiciones, huellas y alturas solo cuando la extracción OSM las aporta; los hitos exteriores siguen sin fuente geométrica en la región actual.
- Añadido `npm run fidelity`: compara directamente las vías y huellas OSM con los chunks y falla si falta geometría, aparece una forma inesperada o supera 1 m. La comprobación local comparó 3.486 vías/huellas con desviación máxima 0,0000 m.
- El inspector 2D puede superponer trazados OSM originales y huellas de edificio sobre el mundo; queda pendiente la revisión visual humana.
- La extracción nueva incluye `barrier=city_wall`; los chunks regenerados conservan sus tramos. Se añadieron cigüeñas low-poly en torres y una selección estable de tejados del casco; al acercarse el jugador baten las alas y despegan, y vuelven a posarse cuando se aleja.
- El data build regeneró 16 chunks; el verificador confirmó hashes, terreno, ruta y ausencia de nombres comerciales bloqueados.

### Pendiente
- Completar los modelos específicos de soportales de Plaza Mayor, Concatedral, escalinata de San Francisco Javier y Torre de las Cigüeñas. El punto OSM de esta última no trae una huella, así que necesita revisión de referencia antes de modelar.
- Ampliar la fuente geográfica para los seis hitos fuera de la región actual.
- Ejecutar lint, typecheck, pruebas, build y revisión visual; ningún hito puede pasar a aprobado sin comparación humana con fotografías. Este entorno no tiene npm/node_modules; la instalación con pnpm fue bloqueada al crear el enlace de dependencias.
