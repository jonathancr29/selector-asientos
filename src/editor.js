// ---------------------------------------------------------------------------
// Modo editor: colocar, girar, alargar, agregar y eliminar mesas.
// ---------------------------------------------------------------------------
let modo = 'vista';        // 'vista' (previsualizar, como quien compra) o 'editor'
let arrastreMesa = null;
let mesaActiva = null;     // id de la mesa sobre la que actuan los botones y atajos
// Varias piezas a la vez: 'piezasActivas' las tiene todas y 'mesaActiva' es la principal
// (la ultima que se toco), que es la que mandan los controles de una sola pieza.
const piezasActivas = new Set();
let herramienta = 'mesas'; // en el editor: 'mesas' (colocar), 'bloquear' o 'zona' (butacas)
// Las herramientas que trabajan sobre butacas: las butacas responden y se recorren.
const conButacas = () => herramienta === 'bloquear' || herramienta === 'zona';
let bandaActiva = null;    // id de la banda, vertical o franja seleccionada (excluye a mesaActiva)
let tipoActual, salaActual;
// Plano guardado por tipo de sala: { 'mixta-ambos': { bandas, mesas, siguiente,
// siguienteBanda } }. Cada tipo tiene el suyo; editar uno no toca los otros.
// 'siguiente' y 'siguienteBanda' solo crecen: un id nuevo nunca reutiliza el de
// una mesa o banda eliminada.
const planos = {};
const historiales = Object.create(null);
let restaurandoHistorial = false;

// 'mesaActiva' guarda el id de la pieza activa: mesa (M3), bloque (F2), forma (P1),
// butaca suelta (B4) o el escenario.
const piezaPorId = (id) => (id === 'escenario' ? (escenario.ausente ? null : escenario)
  : [...mesas, ...bloquesFilas, ...formas, ...butacasSueltas].find((p) => p.id === id) || null);
const anunciar = (mensaje) => { document.getElementById('estado').textContent = mensaje; };
const configDePieza = (p) => (esEscenario(p) ? { id: 'escenario', tipo: 'escenario', ...configDeEscenario(p) }
  : esBloqueFilas(p) ? configDeBloque(p) : esForma(p) ? configDeForma(p)
  : esButacaSuelta(p) ? configDeButaca(p) : configDeMesa(p));
// Concordancia: «Mesa 3 movida», «Bloque 2 movido».
const genero = (p) => (esBloqueFilas(p) || esEscenario(p) ? 'o' : 'a');
const resumenDePieza = (p) => (esEscenario(p) || esForma(p) ? p.ancho + ' × ' + p.alto + ' celdas'
  : esMesaRedonda(p) ? 'redonda, ' + plural(p.lugares, 'lugar', 'lugares')
  : esButacaSuelta(p) ? 'zona ' + zonas[p.zonaEfectiva].nombre : esBloqueFilas(p)
  ? p.filas + ' × ' + p.ancho + ' butacas'
  : p.geo.lugares.length + ' lugares');

// Sombra del destino: contorno de la huella, tablero y lugares. Se rehace con la
// forma de la mesa al empezar cada arrastre y se desplaza con transform.
const sombra = nodo('g', { class: 'sombra oculta', 'aria-hidden': 'true' });
svg.appendChild(sombra);

// La sombra del destino. Recibe una lista de { geo, dx, dy }: al arrastrar varias
// piezas, cada una va en su sitio relativo a la que se agarró, así que el grupo entero
// se ve donde va a caer.
function construirSombra(piezas) {
  sombra.textContent = '';
  for (const { geo, dx: cx = 0, dy: cy = 0 } of piezas) {
    const { ancho, alto, tablero, lugares, redonda } = geo;
    const g = nodo('g', { transform: 'translate(' + cx * PASO + ' ' + cy * PASO + ')' });
    g.appendChild(nodo('rect', { class: 'contorno', x: 0.5, y: 0.5,
      width: ancho * PASO - 1, height: alto * PASO - 1, rx: 3 }));
    if (redonda) {
      g.appendChild(nodo('circle', { class: 'tablero', cx: (redonda.dx + redonda.diametro / 2) * PASO,
        cy: (redonda.dy + redonda.diametro / 2) * PASO, r: (redonda.diametro * PASO) / 2 - 1 }));
    }
    if (tablero) {   // los bloques de filas no tienen tablero
      g.appendChild(nodo('rect', { class: 'tablero', x: tablero.dx * PASO + 1, y: tablero.dy * PASO + 1,
        width: tablero.w * PASO - 2, height: tablero.h * PASO - 2, rx: 4 }));
    }
    for (const { dx, dy, mira } of lugares) g.appendChild(glifoButaca(dx, dy, mira));
    sombra.appendChild(g);
  }
}

// Marca la pieza activa sin redibujar: solo clases, aria-pressed y botones.
function marcarActiva(id) {
  marcarActivas(id ? [id] : []);
}

// Marca varias: la ultima de la lista es la principal.
function marcarActivas(ids) {
  piezasActivas.clear();
  for (const id of ids) piezasActivas.add(id);
  mesaActiva = ids.length ? ids[ids.length - 1] : null;
  if (mesaActiva && bandaActiva) marcarBandaActiva(null);
  pintarActivas();
  actualizarControles();
}

// Ctrl (o Cmd) + clic: mete o saca una pieza de la seleccion sin tocar las demas.
function alternarPiezaActiva(id) {
  const ids = [...piezasActivas];
  const fuera = ids.filter((x) => x !== id);
  marcarActivas(piezasActivas.has(id) ? fuera : [...ids, id]);
  const pieza = piezaPorId(id);
  anunciar(pieza.nombre + (piezasActivas.has(id) ? ' añadida a la selección: ' : ' fuera de la selección: ') +
           (piezasActivas.size ? plural(piezasActivas.size, 'pieza seleccionada', 'piezas seleccionadas') + '.'
                               : 'ninguna pieza seleccionada.'));
}

function pintarActivas() {
  for (const p of capaPiezas.querySelectorAll('.pieza')) {
    const activa = piezasActivas.has(p.dataset.pieza);
    p.classList.toggle('activa', activa);
    p.setAttribute('aria-pressed', String(activa));
  }
  // Las butacas de la pieza se marcan con ella: una mesa y sus lugares son una sola cosa.
  for (const b of capaButacas.querySelectorAll('.butaca')) {
    b.classList.toggle('de-pieza-activa', piezasActivas.has(b.dataset.pieza));
  }
}

const botonesDeMesa = () => document.querySelectorAll('#herramientas-editor [data-accion]');

// Que acciones tiene cada tipo de pieza.
const ACCIONES_DE = {
  mesa: new Set(['girar', 'alargar', 'acortar', 'cabeceras', 'unlado', 'duplicar', 'eliminar']),
  bloque: new Set(['girar', 'alargar', 'acortar', 'masfilas', 'menosfilas', 'duplicar', 'eliminar']),
  escenario: new Set(['girar', 'alargar', 'acortar', 'masfilas', 'menosfilas']),
  forma: new Set(['girar', 'alargar', 'acortar', 'masfilas', 'menosfilas', 'duplicar', 'eliminar']),
  butaca: new Set(['girar', 'duplicar', 'eliminar']),
  redonda: new Set(['girar', 'alargar', 'acortar', 'duplicar', 'eliminar']),
};
const tipoDePieza = (p) => (esEscenario(p) ? 'escenario' : esBloqueFilas(p) ? 'bloque'
  : esForma(p) ? 'forma' : esButacaSuelta(p) ? 'butaca' : esMesaRedonda(p) ? 'redonda' : 'mesa');
const aplica = (accion, p) => ACCIONES_DE[tipoDePieza(p)].has(accion);

