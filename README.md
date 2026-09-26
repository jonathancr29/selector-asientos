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
  sacar de su encuadre. En el tope del zoom, la rueda vuelve a desplazar la página. Se puede acercar
  hasta ver **el ancho de una sala clásica** (14 columnas, unos 40 px por butaca) **en cualquier
  recinto**: el tope no sale del encuadre inicial, que en un recinto grande es enorme.
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

**Barras con iconos.** Los botones del editor, del zoom y de agregar piezas son iconos de 32 × 32 px.
Cada uno tiene su nombre completo en `aria-label` (el que anuncia un lector de pantalla) y un
**tooltip visible** con el nombre y el atajo (*«Girar 90° · R»*) al pasar el ratón (también sobre un
botón desactivado) o al llegar con Tab; Esc lo oculta.
No se usa `title`, que algunos lectores anuncian en lugar del nombre. Previsualizar y Editar plano
llevan icono y texto. Tipo de sala, Zona y Nombre tienen un icono como etiqueta visible y su texto
para lectores de pantalla. Los iconos de mesas, bloques y formas se dibujan como en el plano.

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

Se aplica con **Aplicar** o Enter. Hay de 1 a 20 bloques, de 1 a 60 butacas por bloque, pasillos de
1 a 10 columnas y un máximo de **300 columnas** en total; si algo no vale, se explica (*«con 3 bloques
hacen falta 2 anchos de pasillo»*).

Eso da para un recinto ancho de verdad: `60, 60, 60, 60` con pasillos `3, 3, 3` son **249 columnas
y 240 butacas por fila**, la forma de una arena. Con el tope anterior de 60 columnas, un aforo grande
solo cabía a lo largo: 20.000 lugares salían en una tira de 59 × 348, seis veces más alta que ancha.
El aforo sigue topado en 20.000 lugares, que es lo que manda.

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
Los botones del panel también son iconos, con el mismo tooltip y `aria-label` que los de la barra:
subir, bajar, duplicar, eliminar, quitar y agregar fila, ancho de una vertical, moverla, guías de
fila, y agregar banda de filas, zona de mesas, espacio o franja. En *Mapa* son guardar, exportar,
importar y eliminar; en *Columnas*, aplicar (✓); en *Otras zonas*, eliminar y agregar zona.

- **Nombre:** cuando la banda tiene su zona para ella sola, **el nombre es el de la zona**: cambiarlo
  cambia también las etiquetas de sus butacas. Si comparte zona con otra banda, el campo es su nombre
  propio y, vacío, toma el de por defecto.
- **Precio:** el precio por lugar de su zona, en pesos, editable en la propia fila. Es el que paga
  todo lo que cae dentro de la banda: sus filas, y las mesas, bloques y butacas sueltas que hereden
  (ver *La zona se hereda de la banda*).
- **Zona:** con qué zona va la banda. Elegir la de otra banda hace que **compartan precio y
  numeración**; *Zona nueva…* le da una propia, con su nombre y a $0. Los espacios y las franjas
  pueden ir *Sin zona*: entonces no dan precio a nada y lo de dentro hereda de más afuera.
- **Venta por mesa / por butacas** (solo en las zonas de mesas que tienen mesas): cambia de golpe
  cómo se venden todas sus mesas. Si unas van por mesa y otras por butacas, aparece *Venta mixta*.
- **↑ / ↓:** sube o baja la banda. Sus piezas viajan con ella.
- **Duplicar:** crea una copia justo debajo, con todo lo que tiene dentro (ver más abajo).
- **Eliminar:** quita la banda y las piezas que empiezan dentro de ella; lo de debajo sube.
- **Agregar banda de filas / zona de mesas / franja con bandas verticales:** al final de la sala.

**Con el ratón, desde el plano.** En el editor, cada espacio y cada zona de mesas lleva un tirador en
su **esquina inferior derecha**, y el borde entre dos bandas verticales, una franja de agarre a lo
alto:

- El tirador de la esquina cambia el **alto** de su banda y, si está dentro de una vertical que no es
  la última, también el **ancho** de esa vertical: las dos medidas en el mismo gesto.
- El agarre del borde cambia el ancho de la vertical de su izquierda; la última siempre ocupa el resto.
- Va de celda en celda y **no aplica nada hasta soltar**: mientras arrastras se ve el tamaño que
  tendría, con su medida. **Esc** cancela.
- Los topes son los de siempre: de 1 a 40 filas de alto y al menos una columna para la última
  vertical, así que el fantasma nunca enseña un tamaño imposible.
- Un clic sin arrastrar en un tirador selecciona su banda.
- **El ancho de una banda nunca es suyo**, es el de lo que la contiene: por eso un espacio al nivel de
  la sala solo cambia de alto, y «ensanchar un espacio» dentro de una franja es ensanchar su vertical.
- Los botones − / + del panel siguen ahí: son el camino con teclado, y el tirador la comodidad del
  ratón.

