# Diseño de Gameplay, Oficios Cacereños y Misiones

> **Inspiración directa:** *Badajoz: El Juego* demostró que el verdadero enganche para los jugadores en una recreación de una ciudad extremeña no es un simulador criminal genérico, sino la **cotidianidad local, oficios auténticos, turismo identitario y libertad para interactuar con la ciudad real**.

---

## 1. Filosofía de Diseño: De Tech Demo a Juego Vivo

En lugar de intentar construir de cero misiones complejas con cinemáticas pesadas que colapsen el desarrollo en navegador, adoptamos la arquitectura de **bucles de eventos modulares y oficios urbanos** inspirada en el modelo de *Badajoz*:

1. **Accesibilidad inmediata:** El jugador puede explorar libremente Cáceres o iniciar oficios directamente interactuando con vehículos de servicio o marcadores de mapa.
2. **Economía tangible (€):** Todo oficio y actividad remunera en euros (€), que se reflejan en el HUD y se guardan en `localStorage` / `IndexedDB`.
3. **Identidad local:** Cada misión ocurre en calles, plazas y monumentos reales de Cáceres (Plaza Mayor, Cánovas, Judería, Av. de la Montaña, Campus Universitario, Hospital San Pedro de Alcántara).

---

## 2. Los 4 Grandes Oficios Cacereños

### Oficio 1: Conductor de Autobús Urbano (Líneas 1 y 8 de Cáceres)
* **Vehículo:** Autobús urbano accesible en las cabeceras de línea o en paradas específicas.
* **Mecánica:**
  * Al subir a un autobús urbano, el jugador activa el modo servicio pulsando `[E]` o mediante un botón táctil.
  * Se genera una ruta de puntos de control (checkpoints) en las **marquesinas reales** de Cáceres (datos extraídos de OSM `highway=bus_stop`).
  * En cada parada, el jugador debe detener el vehículo en el área marcada durante 4 segundos mientras suena el audio de puertas neumáticas y subida de viajeros.
  * Bonificación por puntualidad y conducción suave (sin colisiones con mobiliario o peatones).
* **Rutas oficiales:**
  * **Línea 1 (Plaza Mayor - Aldea Moret / Hospital):** Recorrido transversal que une el centro con la periferia.
  * **Línea 8 (Cáceres el Viejo - Campus Universitario):** Recorrido estudiantil y residencial.
* **Recompensa:** 15 € por parada completada + bono de 150 € por trayecto completo.

---

### Oficio 2: Repartidor Exprés por el Casco Histórico y la Judería
* **Vehículo:** Ciclomotor / Scooter o a pie (las calles intramuros son peatonales y estrechas).
* **Mecánica:**
  * El jugador recoge paquetes en la oficina de paquetería (cerca de la Plaza de la Concepción o Plaza Mayor).
  * Se asignan de 3 a 5 direcciones con **número de portal y calle real** (usando datos del Catastro: p. ej., *Calle Adarve de Santa Ana 4*, *Cuesta de Aldana 2*, *Calle de los Defensores 7*).
  * Navegación guiada por el minimapa mediante blips amarillos.
  * Al llegar al portal, el jugador desciende del vehículo, entra en el marcador del portal y pulsa `[E]` para entregar.
* **Desafío:** El terreno empedrado, las cuestas pronunciadas y las escaleras del casco histórico requieren habilidad de conducción y trayectos a pie.
* **Recompensa:** 25 € a 40 € por paquete según la distancia y tiempo restante.

---

### Oficio 3: Guía Turístico Oficial de la Ciudad Monumental
* **Vehículo:** A pie (modo peatonal).
* **Mecánica:**
  * Se activa hablando con un grupo de turistas en la Plaza Mayor (frente al Ayuntamiento o la Torre de Bujaco).
  * El jugador debe guiar al grupo a través de un itinerario patrimonial:
    1. **Torre de Bujaco** y adarves de la muralla.
    2. **Arco de la Estrella** (puerta de entrada a la Ciudad Monumental).
    3. **Plaza de Santa María y Concatedral**.
    4. **Palacio de los Golfines de Abajo**.
    5. **Plaza de San Jorge y Ermita de la Paz**.
    6. **Aljibe del Museo de Cáceres (Palacio de las Veletas)**.
  * El grupo de NPCs sigue al jugador con el sistema de comportamiento peatonal. Si el jugador corre demasiado rápido o se aleja, los turistas se detienen y alertan.
  * En cada hito, se muestra un banner con datos históricos reales y amenos de Cáceres.
* **Recompensa:** 200 € al completar el recorrido + bonus de propina si no sufrieron percances.

---

### Oficio 4: Carreras Urbanas Nocturnas (Cáceres Speed)
* **Vehículo:** Turismos deportivos y utilitarios trucados.
* **Mecánica:**
  * Se activan en ubicaciones clandestinas en horario nocturno (ej. polígono de Las Capellanías o inmediaciones del Recinto Ferial).
  * Circuitos de 2 a 3 vueltas señalizados con arcos luminosos y flechas holográficas en curvas.
  * Circuitos planificados:
    * **Circuito Cánovas:** Paseo de Cánovas, Av. de España, Av. Virgen de la Montaña.
    * **Circuito Ronda Norte:** Vía rápida de circunvalación con amplias curvas para máxima velocidad.
* **Recompensa:** 500 € al primer puesto, trofeos guardados en perfil.

---

## 3. Sistema de Economía y Progresión

* **Moneda:** Euro (€).
* **Gastos disponibles para el jugador:**
  1. **Gasolinera y talleres de reparación:** Reparar carrocería, abolladuras y cristales rotos en talleres de barrio.
  2. **Refugios y pisos francos (Portales reales):** Posibilidad de comprar o alquilar portales en la ciudad donde reaparecer (*spawn points*) y guardar vehículos.
  3. **Tiendas de ropa y complementos:** Personalizar el aspecto del protagonista con atuendos urbanos, chalecos de trabajo o trajes regionales.
  4. **Concesionario de vehículos:** Adquirir en propiedad vehículos utilitarios, deportivos, furgonetas de reparto o el icónico autobús urbano.

---

## 4. Estructura de Datos para Implementación Fácil en Código

Para garantizar que el desarrollo sea ágil y no requiera sistemas gigantescos, cada misión u oficio se define mediante una interfaz TypeScript sencilla y un array declarativo:

```typescript
export interface MissionObjective {
  id: string;
  type: 'reach_checkpoint' | 'stop_and_wait' | 'deliver_package' | 'escort_npcs' | 'eliminate_target';
  position: { x: number; y: number; z: number };
  radius: number;
  timeLimitSeconds?: number;
  description: string;
  landmarkName?: string;
}

export interface CityJob {
  id: string;
  title: string;
  category: 'bus_route' | 'courier' | 'tourist_guide' | 'street_race';
  requiredVehicleType?: string;
  payoutEuros: number;
  startLocation: { x: number; y: number; z: number };
  objectives: MissionObjective[];
}
```

Esta estructura permite añadir decenas de misiones y oficios simplemente rellenando coordenadas de calles reales de Cáceres, sin necesidad de tocar la lógica del motor físico o gráfico.
