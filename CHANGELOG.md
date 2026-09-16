# Changelog

Cambios notables del proyecto, del más reciente al más antiguo. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). El proyecto aún no usa números de
versión: cada entrada se identifica por fecha y pull request.

## Sin publicar — Bandas verticales (fase 3)

Rama `claude/bandas-verticales`.

### Añadido

- **Franjas divididas en bandas verticales:** una banda nueva que reparte su ancho en verticales, cada
  una con su ancho (la última ocupa el resto) y sus propias bandas de filas o zonas de mesas
  apiladas. El alto de la franja es el de la vertical más alta.
- **Panel de bandas anidado:** franjas con «+ vertical»; verticales con ancho, mover a izquierda o
  derecha, agregar filas o mesas dentro y eliminar; bandas internas con sus controles de siempre.
  Botón «Agregar franja con bandas verticales».
- **Piezas ancladas a su región:** al cambiar cualquier banda, las mesas, los bloques y el escenario
  se mueven con la región donde están, en vertical y en horizontal (`reanclarPiezas`).
- **Límites de bandas y verticales** dibujados en el plano del editor.
- Los mapas guardan y validan las franjas (ids únicos en todo el árbol, anchos, solo filas o mesas
  dentro de una vertical, verticales que caben).
- Pruebas de disposición, columnas y numeración en verticales, anclaje al cambiar ancho, alto y
  orden, agregar y eliminar verticales, y mapas (71 en total).

### Corregido

- **Arrastrar sobre el plano seleccionaba los textos del SVG** («ESCENARIO», «Mesa 1»…). Ahora el
  plano no permite seleccionar texto. Se vio al probar el arrastre con el ratón real.

### Cambiado

- **El aforo** dice «N filas en bandas» cuando hay filas que no ocupan todo el ancho.

## 2026-09-16 — PR #7: escenario movible (fase 2)

