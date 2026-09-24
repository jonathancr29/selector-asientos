# AGENTS.md

Guía para asistentes de IA (y personas) que trabajen en este proyecto. Para qué hace y por qué,
lee primero [README.md](README.md). Para el historial de cambios, [CHANGELOG.md](CHANGELOG.md).

## Qué es

Un selector de asientos: plano de butacas interactivo en SVG, en **un solo archivo HTML**, sin
dependencias, sin paso de compilación y sin framework. Filas numeradas, mesas y zona general
conviven en el mismo plano. Tiene dos modos: **Previsualizar** (elegir butacas, como quien compra)
y **Editar plano** (mover, girar, alargar, agregar y eliminar mesas, editar las bandas de la
sala y bloquear butacas). Los diseños se guardan con nombre en el navegador o como archivos JSON. Hay salas mixtas, solo filas y solo mesas.

Es solo la capa visual: no hay servidor, reservas ni pagos. La ocupación del ejemplo está escrita
en el propio archivo.

## Archivos

| Archivo | Contenido |
|---|---|
| `index.html` | Toda la aplicación: HTML, CSS y el `<script>`. |
| `pruebas.mjs` | Pruebas con `node:test` de la parte del script que no usa el DOM. |
| `README.md` | Qué resuelve, modelo de datos, rejilla, accesibilidad, modo editor. |
| `CHANGELOG.md` | Historial de cambios. |
| `LICENSE`, `NOTICE` | MIT. El icono de butaca es de Material Icons (Apache 2.0). |

La carpeta `.claude/` (si existe) es de trabajo de Claude Code y no forma parte del proyecto.

## Cómo ejecutar y probar

- **Abrir:** `index.html` directamente en el navegador. Opcional: `python -m http.server 8000`.
- **Pruebas:** `node --test pruebas.mjs` (Node 18 o posterior). Deben pasar todas antes de hacer commit.
- **Integración continua:** `.github/workflows/pruebas.yml` corre esas mismas pruebas en cada pull
  request y en cada empujón a `main`. Es lo único que corre: si añades otra comprobación, que no
  necesite dependencias.
- **No hay** `package.json`, linter ni build. No los añadas sin que se pida.

## Cómo está organizado el script

El `<script>` de `index.html` va en este orden. Las secciones están separadas por comentarios
`// ----`.

1. **Constantes:** `PASO` (12 unidades del viewBox por celda), `GLIFO`, `ANCHO_SALA` (14 columnas).
2. **Rejilla:** `rejillaDeBloques({ bloques, pasillos })` devuelve `ancho`, `bloques` y `columnas`. Es
   la **única fuente de verdad** de las columnas. `distribucionDePasillos` convierte las disposiciones
   con nombre de las plantillas ('ambos'...) y `rejillaDeSala` es el atajo para ellas;
   `distribucionDeSala` hace el camino inverso. `motivoDistribucion` y `leerDistribucion` validan y
   leen lo que se escribe en el editor. `repartirMesas` coloca mesas dentro de los bloques.
3. **Datos y tipos de sala:** `zonas` (índice de la sala generada), `ZONAS_POR_DEFECTO`, `usarZonas`,
   `zonaParaFilas`, `zonaDeMesasActual`, `zonaDeBanda` (zona efectiva de una banda), `butacas`,
   `muebles`, `TIPOS_DE_SALA` (pasillos y bandas de cada tipo), `altoDeBanda`, `agregarFilas`.
4. **Mesas:** `geometriaMesa({ largo, cabeceras, unLado, giro })` calcula huella, tablero y lugares,
   cada uno con `mira` (giro del icono hacia el tablero); `girar90` da el cuarto de vuelta.
   `ESTILOS` (lados, cruz, barra), `agregarMesa`, `mesasAutomaticas`. `generarPlano(tipo, plano)`
   apila las bandas y rellena `butacas`, `muebles` y `mesas`; la sala devuelta trae `bandas` (con
   `y`, `alto` y `nombre`), `alto` y `filas` (rango de filas de rejilla donde caben mesas).
   **Escenario:** `escenario` (pieza `{ x, y, ancho, alto }`), `centroDelEscenario`, `miraHaciaEscenario`,
   `miraDeFrente`, `giroHaciaEscenario`, `girarEscenario`, `cambiarTamanoEscenario`, `configDeEscenario`.
   **Bloques de filas:** `geometriaBloqueFilas`, `agregarBloqueFilas`, `huellaDe` (huella de cualquier
   pieza), `numerarFilas` (etiquetas por zona) y `letraDeFila`.