function actualizarControles() {
  const m = mesaActiva && piezaPorId(mesaActiva);
  const varias = piezasActivas.size > 1;
  const todas = [...piezasActivas].map((id) => piezaPorId(id)).filter(Boolean);
  // Lo que comparten todas: si no coinciden, el control lo dice con «—» o «mixta».
  const comun = (valor) => {
    const valores = new Set(todas.map(valor));
    return valores.size === 1 ? [...valores][0] : undefined;
  };
  document.getElementById('mesa-activa').textContent = varias
    ? plural(piezasActivas.size, 'pieza seleccionada', 'piezas seleccionadas') + ': mover, duplicar o eliminar'
    : m ? m.nombre + ' · ' + resumenDePieza(m) : 'Ninguna pieza seleccionada';
  const bloque = esBloqueFilas(m), forma = esForma(m), suelta = esButacaSuelta(m), redonda = esMesaRedonda(m);
  for (const boton of botonesDeMesa()) {
    const accion = boton.dataset.accion;
    const deEscenario = esEscenario(m);
    // Largo: ancho del escenario, de una forma o de un bloque; lugares en una mesa redonda.
    const largo = bloque || deEscenario || forma ? m.ancho : redonda ? m.lugares : m && m.largo;
    const minimo = redonda ? LUGARES_MINIMOS_REDONDA : 1;
    const maximo = deEscenario ? ESCENARIO_ANCHO_MAXIMO : forma ? FORMA_ANCHO_MAXIMO
      : bloque ? ANCHO_BLOQUE_MAXIMO : redonda ? LUGARES_MAXIMOS_REDONDA : LARGO_MAXIMO;
    const filas = deEscenario || forma ? m.alto : m && m.filas;
    const filasMaximas = deEscenario ? ESCENARIO_ALTO_MAXIMO : forma ? FORMA_ALTO_MAXIMO : FILAS_MAXIMAS;
    // Con varias seleccionadas, una acción solo se ofrece si todas la admiten.
    boton.disabled = !m || !aplica(accion, m) ||
      (varias && !todas.every((p) => aplica(accion, p))) ||
      (accion === 'alargar' && largo >= maximo) ||
      (accion === 'acortar' && largo <= minimo) ||
      (accion === 'masfilas' && filas >= filasMaximas) ||
      (accion === 'menosfilas' && filas <= 1);
    if (accion === 'cabeceras') boton.setAttribute('aria-pressed', String(Boolean(m && m.cabeceras)));
    if (accion === 'unlado') boton.setAttribute('aria-pressed', String(Boolean(m && m.unLado)));
  }
  const botonEscenario = document.getElementById('alternar-escenario');
  const textoEscenario = escenario.ausente ? 'Agregar escenario' : 'Quitar escenario';
  botonEscenario.setAttribute('aria-label', textoEscenario);
  botonEscenario.dataset.tooltip = textoEscenario;
  botonEscenario.querySelector('use').setAttribute('href', escenario.ausente ? '#i-escenario-agregar' : '#i-escenario-quitar');
  // Venta por mesa o por butacas: solo para mesas. Con varias, «Venta mixta» cuando no
  // coinciden; elegir una opción la aplica a todas.
  const venta = document.getElementById('venta-mesa');
  const soloMesas = todas.length > 0 && todas.every((p) => esMesa(p) && !esEscenario(p));
  const deMesa = varias ? soloMesas : Boolean(m) && esMesa(m) && !esEscenario(m);
  venta.disabled = !deMesa;
  const mixta = varias && deMesa && comun((p) => Boolean(p.completa)) === undefined;
  venta.querySelector('option[value="mixta"]')?.remove();
  if (mixta) venta.insertBefore(new Option('Venta mixta', 'mixta'), venta.firstChild);
  venta.value = mixta ? 'mixta' : (deMesa && (varias ? comun((p) => Boolean(p.completa)) : m.completa) ? 'mesa' : 'butacas');
  document.getElementById('completa-todas').disabled = !deMesa;
  // Zona: mesas, bloques y butacas sueltas (lo que tiene butacas). Nombre: bloques y
  // formas. No se pisa lo que se esta escribiendo.
  const zona = document.getElementById('zona-pieza');
  const nombre = document.getElementById('nombre-pieza');
  // Zona: con varias, la de todas si coinciden y «—» si no. El nombre es de cada pieza,
  // así que con varias no se edita.
  const conZona = varias
    ? todas.length > 0 && todas.every((p) => !esForma(p) && !esEscenario(p))
    : Boolean(m) && (bloque || suelta || deMesa);
  zona.disabled = !conZona;
  nombre.disabled = varias || !(bloque || forma);
  const propia = varias ? comun((p) => p.zona || '') : conZona ? m.zona : null;
  const heredada = varias ? comun((p) => zonaEnCelda(salaActual, p.x, p.y))
    : conZona ? zonaEnCelda(salaActual, m.x, m.y) : null;
  llenarZonasDeFilas(zona, propia || null, { heredada: heredada || null, conMesas: deMesa,
                                             mezcla: propia === undefined });
  if (document.activeElement !== nombre) {
    nombre.value = !varias && (bloque || forma) ? m.nombrePropio || '' : '';
    nombre.placeholder = varias ? 'El nombre es de cada pieza' : 'Ej.: Lateral izquierdo';
  }
}

// Atenua la mesa original (tablero, rotulo y lugares) mientras se arrastra.
// Al soltar se limpia todo el plano, no solo esa mesa: no pueden quedar restos.
function levantar(id, si) {
  const selector = si ? '[data-pieza="' + id + '"]:not(.pieza)' : '.levantada';
  for (const n of svg.querySelectorAll(selector)) n.classList.toggle('levantada', si);
}

const celdaBajo = (e) => {
  const u = enUnidades(e);
  return { x: Math.floor(u.x / PASO), y: Math.floor(u.y / PASO) };
};

function iniciarArrastreMesa(pieza, e) {
  const mesa = piezaPorId(pieza.dataset.pieza);
  const agarrada = celdaBajo(e);
  // Agarrar una pieza del grupo arrastra el grupo; agarrar otra empieza de cero.
  const grupo = piezasActivas.size > 1 && piezasActivas.has(mesa.id)
    ? [...piezasActivas].map((id) => piezaPorId(id)).filter(Boolean) : [mesa];
  if (grupo.length === 1) marcarActiva(mesa.id);
  construirSombra(grupo.map((p) => ({ geo: p.geo, dx: p.x - mesa.x, dy: p.y - mesa.y })));
  for (const p of grupo) levantar(p.id, true);
  return {
    mesa, grupo, pointerId: e.pointerId, x: e.clientX, y: e.clientY, movido: 0, destino: null,
    // En que celda de la mesa se agarro: asi no salta a la esquina del puntero.
    agarre: { dx: agarrada.x - mesa.x, dy: agarrada.y - mesa.y },
    ocupadas: celdasOcupadas(new Set(grupo.map((p) => p.id))),
  };
}

function moverSombra(e) {
  const a = arrastreMesa;
  a.movido = Math.max(a.movido, Math.abs(e.clientX - a.x) + Math.abs(e.clientY - a.y));
  if (a.movido <= 4) return;   // un clic no es un arrastre
  const c = celdaBajo(e);
  const x = c.x - a.agarre.dx, y = c.y - a.agarre.dy;
  // Con el plano sin tamaño (oculto) la celda no se puede calcular: nunca se
  // guarda una posicion que no sea un numero.
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (a.destino && a.destino.x === x && a.destino.y === y) return;
  // Con varias, el destino solo vale si caben todas: la sombra se pone roja en cuanto
  // una estorba, y el aviso dice cuál.
  const dx = x - a.mesa.x, dy = y - a.mesa.y;
  let motivo = null;
  for (const p of a.grupo) {
    const suyo = motivoNoCabe(salaActual, a.ocupadas, { ...configDePieza(p), x: p.x + dx, y: p.y + dy });
    if (!suyo) continue;
    motivo = a.grupo.length > 1 ? p.nombre + ' ' + suyo : suyo;
    break;
  }
  a.destino = { x, y, motivo };
  sombra.setAttribute('transform', 'translate(' + x * PASO + ' ' + y * PASO + ')');
  sombra.classList.toggle('invalida', Boolean(a.destino.motivo));
  sombra.classList.remove('oculta');
  svg.classList.add('moviendo-mesa');
  levantar(a.mesa.id, true);
}

function terminarArrastreMesa(confirmar) {
  const a = arrastreMesa;
  arrastreMesa = null;
  sombra.classList.add('oculta');
  svg.classList.remove('moviendo-mesa');
  levantar(null, false);
  // Un clic seco (sin arrastrar) en una pieza del grupo deja seleccionada solo esa: es
  // la forma de salir de la selección múltiple sin tener que ir al fondo.
  if (confirmar && !a.destino && a.grupo.length > 1) {
    marcarActiva(a.mesa.id);
    anunciar(a.mesa.nombre + ' seleccionada, sola.');
  }
  if (!confirmar || !a.destino) return;
  const { x, y, motivo } = a.destino;
  if (x === a.mesa.x && y === a.mesa.y) return;
  if (motivo) {
    anunciar((a.grupo.length > 1 ? 'No se movieron: ' : a.mesa.nombre + ' no se movió: ') + motivo + '.');
    return;
  }
  if (a.grupo.length > 1) {
    moverPiezasActivas({ dx: x - a.mesa.x, dy: y - a.mesa.y, hacia: 'donde se soltó' });
    return;
  }
  moverMesa(a.mesa.id, x, y);
}

