# Selector de asientos

Plano de butacas interactivo en SVG, en **un solo archivo HTML**. Sin dependencias, sin paso de
compilación y sin framework: se abre en el navegador tal cual.

Tres formas de venta pueden convivir en el mismo plano: filas numeradas, mesas con lugares
agrupados y zonas de acceso general. Hay salas mixtas, solo de filas y solo de mesas.

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

Cada butaca es un `checkbox` con su etiqueta —*«Luneta, fila A, butaca 3»*, *«Mesa 2, lugar 1,
ocupada»*—.
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
{ id: 'luneta-A1', fila: 'A', numero: 1, banda: 'luneta', bandaNombre: 'Luneta',
  x: 1, y: 2, zona: 'luneta', grupo: null, estado: 'libre' }
```

`estado` puede ser `libre`, `ocupada` o `bloqueada`. `grupo` es lo que convierte cuatro butacas
sueltas en una mesa: el resumen dice *«Mesa 1 · 4 lugares (1, 2, 3, 4)»* en vez de listar
identificadores sueltos.

El id de una butaca de fila lleva su banda delante (`luneta-A1`) y usa la fila y el número **dentro
de su banda**, así que no cambia al editar. La etiqueta visible (fila y número) se calcula aparte,
con la numeración por zona que se explica en *Bloques de filas*.

**El SVG se genera al mostrar; nunca se almacena un SVG.** Con datos puedes consultar ocupación,
precio y disponibilidad. Con un blob de SVG no puedes hacer un `WHERE`.

La selección también es un dato: un conjunto de identificadores. El DOM la refleja, pero nunca se
lee de vuelta del DOM.

## La rejilla de la sala

La sala se describe con **bloques de butacas y anchos de pasillo**: `{ bloques: [4, 6, 4],
pasillos: [1, 2] }` son tres bloques de 4, 6 y 4 butacas, con un pasillo de 1 columna entre el
primero y el segundo y otro de 2 entre el segundo y el tercero. El ancho de la sala sale de sumarlo
todo (17 columnas).

`rejillaDeBloques(distribucion)` es la única fuente de verdad de las columnas. Devuelve `columnas`,
la lista plana que consumen las filas, y `bloques`, la misma agrupada, que es lo que impide que una
mesa quede partida por un pasillo.

Todas las bandas del plano la consumen, así que la alineación no depende de la coincidencia: no hay
forma de expresar un plano descuadrado.

Las plantillas mixtas parten de un ancho **constante** de 14 columnas con pasillos de una columna,
igual que en un recinto real: el pasillo se lleva lugares que si no serían butacas. Lo que cambia
entre ellas es el aforo, no la huella del plano, y eso es lo que las hace comparables:

| Sala mixta, `pasillos` | Columnas vacías | Butacas por fila | Aforo del ejemplo |
|---|---|---|---|
| `ninguno` | — | 14 | 94 |
| `izquierda` | 5 | 13 | 89 |
| `derecha` | 10 | 13 | 89 |
| `ambos` | 5 y 10 | 12 | 84 |

### Elegir las columnas

En el editor, **Diseño de la sala → Columnas** tiene dos campos:

- **Butacas por bloque:** `4, 6, 4`. Cada número es un bloque; entre bloques va un pasillo.
- **Anchos de pasillo:** `1, 2`. Uno por cada pasillo. Si se deja vacío, todos miden 1 columna.

Se aplica con **Aplicar** o Enter. Hay de 1 a 10 bloques, de 1 a 40 butacas por bloque, pasillos de
1 a 10 columnas y un máximo de 60 columnas en total; si algo no vale, se explica (*«con 3 bloques
hacen falta 2 anchos de pasillo»*).

Las columnas son **las mismas para toda la sala**: todas las bandas de filas las comparten, así que
siguen alineadas. Al cambiarlas, las butacas se renumeran por fila (el número es su orden, no su
columna) y las mesas se recolocan:

- **Mismo número de bloques:** cada mesa se queda en su bloque, a la misma distancia de su inicio.
- **Otro número de bloques:** cada mesa conserva su posición relativa en el ancho de la sala y se
  ajusta al bloque más cercano, para que no se amontonen ni se queden todas en un bloque.

Si aun así alguna mesa no cabe, el cambio no se aplica y se dice cuál (*«Mesa 1 cae sobre un
pasillo»*).

Al cambiar de sala la selección se conserva **por identificador, no por posición**: la identidad
es banda + `fila` + `numero` y es estable; entre salas mixtas solo cambia la columna. Lo que no
sobrevive es una butaca que la nueva sala ya no tiene, porque el pasillo se llevó su lugar, o una
que sigue existiendo pero ahí no está libre. Esas se sueltan con un aviso que las nombra, en vez de
desaparecer en silencio.

## Tipos de sala y bandas

Una sala es una **lista de bandas** horizontales, de arriba abajo, sobre la misma rejilla de
columnas. Cada banda empieza donde acaba la anterior:

| Banda | Alto | Contenido |
|---|---|---|
| `escenario` | 2 filas de rejilla | La franja inicial, donde está el escenario por defecto. Siempre la primera. |
| `filas` | `filas` | Filas de butacas de una zona (Luneta o General). Las letras siguen la numeración por zona (ver *Bloques de filas*). |
| `mesas` | `alto` | Espacio libre, con `filasDeMesas` filas de mesas automáticas. |

El selector **Tipo de sala** elige una plantilla. Cada tipo define sus pasillos y sus bandas:

| Tipo | Pasillos | Bandas |
|---|---|---|
| Mixta (4 variantes) | dos, izquierda, derecha o ninguno | Escenario, Luneta (3 filas), Zona de mesas (6 mesas), General (2 filas) |
| Solo filas | dos | Escenario, Platea (7 filas), General (5 filas) |
| Solo mesas | ninguno | Escenario, Salón (12 mesas) |

Las mesas pueden colocarse **en cualquier hueco libre de la sala**, no solo dentro de una zona de
mesas: la banda solo decide dónde van las automáticas y deja espacio.

En el modo editor, el panel **Bandas de la sala** lista las bandas con sus controles:

- **− / +:** quita o agrega una fila (bandas de filas) o una fila de alto (zonas de mesas).
- **Zona:** Luneta o General, con su precio. El nombre por defecto sigue a la zona.
- **↑ / ↓:** sube o baja la banda. Sus piezas viajan con ella.
- **Eliminar:** quita la banda y las piezas que empiezan dentro de ella; lo de debajo sube.
- **Agregar banda de filas / zona de mesas / franja con bandas verticales:** al final de la sala.

Al cambiar el alto de una banda, lo que queda debajo se desplaza con ella. Antes de aplicar
cualquier cambio se comprueba que todas las mesas sigan cabiendo; si alguna no, no se aplica y se
explica (*«No se pudo: Mesa 4 choca con la fila A de General»*). Las butacas elegidas u ocupadas
que desaparecen se avisan igual que al acortar una mesa.

Las bandas sin nombre propio toman el de su zona, numerado si se repite: *General*, *General 2*.

### Bandas verticales

Una **franja dividida** reparte su ancho en **bandas verticales**, de izquierda a derecha, y cada
vertical apila bandas horizontales de filas o zonas de mesas:

```
        [        ESCENARIO        ]
 ┌── Vertical 1 ──┬──── Vertical 2 (el resto) ────┐
 │ zona de mesas  │ C ▣ ▣   ▣ ▣ ▣ ▣               │
 │  [M4]          │ D ▣ ▣   ▣ ▣ ▣ ▣               │
 │                │ (espacio libre)                │
 └────────────────┴────────────────────────────────┘