5. **Editor sin DOM:** `celdasOcupadas`, `motivoNoCabe`, `buscarHueco`, `colocarCerca`, `girarPieza`,
   `anclarTablero`, `cambiarLargo`, `alternarCabeceras`, `alternarUnLado`, `anclarPrimeraButaca`,
   `cambiarAncho`, `cambiarFilasBloque`, `buscarSitioLibre`, `primeraPiezaQueNoCabe`. Reciben y
   devuelven configuraciones de pieza (mesa `{ id, x, y, largo, cabeceras, unLado, giro }` o bloque
   `{ id, tipo: 'filas', x, y, ancho, filas, zona, giro, nombre? }`); nunca modifican la actual.
   **Bandas y columnas:** `planoDesdeSala`, `cambiarDistribucion`, `redimensionarBanda`, `moverBanda`, `eliminarBanda`, `agregarBanda`,
   `cambiarZonaBanda`, `zonaExclusivaDeBanda`, `zonaNueva`, `zonaNuevaParaBanda`, `agregarZona`, `editarZona`, `eliminarZona`, `usosDeZona`, `leerPrecio`, `agregarVertical`, `cambiarAnchoVertical`, `agregarBandaEnVertical`,
   `renombrarBanda`, `duplicarBanda` y `duplicarPieza`. Devuelven un plano nuevo o `{ motivo }`.
   **Butacas sueltas y formas:** `agregarButacaSuelta`, `configDeButaca`, `agregarForma`,
   `configDeForma`, `cambiarTamanoForma` y `FORMAS`. `LISTAS_DE_PIEZAS` (lista, prefijo y contador de
   cada tipo), `listaDeId` y `nuevoIdDe`.
   **Lienzo y escenario opcional:** `cambiarAnchoLienzo`, `alternarGuias`, `agregarGuias`,
   `quitarEscenario`, `agregarEscenario` y `tieneAlto` (mesas y espacios guardan su alto).
   **Capas y subtítulos:** `capasDe` (orden de color), `bandaEnCelda` (selección por clic),
   `agregarSubtitulos` (muebles `subtitulo`), `copiarBloqueadas` y `sitioParaCopia`.
   **Árbol de bandas:** `disponerBandas` (coloca el árbol y devuelve bandas colocadas, regiones y error),
   `hojasDe`, `ubicar`, `idsDentro`, `copiarBandas`, `columnasDeBanda` y `reanclarPiezas`.
   **Varias piezas:** `piezasEnMarco` (la regla de la mitad), `cajaDePiezas`, `moverPiezas` (todo o
   nada), `duplicarPiezas` (conserva las distancias), `eliminarPiezas`, `aplicarConfigs` (transformar
   varias, con desplazamiento comun si hace falta), `cambiarZonaDePiezas` y `marcarVentaDeMesas`.
   **Tiradores:** `tiradoresDeSala` (donde va cada agarre) y `redimensionarConTirador` (aplica el
   alto de la banda y el ancho de su vertical de una vez, o ninguno).
   **Areas:** `areaDeCeldas` (rectangulo con las esquinas en cualquier orden), `butacasEnArea`,
   `recorrerArea` (el recorrido comun), `asignarZonaEnArea`, `bloquearEnArea` y
   `mesasConZonasMezcladas`.
   **Bloqueos y mapas:** `idsBloqueadosPorBandas`, `alternarBloqueada`, `mapaDesdePlano`,
   `validarMapa`, `definicionDeMapa`, `registrarMapa`, `claveDeMapa`, `nombreDeArchivo`.
   **Validacion del mapa, por partes:** `motivoDeCabecera` (formato y version), `listaDeMapa` (el
   recorrido con id y repetidos), `listaOpcionalDeMapa`, y una por seccion: `columnasDeMapa`,
   `zonasDeMapa`, `bandasDeMapa`, `mesasDeMapa`, `bloquesDeMapa`, `formasDeMapa`,
   `butacasSueltasDeMapa`, `escenarioDeMapa` y `zonasDeAsientoDeMapa`.
6. **Selección sin DOM:** `elegidas` (un `Set` de ids) y `conciliarSeleccion`.
7. **Marca `// === Fin de la parte sin DOM`.** `pruebas.mjs` evalúa en Node todo lo anterior a
   esta línea.
8. **Render:** `dibujarMuebles` (con límites de banda en el editor), `dibujarButacas`, `dibujarPiezas`,
   `dibujarTodo`, y el panel de bandas: `dibujarBandas`, `aplicarBandas`.
9. **Zoom y desplazamiento:** mueven el `viewBox` (`vista`, `aplicarVista`, `escalar`), con rueda,
   punteros (arrastre y pellizco) y botones.
10. **Selección y teclado:** `alternar`, `moverFoco`, `asegurarVisible`, manejadores `focusin` y
    `keydown`.
11. **Modo editor:** `modo`, `mesaActiva`, `planos` (por tipo de sala), sombra de destino, arrastre, `regenerar`,
    `transformarMesa`, `agregarPiezaNueva` (con `agregarMesaNueva`, `agregarBloqueNuevo`,
    `agregarButacaNueva` y `agregarFormaNueva`), `eliminarMesa`, atajos (`ATAJOS`), `cambiarModo`,
    `herramienta` (mesas o bloquear), `cambiarHerramienta`, `alternarBloqueo`.
12. **Resumen y cambio de tipo de sala:** `actualizarResumen`, `actualizarAforo`, `redibujar`, y el
    selector de tipos, que se construye desde `TIPOS_DE_SALA` (`construirSelector`).
13. **Mapas guardados:** `leerAlmacen`, `escribirAlmacen` (`localStorage`), `guardarMapa`,
    `exportarMapa`, `importarMapa`, `eliminarMapa`, y la carga de mapas guardados al abrir.

## Reglas que no se deben romper

- **Un solo archivo, sin dependencias.** Nada de librerías, CDN, módulos ES ni build. Tiene que
  abrirse con doble clic.
- **Los datos mandan; el SVG se genera.** Nunca se guarda ni se lee estado del SVG. La selección es
  `elegidas` (ids) y las mesas editadas son `planos`: el DOM los refleja, no los contiene.
- **Nada del DOM antes de la marca «Fin de la parte sin DOM».** Si una función de esa parte usa
  `document`, `svg` o similares, las pruebas fallan al evaluarla en Node.
- **Cada tipo de sala define sus pasillos y sus bandas.** Para una sala nueva, agrega una entrada a
  `TIPOS_DE_SALA`; el selector la muestra solo.
- **Toda columna sale de `rejillaDeBloques`.** Una butaca de fila va a `columnas[numero - 1]`, nunca a
  la columna `numero`.
- **Una mesa nunca queda partida por un pasillo**, ni en el reparto automático ni en el editor:
  `motivoNoCabe` lo decide con `esMesa` (sin `tipo`, o `tipo: 'redonda'`).
- **La zona se hereda de la banda:** cada banda colocada lleva su `zona` efectiva (`zonaDeBanda`: la
  suya y, en una zona de mesas sin zona propia, la de mesas) y la pasa a sus regiones. `zonaEnCelda`
  devuelve la de la banda **más profunda** que cubre una celda, y `generarPlano` resuelve con ella la
  zona de cada mesa, bloque y butaca suelta: manda la propia de la pieza, si no la heredada, si no
  `zonaParaFilas`. La pieza generada guarda `zonaEfectiva` (para mostrar) y `zona` solo si es propia
  (es lo que guardan `configDeMesa`, `configDeBloque` y `configDeButaca`): **nunca escribas la zona
  heredada en el plano**, o dejaría de seguir a su banda. Lo que muestra la zona de una pieza usa
  `zonaEfectiva`, no `zona`.
