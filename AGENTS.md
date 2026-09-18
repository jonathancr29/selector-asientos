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
   `zonaParaFilas`, `butacas`, `muebles`, `TIPOS_DE_SALA` (pasillos y bandas de
   cada tipo), `altoDeBanda`, `agregarFilas`.
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
   `cambiarZonaBanda`, `agregarZona`, `editarZona`, `eliminarZona`, `usosDeZona`, `leerPrecio`, `agregarVertical`, `cambiarAnchoVertical`, `agregarBandaEnVertical`,
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
   **Bloqueos y mapas:** `idsBloqueadosPorBandas`, `alternarBloqueada`, `mapaDesdePlano`,
   `validarMapa`, `definicionDeMapa`, `registrarMapa`, `claveDeMapa`, `nombreDeArchivo`.
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
    `transformarMesa`, `agregarMesaNueva`, `eliminarMesa`, atajos (`ATAJOS`), `cambiarModo`,
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
- **Zona por asiento (`plano.zonasDeAsiento`):** se aplica en `generarPlano` **después** de
  `numerarFilas`, así que cambia `zona` y `seccion` pero no `fila` ni `numero`. Cada butaca guarda
  `zonaOriginal`; `planoDesdeSala` extrae las que difieren. Asignar la zona original quita la entrada
  (`asignarZonaAsiento`). Cuenta en `usosDeZona` y se copia al duplicar (`copiarZonasDeAsiento`).
  La herramienta es `herramienta === 'zona'`; `conButacas()` agrupa las que trabajan sobre butacas.
- **Mesa completa (`completa: true`)**: sus lugares llevan `grupo.completa`. Elegir pasa siempre por
  `alternarEleccion` (todos sus lugares libres a la vez), y `completarMesasElegidas` corrige las
  selecciones parciales al regenerar. El precio no se guarda: es la suma de los lugares libres, cada
  uno al de su zona. En `generarPlano`, si un lugar está ocupado, los demás libres pasan a ocupados.
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
- **Una sola selección en el editor:** `bandaActiva` y `mesaActiva` se excluyen (`marcarBandaActiva`
  y `marcarActiva` limpian la otra). Ambas se vacían al cambiar de modo, herramienta o sala.
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
  (`P`) y butacas sueltas (`B`). Copiar, reanclar, duplicar y buscar su lista (`listaDeId`) salen de
  ahí. Si añades un tipo de pieza, agrégalo a la tabla y a `piezaPorId`, `primeraPiezaQueNoCabe`,
  `dibujarPiezas`, `planoDesdeSala`, `mapaDesdePlano` y `validarMapa`.
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
  - **Disposición:** `<div class="app">` con `<aside class="lateral">` de herramientas, `<main>`
    (encabezado, plano, `.barra-estado` y pie) y `<aside id="lateral-configuracion">`, que
    `cambiarModo` muestra solo en el editor junto con la clase `editando` de `#app` (tercera columna
    de la rejilla). Los controles se buscan por id: moverlos de grupo no rompe el script.
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
- **Las zonas son del plano:** `plano.zonas` es una lista `[{ id, nombre, precio }]` (precio en
  centavos). `generarPlano` la vuelca en el índice `zonas` con `usarZonas` antes de disponer las
  bandas, así que `zonas[id]` siempre es de la sala actual. `validarMapa` también llama a
  `usarZonas` antes de `disponerBandas`. No escribas ids de zona fijos (`'luneta'`, `'general'`):
  valida contra la lista y usa `zonaParaFilas` para las filas nuevas. La zona `mesas` es la de los
  lugares de mesa: siempre existe y no se asigna a filas.
- **Aforo máximo: `BUTACAS_MAXIMAS` (20.000).** `validarMapa` lo comprueba con `motivoDeAforo`;
  `aplicarBandas` lo trata como un error de bandas y revierte; los cambios de piezas (agregar,
  transformar, duplicar) pasan por `conTopeDeAforo`, que copia el plano antes y lo restaura si se
  pasa. Si añades una acción que agrega butacas, envuélvela igual. `importarMapa` rechaza archivos de
  más de `ARCHIVO_MAXIMO` (1 MB) antes de leerlos.
- **Nada de recorridos anidados sobre todas las butacas** en lo que corre al generar (`generarPlano`,
  `numerarFilas`): agrupa antes con un `Map`. Filtrar la lista dentro de otro recorrido llegó a tardar
  6 s con 100.000 butacas; hay una prueba de tiempo que lo detecta.
- **Todo mapa que entra se valida** con `validarMapa`, venga de un archivo o de `localStorage`: se
  descartan los campos desconocidos y se comprueba que las mesas quepan. No se confía en el archivo.
- **Las bloqueadas son una lista de ids** (`plano.bloqueadas`). `bloqueadasAlFinal` de las plantillas
  solo se usa si no hay lista.
- **Formato del mapa, versión 3:** `lienzo`, `escenario: null` y bandas `espacio` (con `guias`); el
  escenario ya no es banda obligatoria. Hasta la versión 2 se exige el escenario como primera banda
  y no se admiten espacios. La versión 2 guarda `distribucion`; `validarMapa` convierte la versión 1
  (`pasillos` con nombre). Si cambias el formato otra vez, sube `VERSION_MAPA` y convierte los mapas
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
   - **Bandas:** − / +, zona, subir y bajar, eliminar, agregar; que no se aplique un cambio que deja
     una mesa sin caber, y que el foco vuelva al mismo control.
   - **Mapa en blanco:** elegirlo abre el editor; ancho del lienzo, agregar espacios y guías, agregar
     y quitar escenario, guardar y recargar.
   - **Butacas sueltas y formas:** agregar, mover, girar (una barra junto al borde), cambiar tamaño,
     zona y nombre, duplicar, guardar, y elegir una butaca suelta en Previsualizar.
   - **Duplicar y nombres:** Duplicar y Ctrl+D en una mesa, un bloque, una banda, una vertical y una
     franja; clic en el fondo para seleccionar bandas (y subir de nivel); renombrar en el panel y con
     doble clic en un subtítulo; que los subtítulos se lean en Previsualizar sin tapar clics.
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
- Asignar zona por área (un rectángulo de butacas de una vez).
