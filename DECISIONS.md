# Decisiones técnicas

## 2026-11-22 - Base de fase 0
- Usar Vite, TypeScript estricto y Three.js para el esqueleto WebGL 2 solicitado.
- Mantener la UI de depuración en DOM/CSS, separada del canvas 3D.
- GitHub Pages publica `dist/` mediante Actions. Se usan URLs relativas para que los assets funcionen en el subdirectorio del repositorio.
- La escena de diagnóstico con cubo se retira al sustituirse por terreno real en la fase 3.
- ECS usa capacidad fija, SoA en arreglos tipados y handles con generación para evitar asignaciones por entidad en el bucle caliente.
- La simulación corre a 60 Hz, limita la recuperación a cinco pasos por fotograma y el render interpola el giro de diagnóstico.
- GLB se carga con MeshoptDecoder; KTX2 usa el transcodificador Basis servido desde el mismo sitio y se atribuye por separado.
# Fase 2 - datos geográficos

- La región inicial es un rectángulo proyectado de 1 km centrado en Plaza Mayor; EPSG:25829 permite medir chunks y huellas en metros.
- Overpass se usa solo durante la preparación de datos. La respuesta se conserva localmente bajo `data/raw/` (ignorada por git); el cliente del juego consume los chunks estáticos.
- El terreno requiere el MDT05 CNIG reproyectado a EPSG:25829 en formato ESRI ASCII Grid. El constructor falla cuando falta para impedir elevaciones inventadas.
- Se empaquetan chunks con cabecera `CTA2`, versión, tamaño sin comprimir y payload JSON deflate para facilitar una futura carga selectiva.
- Los nombres de negocios se reemplazan por identidades ficticias; nombres reales detectados se reportan por id OSM/categoría sin conservar el nombre original en el reporte.
- Overpass entregó el extracto para el bbox el 2026-11-22; el JSON se conserva en caché local ignorada por Git.
- El WCS oficial IGN/CNIG sirve `Elevacion25830_5` recortada y reproyectada a EPSG:25829 como ASCII Grid; se conserva su hash, tamaño de celda y fecha en metadatos locales.
- El proveedor WCS entrega `dx` y `dy` independientes sin siempre incluir `NODATA_value`; el lector admite ambos formatos y clampa al centro de celda en el borde para cubrir la malla solicitada sin huecos.

# Fase 3 - terreno y streaming

- `@dimforge/rapier3d-compat` 0.12.0 se declara como dependencia de ejecución para crear heightfields; su licencia Apache-2.0 se revisó en los metadatos oficiales del paquete.
- El worker del navegador verifica la cabecera CTA2 y tamaño antes de descomprimir; también construye niveles de detalle de 2, 4 y 8 m, normales, colores de superficies OSM y skirts de 4 m.
- Se carga dentro de 512 m del centro de chunk y se conserva hasta 614 m (histéresis); heightfields Rapier solo se crean dentro de 192 m.
- El worker procesa descompresión y malla; el hilo principal anexa geometría con presupuesto aproximado de 5 ms por frame. El panel F4 muestra memoria de buffers de geometría estimada, chunks, colliders y pico de frame.
- El color base es hierba si no hay polígono superficial OSM en el punto. Esto es solo un valor visual; no cambia los datos de elevación ni la geometría.
- Rapier 0.12 espera el número de celdas por eje (`samples - 1`) y una matriz column-major de `samples * samples`; la prueba integrada crea un collider real para evitar que una incompatibilidad de dimensiones llegue al navegador.
- La validación automatizada de cinco minutos con el overlay F4 activo muestra frames de streaming de hasta 14,7 ms, cero intervalos >16 ms y buffers geométricos estimados de 6,9–16,5 MiB; la fase de inicialización previa al primer chunk se registra aparte.
- Los bordes de depuración F4 siguen la elevación muestreada de cada perímetro y se elevan 0,15 m sobre la malla; sus buffers cuentan en la estimación de memoria mientras el overlay está visible.

# Fase 4 - red viaria