- **Ninguna pieza con butacas se queda sin zona:** si no cae dentro de ninguna banda con zona,
  `fijarZonasSueltas` (que llama `regenerar`) le escribe la suya y el aviso lo dice. Si añades una
  forma de crear o mover piezas, no la saltes.
- **El tirador no aplica nada hasta soltar:** `arrastreTirador` guarda el gesto, `medidasDeTirador`
  traduce la celda bajo el puntero a medidas **ya topadas** (1…`ALTO_MAXIMO`, y dejando una columna a
  la última vertical), `dibujarFantasma` las enseña y `terminarArrastreTirador` llama una sola vez a
  `aplicarBandas`, que es quien revierte si algo deja de caber. Sin cambio de medidas, el gesto vale
  como clic y selecciona su banda. Los dos ayudantes reciben el gesto por parámetro porque al terminar
  `arrastreTirador` ya es `null` (pasó: se leía después de limpiarlo).
- **Solo se agarra lo que tiene medida propia:** la esquina, en las bandas con alto propio
  (`tieneAlto`); el ancho, solo si la banda está en una vertical **que no es la última** (la última
  ocupa el resto, así que su ancho se deduce). Una banda de filas no lleva tirador: su alto son sus
  filas.
- **Las dos operaciones por area comparten el recorrido:** `recorrerArea(lista, area, aplicar)` va
  butaca a butaca por el rectangulo, aparta las ocupadas y se queda con las que `aplicar` dice que
  cambiaron de verdad (devolviendo `true`). Lo demas es de cada una: el mapa de zonas o el conjunto
  de bloqueadas.
- **Las operaciones por area devuelven lo que pasó:** `asignarZonaEnArea` y `bloquearEnArea` dan
  `{ plano, cambiadas, ocupadas }` (y la primera, `mesas` con las mesas completas que quedan con dos
  zonas). Las **ocupadas nunca cambian**, ni de zona ni de bloqueo, y se devuelven para avisar. Pintar
  la zona que una butaca ya tiene no cuenta como cambio, y asignar la de siempre **borra** la entrada
  de `zonasDeAsiento`: el mapa no guarda lo que ya se hereda.
- **Con una herramienta de butacas, el arrastre es del rectángulo, no del plano:** `arrastre.area` lo
  marca en `pointerdown`, `pointermove` lo dibuja y sale antes de mover la vista, y `pointerup` lo
  aplica si hubo movimiento (si no, sigue siendo un clic sobre la butaca). El plano se mueve con la
  barra espaciadora (`espacioPulsado`), el botón central (`e.button === 1`) o dos dedos, y un segundo
  dedo cancela el área. Por eso, con estas herramientas la barra espaciadora **no** activa la butaca
  enfocada: se reserva para desplazar, y Enter es lo que aplica.
- **El área se borra al cambiar de modo o de herramienta** (`limpiarArea` en `cambiarModo` y
  `cambiarHerramienta`) y al mover el foco sin Mayús. Vive en su propia capa, `#area`, que
  `dibujarTodo` no toca.
- **Zona por asiento (`plano.zonasDeAsiento`):** se aplica en `generarPlano` **después** de
  `numerarFilas`, así que cambia `zona` y `seccion` pero no `fila` ni `numero`. Cada butaca guarda
  `zonaOriginal`; `planoDesdeSala` extrae las que difieren. Asignar la zona original quita la entrada
  (`asignarZonaAsiento`). Cuenta en `usosDeZona` y se copia al duplicar (`copiarZonasDeAsiento`).
  La herramienta es `herramienta === 'zona'`; `conButacas()` agrupa las que trabajan sobre butacas.
- **El panel de bandas es el de las zonas** («Zonas y precios»): cada fila lleva el color, el nombre,
  el precio y la zona de su banda, y un **✓** que guarda nombre y precio de una vez. El ✓ lee los dos
  campos **antes** de aplicar nada: el primer cambio rehace la lista y se llevaria por delante lo
  escrito en el otro (paso). Al final de la lista, en `#lista-zonas`, van las zonas que no son de
  ninguna banda. Si la zona es suya en exclusiva (`zonaExclusivaDeBanda`), el campo de nombre **renombra la
  zona** (`editarZona`) y no la banda: son lo mismo para quien edita. Si la comparte, vuelve a ser el
  nombre propio de la banda. `zonaNuevaParaBanda` es la opción «Zona nueva». El grupo *Otras zonas*
  (`dibujarZonas`) solo lista las zonas que no son de ninguna banda, para que sigan siendo editables:
  las de una pieza con zona propia, las pintadas y las que no usa nadie.
- **Venta por mesa o por butacas:** `marcarVenta(plano, completa, quiere)` es **el unico sitio donde
  se escribe `completa`**; las cuatro formas de pedirlo solo cambian en el filtro que le pasan:
  `marcarMesaCompleta` (una), `marcarVentaDeMesas` (varias), `marcarMesasDeBanda` (las de una banda,
  con `mesasDeBanda`) y `marcarTodasLasMesas` (todas). Si añades otra forma, pasa por ahi. En la
  interfaz son el selector `#venta-mesa` de la pieza, el selector de la fila de la banda y «Aplicar
  a todas las mesas».
- **Mesa completa (`completa: true`)**: sus lugares llevan `grupo.completa`. Elegir pasa siempre por
  `alternarEleccion` (todos sus lugares libres a la vez), y `completarMesasElegidas` corrige las
  selecciones parciales al regenerar. El precio no se guarda: es la suma de los lugares libres, cada
  uno al de su zona (la que herede la mesa, o la propia del lugar). En `generarPlano`, si un lugar está ocupado, los demás libres pasan a ocupados.
