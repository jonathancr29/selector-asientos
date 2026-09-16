# Changelog

Cambios notables del proyecto, del más reciente al más antiguo. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). El proyecto aún no usa números de
versión: cada entrada se identifica por fecha y pull request.

## Sin publicar — Mesas configurables y tipos de sala

Rama `claude/mesas-configurables`.

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
