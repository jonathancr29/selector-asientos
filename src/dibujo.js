// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
const svg = document.getElementById('plano');
const capaMuebles = document.getElementById('muebles');
const capaButacas = document.getElementById('butacas');
const capaPiezas = document.getElementById('piezas');
const capaSeleccion = document.getElementById('seleccion-banda');
const capaArea = document.getElementById('area');
const capaSubtitulos = document.getElementById('subtitulos');
const capaRotuloSeleccion = document.getElementById('rotulo-seleccion');
const formatoDinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const dinero = (centavos) => formatoDinero.format(centavos / 100);
const porId = new Map();   // id -> butaca, para no recorrer la lista en cada interaccion
// La zona abre la etiqueta, como saldra en el boleto; el id queda aparte.
const etiquetaDe = (b) => (b.grupo ? zonas[b.zona].nombre + ', mesa ' + b.numeroMesa +
  (b.grupo.completa ? ' completa' : '') + ', lugar ' + b.numero
  : b.seccion + ', fila ' + b.fila + ', butaca ' + b.numero);

function nodo(nombre, atributos) {
  const el = document.createElementNS(NS, nombre);
  for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, v);
  return el;
}

function texto(clase, x, y, contenido) {
  const t = nodo('text', { class: clase, x, y });
  t.textContent = contenido;
  return t;
}

// Un tablero de mesa completa: se puede tocar (en Previsualizar) y se marca elegido
// cuando sus lugares lo estan.
function marcarTableroDeMesa(tablero, id) {
  const mesa = mesas.find((m) => m.id === id);
  if (!mesa || !mesa.completa) return;
  tablero.classList.add('completa');
  const libres = butacas.filter((b) => b.grupo && b.grupo.id === id && b.estado === 'libre');
  if (libres.length && libres.every((b) => elegidas.has(b.id))) tablero.classList.add('elegida');
}

function dibujarMuebles() {
  for (const m of muebles) {
    if (m.tipo === 'escenario') {
      const rect = nodo('rect', { class: 'escenario', x: m.x * PASO, y: m.y * PASO,
        width: m.w * PASO, height: m.h * PASO, rx: 3 });
      const cx = (m.x + m.w / 2) * PASO, cy = (m.y + m.h / 2) * PASO;
      const rotulo = texto('escenario-texto', cx, cy, 'ESCENARIO');
      if (m.h > m.w) rotulo.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
      rect.dataset.pieza = rotulo.dataset.pieza = 'escenario';
      capaMuebles.append(rect, rotulo);
    } else if (m.tipo === 'mesa') {
      const rect = nodo('rect', { class: 'mueble', x: m.x * PASO + 1, y: m.y * PASO + 1,
        width: m.w * PASO - 2, height: m.h * PASO - 2, rx: 4 });
      // En una celda sola «Mesa 4» no cabe: solo el numero. En vertical, el texto se gira.
      const cx = (m.x + m.w / 2) * PASO, cy = (m.y + m.h / 2) * PASO;
      const unaCelda = m.w === 1 && m.h === 1;
      const rotulo = texto('rotulo', cx, cy, unaCelda ? m.numero : m.texto);
      if (!unaCelda && m.h > m.w) rotulo.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
      rect.dataset.pieza = rotulo.dataset.pieza = m.mesa;
      marcarTableroDeMesa(rect, m.mesa);
      capaMuebles.append(rect, rotulo);
    } else if (m.tipo === 'mesa-redonda') {
      const cx = (m.x + m.w / 2) * PASO, cy = (m.y + m.h / 2) * PASO;
      const circulo = nodo('circle', { class: 'mueble', cx, cy, r: (m.w * PASO) / 2 - 1 });
      // En una mesa de una celda «Mesa 4» no cabe: solo el numero.
      const rotulo = texto('rotulo', cx, cy, m.w === 1 ? m.numero : m.texto);
      circulo.dataset.pieza = rotulo.dataset.pieza = m.mesa;
      marcarTableroDeMesa(circulo, m.mesa);
      capaMuebles.append(circulo, rotulo);
    } else if (m.tipo === 'forma') {
      const rect = nodo('rect', { class: 'forma-' + m.forma, x: m.x * PASO + 1, y: m.y * PASO + 1,
        width: m.w * PASO - 2, height: m.h * PASO - 2, rx: 3 });
      const cx = (m.x + m.w / 2) * PASO, cy = (m.y + m.h / 2) * PASO;
      const rotulo = texto('rotulo forma-texto', cx, cy, m.texto);
      if (m.h > m.w) rotulo.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
      rect.dataset.pieza = rotulo.dataset.pieza = m.pieza;
      capaMuebles.append(rect, rotulo);
    } else if (m.tipo === 'rotulo') {
      capaMuebles.appendChild(texto('rotulo', (m.x + 0.5) * PASO, (m.y + 0.5) * PASO, m.texto));
    } else if (m.tipo === 'guia') {
      capaMuebles.appendChild(texto('rotulo guia', (m.x + 0.5) * PASO, (m.y + 0.5) * PASO, m.texto));
    } else if (m.tipo === 'subtitulo') {
      (m.lugar === 'margen' ? capaMuebles : capaSubtitulos).appendChild(dibujarSubtitulo(m));
    }
  }
  if (modo !== 'editor') return;
  // Borde superior de cada banda (y de cada banda dentro de una vertical) y borde
  // izquierdo de cada vertical que no empieza en la primera columna.
  for (const r of salaActual.regiones) {
    if (r.tipo === 'banda' && r.y > 0) {
      const x1 = r.profundidad ? r.x * PASO : 0;
      const x2 = r.profundidad ? (r.x + r.ancho) * PASO : (salaActual.ancho + 1) * PASO;
      capaMuebles.appendChild(nodo('line', { class: 'limite-banda', x1, y1: r.y * PASO, x2, y2: r.y * PASO }));
    }
    if (r.tipo === 'vertical' && r.x > 1) {
      capaMuebles.appendChild(nodo('line', { class: 'limite-vertical', x1: r.x * PASO, y1: r.y * PASO,
        x2: r.x * PASO, y2: (r.y + r.alto) * PASO }));
    }
  }
}