function moverMesaConTeclado(id, flecha) {
  if (piezasActivas.size > 1 && piezasActivas.has(id)) {
    moverPiezasActivas(flecha);
    return;
  }
  const { dx, dy, hacia } = flecha;
  const m = piezaPorId(id);
  const hueco = buscarHueco(salaActual, celdasOcupadas(id), configDePieza(m), dx, dy);
  if (!hueco) {
    anunciar(m.nombre + ' no tiene hueco libre hacia ' + hacia + '.');
    return;
  }
  moverMesa(id, hueco.x, hueco.y);
  // El DOM se rehizo: el foco vuelve a la misma mesa, y 'focusin' la encuadra.
  capaPiezas.querySelector('[data-pieza="' + id + '"]').focus();
}

// El plano del tipo de sala actual, creado desde lo que se ve la primera vez
// que se edita.
function fotoDelPlano() {
  const plano = planos[tipoActual] || null;
  return { plano: plano ? JSON.stringify(plano) : null,
           firma: JSON.stringify(plano || planoDesdeSala(tipoActual, salaActual)) };
}

function actualizarEstadoEdicion() {
  const historial = historiales[tipoActual];
  document.getElementById('deshacer').disabled = !historial || !historial.puedeDeshacer();
  document.getElementById('rehacer').disabled = !historial || !historial.puedeRehacer();
  document.getElementById('estado-guardado').textContent = historial && historial.tieneCambios()
    ? 'Cambios sin guardar en este plano.' : 'Sin cambios pendientes.';
}

function restaurarEdicion(accion) {
  const historial = historiales[tipoActual];
  const estado = historial && historial[accion]();
  if (!estado) return;
  if (estado.plano === null) delete planos[tipoActual];
  else planos[tipoActual] = JSON.parse(estado.plano);
  restaurandoHistorial = true;
  try {
    regenerar(accion === 'deshacer' ? 'Último cambio deshecho.' : 'Cambio rehecho.');
  } finally {
    restaurandoHistorial = false;
  }
  calcularEncuadre();
}

function planoEditable() {
  if (!planos[tipoActual]) planos[tipoActual] = planoDesdeSala(tipoActual, salaActual);
  return planos[tipoActual];
}

// Las configuraciones son datos: se guardan y el plano se regenera desde ellas.
// Si al regenerar desaparecen lugares (acortar, quitar cabeceras, eliminar, bandas),
// se avisa de los elegidos que se soltaron y de los ocupados que se quitaron.
const fotoDeButacas = () => butacas.map((b) => ({ id: b.id, estado: b.estado }));

// 'antes' se puede pasar hecho cuando el plano ya se genero para validarlo.
function regenerar(mensaje, antes = fotoDeButacas()) {
  salaActual = generarPlano(tipoActual, planos[tipoActual]);
  // Una pieza que quedo fuera de toda banda con zona no tiene de quien heredar: se le
  // escribe la suya y se dice, que cambia su precio.
  let sueltas = { fijadas: [] };
  if (planos[tipoActual]) {
    sueltas = fijarZonasSueltas(planos[tipoActual], salaActual);
    if (sueltas.fijadas.length) {
      planos[tipoActual] = sueltas.plano;
      salaActual = generarPlano(tipoActual, sueltas.plano);
    }
  }
  const existe = new Set(butacas.map((b) => b.id));
  const { ausentes, noLibres } = conciliarSeleccion(elegidas, butacas);
  const completadas = completarMesasElegidas(elegidas, butacas);
  const ocupadasQuitadas = antes.filter((b) => b.estado === 'ocupada' && !existe.has(b.id))
                                .map((b) => b.id);
  for (const id of [...piezasActivas]) if (!piezaPorId(id)) piezasActivas.delete(id);
  if (!piezaPorId(mesaActiva)) mesaActiva = [...piezasActivas].pop() || null;
  if (bandaActiva && !ubicar(salaActual.bandas, bandaActiva)) bandaActiva = null;
  dibujarTodo();
  actualizarResumen();
  actualizarAforo(salaActual);
  actualizarControles();
  if (!restaurandoHistorial) historiales[tipoActual].registrar(fotoDelPlano());
  actualizarEstadoEdicion();
  anunciar(mensaje);
  document.getElementById('aviso').textContent = [
    frase(ausentes, 'ya no existe en el plano', 'ya no existen en el plano'),
    frase(noLibres, 'ya no está libre', 'ya no están libres'),
    ocupadasQuitadas.length
      ? 'Atención: se quitaron lugares ocupados: ' + ocupadasQuitadas.join(', ') + '.' : '',
    completadas.length ? 'Se venden completas, así que se eligieron todos sus lugares: ' + completadas.join(', ') + '.' : '',
    sueltas.fijadas.length
      ? 'Fuera de toda zona, así que se les asignó ' + zonas[sueltas.zona].nombre + ': ' +
        sueltas.fijadas.join(', ') + '.' : '',
  ].filter(Boolean).join(' ');
}

function reemplazarMesa(config) {
  const plano = planoEditable();
  if (esEscenario(config)) {
    plano.escenario = configDeEscenario(config);
    return;
  }
  const { lista } = listaDeId(config.id);
  plano[lista] = plano[lista].map((c) => (c.id === config.id ? config : c));
}

// Los lugares conservan su id al mover, asi que la seleccion y las reservas no se pierden.
function moverMesa(id, x, y) {
  const m = piezaPorId(id);
  reemplazarMesa({ ...configDePieza(m), x, y });
  regenerar(m.nombre + ' movid' + genero(m) + ' a columna ' + x + ', fila ' + y + '.');
}

const posicionTexto = (antes, despues) =>
  (antes.x === despues.x && antes.y === despues.y ? ''
    : ' Se desplazó a columna ' + despues.x + ', fila ' + despues.y + ' para caber.');

// Girar, alargar, acortar y cabeceras: se calcula la configuracion nueva, se
// coloca en su sitio o en el mas cercano, y si no cabe se anuncia por que.
const TRANSFORMACIONES = {
  girar:     { calcular: (c) => (esEscenario(c) || esForma(c) ? girarEscenario(c) : girarPieza(c)),
               fallo: (m) => 'No se pudo girar ' + m.nombre,
               hecho: (m) => (esEscenario(m) || esForma(m) ? 'girad' + genero(m) + ' 90°'
                 : m.giro ? 'girad' + genero(m) + ' ' + m.giro + '°' : 'de vuelta a su posición original') },
  alargar:   { calcular: (c) => (esEscenario(c) ? cambiarTamanoEscenario(c, 1, 0) : esForma(c) ? cambiarTamanoForma(c, 1, 0)
                 : esMesaRedonda(c) ? cambiarLugaresRedonda(c, 1)
                 : esBloqueFilas(c) ? cambiarAncho(c, 1) : cambiarLargo(c, 1)),
               tope: (m) => (esMesaRedonda(m) ? 'el máximo de lugares (' + LUGARES_MAXIMOS_REDONDA + ')' : 'el largo máximo'),
               fallo: (m) => 'No se pudo alargar ' + m.nombre,
               hecho: (m) => (esMesaRedonda(m) ? 'con dos lugares más' : 'alargad' + genero(m)) },
  acortar:   { calcular: (c) => (esEscenario(c) ? cambiarTamanoEscenario(c, -1, 0) : esForma(c) ? cambiarTamanoForma(c, -1, 0)
                 : esMesaRedonda(c) ? cambiarLugaresRedonda(c, -1)
                 : esBloqueFilas(c) ? cambiarAncho(c, -1) : cambiarLargo(c, -1)),
               tope: (m) => (esMesaRedonda(m) ? 'el mínimo de lugares (' + LUGARES_MINIMOS_REDONDA + ')' : 'el largo mínimo'),
               fallo: (m) => 'No se pudo acortar ' + m.nombre,
               hecho: (m) => (esMesaRedonda(m) ? 'con dos lugares menos' : 'acortad' + genero(m)) },
  masfilas:  { calcular: (c) => (esEscenario(c) ? cambiarTamanoEscenario(c, 0, 1)
                 : esForma(c) ? cambiarTamanoForma(c, 0, 1) : cambiarFilasBloque(c, 1)),
               tope: 'el máximo de filas',
               fallo: (m) => 'No se pudo agregar una fila a ' + m.nombre,
               hecho: () => 'con una fila más' },
  menosfilas:{ calcular: (c) => (esEscenario(c) ? cambiarTamanoEscenario(c, 0, -1)
                 : esForma(c) ? cambiarTamanoForma(c, 0, -1) : cambiarFilasBloque(c, -1)),
               tope: 'una sola fila',
               fallo: (m) => 'No se pudo quitar una fila a ' + m.nombre,
               hecho: () => 'con una fila menos' },
  cabeceras: { calcular: alternarCabeceras,
               fallo: (m) => (m.cabeceras ? 'No se pudieron quitar las cabeceras de '
                                          : 'No se pudieron poner cabeceras a ') + m.nombre,
               hecho: (m) => (m.cabeceras ? 'con cabeceras' : 'sin cabeceras') },
  unlado:    { calcular: alternarUnLado,
               fallo: (m) => 'No se pudieron poner lugares en el otro lado de ' + m.nombre,
               hecho: (m) => (m.unLado ? 'con lugares en un solo lado' : 'con lugares en los dos lados') },
};

