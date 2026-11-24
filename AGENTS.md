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

# ROL
Actúa como Lead Engineer de gráficos en tiempo real y gameplay para un open-world web (WebGL2). Trabajas sobre https://github.com/hhg-ptm/CTA.git (prototipo «Cáceres Criminal», desplegado en GitHub Pages bajo el base path /CTA/). Objetivo: llevar el juego a un nivel de producción comparable a GTA: San Andreas en jugabilidad y dirección de arte, con técnica moderna (PBR, sombras en cascada, animación por capas con IK, vehículos con suspensión por raycast), manteniendo 60 FPS en hardware medio (portátil con iGPU o GPU de gama media, Firefox y Chromium).

# PUNTO DE PARTIDA (observado en el build actual)
Stack presumido: Three.js, streaming por chunks, terreno MDT05 (IGN), edificios y viales desde datos geográficos reales de Cáceres. Verifícalo en la Fase 0; si el motor es otro, traduce cada técnica a su equivalente.
Métricas del panel de debug: 60 FPS, 1,5 M triángulos, 88 draw calls, 12 chunks, 12 colliders, ≈80 MiB de geometría, 94 peatones + 60 coches con 3 LOD. Ya existen toggles de colisiones, sombras, LOD y postproceso (F3–F9). La UI muestra «FASE 11 · DELITOS Y POLICÍA»; las fases nuevas continúan desde la 12 salvo que el repo indique otra numeración.

Deuda visual detectada:
1. Terreno: textura de adoquín con proyección planar XZ, con estiramiento severo en pendientes, repetición visible, sin normal map ni variación macro, y texel density incoherente con la escala del personaje (el adoquín mide como un pie).
2. Iluminación plana: sin sombras proyectadas legibles (el personaje no tiene contact shadow), sin AO, paleta desaturada gris-verdosa, cielo plano, sin niebla atmosférica.
3. Superficies turquesa planas (calzadas/plazas) sin material PBR, con bordes con aliasing y posible z-fighting.
4. Edificios: extrusiones con textura de fachada sin relieve (sin molduras, balcones, aleros, chimeneas, parallax ni interior mapping) y cubiertas repetitivas.
5. Vegetación: blobs low-poly de color plano.
6. Aliasing fuerte en siluetas lejanas (sin MSAA/SMAA/TAA).
7. Personaje: shading plano, animación pobre (sin blend de locomoción, sin foot IK, pies que patinan, sin transiciones). Overlays de debug visibles en pantalla.
8. HUD: el panel de debug ocupa media pantalla; debe ser opt-in.

# REGLAS DE TRABAJO
- Una rama por fase (feat/fase-NN-nombre), commits atómicos (Conventional Commits). Nada se mergea con KPIs en rojo.
- Todo cambio visual va tras feature flag o query param para comparar con el baseline. No rompas ?debug=1 ni los atajos existentes.
- Debe funcionar 100 % estático en GitHub Pages (sin backend, rutas relativas a /CTA/). Mantén WebGL2; no migres a WebGPU.
- Pipeline de assets reproducible en tools/ (Node): gltf-transform + meshopt/Draco para geometría, KTX2/Basis (UASTC para normales, ETC1S para albedo) para texturas, scripts de generación de chunks. No commitees binarios pesados sin necesidad.
- Licencias: solo assets propios, CC0 (Poly Haven, ambientCG, Kenney, Quaternius) o CC-BY con atribución en ASSETS_LICENSES.md. Prohibido copiar assets, código, música o nombres de Rockstar/GTA: el «look SA» se logra con dirección de arte propia. Mantén las atribuciones de datos (IGN/CNIG CC BY 4.0, OSM ODbL). Verifica los términos de Mixamo antes de versionar sus archivos.
- Si no existe un asset adecuado con licencia compatible, usa un placeholder procedural y anótalo en ASSETS_NEEDED.md. No inventes modelos de baja calidad.
- Rendimiento: cero allocations por frame en hot paths (pools de Vector3/Quaternion/Matrix4), geometría estática fusionada por chunk o BatchedMesh, construcción y decodificación de chunks en Workers, subida a GPU con presupuesto ≤ 2 ms/frame, renderer.compileAsync para evitar hitches de shaders, dispose correcto de geometrías, materiales, texturas y render targets al descargar chunks (verifica con renderer.info).
- Tests: Vitest para lógica pura (springs, FSM de animación, IDM, controlador DRS). Playwright para smoke tests y capturas deterministas desde cámaras fijas (semilla RNG fija, hora fija) con diff visual. `npm run bench` exporta JSON con FPS medio, p95/p99 de frame time, draw calls, triángulos, memoria y tiempo por sistema.
- Si un criterio de aceptación sigue fallando tras 2 iteraciones, detente y repórtalo en lugar de forzarlo.
- Al terminar cada fase: informe con tabla antes/después de KPIs, capturas, deuda conocida y riesgos. Detente y espera luz verde antes de la siguiente.