// En el margen, texto alineado a la derecha antes de la columna de rotulos. En un
// borde, una etiqueta con fondo sobre la linea, para que se lea encima del limite.
function dibujarSubtitulo(m) {
  if (m.lugar === 'margen') {
    const t = texto('subtitulo', -1, (m.y + 0.5) * PASO, m.texto);
    t.dataset.subtitulo = m.banda;
    return t;
  }
  const g = nodo('g', { class: 'subtitulo-borde' });
  g.append(nodo('rect', { x: m.x * PASO + 1.5, y: m.y * PASO - 2, width: m.texto.length * 1.8 + 3, height: 4, rx: 1.2 }),
           texto('', m.x * PASO + 3, m.y * PASO, m.texto));
  g.dataset.subtitulo = m.banda;
  if (m.vertical) g.dataset.vertical = m.vertical;
  return g;
}

// Cada capa (banda, vertical o franja) tiene su color, por su orden en el arbol.
// Todos pasan 3:1 contra el fondo del plano y ninguno es el azul de las piezas,
// el rojo de ocupada ni el verde de la sombra.
const COLORES_DE_CAPA = ['#fbbf24', '#a78bfa', '#2dd4bf', '#f472b6', '#fb923c', '#22d3ee', '#bef264', '#e879f9'];
// El color es de la **zona**: dos bandas que comparten zona se ven del mismo color, en el
// panel y en el plano, porque comparten nombre y precio. Las que no tienen zona (un
// espacio sin precio, una franja o una vertical) toman el suyo por su orden en el árbol.
function colorDeCapa(id) {
  const banda = bandaDe(salaActual, id);
  const zona = banda && zonaDeBanda(banda);
  if (zona) {
    const i = Object.keys(zonas).indexOf(zona);
    return i < 0 ? null : COLORES_DE_CAPA[i % COLORES_DE_CAPA.length];
  }
  const i = capasDe(salaActual.bandas).indexOf(id);
  return i < 0 ? null : COLORES_DE_CAPA[i % COLORES_DE_CAPA.length];
}