[PR #7](https://github.com/jonathancr29/selector-asientos/pull/7), fusionado en `main` con el
commit `5724d9a`.

### Añadido

- **El escenario es una pieza:** se arrastra, se mueve con flechas, se gira 90° (intercambia ancho y
  alto) y cambia de ancho y alto desde la barra del editor. No se elimina; no puede pisar filas,
  mesas ni bloques, y puede cruzar pasillos.
- **Todo se mide desde el escenario:** las filas de las bandas miran hacia donde esté, la fila A de
  cada zona es la más cercana y los rótulos cambian con ella. Los bloques cuentan en la numeración
  por zona solo si lo miran de frente.
- **Bloques nuevos orientados hacia el escenario.**
- **Mapas:** guardan el escenario (campo opcional de la versión 2) y lo validan al importar.
- Pruebas del escenario: posición por defecto, choques, tamaño, giro, filas y letras con el
  escenario abajo, bloques de frente y de espaldas, orientación de bloques nuevos, columnas y mapas
  (64 en total).

### Cambiado

- **Las piezas pueden ocupar la franja inicial** si el escenario no está ahí (`sala.filas.min` pasa a
  0).
- **Al cambiar las columnas,** un escenario a todo el ancho sigue a todo el ancho.

## 2026-09-16 — PR #6: bloques de filas libres (fase 1)

[PR #6](https://github.com/jonathancr29/selector-asientos/pull/6), fusionado en `main` con el
commit `8dcb583`.

### Añadido

- **Bloques de filas libres:** rectángulos de butacas (butacas por fila × filas) que se agregan,
  arrastran, mueven con flechas, giran y redimensionan como las mesas. Cada uno elige su zona y
  puede tener nombre. Pueden ocupar columnas de pasillo de las bandas; no pueden pisar filas, mesas
  ni otros bloques.
- **Numeración de teatro:** lo que mira al escenario se numera por zona, con la fila más cercana como
  A y las butacas de izquierda a derecha a través de bandas y bloques (A1–A5 y A6–A7). Los bloques
  girados llevan su nombre y su propia secuencia.
- **Ids estables separados de la etiqueta visible:** mover o girar un bloque no cambia los ids de sus
  butacas (`F1-2-3`), así que se conservan la selección, las reservas y las bloqueadas.
- **Editor:** botón «Bloque de filas», acciones «+ fila» y «− fila» (atajos `]` y `[`), y campos
  Zona y Nombre para el bloque activo. Los mapas guardan los bloques.
- Pruebas de geometría, numeración por zona, ids estables, choques, crecimiento, giro, bandas, mapas
  y letras después de la Z (56 en total).

### Cambiado

- **Dos bandas de la misma zona ya no reinician en A:** la segunda continúa la secuencia. Los rótulos
  de las bandas muestran la letra de su zona.
- **`girarMesa` y `primeraMesaQueNoCabe` pasan a `girarPieza` y `primeraPiezaQueNoCabe`**: valen para
  mesas y bloques.

## 2026-09-16 — PR #5: columnas libres y filas mirando al escenario

[PR #5](https://github.com/jonathancr29/selector-asientos/pull/5), fusionado en `main` con el
commit `f420bdf`.

### Añadido

- **Columnas libres:** en el editor, «Diseño de la sala → Columnas» permite escribir las butacas por
  bloque (`4, 6, 4`) y el ancho de cada pasillo (`1, 2`). Las columnas son las mismas para toda la
  sala. Límites: 1 a 10 bloques, 1 a 40 butacas por bloque, pasillos de 1 a 10 columnas y 60
  columnas en total.
- **Recolocación de mesas al cambiar las columnas:** con el mismo número de bloques, cada mesa se
  queda en su bloque; si cambia, conserva su posición relativa en la sala. Si alguna no cabe, el
  cambio no se aplica.
- Pruebas de rejilla por bloques, lectura de los campos, recolocación de mesas, mapas con columnas
  y lectura de mapas de la versión 1 (44 en total).

### Cambiado

- **Las butacas de fila miran al escenario:** giran 180°, con el respaldo abajo. Antes tenían el
  respaldo hacia el escenario.
- **La rejilla** se construye desde `{ bloques, pasillos }` (`rejillaDeBloques`); las disposiciones
  con nombre de las plantillas se convierten a esa forma.
- **Mapas, formato versión 2:** guardan `distribucion` en lugar de `pasillos`. Los mapas de la
  versión 1 se convierten al cargarlos.
- **El panel del editor** pasa a llamarse «Diseño de la sala», con las secciones Columnas y Bandas.

## 2026-09-16 — PR #4: mapas guardados y butacas bloqueadas

[PR #4](https://github.com/jonathancr29/selector-asientos/pull/4), fusionado en `main` con el
commit `33b3c89`.

### Añadido

- **Mapas guardados con nombre, sin base de datos.** En el editor: campo «Nombre del mapa» con
  **Guardar** (en el navegador, con `localStorage`) y **Eliminar mapa**. Los mapas aparecen en el
  selector «Tipo de sala», en el grupo **Mis mapas**, y siguen ahí al recargar. Si el nombre existe,
  se pregunta antes de sobrescribir.
- **Exportar e importar JSON.** Formato `selector-asientos/mapa`, versión 1: nombre, pasillos,
  bandas, mesas, butacas bloqueadas y contadores de ids. Sin ocupación ni selección.
- **Validación de mapas** al importar y al cargar: formato, versión, cada banda y mesa, campos
  desconocidos descartados y comprobación de que todas las mesas quepan. Los mapas guardados que no
  validan no se cargan y se avisa de cuáles.
- **Herramienta «Bloquear butacas»** en el editor: clic o Enter sobre una butaca de fila o lugar de
  mesa para bloquearla o desbloquearla (por ejemplo, sin visibilidad). Las ocupadas no se bloquean.
- Pruebas de bloqueos, mapas (ida y vuelta por JSON, sin ocupación), validación, contadores y nombre
  de archivo (37 en total).

### Cambiado

- **Las bloqueadas son una lista de ids** en el plano; `bloqueadasAlFinal` de las plantillas solo
  se usa como valor inicial.
- **La ocupación de ejemplo de las mesas** pasa de una constante global a cada plantilla
  (`mesasOcupadas`), para que un mapa guardado no la herede.
- **Si al regenerar una butaca elegida deja de estar libre**, se suelta con aviso.

## 2026-09-16 — PR #3: mesas configurables y tipos de sala

[PR #3](https://github.com/jonathancr29/selector-asientos/pull/3), fusionado en `main` con el
commit `8438432`.

### Añadido

- **Mesas configurables** con cuatro datos: `largo` (1 a 8 celdas de tablero), `cabeceras`,
  `unLado` y `giro` (0°, 90°, 180° o 270°). `geometriaMesa` calcula de ellos la huella, el tablero y los lugares.
- **Estilo cruz:** una celda de mesa y un lugar por lado (3 × 3), junto al estilo de siempre,
  **lados** (2 × 3). Las esquinas vacías de la huella quedan reservadas.
- **Estilo «Un lado»** (barra): largo 4, lugares en un solo lado largo (4 × 2), y acción **Un solo
  lado** (U) para alternar cualquier mesa entre uno y dos lados.
- **Las sillas miran hacia la mesa** en cualquier forma y giro. Las marcas de estado giran con la
  silla solo a 90° o 270°, para caber en el hueco del icono.
- **Girar 90°** sobre el centro de la mesa, en cuartos de vuelta. Cuatro giros la dejan donde estaba.
- **Alargar y acortar** la mesa de celda en celda, y **poner o quitar cabeceras**.
- **Agregar mesas** (Lados o Cruz) en el primer hueco libre, y **eliminar mesas**. Los ids de mesa
  no se reutilizan.
- **Mesa activa** en el editor, con barra de botones y atajos: R, +, −, C, U y Supr.
- **Sitio cercano:** si una transformación no cabe en su sitio, se prueba a una celda de distancia.
- **Avisos** al quitar lugares elegidos u ocupados al acortar, quitar cabeceras, pasar a un solo
  lado o eliminar.
- Pruebas de geometría, hacia dónde mira cada silla, ids, giro, largo, cabeceras, un solo lado,
  sitio cercano y sitio libre.

- **Tipos de sala:** el selector «Pasillos» pasa a «Tipo de sala», con las cuatro salas mixtas de
  siempre más **Solo filas** y **Solo mesas**. Cada tipo define sus pasillos y sus bandas.
- **Bandas:** la sala es una lista de bandas (escenario, filas, zona de mesas). En el editor, un
  panel permite agregar, quitar, subir y bajar bandas, cambiar su número de filas o su alto y su
  zona. Las mesas de debajo o de dentro se desplazan con la banda, y un cambio que deja una mesa
  sin caber no se aplica.
- **Las mesas pueden ir en cualquier hueco libre de la sala.**
- Pruebas de tipos de sala, bandas y `planoDesdeSala` (31 en total).

### Cambiado

- **Ids de las butacas de fila con la banda delante** (`luneta-A1`, `general-A1`): cada banda empieza
  su secuencia en A. Las filas G y H de la sala mixta pasan a ser **A y B de General**.
- **Etiquetas y resumen** nombran la banda: «Luneta, fila A, butaca 3»; «General · 2 lugares (A1, A2)».
- **«Restablecer mesas» pasa a «Restablecer sala»** y restablece también las bandas.
- **El aforo** cuenta filas y mesas: «5 filas de 12 butacas · 6 mesas · 84 lugares en total».
- **Ids de los lugares de mesa por lado:** `M2-N1`, `M2-S2`, `M2-C1` en lugar de `M2-1` a
  `M2-4`. El número que se muestra sigue el sentido horario.
- **La banda General baja tres filas** (de la 15 a la 18) para dejar una franja libre donde colocar
  mesas nuevas.
- **El plano guardado** pasa a ser por tipo de sala, con bandas y configuraciones completas de mesa.
- **La barra del editor** agrupa agregar, acciones de mesa y «Restablecer mesas», que ahora
  restablece también la forma.

## 2026-09-16 — PR #1: correcciones, accesibilidad y modo editor de mesas

[PR #1](https://github.com/jonathancr29/selector-asientos/pull/1), fusionado en `main` con el
commit `0a611c9`.

### Añadido

- **Modo editor** (`dfc6595`). Botones «Previsualizar» y «Editar plano».
  - Cada mesa ocupa 6 celdas (2 × 3): cuatro lugares alrededor y la mesa en las dos de en medio.
  - Arrastrar y soltar encajado en la rejilla, con una sombra de destino: verde si cabe, roja y
    discontinua si no.
  - Una mesa cabe si sus celdas están dentro de la sala, libres y fuera de pasillos. Si no cabe,
    se queda en su sitio y se anuncia el motivo.
  - Teclado: flechas al siguiente hueco libre, saltando pasillos y mesas; Esc cancela.
  - Posiciones guardadas por disposición y botón «Restablecer mesas».
- **Pellizco con dos dedos** y arrastre multitáctil (`d7f0fd6`).
- **Marcas de estado que no dependen del color** (`8e836ea`): palomita en la seleccionada, aspa en
  la ocupada y raya en la bloqueada. La leyenda usa los mismos `<symbol>`.
- **Regiones vivas** (`d7f0fd6`): el total y los avisos se anuncian en lectores de pantalla.
- **Pruebas** (`8e836ea`, `dfc6595`): `pruebas.mjs` con `node --test`, que evalúa la parte sin DOM
  de `index.html`. Cubre rejilla, reparto de mesas, aforo, conciliación de la selección y reglas del
  editor.

### Cambiado

- **Zoom con rueda proporcional al desplazamiento** (`d7f0fd6`), suave en trackpad. En el tope del
  zoom la rueda vuelve a desplazar la página; con Ctrl se bloquea siempre.
- **La vista no puede salir del encuadre inicial** al arrastrar o hacer zoom (`d7f0fd6`).
- **La selección es un dato** (`8e836ea`): un `Set` de ids, no clases del DOM. La conciliación al
  cambiar de disposición pasa a `conciliarSeleccion`.
- **Encuadre** (`8e836ea`): incluye escenario, mesas y letras de fila, con margen uniforme.
- **Contraste** (`8e836ea`): todos los estados de butaca contrastan al menos 3:1 con el fondo; el
  texto de la pista y las letras de fila también se aclaran.
- **Rendimiento** (`8e836ea`): búsqueda de butacas con un `Map` por id y un solo
  `Intl.NumberFormat`.

### Corregido

- **Butacas que se soltaban sin aviso** al cambiar de disposición cuando seguían existiendo pero
  ya no estaban libres (`b112f11`).
- **Dos paradas de tabulación** en el plano tras un clic con el ratón (`b112f11`).
- **Foco fuera de la vista** al recorrer con flechas con zoom (`b112f11`).
- **Clic derecho y central** seleccionaban butacas (`d7f0fd6`).
- **Comentarios** que hacían referencia a versiones que no están en el repositorio (`8e836ea`).

## 2026-09-16 — Versión inicial

Commit `e045d90`.

### Añadido

- Plano de butacas en un único `<svg>` con `viewBox`: escala con el ancho, zoom y desplazamiento.
- Filas numeradas, mesas con lugares agrupados y zona general en el mismo plano.
- Rejilla de sala común con cuatro disposiciones de pasillos a ancho constante.
- Cada butaca es un checkbox accesible, con recorrido por flechas y tabindex móvil.
- Resumen de la selección agrupado por mesa o zona, con importe.