- **Una mesa redonda solo guarda sus lugares** (un número par de 2 a 16); el diámetro sale de
  `diametroRedonda` (los lugares entre cuatro, hacia arriba) y las sillas van por parejas en cada
  lado, sin esquinas (`ladosDeRedonda`, `geometriaMesaRedonda`). `cambiarLugaresRedonda` recibe pasos
  de ±1 que valen dos sillas. Su huella es cuadrada, así que
  todo lo demás (caber, arrastrar, duplicar, bandas) funciona sin casos especiales. `configDeMesa`
  guarda la forma que toque.
- **Las columnas son de toda la sala:** `plano.distribucion` (o la del mapa, o la de la plantilla).
  Nunca por banda: es lo que mantiene las filas alineadas. Al cambiarlas, `cambiarDistribucion`
  recoloca las mesas y `aplicarBandas` rechaza el cambio si alguna no cabe.
- **Las mesas pueden ir en cualquier hueco libre de la sala**, no solo en una zona de mesas.
- **Ningún cambio de bandas o columnas deja una pieza que no cabe:** `aplicarBandas` genera,
  comprueba con `primeraPiezaQueNoCabe` (mesas y bloques) y, si falla, vuelve al plano anterior.
- **Id estable, etiqueta calculada.** `id` no depende de la posición: la selección, las reservas y
  las bloqueadas usan solo el id. `fila`, `numero` y `seccion` se recalculan en `numerarFilas`: por
  zona y de izquierda a derecha para lo que mira al escenario; con secuencia propia para bloques
  girados. Nunca uses la etiqueta como clave.
- **Una mesa respeta los pasillos; un bloque de filas y el escenario no:** en un bloque, los pasillos
  son el espacio entre bloques.
- **Las bandas son un árbol:** la sala apila bandas; una `division` reparte su ancho en verticales, y
  cada vertical apila bandas de filas o mesas. Recorre siempre con `hojasDe` o `ubicar`, nunca con
  `sala.bandas` a secas, o te saltarás las bandas de dentro de las verticales.
- **Las piezas se recolocan con `reanclarPiezas`:** toda operación de bandas la llama. No desplaces
  piezas a mano por `y`: el anclaje por región es lo que las hace viajar también en horizontal.
- **Disposición siempre válida:** `disponerBandas` devuelve `error` si las verticales no caben;
  `aplicarBandas` y `validarMapa` lo comprueban antes de aceptar un cambio.
- **Duplicar da ids nuevos a todo:** banda, verticales, bandas interiores, mesas y bloques. Las
  bloqueadas se copian cambiando el prefijo del id (`F1-1-2` → `F2-1-2`); la ocupación nunca. El id
  de la copia es el valor del contador antes de llamar (`'banda' + plano.siguienteBanda`, `M` +
  `siguiente`, `F` + `siguienteBloque`): el DOM lo usa para seleccionarla después.
- **El nombre de una banda es solo un subtítulo:** la etiqueta de las butacas sigue saliendo de su
  zona. No uses `nombre` para numerar ni para etiquetar butacas.
- **Varias piezas, una sola banda:** `piezasActivas` es el conjunto de piezas seleccionadas y
  `mesaActiva` la **principal** (la última que se tocó), que es la que mandan los controles de una
  sola pieza y la que lleva el `tabindex`. Todo lo que pinta la selección (`dibujarPiezas`,
  `dibujarButacas`, `pintarActivas`) mira el conjunto, no `mesaActiva`. `marcarActivas` la reemplaza,
  `alternarPiezaActiva` es el Ctrl+clic y `aplicarMarco` la marquesina. El **escenario** no entra en
  el grupo (`piezasDelPlano` lo deja fuera): es único y no se duplica ni se elimina.
- **`focusin` no deshace el grupo:** si la pieza que recibe el foco ya está en `piezasActivas`, solo
  pasa a ser la principal. Si no, la selección se queda en ella (pasó: el foco del clic colapsaba lo
  que Ctrl+clic acababa de sumar).
- **Mover varias es todo o nada:** `moverPiezas` comprueba todas contra `celdasOcupadas(new Set(ids))`
  —las celdas del propio grupo no estorban, porque viajan juntas— y si una falla no mueve ninguna.
  `excluida` es lo que permite excluir un id o un conjunto.
- **Transformar varias pasa por `aplicarConfigs`:** el que llama calcula las configuraciones nuevas
  con las mismas funciones puras que una sola pieza (`TRANSFORMACIONES[accion].calcular`) y
  `aplicarConfigs` las escribe si caben. Si no caben donde están, prueba desplazar el **grupo entero**
  hasta dos celdas (`DESPLAZAMIENTOS_DE_GRUPO`, de menos a más) en vez de mover una sola, que
  desbarataría las distancias. Devuelve `{ plano, dx, dy }` o `{ motivo }`, y el motivo es el de
  quedarse en su sitio, que es el que explica algo.
- **Una acción de grupo solo se ofrece si todas la admiten** (`aplica(accion, pieza)` para cada una);
  el panel las desactiva y `ejecutarAccion` lo vuelve a comprobar.
- **Los textos de grupo van en femenino plural** (`HECHO_EN_GRUPO`): los de una sola pieza concuerdan
  con ella («girada», «alargado») y no sirven para varias.
- **Estados mixtos del panel:** con varias seleccionadas, `comun(valor)` devuelve el valor compartido
  o `undefined`; el selector de zona añade «— varias zonas —» (`mezcla`) y el de venta, «Venta
  mixta». Elegir una opción la aplica a todas. El nombre no se edita con varias: es de cada pieza.
- **Una sola banda seleccionada:** `bandaActiva` y la selección de piezas se excluyen
  (`marcarBandaActiva` y `marcarActivas` limpian la otra). Todo se vacía al cambiar de modo,
  herramienta o sala.
- **El escenario es una pieza, no una banda:** la banda `escenario` solo es la franja inicial. Todo lo
  que depende de «hacia dónde está el escenario» (mira de las filas de banda, qué bloques miran de
  frente, orden de las letras) se calcula desde `escenario` en `generarPlano` y `numerarFilas`.
  Nunca supongas que está arriba.