Al cambiar el alto de una banda, lo que queda debajo se desplaza con ella. Antes de aplicar
cualquier cambio se comprueba que todas las mesas sigan cabiendo; si alguna no, no se aplica y se
explica (*«No se pudo: Mesa 4 choca con la fila A de General»*). Las butacas elegidas u ocupadas
que desaparecen se avisan igual que al acortar una mesa.

Las bandas sin nombre propio toman el de su zona, numerado si se repite: *General*, *General 2*.

### Zonas y precios: la zona es la banda

**Una zona y una banda son la misma cosa.** Cada fila del grupo *Zonas y precios* es una banda con su
**color**, su **nombre** y su **precio por lugar**, y ese precio se lo da a todo lo que cae dentro.
Al empezar, la sala mixta trae *Luneta* ($350), *Mesas* ($500) y *General* ($200).

- **Cada banda nueva nace con su zona:** color propio, nombre a partir del tipo (*General 2*,
  *Mesas 2*) y precio 0. Los **espacios** son la excepción: nacen sin zona, porque un hueco no da
  precio a nada.
- **Nombre y precio** se escriben en la fila y se guardan con **✓** (también con Enter o al salir del
  campo; Esc deshace lo escrito). El precio es por lugar, en pesos, de 0 a 1,000,000, y se puede
  escribir como 350, 350.50 o $1,200.00. Los nombres no se repiten. Hasta **40 zonas**.
- **El botón de la etiqueta (🏷+) crea una zona nueva con su espacio:** le pones nombre y precio y
  metes dentro mesas, bloques o butacas.
- **Compartir:** el selector de cada fila apunta a otra zona, y entonces las dos bandas comparten
  nombre, precio, color y numeración (la *Luneta izquierda* y la *derecha* de una franja son la misma
  zona). *Zona nueva…* vuelve a darle una propia. Mientras comparten, el campo de nombre de cada fila
  es su nombre propio, porque renombrar la zona cambiaría también el de la otra.
- **Al eliminar una banda se va su zona**, salvo que la use otra banda, una pieza o alguna butaca
  pintada. Las zonas que se quedan sin banda aparecen al final de la lista, con su nombre, su precio
  y su botón de eliminar.
- La zona de mesas no se elimina, y siempre queda al menos una zona para filas.

Todo lo que muestra la zona usa sus valores actuales: la etiqueta de las butacas (*«VIP, fila A,
butaca 1»*), el nombre por defecto de las bandas, los selectores y el resumen con su total. Las filas
nuevas nacen en *General* o, si no existe, en la primera zona de filas. **Restablecer sala** vuelve a
las tres de siempre.

### La zona se hereda de la banda

**Cada banda le da su zona, y con ella su precio, a todo lo que cae dentro:** mesas, bloques de filas
y butacas sueltas. Una mesa dentro de la *Zona de mesas* cuesta lo que ella; esa misma banda puesta en
Luneta hace que sus mesas cuesten lo que la Luneta. Las bandas de filas ya llevaban su zona; ahora
también pueden llevarla las zonas de mesas, los espacios y las bandas verticales.

De lo más concreto a lo más general, manda:

1. la zona **pintada en esa butaca** (*Asignar zona*, más abajo);
2. la zona **propia de esa mesa, bloque o butaca suelta**, si se la diste en *Editar*;
3. la zona de la **banda** que la contiene y, si hay bandas dentro de bandas, la más interna;
4. si no cae dentro de ninguna banda con zona, el editor le escribe una y lo dice en el aviso: una
   pieza nunca se guarda sin precio.

En *Editar*, el selector de zona empieza en **«Hereda: ⟨zona de la banda⟩»**; elegir una
zona concreta la fija y volver a *Hereda* la suelta. Las piezas nuevas nacen heredando.

**Asignar zona a cada asiento.** El botón **Asignar zona** del grupo *Sala* (como *Bloquear butacas*)
abre un selector con todas las zonas. Eliges una y haces clic en las butacas, o Enter sobre ellas, para
asignársela; otro clic la devuelve a su zona de siempre.

- Sirve para **cualquier asiento**: filas, bloques, butacas sueltas y lugares de mesa (también se
  puede asignar la zona Mesas a una butaca de fila).
- Las butacas que ya son de la zona elegida se ven marcadas con la palomita.
- **La numeración no cambia:** la butaca A3 de Luneta pintada de VIP se vende como *«VIP, fila A,
  butaca 3»*, a precio de VIP, y su vecina sigue siendo *«Luneta, fila A, butaca 4»*. Un lugar de mesa
  dice su zona: *«Mesa 1, lugar 1, VIP»*.
- **Mesas completas:** su precio suma cada lugar a su zona, así que un lugar VIP la encarece.
- Las butacas ocupadas no cambian de zona. Una zona asignada a algún asiento cuenta como en uso y no se
  puede eliminar.
- Se guarda en el mapa como `zonasDeAsiento` (asiento → zona) y se copia al duplicar piezas o bandas.