// Contorno de la banda seleccionada y su subtitulo resaltado. Solo en el editor.
// Su nombre se muda a una etiqueta rellena en el borde inferior, en la capa mas
// alta del plano: no la tapan butacas, mesas ni piezas. El subtitulo de siempre se
// oculta mientras (salvo uno compartido con su vertical, que tambien nombra a la otra).
function dibujarSeleccionBanda() {
  capaSeleccion.textContent = '';
  capaRotuloSeleccion.textContent = '';
  const activa = modo === 'editor' ? bandaActiva : null;
  const color = activa && colorDeCapa(activa);
  for (const n of svg.querySelectorAll('[data-subtitulo]')) {
    const compartido = Boolean(n.dataset.vertical) && n.dataset.vertical !== n.dataset.subtitulo;
    n.classList.toggle('oculta', Boolean(color) && !compartido && n.dataset.subtitulo === activa);
  }
  const r = color && salaActual.regiones.find((region) => region.id === activa && region.tipo !== 'resto');
  if (!r) return;
  const contorno = nodo('rect', { class: 'contorno-banda', x: r.x * PASO + 0.7, y: r.y * PASO + 0.7,
    width: r.ancho * PASO - 1.4, height: r.alto * PASO - 1.4, rx: 2 });
  contorno.style.setProperty('--capa', color);
  capaSeleccion.appendChild(contorno);
  const nombre = bandaDe(salaActual, activa).nombre;
  const abajo = (r.y + r.alto) * PASO;
  const rotulo = nodo('g', { class: 'rotulo-seleccion', 'aria-hidden': 'true' });
  rotulo.append(nodo('rect', { x: r.x * PASO + 1.5, y: abajo - 3, width: nombre.length * 2.3 + 4, height: 6, rx: 1.5 }),
                texto('', r.x * PASO + 3.5, abajo, nombre));
  rotulo.style.setProperty('--capa', color);
  capaRotuloSeleccion.appendChild(rotulo);
}

// El icono de butaca en la celda (x, y), girado 'mira' grados sobre su centro:
// hacia el tablero en un lugar de mesa, hacia el escenario en una butaca de fila.
function glifoButaca(x, y, mira = 0) {
  const glifo = nodo('use', { href: '#butaca',
    x: x * PASO + (PASO - GLIFO) / 2, y: y * PASO + (PASO - GLIFO) / 2, width: GLIFO, height: GLIFO });
  if (mira) glifo.setAttribute('transform', `rotate(${mira} ${(x + 0.5) * PASO} ${(y + 0.5) * PASO})`);
  return glifo;
}

// La marca de estado de una butaca: la palomita de elegida, el aspa de ocupada o la raya
// de bloqueada. Se pone encima del glifo, asi que va como ultimo hijo.
function ponerMarca(b) {
  if (b.nodo.querySelector('.marca')) return;
  const libre = b.estado === 'libre';
  const cual = libre ? 'elegida' : b.estado;
  const marca = nodo('use', { class: 'marca marca-' + cual, href: '#marca-' + cual,
    x: b.x * PASO + (PASO - GLIFO) / 2, y: b.y * PASO + (PASO - GLIFO) / 2,
    width: GLIFO, height: GLIFO });
  // El hueco del icono, donde va la marca, es horizontal con el asiento a 0 o
  // 180 grados y vertical a 90 o 270. Solo en esos dos giros la marca gira con
  // el asiento: derecha no cabe en el hueco y se pisa con respaldo y asiento.
  if (b.mira % 180 === 90) {
    marca.setAttribute('transform', `rotate(${b.mira} ${(b.x + 0.5) * PASO} ${(b.y + 0.5) * PASO})`);
  }
  b.nodo.appendChild(marca);
}

