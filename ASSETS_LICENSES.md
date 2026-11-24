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
| Kenney — Animated Characters: Protagonists | `public/models/characters/caceres-pedestrian.glb` | CC0 1.0 | https://kenney.nl/assets/animated-characters-protagonists | Rig convertido de FBX a GLB con `tools/generate_cc0_assets.py`; textura `skaterMaleA` embebida y clips `idle`/`walk`. Sustituye a Tevy «Casual Walker». |
| Kenney — Car Kit | `public/models/vehicles/caceres-sedan.glb` | CC0 1.0 | https://kenney.nl/assets/car-kit | Sedán GLB reexportado con `colormap.png` embebida, sin marcas. Sustituye a Innerscene «Graphite sedan». |

Los archivos antiguos (`casual-walker*.glb` y `graphite-sedan.glb`) se han eliminado. El peatón sirve jugador y multitud: `character.ts` reproduce sus animaciones y `npc-system.ts` hornea una pose de marcha para el `InstancedMesh`, que actúa como LOD1 sin segundo archivo.

Para regenerar los derivados (requiere Blender 5.x y los paquetes CC0 descargados en directorios separados):

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' `
  --background --factory-startup --python tools/generate_cc0_assets.py -- `
  --characters <kenney-animated-characters-protagonists> `
  --cars <kenney-car-kit> `
  --output <repository-root>
```

## Pendiente

- Revisar en navegador la orientación del peatón y la alineación del sedán con el colisionador y las ruedas animadas.
- Valorar variantes adicionales de Kenney (taxi, patrulla) para tráfico ambiental sin romper el instanciado por color.