**Por área, no de una en una.** Butaca por butaca vale para dos retoques, no para «las tres primeras
filas del bloque central». Con *Asignar zona* o *Bloquear butacas* activadas:

- **Arrastra sobre el plano:** sale un rectángulo con el número de butacas que abarca y, al soltar, se
  aplica a todas las libres que quedan dentro. Con **Alt** hace lo contrario: las devuelve a su zona de
  siempre, o las desbloquea.
- **Con el teclado:** **Mayús + flechas** extienden el área desde la butaca enfocada, **Enter** la
  aplica, **Alt+Enter** la deshace y **Esc** la cancela.
- **El plano se mueve** con la barra espaciadora, el botón central del ratón o dos dedos: mientras
  estas herramientas están activas, el arrastre es del rectángulo. Con ellas, la barra espaciadora ya
  no marca la butaca enfocada; para eso está Enter.
- Las **butacas ocupadas** del área no cambian y se dicen en el aviso. Si una mesa que se vende
  completa queda con lugares de dos zonas, también se avisa: su precio deja de ser el de una sola zona.
- Solo se guarda lo que se aparta de su zona de siempre, así que pintar un área y devolverla deja el
  mapa como estaba.

### Nombres, capas y selección de bandas

**Subtítulos.** El nombre de cada banda se dibuja en el plano, también en **Previsualizar**:

- **Bandas de la sala** (filas, zonas de mesas y franjas): en el margen izquierdo, a la altura de su
  primera fila.
- **Verticales y bandas dentro de ellas:** en una etiqueta sobre su borde superior. La primera banda
  de una vertical empieza en el mismo borde y comparte etiqueta con ella (*Vertical 1 · General 2*).

El nombre es solo un subtítulo: **la etiqueta de las butacas sigue siendo la de su zona**. Una banda
llamada *Palco VIP* en la zona Luneta vende *«Luneta, fila D, butaca 1»*, con la numeración de
siempre.

**Renombrar.** En el panel, el nombre de cada banda, vertical o franja es un campo: se escribe y se
aplica con Enter o al salir (Esc deshace lo escrito). Vacío, vuelve al de por defecto. Hasta 40
caracteres. En el plano, **doble clic en un subtítulo** lleva a ese campo.

**Capas.** Cada banda, vertical y franja es una capa con su color, por su orden en la sala: ámbar,
violeta, turquesa, rosa, naranja, cian, lima y fucsia (después de ocho se repiten). El panel muestra
la muestra de color de cada una.

**Seleccionar una banda:**

- **En el plano:** clic en el fondo (no en una pieza) selecciona la banda más concreta de debajo; otro
  clic en el mismo sitio, la que la contiene (banda → vertical → franja), y después ninguna. Clic
  fuera de las bandas quita la selección.
- **En el panel:** tocar cualquier control de una banda la selecciona.

La seleccionada se ve con un **contorno continuo y grueso del color de su capa**, y su fila del panel
con el campo del nombre en negrita y con borde de ese color (y `aria-current`), así que no depende
solo del color. **Su nombre pasa
al borde inferior**, en una etiqueta rellena del color de la capa y **por encima de todo** (butacas,
mesas y piezas), para que no se pierda; mientras, su subtítulo de siempre se oculta (salvo la
etiqueta que comparte con su vertical). Seleccionar una banda deselecciona la pieza activa, y al revés.

### Duplicar

- **Mesas y bloques de filas:** botón **Duplicar** o **Ctrl+D** (Cmd+D en Mac). La copia lleva id
  nuevo y la misma forma, giro y zona; se coloca a la derecha del original, si no cabe debajo, y si
  no en el sitio libre más cercano. Queda activa. El escenario no se duplica.
- **Bandas, verticales y franjas:** botón **Duplicar** del panel, o **Ctrl+D** con la banda
  seleccionada. Una banda o franja se copia justo debajo (lo de debajo baja con sus piezas); una
  vertical, a su derecha. Se copia **todo lo que tiene dentro**: bandas, verticales, mesas y bloques
  (los que empiezan dentro), a la misma distancia de la copia. La copia queda seleccionada.
- **Ancho de una vertical copiada:** el mismo que la original si la última vertical puede cedérselo;
  si no (o si la original es la última), la original se parte por la mitad entre las dos.
- **Qué se copia:** ids nuevos para todo, nombres propios con *(copia)* en lo duplicado y **las
  butacas bloqueadas** (una butaca sin visibilidad sigue sin ella en la copia). **La ocupación nunca.**
- **Numeración:** las filas de la copia siguen la de su zona: si la original era A–B, la copia es C–D.
- Como con cualquier cambio de bandas, si algo deja de caber, no se aplica y se explica por qué.

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

**Una franja nueva** (botón «Agregar franja con bandas verticales») trae dos verticales de medio
ancho, cada una con un **espacio vacío** de 4 filas y sin butacas: sus subtítulos dicen *Vertical 1 ·
Espacio 2* y *Vertical 2 · Espacio 3*. Se llenan después con piezas, o agregando filas o mesas dentro.

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

