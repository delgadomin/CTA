# Licencias de assets 3D

Este archivo es el inventario canónico de modelos 3D. Los datos geográficos y sus licencias siguen en [`ATTRIBUTION.md`](ATTRIBUTION.md).

## Procedurales propios (sin coste, sin atribución obligatoria)

| Asset | Archivos | Licencia | Origen | Uso |
| --- | --- | --- | --- | --- |
| City Kit — farola histórica | `public/models/citykit/street-lamp-lod{0,1}.glb` | CC0-1.0 | `tools/generate_citykit.py` (Blender 5.2, geometría y materiales originales) | Sustituye la farola procedural de `RoadRenderer` con el kit activo (por defecto). |
| City Kit — encina mediterránea | `public/models/citykit/tree-lod{0,1}.glb` | CC0-1.0 | Ídem | Sustituye el árbol procedural con el kit activo (por defecto). |
| City Kit — semáforo | `public/models/citykit/traffic-signals-lod{0,1}.glb` | CC0-1.0 | Ídem | Sustituye el semáforo procedural con el kit activo (por defecto). |
| City Kit — señal de stop | `public/models/citykit/stop-sign-lod{0,1}.glb` | CC0-1.0 | Ídem | Sustituye la señal procedural con el kit activo (por defecto). |
| City Kit — señal de ceda el paso | `public/models/citykit/give-way-sign-lod{0,1}.glb` | CC0-1.0 | Ídem | Sustituye la señal procedural con el kit activo (por defecto). |
| City Kit — chimenea de ladrillo | `public/models/citykit/chimney-lod{0,1}.glb` | CC0-1.0 | Ídem | Detalle en `BuildingRoofAnchor` del casco histórico. |
| City Kit — balcón de forja | `public/models/citykit/balcony-lod{0,1}.glb` | CC0-1.0 | Ídem | Detalle en `BuildingSignSlot` de fachadas comerciales. |

Todos los GLB del kit tienen recursos embebidos, sin texturas externas, sin marcas y sin referencias a juegos comerciales. El manifest con recuento de triángulos y bytes está en `public/models/citykit/manifest.json`.

Para regenerarlos (requiere Blender 5.x instalado):

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' `
  --background --factory-startup --python tools/generate_citykit.py
```

La ruta de Blender depende de la instalación local; el script no se ejecuta en tiempo de juego ni en CI.

## Terceros con licencia CC0

| Asset | Archivo | Licencia | Fuente | Atribución |
| --- | --- | --- | --- | --- |
| Tevy — Casual Walker | `public/models/characters/casual-walker.glb`, `casual-walker-lod1.glb` | CC0 1.0 | https://tevy.dev/models/casual-walker | Registrada en `ATTRIBUTION.md`. Pendiente de sustituir en la siguiente tanda. |
| Innerscene — Graphite four-door sedan | `public/models/vehicles/graphite-sedan.glb` | CC0 | https://www.innerscene.com/tools/library/3d-parts/graphite-four-door-sedan-eed96d12 | Registrada en `ATTRIBUTION.md`. Pendiente de sustituir en la siguiente tanda. |

## Pendiente

Los modelos CC0/procedurales de personajes y coches de la siguiente tanda se añadirán aquí antes de tocar `src/main.ts`, `src/world/character.ts` o `src/world/vehicle.ts`.