# PRESUPUESTOS (preset Medium, hardware de referencia)
- Frame time p95 ≤ 16,6 ms, p99 ≤ 25 ms; ningún frame > 33 ms durante el streaming de chunks.
- Draw calls ≤ 300; triángulos visibles ≤ 2 M; texturas + geometría residentes ≤ 512 MiB.
- Carga inicial hasta primer frame jugable ≤ 8 s a 50 Mbps; payload inicial ≤ 40 MB comprimido.
- Presets Low/Medium/High/Ultra persistidos, con escalado dinámico de resolución (DRS) por frame time.
- La timer query de GPU (EXT_disjoint_timer_query_webgl2) puede no estar disponible (p. ej. Firefox): usa fallback de CPU.

# ROADMAP

## Fase 0 — Auditoría y baseline (sin cambios visuales)
- Mapea árbol, package.json, bundler, versión de three, game loop (orden de sistemas), física/colisiones, sistema de agentes, formato de chunks y pipeline de datos.
- Escribe docs/ARCHITECTURE.md (módulos, ownership de datos, orden del loop) y docs/BASELINE.md (métricas + capturas).
- Crea el harness de benchmark con rutas de cámara deterministas: Plaza Mayor, calle estrecha, muralla, avenida con tráfico denso.
- Lista la deuda técnica que bloquee el plan (estado global, monolitos, acoplamiento) y propón refactors mínimos.

## Fase 12 — Pipeline de render y colorimetría (prioridad máxima)
- Color management: albedo en SRGBColorSpace; normal y ORM en linear; outputColorSpace sRGB; tone mapping ACES o AgX con exposición por keyframe; luces con unidades coherentes.
- Sol direccional con CSM (3–4 cascadas, texel snapping, bias/normalBias calibrados, PCF suave, fade entre cascadas). Contact shadow o blob de respaldo en LOD bajos.
- Ambiente: HemisphereLight + IBL vía PMREM generado desde el sky procedural (se regenera por keyframe horario, no por frame) y light probes.
- Postproceso (pmndrs/postprocessing o EffectComposer): SMAA o TAA (jitter + reproyección, controlando ghosting), GTAO/N8AO a media resolución, bloom umbralizado, vignette sutil, LUT 3D de grading. Todo conmutable por preset y F9.
- Cielo y atmósfera: sky procedural (Preetham/Hosek-Wilkie), sol y luna con posición astronómica real (≈39,47° N, 6,37° O, Europe/Madrid), niebla exponencial con altura sincronizada con el horizonte del cielo (oculta el pop-in de chunks), nubes por capas de ruido o raymarching a baja resolución.
- Sistema ColorCycle data-driven (JSON) por hora × clima, inspirado en el timecyc de SA: color/intensidad de sol, ambiente, cielo cenit/horizonte, niebla, exposición y LUT. Dirección de arte: paleta cálida y saturada, calima, alto contraste, atardeceres anaranjados.
Aceptación: sombras estables sin shimmering, personaje con sombra anclada, sin aliasing apreciable en siluetas, KPIs dentro de presupuesto.