let origenButacasDibujadas = null;
function dibujarButacas() {
  // Un mismo id puede representar otro lugar en otro mapa. La reutilizacion solo
  // vale dentro de la misma definicion; al cambiarla se dibuja desde cero.
  const origen = TIPOS_DE_SALA[tipoActual];
  if (origen !== origenButacasDibujadas) capaButacas.textContent = '';
  origenButacasDibujadas = origen;
  const anteriores = new Map([...capaButacas.children].map((g) => [g.dataset.id, g]));
  porId.clear();
  const bloqueando = modo === 'editor' && herramienta === 'bloquear';
  const pintando = modo === 'editor' && herramienta === 'zona';
  const pincel = document.getElementById('zona-pincel').value;
  // En el primer dibujo se injerta un fragmento. En los siguientes, cada id conserva
  // su nodo, foco y lugar en el arbol si no cambio; solo se mueven los que cambiaron
  // de orden y se quitan los ids que ya no existen.
  const trozo = anteriores.size ? null : document.createDocumentFragment();
  let siguiente = capaButacas.firstElementChild;
  butacas.forEach((b, indice) => {
    const seleccionable = b.estado === 'libre';
    const elegida = elegidas.has(b.id);
    // Al bloquear, cada butaca es un checkbox de «bloqueada»; las ocupadas no se tocan.
    // Con el pincel, cada butaca es un checkbox de «de la zona elegida», marcada con la
    // palomita si ya es de esa zona. Las ocupadas no cambian de zona.
    const dePincel = pintando && b.zona === pincel;
    const marcada = bloqueando ? b.estado === 'bloqueada' : pintando ? dePincel : elegida;
    const inactiva = bloqueando || pintando ? b.estado === 'ocupada' : !seleccionable;
    const g = anteriores.get(b.id) || nodo('g', { role: 'checkbox' });
    if (!anteriores.has(b.id)) {
      g.dataset.id = b.id;
      // El area sensible ocupa exactamente la celda. El glifo queda encima.
      g.appendChild(nodo('rect', { class: 'toque', x: b.x * PASO, y: b.y * PASO,
        width: PASO, height: PASO, rx: 2 }));
      g.appendChild(glifoButaca(b.x, b.y, b.mira));
    }
    const geometria = b.x + ',' + b.y + ',' + b.mira;
    const cambioGeometria = g._geometria !== undefined && g._geometria !== geometria;
    if (cambioGeometria) {
      g.firstElementChild.setAttribute('x', b.x * PASO);
      g.firstElementChild.setAttribute('y', b.y * PASO);
      g.replaceChild(glifoButaca(b.x, b.y, b.mira), g.children[1]);
    }
    g._geometria = geometria;
    const pieza = b.grupo ? b.grupo.id : b.bloque || b.suelta || '';
    const clase = 'butaca' + (seleccionable ? '' : ' ' + b.estado) +
      (elegida || dePincel ? ' elegida' : '') +
      (piezasActivas.has(pieza) && modo === 'editor' && !conButacas() ? ' de-pieza-activa' : '');
    const etiqueta = etiquetaDe(b) + (bloqueando
      ? (b.estado === 'ocupada' ? ', ocupada' : ', bloquear')
      : pintando ? ', zona ' + zonas[b.zona].nombre + (b.estado === 'ocupada' ? ', ocupada' : '')
      : (seleccionable ? '' : ', ' + b.estado));
    // tabindex movil: un solo punto de tabulacion. Colocando mesas, ninguno.
    const tabindex = (modo === 'vista' || bloqueando || pintando) && indice === 0 ? '0' : '-1';
    const apariencia = [clase, marcada, inactiva, etiqueta, tabindex, pieza].join('\u0000');
    if (g._apariencia !== apariencia) {
      g.setAttribute('class', clase);
      g.setAttribute('aria-checked', String(marcada));
      g.setAttribute('aria-label', etiqueta);
      g.setAttribute('tabindex', tabindex);
      if (inactiva) g.setAttribute('aria-disabled', 'true');
      else g.removeAttribute('aria-disabled');
      if (pieza) g.dataset.pieza = pieza;
      else delete g.dataset.pieza;
      g._apariencia = apariencia;
    }
    b.nodo = g;
    porId.set(b.id, b);
    // La marca solo se crea si se va a ver. La de una butaca libre sin elegir estaba ahi
    // igualmente, oculta por CSS: en un recinto grande son 18.000 nodos que nadie mira, la
    // cuarta parte del plano. Al elegirla la pone 'alternar'.
    const marca = !seleccionable ? b.estado : elegida || dePincel ? 'elegida' : null;
    const anterior = g.lastElementChild?.classList.contains('marca') ? g.lastElementChild : null;
    if (!marca) anterior?.remove();
    else if (cambioGeometria || anterior?.getAttribute('href') !== '#marca-' + marca) {
      anterior?.remove();
      ponerMarca(b);
    }
    if (trozo) trozo.appendChild(g);
    else if (g === siguiente) siguiente = siguiente.nextElementSibling;
    else capaButacas.insertBefore(g, siguiente);
  });
  if (trozo) capaButacas.appendChild(trozo);
  for (const [id, g] of anteriores) if (!porId.has(id)) g.remove();
}

