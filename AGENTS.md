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
