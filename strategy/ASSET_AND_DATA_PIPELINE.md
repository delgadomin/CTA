# Pipeline de Assets 3D y Datos Geográficos Oficiales

> **Objetivo:** Simplificar radicalmente la creación de contenido en *Cáceres Criminal*, eliminando la deuda técnica de construir modelos 3D procedurales complejos en código TypeScript y adoptando el pipeline probado de **Badajoz: El Juego** (modelos GLB optimizados + datos oficiales de Catastro y OSM).

---

## 1. El Cambio de Paradigma: Por qué Dejar el "Todo Procedural en Código"

### Lo que hacíamos antes (Inviable y Lento):
* Ensamblar vehículos mediante 40 cubos y cilindros (`BoxGeometry`, `CylinderGeometry`) calculados en TypeScript.
* Resultado: Semanas de programación para un resultado visual tosco, difícil de texturizar, sin interiores y sin animaciones de suspensión ni puertas.

### Lo que hacemos ahora (Estrategia Badajoz / Estándar de la Industria):
* Cargar modelos **glTF / GLB estándar** preoptimizados.
* Beneficios inmediatos:
  * Proporciones anatómicas y mecánicas perfectas.
  * Mapeado UV profesional y texturas PBR limpias (albedo, normal, roughness, metallic).
  * Rigs de animación estándar (esqueletos para peatones, jerarquía de nodos para ruedas, puertas y volantes).
  * Menos de 50 líneas de código para instanciar cualquier vehículo o monumento frente a 800 líneas de trigonometría procedural.

---

## 2. Fuentes de Assets 3D con Licencias Permitidas

Para cumplir estrictamente con las reglas del proyecto (sin copyright infringements, sin modelos de Rockstar/GTA):

1. **Kenney.nl (CC0 - Dominio Público):**
   * *Uso:* Vehículos urbanos (utilitarios, furgonetas, autobuses), mobiliario urbano (bancos, farolas, papeleras, semáforos, señales de tráfico), props residenciales.
   * *Optimización:* Modelos low-poly ya preparados, de menos de 50 KB por activo.
2. **Quaternius (CC0 - Dominio Público):**
   * *Uso:* Personajes humanos animados (peatones, turistas, policías con uniformes adaptados), vehículos modulares y kits de edificios.
   * *Formato:* GLB con rigs compatibles y animaciones básicas (idle, walk, run, drive).
3. **Poly Haven / ambientCG (CC0):**
   * *Uso:* Texturas PBR de mampostería, granito de Cáceres, teja árabe curva, adoquín histórico y asfalto.
4. **Modelado Propio en Blender (Monumentos de Cáceres):**
   * *Uso:* Hitos patrimoniales que no existen en librerías genéricas:
     * Torre de Bujaco y Muralla Almohade.
     * Arco de la Estrella.
     * Concatedral de Santa María y su torre campanario.
     * Palacio de las Veletas (Aljibe).
     * Ayuntamiento y arcadas de la Plaza Mayor.
   * *Exportación:* GLB único por hito, escala 1:1 métrica, pivote en la base central.

---

## 3. Presupuesto Técnico y Optimización de Archivos (Web Budget)

Para garantizar 60 FPS estables y carga instantánea en navegadores modestos:

| Categoría | Presupuesto Triángulos | Tamaño Máximo GLB | Texturas Máximas |
| :--- | :--- | :--- | :--- |
| **Vehículo ligero** (coche, taxi, policía) | 1.500 - 3.500 tris | ≤ 250 KB | 1x 1024x1024 (o atlas compartido) |
| **Autobús urbano** | 3.000 - 6.000 tris | ≤ 450 KB | 1x 1024x1024 |
| **Peatón / Personaje** | 1.200 - 2.500 tris | ≤ 300 KB | 1x 512x512 |
| **Mobiliario urbano (prop)** | 50 - 300 tris | ≤ 30 KB | Textura compartida en atlas |
| **Hito patrimonial (ej. Bujaco)** | 4.000 - 12.000 tris | ≤ 1.2 MB | 2x 2048x2048 PBR |