// Como queda el grupo, en femenino plural: «2 piezas giradas». Los textos de una sola
// pieza concuerdan con ella («girada», «alargado»), asi que no sirven para varias.
const HECHO_EN_GRUPO = {
  girar: 'giradas 90°', alargar: 'alargadas', acortar: 'acortadas',
  masfilas: 'con una fila más', menosfilas: 'con una fila menos',
  cabeceras: 'con las cabeceras cambiadas', unlado: 'con los lados cambiados',
};

// Transforma todas las seleccionadas a la vez: cada una sobre su propio sitio (girar
// sobre su centro, alargar desde su ancla), y todo o nada. Aquí ninguna se desplaza para
// caber: mover una del grupo desbarataría su distancia con las demás.
function transformarPiezasActivas(accion) {
  const t = TRANSFORMACIONES[accion];
  const piezas = [...piezasActivas].map((id) => piezaPorId(id)).filter(Boolean);
  const configs = [];
  for (const m of piezas) {
    const nueva = t.calcular(configDePieza(m));
    if (!nueva) {
      anunciar(m.nombre + ' ya tiene ' + (typeof t.tope === 'function' ? t.tope(m) : t.tope) + '.');
      return;
    }
    configs.push(nueva);
  }
  const resultado = aplicarConfigs(planoEditable(), salaActual, configs);
  if (resultado.motivo) {
    anunciar('No se pudo: ' + resultado.motivo + '.');
    return;
  }
  planos[tipoActual] = resultado.plano;
  regenerar(plural(configs.length, 'pieza', 'piezas') + ' ' + HECHO_EN_GRUPO[accion] + '.' +
            (resultado.dx || resultado.dy ? ' El grupo se desplazó para caber.' : ''));
  const destino = capaPiezas.querySelector('[data-pieza="' + mesaActiva + '"]');
  if (destino) destino.focus();
}

function transformarMesa(id, accion) {
  const m = piezaPorId(id);
  const t = TRANSFORMACIONES[accion];
  const nueva = t.calcular(configDePieza(m));
  if (!nueva) {
    // 'tope' puede depender de la pieza (una mesa redonda cuenta lugares, no largo).
    anunciar(m.nombre + ' ya tiene ' + (typeof t.tope === 'function' ? t.tope(m) : t.tope) + '.');
    return;
  }
  const colocada = colocarCerca(salaActual, celdasOcupadas(id), nueva);
  if (colocada.motivo) {
    anunciar(t.fallo(m) + ': ' + colocada.motivo + '.');
    return;
  }
  reemplazarMesa(colocada);
  regenerar('');
  const despues = piezaPorId(id);
  anunciar(despues.nombre + ' ' + t.hecho(despues) + ': ' + resumenDePieza(despues) + '.' +
           posicionTexto(nueva, colocada));
}

// El camino que comparten las cuatro formas de agregar una pieza: el id y el contador de
// su lista (de LISTAS_DE_PIEZAS, nunca a mano), el primer hueco libre y, si cabe, a su
// lista y seleccionada. Lo unico propio de cada tipo es 'colocar', que recibe el hueco
// encontrado y devuelve la pieza que se guarda; 'buscarCon' le deja volver a buscar con
// otra configuracion, que es lo que necesita un bloque al girarse hacia el escenario.
// Devuelve { id, sitio } o null si no cabia, y entonces ya lo ha dicho.
function agregarPiezaNueva(prefijo, base, sinSitio, colocar = (sitio) => sitio) {
  const plano = planoEditable();
  const tipoDeLista = listaDeId(prefijo + '1');
  const id = prefijo + (plano[tipoDeLista.contador] || 1);
  const config = { id, x: 0, y: 0, ...base };
  const ocupadas = celdasOcupadas(null);
  const buscarCon = (extra) => buscarSitioLibre(salaActual, ocupadas, { ...config, ...extra });
  const hueco = buscarCon({});
  if (!hueco) {
    anunciar(sinSitio);
    return null;
  }
  const sitio = colocar(hueco, buscarCon);
  nuevoIdDe(plano, tipoDeLista);
  plano[tipoDeLista.lista] = [...(plano[tipoDeLista.lista] || []), sitio];
  marcarActivas([id]);
  return { id, sitio };
}

// Donde quedo, para el aviso.
const columnaYFila = (sitio) => 'columna ' + sitio.x + ', fila ' + sitio.y;

// Lleva a la vista la pieza recien agregada. Va despues de regenerar, que es cuando la
// pieza existe con su huella calculada.
function mostrarPiezaNueva(id) {
  const p = piezaPorId(id);
  if (p) asegurarVisible({ x: p.x, y: p.y, w: p.geo.ancho, h: p.geo.alto });
}

function agregarMesaNueva(estilo) {
  const nueva = agregarPiezaNueva('M', { ...ESTILOS[estilo], giro: 0 },
    'No hay sitio libre para otra mesa. Mueve o acorta alguna antes.');
  if (!nueva) return;
  regenerar('Mesa ' + nueva.id.slice(1) + (estilo === 'redonda' ? ' (redonda, 8 lugares)' : '') +
            ' agregada en ' + columnaYFila(nueva.sitio) + '.');
  mostrarPiezaNueva(nueva.id);
}

// Agrega un bloque de filas de 5 × 2 en el primer hueco libre, mirando al escenario.
function agregarBloqueNuevo() {
  // Sin zona: hereda la de la banda donde caiga (si no hay, regenerar le pone una).
  const nueva = agregarPiezaNueva('F', { tipo: 'filas', ancho: 5, filas: 2, giro: 0 },
    'No hay sitio libre para un bloque de 5 × 2. Haz espacio o agrega una zona de mesas.',
    // Se orienta hacia el escenario desde donde cupo derecho y se vuelve a buscar con ese
    // giro. Si girado no cabe en ningun sitio, se queda sin girar.
    (hueco, buscarCon) => {
      const giro = giroHaciaEscenario(hueco.x + 2.5, hueco.y + 1);
      return (giro && buscarCon({ giro })) || hueco;
    });
  if (!nueva) return;
  regenerar('Bloque ' + nueva.id.slice(1) + ' agregado en ' + columnaYFila(nueva.sitio) + '.');
  mostrarPiezaNueva(nueva.id);
}

// Duplica una mesa o bloque junto al original; la copia queda activa.
function duplicarPiezaPorId(id) {
  const m = piezaPorId(id);
  const plano = planoEditable();
  const tipoDeLista = listaDeId(id);
  const nuevoId = tipoDeLista.prefijo + (plano[tipoDeLista.contador] || 1);
  const resultado = duplicarPieza(plano, salaActual, id);
  if (resultado.motivo) {
    anunciar('No se pudo duplicar ' + m.nombre + ': ' + resultado.motivo + '.');
    return;
  }
  planos[tipoActual] = resultado;
  marcarActivas([nuevoId]);
  regenerar('');
  const copia = piezaPorId(nuevoId);
  anunciar(m.nombre + ' duplicad' + genero(m) + ': ' + copia.nombre + ' en columna ' + copia.x + ', fila ' + copia.y + '.');
  asegurarVisible({ x: copia.x, y: copia.y, w: copia.geo.ancho, h: copia.geo.alto });
}

// Butaca suelta de la zona General en el primer hueco libre, mirando al escenario.
function agregarButacaNueva() {
  const nueva = agregarPiezaNueva('B', { tipo: 'butaca', giro: 0 },
    'No hay sitio libre para otra butaca. Haz espacio o agrega un espacio.',
    // Una butaca ocupa una celda, asi que girarla nunca la deja sin caber: no hay que
    // volver a buscar, solo mirar al escenario desde donde quedo.
    (hueco) => ({ ...hueco, giro: giroHaciaEscenario(hueco.x + 0.5, hueco.y + 0.5) }));
  if (!nueva) return;
  // La zona se dice despues de regenerar: es la que hereda de la banda donde cayo.
  regenerar('');
  anunciar('Butaca suelta ' + nueva.id.slice(1) + ' agregada en ' + columnaYFila(nueva.sitio) +
           ', zona ' + zonas[piezaPorId(nueva.id).zonaEfectiva].nombre + '.');
  mostrarPiezaNueva(nueva.id);
}