- **El escenario puede no existir:** `plano.escenario === null` → `escenario.ausente`. Sin campo
  (`undefined`) se usa el de por defecto; no confundas los dos. Con `ausente`, no ocupa celdas, no
  se dibuja, `piezaPorId('escenario')` es null y `centroDelEscenario` devuelve `y: -Infinity` para
  que todo mire y se numere desde arriba sin casos especiales. Filtra `escenario` de las listas de
  piezas con `escenario.ausente`.
- **Un lienzo no tiene pasillos:** `lienzo: true` con `distribucion` de un solo bloque. Su ancho se
  cambia con `cambiarAnchoLienzo`, no con `cambiarDistribucion` (que recolocaría las piezas).
- **Las guías de fila son decorado** (muebles `guia`): no son butacas, no ocupan celdas ni se numeran.
- **Las piezas en listas se recorren con `LISTAS_DE_PIEZAS`:** mesas (`M`), bloques (`F`), formas
  (`P`) y butacas sueltas (`B`). Copiar, reanclar, duplicar, crear y buscar su lista (`listaDeId`)
  salen de ahí; ninguna función toca `plano.siguiente` ni empuja a `plano.mesas` a mano. Si añades un tipo de pieza, agrégalo a la tabla y a `piezaPorId`, `primeraPiezaQueNoCabe`,
  `dibujarPiezas`, `planoDesdeSala`, `mapaDesdePlano` y `validarMapa`.
- **Agregar una pieza pasa por `agregarPiezaNueva(prefijo, base, sinSitio, colocar)`:** saca el id y
  el contador de `LISTAS_DE_PIEZAS` con `nuevoIdDe`, busca el primer hueco libre y, si cabe, guarda
  la pieza en su lista y la deja seleccionada; devuelve `{ id, sitio }`, o `null` tras decir por que
  no cabia. **El contador solo avanza si cupo**, asi que un intento fallido no quema un id. Lo propio
  de cada tipo va en `colocar(hueco, buscarCon)`: un bloque se orienta hacia el escenario y **vuelve
  a buscar** con ese giro (girado puede no caber donde cabia derecho, y entonces se queda sin girar);
  una butaca solo mira hacia el escenario, porque ocupa una celda y girarla nunca la deja fuera. El
  aviso y `mostrarPiezaNueva` van despues de `regenerar`, que es cuando la pieza tiene huella y zona
  heredada.
- **Solo las mesas respetan los pasillos:** `motivoNoCabe` lo decide por `!pieza.tipo` (las mesas son
  las únicas piezas sin `tipo`).
- **Una butaca suelta no lleva guion en su id** (`B3`): `copiarBloqueadas` usa el id entero como
  prefijo cuando no hay guion.
- **Las formas no tienen lugares** pero ocupan celdas (`celdasOcupadas`) con su nombre.
- **Los ids son estables.** Bloques: bloque + fila + butaca locales (`F1-2-3`). Filas de banda: banda + fila + número dentro de la banda
  (`luneta-A1`), aunque la etiqueta visible siga la numeración por zona. Mesas: mesa + lado (`M2-N1`, `M2-S2`,
  `M2-C1`), nunca un número de orden. Mover, girar o cambiar de sala mixta no renombra lugares;
  alargar solo añade. El número que se muestra («lugar 3») es solo presentación.
- **Los ids de mesa, banda y bloque no se reutilizan.** `siguiente`, `siguienteBanda` y `siguienteBloque` solo crecen.
- **Las esquinas vacías de una mesa están reservadas:** la huella es el rectángulo completo.
- **Nada desaparece en silencio.** Si se suelta una butaca elegida, el aviso la nombra y dice por
  qué. Si una mesa no cabe, se anuncia el motivo. Si acortar, quitar cabeceras o eliminar quita
  lugares ocupados, se avisa.