```

- **Datos:** `{ id, tipo: 'division', verticales: [{ id, ancho, bandas: [...] }, …, { id, bandas }] }`.
  Cada vertical tiene su ancho en columnas, salvo la última, que ocupa el resto. Dentro solo van
  bandas de filas o de mesas (no otra franja).
- **Alto:** el de la vertical más alta; las demás dejan espacio libre abajo.
- **Columnas:** las filas de una vertical usan las columnas de la sala que caen en su tramo, así que
  los pasillos siguen alineados con el resto. Se numeran por zona como cualquier fila.
- **Rótulos de fila:** a la izquierda si la banda empieza en el borde izquierdo de la sala, a la
  derecha si acaba en el derecho; en una vertical del medio no se dibujan.

En el panel, cada franja muestra sus verticales anidadas, y cada vertical, sus bandas:

- **Franja:** «+ vertical» (hasta 6; la última se parte por la mitad), ↑ / ↓ y Eliminar.
- **Vertical:** − / + ancho (salvo la última), ← / → para moverla, «+ filas» y «+ mesas» para
  agregar bandas dentro, y Eliminar (una franja necesita al menos una vertical).
- **Bandas dentro de una vertical:** los mismos controles que las de la sala.

**Las piezas se anclan a su región.** Cada mesa, bloque o el escenario se asocia a la región más
concreta que contiene su esquina: una banda, el espacio libre bajo una vertical o la vertical. Al
cambiar cualquier banda (alto, ancho, orden o eliminarla), la pieza conserva su distancia a esa
región, así que viaja con ella en vertical y en horizontal. Si la región se elimina, la pieza se
quita (el escenario nunca). Como siempre, si algo deja de caber, el cambio no se aplica.

## Modo editor

Dos modos, con los botones de arriba del plano:

- **Previsualizar**: el plano como lo ve quien compra. Se eligen butacas.
- **Editar plano**: se colocan, transforman, agregan y eliminan mesas. Las butacas no se eligen.

### Las mesas

La sala se trata como una tabla de celdas: cada lugar ocupa una celda y el tablero ocupa una o
más. Una mesa se describe con cuatro datos además de su posición:

| Dato | Valores | Efecto |
|---|---|---|
| `largo` | 1 a 8 | Celdas de tablero. Cada una lleva un lugar a cada lado largo. |
| `cabeceras` | sí / no | Un lugar más en cada extremo. |
| `unLado` | sí / no | Lugares en un solo lado largo, como una barra. |
| `giro` | 0°, 90°, 180°, 270° | Cuartos de vuelta en sentido horario. |

Los tres estilos de mesa nueva son el mismo modelo con otros valores:

| Estilo | Largo | Cabeceras | Un lado | Huella | Lugares |
|---|---|---|---|---|---|
| **Lados** | 2 | no | no | 2 × 3 | 4 |
| **Cruz** | 1 | sí | no | 3 × 3 | 4 |
| **Un lado** | 4 | no | sí | 4 × 2 | 4 |

La huella es el rectángulo completo, así que las esquinas vacías de una cruz quedan **reservadas**:
ninguna otra mesa puede ocuparlas.

**Cada silla mira hacia la mesa.** El icono sin girar tiene el respaldo arriba; cada lugar lleva su
giro (`mira`): 0° el lado norte, 180° el sur, 90° y 270° las cabeceras, más el giro de la mesa. Las
marcas de estado (palomita, aspa, raya) se quedan derechas en sillas a 0° o 180°, y giran con la silla
a 90° o 270°, porque ahí el hueco del icono es vertical y una marca horizontal no cabe.

**Las butacas de fila miran al escenario.** Con el escenario arriba giran 180° (respaldo abajo,
mirando hacia arriba); si se mueve por debajo de una banda, sus filas miran hacia abajo.

El giro es de cuartos de vuelta, y no solo horizontal o vertical, porque una mesa de un lado tiene
cuatro posiciones distintas: sus lugares pueden quedar abajo, a la izquierda, arriba o a la derecha.
En una mesa de dos lados, 0° y 180° ocupan las mismas celdas; lo que cambia es qué lado es cuál.

### Qué se puede hacer

Al elegir una mesa (clic o Tab), se activan los botones de la barra del editor. Cada acción tiene
atajo de teclado sobre la mesa enfocada:

| Acción | Botón | Tecla |
|---|---|---|
| Mover al siguiente hueco libre | — | Flechas |
| Girar 90° sobre su centro | Girar 90° | R |
| Alargar o acortar una celda | Alargar / Acortar | + / − |
| Poner o quitar cabeceras | Cabeceras | C |
| Lugares en uno o dos lados | Un solo lado | U |
| Eliminar | Eliminar | Supr |
| Agregar una mesa nueva | Lados / Cruz / Un lado | — |
| Agregar un bloque de filas | Bloque de filas | — |
| Butacas por fila de un bloque | Alargar / Acortar | + / − |
| Filas de un bloque | + fila / − fila | ] / [ |
| Zona y nombre de un bloque | Zona / Nombre | — |
| Volver a la sala de su tipo | Restablecer sala | — |
| Bloquear o desbloquear butacas | Bloquear butacas, y clic en la butaca | Enter o Espacio |

Con el ratón, una mesa se arrastra y una sombra marca el destino encajado en la rejilla: verde si
cabe, roja y con contorno discontinuo si no. Esc cancela un arrastre.

**Reglas:**

- **Cabe o no cabe:** una mesa cabe si toda su huella está dentro de la sala, libre y fuera de los
  pasillos; sigue siendo imposible partir una mesa con un pasillo. Si una acción no cabe, la mesa no
  cambia y un aviso dice por qué (*«cae sobre un pasillo»*, *«choca con Mesa 3»*, *«choca con la
  fila A de General»*).
- **Sitio cercano:** al girar, alargar, poner cabeceras o volver a dos lados, si la mesa no cabe
  en su sitio se prueba a una celda de distancia, y el aviso dice a dónde se desplazó.
- **El tablero no se mueve** al alargar, acortar, cambiar cabeceras o pasar a uno o dos lados: lo
  que cambia son los lugares alrededor. Al pasar a un solo lado se quedan los del sur.
- **Girar es reversible:** cuatro giros dejan la mesa exactamente donde estaba.
- **Mesas nuevas:** se colocan en el primer hueco libre, recorriendo la sala por filas. Entre las
  mesas automáticas y la banda General hay una franja libre para ellas. Si no queda sitio, se avisa.

### Identidad de los lugares

Los lugares se identifican **por lado**, no por orden: `M2-N1`, `M2-N2` (un lado), `M2-S1`,
`M2-S2` (el otro) y `M2-C1`, `M2-C2` (cabeceras). Así:

- **Girar o mover** no cambia ningún id, y la selección y las reservas se conservan.
- **Alargar** solo añade lugares (`N3`, `S3`); los existentes no cambian ni se mueven.
- **Acortar, quitar cabeceras, pasar a un solo lado o eliminar** hace desaparecer lugares. Se permite, pero se avisa: los
  elegidos se sueltan nombrándolos y, si alguno estaba ocupado, un aviso lo señala.

Para mostrar, los lugares se numeran «lugar 1, 2, 3…» en sentido horario.

### Datos

Cada tipo de sala guarda su propio plano: `{ bandas: […], mesas: [{ id, x, y, largo, cabeceras,
unLado, giro }, …], siguiente, siguienteBanda }`. `siguiente` y `siguienteBanda` solo crecen, para
que una mesa o banda nueva nunca reutilice el id de una eliminada. «Restablecer sala» devuelve el
tipo a sus bandas y mesas originales.
Mientras no se guardan, los planos viven en memoria y se pierden al recargar. Para conservarlos,
ver *Mapas guardados*.

### Bloques de filas

Además de las bandas, que ocupan todo el ancho, se pueden colocar **bloques de filas libres**: un
rectángulo de butacas que se agrega, arrastra, gira y redimensiona como una mesa.

```
                 [       ESCENARIO        ]
 A   ▣ ▣ ▣ ▣ ▣        ▣ ▣       ← bloque de 5 × 2 y, dejando dos columnas, otro de 2 × 2
 B   ▣ ▣ ▣ ▣ ▣        ▣ ▣