- Se conserva un grafo derivado de way/node OSM: cada segmento guarda carriles, sentido vehicular, superficie, puente/túnel y si el tipo de vía es peatonal. La ruta a pie trata ambos sentidos como transitables (salvo autopistas) y no cambia las restricciones de dirección del grafo para futura IA de vehículos.
- Ancho de calzada: `width=*` en metros si existe; después `lanes * 3,1 m`; por último una tabla de defaults por `highway`. Los defaults y el ancho inferido son aproximaciones visuales y no se escriben de vuelta a OSM.
- Para vías urbanas anchas sin `sidewalk=*`, se muestran aceras inferidas a ambos lados; las etiquetas explícitas `sidewalk`, `sidewalk:left/right` mandan. Estas aceras solo representan geometría y no se consideran atributos cartográficos confirmados.
- Las calzadas, bordillos y aceras siguen la altura bilineal MDT05 y se levantan 5,5 cm, 9 cm adicionales para acera y 3,5 cm para bordillo para evitar z-fighting. Las curvas usan fillets con desviación limitada a 0,3 m.
- OSM no aporta una altura de tablero fiable en estos puentes; la vista usa un perfil de rampa con elevación máxima 1,8 m y pendiente máxima aproximada 12 %. Los túneles conservan la cota del terreno más 7 cm para mantener continuidad peatonal; la excavación, bóveda y perforación de heightfields quedan pendientes de una fase de volumen de terreno.
- Señales y semáforos se instancian por kind y chunk. Las colisiones de vía usan malla triangular por chunk y solo se activan a menos de 192 m; las cotas elevadas de puente se incluyen en esa malla.
- Los mapas repetibles de asfalto, piedra, hormigón y tierra se generan desde Canvas en tiempo de ejecución; no se descargan texturas externas. El desgaste de vértice usa una semilla espacial estable para evitar costuras entre los segmentos de cada vía.
- La ruta peatonal de referencia se calcula con los hitos OSM Plaza Mayor (`w62237623`), Arco de la Estrella (`n419385562`) y Plaza de San Jorge (`w35883265`). El inspector presenta las conexiones y distancias de ajuste para comparar con el mapa fuente.
- Las conexiones topológicas cubren giros por nodos compartidos; la descarga actual no consulta relaciones OSM `type=restriction`, de modo que las restricciones de giro señalizadas no están aún modeladas.

# Fase 5 - edificios

- Solo 13 de las 2.847 huellas fuente tienen `building:levels` explícito y ninguna aporta `height=*`; los valores visuales usan `height=*` → `building:levels × 3 m` → default registrado por zona/tipo. Se conserva la distinción entre dato fuente y valor representado.
- La zona de fachada se infiere por tipo monumental/etiqueta historic y por distancia a Plaza Mayor: casco hasta 220 m, ensanche hasta 500 m y periferia fuera. Es una heurística visual; los 36 edificios fuera del límite de chunks quedan en el inventario de fuente, no en el mundo jugable.
- Los techos sin `roof:shape` usan huella alargada → gabled y cercana a cuadrada → hipped; `roof:height` y `roof:colour` prevalecen cuando están presentes. Los mapas modulares de casco/ensanche/periferia, teja y cubierta moderna se generan desde Canvas, sin descargar assets externos.
- Se construyen tres LOD por chunk/material, y los colliders de edificios son mallas perimetrales simplificadas que solo se activan cerca del jugador. Los rótulos todavía no se dibujan: el chunk expone un slot de fachada comercial para la fase 7.
- Las ventanas guardan una semilla estable por id y exponen `BuildingRenderer.setNight()` para su integración con el sistema de hora de fase 15. No hay ciclo día/noche en esta fase.
- `public/landmarks/<id>.glb` es una entrada local opcional; no se descargaron modelos. El data build acepta solo ids de way OSM, GLB 2.0 de máximo 50 MiB, estructura y malla acotadas, sin URIs externos, con texturas PNG/JPEG embebidas limitadas; al cargar se usa la caché local del AssetManager.
- QA automatizado de fase 5: 16 chunks, 75 FPS, 85 draw calls, 303.477 triángulos, 15,6 ms máximo de streaming, cero frames >16 ms y 23,9–70,8 MiB de buffers de geometría estimados.

# Fase 6 - hitos y fidelidad

