# Changelog

Cambios notables del proyecto, del más reciente al más antiguo. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). El proyecto aún no usa números de
versión: cada entrada se identifica por fecha y pull request.

## Sin publicar — Contrato de lugares con Sin Taquilla

Rama `claude/contrato-lugares`.

### Agregado

- Contrato de diseño para identidad estable por evento y revisión del mapa, etiquetas por zona,
  tarifa autorizada por el servidor, mesas completas, boletos históricos y edición tras publicar.
- Brechas verificadas entre este selector y la propuesta de recintos de Sin Taquilla; condiciones
  de aceptación para implementar las fases 5, 6 y 7.

## 2026-09-25 — PR #43: Pruebas de navegador

[PR #43](https://github.com/jonathancr29/selector-asientos/pull/43), fusionado en `main` con el
commit `f9be0cb`.

Rama `claude/pruebas-navegador`.

### Agregado

- Recorridos en Chrome para selección con teclado, guardado y recarga, importación, edición en grupo,
  deshacer, vista estrecha y nombres del árbol de accesibilidad; se ejecutan en cada PR sin paquetes.

## 2026-09-25 — PR #42: Proteger la edición

[PR #42](https://github.com/jonathancr29/selector-asientos/pull/42), fusionado en `main` con el
commit `76ca136`.

Rama `claude/proteger-edicion`.

### Agregado

- Historial de deshacer y rehacer por plano, con botones y atajos de teclado.
- Indicador de cambios sin guardar, aviso al salir y confirmación al restablecer un plano modificado.

### Pruebas

- Casos del historial para guardado, deshacer, rehacer, edición tras deshacer y límite de pasos.

## 2026-09-25 — PR #41: Integridad de grupos y mapas

[PR #41](https://github.com/jonathancr29/selector-asientos/pull/41), fusionado en `main` con el
commit `3b38093`.

Rama `claude/integridad-mapas-grupos`.

### Corregido

- Las transformaciones de varias piezas rechazan las colisiones entre sus nuevas huellas.
- Eliminar un mapa solo lo quita de la interfaz si la escritura en el navegador tuvo éxito.
- Un mapa llamado `__proto__` se guarda y se recupera como cualquier otro.

### Pruebas

- Regresiones de las tres fallas y del camino exitoso de eliminación, sin dependencias nuevas.

## 2026-09-24 — PR #40: La documentación, para retomar el proyecto desde cero

[PR #40](https://github.com/jonathancr29/selector-asientos/pull/40), fusionado en `main` con el
commit `2a2877c`.

Rama `claude/documentacion`. No toca `index.html`: solo documentación y dos pruebas nuevas.

Los documentos describían bien **el código** (se auditaron las 572 citas entre acentos graves y solo
una no estaba en el proyecto), pero no decían nada de **cómo se trabaja** ni de **dónde está** el
proyecto, que es justo lo que necesita quien lo retoma.

### Agregado

- **`AGENTS.md` → «Cómo se trabaja en este proyecto»:** una rama y un PR por cambio, el ritual del
  CHANGELOG (de «Sin publicar» a una entrada fechada con su PR y su commit de fusión), y que
  **fusionar solo se hace cuando se pide**.
- **«Cómo editar un archivo de 6.000 líneas»:** guiones de sustitución exacta que fallan si no hay
  una sola coincidencia, `replace` con función y no con cadena, y por qué el guion no se escribe con
  un `heredoc` del shell.
- **«Qué aguanta, medido»** en los dos documentos: los números de un recinto de 18.720 butacas
  (generar ~20 ms, redibujar ~290 ms, elegir una butaca menos de 1 ms, mapa de unos pocos KB), para
  saber qué es normal y qué sería una regresión.
- **«A dónde va esto»:** la integración con Sin Taquilla y el único obstáculo técnico real, su
  `style-src 'self'`, que impide incrustar un `<style>` en línea.
- **Un orden de lectura** al principio de `AGENTS.md` para quien llega de cero.
- **Dos pruebas que vigilan la documentación:** que los topes que citan `README.md` y `AGENTS.md` sean
  los del código, y que no nombren nada que ya no exista. Comprobado con cinco escenarios de deriva
  (subir el aforo, el ancho o la versión del mapa sin tocar el texto, renombrar una función citada y
  citar algo inexistente): las dos pruebas los cazan todos.

### Cambiado

- **«Cómo verificar un cambio»** pasa a contar el listón de verdad: prueba de mutación para cada
  regla nueva de la parte sin DOM, comparación con la versión anterior en los refactors y en los
  cambios con DOM, y desconfiar del reloj del navegador (en una sesión, el mismo redibujado midió
  337 ms y 2.504 ms).
- **«Pendiente»** deja de ser una lista suelta y dice lo que de verdad queda, por orden de valor: no
  rehacer los nodos que no cambian, y partir el archivo en `src/`.

## 2026-09-24 — PR #39: un cuarto de nodos menos en el plano

[PR #39](https://github.com/jonathancr29/selector-asientos/pull/39), fusionado en `main` con el
commit `ca35a43`. La fase barata del render incremental (B2). No cambió nada de lo que se ve ni de
lo que se puede hacer.

### Cambiado

- **La palomita de una butaca solo se crea cuando se ve.** Estaba en las 18.000 butacas libres de un
  recinto grande, oculta por CSS hasta que se elegía: **la cuarta parte de los nodos del plano**. Ahora
  la pone `ponerMarca` al elegir la butaca, y `dibujarButacas` solo la incluye en las ocupadas, las
  bloqueadas y las que ya están marcadas. Con 18.720 butacas, el plano baja de **74.880 a 56.160
  nodos**, exactamente un 25 % menos.
- **Las butacas se injertan de una vez**, armadas en un `DocumentFragment`.

### Medido

Redibujar el plano bajó entre un **13 % y un 23 %** en las mediciones estables (18.720 butacas: 337 →
292 ms; 12.480: 229 → 181 ms; 6.240: 107 → 82 ms). **Por debajo del 30-40 % que se había estimado**, y
la razón está medida: lo que cuesta es *crear* los nodos y ponerles los atributos, no injertarlos, así
que el fragmento aporta poco y la mejora es casi toda el nodo que se dejó de crear. Clonar un molde en
vez de crear cada nodo se probó y daba solo un 12 % más, que no compensaba la complejidad.

**Editar un recinto de 20.000 butacas sigue costando cientos de milisegundos por acción.** Lo único
que cambia eso de orden de magnitud es no rehacer los nodos que no han cambiado, que es la fase cara.

## 2026-09-24 — PR #38: recintos anchos, hasta 300 columnas

[PR #38](https://github.com/jonathancr29/selector-asientos/pull/38), fusionado en `main` con el
commit `05eba4e`. Salió de comprobar si cabía un recinto de 20.000 asistentes: cabía en aforo, pero
no en forma.

### Cambiado

- **La sala llega a 300 columnas** (antes 60), con **de 1 a 20 bloques** (antes 10) de **hasta 60
  butacas** cada uno (antes 40). Con eso `60, 60, 60, 60` y pasillos `3, 3, 3` son 249 columnas y 240
  butacas por fila: la forma de una arena. Con el tope anterior, 20.000 lugares solo cabían en una
  tira de 59 × 348, casi seis veces más alta que ancha.
- **El escenario puede cruzar la sala entera:** su ancho máximo pasa a ser el de la sala.
- **El ancho del lienzo llega a 60 columnas** (antes 40), porque lo topa el tamaño de un bloque.
- **El zoom se acerca lo mismo en cualquier recinto.** El tope salía del encuadre inicial, que se
  estira a la proporción del hueco del plano: cuanto más alto el recinto, más ancho ese encuadre y
  menos acercaba. En un recinto de 20.000 butacas el máximo dejaba **2,6 px por butaca**, ilegible.
  Ahora se topa en celdas y se llega a **40 px por butaca** en cualquier recinto, igual que en la sala
  de ejemplo.

### Agregado

- Prueba de un recinto ancho: 249 columnas, 12.480 butacas, más ancho que alto, con el escenario
  cruzando la sala y la numeración llegando a la butaca 240 de la fila Z.

### Sin cambios

- **El aforo sigue topado en 20.000 lugares.** Subir el ancho cambia la forma del recinto, no cuánta
  gente cabe. Y editar un recinto así sigue costando unos 350 ms por acción: eso es otro asunto (el
  render incremental).

## 2026-09-24 — PR #37: las pruebas ven toda la API sin tener que apuntarla

[PR #37](https://github.com/jonathancr29/selector-asientos/pull/37), fusionado en `main` con el
commit `31ad570`. Cuarto paso de la revisión (B4). Solo tocó `pruebas.mjs`: la aplicación no cambió
en nada.

### Cambiado

- **La API que ven las pruebas se escanea del propio archivo.** `pruebas.mjs` busca las
  declaraciones de la columna 0 de la parte sin DOM y las devuelve todas (227), en lugar de la lista
  de **103 nombres escrita a mano** que había que acordarse de ampliar con cada función nueva. Los
  tres refactors anteriores añadieron dieciséis funciones y ninguna estaba en esa lista.
- **Si el escaneo se rompe, lo dice.** Un aviso salta si encuentra menos de 200 declaraciones (la
  marca se movió, el patrón se rompió) y otro si alguna sentencia declara varios nombres
  (`const a = 1, b = 2;`), que es la única forma de que se dejara algo en silencio.

### Agregado

- Prueba del propio arnés: que no haya nombres repetidos, que la API tenga tantas claves como
  declaraciones encontradas y que una muestra de cada tramo del script esté presente.

## 2026-09-24 — PR #36: la validación del mapa, por partes

[PR #36](https://github.com/jonathancr29/selector-asientos/pull/36), fusionado en `main` con el
commit `52e0592`. Tercer paso de la revisión (B1). No cambia lo que hace la aplicación: se
comprobó comparando la salida con la versión anterior en 679 casos.

### Agregado

- Tres pruebas que cubrían huecos que ya existían: que falte la lista de mesas, que `escenario: null`
  no valga en los mapas anteriores a la versión 3, y que una pieza con el id malo dé **un** error y no
  una cascada.

### Cambiado

- **`validarMapa` pasa de 287 líneas a 66**, y ya no hay ninguna función de más de 100 líneas en el
  archivo. El trabajo se reparte en una función por sección del mapa (`columnasDeMapa`,
  `zonasDeMapa`, `bandasDeMapa`, `mesasDeMapa`, `bloquesDeMapa`, `formasDeMapa`,
  `butacasSueltasDeMapa`, `escenarioDeMapa`, `zonasDeAsientoDeMapa`), más `motivoDeCabecera` para el
  formato y la versión.
- **Un solo recorrido para las cinco listas.** `listaDeMapa` comprueba el id contra su patrón, aparta
  los repetidos y deja que cada sección valide lo suyo. Mesas, bloques, formas, butacas sueltas y
  zonas repetían ese mismo bloque de seis líneas, cada una con su propio `Set` de ids.
- **Un solo cálculo de contador.** Los siete `Math.max(esEntero(...) ? ... : 1, maximo(...) + 1)` del
  montaje del mapa pasan a ser `contador(valor, ids, patron)`.

## 2026-09-24 — PR #35: una sola forma de agregar una pieza

[PR #35](https://github.com/jonathancr29/selector-asientos/pull/35), fusionado en `main` con el
commit `4d7bb7b`. Segundo paso de la revisión (A4). No cambia lo que hace la aplicación.

### Cambiado

- **Las cuatro formas de agregar una pieza comparten camino.** `agregarPiezaNueva` saca el id y el
  contador de `LISTAS_DE_PIEZAS`, busca el primer hueco libre y, si cabe, guarda la pieza y la deja
  seleccionada; `agregarMesaNueva`, `agregarBloqueNuevo`, `agregarButacaNueva` y `agregarFormaNueva`
  se quedan con lo suyo: la configuración de partida, el aviso si no cabe y cómo se cuenta.
- **Ninguna toca ya el contador a mano.** La mesa y el bloque hacían `plano.siguiente++` y
  `plano.bloquesFilas.push(...)` por su cuenta, saltándose `nuevoIdDe`, que las otras dos sí usaban.
  Ahora las cuatro pasan por la misma tabla.
- **Un solo `asegurarVisible`** (`mostrarPiezaNueva`) en lugar de tres versiones, cada una con su
  forma de medir la huella.

## 2026-09-24 — PR #34: integración continua y limpieza del código

[PR #34](https://github.com/jonathancr29/selector-asientos/pull/34), fusionado en `main` con el
commit `3f371e7`. Sale de una revisión completa del proyecto: no cambia lo que hace la
aplicación, solo quita repeticiones y código que ya no pintaba nada.

### Agregado

- **Las pruebas se ejecutan solas** en cada pull request y en cada empujón a `main`
  (`.github/workflows/pruebas.yml`, con `node --test pruebas.mjs`). Ya no depende de acordarse.
- Prueba nueva: el id de una zona nueva **salta los que ya existen** aunque el contador del plano se
  haya quedado corto.

### Cambiado

- **Un solo sitio escribe la venta por mesa.** `marcarVenta` recibe el filtro de qué mesas tocar, y
  `marcarMesaCompleta`, `marcarVentaDeMesas`, `marcarMesasDeBanda` y `marcarTodasLasMesas` pasan a ser
  una línea cada una. Antes el mismo bucle estaba copiado cuatro veces en tres sitios del archivo.
- **Un solo recorrido por área.** `recorrerArea` hace el camino que compartían *Asignar zona* y
  *Bloquear butacas*: butacas del rectángulo, ocupadas apartadas y las que cambiaron de verdad.
- **Una sola forma de estrenar zona.** `zonaNueva` decide el id y el nombre, y la usan tanto
  `agregarZona` como `zonaNuevaParaBanda`, que antes lo resolvían cada una por su cuenta.
- **La paleta de la interfaz vive en `:root`:** 15 variables CSS sustituyen 128 colores escritos a
  mano. Cambiar un color de la aplicación pasa a ser cambiar una línea. Los colores de una sola vez
  (estados de butaca, madera, guías) se quedan donde estaban.

### Corregido

- **«1 butaca bloqueadas.»**: el participio del aviso de las operaciones por área estaba fijo en
  plural. Ahora concuerda, también al desbloquear.

### Quitado

- `cambiarDatoDeBloque`, que no se llamaba desde ningún sitio desde que su trabajo se movió a los
  manejadores del panel.
- Las reglas CSS de `.modos`, `.casilla` y `.separador`: clases que ya no existen en la página desde
  que los modos pasaron a ser iconos. Y un `width: 100%` en el nombre de banda que otra regla
  posterior pisaba, así que nunca llegó a aplicarse.

## 2026-09-24 — PR #33: la flecha de plegar vuelve, y «Pieza seleccionada» pasa a «Editar»

[PR #33](https://github.com/jonathancr29/selector-asientos/pull/33), fusionado en `main` con el
commit `1fcb8dd`.

### Cambiado

- **Los grupos de los laterales vuelven a enseñar su flecha**, delante del título: ▾ abierto y ▸
  cerrado. Seguían siendo plegables, pero el triángulo había desaparecido al poner el título en
  `display: flex` para el botón de información; ahora lo dibuja el CSS, así que se ve igual en todos
  los navegadores.
- El grupo **«Pieza seleccionada» pasa a llamarse «Editar»**.
- El **botón de información** de *Columnas* y *Zonas y precios* se ve como el del encabezado: mismo
  icono, mismo recuadro y el mismo azul cuando está abierto.

## 2026-09-24 — PR #32: la zona es la banda, y el editor cambia de lado

[PR #32](https://github.com/jonathancr29/selector-asientos/pull/32), fusionado en `main` con el
commit `81adf89`.

### Cambiado

- **Una zona y una banda son la misma cosa.** Cada banda nueva nace con **su zona**: color propio,
  nombre a partir de su tipo (*General 2*, *Mesas 2*) y precio 0. Los espacios siguen naciendo sin
  zona, porque un hueco no da precio a nada.
- **El botón de la etiqueta crea una zona nueva con su espacio**, para ponerle nombre y precio y meter
  dentro lo que haga falta. El otro botón de espacio crea el hueco **sin** zona.
- **Un ✓ en cada fila** guarda el nombre y el precio a la vez (Enter y salir del campo siguen
  funcionando).
- **El color es de la zona:** dos bandas que la comparten se ven del mismo color, en el panel y en el
  plano. El nombre de una banda también es el de su zona, así que la zona de mesas de la sala mixta
  pasa a llamarse *Mesas*.
- **Al eliminar una banda se va su zona**, salvo que la use otra banda, una pieza o alguna butaca
  pintada. Las que se quedan sin banda van al final de la misma lista.
- El grupo *Otras zonas* desaparece: todo vive en **«Zonas y precios»**, y el tope sube a **40 zonas**
  porque cada banda trae la suya.
- **Los dos laterales cambian de lado:** a la izquierda la sala (Vista, tipo de sala, Mapa, Columnas,
  Zonas y precios y Leyenda) y a la derecha las piezas (Agregar, Pieza seleccionada y Sala). Al editar,
  la columna ancha es la izquierda.
- **Menos palabras:** *Previsualizar* y *Editar plano* se quedan con su icono, el detalle de una banda
  dice «12 filas» en vez de «12 filas de alto», y el selector de zona de cada fila ya no repite el
  precio, que está en su campo al lado.
- El **tipo de sala** se ve en los dos modos; el resto del grupo *Mapa*, solo al editar.

### Agregado

- **Botón de información (ⓘ)** junto al título de *Columnas* y de *Zonas y precios*: abre y cierra su
  explicación, que ya no ocupa sitio.

## 2026-09-23 — PR #31: transformar, zona y venta con varias piezas

[PR #31](https://github.com/jonathancr29/selector-asientos/pull/31), fusionado en `main` con el
commit `1af8bca`.

### Agregado

- **Girar, alargar, acortar, cabeceras y los lados funcionan con varias piezas a la vez.** Cada una
  cambia sobre su propio sitio y es todo o nada; si el grupo transformado no cabe donde está, se
  desplaza **entero** unas celdas para caber y se avisa.
- Una acción de grupo solo se ofrece si **todas** las seleccionadas la admiten: con una mesa y un
  bloque juntos, girar sí y cabeceras no.
- **Zona y venta en grupo:** los dos selectores aplican a todas las seleccionadas. Cuando no
  coinciden lo dicen —«— varias zonas —» y «Venta mixta»— y al elegir una opción todas quedan igual.
- Un **clic seco** en una pieza del grupo deja seleccionada solo esa, para salir de la selección
  múltiple sin ir al fondo.

### Cambiado

- El **nombre** no se edita con varias piezas seleccionadas: es de cada pieza, y el campo lo dice.

## 2026-09-23 — PR #30: selección múltiple de piezas

[PR #30](https://github.com/jonathancr29/selector-asientos/pull/30), fusionado en `main` con el
commit `efa9758`.

### Agregado

- **Marquesina:** en el editor, arrastrar el fondo dibuja un rectángulo con el número de piezas que
  abarca y selecciona lo que atrapa. Entra la pieza que quede con **la mitad o más** de su huella
  dentro. Con **Ctrl** (o Cmd) se suman a las que ya estaban.
- **Ctrl+clic** en una pieza la mete o la saca de la selección. Un clic normal en una que ya está
  seleccionada no deshace el grupo: pasa a ser la principal.
- **Mover el grupo** arrastrando cualquiera de sus piezas o con las flechas. Es **todo o nada**: si
  una sola no cabe, no se mueve ninguna y el aviso dice cuál estorba; la sombra, que ahora muestra el
  grupo entero, se pone roja en cuanto una no cabe.
- **Duplicar (Ctrl+D)** el grupo conservando las distancias entre sus piezas, y **eliminar (Supr)**
  todas. Las copias quedan seleccionadas.

### Cambiado

- Con varias piezas seleccionadas, las transformaciones de una sola (girar, alargar, cabeceras…)
  quedan desactivadas y el panel dice cuántas hay.
- En el editor, arrastrar el fondo ya no mueve el plano: el plano se mueve con la barra espaciadora,
  el botón central o dos dedos, igual que con las herramientas de butacas. Un clic seco en el fondo
  sigue seleccionando bandas.
- El escenario no entra en la selección múltiple: es único y no se duplica ni se elimina.

## 2026-09-23 — PR #29: redimensionar espacios y verticales con el ratón

[PR #29](https://github.com/jonathancr29/selector-asientos/pull/29), fusionado en `main` con el
commit `4e93390`.

### Agregado

- **Tiradores en el plano.** Cada espacio y cada zona de mesas lleva un agarre en su esquina inferior
  derecha, y el borde entre dos bandas verticales, una franja de agarre a lo alto.
- El tirador de la esquina cambia el **alto** de su banda y, si está dentro de una vertical que no es
  la última, también el **ancho** de esa vertical: las dos medidas en el mismo gesto. El del borde
  reparte las columnas entre verticales.
- Va de celda en celda y **no aplica nada hasta soltar**: mientras se arrastra solo se ve el tamaño que
  tendría, con su medida, y **Esc** cancela. Al soltar pasa por la comprobación de siempre, así que un
  cambio que deja una mesa sin caber se revierte y se explica.
- Los topes no se pueden pasar ni con el fantasma: de 1 a 40 filas de alto y al menos una columna para
  la última vertical.
- Un clic sin arrastrar en un tirador selecciona su banda. Los botones − / + del panel siguen siendo
  el camino con teclado.

## 2026-09-23 — PR #28: asignar zona y bloquear por área

[PR #28](https://github.com/jonathancr29/selector-asientos/pull/28), fusionado en `main` con el
commit `cedde17`.

### Agregado

- **Pintar un área en vez de butaca por butaca.** Con *Asignar zona* o *Bloquear butacas*, arrastrar
  sobre el plano dibuja un rectángulo con el número de butacas que abarca y, al soltar, se aplica a
  todas las libres de dentro. Con **Alt** se deshace: vuelven a su zona de siempre, o se desbloquean.
- **Con el teclado:** Mayús + flechas extienden el área desde la butaca enfocada, Enter la aplica,
  Alt+Enter la deshace y Esc la cancela.
- Las **butacas ocupadas** del área no cambian y se dicen en el aviso; si una mesa que se vende
  completa queda con lugares de dos zonas, también se avisa.

### Cambiado

- Con esas dos herramientas, **el arrastre es del rectángulo**: el plano se mueve con la barra
  espaciadora, el botón central del ratón o dos dedos. Por lo mismo, la barra espaciadora ya no marca
  la butaca enfocada mientras están activas; Enter es lo que aplica.
- Las pistas de las dos herramientas explican el área y cómo desplazar el plano.

## 2026-09-23 — PR #27: un solo panel, bandas con su precio

[PR #27](https://github.com/jonathancr29/selector-asientos/pull/27), fusionado en `main` con el
commit `cc22e7a`.

### Cambiado

- **El panel de bandas es el de las zonas.** Cada fila lleva el nombre, el **precio por lugar** y la
  zona de su banda, así que ya no hay dos listas que mantener. El grupo pasa a llamarse *Bandas y
  precios*.
- **El nombre de una banda con zona propia es el de su zona:** cambiarlo cambia las etiquetas de sus
  butacas. Si comparte zona con otra banda, vuelve a ser su nombre propio.
- **Compartir o separar zonas desde la fila:** elegir la zona de otra banda las hace compartir precio
  y numeración; *Zona nueva…* le da una propia, con su nombre y a $0. Un espacio o una franja puede
  quedarse *Sin zona*.
- **Otras zonas** es el grupo que queda para las zonas que no son de ninguna banda (la de una pieza
  con zona propia, las pintadas con *Asignar zona* y las que no usa nadie). Aparece vacío cuando todas
  son de una banda.
- **Venta por mesa o por butacas:** la casilla «Vender como mesa completa» pasa a ser un selector
  **Venta** con las dos opciones, y las zonas de mesas tienen el suyo en su fila para cambiar de golpe
  todas sus mesas (*Venta mixta* cuando no coinciden). Sigue estando «Aplicar a todas las mesas».
- **La mesa y sus lugares son una sola pieza:** al seleccionar una mesa, un bloque o una butaca suelta
  en el editor, sus butacas se marcan con ella.

## 2026-09-23 — PR #26: la zona se hereda de la banda

[PR #26](https://github.com/jonathancr29/selector-asientos/pull/26), fusionado en `main` con el
commit `b69215e`.

### Cambiado

- **Cada banda le da su zona, y con ella su precio, a lo que cae dentro:** mesas, bloques de filas y
  butacas sueltas. Las zonas de mesas, los espacios, las franjas y las bandas verticales pueden llevar
  su zona; antes solo las bandas de filas.
- **Orden de precedencia:** la zona pintada en la butaca, la propia de la pieza, la de la banda más
  interna que la contiene y, si no hay ninguna, la que el editor le escribe.
- Los lugares de mesa dejan de estar atados a la zona «Mesas»: toman la de su banda, y una mesa puede
  llevar la suya desde *Pieza seleccionada*, que ahora también funciona con mesas y ofrece
  «Hereda: ⟨zona⟩».
- Una pieza que queda fuera de toda banda con zona recibe la suya y se dice en el aviso: ninguna
  butaca se guarda sin precio.
- La etiqueta de un lugar de mesa dice siempre su zona: *«Mesa 1, lugar 2, Luneta»*.
- Las piezas nuevas (mesa, bloque, butaca suelta) nacen heredando, en vez de nacer en *General*.
- `usosDeZona` cuenta las bandas por su zona efectiva y las piezas con zona propia, mesas incluidas.

### Formato de mapa

- **Versión 4:** `zona` es opcional en mesas, bloques y butacas sueltas, y las bandas que no son de
  filas pueden llevarla. Los mapas de la versión 3 se leen igual; sus mesas pasan a heredar la zona de
  su banda, que es la de mesas.

## 2026-09-18 — PR #25: hojas de información y pie en una barra

[PR #25](https://github.com/jonathancr29/selector-asientos/pull/25), fusionado en `main` con el
commit `da7e0b6`.

### Cambiado

- **Encabezado:** el título con un botón de información (ⓘ) y el aforo; ya no lleva plegables.
- **Hojas de información** que se abren con ⓘ sobre el plano y se recorren como diapositivas:
  «Qué es», «Cómo se usa» y «Notas». Flechas ‹ ›, puntos y flechas del teclado; se cierran con ⓘ, ✕,
  Esc o un clic en el plano. Solo se abren al pulsar.
- **Pie en una sola barra fija:** mensajes y avisos a la izquierda; resumen y un botón ▲ que despliega
  hacia arriba el detalle de las butacas elegidas.
- **Lateral izquierdo:** el tipo de sala arriba, después *Vista* y las herramientas del editor, y la
  *Leyenda* al final.
- Iconos nuevos de Material Symbols (info, flecha arriba, anterior, siguiente y cerrar) en `NOTICE`.

## 2026-09-18 — PR #24: asignar zona a cada asiento

[PR #24](https://github.com/jonathancr29/selector-asientos/pull/24), fusionado en `main` con el
commit `db1037a`.

### Añadido

- **Asignar zona:** herramienta en el grupo *Sala*, con un selector de zona. Un clic (o Enter) en una
  butaca le asigna la zona elegida; otro la devuelve a la suya. Vale para filas, bloques, butacas
  sueltas y lugares de mesa, así que cada asiento puede tener su precio.
- La numeración no cambia: una butaca de Luneta pintada de VIP se vende como «VIP, fila A, butaca 3».
  Un lugar de mesa dice su zona («Mesa 1, lugar 1, VIP»).
- Las butacas ocupadas no cambian de zona; una zona asignada a algún asiento no se puede eliminar.
- Los mapas guardan y validan `zonasDeAsiento`; duplicar piezas y bandas copia las asignaciones.
- Pruebas de asignar y devolver zona, lugares de mesa y mesas completas, zonas en uso, duplicar y
  mapas (111 en total).

## 2026-09-18 — PR #23: mesas completas

[PR #23](https://github.com/jonathancr29/selector-asientos/pull/23), fusionado en `main` con el
commit `6b601c8`.

### Añadido

- **«Vender como mesa completa»:** casilla por mesa en *Pieza seleccionada*, y botón **«Aplicar a
  todas las mesas»**. Lo decide el organizador.
- **En Previsualizar, una mesa completa se elige entera:** un clic en la mesa o en cualquiera de sus
  lugares elige (o suelta) todos sus lugares libres, y el tablero se marca con ellos.
- **Precio:** la suma de sus lugares libres, cada uno al precio de su zona. Los lugares bloqueados no
  se venden ni se cobran.
- Una mesa completa con algún lugar ocupado sale ocupada entera.
- Al marcar completa una mesa con parte de sus lugares elegidos, se eligen todos y se avisa.
- El resumen dice «mesa completa», y cada lugar lo anuncia en su etiqueta.
- Los mapas guardan y validan `completa` en las mesas; los anteriores se leen como venta por lugares.
- Pruebas de marcar mesas, elección conjunta, bloqueados, ocupados, selección parcial y mapas (107 en
  total).

## 2026-09-18 — PR #22: sillas de la mesa redonda por parejas

[PR #22](https://github.com/jonathancr29/selector-asientos/pull/22), fusionado en `main` con el
commit `74375a1`.

### Cambiado

- **Las sillas de una mesa redonda van por parejas en cada lado**, sin usar las esquinas: la de 8
  lugares es un tablero de 2 celdas con dos sillas por lado (huella 4 × 4).
- **Los lugares crecen de dos en dos** (2 a 16, siempre par) y el tablero crece con ellos: 1 celda
  hasta 4 lugares, 2 hasta 8, 3 hasta 12 y 4 hasta 16.
- Los mapas validan que los lugares de una mesa redonda sean pares.

## 2026-09-17 — PR #21: mesas redondas

[PR #21](https://github.com/jonathancr29/selector-asientos/pull/21), fusionado en `main` con el
commit `cb522fd`.

### Añadido

- **Mesa redonda:** botón nuevo en «Agregar», con 8 lugares. Se describe solo con sus lugares (2 a
  16) y el diámetro del tablero sale de ahí: 1 celda hasta 8 lugares, 2 hasta 12 y 3 hasta 16.
- Los lugares se reparten por ángulo en el anillo que rodea al tablero, mirando al centro; los de las
  esquinas, en diagonal. Sus ids son la posición (`M7-1`, `M7-2`…), así que girar o mover no los
  cambia.
- **Alargar y Acortar** ponen y quitan lugares; **Girar** mueve el reparto alrededor del anillo.
- El tablero se dibuja como un círculo, y la sombra del arrastre también.
- Los mapas guardan y validan las mesas redondas (`tipo: 'redonda'` y `lugares`); los mapas
  anteriores se siguen leyendo.
- Pruebas de geometría, topes, huella y pasillos, plano y mapas (102 en total).

### Corregido

- **Las marcas de estado** (palomita, aspa, raya) solo giran en los lugares a 90° y 270°; en los
  diagonales se quedan derechas.

## 2026-09-17 — PR #20: escritorio de una sola pantalla

[PR #20](https://github.com/jonathancr29/selector-asientos/pull/20), fusionado en `main` con el
commit `0a61a97`.

### Cambiado

- **En escritorio (más de 900 px de ancho y 600 px de alto), la página no se desplaza:** laterales,
  encabezado y pie fijos, y el plano llena el hueco entre ellos. Solo se desplaza el interior de un
  lateral cuando su contenido no cabe.
- **Los plegables se abren sobre el plano:** el del encabezado baja y el del pie sube, con fondo y
  sombra, sin mover el plano ni cambiar su tamaño. Se cierran con su flecha, con Esc o al hacer clic
  en el plano.
- **El pie** lleva el resumen siempre a la vista y, dentro del plegable «Butacas elegidas y notas»,
  el detalle de la selección y las notas del proyecto. El estado sigue en su línea, encima del pie.
- **El alto del plano lo da el CSS:** `ajustarAltoDelPlano` ya no calcula restas y el encuadre se
  adapta a la caja del `<svg>` en todos los casos.
- Por debajo de 900 px de ancho o 600 px de alto se mantiene el diseño con scroll de página.

## 2026-09-17 — PR #19: textos de referencia plegables

[PR #19](https://github.com/jonathancr29/selector-asientos/pull/19), fusionado en `main` con el
commit `4952450`.

### Añadido

- **«Qué es y cómo se usa»** en el encabezado (descripción e instrucciones) y **«Notas del
  proyecto»** en el pie se pliegan con su flecha. Las notas empiezan cerradas.
- Al plegar o desplegar, el plano se reencuadra: con las instrucciones cerradas gana su alto (de 697
  a 753 px en una pantalla de 900).

## 2026-09-17 — PR #18: iconos y campos del panel de configuración

[PR #18](https://github.com/jonathancr29/selector-asientos/pull/18), fusionado en `main` con el
commit `278d75b`.

### Cambiado

- **Columnas:** «Butacas por bloque» y «Anchos de pasillo» van en su propia línea, con etiquetas
  alineadas y campos más cortos, y «Aplicar» pasa a un icono ✓. Igual el ancho del lienzo.
- **Botones del panel con icono** y tooltip, como en la barra de herramientas: mapa (guardar,
  exportar, importar, eliminar), zonas (eliminar, agregar zona), bandas (quitar y agregar fila,
  subir, bajar, duplicar, eliminar, guías), verticales (ancho, mover, agregar filas, mesas o
  espacio) y agregar banda de filas, zona de mesas, espacio o franja.
- **Filas del panel más compactas:** cada zona cabe en una línea (nombre, precio y papelera) y cada
  banda en dos (nombre y detalle arriba; los controles debajo).
- Iconos nuevos de Material Symbols (añadidos a `NOTICE`) y propios para guías de fila y los cuatro
  de agregar banda.

## 2026-09-17 — PR #17: previsualizar ajustado a la pantalla

[PR #17](https://github.com/jonathancr29/selector-asientos/pull/17), fusionado en `main` con el
commit `7fafcab`.

### Cambiado

- **En Previsualizar, el plano se ve completo:** ocupa el alto de la pantalla bajo el encabezado, con
  la línea de estado a la vista, y el encuadre toma la proporción del plano para no dejar franjas.
- **Al cambiar el tamaño de la ventana** se reajusta conservando el zoom y el centro.
- En el editor y en pantallas de menos de 900 px, el alto sigue saliendo del ancho.

## 2026-09-17 — PR #16: menús laterales

[PR #16](https://github.com/jonathancr29/selector-asientos/pull/16), fusionado en `main` con el
commit `14c8de4`.

### Cambiado

- **Lateral izquierdo sticky** con las herramientas: leyenda, vista (modo, zoom, tipo de sala) y, en
  el editor, agregar, pieza seleccionada y sala. Iconos en rejilla.
- **Lateral derecho sticky**, solo en el editor, con la configuración: mapa, columnas, zonas y
  precios, y bandas.
- **Grupos plegables** en los dos laterales.
- **Encabezado** con título, bajada, instrucciones y aforo; **pie** con el resumen y las notas.
- **Línea de estado fija** al pie del plano para los mensajes y avisos.
- **Pantallas de menos de 900 px:** herramientas arriba del plano y configuración debajo, sin sticky.
- **Tooltip** colocado por el script con `position: fixed`, a la derecha del icono: no lo recorta el
  scroll del lateral y también sale sobre botones desactivados.
- **Bandas:** la fila seleccionada ya no dice «● seleccionada»; la marca el borde de su color.

### Corregido

- **El subtítulo de la página se veía diminuto:** compartía la clase `.subtitulo` con los nombres de
  banda del SVG (letra de 4 px). Ahora es `.bajada`.

## 2026-09-17 — PR #15: iconos en las barras

[PR #15](https://github.com/jonathancr29/selector-asientos/pull/15), fusionado en `main` con el
commit `4ff01df`.

### Cambiado

- **Botones de icono** en la barra de modo y zoom y en la del editor: zoom, ajustar, bloquear
  butacas, agregar (mesas de lados, cruz y un lado, bloque, butaca suelta, pista y barra), acciones
  de la pieza (girar, alargar, acortar, agregar y quitar fila, cabeceras, un solo lado, duplicar,
  eliminar), escenario y restablecer. Botones de 32 × 32 px en lugar de texto.
- **Previsualizar y Editar plano** llevan icono y texto. Tipo de sala, Zona y Nombre, un icono como
  etiqueta.
- **Tooltip visible** con nombre y atajo al pasar el ratón o al llegar con Tab; el nombre completo
  sigue en `aria-label`.
- Iconos de Material Symbols (Apache 2.0, añadidos a `NOTICE`) y propios para mesas, bloque,
  pista, filas, cabeceras, un solo lado, bloquear y escenario, dibujados como en el plano.

## 2026-09-17 — PR #14: zonas y precios editables

[PR #14](https://github.com/jonathancr29/selector-asientos/pull/14), fusionado en `main` con el
commit `903c404`.

### Añadido

- **Zonas y precios** en el panel del editor: cambiar el nombre y el precio de cada zona, agregar
  zonas nuevas (hasta 20) y eliminar las que no se usan. La zona de mesas siempre existe.
- Cada sala o mapa guarda sus zonas: Guardar, Exportar e Importar JSON las incluyen, y
  `validarMapa` las comprueba (ids, nombres sin repetir, precios, zona de mesas y al menos una para
  filas). Los mapas sin zonas usan Luneta, Mesas y General.
- Los selectores de zona de bandas, bloques y butacas sueltas muestran todas las zonas de filas.
- Pruebas de editar, agregar y eliminar zonas, lectura de precios y mapas con zonas (98 en total).

## 2026-09-17 — PR #13: franja nueva sin filas

[PR #13](https://github.com/jonathancr29/selector-asientos/pull/13), fusionado en `main` con el
commit `7534c94`.

### Cambiado

- **«Agregar franja con bandas verticales»** crea dos verticales con un espacio vacío de 4 filas cada
  una, sin butacas. Antes traía una zona de mesas a la izquierda y dos filas de General a la derecha.
- Prueba de la franja nueva (94 en total).

## 2026-09-17 — PR #12: rendimiento de la numeración y topes

[PR #12](https://github.com/jonathancr29/selector-asientos/pull/12), fusionado en `main` con el
commit `bab9619`. Sale de una revisión externa del commit `159ef63`.

### Corregido

- **Numerar las filas era cuadrático:** `numerarFilas` filtraba las butacas por cada altura y buscaba
  la de cada rótulo recorriéndolas todas. Con 104.000 butacas tardaba 6,4 s y ahora unos 65 ms, con
  la misma numeración (comparada en los 7 tipos de sala, con y sin escenario). Se notaba desde unas
  15.000 butacas en cada acción del editor y al abrir la página con un mapa grande guardado.
- **Filas después de la ZZ:** `letraDeFila` daba «undefined» a partir de la fila 703 de una zona;
  ahora sigue con AAA, AAB…

### Añadido

- **Aforo máximo de 20.000 butacas:** el editor no aplica un cambio que lo supere y lo explica, y
  `validarMapa` rechaza los mapas que lo pasan.
- **Archivos de más de 1 MB** no se importan.
- Pruebas: numerar 104.000 butacas por debajo de 1,5 s, tope de aforo y filas AAA (93 en total).

## 2026-09-16 — PR #11: butacas sueltas y formas (fase B)

[PR #11](https://github.com/jonathancr29/selector-asientos/pull/11), fusionado en `main` con el
commit `159ef63`.

### Añadido

- **Butaca suelta:** una butaca que se coloca en cualquier hueco, gira de 90 en 90, cambia de zona y
  se duplica. Se numera con las demás butacas de su zona.
- **Pista de baile y barra:** formas con nombre que ocupan sus celdas, sin lugares. Se mueven,
  giran, cambian de ancho y alto, se renombran y se duplican. La pista con cuadros; la barra como
  mostrador.
- Duplicar o eliminar una banda copia o quita también sus butacas sueltas y formas.
- Los mapas (versión 3) guardan y validan `formas` y `butacasSueltas` con sus contadores.
- Pruebas de numeración de butacas sueltas, celdas y giro de formas, duplicar, bandas y mapas (91 en
  total).

### Cambiado

- **Girar junto a un borde:** si una pieza girada se saldría de la sala, se prueba metida dentro
  (antes solo a una celda de distancia).
- Las listas de piezas (mesas, bloques, formas y butacas sueltas) se recorren con una sola tabla,
  `LISTAS_DE_PIEZAS`.

## 2026-09-16 — PR #10: mapa en blanco (fase A)

[PR #10](https://github.com/jonathancr29/selector-asientos/pull/10), fusionado en `main` con el
commit `f276b20`.

### Añadido

- **«Mapa en blanco»** en el selector de tipo de sala (grupo *Nuevo*): un lienzo de 20 × 10 sin
  escenario, filas ni mesas, que se abre en el editor y se guarda con nombre en «Mis mapas».
- **Ancho del lienzo** ajustable (1 a 40 columnas) desde el panel. El lienzo no tiene pasillos: el
  pasillo es el hueco entre piezas.
- **Banda «Espacio»:** una banda vacía con su alto, para llenarla con piezas; «Agregar espacio» y
  «+ espacio» dentro de las verticales.
- **Guías de fila** en los espacios: letras de referencia (A, B, C…) que no son butacas.
- **Escenario opcional** en cualquier sala: «Quitar escenario» / «Agregar escenario» (en el primer
  hueco libre). Sin escenario, las filas miran hacia arriba y se numeran desde arriba.
- **Mapas versión 3:** `lienzo`, `escenario: null` y bandas `espacio`; el escenario deja de ser banda
  obligatoria. Las versiones 1 y 2 se siguen leyendo.
- Pruebas del lienzo, espacios y guías, numeración sin escenario, agregar escenario, ancho del
  lienzo y mapas versión 3 (86 en total).

## 2026-09-16 — PR #9: duplicar, nombres y capas de bandas

[PR #9](https://github.com/jonathancr29/selector-asientos/pull/9), fusionado en `main` con el
commit `a5d686c`.

### Añadido

- **Duplicar mesas y bloques de filas:** botón «Duplicar» y Ctrl+D (Cmd+D). La copia, con id nuevo,
  va a la derecha del original, debajo o al sitio libre más cercano, y queda activa.
- **Duplicar bandas, verticales y franjas** desde el panel o con Ctrl+D sobre la banda seleccionada:
  la copia va justo debajo (o a la derecha, si es una vertical) con todo lo de dentro: bandas,
  mesas y bloques, con ids nuevos. Se copian las butacas bloqueadas, nunca la ocupación; los nombres
  propios llevan «(copia)».
- **Subtítulos con el nombre de cada banda** en el plano, también al previsualizar: en el margen las
  bandas de la sala y en una etiqueta sobre su borde las verticales y sus bandas.
- **Nombre editable** de bandas, verticales y franjas en el panel (vacío vuelve al de por defecto);
  doble clic en un subtítulo lleva al campo. La etiqueta de las butacas sigue siendo la de su zona.
- **Capas con color propio:** cada banda, vertical y franja tiene su color (muestra en el panel). Al
  seleccionarla, contorno continuo y grueso de ese color, su nombre en una etiqueta rellena en el borde
  inferior, por encima de todo lo demás, y fila del panel marcada.
- **Seleccionar bandas en el plano:** clic en el fondo selecciona la banda de debajo; otro clic, la
  que la contiene. En el panel, tocar un control de una banda la selecciona.
- Pruebas de duplicar piezas y bandas (colocación, ids, bloqueadas, piezas de dentro, anchos de
  verticales), renombrar, subtítulos y selección por celda (80 en total).

### Cambiado

- **Cambiar la zona de una banda ya no borra su nombre propio;** el de por defecto sigue a la zona.
- **Los nombres propios de las bandas** se conservan desde la sala generada (`nombrePropio`), no solo
  los de la plantilla.

## 2026-09-16 — PR #8: bandas verticales (fase 3)

[PR #8](https://github.com/jonathancr29/selector-asientos/pull/8), fusionado en `main` con el
commit `0580e38`.

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