- **Accesibilidad:**
  - Cada butaca es `role="checkbox"` con `aria-label`; cada mesa del editor, `role="button"` con
    `aria-pressed` si es la activa.
  - Nada de `title` en botones: algunos lectores lo anuncian en su lugar. Los atajos van en
    `aria-keyshortcuts`.
  - **Botones del panel:** los crea `boton(icono, etiqueta, op, banda, deshabilitado)`, que pone el
    icono del sprite con `iconoDe`, y `aria-label` y `data-tooltip` con la etiqueta. Cada banda
    reparte su fila en dos: nombre y detalle arriba, y `.banda-controles` con los botones debajo.
  - **Botones de icono:** clase `icono`, `aria-label` con el nombre y `data-tooltip` con el nombre y el
    atajo. Lo muestra el script en un único `.tooltip` con `position: fixed` (al pasar el ratón,
    buscando con `elementFromPoint` para que funcione en botones desactivados, o con `:focus-visible`),
    porque un `::after` quedaría recortado por el scroll de los laterales. El icono es
    `<svg class="ico" aria-hidden="true"><use href="#i-..."></use></svg>`; los `<symbol>` están en el
    `<svg class="sprite">` del principio del `<body>`. Si un botón cambia de función (escenario), cambia
    `aria-label`, `data-tooltip` y el `href` del `<use>`, nunca `textContent` (borraría el icono).
    Un icono de Material Symbols nuevo se añade a `NOTICE`.
  - `tabindex` móvil: una sola parada de tabulación por capa, gestionada en `focusin`.
  - **Disposición:** `<div class="app">` con el `<aside class="lateral">` de la **sala** a la izquierda
    (Vista, tipo de sala, Mapa, Columnas, Zonas y precios, Leyenda), `<main>` (encabezado, plano,
    `.barra-estado` y pie) y `<aside id="lateral-configuracion">` con las **piezas** a la derecha
    (Agregar, Editar, Sala), que `cambiarModo` muestra solo en el editor junto con la clase
    `editando` de `#app` (tercera columna de la rejilla). En el editor la columna ancha es la izquierda.
    Del grupo *Mapa* (`#grupo-mapa`) y del panel de la sala (`#panel-bandas`) se encarga tambien
    `cambiarModo`; el **tipo de sala** se ve en los dos modos, porque es como se cambia de recinto.
    Los controles se buscan por id: moverlos de grupo no rompe el script.
  - **Los textos de ayuda de un grupo van tras un boton de informacion** en su `<summary>`
    (`#info-columnas`, `#info-zonas`): el clic hace `preventDefault` y `stopPropagation`, o abriria y
    cerraria tambien el `<details>`. Es el mismo boton que el del encabezado (`#i-info`).
  - **La flecha de plegar la dibuja el CSS** (`.grupo > summary::before`, ▾ y ▸): con `display: flex`
    en el `<summary>` el navegador deja de pintar su marcador, y la flecha tiene que ir **delante**
    del titulo (paso: se perdio al meter el boton de informacion).
  - **La paleta va en `:root`:** los colores que se repiten tres veces o mas son variables CSS
    (`--fondo`, `--fondo-panel`, `--fondo-control`, `--fondo-plano`, `--borde`, `--borde-suave`,
    `--texto`, `--texto-claro`, `--texto-tenue`, `--texto-apagado`, `--acento`, `--acento-fuerte`,
    `--realce`, `--realce-velo`, `--rojo`). Los de una sola vez (estados de butaca, madera, guias)
    siguen escritos donde se usan, y la paleta de las capas es del script (`COLORES_DE_CAPA`), no del
    CSS. Un color nuevo que aparezca por tercera vez se sube a `:root`.
  - **Una regla, un sitio:** no declares dos veces el mismo selector fuera de las media queries. Si
    una clase deja de usarse en el HTML y en el script, su regla se va con ella (se fueron `.modos`,
    `.casilla` y `.separador`); ojo con las que se componen a mano, como `.forma-<nombre>`, que si
    estan vivas aunque no aparezcan escritas enteras.
  - **`.subtitulo` es del SVG** (nombres de banda, letra de 4 px). El subtítulo de la página es
    `.bajada`; no reutilices la clase o la letra se queda diminuta (pasó).
  - **Escritorio = una pantalla:** con más de 900 px de ancho y 600 px de alto, una media query pone
    `overflow: hidden` al `body`, `height: 100dvh` a `.app` y convierte `.centro` en una rejilla de
    tres filas (encabezado, plano y la barra del pie, `footer.barra-estado`). El alto del plano lo da el
    CSS, no el script: `ajustarAltoDelPlano` solo limpia un alto en línea. Ahí los `.panel` (hojas de
    información en el encabezado, detalle en el pie) van `position: absolute` sobre el plano, así que el
    plano no se mueve. Por debajo de esos tamaños todo vuelve al flujo con scroll de página.
  - **Paneles del centro:** `abrirPanel(panel, boton, abrir)` los muestra u oculta, actualiza
    `aria-expanded` y llama a `reencuadrar` (en flujo cambian el hueco; en escritorio no).
    `cerrarPlegables` cierra los dos (Esc, clic en el plano). Las hojas son `<article class="hoja">`
    dentro de `#hojas-info`; `mostrarHoja` enseña una y marca su punto con `aria-current`. `#pista`
    vive en la hoja «Cómo se usa» y el script sigue cambiando su texto según el modo.
  - **El encuadre se adapta a la caja del `<svg>`** siempre, no solo cuando el alto es fijo.
  - **El viewBox tiene la proporción del `<svg>`:** en Previsualizar, `ajustarAltoDelPlano` fija el alto
    del plano y `calcularEncuadre` ensancha o alarga el encuadre hasta esa proporción. Si no, el
    navegador dejaría franjas y `enUnidades` (clics, arrastre, zoom) apuntaría a otra celda. Tras
    cambiar algo que mueva el hueco del plano (modo, encabezado, ventana), llama a `reencuadrar`.
  - `#estado` y `#aviso` son `role="status"`; el resumen es `aria-live`.
  - El estado no depende solo del color (palomita, aspa, raya; sombra roja con contorno discontinuo).
  - Los colores de estado contrastan al menos 3:1 con el fondo del plano.

- **Un mapa guarda diseño, no venta:** pasillos, bandas, mesas, bloqueadas y contadores. Nunca la
  ocupación ni la selección. La ocupación de ejemplo vive en las plantillas (`ocupadas`,
  `mesasOcupadas`).
- **Una zona nueva se estrena en un solo sitio:** `zonaNueva(lista, siguiente, nombreBase)` decide el
  id (`zonaN`, saltando los que ya existen aunque el contador se haya quedado corto) y el nombre
  (numerado si choca: «General 2»), y no toca el plano. Lo usan `agregarZona` (una zona suelta) y
  `zonaNuevaParaBanda` (la que nace atada a una banda).
- **Una zona es una banda:** `agregarBanda` y `agregarBandaEnVertical` pasan por `conZonaPropia`, que
  le da a la banda nueva su zona (nombre a partir de la de partida, numerado, y precio 0). Los
  **espacios y las franjas nacen sin zona** (un hueco no da precio a nada); al espacio se le da la
  suya con el boton de la etiqueta, que crea espacio + zona. `eliminarBanda` se lleva la zona si no la
  usa nadie mas (`usosDeZona`), nunca la de mesas ni la ultima. El nombre por defecto de una banda es
  el de su zona (`nombreDe` en `disponerBandas`), asi que renombrar la zona renombra la banda.
- **El color es de la zona:** `colorDeCapa` indexa la paleta por la zona de la banda, y solo cae al
  orden del arbol (`capasDe`) para las que no tienen. Dos bandas que comparten zona se ven del mismo
  color, en el panel y en el plano.
- **Las zonas son del plano:** `plano.zonas` es una lista `[{ id, nombre, precio }]` (precio en
  centavos). `generarPlano` la vuelca en el índice `zonas` con `usarZonas` antes de disponer las
  bandas, así que `zonas[id]` siempre es de la sala actual. `validarMapa` también llama a
  `usarZonas` antes de `disponerBandas`. No escribas ids de zona fijos (`'luneta'`, `'general'`):
  valida contra la lista y usa `zonaParaFilas` para las filas nuevas. La zona `mesas` es la que toman
  las zonas de mesas que no llevan otra: siempre existe y no se asigna a filas. `usosDeZona` cuenta
  las bandas (por su zona efectiva) y las piezas con zona **propia**: lo que hereda no cuenta, porque
  ya lo sujeta su banda. El tope es `ZONAS_MAXIMAS` (40), porque cada banda trae la suya.
