# Selector de asientos

Plano de butacas interactivo en SVG, en **un solo archivo HTML**. Sin dependencias, sin paso de
compilación y sin framework: se abre en el navegador tal cual.

Tres formas de venta conviven en el mismo plano: filas numeradas, mesas con lugares agrupados y
zonas de acceso general.

## Cómo probarlo

Abre `index.html` en el navegador. Si prefieres servirlo:

```bash
python -m http.server 8000
```

## Qué resuelve

La forma habitual de montar estos planos es una rejilla de `<div>` con un `<svg>` por butaca. Se ve
bien en una maqueta y se rompe en cuanto la sala crece. Aquí el plano es **un único `<svg>` con
`viewBox` y las butacas en coordenadas**, de donde salen cuatro cosas:

- **Escala con el ancho disponible.** Una sala de 94 lugares entra completa en una pantalla de
  375 px sin desbordarse ni cortar butacas.
- **Zoom y desplazamiento** moviendo el `viewBox`: rueda, pellizco, arrastre y botones. Un
  arrastre que empieza sobre una butaca mueve el plano y no la selecciona, y el plano no se puede
  sacar de su encuadre. En el tope del zoom, la rueda vuelve a desplazar la página.
- **El trazo se declara una vez** con `<symbol>` y se instancia con `<use>`. Una sala de 94 butacas
  tiene un `<path>`, no 94.
- **Las áreas de clic son contiguas y no se solapan**: cada butaca es sensible en su celda entera,
  ni un píxel de la vecina.

## Accesibilidad

Cada butaca es un `checkbox` con su etiqueta —*«Fila A, butaca 3»*, *«Mesa 2, lugar 1, ocupada»*—.
Se recorre el plano con las flechas, que se mueven por coordenadas, y se elige con Enter o Espacio.
El `tabindex` es móvil: hay un solo alto de tabulación para todo el plano, no uno por butaca.
El total y los avisos están en regiones vivas, así que un lector de pantalla los anuncia al cambiar.

El estado no depende solo del color: la butaca seleccionada lleva una palomita, la ocupada un aspa
y la bloqueada una raya. Todos los estados contrastan al menos 3:1 con el fondo del plano, y la
leyenda reutiliza los mismos `<symbol>` que el dibujo.

## Los datos

El plano se genera a partir de una lista plana con una fila por butaca, que es lo que devolvería tu
servidor:

```js
{ id: 'A1', fila: 'A', numero: 1, x: 1, y: 2, zona: 'luneta', grupo: null, estado: 'libre' }
```

`estado` puede ser `libre`, `ocupada` o `bloqueada`. `grupo` es lo que convierte cuatro butacas
sueltas en una mesa: el resumen dice *«Mesa 1 · 4 lugares (1, 2, 3, 4)»* en vez de listar
identificadores sueltos.

**El SVG se genera al mostrar; nunca se almacena un SVG.** Con datos puedes consultar ocupación,
precio y disponibilidad. Con un blob de SVG no puedes hacer un `WHERE`.

La selección también es un dato: un conjunto de identificadores. El DOM la refleja, pero nunca se
lee de vuelta del DOM.

## La rejilla de la sala

`rejillaDeSala({ ancho, pasillos })` es la única fuente de verdad de las columnas. Devuelve
`columnas`, la lista plana que consumen las filas, y `bloques`, la misma agrupada, que es lo que
impide que una mesa quede partida por un pasillo.

Todas las bandas del plano la consumen, así que la alineación no depende de la coincidencia: no hay
forma de expresar un plano descuadrado.

El ancho de la sala es **constante**. El pasillo ocupa una columna, igual que en un recinto real: se
lleva lugares que si no serían butacas. Lo que cambia entre disposiciones es el aforo, no la huella
del plano, y eso es lo que las hace comparables.