// Solo en el editor: una zona por pieza (mesa o bloque de filas) que cubre toda su
// huella. Es lo que se agarra con el raton y lo que recibe el foco con el teclado.
const etiquetaPieza = (m) => (esEscenario(m)
  ? 'Escenario, ' + m.ancho + ' × ' + m.alto + ' celdas'
  : esMesaRedonda(m)
  ? m.nombre + ', redonda, ' + plural(m.lugares, 'lugar', 'lugares') + (m.giro ? ', girada ' + m.giro + '°' : '')
  : esForma(m)
  ? m.nombre + ', ' + FORMAS[m.forma].nombre.toLowerCase() + ' de ' + m.ancho + ' × ' + m.alto + ' celdas'
  : esButacaSuelta(m)
  ? m.nombre + ', zona ' + zonas[m.zonaEfectiva].nombre + (m.giro ? ', girada ' + m.giro + '°' : '')
  : esBloqueFilas(m)
  ? m.nombre + ', bloque de ' + m.filas + ' × ' + m.ancho + ' butacas, zona ' + zonas[m.zonaEfectiva].nombre +
    (m.giro ? ', girado ' + m.giro + '°' : '')
  : m.nombre + ', ' + m.geo.lugares.length + ' lugares' +
    (m.giro ? ', girada ' + m.giro + '°' : '') + (m.cabeceras ? ', con cabeceras' : '') +
    (m.unLado ? ', un solo lado' : '')) + ', columna ' + m.x + ', fila ' + m.y;

function dibujarPiezas() {
  if (modo !== 'editor' || conButacas()) return;
  const piezas = [...(escenario.ausente ? [] : [escenario]), ...mesas, ...bloquesFilas, ...formas, ...butacasSueltas];
  // Si la pieza activa ya no existe (se elimino), el punto de tabulacion va a la primera.
  const hayActiva = piezas.some((m) => m.id === mesaActiva);
  piezas.forEach((m, indice) => {
    // Varias pueden estar seleccionadas; la principal es la que lleva el tabindex.
    const activa = piezasActivas.has(m.id);
    const principal = m.id === mesaActiva;
    const pieza = nodo('rect', {
      class: 'pieza' + (activa ? ' activa' : ''), x: m.x * PASO + 0.5, y: m.y * PASO + 0.5,
      width: m.geo.ancho * PASO - 1, height: m.geo.alto * PASO - 1, rx: 3,
      role: 'button', 'aria-label': etiquetaPieza(m), 'aria-describedby': 'pista',
      'aria-pressed': String(activa),
      tabindex: (hayActiva ? principal : indice === 0) ? '0' : '-1',
    });
    pieza.dataset.pieza = m.id;
    capaPiezas.appendChild(pieza);
  });
}

function dibujarTodo() {
  if (herramienta === 'zona') llenarPincel();
  capaMuebles.textContent = '';
  capaSubtitulos.textContent = '';
  capaPiezas.textContent = '';
  dibujarMuebles();
  dibujarButacas();
  dibujarPiezas();
  dibujarBandas();
  dibujarZonas();
  dibujarSeleccionBanda();
  dibujarTiradores();
}
