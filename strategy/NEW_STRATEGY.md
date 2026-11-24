# Nueva Estrategia de Desarrollo: Inspiración en «Badajoz: El Juego» y «gamedev-skills»

> **Directriz Fundamental:** A partir de noviembre de 2026, el desarrollo de *Cáceres Criminal* evoluciona de un banco de pruebas de motor (*tech demo* procedural abstracto) a un **videojuego de mundo abierto disfrutable, identitario y comercial**, adoptando las soluciones prácticas que hicieron triunfar a **Badajoz: El Juego** (creado por Alfredo Narváez / Basel1905 Studio) junto con los patrones de arquitectura de **gamedev-skills**.

---

## 1. Los 5 Pilares de la Nueva Estrategia

### Pilar 1: Adopción de Assets 3D Reales en GLB (Fin del "todo procedural en código")
* **El problema superado:** Construir vehículos, monumentos y mobiliario ensamblando cientos de primitivas matemáticas (`BoxGeometry`, `CylinderGeometry`) en código TypeScript consume semanas de esfuerzo, es casi imposible de iterar visualmente y produce un acabado sintético de "bloques".
* **La nueva regla:** 
  * Se permite y prioriza la importación de **modelos 3D optimizados en formato GLB/glTF** (licencias CC0 o CC-BY como Kenney, Quaternius o Poly Haven, o modelos modelados en Blender).
  * Los monumentos cacereños emblemáticos (Torre de Bujaco, Concatedral de Santa María, Arco de la Estrella, Palacio de Carvajal, Plaza Mayor) se incorporarán como modelos GLB con texturas PBR limpias en `public/landmarks/`, aprovechando el `AssetManager` ya existente.
  * Los vehículos y personajes emplearán modelos con mallas bien proporcionadas y rigs estándar, reduciendo el código procedural a meros fallbacks.

---

### Pilar 2: Enriquecimiento con Datos Abiertos Oficiales (Catastro + OSM + IGN)
* **La lección de Badajoz:** Para levantar 34 km² y 12.000 portales reales, no se inventó la ciudad: se cruzó la cartografía de OpenStreetMap con las capas vectoriales abiertas del **Catastro de España** (alturas oficiales, número de plantas exacto, portales y direcciones) y el relieve del **IGN (MDT05)**.
* **La nueva regla:**
  * Enriquecer los datos de edificios para incluir el número de calle/portal y la altura catastral real en lugar de multiplicar heurísticas de plantas (`levels * 3`).
  * Los portales reales se convertirán en puntos de interacción donde el jugador puede buscar su casa, alquilar pisos francos o interactuar con vecinos.

---

### Pilar 3: Bucle de Juego con Sabor Local («Gameplay-First»)
* **El problema superado:** Tener un motor con sombras cascadas y físicas avanzadas no es divertido si el jugador solo puede correr en línea recta o robar un coche sin objetivo alguno.
* **La nueva regla:** Implementar un **bucle de misiones, oficios y economía cotidiana** inspirada en Cáceres:
  1. **Líneas de Autobús Urbano de Cáceres:** Conducir autobuses por trayectos reales (Línea 1, Línea 8) deteniéndose en marquesinas geolocalizadas para transportar viajeros y ganar euros.
  2. **Repartos en el Casco Histórico:** Misiones contrarreloj puerta a puerta en moto, furgoneta o a pie por las callejuelas empedradas de la Judería y el recinto intramuros.
  3. **Guía Turístico y Recorridos:** Misiones de transporte y escolta a visitantes entre la Plaza Mayor, el Arco de la Estrella, San Jorge y los museos.
  4. **Carreras Callejeras Urbanas:** Circuitos con puntos de control por las avenidas amplias (Paseo de Cánovas, Av. de España, Av. de Alemania).
  5. **Economía y Progresión:** Dinero ganado (€), posibilidad de comprar ropa, personalizar vehículos y adquirir refugios seguros en la ciudad.

---

### Pilar 4: Presentación Comercial y UI Limpia
* **El problema superado:** Mostrar el panel de depuración F3 por defecto transmitía la imagen de un software roto o a medio hacer.
* **La nueva regla:**
  * El panel de estadísticas técnicas F3 queda **completamente oculto por defecto** y solo se activa explícitamente mediante la tecla `F3` o el parámetro `?debug=1`.
  * La interfaz visible por defecto es puramente de videojuego:
    * **Minimapa táctico de radar** con brújula y blips de interés.
    * **Velocímetro / tacómetro** limpio al conducir.
    * **Contador de dinero / cartera (€)** y nivel de búsqueda.
    * **Notificaciones estilizadas de misiones y encargos**.

---

### Pilar 5: Arquitectura de Audio y Feedback Inmersivo (`gamedev-skills`)
* Continuar expandiendo la arquitectura de Web Audio API:
  * Emisoras de radio local ficticias con música libre o temática regional al subir a los vehículos.
  * Diálogos y exclamaciones vecinales procedimentales o sintetizadas.
  * Retroalimentación háptica y sacudidas cinemáticas de cámara en colisiones y frenadas.

---

## 2. Mapa de Carpetas de Estrategia
Para consultar los detalles de diseño específicos, la carpeta `strategy/` recoge:
* [NEW_STRATEGY.md](file:///c:/Users/cerbe/Downloads/CTA-main/CTA-main/repo/strategy/NEW_STRATEGY.md): Este documento marco.
* [GAMEPLAY_AND_MISSIONS.md](file:///c:/Users/cerbe/Downloads/CTA-main/CTA-main/repo/strategy/GAMEPLAY_AND_MISSIONS.md): Diseño detallado de misiones, oficios cacereños y sistema de economía.
* [ASSET_AND_DATA_PIPELINE.md](file:///c:/Users/cerbe/Downloads/CTA-main/CTA-main/repo/strategy/ASSET_AND_DATA_PIPELINE.md): Directrices técnicas para Catastro, modelos GLB y optimización en WebGL.