- **Aforo máximo: `BUTACAS_MAXIMAS` (20.000).** `validarMapa` lo comprueba con `motivoDeAforo`;
  `aplicarBandas` lo trata como un error de bandas y revierte; los cambios de piezas (agregar,
  transformar, duplicar) pasan por `conTopeDeAforo`, que copia el plano antes y lo restaura si se
  pasa. Si añades una acción que agrega butacas, envuélvela igual. `importarMapa` rechaza archivos de
  más de `ARCHIVO_MAXIMO` (1 MB) antes de leerlos.
- **Nada de recorridos anidados sobre todas las butacas** en lo que corre al generar (`generarPlano`,
  `numerarFilas`): agrupa antes con un `Map`. Filtrar la lista dentro de otro recorrido llegó a tardar
  6 s con 100.000 butacas; hay una prueba de tiempo que lo detecta.
- **La validacion va por partes y ninguna corta:** cada `...DeMapa` recibe la lista de `errores` y la
  va llenando, para que un archivo malo diga de una vez todo lo que le pasa; `validarMapa` decide al
  final con `if (errores.length) return { errores }`. **El orden en que se llaman es el orden en que
  salen los errores**, asi que no las reordenes por gusto. Las que recorren una lista de piezas pasan
  por `listaDeMapa`, que comprueba el id contra su patron y aparta los repetidos: mientras no hay id
  de fiar la pieza se nombra por su sitio («mesa 2: id no válido») y a partir de ahi por su id («M2:
  giro no válido»), salvo que se pase otra `etiqueta` (las zonas van siempre por su sitio, porque su
  id no se ve). Con el id malo **no se sigue mirando la pieza**: un error por ella, no una cascada.
- **Todo mapa que entra se valida** con `validarMapa`, venga de un archivo o de `localStorage`: se
  descartan los campos desconocidos y se comprueba que las mesas quepan. No se confía en el archivo.
- **Las bloqueadas son una lista de ids** (`plano.bloqueadas`). `bloqueadasAlFinal` de las plantillas
  solo se usa si no hay lista.
- **Formato del mapa, versión 4:** `zona` es opcional en mesas, bloques y butacas sueltas (sin ella,
  heredan) y las bandas que no son de filas pueden llevarla. La versión 3 añadió `lienzo`,
  `escenario: null` y bandas `espacio` (con `guias`), y el escenario dejó de ser banda obligatoria;
  hasta la versión 2 se exige el escenario como primera banda y no se admiten espacios. La versión 2
  guarda `distribucion`; `validarMapa` convierte la versión 1 (`pasillos` con nombre). Un mapa de la
  versión 3 no se toca al leerlo: sus mesas no traían zona, así que pasan a heredar la de su banda. Si cambias el formato otra vez, sube `VERSION_MAPA` y convierte los mapas
  viejos en lugar de
  rechazarlos.

## Trampas conocidas

- **`letraDeFila` no tiene límite:** sigue AA… ZZ, AAA como las columnas de una hoja de cálculo. La
  versión anterior daba «undefined» a partir de la fila 703 de una zona (hay prueba).
- **`String.replace` con un texto de reemplazo interpreta `$'`, `$&`…:** en scripts que editan el
  código, pasa una función (`t.replace(de, () => a)`) o el reemplazo puede duplicar medio archivo.
- **`setPointerCapture` retargetea los eventos al `<svg>`:** la butaca o la mesa agarrada se anota
  en `pointerdown`; en `pointerup`, `e.target` ya es el `<svg>`.
- **El atributo `hidden` no funciona en elementos SVG:** usa la clase `.oculta`.
- **La rueda solo llama a `preventDefault` si el zoom cambió** (o con Ctrl), para no bloquear el
  scroll de la página en el tope del zoom.
- **No reencuadrar durante un arrastre:** `focusin` no llama a `asegurarVisible` si hay `arrastre`
  o `arrastreMesa`, o el plano salta bajo el puntero.
- **Redibujar destruye el foco:** tras una acción con teclado, hay que volver a enfocar la pieza (lo
  hacen `moverMesaConTeclado` y el manejador de `keydown`).
- **`display: flex` pisa el atributo `hidden`:** por eso existe `.herramientas[hidden]`.
- **Girar sobre el centro redondea distinto según el giro** (hacia abajo al quedar en 90° o 270°,
  hacia arriba en 0° o 180°), para que cuatro giros no desplacen la mesa.
- **Las marcas de estado giran solo con sillas a 90° o 270°:** ahí el hueco del icono es vertical y
  una marca derecha se pisa con respaldo y asiento. A 0° o 180° se quedan derechas.
- **Transformaciones que no mueven el tablero** pasan por `anclarTablero`; si añades una, úsalo.
- **En `planoDesdeSala`, `alto` es un dato solo en las zonas de mesas:** en las demás bandas se
  calcula. Quitarlo de todas rompe las zonas de mesas (pasó; hay prueba).
- **Nombres de banda:** solo se guardan los propios (`nombrePropio` en la banda colocada: de la
  plantilla, como Platea, o puestos a mano). Los demás se calculan al generar, para numerar bien
  (General, General 2). Quitar `nombrePropio` en `planoDesdeSala` pierde los nombres (hay prueba).
- **Subtítulos en dos capas:** los del margen van en `#muebles` (bajo las butacas, no las tocan);
  las etiquetas de borde van en `#subtitulos`, sobre las butacas para leerse, con
  `pointer-events: none` fuera del editor de piezas para no robar clics a las butacas. El nombre de
  la banda seleccionada va en `#rotulo-seleccion`, la última capa del plano (sobre las piezas), en
  su borde inferior y sin eventos de puntero; su subtítulo normal se oculta con `.oculta`.
