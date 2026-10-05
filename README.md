# Selector de asientos

La evolución del recinto y la configuración por evento se define en
[Contrato de recinto, evento y conector](docs/CONTRATO_RECINTO_EVENTO.md).
Ese contrato distingue funciones actuales y fases pendientes; incluye un ejemplo ficticio
de tres niveles, una fila compartida entre sectores y un palco.

Plano de butacas interactivo en SVG. Se entrega como **un solo archivo HTML** que se abre en el
navegador tal cual. Las fuentes están separadas y se unen con Node, sin dependencias ni framework.

Tres formas de venta pueden convivir en el mismo plano: filas numeradas, mesas con lugares
agrupados y zonas de acceso general. Hay salas mixtas, solo de filas y solo de mesas.

## Cómo probarlo

Abre `index.html` en el navegador. Si prefieres servirlo:

```bash
python -m http.server 8000
```

Si editas el proyecto, trabaja en `src/` y genera de nuevo el archivo autónomo con
`node construir.mjs`. `node construir.mjs --check` comprueba que las fuentes y el HTML entregado
coinciden; la CI lo exige. También genera y comprueba HTML, CSS y JavaScript externos en
`integracion/`, para Sin Taquilla. No hay instalación de paquetes.

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

- **Nombre:** es propio de la banda; renombrarlo no cambia la zona ni las etiquetas.
- **Zona:** asigna una zona física existente, compartida si corresponde. «Zona nueva…» crea
  una de forma explícita; los espacios pueden quedarse sin zona y heredar de más afuera.
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

### Bandas y zonas físicas independientes

**Distribución del plano** administra bandas; **Zonas físicas** lista todas las zonas, incluso
las usadas por bandas. Agregar zona no crea espacio. Agregar banda no crea zona: filas toman
General o la primera zona de filas y mesas usan la zona de mesas. Eliminar banda conserva zonas.
El nombre de banda es un subtítulo independiente; su nombre automático puede usar el de la zona.
Las zonas tienen ID, nombre y color derivado de la paleta; el límite sigue siendo **40 zonas**.
Las usadas no se eliminan, y se conservan la zona de mesas y al menos una zona para filas.

El mapa físico no configura precios ni venta completa. Sin un evento conectado, el resumen
muestra **Precio no disponible**. Cero no se inventa: los importes llegarán desde Sin Taquilla.
Las herramientas de venta agrupada siguen como base interna para fases posteriores, sin controles
comerciales en el editor. El conector de fase 6 recibe la política desde el evento;
su [guía de integración](docs/INTEGRACION_EVENTOS_SINTAQUILLA.md) define el intercambio.

### La zona se hereda de la banda

**Cada banda le da su zona física a las piezas que heredan:** mesas, bloques y butacas sueltas.
La herencia resuelve la zona al crear el lugar. Su identidad física guarda esa pertenencia:
mover o girar conserva la zona, incluso al cruzar a otra banda. El aviso señala diferencias
entre ubicación física y región de dibujo. Cambiar la zona de la banda afecta a lugares nuevos;
reasignar los existentes se hace expresamente con *Asignar zona* o el selector de la pieza.

De lo más concreto a lo más general, manda:

1. la zona **pintada en esa butaca** (*Asignar zona*, más abajo);
2. la zona **propia de esa mesa, bloque o butaca suelta**, si se la diste en *Editar*;
3. la zona de la **banda** que la contiene y, si hay bandas dentro de bandas, la más interna;
4. si no cae dentro de ninguna banda con zona, el editor le escribe una y lo dice en el aviso: una
   pieza nunca se guarda sin zona física.

En *Editar*, el selector de zona empieza en **«Hereda: ⟨zona de la banda⟩»**; elegir una
zona concreta reasigna sus lugares y volver a *Hereda* toma expresamente la zona actual de la región.
Las piezas nuevas nacen heredando, sin cambiar las pertenencias de las existentes.

**Asignar zona a cada asiento.** El botón **Asignar zona** del grupo *Sala* (como *Bloquear butacas*)
abre un selector con todas las zonas. Eliges una y haces clic en las butacas, o Enter sobre ellas, para
asignársela; otro clic la devuelve a su zona de siempre.

- Sirve para **cualquier asiento**: filas, bloques, butacas sueltas y lugares de mesa (también se
  puede asignar la zona Mesas a una butaca de fila).
