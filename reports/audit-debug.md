# Auditoría del banco de pruebas

Fecha: 2026-11-23
Alcance: bloque 0 de `Caceres_Criminal_Prompts_de_Mejora.pdf`.
Estado: integrado en `main` tras resolver el conflicto del PR #4 con las fases 10/11.

## Hallazgos y corrección

| Gravedad |Hallazgo original | Estado |
|---|---|---|
| Media | Panel de depuración siempre visible; F4 mezclaba panel y bordes de chunk; sin desglose temporal. | Corregido: `?debug=1` activa F3 (panel), F4 (bordes), F5-F9 (overlays/sombras/aviso) y ` (consola). Sin el parámetro, F4 conserva su comportamiento anterior. El desglose física/jugador/streaming/render se mide solo en modo depuración. |
| Media | Solo existía el overlay de bordes de chunk; faltaban colisionadores, calzadas y límites de LOD. | Corregido: `src/world/debug-overlays.ts` genera las tres vistas a partir de la geometría ya existente. |
| Baja | No había consola de comandos; los comandos `time`, `weather`, `god` y `wanted` no tenían sistema asociado. | Parcial: consola disponible con `help`, `tp <hito>`, `spawn vehicle` y `noclip`. `wanted` sigue sin comando aunque el nivel de búsqueda existe desde la fase 11; no se añade un atajo sin diseñar su semántica. |
| Media | El recorrido no cubría las diez paradas, no guardaba capturas ni métricas por punto y no existía `npm run audit`. | Corregido: `npm run audit` ejecuta `tests/e2e/debug-audit.spec.ts`, guarda capturas en `reports/screens/audit-<fecha>/` y escribe `reports/audit-summary.md`. |
| Baja | La memoria mostrada solo estimaba buffers del mundo; no se consultaba el heap del navegador; no había población de agentes. | Corregido: heap disponible en el modo depuración; la población viva se muestra en `agents` y `agentsByLod` informa de los tres niveles de simulación por distancia. |

## Incompatibilidades encontradas al integrar

- `debug-overlays.ts` usaba `minHeight`/`maxHeight`; `BuiltTerrainChunk` expone `minimumHeight`/`maximumHeight`.
- La ruta del catálogo de hitos no era servible por Vite; se copia `data/landmarks/landmarks.json` a `public/data/landmarks/landmarks.json` sin tocar `public/world`.
- Vitest recogía el spec de Playwright; se excluye `tests/e2e/**` en `vite.config.ts`.
- El navegador del tour estaba fijado a `msedge`; se usa Chromium estándar para permitir ejecución en CI.

## Validación

- `npm run lint`, `npm run typecheck`, `npm test` (43/43), `npm run build`.
- `node tools/verify-world.mjs` y `node tools/validate-road-graph.mjs`.
- El tour Playwright no se ha ejecutado de extremo a extremo: el despliegue actual publica solo la región `cc-monumental` y varias paradas del catálogo quedan fuera de su manifiesto. El informe `reports/audit-summary.md` se genera con los resultados parciales disponibles.