- **El doble clic llega después de dos clics:** cada clic en el fondo sube un nivel en la selección
  de bandas; el `dblclick` de un subtítulo selecciona su banda directamente y lleva a su campo.
- **`validarMapa` genera un plano para comprobar las mesas**: cambia `butacas`, `muebles` y
  `mesas`. Después hay que volver a generar y dibujar la sala actual (lo hace `importarMapa`).
- **`localStorage` puede lanzar excepciones** (páginas `data:`, modo privado, cuota llena): todo acceso
  va en `try/catch` y la página tiene que funcionar sin él.
- **`confirm` bloquea las pruebas automáticas:** en el navegador, sustitúyelo antes de guardar o
  importar sobre un nombre existente.
- **`escalar` asigna el ancho exacto** en vez de multiplicar, para que el tope del zoom no falle por
  redondeo.

## Convenciones

- **Idioma:** español en nombres, comentarios, textos de la interfaz y documentación.
- **Comentarios del código sin tildes** (ASCII, por ejemplo `tamano`, `posicion`); los textos
  visibles en la interfaz sí llevan tildes.
- **Los comentarios explican el porqué**, no repiten el qué.
- **Colores:** el estado de una butaca va en la propiedad `color` y se pinta con `currentColor`.
- **Mensajes de commit:** en español, sin tildes, con título corto y cuerpo que explica el cambio.
- **Documentación:** si cambias el comportamiento, actualiza `README.md` y añade la entrada en
  `CHANGELOG.md`.

## Cómo verificar un cambio

1. `node --test pruebas.mjs`: todas en verde. Añade pruebas si tocas la parte sin DOM.
2. Abre `index.html` y comprueba, según lo que hayas tocado:
   - **Previsualizar:** elegir y soltar butacas (clic, Enter, Espacio), recorrer con flechas,
     zoom con rueda y botones, arrastre del plano sin elegir butaca, cambio de tipo de sala con aviso.
   - **Editar plano:** arrastrar una mesa a un sitio válido y a uno inválido (pasillo, otra mesa),
     Esc, flechas, girar, alargar y acortar, cabeceras, agregar Lados y Cruz, eliminar,
     «Restablecer sala», y que la selección se conserve.
   - **Zonas y precios:** nombre, precio y el ✓ que guarda los dos; zona («Zona nueva» y compartir con
     otra banda, que iguala el color); el boton de la etiqueta, que crea un espacio con su zona; venta
     de las mesas de una zona de mesas; que al eliminar una banda se vaya su zona; que las zonas sin
     banda queden al final de la lista; y los dos botones de informacion.
   - **Bandas:** − / +, zona, subir y bajar, eliminar, agregar; que no se aplique un cambio que deja
     una mesa sin caber, y que el foco vuelva al mismo control.
   - **Mapa en blanco:** elegirlo abre el editor; ancho del lienzo, agregar espacios y guías, agregar
     y quitar escenario, guardar y recargar.
   - **Butacas sueltas y formas:** agregar, mover, girar (una barra junto al borde), cambiar tamaño,
     zona y nombre, duplicar, guardar, y elegir una butaca suelta en Previsualizar.
   - **Herencia de zona:** una mesa o un bloque dentro de una banda toma su zona («Hereda: …» en
     *Editar*); fijarle una propia y volver a heredar; en un mapa en blanco, agregar una
     pieza fuera de toda zona y ver el aviso; guardar, recargar y comprobar que lo heredado sigue
     siguiendo a su banda.
   - **Duplicar y nombres:** Duplicar y Ctrl+D en una mesa, un bloque, una banda, una vertical y una
     franja; clic en el fondo para seleccionar bandas (y subir de nivel); renombrar en el panel y con
     doble clic en un subtítulo; que los subtítulos se lean en Previsualizar sin tapar clics.
   - **Varias piezas:** marquesina en el fondo (y con Ctrl, sumando), Ctrl+clic, arrastrar el grupo,
     flechas, Ctrl+D y Supr; que un destino imposible no mueva nada y diga cuál estorba; girar y
     alargar el grupo (y que se desplace entero si hace falta); zona y venta con estado mixto
     («— varias zonas —», «Venta mixta»); que una acción que no admiten todas quede desactivada; que
     un clic seco en una pieza del grupo deje solo esa; y que un clic seco en el fondo siga
     seleccionando bandas.
   - **Tiradores:** arrastrar la esquina de un espacio (alto), la de un espacio dentro de una vertical
     (alto y ancho a la vez), y el borde entre verticales; que el fantasma se tope en los límites, que
     Esc cancele, que un clic seco seleccione la banda, que no haya tiradores en Previsualizar ni con
     las herramientas de butacas, y que un cambio que deja una mesa sin caber se revierta con su aviso.
   - **Por área:** con *Asignar zona* y con *Bloquear butacas*, arrastrar un rectángulo y aplicarlo,
     Alt para deshacerlo, Mayús+flechas y Enter con el teclado, Esc para cancelar, el conteo mientras
     se arrastra, que las ocupadas no cambien y se avisen, y que el plano siga moviéndose con la barra
     espaciadora, el botón central y dos dedos.
   - **Mapas:** bloquear y desbloquear butacas; guardar con nombre y recargar; exportar e importar;
     importar un archivo dañado; eliminar. `localStorage` no funciona en páginas `data:`: para
     probar el guardado, sirve la carpeta por HTTP.
3. Revisa que no haya errores en la consola del navegador.

## Pendiente

- Probar el pellizco en un móvil o tablet real.
- Guardar los mapas en un servidor: hoy se guardan en el navegador o como archivos JSON.
- Desplazar el plano solo al arrastrar una mesa hasta el borde con zoom.
- Decidir si una mesa con lugares ocupados se puede mover, acortar o eliminar (hoy sí, con aviso).
- Más formas: escenario secundario, cabina de DJ, columna.
- Comprobar que las piezas caben sin recalcular las celdas por cada pieza (cuadrático con muchas piezas).
