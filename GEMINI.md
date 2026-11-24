# Cáceres Criminal — contexto para Gemini

Este archivo se carga automáticamente como memoria del proyecto en Gemini CLI,
en la extensión IDE de Google y en Antigravity CLI (que mantiene `GEMINI.md` y
`AGENTS.md` como reglas de espacio de trabajo).

## Antes de empezar

Lee siempre, en este orden:

1. `AGENTS.md` — objetivos, reglas innegociables y lista de fases.
2. `PROGRESS.md` — fase actual, pendientes y cómo probarlos.
3. `DECISIONS.md` — decisiones ya tomadas; no las reabras sin motivo.

## Estado del proyecto

- Fases 0-11 implementadas; los PR #1 a #15 están integrados en `main`.
- PR #11 y #14 cerrados como supersedidos por el #15 (modelos CC0 de Tevy e Innerscene).
- Siguiente fase: **12 — combate ligero estilizado**. No la inicies sin confirmación.
- Repositorio: `hhg-ptm/CTA`; sitio publicado en GitHub Pages.

## Reglas innegociables

- Responde y escribe la documentación en español. Código y commits en inglés
  (Conventional Commits). Textos del juego en español con claves i18n.
- Trabaja solo en la fase indicada por `PROGRESS.md`. Presenta un plan breve de
  archivos y pasos antes de implementar.
- Fidelidad geográfica: calles, edificios, relieve y monumentos derivan de
  datos OSM/MDT05 reales. Nunca inventes geografía ni llames APIs externas en
  tiempo de ejecución.
- No uses assets, marcas, música ni código de GTA/Rockstar ni de otros juegos.
  Registra cualquier fuente y licencia en `ATTRIBUTION.md`.
- **No modifiques `public/world`**: sus hashes están registrados en el
  manifiesto. El catálogo de hitos se sirve desde
  `public/data/landmarks/landmarks.json`.
- Módulos pequeños, TypeScript estricto, sin `any`, sin variables globales ni
  asignaciones por fotograma en el bucle caliente. Comenta el porqué.

## Verificación obligatoria

Tras cualquier cambio ejecuta, desde la raíz del repo:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

También disponibles: `npm run data:verify` (integridad de datos) y
`npm run audit` (auditoría Playwright de las diez paradas; necesita el servidor
de desarrollo arrancado).

Después de integrar cambios en `main`, comprueba GitHub Actions y que Pages
sirve el bundle nuevo.

## Desarrollo local

```bash
npm run dev
```

Abre la URL de Vite (normalmente `http://localhost:5173`). El modo de
depuración está en `/?debug=1`: F3 panel, F4 bordes, F5 colisionadores,
F6 calzadas, F7 LOD, F8 sombras, F9 aviso y `` ` `` consola.

## Prompt inicial sugerido

```
Lee AGENTS.md, PROGRESS.md y DECISIONS.md. La Fase 11 está cerrada y
desplegada. Propón un plan para la Fase 12 (combate ligero estilizado) con
archivos concretos y criterios de aceptación. No implementes nada todavía.
```