// Pista de baile (4 × 4) o barra (4 × 1) en el primer hueco libre.
function agregarFormaNueva(forma) {
  const { nombre, ancho, alto } = FORMAS[forma];
  const nueva = agregarPiezaNueva('P', { tipo: 'forma', forma, ancho, alto },
    'No hay sitio libre para ' + nombre.toLowerCase() + ' de ' + ancho + ' × ' + alto + ' celdas.');
  if (!nueva) return;
  regenerar(nombre + ' ' + nueva.id.slice(1) + ' agregada en ' + columnaYFila(nueva.sitio) + '.');
  mostrarPiezaNueva(nueva.id);
}

// Las piezas que puede atrapar la marquesina: todo menos el escenario, que es único y
// ni se duplica ni se elimina.
const piezasDelPlano = () => [...mesas, ...bloquesFilas, ...formas, ...butacasSueltas];

// Aplica la marquesina: lo que atrapa pasa a estar seleccionado (o se suma a lo que ya
// había, con Ctrl). Un marco vacío sin Ctrl deselecciona.
function aplicarMarco(marco, suma) {
  const dentro = piezasEnMarco(piezasDelPlano(), marco);
  const ids = suma ? [...new Set([...piezasActivas, ...dentro])] : dentro;
  marcarActivas(ids);
  // El foco va a la principal: así las flechas mueven el grupo sin tener que tabular.
  const destino = mesaActiva && capaPiezas.querySelector('[data-pieza="' + mesaActiva + '"]');
  if (destino) destino.focus({ preventScroll: true });
  anunciar(ids.length ? plural(ids.length, 'pieza seleccionada', 'piezas seleccionadas') + '.'
                      : 'Ninguna pieza seleccionada.');
}

// Duplicar y eliminar el grupo entero. Las copias quedan seleccionadas, como al
// duplicar una sola.
function duplicarPiezasActivas() {
  const ids = [...piezasActivas];
  const resultado = duplicarPiezas(planoEditable(), salaActual, ids);
  if (resultado.motivo) {
    anunciar('No se pudo duplicar: ' + resultado.motivo + '.');
    return;
  }
  planos[tipoActual] = resultado.plano;
  regenerar('');
  marcarActivas(resultado.ids);
  anunciar(plural(ids.length, 'pieza duplicada', 'piezas duplicadas') + '. Las copias quedan seleccionadas.');
}

function eliminarPiezasActivas() {
  const ids = [...piezasActivas];
  planos[tipoActual] = eliminarPiezas(planoEditable(), ids);
  marcarActivas([]);
  regenerar(plural(ids.length, 'pieza eliminada', 'piezas eliminadas') + '.');
}

// Mueve el grupo una celda: todas o ninguna.
function moverPiezasActivas({ dx, dy, hacia }) {
  const ids = [...piezasActivas];
  const resultado = moverPiezas(planoEditable(), salaActual, ids, dx, dy);
  if (resultado.motivo) {
    anunciar('No se movieron: ' + resultado.motivo + ' hacia ' + hacia + '.');
    return;
  }
  planos[tipoActual] = resultado;
  regenerar(plural(ids.length, 'pieza movida', 'piezas movidas') + ' hacia ' + hacia + '.');
  const destino = capaPiezas.querySelector('[data-pieza="' + mesaActiva + '"]');
  if (destino) destino.focus();
}

function eliminarMesa(id) {
  const m = piezaPorId(id);
  const plano = planoEditable();
  const { lista } = listaDeId(id);
  plano[lista] = plano[lista].filter((c) => c.id !== id);
  regenerar(m.nombre + ' eliminad' + genero(m) + '.');
}

// Aplica un cambio de piezas y lo deshace si la sala pasa del aforo maximo. Las
// piezas se editan sobre el plano guardado, asi que se copia antes.
function conTopeDeAforo(cambio) {
  const previo = planos[tipoActual] && copiarPlano(planos[tipoActual]);
  const activas = [...piezasActivas];
  cambio();
  const motivo = motivoDeAforo(butacas.length);
  if (!motivo) return;
  if (previo) planos[tipoActual] = previo;
  else delete planos[tipoActual];
  marcarActivas(activas);   // la seleccion vuelve a la de antes (no a una copia deshecha)
  regenerar('No se pudo: ' + motivo + '.');
}

function ejecutarAccion(accion, id = mesaActiva) {
  const pieza = id && piezaPorId(id);
  if (!pieza) return;
  if (piezasActivas.size > 1 && piezasActivas.has(id)) {
    // Una acción de grupo solo se ofrece si todas la admiten (lo comprueba el panel).
    const todas = [...piezasActivas].map((x) => piezaPorId(x)).filter(Boolean);
    if (accion === 'eliminar') eliminarPiezasActivas();
    else if (accion === 'duplicar') conTopeDeAforo(duplicarPiezasActivas);
    else if (todas.every((p) => aplica(accion, p))) conTopeDeAforo(() => transformarPiezasActivas(accion));
    else anunciar('Esa acción no la admiten todas las piezas seleccionadas.');
    return;
  }
  if (!aplica(accion, pieza)) {
    anunciar(esEscenario(pieza) ? 'El escenario no admite esa acción.'
      : 'Esa acción no es para ' + { mesa: 'mesas', bloque: 'bloques de filas', forma: 'formas',
                                     butaca: 'butacas sueltas' }[tipoDePieza(pieza)] + '.');
    return;
  }
  if (accion === 'eliminar') eliminarMesa(id);
  else if (accion === 'duplicar') conTopeDeAforo(() => duplicarPiezaPorId(id));
  else conTopeDeAforo(() => transformarMesa(id, accion));
}

// La zona de una pieza con butacas. Vacia es heredar la de su banda: se quita la propia.
document.getElementById('zona-pieza').addEventListener('change', (e) => {
  if (e.target.value === 'mezcla') return;
  if (piezasActivas.size > 1) {
    const ids = [...piezasActivas];
    planos[tipoActual] = cambiarZonaDePiezas(planoEditable(), ids, e.target.value);
    regenerar('');
    const zona = zonas[e.target.value];
    anunciar(plural(ids.length, 'pieza', 'piezas') +
             (zona ? ' a la zona ' + zona.nombre + ', ' + dinero(zona.precio) + '.'
                   : ' heredan la zona de su banda.'));
    return;
  }
  const pieza = piezaPorId(mesaActiva);
  if (!pieza || esForma(pieza) || esEscenario(pieza)) return;
  const config = { ...configDePieza(pieza) };
  if (e.target.value) config.zona = e.target.value;
  else delete config.zona;
  reemplazarMesa(config);
  regenerar('');
  const despues = piezaPorId(pieza.id);
  const zona = zonas[e.target.value] || zonas[zonaEnCelda(salaActual, despues.x, despues.y)];
  anunciar(pieza.nombre + (e.target.value ? ' pasa a la zona ' : ' hereda la zona de su banda: ') +
           zona.nombre + ', ' + dinero(zona.precio) + '.');
});
function aplicarNombreDeBloque() {
  const b = piezaPorId(mesaActiva);
  if (!esBloqueFilas(b) && !esForma(b)) return;
  const nombre = document.getElementById('nombre-pieza').value.trim().slice(0, 40);
  if (nombre === (b.nombrePropio || '')) return;
  const cambio = { ...configDePieza(b) };
  if (nombre) cambio.nombre = nombre;
  else delete cambio.nombre;
  reemplazarMesa(cambio);
  regenerar(nombre ? b.nombre + ' se llama ahora «' + nombre + '».' : b.nombre + ' vuelve a su nombre por defecto.');
}
document.getElementById('nombre-pieza').addEventListener('change', aplicarNombreDeBloque);
document.getElementById('nombre-pieza').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') aplicarNombreDeBloque();
});

// ---------------------------------------------------------------------------
// Tooltip de los botones de icono. Un solo elemento con position: fixed, para que el
// scroll de los laterales no lo recorte. Se muestra al pasar el raton (tambien sobre
// botones desactivados, que no reciben eventos: por eso elementFromPoint) o al llegar
// con Tab. Va a la derecha del control; si no cabe, a la izquierda o debajo.
// ---------------------------------------------------------------------------
const tooltip = document.createElement('div');
tooltip.className = 'tooltip';
tooltip.setAttribute('aria-hidden', 'true');   // el nombre ya esta en aria-label
tooltip.hidden = true;
document.body.appendChild(tooltip);
let conTooltip = null;

