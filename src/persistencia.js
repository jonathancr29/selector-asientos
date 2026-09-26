// ---------------------------------------------------------------------------
// Resumen: agrupa por mesa cuando la butaca pertenece a una.
// ---------------------------------------------------------------------------
function actualizarResumen() {
  // En orden de plano, no de clic: el detalle sale estable.
  const lista = butacas.filter((b) => elegidas.has(b.id));
  const total = lista.reduce((s, b) => s + zonas[b.zona].precio, 0);
  document.getElementById('cuenta').textContent = String(lista.length);
  document.getElementById('total').textContent = dinero(total);
  document.getElementById('vacio').hidden = lista.length > 0;
  document.getElementById('detalle-vacio').hidden = lista.length > 0;

  const cubos = new Map();
  for (const b of lista) {
    const clave = b.grupo ? b.grupo.nombre : b.seccion;
    if (!cubos.has(clave)) cubos.set(clave, []);
    cubos.get(clave).push(b);
  }
  const detalle = document.getElementById('detalle');
  detalle.textContent = '';
  for (const [clave, items] of cubos) {
    const li = document.createElement('li');
    const cuantos = (items[0].grupo && items[0].grupo.completa ? 'mesa completa, ' : '') +
                    (items.length === 1 ? '1 lugar' : items.length + ' lugares');
    const cuales = items.map((b) => (b.grupo ? b.numero : b.fila + b.numero)).join(', ');
    const importe = items.reduce((s, b) => s + zonas[b.zona].precio, 0);
    li.textContent = clave + ' · ' + cuantos + ' (' + cuales + ') · ' + dinero(importe);
    detalle.appendChild(li);
  }
}

// ---------------------------------------------------------------------------
// Cambio de tipo de sala
// ---------------------------------------------------------------------------
const frase = (ids, singular, plural) => (!ids.length ? ''
  : ids.length === 1
    ? 'Se soltó 1 butaca que ' + singular + ': ' + ids[0] + '.'
    : 'Se soltaron ' + ids.length + ' butacas que ' + plural + ': ' + ids.join(', ') + '.');


function actualizarAforo(sala) {
  const bandasDeFilas = hojasDe(sala.bandas).filter((b) => b.tipo === 'filas');
  const filas = bandasDeFilas.reduce((s, b) => s + b.filas, 0);
  // «de 12 butacas» solo si todas las filas ocupan el ancho de la sala.
  const todasAnchas = bandasDeFilas.every((b) => !b.profundidad);
  document.getElementById('aforo').textContent = [
    'Sala de ' + sala.ancho + ' columnas',
    !filas ? 'sin filas' : todasAnchas ? plural(filas, 'fila', 'filas') + ' de ' + sala.columnas.length + ' butacas'
      : plural(filas, 'fila', 'filas') + ' en bandas',
    mesas.length ? plural(mesas.length, 'mesa', 'mesas') : 'sin mesas',
    ...(bloquesFilas.length ? [plural(bloquesFilas.length, 'bloque de filas', 'bloques de filas')] : []),
    ...(butacasSueltas.length ? [plural(butacasSueltas.length, 'butaca suelta', 'butacas sueltas')] : []),
    ...(formas.length ? [plural(formas.length, 'forma', 'formas')] : []),
    ...(escenario.ausente ? ['sin escenario'] : []),
    butacas.length + ' lugares en total',
  ].join(' · ');
}

function redibujar(tipo) {
  if (arrastreMesa) terminarArrastreMesa(false);
  tipoActual = tipo;
  marcarActivas([]);
  bandaActiva = null;
  const esMapa = TIPOS_DE_SALA[tipo].grupo === GRUPO_MAPAS;
  document.getElementById('nombre-mapa').value = esMapa ? TIPOS_DE_SALA[tipo].nombre : '';
  document.getElementById('eliminar-mapa').hidden = !esMapa;
  salaActual = generarPlano(tipo, planos[tipo]);
  if (!historiales[tipo]) historiales[tipo] = crearHistorial(fotoDelPlano());
  // Antes de dibujar: asi el DOM nace ya con la seleccion que sobrevive.
  const { ausentes, noLibres } = conciliarSeleccion(elegidas, butacas);
  completarMesasElegidas(elegidas, butacas);
  dibujarTodo();
  anunciar('');

  actualizarResumen();
  actualizarAforo(salaActual);
  actualizarControles();
  actualizarEstadoEdicion();
  reencuadrar();
  document.getElementById('aviso').textContent = [
    frase(ausentes, 'esta sala no tiene', 'esta sala no tiene'),
    frase(noLibres, 'en esta sala no está libre', 'en esta sala no están libres'),
  ].filter(Boolean).join(' ');
}

