# Atribuciones y licencias

## Código
- Código original del proyecto: MIT (ver `LICENSE`).
- Three.js y `GLTFLoader`, `KTX2Loader`, `MeshoptDecoder`: licencia MIT, https://github.com/mrdoob/three.js/blob/dev/LICENSE.
- Rapier 3D, paquete `@dimforge/rapier3d-compat` 0.12.0: licencia Apache-2.0, https://github.com/dimforge/rapier.js.
- Transcodificador Basis incluido desde `three/examples/jsm/libs/basis/`: Apache License 2.0, https://github.com/BinomialLLC/basis_universal/blob/master/LICENSE. Los archivos se sirven localmente desde `public/basis/`.

## Datos y assets
- OpenStreetMap contributors: datos bajo ODbL 1.0; atribución «© OpenStreetMap contributors», https://www.openstreetmap.org/copyright. Descarga local con Overpass API, https://wiki.openstreetmap.org/wiki/Overpass_API. Los datos derivados conservan la atribución y condiciones ODbL.
- IGN/CNIG PNOA MDT05 primera cobertura: fuente CC BY 4.0 scne.es. La malla descargada mediante WCS se recorta y remuestrea en EPSG:25829; atribución del derivado: «Obra derivada de MDT05-cob1 2008-2015 CC-BY 4.0 scne.es», https://centrodedescargas.cnig.es/CentroDescargas/modelo-digital-terreno-mdt05-primera-cobertura.
- Dirección General del Catastro, INSPIRE BU (edificios): https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx. El GML original se conserva solo en la caché local ignorada por Git (`data/raw/catastro/`); el pipeline proyecta sus huellas a coordenadas locales y publica únicamente métricas agregadas de contraste, sin geometrías, referencias catastrales ni atributos de edificio. La licencia de acceso y uso prohíbe redistribuir la respuesta original sin transformación: https://www.catastro.hacienda.gob.es/webinspire/documentos/Licencia.pdf.
- Los modelos externos listados abajo se descargan al repositorio y se sirven desde `public/models/`; el juego no depende de sus páginas de descarga en tiempo de ejecución.
- Las texturas repetibles de calzada se generan proceduralmente desde Canvas y los modelos simples instanciados de señalización son geometría original del proyecto; no proceden de assets externos.
- Los atlas de fachadas por zona, cubiertas de teja/modernas y ventanas emisivas se generan proceduralmente desde Canvas; las mallas de edificios se extruyen desde huellas OSM. Los únicos modelos de terceros son los tres GLB CC0 listados abajo. El cargador opcional de hitos solo admite GLB locales con nombre OSM estable, tamaño limitado y recursos embebidos.
- Los coches ambientales y patrullas se generan con geometría original del proyecto y colores por semilla. El jugador y los peatones usan el modelo CC0 de caminante listado abajo; los coches conducibles usan el sedán genérico CC0 listado abajo. No se incorporan marcas ni libreas externas.
- El cielo y el resplandor solar se generan proceduralmente. Se consultó `https://github.com/jhanva/gamedev-skills` como guía de dirección artística; no se copió código ni se incorporaron assets de ese repositorio.
- Tevy, «Casual Walker», rig humano de 56 huesos con animaciones idle/walk y licencia CC0 1.0: https://tevy.dev/models/casual-walker. Se incluyen LOD0 para el jugador (`public/models/characters/casual-walker.glb`) y LOD1 para la multitud (`public/models/characters/casual-walker-lod1.glb`); la pose walk de la multitud se hornea una vez para mantener el instancing.
- Innerscene, «Graphite four-door sedan», GLB de sedán genérico sin marca, licencia CC0, dimensiones publicadas 4,867 × 2,230 × 1,450 m: https://www.innerscene.com/tools/library/3d-parts/graphite-four-door-sedan-eed96d12. Copia local en `public/models/vehicles/graphite-sedan.glb`; sus piezas se agrupan por material al cargarse para bajar las llamadas de dibujo.
