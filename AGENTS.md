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
2. **Rejilla:** `rejillaDeSala({ ancho, pasillos })` devuelve `bloques` y `columnas`. Es la **única
   fuente de verdad** de las columnas. `repartirMesas` coloca mesas dentro de los bloques.
3. **Datos y tipos de sala:** `zonas`, `butacas`, `muebles`, `TIPOS_DE_SALA` (pasillos y bandas de
   cada tipo), `altoDeBanda`, `agregarFilas`.
4. **Mesas:** `geometriaMesa({ largo, cabeceras, unLado, giro })` calcula huella, tablero y lugares,
   cada uno con `mira` (giro del icono hacia el tablero); `girar90` da el cuarto de vuelta.
   `ESTILOS` (lados, cruz, barra), `agregarMesa`, `mesasAutomaticas`. `generarPlano(tipo, plano)`
   apila las bandas y rellena `butacas`, `muebles` y `mesas`; la sala devuelta trae `bandas` (con
   `y`, `alto` y `nombre`), `alto` y `filas` (rango de filas de rejilla donde caben mesas).
5. **Editor sin DOM:** `celdasOcupadas`, `motivoNoCabe`, `buscarHueco`, `colocarCerca`, `girarMesa`,
   `anclarTablero`, `cambiarLargo`, `alternarCabeceras`, `alternarUnLado`, `buscarSitioLibre`, `primeraMesaQueNoCabe`. Reciben y devuelven
   configuraciones (`{ id, x, y, largo, cabeceras, unLado, giro }`); nunca modifican la actual.
   **Bandas:** `planoDesdeSala`, `redimensionarBanda`, `moverBanda`, `eliminarBanda`, `agregarBanda`,
   `cambiarZonaBanda`. Devuelven un plano nuevo o `{ motivo }`.
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
- **Toda columna sale de `rejillaDeSala`.** Una butaca de fila va a `columnas[numero - 1]`, nunca a
  la columna `numero`.
- **Una mesa nunca queda partida por un pasillo**, ni en el reparto automático ni en el editor.
- **Las mesas pueden ir en cualquier hueco libre de la sala**, no solo en una zona de mesas.
- **Ningún cambio de bandas deja una mesa que no cabe:** `aplicarBandas` genera, comprueba con
  `primeraMesaQueNoCabe` y, si falla, vuelve al plano anterior.
- **Los ids son estables.** Filas: banda + fila + número (`luneta-A1`), porque cada banda empieza su
  secuencia en A. Mesas: mesa + lado (`M2-N1`, `M2-S2`,
  `M2-C1`), nunca un número de orden. Mover, girar o cambiar de sala mixta no renombra lugares;
  alargar solo añade. El número que se muestra («lugar 3») es solo presentación.
- **Los ids de mesa y banda no se reutilizan.** `siguiente` y `siguienteBanda` solo crecen.
- **Las esquinas vacías de una mesa están reservadas:** la huella es el rectángulo completo.
- **Nada desaparece en silencio.** Si se suelta una butaca elegida, el aviso la nombra y dice por
  qué. Si una mesa no cabe, se anuncia el motivo. Si acortar, quitar cabeceras o eliminar quita
  lugares ocupados, se avisa.
- **Accesibilidad:**
  - Cada butaca es `role="checkbox"` con `aria-label`; cada mesa del editor, `role="button"` con
    `aria-pressed` si es la activa.
  - Nada de `title` en botones con texto: algunos lectores lo anuncian en su lugar. Los atajos van en
    `aria-keyshortcuts`.
  - `tabindex` móvil: una sola parada de tabulación por capa, gestionada en `focusin`.
  - `#estado` y `#aviso` son `role="status"`; el resumen es `aria-live`.
  - El estado no depende solo del color (palomita, aspa, raya; sombra roja con contorno discontinuo).
  - Los colores de estado contrastan al menos 3:1 con el fondo del plano.

- **Un mapa guarda diseño, no venta:** pasillos, bandas, mesas, bloqueadas y contadores. Nunca la
  ocupación ni la selección. La ocupación de ejemplo vive en las plantillas (`ocupadas`,
  `mesasOcupadas`).
- **Todo mapa que entra se valida** con `validarMapa`, venga de un archivo o de `localStorage`: se
  descartan los campos desconocidos y se comprueba que las mesas quepan. No se confía en el archivo.
- **Las bloqueadas son una lista de ids** (`plano.bloqueadas`). `bloqueadasAlFinal` de las plantillas
  solo se usa si no hay lista.
- **Si cambias el formato del mapa**, sube `VERSION_MAPA` y convierte los mapas viejos en lugar de
  rechazarlos.

## Trampas conocidas

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
- **Nombres de banda:** solo se guardan los puestos a mano en el tipo (Platea). Los demás se calculan
  al generar, para numerar bien (General, General 2).
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
   - **Mapas:** bloquear y desbloquear butacas; guardar con nombre y recargar; exportar e importar;
     importar un archivo dañado; eliminar. `localStorage` no funciona en páginas `data:`: para
     probar el guardado, sirve la carpeta por HTTP.
3. Revisa que no haya errores en la consola del navegador.

## Pendiente

- Probar el pellizco en un móvil o tablet real.
- Guardar los mapas en un servidor: hoy se guardan en el navegador o como archivos JSON.
- Desplazar el plano solo al arrastrar una mesa hasta el borde con zoom.
- Decidir si una mesa con lugares ocupados se puede mover, acortar o eliminar (hoy sí, con aviso).
