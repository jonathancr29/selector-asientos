# Changelog

Cambios notables del proyecto, del más reciente al más antiguo. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). El proyecto aún no usa números de
versión: cada entrada se identifica por fecha y pull request.

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