## Disposición de la página

```
┌──────────────────┬─────────────────────────┬──────────────┐
│ Sala (sticky)    │ Selector de asientos  ⓘ │ Piezas       │
│                  │ Sala de 14 columnas · … │ (sticky,     │
│ Vista            ├─────────────────────────┤  solo en el  │
│ Tipo de sala     │                         │  editor)     │
│ Mapa             │         PLANO           │              │
│ Columnas       ⓘ │                         │ Agregar      │
│ Zonas y precios ⓘ│                         │ Editar       │
│ Leyenda          ├─────────────────────────┤ Sala         │
│                  │ Estado  Seleccionadas… ▲│              │
└──────────────────┴─────────────────────────┴──────────────┘
```

- **Lateral izquierdo (la sala), de arriba abajo:** *Vista* (Previsualizar, Editar plano y zoom, todo
  con iconos); el **tipo de sala**, que se ve en los dos modos; y, solo en el editor, *Mapa*,
  *Columnas* y *Zonas y precios*. La *Leyenda* va al final. Los grupos *Columnas* y *Zonas y precios*
  llevan un botón de **información (ⓘ)** junto al título que abre y cierra su explicación.
- **Lateral derecho (las piezas), solo en el editor:** *Agregar*, *Editar* (acciones, zona, nombre y
  venta) y *Sala* (asignar zona, bloquear butacas, escenario, restablecer). Los iconos
  van en rejilla y su tooltip sale a la derecha.
- **Lateral derecho (configuración), solo en el editor:** *Mapa* (nombre, guardar, exportar,
  importar), *Columnas* y *Zonas y precios*.
- **En escritorio (más de 900 px de ancho y 600 px de alto), una sola pantalla:** la página no se
  desplaza. Los laterales, el encabezado y el pie quedan fijos, y el plano llena el hueco que queda,
  así que la sala se ve completa. Lo único que se desplaza es el interior de un lateral cuando su
  contenido no cabe. Cada grupo se pliega haciendo clic en su título.
- **Los grupos de los laterales se pliegan** con un clic en su título, que lleva la flecha delante
  (▾ abierto, ▸ cerrado). Los de *Columnas* y *Zonas y precios* llevan además el botón de información,
  el mismo del encabezado.
- **Encabezado:** el título con un botón de **información (ⓘ)** y, debajo, el aforo.
- **Hojas de información:** el botón ⓘ abre, **sobre el plano**, tres hojas que se recorren de una
  en una, como diapositivas: **Qué es**, **Cómo se usa** (las instrucciones, que cambian con el modo
  y la herramienta) y **Notas**. Se pasa de hoja con **‹ ›**, con los puntos o con las flechas del
  teclado. Se cierran con el mismo botón, la ✕, **Esc** o un clic en el plano. Solo se abren al
  pulsar ⓘ.
- **Pie: una barra fija.** A la izquierda, los mensajes («Mesa 3 movida…») y avisos; a la derecha, el
  resumen («Seleccionadas: 2 · Total $700.00») y un botón **▲** que despliega **hacia arriba, sobre el
  plano,** el detalle de las butacas elegidas por zona y por mesa.
- Los paneles de información y de detalle no mueven ni cambian el tamaño del plano.
- **Previsualizar ajustado a la pantalla:** el plano ocupa el alto que queda bajo el encabezado, con la
  línea de estado a la vista, así que cualquier sala se ve completa sin scroll. Al cambiar el tamaño
  de la ventana se reajusta y conserva el zoom. En el editor el alto sale del ancho, como antes.
- **Pantallas de menos de 900 px de ancho o 600 px de alto:** vuelve el diseño con scroll de página.
  Por debajo de 900 px, además, los laterales dejan de ser laterales: las herramientas pasan arriba
  del plano y la configuración, debajo. El plano toma su alto del ancho y los paneles de información
  y de detalle empujan el contenido, en lugar de flotar.

## Modo editor

Dos modos, con los botones del grupo *Vista* del lateral:

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

Los tres estilos de mesa rectangular son el mismo modelo con otros valores:

| Estilo | Largo | Cabeceras | Un lado | Huella | Lugares |
|---|---|---|---|---|---|
| **Lados** | 2 | no | no | 2 × 3 | 4 |
| **Cruz** | 1 | sí | no | 3 × 3 | 4 |
| **Un lado** | 4 | no | sí | 4 × 2 | 4 |

La huella es el rectángulo completo, así que las esquinas vacías de una cruz quedan **reservadas**:
ninguna otra mesa puede ocuparlas.

### Venta por mesa o por butacas

El organizador decide cómo se vende cada mesa, y puede hacerlo de tres formas:

- **Una mesa:** con la mesa seleccionada en el editor, el selector **Venta** de *Editar*
  elige entre *Venta por butacas* y *Venta por mesa*.