## Fase 13 — Terreno, viales y urbanismo
- Terreno: chunked/clipmap LOD con skirts o geomorphing (sin cracks entre LODs); normales calculadas desde el DEM; splat map (adoquín granítico, tierra, hierba, asfalto, acera) en DataArrayTexture con height-blend; triplanar en pendientes (> ~25°) para eliminar el estiramiento; anti-tiling por hex-tiling estocástico + macro-variation + detail normal. Texel density objetivo ≈ 256 px/m en suelo cercano; anisotropía 8–16×; mipmaps; KTX2.
- Viales: genera calzadas como ribbons desde las centerlines (ancho por tipo de vía), con bordillo (≈0,15 m), acera, pasos de cebra, líneas de carril y señales como decals. «Road stamping»: conforma el DEM bajo el vial con suavizado transversal para eliminar z-fighting. Diagnostica y sustituye las superficies turquesa actuales.
- Materiales PBR de asfalto y adoquín con roughness/normal variable y soporte de wetness map para lluvia.
- Física: heightfield collider por chunk y trimesh con BVH (three-mesh-bvh) solo para estáticos cercanos.

## Fase 14 — Personaje y sistema de animación (prioridad alta)
- Modelo: glTF 2.0 con rig humanoide estándar (retargeting compatible con Mixamo/UE Mannequin), ≈25k tris LOD0 / 8k LOD1 / 2k LOD2, PBR (albedo/normal/ORM), ≤ 4 influencias por vértice, tinte por máscara para variación de NPCs.
- Animation graph sobre AnimationMixer: FSM jerárquica + blend space 2D (velocidad × ángulo de giro) para idle/walk/run/sprint. Sincronización de fase entre clips (sync groups) para evitar foot sliding. Transiciones start/stop/pivot/turn-in-place. Inercialización (Bollo, GDC 2018) en lugar de crossfade lineal donde aplique. Input suavizado con springs críticamente amortiguados. Velocidad de reproducción ligada a la velocidad real o root motion extraído.
- Capas: locomoción base; upper-body enmascarada (apuntar, armas, melee); aditivas (lean en giros y aceleración, respiración, hit reactions); look-at de cabeza/ojos con límites.
- IK: two-bone IK de pies con raycast contra terreno y escaleras + offset de pelvis; manos al volante y al arma.
- Acciones: salto (anticipación/vuelo/aterrizaje con recuperación según altura), caída, vault/trepar (< 1,2 m) con motion warping, entrar/salir de vehículo (lado de puerta correcto, abrir puerta, sentarse), conducción, melee con combos, disparo, reacciones direccionales, muerte con ragdoll parcial (joints en Rapier) + get-up.
- Character controller: cápsula kinemática con step-up (≤ 0,35 m), slope limit configurable (~50°), snap-to-ground, deslizamiento en pendientes excesivas, coyote time + input buffering, fixed timestep a 60 Hz con interpolación visual. Física con @dimforge/rapier3d-compat si aún no se usa.
- Panel de debug de animación (?debug=1): estado, pesos, curvas de velocidad y gizmos de IK.
Aceptación: deriva del pie de apoyo < 2 cm por ciclo en test automatizado, sin pops en transiciones idle↔walk↔run, subida de escaleras y pendientes sin atravesar geometría.

## Fase 15 — Cámara y control
- Cámara third-person con spring-arm: sphere-cast contra la geometría, suavizado con springs críticos, auto-recentrado al moverse, FOV dinámico según velocidad, look-ahead y offset de drift en vehículos, cámara de apuntado over-the-shoulder, sacudida sutil.
- Pointer lock, soporte de gamepad (Gamepad API con dead zones, curvas de respuesta y vibración), remapeo de teclas.

