# Informe de fidelidad - Cáceres urbano y ciudad monumental

Región: cc-monumental; CRS: EPSG:25829; rectángulo: 7600 x 7600 m.
Fuente OSM: fecha base 2026-11-23T11:26:56Z.
Origen UTM fijado en Plaza Mayor: E 726089.228 m, N 4372723.106 m.

| Medida | Resultado |
| --- | ---: |
| Calles y sendas | 7894 |
| Segmentos de red vial topológica | 46812 |
| Conexiones de intersección | 74592 |
| Recorrido Plaza Mayor → Arco de la Estrella → Plaza de San Jorge | 403 m / 53 segmentos |
| Tramos de puente / túnel en el grafo | 145 / 59 |
| Vías con carriles OSM explícitos | 2671 |
| Vías con ancho OSM explícito | 299 |
| Vías con superficie OSM explícita | 4533 |
| Vías con dirección OSM explícita | 2320 |
| Huellas de edificios | 7152 |
| Edificios por zona (casco / ensanche / periferia) | 465 / 1904 / 4783 |
| Huellas incluidas en chunks del mundo | 7148 |
| Plantas OSM explícitas | 55 |
| Sustituciones GLB de hitos seguras | 0 |
| Superficies y agua | 2892 |
| Árboles y mobiliario | 10859 |
| Puntos de interés | 2280 |
| Hitos de referencia presentes / objetivo regional | 19 / 19 |
| Hitos pendientes de aprobación humana | 19 |
| Geometrías en superposición OSM | 7876 vías · 7148 huellas |
| Edificios sin altura/planta OSM | 7096 |
| Muestras MDT05 ausentes | 0 |
| Comercios pendientes de revisión de marca | 569 |

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
| Plaza Mayor | presente | polígono, trazado, vía | [w62237623](https://www.openstreetmap.org/way/62237623), [w756505344](https://www.openstreetmap.org/way/756505344) |
| Arco de la Estrella | presente | punto | [n419385562](https://www.openstreetmap.org/node/419385562) |
| Torre de Bujaco | presente | huella de edificio, polígono | [w385037728](https://www.openstreetmap.org/way/385037728) |
| Plaza de Santa María | presente | polígono, vía | [w35883286](https://www.openstreetmap.org/way/35883286) |
| Concatedral de Santa María | presente | huella de edificio, polígono | [w385037723](https://www.openstreetmap.org/way/385037723) |
| Plaza de San Jorge | presente | polígono, vía | [w35883265](https://www.openstreetmap.org/way/35883265) |
| Iglesia de San Francisco Javier | presente | huella de edificio, polígono | [w385037722](https://www.openstreetmap.org/way/385037722) |
| Palacio de los Golfines de Abajo | presente | centro de relación, polígono | [r5728957](https://www.openstreetmap.org/relation/5728957) |
| Casa de las Veletas | presente | huella de edificio, polígono | [w382363931](https://www.openstreetmap.org/way/382363931) |
| Torre de las Cigüeñas | presente | centro de relación, polígono, punto | [n13723182454](https://www.openstreetmap.org/node/13723182454), [r5728956](https://www.openstreetmap.org/relation/5728956) |
| Palacio de Carvajal | presente | huella de edificio, polígono | [w467504813](https://www.openstreetmap.org/way/467504813) |
| Muralla de Cáceres | presente | punto, trazado | [w619723664](https://www.openstreetmap.org/way/619723664) |
| Paseo de Cánovas | presente | polígono | [w30824096](https://www.openstreetmap.org/way/30824096) |
| Avenida de España | presente | trazado, vía | [w1286074626](https://www.openstreetmap.org/way/1286074626), [w22358115](https://www.openstreetmap.org/way/22358115), [w30824099](https://www.openstreetmap.org/way/30824099), [w30824100](https://www.openstreetmap.org/way/30824100), [w30824101](https://www.openstreetmap.org/way/30824101), [w310324536](https://www.openstreetmap.org/way/310324536), [w310763127](https://www.openstreetmap.org/way/310763127), [w362655714](https://www.openstreetmap.org/way/362655714), [w373226713](https://www.openstreetmap.org/way/373226713), [w374948159](https://www.openstreetmap.org/way/374948159), [w388251659](https://www.openstreetmap.org/way/388251659), [w392249363](https://www.openstreetmap.org/way/392249363), [w419864787](https://www.openstreetmap.org/way/419864787), [w419864788](https://www.openstreetmap.org/way/419864788), [w537215910](https://www.openstreetmap.org/way/537215910), [w713397871](https://www.openstreetmap.org/way/713397871), [w775713208](https://www.openstreetmap.org/way/775713208), [w89209796](https://www.openstreetmap.org/way/89209796) |
| Parque del Príncipe | presente | polígono | [w590540343](https://www.openstreetmap.org/way/590540343) |
| Estadio Príncipe Felipe | presente | polígono | [w257266364](https://www.openstreetmap.org/way/257266364) |
| Estación de tren | presente | huella de edificio, polígono, punto | [n11738349056](https://www.openstreetmap.org/node/11738349056), [n9378734383](https://www.openstreetmap.org/node/9378734383), [w53246385](https://www.openstreetmap.org/way/53246385) |
| Hospital de Cáceres | presente | polígono | [w389025250](https://www.openstreetmap.org/way/389025250) |
| Campus universitario | presente | punto, trazado | [w83134082](https://www.openstreetmap.org/way/83134082) |

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
- Avenida de España (avenida-de-espana)
- Parque del Príncipe (parque-del-principe)
- Estadio Príncipe Felipe (estadio-principe-felipe)
- Estación de tren (estacion-de-tren)
- Hospital de Cáceres (hospital-de-caceres)
- Campus universitario (campus-universitario)


Los puentes reciben solo un perfil visual de rampa (máximo 1,8 m) porque la extracción no aporta una cota vertical fiable; los túneles se conservan transitables a cota MDT05 hasta que exista geometría de excavación.
Las conexiones de intersección se derivan de nodos compartidos. Esta versión no incluye relaciones OSM de restricción de giro.