- El inventario usa los nombres orientativos de la guía del proyecto y separa los objetivos de `cc-monumental` de los que requieren una futura región de ciudad. Los nombres se comparan exactamente después de normalizar mayúsculas, espacios y tildes; no se aplican coincidencias difusas.
- Un objetivo no encontrado se informa como ausente del extracto OSM de la región, no como inexistente. Los objetivos de ciudad se muestran fuera de alcance mientras se procesa `cc-monumental`.
- La consulta OSM incluye `place=square` en nodos y vías para que plazas como Plaza Mayor puedan formar parte del inventario. Los nombres de monumentos y plazas son datos geográficos permitidos; las reglas de sustitución comercial siguen aplicándose a negocios.
- Los museos etiquetados `tourism=museum` se tratan como hitos públicos cuando OSM no declara `brand` ni `operator`; una marca u operador explícito conserva el saneamiento comercial.
- Las relaciones OSM históricas se conservan como POIs con prefijo `r` y centro calculado desde la geometría de sus miembros exteriores. Esa posición sirve para inventario y referencia; no sustituye ni crea huellas de edificio.
- La auditoría consulta nombres de vías, edificios no comerciales, superficies y POIs. Para fachadas, solo se conservan nombres de edificios no comerciales; los nombres de locales continúan sometidos al brand scrubber. Los alias del catálogo se añaden solo cuando el nombre alternativo está confirmado en el extracto OSM.
- No se derivan posiciones, huellas, dimensiones ni modelos de hitos a partir del nombre solamente. Los modelos detallados siguen necesitando geometría OSM o un GLB local validado y atribuido.
- Para la silueta visual, el Arco de la Estrella se centra en el POI OSM y se orienta perpendicular a la vía más cercana dentro de 24 m. El vano (8,6 m de ancho; 8,9 m de altura aproximada), profundidad y dovelas son parámetros artísticos, no medidas fuente; si no hay vía cercana, se omite.
- Las vías/polígonos OSM con `place=square` se conservan como superficies nombradas además de POIs, y colorean el terreno como piedra. La huella proviene de OSM; el material es una clasificación visual.
- Las vías OSM `barrier=city_wall` se conservan como geometría de muro monumental. La altura de 3,8 m, el grosor de 1,1 m y las almenas son fallbacks visuales porque el tramo fuente consultado no declara cotas; el trazado procede únicamente de la línea OSM.
- El informe de hitos distingue huellas, polígonos, trazados, vías, puntos y centros de relación. Un POI puntual sin huella cercana identificable (como la Torre de las Cigüeñas en este extracto) no se extruye como edificio para evitar ubicar una masa inventada.
- La página oficial del CEFOT 1 y la ficha municipal describen la Torre de las Cigüeñas como alta, cuadrada, con cuerpo superior saliente sobre ménsulas y merlones. El punto OSM nombrado para el museo cae dentro del perímetro multipolígono OSM del Palacio de las Cigüeñas y fuera de su patio; se usa como ancla del volumen, mientras que la relación del palacio solo aporta contexto. La torre procedural de 6 m de lado tiene cuerpo de 15,5 m, remate superior de 4,2 m y almenas visuales; no hay altura fuente y requiere revisión fotográfica.
- El catálogo `data/landmarks/landmarks.json` deriva las posiciones y huellas de geometrías OSM originales. Altura OSM explícita, conversión de plantas y altura visual se guardan en campos distintos; no se promociona un fallback artístico a dato fuente.
- `npm run fidelity` proyecta way geometries OSM y geometría serializada de chunks a EPSG:25829, compara IDs, tipo, número de vértices y error por vértice, con límite de 1 m. Se excluyen solo vías/huellas cuyo bounding box no intersecta ningún chunk jugable.
- El estado humano se guarda aparte en `data/landmarks/status.json`; el generador solo inicializa en pendiente y conserva aprobaciones existentes, y nunca aprueba una ficha.
- Para la extensión urbana, el área se amplía a un recorte cuadrado de 7,6 km por lado alrededor del mismo origen EPSG:25829, manteniendo los chunks de 256 m. La tesela MDT05 WCS se solicita con un chunk adicional de margen por lado y se mosaica solo cuando las teselas comparten dimensiones, origen alineado, resolución y nodata; si no, el proceso se detiene para evitar huecos o desplazamientos.
- El perímetro cerrado OSM `w389025250`, llamado «Ciudad de la Salud y la Innovación» y etiquetado `amenity=hospital`, se usa como límite del complejo sanitario. Contiene el POI Hospital de Día y el POI mal escrito «Hospital Universiario de Cáceres»; este último sigue clasificado como parada de taxi y no se usa como hospital.
- El Ministerio de Sanidad confirma que el Hospital Universitario de Cáceres está en Avenida de la Universidad 75; la página del Área de Salud ofrece un mapa basado en OpenStreetMap. El recinto del complejo es referencia geográfica, no huella de un edificio individual; los edificios OSM internos conservan sus propias huellas.
- La etiqueta fuente OSM `roof:shape=many` se conserva en el chunk; el verificador la acepta y el render usa el fallback geométrico por huella, ya que el constructor no tiene una cubierta procedural para ese perfil.
- Las torres sin `height=*` ni `building:levels` reciben un fallback visual de 7 plantas (21 m); el dato fuente permanece ausente. Se añaden almenas low-poly a partir de los bordes de la huella, también como detalle aproximado. No se añade esta geometría cuando el edificio usa un GLB local validado.
- Las cigüeñas ambientales se colocan únicamente en tejados con huella de edificio y altura visual conocida: todas las torres clasificadas y una selección estable por ID de edificios del casco. El modelo low-poly despega al entrar el jugador en 28 m y vuelve a posarse cuando se aleja; no se inventa una huella para la Torre de las Cigüeñas, cuyo OSM actual es solo un punto.
- Los soportales del Ayuntamiento se anclan al lado de su huella OSM más cercano al centro de la superficie OSM de Plaza Mayor. Sus arcos low-poly usan pilares de 2,55 m, separación basada en 3,1 m, 0,3 m de profundidad y radios visuales; no son cotas fuente y permanecen pendientes de comparación fotográfica. La portada apuntada low-poly de la Concatedral se ubica en el lado de la huella OSM más cercano a Plaza Mayor; ancho, altura y posición precisa son aproximaciones visuales. La torre occidental documentada se añade en el extremo oeste de la huella, con tres cuerpos (5,6/5,4/5,0 m de base, 3,5/3,5/4,2 m de alto) y cuatro flameros low-poly; su posición y proporciones requieren comparación fotográfica. Para San Francisco Javier se sitúan dos torres cuadradas en el lado de su huella más cercano a Plaza San Jorge, con cuerpos de 7,5 m, chapiteles piramidales de 1,5 m y ancho de 1,55 m; son valores visuales y no se infiere una huella independiente. La escalinata de San Jorge se obtiene de las vías `highway=steps` ya renderizadas, no de una segunda geometría aproximada.
