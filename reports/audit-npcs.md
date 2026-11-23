# Auditoría del grafo viario (fase 10)

Fecha: 2026-11-23

## Resumen

| Medida | Resultado |
| --- | ---: |
| Nodos | 41253 |
| Segmentos | 46812 |
| Tramos peatonales | 15983 |
| Conexiones de giro | 74592 |
| Intersecciones | 9277 |
| Coincidencia con el manifiesto | sí |
| Nodos aislados | 0 |
| Nodos con una sola arista | 647 |
| Intersecciones sin conexiones de giro | 0 |
| Sumideros vehiculares | 11 |
| Fuentes vehiculares | 9 |
| Tramos peatonales dentro de una huella | 300 |

## Hallazgos

- **Criticidad alta si falla:** el manifiesto y el grafo deben coincidir; resultado: OK.
- **Media:** los nodos aislados y las fuentes/sumideros vehiculares se excluyen al generar agentes.
- **Media:** los callejones sin salida son válidos en casco histórico; se documentan, no se corrige la fuente OSM.
- **Alta:** 300 tramos peatonales atraviesan huellas conocidas; el sistema los descarta mediante la prueba de edificio antes de mover al agente.
- Ejemplos: w107679673:1, w223378216:1, w223378216:7, w263820955:0, w263820955:1, w298592559:0, w298592559:3, w298592559:5, w30334864:0, w30334864:2.

## Límites de los datos

- El extracto no contiene semáforos ni señales de stop en el grafo: los agentes usan prioridad por llegada y cesión temporal en intersecciones, no una fase de señales real.
- Las aceras inferidas del phase 4 son geometría visual; el grafo peatonal usa únicamente `highway` y `walkable` de OSM.
- Los modelos son procedurales y se comparten por instancias; no hay animación de extremidades por agente en esta fase.
- No se comprueba la distancia al bordillo ni la altura de paso de peatones: los agentes siguen la cota MDT05 muestreada en cada paso.