```

- **Datos:** `{ id: 'F1', tipo: 'filas', x, y, ancho, filas, zona, giro, nombre? }`. `ancho` son las
  butacas por fila (1 a 40) y `filas`, las filas (1 a 26).
- **Pasillos:** los pone quien diseña, dejando espacio entre bloques. Un bloque puede ocupar columnas
  que en las bandas son pasillo; una mesa, no.
- **Choques:** un bloque no puede pisar filas, mesas ni otros bloques. Si no cabe, se explica igual
  que con las mesas.
- **Crecer y encoger:** la primera butaca (fila de delante, butaca 1) no se mueve; las butacas se
  añaden al final de cada fila y las filas, por detrás.
- **Girar:** en cuartos de vuelta. A 90° el bloque mira a la derecha (un lateral izquierdo); a 270°,
  a la izquierda (un lateral derecho).

**Numeración, como en un teatro.** Cada butaca tiene un **id estable**, que no cambia al mover ni
girar su bloque (`F1-2-3` es la fila 2, butaca 3 del bloque F1). Es el que usan la selección, las
reservas y las bloqueadas. La **etiqueta visible** se calcula:

- **Bandas y bloques que miran al escenario de frente** se numeran **por zona**. En cada zona, la fila más
  cercana al escenario es la A, y todas las butacas de esa zona a esa altura se numeran de izquierda
  a derecha a través de bandas y bloques: A1–A5 en un bloque y A6–A7 en el de al lado. Dos bandas
  de la misma zona no reinician en A: la segunda continúa.
- **Bloques que no miran al escenario de frente** (girados de lado o de espaldas) llevan su nombre
  (o «Bloque N») y su propia secuencia: «Lateral izquierdo, fila B, butaca 2».

Como la etiqueta depende de la posición, mover un bloque puede cambiar las etiquetas de su zona (A6
pasa a B3), pero nunca los ids.

### El escenario

El escenario es una pieza más: `{ x, y, ancho, alto }` en celdas. Por defecto ocupa la franja inicial
a todo el ancho de la sala (2 filas de alto), pero en el editor se agarra y se edita como una mesa:

| Acción | Botón | Tecla |
|---|---|---|
| Mover | — (arrastrar) | Flechas |
| Girar 90° (intercambia ancho y alto) | Girar 90° | R |
| Ancho | Alargar / Acortar | + / − |
| Alto | + fila / − fila | ] / [ |

- **No se elimina** y no puede pisar filas, mesas ni bloques (ni ellos a él). Puede cruzar pasillos.
- **Las filas y la numeración se miden desde donde esté:** las bandas miran hacia él y, en cada zona,
  la fila más cercana es la A. Si se baja el escenario, la fila de abajo pasa a ser la A y los
  rótulos cambian con ella.
- **Los bloques nuevos se crean mirando hacia el escenario** (girados 180° si está debajo, 90° o
  270° si está a un lado).
- **Al cambiar las columnas,** un escenario a todo el ancho sigue a todo el ancho.
- Si el escenario sale de la franja inicial, esas filas quedan libres para otras piezas.

### Butacas bloqueadas

Con **Bloquear butacas** activado, cada clic (o Enter) sobre una butaca la bloquea o desbloquea: por
ejemplo, butacas sin visibilidad. Vale para butacas de fila y lugares de mesa; las ocupadas no se
pueden bloquear. Si una butaca elegida queda bloqueada, se suelta con aviso. Las bloqueadas son
parte del diseño del recinto y se guardan con el mapa.

### Mapas guardados

El diseño se guarda **sin base de datos**, como JSON, de dos formas:

- **En el navegador:** escribe un nombre y pulsa **Guardar**. El mapa aparece en el selector **Tipo
  de sala**, en el grupo **Mis mapas**, y sigue ahí al recargar. Si el nombre ya existe, se
  pregunta antes de sobrescribir. **Eliminar mapa** lo borra.
- **Como archivo:** **Exportar JSON** descarga el mapa (`salon-jardin-boda.json`) y **Importar JSON**
  lo vuelve a cargar y lo guarda en el navegador. Sirve para copias de seguridad, para pasar un mapa
  a otro equipo o para versionarlo en git.

Un mapa guarda el **diseño**, no la venta: nombre, columnas (bloques y pasillos), bandas, mesas con su forma y posición,
butacas bloqueadas y los contadores de ids. No guarda la ocupación ni la selección.

```json
{
  "formato": "selector-asientos/mapa",
  "version": 2,
  "nombre": "Salón Jardín, boda",
  "guardado": "2026-09-16T18:30:00.000Z",
  "distribucion": { "bloques": [4, 6, 4], "pasillos": [1, 2] },
  "bandas": [
    { "id": "escenario", "tipo": "escenario" },
    { "id": "luneta", "tipo": "filas", "zona": "luneta", "filas": 3 },
    { "id": "mesas", "tipo": "mesas", "alto": 13 }
  ],
  "mesas": [
    { "id": "M1", "x": 2, "y": 7, "largo": 2, "cabeceras": false, "unLado": false, "giro": 0 }
  ],
  "bloqueadas": ["luneta-A1", "M1-N1"],
  "siguiente": 2,
  "siguienteBanda": 1
}
```

Los mapas de la versión 1 (que guardaban `"pasillos": "ambos"`) se siguen leyendo: se convierten a
bloques y pasillos al cargarlos.

**Al importar, el archivo no se da por bueno.** Se comprueban el formato y la versión, las columnas, cada banda y
cada mesa (ids, rangos, giro), se descartan los campos desconocidos y se genera el plano para
verificar que todas las mesas quepan. Si algo falla, no se carga y se dice qué (*«Mesa 1 choca con
Mesa 2»*). Los mapas guardados en el navegador que dejen de validar no se cargan y se avisa de
cuáles.

`localStorage` es de cada navegador y de cada equipo, y se pierde si se borran los datos de
navegación: para conservar un mapa, expórtalo. Algunos navegadores no permiten guardar en páginas
abiertas de ciertas formas (por ejemplo, vistas previas); en ese caso la página lo avisa y se puede
seguir usando **Exportar JSON**.

### Posibles mejoras

- **Guardar los mapas** en un servidor, en lugar de en el navegador.
- **Desplazar el plano** solo al arrastrar una mesa hasta el borde con zoom.

## Pruebas

```bash
node --test pruebas.mjs
```

Cubren la rejilla, el reparto de mesas, el aforo de la tabla anterior, la conciliación de la
selección al cambiar de sala, los tipos de sala y las bandas, y las reglas del editor: geometría de las mesas, hacia dónde
mira cada silla, dónde caben, girar, alargar, cabeceras, un solo lado y sitio para mesas nuevas. No hay copia del código: `pruebas.mjs` lee `index.html` y
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
