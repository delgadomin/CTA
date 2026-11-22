# Informe de fidelidad - Ciudad Monumental

Región: cc-monumental; CRS: EPSG:25829; rectángulo: 1000 x 1000 m.
Fuente OSM: fecha base 2026-11-22T14:45:50Z.
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
| Superficies y agua | 132 |
| Árboles y mobiliario | 628 |
| Puntos de interés | 377 |
| Edificios sin altura/planta OSM | 2834 |
| Muestras MDT05 ausentes | 0 |
| Comercios pendientes de revisión de marca | 170 |

Los atributos de altura ausentes permanecen nulos en los datos fuente. Para la visualización, el ancho usa width=* → lanes × 3,1 m → default por tipo de vía; las aceras también se infieren solo cuando no hay etiqueta OSM explícita.
La ruta enlaza Plaza Mayor (snap 18.3 m), Arco de la Estrella (snap 0.0 m) y Plaza de San Jorge (snap 4.3 m) mediante segmentos peatonales y calles locales.
Los puentes reciben solo un perfil visual de rampa (máximo 1,8 m) porque la extracción no aporta una cota vertical fiable; los túneles se conservan transitables a cota MDT05 hasta que exista geometría de excavación.
Las conexiones de intersección se derivan de nodos compartidos. Esta versión no incluye relaciones OSM de restricción de giro.