window.addEventListener('beforeunload', (e) => {
  if (!Object.values(historiales).some((h) => h.tieneCambios())) return;
  e.preventDefault();
  e.returnValue = '';
});

// ---------------------------------------------------------------------------
// Mapas guardados: en el navegador (localStorage) y como archivos JSON.
// ---------------------------------------------------------------------------
const selector = document.getElementById('tipo-sala');
const campoNombre = document.getElementById('nombre-mapa');
const CLAVE_ALMACEN = 'selector-asientos:mapas';

// { nombre: mapa }, o null si el navegador no deja leer (modo privado, bloqueo).
function leerAlmacen() {
  try {
    const texto = localStorage.getItem(CLAVE_ALMACEN);
    const datos = texto ? JSON.parse(texto) : {};
    return datos && typeof datos === 'object' && !Array.isArray(datos)
      ? Object.assign(Object.create(null), datos) : Object.create(null);
  } catch {
    return null;
  }
}

function escribirAlmacen(mapas) {
  try {
    localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(mapas));
    return true;
  } catch {
    return false;
  }
}

// Las opciones salen de TIPOS_DE_SALA, agrupadas; «Mis mapas» al final y por nombre.
function construirSelector(valor) {
  selector.textContent = '';
  const entradas = Object.entries(TIPOS_DE_SALA);
  const mapasOrdenados = entradas.filter(([, d]) => d.grupo === GRUPO_MAPAS)
    .sort(([, a], [, b]) => a.nombre.localeCompare(b.nombre, 'es'));
  const grupos = new Map();
  for (const [id, { nombre, grupo }] of [...entradas.filter(([, d]) => d.grupo !== GRUPO_MAPAS), ...mapasOrdenados]) {
    if (!grupos.has(grupo)) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = grupo;
      grupos.set(grupo, optgroup);
      selector.appendChild(optgroup);
    }
    grupos.get(grupo).appendChild(new Option(nombre, id));
  }
  selector.value = valor;
}

const idsActuales = () => new Set(butacas.map((b) => b.id));

function guardarMapa() {
  const nombre = campoNombre.value.trim();
  if (!nombre) {
    anunciar('Escribe un nombre para el mapa.');
    campoNombre.focus();
    return;
  }
  const almacen = leerAlmacen();
  if (!almacen) {
    anunciar('Este navegador no permite guardar mapas aquí. Usa «Exportar JSON».');
    return;
  }
  const clave = claveDeMapa(nombre);
  if (TIPOS_DE_SALA[clave] && clave !== tipoActual &&
      !confirm('Ya hay un mapa llamado «' + nombre + '». ¿Sobrescribirlo?')) return;
  const mapa = mapaDesdePlano(nombre, planoEditable(), new Date().toISOString(), idsActuales());
  almacen[nombre] = mapa;
  if (!escribirAlmacen(almacen)) {
    anunciar('No se pudo guardar: el almacenamiento del navegador está lleno o bloqueado. Usa «Exportar JSON».');
    return;
  }
  registrarMapa(mapa);
  historiales[tipoActual].marcarGuardado();
  delete planos[clave];   // lo guardado pasa a ser el punto de partida del mapa
  delete historiales[clave];
  construirSelector(clave);
  redibujar(clave);
  anunciar('Mapa «' + nombre + '» guardado en este navegador.');
}

