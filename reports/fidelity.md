# Informe de fidelidad - Ciudad Monumental

Región: cc-monumental; CRS: EPSG:25829; rectángulo: 1000 x 1000 m.
Fuente OSM: fecha base 2026-11-22T23:10:26Z.
Origen UTM fijado en Plaza Mayor: E 726089.228 m, N 4372723.106 m.

| Medida | Resultado |
| --- | ---: |
| Calles y sendas | 689 |
| Segmentos de red vial topológica | 2744 |
| Conexiones de intersección | 4144 |
| Recorrido Plaza Mayor → Arco de la Estrella → Plaza de San Jorge | 403 m / 53 segmentos |
| Tramos de puente / túnel en el grafo | 3 / 18 |
| Vías con carriles OSM explícitos | 260 |
| Vías con ancho OSM explícito | 30 |
| Vías con superficie OSM explícita | 510 |
| Vías con dirección OSM explícita | 246 |
| Huellas de edificios | 2847 |
| Edificios por zona (casco / ensanche / periferia) | 448 / 1904 / 495 |
| Huellas incluidas en chunks del mundo | 2811 |
| Plantas OSM explícitas | 13 |
| Sustituciones GLB de hitos seguras | 0 |
| Superficies y agua | 147 |
| Árboles y mobiliario | 628 |
| Puntos de interés | 391 |
| Hitos de referencia presentes / objetivo regional | 13 / 13 |
| Hitos pendientes de aprobación humana | 13 |
| Geometrías en superposición OSM | 675 vías · 2811 huellas |
| Edificios sin altura/planta OSM | 2834 |
| Muestras MDT05 ausentes | 0 |
| Comercios pendientes de revisión de marca | 158 |

Los atributos de altura y plantas ausentes permanecen nulos en los datos fuente. La altura visual usa height=* → building:levels × 3 m → planta visual por zona/tipo; las fachadas conservan el número fuente y el valor inferido por separado.
El inspector 2D ofrece una superposición cian/magenta de la geometría OSM original frente a los chunks procesados. La herramienta `npm run fidelity` compara cada vértice de las vías y huellas fuente que intersectan el mundo con una tolerancia máxima de 1 m.
Las torres sin altura ni plantas explícitas reciben 7 plantas visuales (21 m) para lectura de silueta; es un fallback artístico, no una medición. El Arco de la Estrella usa la posición OSM del POI y una orientación perpendicular a la vía más cercana; sus dimensiones y el almenado de torres son aproximaciones visuales, no datos de levantamiento.
Los polígonos OSM etiquetados place=square se conservan como superficies y POIs; el terreno los representa con material de piedra usando la huella fuente.
Las líneas OSM barrier=city_wall generan un muro monumental sobre su trazado fuente; la altura, el grosor y las almenas visuales se documentan como aproximaciones porque la línea no aporta cotas.
La zona se clasifica desde el centro de Plaza Mayor: casco hasta 220 m (o etiqueta historic/tipo monumental), ensanche hasta 500 m y periferia más allá. Es una heurística cartográfica registrada, no una frontera administrativa.
El ancho de vía usa width=* → lanes × 3,1 m → default por tipo de vía; las aceras también se infieren solo cuando no hay etiqueta OSM explícita.
La ruta enlaza Plaza Mayor (snap 18.3 m), Arco de la Estrella (snap 0.0 m) y Plaza de San Jorge (snap 4.3 m) mediante segmentos peatonales y calles locales.

## Hitos de referencia

La comparación usa coincidencia exacta de nombre tras normalizar mayúsculas, espacios y tildes. Los IDs OSM indican las entidades fuente; “no encontrado” no significa que el elemento no exista, sino que no aparece con esos nombres en el extracto consultado.

| Hito | Estado en la región | Geometría fuente | IDs OSM |
| --- | --- | --- | --- |
| Plaza Mayor | presente | vía | [w62237623](https://www.openstreetmap.org/way/62237623), [w756505344](https://www.openstreetmap.org/way/756505344) |
| Arco de la Estrella | presente | punto | [n419385562](https://www.openstreetmap.org/node/419385562) |
| Torre de Bujaco | presente | huella de edificio, punto | [w385037728](https://www.openstreetmap.org/way/385037728) |
| Plaza de Santa María | presente | vía | [w35883286](https://www.openstreetmap.org/way/35883286) |
| Concatedral de Santa María | presente | huella de edificio, punto | [w385037723](https://www.openstreetmap.org/way/385037723) |
| Plaza de San Jorge | presente | vía | [w35883265](https://www.openstreetmap.org/way/35883265) |
| Iglesia de San Francisco Javier | presente | huella de edificio, punto | [w385037722](https://www.openstreetmap.org/way/385037722) |
| Palacio de los Golfines de Abajo | presente | centro de relación | [r5728957](https://www.openstreetmap.org/relation/5728957) |
| Casa de las Veletas | presente | huella de edificio | [w382363931](https://www.openstreetmap.org/way/382363931) |
| Torre de las Cigüeñas | presente | punto | [n13723182454](https://www.openstreetmap.org/node/13723182454) |
| Palacio de Carvajal | presente | huella de edificio, punto | [w467504813](https://www.openstreetmap.org/way/467504813) |
| Muralla de Cáceres | presente | punto, trazado | [w619723664](https://www.openstreetmap.org/way/619723664) |
| Paseo de Cánovas | presente | polígono, punto | [w30824096](https://www.openstreetmap.org/way/30824096) |
| Avenida de España | fuera de esta región | — | — |
| Parque del Príncipe | fuera de esta región | — | — |
| Estadio Príncipe Felipe | fuera de esta región | — | — |
| Estación de tren | fuera de esta región | — | — |
| Hospital de Cáceres | fuera de esta región | — | — |
| Campus universitario | fuera de esta región | — | — |

### Aprobación humana pendiente

- Plaza Mayor (plaza-mayor)
- Arco de la Estrella (arco-de-la-estrella)
- Torre de Bujaco (torre-de-bujaco)
- Plaza de Santa María (plaza-de-santa-maria)
- Concatedral de Santa María (concatedral-de-santa-maria)
- Plaza de San Jorge (plaza-de-san-jorge)
- Iglesia de San Francisco Javier (iglesia-san-francisco-javier)
- Palacio de los Golfines de Abajo (palacio-golfines-abajo)
- Casa de las Veletas (casa-de-las-veletas)
- Torre de las Cigüeñas (torre-de-las-ciguenas)
- Palacio de Carvajal (palacio-de-carvajal)
- Muralla de Cáceres (muralla-de-caceres)
- Paseo de Cánovas (paseo-de-canovas)


Los puentes reciben solo un perfil visual de rampa (máximo 1,8 m) porque la extracción no aporta una cota vertical fiable; los túneles se conservan transitables a cota MDT05 hasta que exista geometría de excavación.
Las conexiones de intersección se derivan de nodos compartidos. Esta versión no incluye relaciones OSM de restricción de giro.

