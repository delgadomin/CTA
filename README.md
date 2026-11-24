# Cáceres Criminal

Prototipo técnico de un juego 3D de mundo abierto para navegador, ambientado en una recreación fiel de Cáceres (Extremadura, España). El proyecto se construye por fases pequeñas y verificables; consulta [`PROGRESS.md`](PROGRESS.md) para el estado actual y [`AGENTS.md`](AGENTS.md) para las reglas de implementación.

Sitio publicado: https://hhg-ptm.github.io/CTA/

## Requisitos

- Node.js 22 o posterior.
- npm 10 o posterior.
- Un navegador compatible con WebGL 2.
- (Opcional) GPU con aceleración WebGL para 60 fps.

## Cómo iniciar el proyecto

```sh
# 1. Instalar dependencias
npm ci

# 2. Lanzar el servidor de desarrollo
npm run dev
```

Vite sirve la aplicación en `http://localhost:5173/` (o el puerto que indique la consola). Abre esa URL en el navegador.

También puedes compilar la versión de producción:

```sh
npm run build        # genera dist/
npm run preview      # sirve dist/ localmente
```

## Controles

- `WASD` / stick izquierdo: mover.
- Ratón (clic para capturar) / stick derecho: mirar.
- `Tab` / botón A: alternar cámara libre ↔ tercera persona.
- `Shift`: sprint.
- `E`: entrar/salir del vehículo más cercano.
- `Espacio`: freno de mano (al conducir).
- `F3`: mostrar/ocultar contadores de diagnóstico.
- `F4`: mostrar/ocultar bordes de chunk.

En tercera persona se controla el personaje; al acercarse a un vehículo y pulsar `E` se conduce. Pulsa `E` de nuevo para salir.

## Comprobaciones

```sh
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
node tools/verify-world.mjs
```

## GitHub Pages

El workflow de GitHub Actions compila el sitio y lo publica en Pages al actualizar `main`. En la configuración del repositorio, selecciona **Settings > Pages > Build and deployment > Source: GitHub Actions**. La salida de producción está en `dist/`.

## Datos y licencias

El código del juego está cubierto por MIT. Los datos geográficos y assets se incorporan por fases con su fuente y licencia registradas en [`ATTRIBUTION.md`](ATTRIBUTION.md). El juego no consulta servicios externos durante la ejecución; los datos se sirven como chunks estáticos desde `public/world/`.

## Estructura

- `src/` — código del juego (motor, mundo, entidades).
- `tools/` — pipeline de datos geográficos y verificadores.
- `data/` — fuentes y datasets generados.
- `public/world/` — chunks comprimidos servidos al navegador.
- `tests/` — pruebas Vitest.