- **Toda una zona de mesas:** el selector **Venta** de su fila, en *Bandas y precios*, cambia de golpe
  todas las mesas de esa banda. Si unas van por mesa y otras por butacas, muestra *Venta mixta*.
- **Todas las del plano:** el botón **«Aplicar a todas las mesas»**, que copia a todas el modo de la
  mesa seleccionada.

- **Por mesa:** en Previsualizar, un clic en la mesa (el tablero) o en cualquiera de sus lugares
  **elige la mesa y todos sus lugares libres** a la vez; otro clic los suelta. El tablero se marca
  con sus lugares, y el resumen la muestra como *«Mesa 3 · mesa completa, 4 lugares · $2,000.00»*.
- **Precio:** la suma de sus lugares libres, cada uno al precio de su zona (la que herede de su banda,
  salvo que la mesa o el lugar lleven otra). Un lugar **bloqueado** no se vende ni se cobra: la mesa se vende con los demás.
- **Una mesa completa con algún lugar ocupado se vendió entera:** todos sus lugares salen ocupados.
- **Por butacas** (lo de siempre): cada lugar se elige por separado y el tablero no responde al clic.
- Si se pasa a venta por mesa una que tenía solo algunos lugares elegidos, se eligen todos y se avisa.
- Se guarda en el mapa como `completa: true` en la mesa; sin el campo, se vende por lugares.

### Mesas redondas

Una mesa redonda se describe con **una sola medida: cuántos lugares tiene**, siempre un número **par**
de 2 a 16. Las sillas van **por parejas en cada lado**, sin usar las esquinas, así que caben tantas
por lado como mida el tablero y el diámetro sale de los lugares:

| Lugares | Tablero | Huella | Por lado (arriba · lados · abajo) |
|---|---|---|---|
| 2 | 1 celda | 3 × 3 | 1 · 0 · 1 |
| 4 | 1 celda | 3 × 3 | 1 · 1 · 1 |
| 6 | 2 celdas | 4 × 4 | 2 · 1 · 2 |
| 8 | 2 celdas | 4 × 4 | 2 · 2 · 2 |
| 10 | 3 celdas | 5 × 5 | 3 · 2 · 3 |
| 12 | 3 celdas | 5 × 5 | 3 · 3 · 3 |
| 14 | 4 celdas | 6 × 6 | 4 · 3 · 4 |
| 16 | 4 celdas | 6 × 6 | 4 · 4 · 4 |

```
 .  ▣ ▣  .      Mesa redonda de 8 lugares: dos sillas por lado,
 ▣  ● ●  ▣      ninguna en las esquinas y todas mirando al centro
 ▣  ● ●  ▣      (arriba hacia abajo, a los lados hacia dentro).
 .  ▣ ▣  .
```

- **Reparto:** las sillas se reparten de cuatro en cuatro, una por lado; si sobran dos, van arriba y
  abajo. En cada lado quedan centradas.
- **Lugares:** **Alargar** y **Acortar** (+ y −) ponen y quitan **dos** sillas de una vez, de 2 a 16.
  Al pasar de 4 a 6, de 8 a 10 o de 12 a 14, el tablero crece; la esquina de la huella no se mueve.
- **Girar (R):** lleva las sillas al lado siguiente. Con el mismo número de sillas en los cuatro
  lados no cambia nada visible; con 10, sí.
- **Huella cuadrada:** tablero más una celda por lado, así que cabe, choca, se arrastra y se duplica
  igual que las demás mesas. Como toda mesa, no puede caer sobre un pasillo.
- **Ids por posición:** `M7-1`, `M7-2`… empezando arriba y en sentido horario. Girar o mover la mesa
  no los cambia, así que la selección y las bloqueadas se conservan.
- **Marcas de estado:** solo giran en las sillas a 90° y 270°; en cualquier otro ángulo se quedan
  derechas, que se leen mejor.
- **Dato:** `{ id, tipo: 'redonda', x, y, lugares, giro }`. Las mesas rectangulares no llevan `tipo`,
  así que los mapas anteriores se siguen leyendo.

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

### Varias piezas a la vez

- **Marquesina:** en el editor, arrastrar el fondo dibuja un rectángulo y selecciona lo que atrapa;
  entra la pieza que quede con **la mitad o más** de su huella dentro, así que no hace falta rodearla
  entera. Con **Ctrl** (o Cmd) se suman a las que ya estaban; sin él, reemplazan la selección.
- **Ctrl+clic** en una pieza la mete o la saca de la selección.
- **Un clic normal** en una pieza que ya está seleccionada no deshace el grupo: pasa a ser la
  principal, que es la que se puede arrastrar para llevarse a todas.
- **Mover:** arrastrando cualquiera de ellas, o con las flechas. Es **todo o nada**: si una sola no
  cabe en su destino, no se mueve ninguna y el aviso dice cuál estorba. La sombra se pone roja en
  cuanto una no cabe.