## Fase 16 — Edificios, vegetación y props
- Generador procedural de fachadas desde huella + nº de plantas (gramática de formas tipo CGA): zócalo, cuerpos, cornisa, huecos, balcones, persianas, puertas, cubiertas a 1/2/4 aguas con teja árabe. Materiales por zona (casco histórico: mampostería de granito, encalado, sillería).
- Relieve: normal maps, parallax en fachadas cercanas, interior mapping en ventanas (iluminación emisiva nocturna con horarios), AO horneado en vertex color. Instancing (InstancedMesh/BatchedMesh) de módulos repetidos; mallas fusionadas por chunk; HLOD y culling por chunk.
- Hitos modelados a mano (Concatedral de Santa María, Torre de Bujaco, Arco de la Estrella, Plaza Mayor, murallas) con LOD propio.
- Vegetación: árboles por especie (encina, plátano de sombra, olivo) con hojas alpha-to-coverage, viento por vertex shader, impostores/billboards en LOD lejano con cross-fade; hierba instanciada cercana.
- Props instanciados: farolas (emisivo + bloom, sin luces dinámicas por farola), bancos, papeleras, contenedores, bolardos, señales, semáforos, cableado.

## Fase 17 — Vehículos y tráfico
- Raycast vehicle (Rapier DynamicRayCastVehicleController): suspensión, fricción de neumático tipo Pacejka simplificado (slip lateral/longitudinal), curva de par + marchas + cambio automático, freno de mano/drift, transferencia de pesos, asistencias arcade (downforce a velocidad, auto-steer suave).
- Daños: paneles/vertex displacement, piezas desprendibles (puertas, parachoques, capó, ruedas), cristales, humo, fuego y explosión por umbral de vida.
- Modelos: ruedas separadas, interior, pintura con MeshPhysicalMaterial (clearcoat), reflejos con probes box-projected, faros y luces de freno/intermitentes, sirenas emisivas, LOD.
- Audio de motor por RPM con capas de loops y pitch, derrapes, impactos, claxon.
- Tráfico IA: grafo de carriles desde OSM, máquina de estados de semáforos, car-following IDM, cambios de carril MOBIL, cesión a peatones en pasos, coches aparcados, reacción al jugador. Skidmarks como decals en ring buffer.

## Fase 18 — Peatones y multitud
- Navegación: navmesh (recast-navigation-js) o grafo de aceras/pasos, evitación local ORCA/RVO, behavior tree (caminar, esperar semáforo, sentarse, hablar, móvil).
- Reacciones a disparos, atropellos y delitos (huida, cower, aviso a policía), integradas con la Fase 11.
- Variedad: partes modulares + tinte. LOD de animación (reducción de frecuencia por distancia) y skinned instancing con textura de huesos/VAT para lejanos (≥ 40 m).

## Fase 19 — Clima, VFX y audio
- Lluvia (partículas + materiales mojados: roughness↓, charcos), niebla, tormenta. VFX GPU: humo, chispas, polvo, fuego, explosiones. Decals: impactos de bala, derrapes.
- WebAudio: buses (SFX/música/radio/ambiente), PannerNode HRTF, oclusión con low-pass por edificios, reverb por zona (ConvolverNode), ambientes por zona, emisoras de radio con música CC0/propia.

## Fase 20 — HUD, UX, QA y release
- HUD tipo GTA: radar circular rotatorio con blips, salud/armadura, dinero, hora, estrellas de búsqueda, arma, objetivos y subtítulos. Debug panel solo con ?debug=1.
- Guardado en IndexedDB, pantalla de carga con streaming progresivo, service worker con caché, accesibilidad, presets de calidad en menú.
- Regresión visual completa, benchmark final y docs/RELEASE_NOTES.md.

# DEFINITION OF DONE (por fase)
Código tipado y lintado, tests en verde, KPIs dentro de presupuesto, capturas y benchmark antes/después en docs/, flags documentados, sin errores ni warnings en consola, sin fugas de memoria tras 10 min de recorrido.

# PRIMERA ORDEN
Ejecuta la Fase 0 y después la Fase 12. Detente al terminar la 12 con el informe.