function mostrarTooltip(elemento) {
  conTooltip = elemento;
  tooltip.textContent = elemento.dataset.tooltip;
  tooltip.hidden = false;
  const r = elemento.getBoundingClientRect();
  const t = tooltip.getBoundingClientRect();
  let x = r.right + 8, y = r.top + (r.height - t.height) / 2;
  if (x + t.width > innerWidth - 4) x = r.left - 8 - t.width;
  if (x < 4) {
    x = Math.min(Math.max(4, r.left + (r.width - t.width) / 2), innerWidth - t.width - 4);
    y = r.bottom + 6;
  }
  tooltip.style.left = Math.round(x) + 'px';
  tooltip.style.top = Math.round(Math.max(4, y)) + 'px';
}
function ocultarTooltip() {
  conTooltip = null;
  tooltip.hidden = true;
}
document.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  const debajo = document.elementFromPoint(e.clientX, e.clientY);
  const elemento = debajo && debajo.closest('[data-tooltip]');
  if (elemento === conTooltip) return;
  if (elemento) mostrarTooltip(elemento);
  else ocultarTooltip();
});
document.addEventListener('focusin', (e) => {
  const elemento = e.target.closest('[data-tooltip]');
  if (elemento && e.target.matches(':focus-visible')) mostrarTooltip(elemento);
  else ocultarTooltip();
});
document.addEventListener('focusout', ocultarTooltip);
document.addEventListener('pointerdown', ocultarTooltip);
document.addEventListener('scroll', ocultarTooltip, true);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  ocultarTooltip();
  // Si el foco estaba en las hojas de informacion, vuelve a su boton al cerrarlas.
  if (hojasInfo.contains(document.activeElement)) document.getElementById('boton-info').focus();
  cerrarPlegables();
});