- **Duplicar (Ctrl+D):** copia el grupo entero conservando las distancias entre sus piezas, a la
  derecha de su caja o, si ahí no cabe, debajo. Las copias quedan seleccionadas.
- **Eliminar (Supr):** quita todas.
- **Transformar:** girar, alargar, acortar, cabeceras y los lados también funcionan con el grupo, y
  cada pieza cambia **sobre su propio sitio** (gira sobre su centro, se alarga desde su ancla). Es
  todo o nada; si el grupo transformado no cabe donde está, se desplaza **entero** unas celdas para
  caber —así las distancias entre sus piezas no cambian— y se avisa. Una acción solo se ofrece si
  **todas** las seleccionadas la admiten: con una mesa y un bloque juntos, por ejemplo, girar sí y
  cabeceras no.
- **Zona y venta en grupo:** el selector de zona y el de venta por mesa aplican a todas. Cuando no
  coinciden, lo dicen: *«— varias zonas —»* y *«Venta mixta»*; al elegir una opción, todas quedan
  igual. El **nombre** es de cada pieza, así que con varias no se edita.
- Un **clic seco** en una pieza del grupo deja seleccionada solo esa.
- El **escenario** no entra en la marquesina ni en el grupo: es único y no se duplica ni se elimina.
- El plano se mueve con la barra espaciadora, el botón central o dos dedos, como con las herramientas
  de butacas: en el editor, arrastrar el fondo es de la marquesina.

Al elegir una mesa (clic o Tab), **sus butacas se marcan con ella** —la mesa y sus lugares son una
sola pieza: es lo que se mueve, gira, duplica o elimina— y se activan los botones de la barra del
editor. Son iconos: el nombre
de la columna «Botón» es el de su tooltip. Cada acción tiene atajo de teclado sobre la mesa enfocada:

