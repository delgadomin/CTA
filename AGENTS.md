# Cáceres Criminal - instrucciones del proyecto

## Objetivo

Construye Cáceres Criminal, un juego 3D de mundo abierto para navegador ambientado en una recreación fiel de Cáceres (Extremadura, España). El mundo debe crecer mediante datos y chunks; no inventes geografía ni uses marcas, modelos, música o código de GTA/Rockstar ni de otros juegos. Las marcas y negocios reales se sustituyen por identidades ficticias originales.

## Reglas innegociables

- Fidelidad geográfica: calles, plazas, circulación, huellas de edificios, plantas, relieve y monumentos deben derivarse de fuentes reales verificables. Nunca inventes datos; registra valores por defecto y faltantes en `DECISIONS.md` e informes de fidelidad.
- Fuentes geográficas se descargan una vez y se procesan localmente. No llames APIs externas durante el juego. Registra atribuciones y licencias en `ATTRIBUTION.md`.
- Escalabilidad: mundo basado en datos, chunks y carga incremental. Mantén 60 fps en equipo modesto; objetivo ≤300 draw calls, ≤600.000 triángulos visibles, carga inicial <25 MB y memoria <1 GB.
- Arte low-poly estilizado bien ejecutado, con siluetas, materiales, iluminación y animación cuidadas.
- TypeScript estricto, Vite, Three.js/WebGL2, Rapier/WASM para físicas, ECS ligero propio, Web Workers para tareas pesadas y UI DOM/CSS. Justifica dependencias nuevas en `DECISIONS.md` y revisa su licencia.
- Código y commits en inglés; textos del juego en español con claves i18n desde el inicio.

## DIRECTRICES ESTRATÉGICAS PRIORITARIAS: INSPIRACIÓN «BADAJOZ: EL JUEGO» Y «GAMEDEV-SKILLS»

A partir de noviembre de 2026, todo agente o desarrollador que trabaje en este repositorio debe aplicar la estrategia documentada exhaustivamente en la carpeta [`strategy/`](strategy/README.md), diseñada para hacer el desarrollo mucho más fácil, ágil y cualitativo siguiendo el modelo de éxito de **Badajoz: El Juego** (creado por Alfredo Narváez) y **gamedev-skills**:

1. **Prioridad absoluta a Assets GLB sobre procedurales en código ([ASSET_AND_DATA_PIPELINE.md](strategy/ASSET_AND_DATA_PIPELINE.md)):**
   - **NO** ensambles vehículos, monumentos o mobiliario uniendo cubos y cilindros en código TypeScript salvo como fallback temporal.
   - Utiliza modelos 3D en formato `.glb` preoptimizados (licencias CC0/CC-BY como Kenney, Quaternius o Poly Haven, o modelos modelados en Blender) cargados mediante `AssetManager`. Esto ahorra semanas de código manual y ofrece una calidad visual profesional inmediata.
2. **Cruce de Datos Abiertos Oficiales (Catastro + OSM + IGN):**
   - Incorpora alturas reales y direcciones de portales extraídas de la cartografía vectorial del Catastro de España y viales/paradas de OSM, tal y como hizo *Badajoz* para recrear 12.000 portales reales.
3. **Desarrollo Gameplay-First con Identidad Local ([GAMEPLAY_AND_MISSIONS.md](strategy/GAMEPLAY_AND_MISSIONS.md)):**
   - Prioriza la jugabilidad y la diversión inmediata mediante oficios locales: conductor del autobús urbano de Cáceres (Líneas 1 y 8), repartidor por el casco histórico y la judería, guía turístico por la Ciudad Monumental y carreras urbanas nocturnas.
   - Sistema de economía en euros (€) con compras en talleres y alquiler de portales.
4. **UI Comercial y Limpia:**
   - Mantén oculto por defecto el panel de debug F3. La interfaz visible debe ser inmersiva: minimapa táctico de radar, velocímetro y avisos de misión.
5. **Game Feel y Audio:**
   - Extiende el sistema de audio procedural Web Audio (`AudioSystem`) para motores, derrapes, claxon y sirenas, y mantén efectos cinemáticos de cámara (trauma shake en colisiones).

## Flujo por fases

1. Lee `AGENTS.md`, `PROGRESS.md` y `DECISIONS.md` antes de cada fase. Limita la lectura del código a los archivos necesarios.
2. Trabaja solo en la fase indicada por `PROGRESS.md`. Presenta un plan breve de archivos y pasos antes de implementar.
3. Mantén módulos pequeños (idealmente menos de 300 líneas), funciones pequeñas, sin `any`, variables globales ni asignaciones por fotograma en el bucle caliente. Comenta el porqué.
4. Al completar la fase ejecuta `npm run lint`, `npm run typecheck`, `npm test` y `npm run build`. Actualiza `PROGRESS.md` con lo hecho, lo pendiente y cómo probarlo; anota decisiones en `DECISIONS.md`.
5. Haz un commit pequeño en inglés con Conventional Commits por fase completada. No avances de fase sin verificar los criterios de aceptación de la actual.
6. Resuelve ambigüedades con la opción más simple y escalable, documentándola. Pregunta solo si bloquea. Si algo falla tras tres intentos, explica el bloqueo.
7. No generes datos geográficos ficticios ni assets sin licencia clara. Registra cada asset y su licencia en `ATTRIBUTION.md`.

## Fases

Las fases se implementan en orden: 0 base/deploy; 1 motor; 2 pipeline geográfico; 3 terreno/chunks; 4 red viaria; 5 edificios; 6 hitos y fidelidad; 7 marcas ficticias; 8 personaje; 9 vehículos; 10 tráfico y peatones; 11 delitos y policía; 12 combate ligero estilizado; 13 misiones/eventos/guardado; 14 HUD y mapas; 15 hora/clima/iluminación; 16 audio; 17 optimización; 18 QA y lanzamiento; 19 escalado/modding. Consulta la especificación completa del usuario en el PDF adjunto y respeta el alcance y los criterios de cada fase.
