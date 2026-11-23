# Auditoría del banco de pruebas

Fecha: 2026-11-23
Alcance: bloque 0 de `Caceres_Criminal_Prompts_de_Mejora.pdf`.

## Hallazgos

| Gravedad | Archivo y línea | Hallazgo | Causa probable |
|---|---|---|---|
| Media | `src/main.ts:76,83-90,177-181`; `index.html:13-29` | Hay FPS, pico de frame, chunks, colisionadores, draw calls, triángulos y memoria geométrica; el panel se muestra siempre y F4 alterna juntos el panel y los bordes de chunk. No hay desglose temporal por etapa. | El panel se añadió como HUD del prototipo antes de existir un modo de depuración independiente. |
| Media | `src/main.ts:177-181`; `src/world/chunk-manager.ts` | Solo existe el overlay de bordes de chunk. No hay vistas para colisionadores, grafo de carriles ni límites/estado de LOD. | Las funciones de depuración de geometría no se implementaron cuando llegaron edificios, vías y streaming. |
| Baja | `src/main.ts`; `src/world/character.ts`; `src/world/vehicle.ts` | No hay consola de comandos. El juego actual no tiene clima, sistema horario, daño/invulnerabilidad, nivel de búsqueda policial ni población de agentes que puedan mostrar esos comandos o métricas. | Esos sistemas pertenecen a fases posteriores o aún pausadas; añadir controles ficticios ocultaría el estado real del juego. |
| Media | `tools/verify-streaming.mjs:3,64-145`; `package.json` | Existe un recorrido aleatorio de streaming, pero no teletransporta a los diez puntos solicitados, no guarda una captura y métricas por punto ni genera `reports/audit-summary.md`; tampoco existe `npm run audit`. | El verificador cubre la carga de chunks y no el paseo de auditoría de hitos. |
| Baja | `src/main.ts:83-90`; `src/world/chunk-manager.ts:255-269` | La memoria mostrada solo estima buffers del mundo; no se consulta el heap del navegador. No existe población con niveles de simulación. | No hay un sistema de agentes/LOD de población que suministre esas métricas. |

## Plan de corrección

1. Hecho: separar `?debug=1`, panel F3 y F4-F9; añadir timings y overlays usando geometría existente. F6 muestra calzadas porque no hay un grafo peatonal que se pueda presentar con fidelidad.
2. Hecho: preparado el tour Playwright para diez paradas con fuentes identificadas, capturas ignoradas por Git y resumen por parada.
3. Bloqueado: lint, typecheck, tests y build se intentaron; pnpm se detiene antes de cada script al no poder crear el enlace simbólico del proyecto en Windows (`EPERM`). No hay mediciones runtime hasta que esas dependencias estén accesibles.