// Ctrl+D (Cmd+D en Mac) duplica lo seleccionado: la banda o, si no, la pieza activa.
// En los campos de texto de fuera del panel de bandas no se intercepta.
document.addEventListener('keydown', (e) => {
  if (modo !== 'editor' || !(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 'd') return;
  if (e.target.closest && e.target.closest('input, select, textarea') && !listaBandas.contains(e.target)) return;
  if (bandaActiva) {
    e.preventDefault();
    duplicarBandaPorId(bandaActiva);
  } else if (mesaActiva) {
    e.preventDefault();
    const enPlano = svg.contains(document.activeElement);
    ejecutarAccion('duplicar');
    const destino = enPlano && capaPiezas.querySelector('[data-pieza="' + mesaActiva + '"]');
    if (destino) destino.focus();
  }
});

const ATAJOS = {
  r: 'girar', R: 'girar',
  '+': 'alargar', '=': 'alargar',
  '-': 'acortar',
  c: 'cabeceras', C: 'cabeceras',
  u: 'unlado', U: 'unlado',
  ']': 'masfilas', '[': 'menosfilas',
  Delete: 'eliminar', Backspace: 'eliminar',
};

const PISTAS = {
  zona: 'Elige una zona y haz clic en una butaca, o Enter sobre ella, para asignársela · otro clic la ' +
        'devuelve a su zona · arrastra para pintar un área entera, con Alt para devolverla a su zona · ' +
        'con teclado, Mayús y flechas extienden el área y Enter la aplica · el plano se mueve con la barra ' +
        'espaciadora, el botón central o dos dedos · las marcadas con la palomita ya son de la zona elegida',
  bloquear: 'Haz clic en una butaca, o Enter sobre ella, para bloquearla o desbloquearla · arrastra para ' +
            'bloquear un área entera, con Alt para desbloquearla · con teclado, Mayús y flechas extienden ' +
            'el área y Enter la aplica · el plano se mueve con la barra espaciadora, el botón central o ' +
            'dos dedos · las bloqueadas se guardan con el mapa',
  vista: 'Rueda o pellizco para acercar · arrastra para mover · flechas para recorrer',
  editor: 'Arrastra el escenario, una mesa, un bloque, una butaca o una forma para moverlo · con teclado, Tab ' +
          'hasta la pieza: flechas la mueven, R la gira, + y − cambian su largo (o ancho), ] y [ agregan o ' +
          'quitan filas (o alto, en el escenario y las formas), C pone o quita cabeceras, U alterna uno o dos ' +
          'lados (en una mesa redonda, + y − quitan y ponen lugares), Ctrl+D la duplica, Supr la elimina · Esc cancela un arrastre · clic en el fondo ' +
          'selecciona una banda (otro clic, la que la contiene) y Ctrl+D la duplica · doble clic en ' +
          'un subtítulo para renombrar su banda · arrastra el fondo para seleccionar varias piezas (Ctrl ' +
          'para sumarlas) y Ctrl+clic para meter o sacar una · arrastra el tirador de la esquina de un espacio o de ' +
          'una zona de mesas para cambiar su alto (y su ancho, si está en una banda vertical), o el ' +
          'borde entre verticales para repartir las columnas',
};

function cambiarModo(nuevo) {
  if (nuevo === modo) return;
  if (arrastreMesa) terminarArrastreMesa(false);
  limpiarArea();
  modo = nuevo;
  const editando = modo === 'editor';
  svg.classList.toggle('editando', editando);
  document.getElementById('modo-vista').setAttribute('aria-pressed', String(!editando));
  document.getElementById('modo-editor').setAttribute('aria-pressed', String(editando));
  document.getElementById('herramientas-editor').hidden = !editando;
  document.getElementById('lateral-configuracion').hidden = !editando;
  document.getElementById('app').classList.toggle('editando', editando);
  document.getElementById('panel-bandas').hidden = !editando;
  // El tipo de sala se ve siempre (es como se cambia de recinto o se abre un mapa
  // guardado); el resto del grupo Mapa, solo al editar.
  document.getElementById('grupo-mapa').hidden = !editando;
  document.getElementById('pista').textContent = PISTAS[modo];
  herramienta = 'mesas';
  svg.classList.remove('bloqueando', 'pintando');
  document.getElementById('herramienta-bloquear').setAttribute('aria-pressed', 'false');
  document.getElementById('herramienta-zona').setAttribute('aria-pressed', 'false');
  document.getElementById('pincel-zona').hidden = true;
  actualizarAccesoButacas();
  marcarActivas([]);
  bandaActiva = null;
  dibujarTodo();
  actualizarControles();
  anunciar(editando
    ? 'Modo editor: arrastra las mesas para colocarlas.'
    : 'Previsualización: el plano como lo verá quien compra.');
  // La pista y los laterales cambian el hueco del plano: se vuelve a ajustar.
  reencuadrar();
}

// Colocando mesas, las butacas son decorado y el lector de pantalla recorre mesas.
// Bloqueando, o en la previsualizacion, las butacas son lo que se recorre.
function actualizarAccesoButacas() {
  if (modo === 'editor' && !conButacas()) capaButacas.setAttribute('aria-hidden', 'true');
  else capaButacas.removeAttribute('aria-hidden');
}

function cambiarHerramienta(nueva) {
  if (arrastreMesa) terminarArrastreMesa(false);
  limpiarArea();
  herramienta = nueva;
  const bloqueando = herramienta === 'bloquear';
  const pintando = herramienta === 'zona';
  svg.classList.toggle('bloqueando', bloqueando);
  svg.classList.toggle('pintando', pintando);
  document.getElementById('herramienta-bloquear').setAttribute('aria-pressed', String(bloqueando));
  document.getElementById('herramienta-zona').setAttribute('aria-pressed', String(pintando));
  document.getElementById('pincel-zona').hidden = !pintando;
  if (pintando) llenarPincel();
  document.getElementById('pista').textContent = PISTAS[bloqueando ? 'bloquear' : pintando ? 'zona' : modo];
  actualizarAccesoButacas();
  marcarActivas([]);
  bandaActiva = null;
  dibujarTodo();
  actualizarControles();
  anunciar(bloqueando
    ? 'Bloquear butacas: haz clic en una butaca para bloquearla o desbloquearla.'
    : pintando
    ? 'Asignar zona: elige la zona y haz clic en las butacas. Las marcadas con la palomita ya son de esa zona.'
    : 'Colocar mesas.');
}

function alternarBloqueo(elemento) {
  const b = porNodo(elemento);
  if (!b) return;
  if (b.estado === 'ocupada') {
    anunciar(etiquetaDe(b) + ' está ocupada: no se puede bloquear.');
    return;
  }
  planos[tipoActual] = alternarBloqueada(planoEditable(), b.id);
  const bloqueada = planos[tipoActual].bloqueadas.includes(b.id);
  regenerar(etiquetaDe(b) + (bloqueada ? ' bloqueada.' : ' desbloqueada.'));
  // El DOM se rehizo: el foco vuelve a la misma butaca.
  const nueva = porId.get(b.id);
  if (nueva) nueva.nodo.focus({ preventScroll: true });
}

document.getElementById('herramienta-bloquear').addEventListener('click', () =>
  cambiarHerramienta(herramienta === 'bloquear' ? 'mesas' : 'bloquear'));
document.getElementById('herramienta-zona').addEventListener('click', () =>
  cambiarHerramienta(herramienta === 'zona' ? 'mesas' : 'zona'));

// Las opciones del pincel: todas las zonas de la sala, con su precio. Conserva la
// elegida si sigue existiendo; si no, General o la primera.
function llenarPincel() {
  const select = document.getElementById('zona-pincel');
  const antes = select.value;
  select.textContent = '';
  for (const [id, { nombre, precio }] of Object.entries(zonas)) select.appendChild(new Option(nombre + ' · ' + dinero(precio), id));
  select.value = zonas[antes] ? antes : zonas.general ? 'general' : Object.keys(zonas)[0];
}
document.getElementById('zona-pincel').addEventListener('change', () => {
  dibujarTodo();
  anunciar('Pincel: ' + zonas[document.getElementById('zona-pincel').value].nombre + '.');
});

// Toca una butaca con el pincel: pasa a la zona elegida, o vuelve a la suya si ya lo era.
function pintarZona(elemento) {
  const b = porNodo(elemento);
  if (!b) return;
  if (b.estado === 'ocupada') {
    anunciar(etiquetaDe(b) + ' está ocupada: no cambia de zona.');
    return;
  }
  const pincel = document.getElementById('zona-pincel').value;
  const zona = b.zona === pincel ? b.zonaOriginal : pincel;
  planos[tipoActual] = asignarZonaAsiento(planoEditable(), b.id, zona, b.zonaOriginal);
  regenerar('');
  const nueva = porId.get(b.id);
  anunciar(etiquetaDe(nueva) + ': zona ' + zonas[nueva.zona].nombre + ', ' + dinero(zonas[nueva.zona].precio) +
           (nueva.zona === nueva.zonaOriginal ? ' (la de siempre).' : '.'));
  if (nueva) nueva.nodo.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------
// Tiradores en el plano.
//
// Se dibujan solo colocando piezas (con las herramientas de butacas el plano es
// otra cosa). El gesto no aplica nada hasta soltar: mientras se arrastra solo se
// ve el fantasma del tamaño nuevo, y al soltar pasa por aplicarBandas, que es
// quien comprueba que todo siga cabiendo.
// ---------------------------------------------------------------------------
const capaTiradores = document.getElementById('tiradores');
const capaFantasma = document.getElementById('fantasma');
const LADO_TIRADOR = 4;   // en unidades del viewBox: un tercio de celda

let arrastreTirador = null;

function dibujarTiradores() {
  capaTiradores.textContent = '';
  if (modo !== 'editor' || conButacas()) return;
  for (const t of tiradoresDeSala(salaActual)) {
    if (t.tipo === 'borde') {
      const agarre = nodo('rect', { class: 'tirador borde', x: t.x * PASO - 1.5, y: t.y * PASO,
                                    width: 3, height: t.alto * PASO, rx: 1 });
      agarre.dataset.tirador = 'borde';
      agarre.dataset.vertical = t.vertical;
      agarre.setAttribute('aria-hidden', 'true');
      capaTiradores.appendChild(agarre);
      continue;
    }
    const agarre = nodo('rect', { class: 'tirador esquina' + (t.vertical ? '' : ' solo-alto'),
                                  x: t.x * PASO - LADO_TIRADOR, y: t.y * PASO - LADO_TIRADOR,
                                  width: LADO_TIRADOR, height: LADO_TIRADOR, rx: 1 });
    agarre.dataset.tirador = 'esquina';
    agarre.dataset.banda = t.banda;
    if (t.vertical) agarre.dataset.vertical = t.vertical;
    agarre.setAttribute('aria-hidden', 'true');
    capaTiradores.appendChild(agarre);
  }
}

// El tamaño que tendría al soltar, en celdas, a partir de la celda bajo el puntero.
function medidasDeTirador(e, gesto = arrastreTirador) {
  const { banda, vertical, tipo } = gesto;
  const celda = celdaBajo(e);
  const medidas = {};
  if (tipo === 'esquina') {
    const b = bandaDe(salaActual, banda);
    medidas.alto = Math.min(ALTO_MAXIMO, Math.max(1, celda.y - b.y + 1));
  }
  if (vertical) {
    const v = bandaDe(salaActual, vertical);
    // El tope es dejarle al menos una columna a la ultima vertical, que ocupa el resto:
    // asi el fantasma nunca ensena un tamano que al soltar se iba a rechazar.
    const u = ubicar(salaActual.bandas, vertical);
    const franja = bandaDe(salaActual, u.padre.id);
    const otras = u.lista.slice(0, -1).reduce((s, x, i) => s + (i === u.indice ? 0 : x.anchoOcupado), 0);
    const maximo = Math.max(1, franja.anchoOcupado - otras - 1);
    medidas.ancho = Math.min(maximo, Math.max(1, celda.x - v.x + 1));
  }
  return medidas;
}

function dibujarFantasma(medidas, gesto = arrastreTirador) {
  capaFantasma.textContent = '';
  if (!medidas || !gesto) return;
  const { banda, vertical, tipo } = gesto;
  const base = bandaDe(salaActual, tipo === 'esquina' ? banda : vertical);
  const v = vertical && bandaDe(salaActual, vertical);
  const x = tipo === 'esquina' && vertical ? v.x : base.x;
  const ancho = medidas.ancho !== undefined ? medidas.ancho : base.anchoOcupado;
  const alto = medidas.alto !== undefined ? medidas.alto : base.alto;
  capaFantasma.appendChild(nodo('rect', { x: x * PASO, y: base.y * PASO,
                                          width: ancho * PASO, height: alto * PASO, rx: 2 }));
  const etiqueta = texto('', x * PASO + (ancho * PASO) / 2, base.y * PASO - 2,
                         ancho + ' × ' + alto + (tipo === 'borde' ? ' columnas' : ''));
  etiqueta.setAttribute('text-anchor', 'middle');
  capaFantasma.appendChild(etiqueta);
}

function terminarArrastreTirador(aplicar, e) {
  const gesto = arrastreTirador;
  arrastreTirador = null;
  capaFantasma.textContent = '';
  if (!gesto) return;
  if (!aplicar) {
    dibujarTiradores();
    return;
  }
  const medidas = e ? medidasDeTirador(e, gesto) : {};
  const base = bandaDe(salaActual, gesto.tipo === 'esquina' ? gesto.banda : gesto.vertical);
  const v = gesto.vertical && bandaDe(salaActual, gesto.vertical);
  const mismoAlto = medidas.alto === undefined || !base || medidas.alto === base.alto;
  const mismoAncho = medidas.ancho === undefined || !v || medidas.ancho === v.anchoOcupado;
  if (mismoAlto && mismoAncho) {
    // Sin cambio de medidas, el gesto vale como clic: selecciona su banda.
    marcarBandaActiva(gesto.banda || gesto.vertical);
    anunciar(base.nombre + ' seleccionada.');
    return;
  }
  const nombre = base.nombre;
  aplicarBandas(redimensionarConTirador(planoEditable(), salaActual, {
    banda: gesto.banda, vertical: gesto.vertical,
    ...(mismoAlto ? {} : { alto: medidas.alto }),
    ...(mismoAncho ? {} : { ancho: medidas.ancho }),
  }), nombre + ': ' + [mismoAncho ? '' : plural(medidas.ancho, 'columna', 'columnas'),
                       mismoAlto ? '' : plural(medidas.alto, 'fila', 'filas') + ' de alto'].filter(Boolean).join(' y ') + '.');
}

// ---------------------------------------------------------------------------
// Pintar y bloquear por area.
//
// Con una herramienta de butacas, arrastrar por el plano dibuja un rectangulo y
// al soltar se aplica a todo lo que abarca; con Alt se deshace (vuelve a su zona
// de siempre, o desbloquea). Con el teclado, Mayus y las flechas lo extienden
// desde la butaca enfocada y Enter lo aplica.
//
// Mientras se pinta, el arrastre deja de mover el plano: para eso estan la barra
// espaciadora, el boton central del raton y, en tactil, dos dedos.
// ---------------------------------------------------------------------------
let areaTeclado = null;   // { desde, hasta } en celdas, mientras se extiende con Mayus

// Las butacas de un area que la operacion puede tocar (las ocupadas nunca).
const libresEnArea = (area) => butacasEnArea(butacas, area).filter((b) => b.estado !== 'ocupada');

// 'etiqueta' cambia el conteo: con las herramientas de butacas son las butacas que
// abarca, y con la marquesina de piezas, las piezas.
function dibujarArea(area, quitando = false, etiqueta = null) {
  capaArea.textContent = '';
  capaArea.classList.toggle('quitando', Boolean(quitando));
  if (!area) return;
  const ancho = (area.x2 - area.x1 + 1) * PASO, alto = (area.y2 - area.y1 + 1) * PASO;
  capaArea.appendChild(nodo('rect', { x: area.x1 * PASO, y: area.y1 * PASO, width: ancho, height: alto, rx: 2 }));
  const cuantas = etiqueta || libresEnArea(area).length;
  if (!cuantas) return;
  // El conteo va debajo del rectangulo, y encima si el area llega al borde de la sala:
  // ahi abajo se saldria del plano.
  const y = area.y2 + 1 >= salaActual.alto ? area.y1 * PASO - 2 : area.y1 * PASO + alto + 4;
  const rotulo = texto('', area.x1 * PASO + ancho / 2, y,
                       etiqueta || plural(cuantas, 'butaca', 'butacas'));
  rotulo.setAttribute('text-anchor', 'middle');
  capaArea.appendChild(rotulo);
}

// Aplica el area con la herramienta activa. 'devolver' es lo que hace Alt: la zona
// de siempre, o desbloquear.
function aplicarArea(area, devolver) {
  const plano = planoEditable();
  const pincel = document.getElementById('zona-pincel').value;
  const pintando = herramienta === 'zona';
  const resultado = pintando
    ? asignarZonaEnArea(plano, butacas, area, devolver ? '' : pincel)
    : bloquearEnArea(plano, butacas, area, !devolver);
  const { cambiadas, ocupadas } = resultado;
  if (!cambiadas.length && !ocupadas.length) {
    anunciar('El área no tiene butacas.');
    return;
  }
  planos[tipoActual] = resultado.plano;
  const zona = pintando && !devolver && zonas[pincel];
  // El participio concuerda: «1 butaca bloqueada», no «1 butaca bloqueadas».
  const una = cambiadas.length === 1;
  regenerar(!cambiadas.length ? 'Ninguna butaca del área cambió.'
    : plural(cambiadas.length, 'butaca', 'butacas') + (pintando
      ? (zona ? ' a la zona ' + zona.nombre + ', ' + dinero(zona.precio) + '.' : ' de vuelta a su zona de siempre.')
      : (devolver ? (una ? ' desbloqueada.' : ' desbloqueadas.')
                  : (una ? ' bloqueada.' : ' bloqueadas.'))));
  const aviso = document.getElementById('aviso');
  aviso.textContent = [aviso.textContent,
    ocupadas.length ? plural(ocupadas.length, 'butaca ocupada', 'butacas ocupadas') + ' del área no cambiaron.' : '',
    resultado.mesas && resultado.mesas.length
      ? 'Se venden completas y quedan con lugares de más de una zona: ' + resultado.mesas.join(', ') + '.' : '',
  ].filter(Boolean).join(' ');
}

// Extiende el area con el teclado desde la butaca enfocada y mueve el foco.
function extenderArea(elemento, flecha) {
  const desde = porNodo(elemento);
  if (!desde) return;
  if (!areaTeclado) areaTeclado = { desde: { x: desde.x, y: desde.y } };
  moverFoco(elemento, flecha.dx, flecha.dy);
  const hasta = porNodo(document.activeElement.closest('.butaca') || elemento);
  areaTeclado.hasta = { x: hasta.x, y: hasta.y };
  const area = areaDeCeldas(areaTeclado.desde, areaTeclado.hasta);
  dibujarArea(area);
  anunciar(plural(libresEnArea(area).length, 'butaca', 'butacas') + ' en el área. Enter para aplicar, Alt+Enter para deshacer.');
}

function limpiarArea() {
  areaTeclado = null;
  dibujarArea(null);
}

document.getElementById('modo-vista').addEventListener('click', () => cambiarModo('vista'));
document.getElementById('modo-editor').addEventListener('click', () => cambiarModo('editor'));
document.getElementById('deshacer').addEventListener('click', () => restaurarEdicion('deshacer'));
document.getElementById('rehacer').addEventListener('click', () => restaurarEdicion('rehacer'));
document.addEventListener('keydown', (e) => {
  if (modo !== 'editor' || !(e.ctrlKey || e.metaKey) || e.altKey ||
      e.target.closest('input, textarea, select, [contenteditable]')) return;
  const tecla = e.key.toLowerCase();
  const accion = tecla === 'z' ? (e.shiftKey ? 'rehacer' : 'deshacer')
    : tecla === 'y' && !e.shiftKey ? 'rehacer' : null;
  if (!accion) return;
  e.preventDefault();
  restaurarEdicion(accion);
});
document.getElementById('restablecer').addEventListener('click', () => {
  if (historiales[tipoActual].tieneCambios() &&
      !confirm('Hay cambios sin guardar en este plano. ¿Restablecerlo? Puedes deshacer esta acción.')) return;
  delete planos[tipoActual];
  marcarActivas([]);
  bandaActiva = null;
  regenerar('Sala restablecida: bandas y mesas como en su tipo.');
  calcularEncuadre();
});
// Sin escenario, las filas miran hacia arriba y se numeran desde la de mas arriba.
document.getElementById('alternar-escenario').addEventListener('click', () => {
  if (!escenario.ausente) {
    planos[tipoActual] = quitarEscenario(planoEditable());
    regenerar('Escenario quitado: las filas miran hacia arriba y la fila A es la de más arriba de cada zona.');
    return;
  }
  const resultado = agregarEscenario(planoEditable(), salaActual);
  if (resultado.motivo) {
    anunciar('No se pudo agregar el escenario: ' + resultado.motivo + '.');
    return;
  }
  planos[tipoActual] = resultado;
  marcarActivas(['escenario']);
  regenerar('');
  anunciar('Escenario agregado en columna ' + escenario.x + ', fila ' + escenario.y + ', de ' +
           escenario.ancho + ' × ' + escenario.alto + ' celdas. Arrástralo o cambia su tamaño.');
  asegurarVisible({ x: escenario.x, y: escenario.y, w: escenario.ancho, h: escenario.alto });
});
document.getElementById('agregar-lados').addEventListener('click', () => conTopeDeAforo(() => agregarMesaNueva('lados')));
document.getElementById('agregar-cruz').addEventListener('click', () => conTopeDeAforo(() => agregarMesaNueva('cruz')));
document.getElementById('agregar-barra').addEventListener('click', () => conTopeDeAforo(() => agregarMesaNueva('barra')));
document.getElementById('venta-mesa').addEventListener('change', (e) => {
  if (e.target.value === 'mixta') return;
  if (piezasActivas.size > 1) {
    const ids = [...piezasActivas];
    const completa = e.target.value === 'mesa';
    planos[tipoActual] = marcarVentaDeMesas(planoEditable(), ids, completa);
    regenerar(plural(ids.length, 'mesa', 'mesas') + (completa ? ' se venden por mesa.' : ' se venden por butacas.'));
    return;
  }
  const m = piezaPorId(mesaActiva);
  if (!m) return;
  const completa = e.target.value === 'mesa';
  planos[tipoActual] = marcarMesaCompleta(planoEditable(), m.id, completa);
  regenerar(completa
    ? m.nombre + ' se vende por mesa: sus lugares se eligen juntos y se cobra la suma de todos.'
    : m.nombre + ' se vende por butacas.');
});
document.getElementById('completa-todas').addEventListener('click', () => {
  const completa = document.getElementById('venta-mesa').value === 'mesa';
  planos[tipoActual] = marcarTodasLasMesas(planoEditable(), completa);
  regenerar(completa ? 'Todas las mesas se venden por mesa.' : 'Todas las mesas se venden por butacas.');
});
document.getElementById('agregar-redonda').addEventListener('click', () => conTopeDeAforo(() => agregarMesaNueva('redonda')));
document.getElementById('agregar-bloque').addEventListener('click', () => conTopeDeAforo(agregarBloqueNuevo));
document.getElementById('agregar-butaca').addEventListener('click', () => conTopeDeAforo(agregarButacaNueva));
document.getElementById('agregar-pista').addEventListener('click', () => agregarFormaNueva('pista'));
document.getElementById('agregar-forma-barra').addEventListener('click', () => agregarFormaNueva('barra'));
for (const boton of botonesDeMesa()) {
  boton.addEventListener('click', () => ejecutarAccion(boton.dataset.accion));
}