| Acción | Botón | Tecla |
|---|---|---|
| Mover al siguiente hueco libre | — | Flechas |
| Girar 90° sobre su centro | Girar 90° | R |
| Alargar o acortar una celda | Alargar / Acortar | + / − |
| Poner o quitar cabeceras | Cabeceras | C |
| Lugares en uno o dos lados | Un solo lado | U |
| Duplicar junto al original | Duplicar | Ctrl+D |
| Eliminar | Eliminar | Supr |
| Agregar una mesa nueva | Lados / Cruz / Un lado / Mesa redonda | — |
| Lugares de una mesa redonda (de dos en dos) | Alargar / Acortar | + / − |
| Agregar un bloque de filas | Bloque de filas | — |
| Butacas por fila de un bloque | Alargar / Acortar | + / − |
| Filas de un bloque | + fila / − fila | ] / [ |
| Zona y nombre de un bloque | Zona / Nombre | — |
| Agregar una butaca suelta | Butaca suelta | — |
| Agregar una pista de baile o una barra | Pista de baile / Barra | — |
| Zona de una butaca suelta, nombre de una forma | Zona / Nombre | — |
| Volver a la sala de su tipo | Restablecer sala | — |
| Bloquear o desbloquear butacas | Bloquear butacas, y clic en la butaca | Enter o Espacio |

### Deshacer y guardar cambios

En **Mapa** están **Deshacer** y **Rehacer**. También funcionan Ctrl+Z y Ctrl+Mayús+Z
(Cmd en Mac), o Ctrl+Y para rehacer. Cada acción confirmada del editor —incluidos los cambios
de bandas, zonas, piezas y butacas, y **Restablecer sala**— ocupa un paso; una acción rechazada
no lo ocupa. El historial conserva hasta 50 pasos por tipo de sala durante esta sesión. Los atajos
no sustituyen el deshacer propio de un campo mientras se escribe en él.

El mismo grupo indica si el plano actual tiene **cambios sin guardar**. Cambiar de tipo de sala
conserva sus cambios y su historial mientras la página siga abierta. Guardar el mapa en el
navegador o exportarlo como JSON marca la versión actual como guardada; deshacer hasta esa versión
quita el aviso. Antes de cerrar o recargar, el navegador advierte si queda algún plano con cambios
pendientes. **Restablecer sala** pide confirmación cuando los hay, y su resultado se puede deshacer.
El historial no se incluye en el mapa guardado ni sobrevive a cerrar la página.

Con el ratón, una mesa se arrastra y una sombra marca el destino encajado en la rejilla: verde si
cabe, roja y con contorno discontinuo si no. Esc cancela un arrastre.

**Reglas:**

- **Cabe o no cabe:** una mesa cabe si toda su huella está dentro de la sala, libre y fuera de los
  pasillos; sigue siendo imposible partir una mesa con un pasillo. Si una acción no cabe, la mesa no
  cambia y un aviso dice por qué (*«cae sobre un pasillo»*, *«choca con Mesa 3»*, *«choca con la
  fila A de General»*).
- **Varias piezas:** al girar o cambiar el tamaño de un grupo, las nuevas huellas tampoco pueden
  chocar entre sí. Si ocurre, no cambia ninguna pieza y el aviso nombra el choque.
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

- **Datos:** `{ id: 'F1', tipo: 'filas', x, y, ancho, filas, giro, zona?, nombre? }`. Sin `zona` toma
  la de su banda. `ancho` son las butacas por fila (1 a 40) y `filas`, las filas (1 a 26). Es una
  pieza que se coloca, no la sala: su ancho no sube con el de la sala.
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

### Mapa en blanco

La opción **«Mapa en blanco»** (grupo *Nuevo* del selector de tipo de sala) empieza un recinto desde
cero, por ejemplo un salón de eventos. Al elegirla se abre directamente el modo editor.

- **Lienzo de 20 × 10 celdas:** una sola banda **Espacio** de 10 filas, sin escenario, sin filas ni
  mesas.
- **Sin pasillos fijos:** todas las columnas se pueden usar; el pasillo es el hueco que dejas entre
  bloques y mesas. En el panel, en lugar de bloques y pasillos, hay un campo **Ancho del lienzo** (1
  a 40 columnas). Las piezas se quedan donde están; si alguna deja de caber, el cambio no se aplica.
- **El alto** es la suma de las bandas: cada espacio tiene − / + de alto, y se agregan más con
  **Agregar espacio** (o «+ espacio» dentro de una vertical). Las bandas de filas, zonas de mesas y
  franjas con verticales siguen disponibles.
- **Guías de fila:** el botón **Guías** de un espacio muestra letras de referencia (A, B, C…) en cada
  fila, para ubicarse. No son butacas ni se venden.
- **Escenario:** el botón **Agregar escenario** de la barra lo pone en el primer hueco libre: a todo
  el ancho si cabe, si no de 8 o de 4 columnas. Después se mueve y cambia de tamaño como siempre.
- **Guardar:** con un nombre, en «Mis mapas», como cualquier mapa (versión 4 del formato).

### Butacas sueltas y formas

Tres piezas más en la barra del editor, en cualquier sala (no solo en el mapa en blanco). Se colocan
en el primer hueco libre, se arrastran o se mueven con flechas, y se duplican (Ctrl+D) y eliminan
como las demás. Pueden cruzar pasillos.

- **Butaca suelta:** una sola butaca, que se crea mirando al escenario y con la zona de su banda. Se
  gira de 90 en 90 (R) y se le puede dar zona propia con el selector **Zona**. **Se numera con las demás butacas de
  su zona**, por altura y de izquierda a derecha, mire hacia donde mire: junto a un bloque de General
  en la misma fila, puede ser la *General A1* y el bloque seguir en A2. Su id es el de la pieza (`B3`).
- **Pista de baile** (4 × 4) y **barra** (4 × 1): rectángulos con nombre que ocupan sus celdas, así que
  nada se les pone encima. No tienen lugares. La pista se dibuja con cuadros suaves y la barra como un
  mostrador macizo, las dos con su nombre dentro.
  - **Girar (R):** intercambia ancho y alto sobre su centro. Si al girar se saldría por un borde, se
    mete en la sala.
  - **Ancho:** Alargar / Acortar (+ / −), de 1 a 40. **Alto:** + fila / − fila (] / [), de 1 a 20.
  - **Nombre:** el campo **Nombre** de la barra; vacío, vuelve a *Pista de baile N* o *Barra N* (N es
    el número de su id, compartido por todas las formas).

Al duplicar una banda o eliminarla, sus butacas sueltas y formas se copian o se quitan con ella, igual
que las mesas y los bloques.

### El escenario

El escenario es una pieza más: `{ x, y, ancho, alto }` en celdas. Por defecto ocupa la franja inicial
a todo el ancho de la sala (2 filas de alto), pero en el editor se agarra y se edita como una mesa:

| Acción | Botón | Tecla |
|---|---|---|
| Mover | — (arrastrar) | Flechas |
| Girar 90° (intercambia ancho y alto) | Girar 90° | R |
| Ancho | Alargar / Acortar | + / − |
| Alto | + fila / − fila | ] / [ |

- **Es opcional:** **Quitar escenario** / **Agregar escenario** en la barra del editor, en cualquier
  sala. No puede pisar filas, mesas ni bloques (ni ellos a él). Puede cruzar pasillos.
- **Sin escenario,** las filas miran hacia arriba, la fila A de cada zona es la de más arriba y los
  bloques nuevos se crean sin girar. El aforo dice *sin escenario*.
- **Las filas y la numeración se miden desde donde esté:** las bandas miran hacia él y, en cada zona,
  la fila más cercana es la A. Si se baja el escenario, la fila de abajo pasa a ser la A y los
  rótulos cambian con ella.
- **Los bloques nuevos se crean mirando hacia el escenario** (girados 180° si está debajo, 90° o
  270° si está a un lado).
- **Al cambiar las columnas,** un escenario a todo el ancho sigue a todo el ancho.
- Si el escenario sale de la franja inicial, esas filas quedan libres para otras piezas.

### Butacas bloqueadas

Con **Bloquear butacas** activado, cada clic (o Enter) sobre una butaca la bloquea o desbloquea: por
ejemplo, butacas sin visibilidad. **Arrastrando se bloquea un área entera** (con Alt, se desbloquea),
igual que al asignar zona. Vale para butacas de fila y lugares de mesa; las ocupadas no se
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
butacas bloqueadas, **zonas con sus nombres y precios** y los contadores de ids. No guarda la ocupación ni la selección.

**Límites:** una sala tiene como máximo **20.000 butacas** (contando las de mesas, bloques y butacas
sueltas). Más harían lento el dibujo del plano. El editor no aplica un cambio que pase de ahí (agregar
o alargar bandas, piezas, columnas, duplicar) y lo explica; un mapa importado o guardado que lo supere
no se carga. Un archivo de más de **1 MB** no se importa: un mapa real ocupa pocos KB.

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

**Versión 3** añade `lienzo` (mapa en blanco, sin pasillos), `escenario: null` (sin escenario) y
bandas de tipo `espacio` (con `guias`); el escenario ya no tiene que ser la primera banda. También
guarda `formas` y `butacasSueltas` (listas opcionales) con sus contadores `siguienteForma` y
`siguienteButaca`. Los mapas de la versión 2 se leen igual que antes.

**Versión 4** (la actual) es la de la herencia de zona: `zona` es **opcional** en las mesas, los
bloques y las butacas sueltas —sin ella heredan la de su banda— y las zonas de mesas, los espacios,
las franjas y las bandas verticales pueden llevar la suya. Un mapa de la versión 3 se lee igual: como
sus mesas no traían zona, pasan a heredar la de la banda donde están, que es la de mesas.

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
seguir usando **Exportar JSON**. Si falla la escritura al eliminar un mapa, este permanece en la
lista y se muestra el error. Los nombres de mapa, incluido `__proto__`, se guardan como claves
propias y se recuperan al recargar.

### Posibles mejoras

- **Guardar los mapas** en un servidor, en lugar de en el navegador.
- **Desplazar el plano** solo al arrastrar una mesa hasta el borde con zoom.
- **Comprobar que las piezas caben con menos recorridos:** hoy se recalculan las celdas ocupadas una
  vez por pieza, lo que con muchísimas mesas y bloques en una sala grande sería cuadrático. Con el
  aforo máximo actual no se nota.
- **Más formas:** escenario secundario, cabina de DJ, columna u otros obstáculos del recinto.

## Pruebas

```bash
node --test pruebas.mjs
```

Cubren la rejilla, el reparto de mesas, el aforo de la tabla anterior, la conciliación de la
selección al cambiar de sala, los tipos de sala y las bandas, y las reglas del editor: geometría de las mesas, hacia dónde
mira cada silla, dónde caben, girar, alargar, cabeceras, un solo lado y sitio para mesas nuevas; también el mapa en blanco (lienzo, espacios, guías, escenario opcional y mapas versión 4), butacas sueltas y formas, duplicar piezas y bandas, renombrar bandas, subtítulos y selección de bandas por clic. No hay copia del código: `pruebas.mjs` lee `index.html` y
evalúa la parte del script anterior a la marca *«Fin de la parte sin DOM»*, así que el proyecto
sigue siendo un solo archivo, y la API que ven las pruebas se escanea del propio archivo: una
función nueva se prueba sin tocar el arnés. Requiere Node 18 o posterior.

Dos de ellas vigilan **esta documentación**: que los topes que se citan aquí y en `AGENTS.md` sean
los que tiene el código, y que no se nombre ninguna función que ya no exista. Así el texto no se
queda describiendo una versión anterior sin que nadie se entere.

Se ejecutan solas en cada pull request y en cada empujón a `main`
(`.github/workflows/pruebas.yml`).

## Qué aguanta

Medido sobre una arena de 249 columnas con 18.720 butacas, en un portátil de escritorio (en una
máquina modesta, multiplica por dos o tres):

| | |
|---|---:|
| Aforo máximo | **20.000 lugares** |
| Ancho de la sala | **300 columnas** |
| Generar el plano | ~20 ms |
| Redibujarlo entero | ~290 ms |
| **Elegir una butaca** | **menos de 1 ms** |
| Zoom y desplazamiento | imperceptible |
| Tamaño del mapa guardado | unos pocos KB |

**Comprar va instantáneo a cualquier aforo:** elegir una butaca no redibuja el plano, solo cambia
clases en el nodo que ya existe. Lo que cuesta es cada acción del **editor**, que rehace el plano
entero; con recintos de miles de butacas se nota, y está anotado como lo siguiente por hacer.

El mapa guardado es pequeño porque guarda **el diseño, no las butacas**: una banda de 26 filas
ocupa tres líneas de JSON, genere 58 o 5.800 asientos.

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