| `pasillos` | Columnas vacías | Butacas por fila | Aforo del ejemplo |
|---|---|---|---|
| `ninguno` | — | 14 | 94 |
| `izquierda` | 5 | 13 | 89 |
| `derecha` | 10 | 13 | 89 |
| `ambos` | 5 y 10 | 12 | 84 |

Al cambiar de disposición la selección se conserva **por identificador, no por posición**: la
identidad es `fila` + `numero` y es estable; solo cambia la columna. Lo que no sobrevive es una
butaca que la nueva disposición ya no tiene, porque el pasillo se llevó su lugar, o una que sigue
existiendo pero ahí no está libre. Esas se sueltan con un aviso que las nombra, en vez de
desaparecer en silencio.

## Modo editor

Dos modos, con los botones de arriba del plano:

- **Previsualizar**: el plano como lo ve quien compra. Se eligen butacas.
- **Editar plano**: se colocan las mesas. Las butacas no se eligen.

La sala se trata como una tabla de celdas. Cada mesa ocupa **6 celdas (2 × 3)**: dos lugares
arriba, la mesa en las dos de en medio y dos lugares abajo. Al arrastrarla, una sombra marca el
destino encajado en la rejilla: verde si cabe, roja y con contorno discontinuo si no. Al soltar en
un sitio que no vale, la mesa se queda donde estaba y un aviso dice por qué (*«cae sobre un
pasillo»*, *«choca con Mesa 3»*, *«choca con la fila G»*).

Una mesa cabe si sus 6 celdas están dentro de la sala, libres y fuera de los pasillos: sigue siendo
imposible partir una mesa con un pasillo. Con teclado, Tab lleva a las mesas y las flechas mueven
la mesa al **siguiente hueco libre** en esa dirección, saltando pasillos y otras mesas. Esc cancela
un arrastre.

La posición es un dato (`{ M1: { x, y }, … }`) y el plano se regenera desde ella. Los lugares se
llaman `M1-1`, `M1-2`… por la mesa, no por la posición, así que mover una mesa conserva la
selección. Cada disposición de pasillos guarda sus propias posiciones, y «Restablecer mesas»
devuelve las de esa disposición a su sitio automático. Las posiciones viven en memoria: en una
aplicación real se guardarían con el plano del recinto, y el servidor volvería a validarlas.

## Pruebas

```bash
node --test pruebas.mjs
```

Cubren la rejilla, el reparto de mesas, el aforo de la tabla anterior, la conciliación de la
selección al cambiar de disposición y las reglas del editor: dónde cabe una mesa y cómo busca
hueco el teclado. No hay copia del código: `pruebas.mjs` lee `index.html` y
evalúa la parte del script anterior a la marca *«Fin de la parte sin DOM»*, así que el proyecto
sigue siendo un solo archivo. Requiere Node 18 o posterior.

## Qué no incluye

Es la **capa visual**. No trae servidor, ni reserva, ni control de concurrencia, ni pasarela de
pago. La ocupación del ejemplo está escrita en el archivo.

Si lo conectas a un sistema real, el servidor es la autoridad: el plano consulta la ocupación al
cargar y la vuelve a consultar antes de enviar la selección, y el servidor rechaza las butacas que
se hayan ocupado entre tanto. La comprobación contra sobreventa va en una transacción de base de
datos, nunca en el navegador.

## Sobre three.js

Se evaluó y se descartó. three.js dibuja en un `<canvas>`, que es **un solo nodo del DOM**: se
pierden el clic por butaca, el recorrido con teclado, las etiquetas ARIA y los estados con CSS, y
hay que reconstruirlos a mano. SVG los da gratis y aguanta salas de mil a dos mil butacas. Además
son unos 600 KB de dependencia en algo que aquí pesa un archivo.

## Licencia

MIT. Ver [LICENSE](LICENSE).

El icono de la butaca es `event_seat` de [Material Icons](https://github.com/google/material-design-icons)
de Google, bajo Apache License 2.0. Ver [NOTICE](NOTICE). Todo el código restante es original.