### Pipeline de Compresión Automatizado (`tools/`):
Usar `@gltf-transform/cli` para optimizar cada asset antes de incluirlo en `public/`:
```bash
# Optimización de mallas y compresión Draco / Meshopt
gltf-transform optimize input.glb output.glb --draco --texture-compress webp
```

---

## 4. Pipeline de Datos Geográficos Oficiales: Catastro + OSM + IGN

Inspirado en la técnica de *Badajoz: El Juego*, la geografía se nutre del cruce de tres bases de datos públicas españolas de libre uso:

```
                  ┌──────────────────────────────────────────────┐
                  │          FUENTES OFICIALES ABIERTAS           │
                  └──────┬──────────────────────┬─────────┬──────┘
                         │                      │         │
                         ▼                      ▼         ▼
               OpenStreetMap (OSM)       Catastro España  IGN (MDT05)
               - Red viaria y carriles   - Portales       - MDE Elevación
               - Sentidos de tráfico     - Alturas reales - Relieve 5x5m
               - Nombres de calles       - Números vía
               - Paradas de autobús      - Usos de suelo
                         │                      │         │
                         └──────────────┬───────┘         │
                                        ▼                 ▼
                               ┌─────────────────┐ ┌──────────────┐
                               │ Parser GeoJSON  │ │ Raster DEM   │
                               │  offline script │ │  16-bit PNG  │
                               └────────┬────────┘ └──────┬───────┘
                                        │                 │
                                        ▼                 ▼
                               ┌──────────────────────────────────┐
                               │   CHUNKS OPTIMIZADOS EN REPO     │
                               │   - data/buildings_chunk_*.json  │
                               │   - data/streets_network.json    │
                               │   - data/terrain_heightmap.bin   │
                               └──────────────────────────────────┘
```

### 1. Catastro de España (WFS / Descargas Inspire):
* **Datos extraídos:**
  * Coordenadas exactas de cada **portal de entrada** (latitud, longitud, calle y número).
  * Altura oficial en metros y número real de plantas (evita heurísticas de altura uniforme).
* **Aplicación en el juego:**
  * Los portales generan automáticamente puntos de interacción para las misiones de reparto de paquetería y compra/alquiler de viviendas.

### 2. OpenStreetMap (OSM):
* **Datos extraídos:**
  * Red de viales con clasificación de carriles (`lanes`, `oneway`, `maxspeed`).
  * Trazados peatonales en el casco antiguo (`highway=pedestrian`, `highway=steps`).
  * Ubicación de paradas de autobús (`highway=bus_stop`) y nombres de marquesinas para las misiones de transporte.

### 3. IGN - Centro Nacional de Información Geográfica (MDT05):
* **Datos extraídos:**
  * Modelo Digital del Terreno con resolución de 5 metros por píxel.
  * Captura fiel del relieve de Cáceres: la loma de la Ciudad Monumental, el valle de la Ribera del Marco y las cuestas pronunciadas de San Marquino y la Montaña.

---

## 5. Carga en el Motor con `AssetManager`

El motor ya dispone de la infraestructura base `AssetManager.ts` con soporte de `GLTFLoader`. La integración requiere únicamente:

1. Colocar los archivos GLB organizados en:
   * `public/models/vehicles/` (turismo, taxi, bus, scooter, furgoneta).
   * `public/models/characters/` (jugador, peatones, policías).
   * `public/models/props/` (farolas, bancos, paradas).
   * `public/landmarks/` (monumentos emblemáticos).
2. La carga se realiza asíncronamente con promesas y cache en memoria.
3. Si un archivo GLB no está presente temporalmente, el motor mantiene su geometría primitiva procedural como **fallback transparente**, garantizando que el juego nunca se rompa.