function exportarMapa() {
  const nombre = campoNombre.value.trim() || TIPOS_DE_SALA[tipoActual].nombre;
  const mapa = mapaDesdePlano(nombre, planoEditable(), new Date().toISOString(), idsActuales());
  const archivo = new Blob([JSON.stringify(mapa, null, 2) + '\n'], { type: 'application/json' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = nombreDeArchivo(nombre);
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 0);
  historiales[tipoActual].marcarGuardado();
  actualizarEstadoEdicion();
  anunciar('Mapa «' + nombre + '» exportado como ' + enlace.download + '.');
}

// Un mapa real ocupa pocos KB: un archivo mayor no se lee, para no bloquear la pestaña
// leyendo y validando algo que no es un mapa razonable.
const ARCHIVO_MAXIMO = 1024 * 1024;

async function importarMapa(archivo) {
  if (archivo.size > ARCHIVO_MAXIMO) {
    anunciar('No se pudo importar ' + archivo.name + ': es demasiado grande para ser un mapa (pasa de 1 MB).');
    return;
  }
  let dato;
  try {
    dato = JSON.parse(await archivo.text());
  } catch {
    anunciar('No se pudo importar ' + archivo.name + ': no es un JSON válido.');
    return;
  }
  const { mapa, errores } = validarMapa(dato);
  // validarMapa genero su propia sala para comprobarla: se vuelve a dibujar la actual.
  salaActual = generarPlano(tipoActual, planos[tipoActual]);
  dibujarTodo();
  if (errores) {
    anunciar('No se pudo importar ' + archivo.name + ': ' + errores.slice(0, 3).join('; ') +
             (errores.length > 3 ? '…' : '') + '.');
    return;
  }
  const clave = claveDeMapa(mapa.nombre);
  if (TIPOS_DE_SALA[clave] && !confirm('Ya hay un mapa llamado «' + mapa.nombre + '». ¿Sobrescribirlo?')) return;
  const almacen = leerAlmacen();
  const guardado = Boolean(almacen) && ((almacen[mapa.nombre] = mapa), escribirAlmacen(almacen));
  registrarMapa(mapa);
  delete planos[clave];
  delete historiales[clave];
  construirSelector(clave);
  redibujar(clave);
  anunciar('Mapa «' + mapa.nombre + '» importado' + (guardado
    ? ' y guardado en este navegador.'
    : '. No se pudo guardar en el navegador: estará disponible hasta recargar la página.'));
}

function eliminarMapa() {
  const { nombre } = TIPOS_DE_SALA[tipoActual];
  if (!confirm('¿Eliminar el mapa «' + nombre + '» de este navegador? No se puede deshacer.')) return;
  const almacen = leerAlmacen();
  if (!almacen) {
    anunciar('No se pudo eliminar el mapa: no se puede acceder al almacenamiento del navegador.');
    return;
  }
  delete almacen[nombre];
  if (!escribirAlmacen(almacen)) {
    anunciar('No se pudo eliminar el mapa: el almacenamiento del navegador está lleno o bloqueado.');
    return;
  }
  delete TIPOS_DE_SALA[tipoActual];
  delete planos[tipoActual];
  delete historiales[tipoActual];
  construirSelector('mixta-ambos');
  redibujar('mixta-ambos');
  anunciar('Mapa «' + nombre + '» eliminado.');
}

document.getElementById('guardar-mapa').addEventListener('click', guardarMapa);
campoNombre.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') guardarMapa();
});
document.getElementById('eliminar-mapa').addEventListener('click', eliminarMapa);
document.getElementById('exportar-mapa').addEventListener('click', exportarMapa);
document.getElementById('importar-mapa').addEventListener('click', () =>
  document.getElementById('archivo-mapa').click());
document.getElementById('archivo-mapa').addEventListener('change', (e) => {
  const [archivo] = e.target.files;
  e.target.value = '';   // para poder importar otra vez el mismo archivo
  if (archivo) importarMapa(archivo);
});

// Al cargar: los mapas guardados que sigan siendo validos entran en el selector.
const almacenInicial = leerAlmacen();
// Los que no validan (dañados, o de una version futura) se quedan en el almacen
// sin tocar, pero no se cargan, y se avisa de cuales son.
const mapasDescartados = [];
for (const [nombre, dato] of Object.entries(almacenInicial || {})) {
  const { mapa } = validarMapa(dato);
  if (mapa) registrarMapa(mapa);
  else mapasDescartados.push(nombre);
}
construirSelector('mixta-ambos');
// Un mapa en blanco solo tiene sentido en el editor: se abre directamente ahi.
selector.addEventListener('change', () => {
  redibujar(selector.value);
  if (selector.value !== 'mapa-en-blanco') return;
  cambiarModo('editor');
  anunciar('Mapa en blanco de ' + salaActual.ancho + ' × ' + salaActual.alto + ': agrega espacios, bloques de ' +
           'filas, mesas o el escenario, y guárdalo con un nombre en «Mis mapas».');
});
redibujar(selector.value);
if (mapasDescartados.length) {
  anunciar((mapasDescartados.length === 1 ? 'No se pudo cargar el mapa guardado «'
    : 'No se pudieron cargar los mapas guardados «') + mapasDescartados.join('», «') +
    (mapasDescartados.length === 1 ? '»: está dañado.' : '»: están dañados.'));
}
