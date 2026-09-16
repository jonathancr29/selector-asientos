# AGENTS.md

Guía para asistentes de IA (y personas) que trabajen en este proyecto. Para qué hace y por qué,
lee primero [README.md](README.md). Para el historial de cambios, [CHANGELOG.md](CHANGELOG.md).

## Qué es

Un selector de asientos: plano de butacas interactivo en SVG, en **un solo archivo HTML**, sin
dependencias, sin paso de compilación y sin framework. Filas numeradas, mesas y zona general
conviven en el mismo plano. Tiene dos modos: **Previsualizar** (elegir butacas, como quien compra)
y **Editar plano** (arrastrar mesas por la rejilla).

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
3. **Datos:** `zonas`, `butacas`, `muebles`, `mesas`. `generarPlano(disposicion, posiciones)` los
   rellena. `MESA` define la huella de una mesa (2 × 3 celdas).
4. **Editor sin DOM:** `celdasOcupadas`, `motivoNoCabe`, `buscarHueco`.
5. **Selección sin DOM:** `elegidas` (un `Set` de ids) y `conciliarSeleccion`.
6. **Marca `// === Fin de la parte sin DOM`.** `pruebas.mjs` evalúa en Node todo lo anterior a
   esta línea.
7. **Render:** `dibujarMuebles`, `dibujarButacas`, `dibujarPiezas`, `dibujarTodo`.
8. **Zoom y desplazamiento:** mueven el `viewBox` (`vista`, `aplicarVista`, `escalar`), con rueda,
   punteros (arrastre y pellizco) y botones.
9. **Selección y teclado:** `alternar`, `moverFoco`, `asegurarVisible`, manejadores `focusin` y
   `keydown`.
10. **Modo editor:** `modo`, `posiciones`, sombra de destino, arrastre de mesas, teclado,
    `cambiarModo`.
11. **Resumen y cambio de disposición:** `actualizarResumen`, `redibujar`.

## Reglas que no se deben romper

- **Un solo archivo, sin dependencias.** Nada de librerías, CDN, módulos ES ni build. Tiene que
  abrirse con doble clic.
- **Los datos mandan; el SVG se genera.** Nunca se guarda ni se lee estado del SVG. La selección es
  `elegidas` (ids) y las posiciones de mesa son `posiciones`: el DOM los refleja, no los contiene.
- **Nada del DOM antes de la marca «Fin de la parte sin DOM».** Si una función de esa parte usa
  `document`, `svg` o similares, las pruebas fallan al evaluarla en Node.
- **Toda columna sale de `rejillaDeSala`.** Una butaca de fila va a `columnas[numero - 1]`, nunca a
  la columna `numero`.
- **Una mesa nunca queda partida por un pasillo**, ni en el reparto automático ni en el editor.
- **Los ids son estables.** Filas: `A1` (fila + número). Mesas: `M2-3` (mesa + lugar), sin importar
  la posición. Cambiar la disposición o mover una mesa no renombra lugares.
- **Nada desaparece en silencio.** Si se suelta una butaca elegida, el aviso la nombra y dice por
  qué. Si una mesa no cabe, se anuncia el motivo.
- **Accesibilidad:**
  - Cada butaca es `role="checkbox"` con `aria-label`; cada mesa del editor, `role="button"`.
  - `tabindex` móvil: una sola parada de tabulación por capa, gestionada en `focusin`.
  - `#estado` y `#aviso` son `role="status"`; el resumen es `aria-live`.
  - El estado no depende solo del color (palomita, aspa, raya; sombra roja con contorno discontinuo).
  - Los colores de estado contrastan al menos 3:1 con el fondo del plano.

## Trampas conocidas

- **`setPointerCapture` retargetea los eventos al `<svg>`:** la butaca o la mesa agarrada se anota
  en `pointerdown`; en `pointerup`, `e.target` ya es el `<svg>`.
- **El atributo `hidden` no funciona en elementos SVG:** usa la clase `.oculta`.
- **La rueda solo llama a `preventDefault` si el zoom cambió** (o con Ctrl), para no bloquear el
  scroll de la página en el tope del zoom.
- **No reencuadrar durante un arrastre:** `focusin` no llama a `asegurarVisible` si hay `arrastre`
  o `arrastreMesa`, o el plano salta bajo el puntero.
- **Redibujar destruye el foco:** tras mover una mesa con teclado, hay que volver a enfocar su
  pieza (lo hace `moverMesaConTeclado`).
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
     zoom con rueda y botones, arrastre del plano sin elegir butaca, cambio de disposición con aviso.
   - **Editar plano:** arrastrar una mesa a un sitio válido y a uno inválido (pasillo, otra mesa),
     Esc, flechas, «Restablecer mesas», y que la selección se conserve.
3. Revisa que no haya errores en la consola del navegador.

## Pendiente

- Probar el pellizco en un móvil o tablet real.
- Guardar las posiciones de las mesas en un servidor: hoy viven en memoria y se pierden al recargar.
- Desplazar el plano solo al arrastrar una mesa hasta el borde con zoom.
- Decidir si una mesa con lugares ocupados se puede mover (hoy sí).
