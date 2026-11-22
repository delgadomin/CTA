# Cáceres Criminal

Prototipo técnico de un juego 3D de mundo abierto para navegador, ambientado en una recreación fiel de Cáceres. El proyecto se construye por fases pequeñas y verificables; consulta [`PROGRESS.md`](PROGRESS.md) para el estado actual y [`AGENTS.md`](AGENTS.md) para las reglas de implementación.

## Requisitos

- Node.js 22 o posterior.
- npm 10 o posterior.
- Un navegador compatible con WebGL 2.

## Desarrollo

```sh
npm ci
npm run dev
```

La escena actual es temporal y sirve para revisar el motor. WASD o el stick izquierdo mueven la cámara libre, el clic captura el ratón para mirar, el stick derecho mira, Tab o el botón A alternan la cámara orbital y F3 muestra u oculta los contadores de diagnóstico.

## Comprobaciones

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## GitHub Pages

El workflow de GitHub Actions compila el sitio y lo publica en Pages al actualizar `main`. En la configuración del repositorio, selecciona **Settings > Pages > Build and deployment > GitHub Actions**. La salida de producción está en `dist/`.

## Datos y licencias

El código del juego está cubierto por MIT. Los datos geográficos y assets se incorporarán en fases posteriores con su fuente y licencia registradas en [`ATTRIBUTION.md`](ATTRIBUTION.md). El juego no consulta servicios externos durante la ejecución.
