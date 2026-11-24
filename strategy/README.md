# Índice de Estrategia de Desarrollo «Cáceres Criminal»

Esta carpeta recoge el marco estratégico, arquitectónico y de diseño de juego adoptado a partir de noviembre de 2026, tomando como referencia el éxito e innovaciones prácticas del juego móvil **«Badajoz: El Juego»** (creado por Alfredo Narváez / Basel1905 Studio) junto con los patrones y estándares de **«gamedev-skills»**.

## Documentos de la Estrategia

1. **[NEW_STRATEGY.md](file:///c:/Users/cerbe/Downloads/CTA-main/CTA-main/repo/strategy/NEW_STRATEGY.md)**:
   * Los 5 grandes pilares del proyecto: fin del "todo procedural en código", cruce de Catastro + OSM + IGN, bucle de juego con oficios y economía local, HUD comercial limpio sin debug invasivo, y feedback inmersivo con Web Audio API.
2. **[GAMEPLAY_AND_MISSIONS.md](file:///c:/Users/cerbe/Downloads/CTA-main/CTA-main/repo/strategy/GAMEPLAY_AND_MISSIONS.md)**:
   * Diseño de los 4 grandes oficios cacereños: Conductor de Autobús Urbano (Líneas 1 y 8), Repartidor de paquetería en la Judería, Guía Turístico oficial y Carreras urbanas clandestinas.
   * Sistema de economía en euros (€) y estructura de datos TypeScript ágil para añadir misiones declarativas.
3. **[ASSET_AND_DATA_PIPELINE.md](file:///c:/Users/cerbe/Downloads/CTA-main/CTA-main/repo/strategy/ASSET_AND_DATA_PIPELINE.md)**:
   * Flujo de trabajo para importar modelos 3D optimizados en GLB (Kenney, Quaternius, Poly Haven y modelado propio en Blender).
   * Presupuestos de triángulos y texturas para mantener 60 FPS estables.
   * Integración de datos oficiales de Catastro de España para portales reales, OSM para viales y paradas, e IGN MDT05 para relieve.