- Las butacas que ya son de la zona elegida se ven marcadas con la palomita.
- **La numeración sigue la zona física:** la butaca A3 de Luneta pintada de VIP conserva su ID,
  pero pasa a *«VIP, fila A, butaca 1»* si es la primera de esa zona. Sus vecinas de Luneta se
  renumeran. Un lugar de mesa muestra zona, mesa y lugar; las mesas empiezan en 1 en cada zona.
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
  completa queda con lugares de dos zonas, también se avisa de la mezcla de zonas físicas.
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
│ Distribución   ⓘ │                         │ Editar       │
│ Zonas físicas    │                         │              │
│ Leyenda          ├─────────────────────────┤ Sala         │
│                  │ Estado  Seleccionadas… ▲│              │
└──────────────────┴─────────────────────────┴──────────────┘
```

- **Lateral izquierdo (la sala), de arriba abajo:** *Vista* (Previsualizar, Editar plano y zoom, todo
  con iconos); el **tipo de sala**, que se ve en los dos modos; y, solo en el editor, *Mapa*,
  *Columnas*, *Distribución del plano* y *Zonas físicas*. La *Leyenda* va al final. Los grupos *Columnas* y *Distribución del plano*
  llevan un botón de **información (ⓘ)** junto al título que abre y cierra su explicación.
- **Lateral derecho (las piezas), solo en el editor:** *Agregar*, *Editar* (acciones, zona, nombre y
  orientación) y *Sala* (asignar zona, bloquear butacas, escenario, restablecer). Los iconos
  van en rejilla y su tooltip sale a la derecha.
- **En escritorio (más de 900 px de ancho y 600 px de alto), una sola pantalla:** la página no se
  desplaza. Los laterales, el encabezado y el pie quedan fijos, y el plano llena el hueco que queda,
  así que la sala se ve completa. Lo único que se desplaza es el interior de un lateral cuando su
  contenido no cabe. Cada grupo se pliega haciendo clic en su título.
- **Los grupos de los laterales se pliegan** con un clic en su título, que lleva la flecha delante
  (▾ abierto, ▸ cerrado). Los de *Columnas* y *Distribución del plano* llevan además el botón de información,
  el mismo del encabezado.
- **Encabezado:** el título con un botón de **información (ⓘ)** y, debajo, el aforo.
- **Hojas de información:** el botón ⓘ abre, **sobre el plano**, tres hojas que se recorren de una
  en una, como diapositivas: **Qué es**, **Cómo se usa** (las instrucciones, que cambian con el modo
  y la herramienta) y **Notas**. Se pasa de hoja con **‹ ›**, con los puntos o con las flechas del
  teclado. Se cierran con el mismo botón, la ✕, **Esc** o un clic en el plano. Solo se abren al
  pulsar ⓘ.
- **Pie: una barra fija.** A la izquierda, los mensajes («Mesa 3 movida…») y avisos; a la derecha, el
  resumen («Seleccionadas: 2 · Precio no disponible») y un botón **▲** que despliega **hacia arriba, sobre el
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

### Modalidad de venta de mesas y palcos

El editor conserva los lugares y su mesa física. Los controles de venta completa se retiraron:
la modalidad pertenecerá al evento en Sin Taquilla, siguiendo el contrato de recinto y evento.
Sin evento conectado se seleccionan lugares individualmente y no se calcula un importe.
La importación conserva `completa: true` de mapas antiguos como antecedente inactivo.
El conector aplica una modalidad común a mesas y palcos: por lugar o por conjunto de todos sus
lugares físicamente utilizables. Un integrante requerido excluido, reservado, vendido o sin estado
confirmado impide seleccionar el conjunto; nunca se recorta. Su importe suma los integrantes.
El servidor de Sin Taquilla aún debe configurar, validar y reservar esas selecciones en una transacción.

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

Para mostrar, los lugares se numeran «lugar 1, 2, 3…» en sentido horario. El número visible de
la mesa empieza en 1 en cada zona y se ordena de arriba abajo y de izquierda a derecha; `M2`
sigue siendo solo su ID estable. Dos zonas pueden tener cada una una «Mesa 1».

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
- **Bloques que no miran al escenario de frente** conservan su nombre como orientación, pero sus
  filas también toman letras únicas dentro de la zona. Su fila física no se mezcla con una fila
  horizontal que pase a la misma altura.

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
- **Guardar:** con un nombre, en «Mis mapas», como cualquier mapa (versión 8 del formato).

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
butacas bloqueadas, **zonas físicas con sus nombres** y los contadores de ids. No guarda la ocupación ni la selección.

**Límites:** una sala tiene como máximo **20.000 butacas** (contando las de mesas, bloques y butacas
sueltas). Más harían lento el dibujo del plano. El editor no aplica un cambio que pase de ahí (agregar
o alargar bandas, piezas, columnas, duplicar) y lo explica; un mapa importado o guardado que lo supere
no se carga. Un archivo de más de **8 MB** no se importa; el inventario físico agrega un registro por lugar.

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

**Versión 4** añadió herencia de zona opcional en piezas y bandas.

**Versión 5** separó zonas físicas y datos comerciales. Zonas guardan ID y nombre,
y mesas no guardan venta completa activa. Los precios y mesas completas de mapas v1–v4 se
conservan en antecedentes comerciales pendientes de revisión. Se mantienen al guardar y abrir,
pero no activan precios ni selección conjunta. No se fusionan zonas ni se adivina su significado.

**Versión 6** añadió identidad física por lugar, IDs retirados, numeración oficial y revisión.
La clave del generador identifica una posición dentro de una pieza; el ID identifica el lugar.
Acortar y volver a ampliar da IDs nuevos a los lugares retirados, sin recuperar sus bloqueos.
Los mapas v1–v5 se materializan conservando sus IDs, coordenadas, zonas y etiquetas actuales.
El archivo de importación admite hasta **8 MB** para el inventario de hasta **20.000 lugares**.

**Numeración oficial.** En el editor, *Numeración oficial* permite cambiar deliberadamente entre
automática y explícita. La confirmación indica cuántos lugares se afectan y muestra ejemplos de sus etiquetas. Al activar la oficial
se capturan las etiquetas visibles; *Elegir lugar para numerar* permite seleccionar con clic o
Enter y editar fila/butaca o mesa/lugar. Admite letras, ceros iniciales, pares, impares y saltos.
Mover y girar conservan etiquetas oficiales. Las copias y los lugares nuevos requieren asignación
antes de exportar un catálogo oficial. Una etiqueta repetida se rechaza sin aplicar el cambio.

**Revisiones.** *Congelar y exportar revisión* valida el catálogo y entrega un mapa cerrado con
ID del recinto, número de revisión y comprobación local de integridad. Al abrirlo, la edición
queda cerrada; *Crear nueva revisión en borrador* conserva la anterior y sus IDs para continuar.
El borrador se guarda con otro nombre. La comprobación detecta cambios accidentales, no constituye
una firma de seguridad. Esta publicación es local: aún no configura eventos en Sin Taquilla.

**Catálogo de lugares.** En *Mapa → Exportar lugares* se valida el diseño y se descarga un JSON
con un registro por lugar: ID local estable, zona física, fila/butaca o mesa/lugar, etiqueta,
coordenadas y bloqueo, sin tarifas ni antecedentes comerciales. El ID no cambia al mover una pieza ni al renumerar.
La validación exige un nombre definitivo para cada zona con lugares, etiquetas únicas y que todos
los lugares de una mesa estén en la misma zona física. Una zona llamada *Zona* o *Zona 2* es
provisional. Los mapas viejos se siguen abriendo; si tienen `zonasDeAsiento`, antes de exportar el
catálogo hay que revisar esas asignaciones con *Revisar zonas físicas asignadas*. La confirmación
se guarda como `zonasFisicasConfirmadas`, asociada al ID y al valor de zona; cambiar la zona vuelve
a exigir revisión. El catálogo físico es versión 5, incluye ubicación completa, revisión e IDs retirados, y Sin Taquilla decidirá categoría, importe y modalidad al configurar
el evento. Aún no publica el mapa ni conecta la venta.

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

## Estructura física del recinto (fase 5)

El mapa **versión 8** y el catálogo físico **versión 5** incorporan sectores, filas oficiales
y palcos con IDs propios. El panel «Estructura física» permite crearlos dentro de un nivel y
zona, renombrarlos y asignar sus integrantes. Cada tipo admite hasta 1.000 entidades activas.
Crear una entidad vacía no añade asientos ni aforo. Suprimirla exige desvincular primero sus
lugares; su ID queda retirado y no se reutiliza, tampoco al deshacer y crear otra.

Las pertenencias se guardan por lugar en el inventario, con `sectorId`, `filaId` y `grupoId`.
Una fila puede continuar entre bloques o sectores separados por pasillos. Su etiqueta procede
de la fila física; su numeración de butacas conserva el modo automático u oficial del mapa.
En modo oficial, renombrar la fila actualiza expresamente la etiqueta de sus integrantes.
El catálogo verifica la unicidad sobre la ubicación completa, incluido el sector.

Un palco agrupa butacas sueltas o lugares de bloques existentes, sin convertirlos en mesas.
Cada integrante tiene `numeroGrupo`, una etiqueta explícita independiente de sus coordenadas,
editable al seleccionar un solo lugar. Las etiquetas iniciales se asignan sin repetir las ya
existentes; mover o regenerar no las cambia. El palco no necesita una fila ficticia. Para pasar
un lugar de fila a palco, o viceversa, hay que desvincular antes su pertenencia anterior.
Todos los integrantes comparten nivel y zona; pueden pertenecer a distintos sectores.

El contorno de un palco se calcula alrededor de sus integrantes visibles: ayuda a reconocer el
compartimento, pero no es un obstáculo ni una región gráfica que mueva otras piezas. Sus lugares
se siguen posicionando con bloques o butacas sueltas y admiten las geometrías de fase 4.
Duplicar esas piezas crea nuevos lugares, conserva su sector y deja pendiente asignar la fila
o el palco de la copia. El original conserva todos sus integrantes. Reasignar zona es explícito
y desvincula las pertenencias incompatibles; eliminar nivel retira sus entidades y lugares.

La herramienta «Elegir lugares con clic o Enter» mantiene una selección física independiente
de la selección de compra. También puede tomar los lugares de las piezas seleccionadas o los
integrantes de una entidad. Las flechas recorren las butacas; «Asignar entidad» aplica todos los
lugares o ninguno si hay incompatibilidades. La selección física se limpia al cambiar de nivel
o salir del editor. Guardar, importar y deshacer conservan entidades y pertenencias.

El catálogo incluye `sector`, `physical_row`, `physical_group` y `group_place_number` por lugar,
y listas de sectores, filas y grupos con integrantes identificados individualmente. Las mesas
conservan su ID de pieza como ID de grupo; los palcos tienen ID físico propio. Cada lugar cuenta
una sola vez. Precios, habilitación por evento y venta conjunta siguen a cargo de Sin Taquilla;
esta fase no activa venta completa ni implementa el conector. Los mapas v1–v7 se migran sin
inventar sectores, filas físicas o palcos a partir de su geometría o etiquetas.

## Niveles, regiones y filas libres (fase 4)

El mapa **versión 7** conserva hasta 12 niveles con IDs estables, nombres y geometría propia.
Los mapas v1–v6 se abren como *Planta baja*, sin alterar sus lugares. Las pestañas de niveles están
disponibles encima del plano al editar y previsualizar; conservan la selección de todo el recinto y la vista de
cada piso durante la sesión. El resumen y las etiquetas accesibles incluyen el nivel cuando
hay varios. Las coordenadas iguales en pisos diferentes no chocan. El aforo de 20.000 lugares
se aplica al recinto completo. Guardar usa siempre el primer nivel como raíz del documento;
cambiar de vista no crea una revisión ni cambios pendientes.
Las flechas izquierda/derecha recorren las pestañas, Inicio/Fin van a la primera/última y
Enter o Espacio activa el nivel enfocado. El foco y la pestaña seleccionada se distinguen;
la navegación entre pestañas no cambia el nivel hasta activarlo.

En *Niveles y regiones* se agrega, renombra o elimina un nivel. Eliminar muestra los lugares
afectados y retira sus IDs; los contadores no retroceden, incluso al deshacer. El último nivel
no se elimina. Cada nivel conserva sus columnas, bandas, escenario y piezas. Las operaciones
por área afectan solo al piso visible; zonas, inventario y revisión pertenecen al recinto.

Las **regiones** son contornos de dibujo independientes (hasta 100 por nivel). Tienen posición,
medidas y ángulo propios; admiten laterales, alas y distribuciones asimétricas. Se vinculan
bloques desde *Geometría de filas*. Mover o girar una región transforma sus bloques vinculados
como grupo, y se rechaza todo el cambio si uno no cabe. Eliminar el contorno conserva los bloques.
Una región no es una zona física, no genera lugares y no determina precios. Las mesas y otras
piezas conservan sus controles actuales; el vínculo gráfico de región se ofrece para bloques.

**Agregar lateral izquierdo/derecho**, en *Niveles y regiones*, amplía únicamente el piso visible:
agrega una región vacía de 6 columnas y una columna de separación respecto al plano anterior.
Las bandas centrales conservan su ancho; al agregar por la izquierda se desplaza su dibujo
7 columnas junto con las piezas, regiones anteriores y escenario. El escenario conserva sus
medidas y su posición respecto al público original. IDs, etiquetas, zonas y pertenencias
físicas se conservan; los rótulos de filas y las guías mantienen su lado respecto al centro,
también después de guardar y abrir. Los botones no crean zonas ni asientos ni asignan tarifas; los bloques
se agregan y vinculan después desde *Geometría de filas*. Cada operación se puede deshacer.
Se respetan los límites actuales de columnas, regiones y verticales; si no cabe, se anuncia
el motivo sin modificar el plano. Una revisión publicada requiere un nuevo borrador.

Selecciona un bloque y abre **Geometría de filas**. Admite filas rectas o arcos circulares,
ángulos arbitrarios, posiciones fraccionarias, separación entre butacas y filas, radio y apertura.
La orientación de las butacas es independiente: según la fila, hacia el escenario del nivel
o ángulo manual relativo al bloque. Las mesas conservan giros de 90°. La geometría clásica de
los mapas existentes conserva su distribución hasta activar expresamente la geometría libre.

*Ajustar una butaca* permite elegir con clic o Enter, editar desplazamientos relativos a la fila
y corregir su orientación. Las correcciones se asocian al ID del lugar, viajan y giran con su
fila y sobreviven al cambiar radio o separación. Se conservan al duplicar con IDs nuevos.
Al retirar un lugar se descarta su corrección; ampliar de nuevo crea otro ID sin recuperarla.
Las etiquetas oficiales siguen conservándose. Cualquier solapamiento entre butacas o con
obstáculos, o salida del lienzo, rechaza el cambio. Las huellas de los asientos se comprueban
como cuadrados de una celda, incluso en coordenadas fraccionarias; tocar bordes no es solaparse.
Las flechas siguen la fila y columna local de un bloque libre, aunque el arco retroceda en
coordenadas; entre bloques buscan el lugar más cercano en la dirección elegida del piso visible.

El catálogo físico versión 4 agregó nivel y orientación; la fase 5 lo amplía a versión 5.
Su etiqueta completa distingue dos lugares con la misma fila/número en pisos diferentes.
Imágenes de fondo y curvas generales siguen pendientes. Esta fase no construye ni
confirma el plano o aforo del Clavijero; prepara las herramientas para trazarlo con documentación.

## Pruebas

```bash
node construir.mjs --check
node --test pruebas.mjs
node --test pruebas-navegador.mjs
```

Cubren la rejilla, el reparto de mesas, el aforo de la tabla anterior, la conciliación de la
selección al cambiar de sala, los tipos de sala y las bandas, y las reglas del editor: geometría de las mesas, hacia dónde
mira cada silla, dónde caben, girar, alargar, cabeceras, un solo lado y sitio para mesas nuevas; también el mapa en blanco (lienzo, espacios, guías, escenario opcional y mapas versión 7), butacas sueltas y formas, duplicar piezas y bandas, renombrar bandas, subtítulos y selección de bandas por clic. No hay copia del código: `pruebas.mjs` lee `index.html` y
evalúa la parte del script anterior a la marca *«Fin de la parte sin DOM»*, así que se prueba el
HTML que se entrega, y la API que ven las pruebas se escanea del propio archivo: una
función nueva se prueba sin tocar el arnés. Requiere Node 18 o posterior.

`pruebas-navegador.mjs` abre el archivo servido localmente en Chrome o Edge y recorre la interfaz:
selección con teclado, guardado y recarga, importación de JSON, edición de varias piezas y deshacer.
También comprueba el ancho de 390 px y los nombres expuestos en el árbol de accesibilidad. Requiere
Node 22 o posterior y Chrome o Edge; en Windows se detecta su instalación habitual y en otros
sistemas se puede indicar la ruta con `CHROME_BIN`. No instala paquetes.

Dos de ellas vigilan **esta documentación**: que los topes que se citan aquí y en `AGENTS.md` sean
los que tiene el código, y que no se nombre ninguna función que ya no exista. Así el texto no se
queda describiendo una versión anterior sin que nadie se entere.

Se ejecutan solas en cada pull request y en cada empujón a `main`
(`.github/workflows/pruebas.yml`).

## Qué aguanta

Arena de 249 columnas con 18.720 butacas. Las cifras de generación son de la medición anterior;
el redibujado se volvió a medir con Chrome sin interfaz el 26 de septiembre de 2026, comparando
ambas versiones en el mismo equipo:

| | |
|---|---:|
| Aforo máximo | **20.000 lugares** |
| Ancho de la sala | **300 columnas** |
| Generar el plano | ~20 ms |
| Redibujarlo tras editar | ~625 ms de mediana; antes ~1.119 ms |
| **Elegir una butaca** | **menos de 1 ms** |
| Zoom y desplazamiento | imperceptible |
| Tamaño del mapa guardado | crece con el inventario físico desde v6 |

Puedes repetir la medición con `node medir-render.mjs` (Node 22 y Chrome o Edge). Informa la primera
pintura y cinco redibujados; la mediana anterior excluye la primera. No es una prueba de CI porque
la duración depende del equipo.

**Elegir una butaca** solo cambia el nodo que ya existe. Al editar el mismo mapa, las butacas cuyo ID permanece
conservan su nodo SVG, su foco y sus marcas; se actualizan únicamente los atributos y posiciones
que cambiaron. El resto del plano todavía se rehace en cada acción.

El mapa guardado es pequeño porque guarda **el diseño, no las butacas**: una banda de 26 filas
ocupa tres líneas de JSON, genere 58 o 5.800 asientos.

## Qué no incluye

Es la **capa visual**. No trae servidor, ni reserva, ni control de concurrencia, ni pasarela de
pago. La ocupación del ejemplo está escrita en el archivo.

Si lo conectas a un sistema real, el servidor es la autoridad: el plano consulta la ocupación al
cargar y la vuelve a consultar antes de enviar la selección, y el servidor rechaza las butacas que
se hayan ocupado entre tanto. La comprobación contra sobreventa va en una transacción de base de
datos, nunca en el navegador.

El [contrato de recinto y evento](docs/CONTRATO_RECINTO_EVENTO.md) define identidad física,
numeración oficial, tarifas por evento, venta agrupada y revisiones. Complementa y actualiza
el [contrato de lugares para Sin Taquilla](docs/CONTRATO_LUGARES_SINTAQUILLA.md).
El conector del selector está implementado en fase 6. La administración, persistencia y venta real
del lado de Sin Taquilla siguen pendientes; ver la [guía de entrega](docs/INTEGRACION_EVENTOS_SINTAQUILLA.md).

### Conectar un evento (fase 6)

La API `window.SelectorAsientos` recibe un mapa publicado y un snapshot separado con categorías,
tarifas, exclusiones, modalidad de grupos e IDs y estados de los lugares del evento. La revisión
queda fija y la compra no permite editar ni cambiar de recinto. Los niveles conservan la selección.
Nombres físicos vienen del recinto, importes del evento; no se guardan datos comerciales en el mapa.

Se pueden excluir niveles, zonas, sectores, filas, grupos o lugares; se aplica la unión de
exclusiones según pertenencias, sin imponer un árbol. Las tarifas contradictorias se rechazan.
La disponibilidad ausente es desconocida. Los conteos separan inventario, utilizables, habilitados,
libres y comprables: un lugar libre de un conjunto incompleto no es comprable.

El anfitrión recibe selecciones por callback o evento DOM, consulta y reserva mediante rutas del
mismo origen con CSRF. Las peticiones envían IDs opacos del evento; el importe mostrado no autoriza
una venta. Errores de consulta suspenden la compra hasta confirmar de nuevo disponibilidad.
Actualizaciones validan revisión, identidades y versión, y avisan al soltar selecciones afectadas.

La entrega externa funciona con `style-src 'self'` y `script-src 'self'`. El HTML autónomo sigue
funcionando sin servidor. El [ejemplo completo](docs/ejemplo-conector-evento.json) usa tres niveles,
fila compartida, mesa y palco ficticios; no representa el Clavijero.

## Sobre three.js

Se evaluó y se descartó. three.js dibuja en un `<canvas>`, que es **un solo nodo del DOM**: se
pierden el clic por butaca, el recorrido con teclado, las etiquetas ARIA y los estados con CSS, y
hay que reconstruirlos a mano. SVG los da gratis y aguanta salas de mil a dos mil butacas. Además
son unos 600 KB de dependencia en algo que aquí pesa un archivo.

## Licencia

MIT. Ver [LICENSE](LICENSE).

El icono de la butaca es `event_seat` de [Material Icons](https://github.com/google/material-design-icons)
de Google, bajo Apache License 2.0. Ver [NOTICE](NOTICE). Todo el código restante es original.
