// El anfitrion suministra datos; no se buscan eventos ni credenciales en la URL.
// Esta API comparte el motor con la entrega autonoma y con los archivos para CSP.
let mapaDelEvento = null;
let contextoAntesDelEvento = null;
let alSeleccionarEvento = null;
let sesionDelConector = 0;
let reservaEnCurso = false;
let disponibilidadPerdida = false;

function aplicarEventoAButacas() {
  for (const b of butacas) {
    const p = eventoConectado.lugares.get(b.id);
    b.estado = p?.comprable ? 'libre' : p?.estado === 'vendido' || p?.estado === 'reservado' ? 'ocupada' : 'bloqueada';
    b.motivoEvento = p?.motivo || (!p ? 'disponibilidad sin confirmar' : '');
    if (b.grupo) {
      b.grupo = { ...b.grupo, completa: eventoConectado.grupos.get(b.grupo.id)?.modalidad === 'completa' };
      if (p?.comprable && b.grupo.completa) b.motivoEvento = b.grupo.tipo === 'palco' ? 'selecciona el palco completo' : 'selecciona la mesa completa';
    }
  }
  for (const m of mesas) m.completa = eventoConectado.grupos.get(m.id)?.modalidad === 'completa';
}

function notificarSeleccionEvento() {
  const seleccion = seleccionDelEvento();
  document.dispatchEvent(new CustomEvent('selector-asientos:seleccion', { detail: seleccion }));
  if (alSeleccionarEvento) alSeleccionarEvento(copiarDatos(seleccion));
}

function seleccionDelEvento() {
  if (!eventoConectado) throw new Error('No hay un evento conectado.');
  const s = solicitudDeSeleccionEvento(elegidas, eventoConectado);
  if (s.errores) throw new Error(s.errores.join('; '));
  return copiarDatos({ ...s, conteos: conteosDeEvento(eventoConectado) });
}

function validarDatosEvento(mapa, dato) {
  let r;
  // La validacion fisica usa los generadores globales; siempre reponer la vista actual.
  try { r = resolverEventoDeMapa(mapa, dato); }
  finally { if (salaActual) { salaActual = generarPlano(tipoActual, planos[tipoActual]); if (eventoConectado) aplicarEventoAButacas(); } }
  if (r.errores) throw new Error(r.errores.join('; '));
  return r.evento;
}

function cargarEvento({ mapa, evento, alSeleccionar } = {}) {
  if (alSeleccionar !== undefined && typeof alSeleccionar !== 'function') throw new Error('El callback de selección no es válido.');
  const resuelto = validarDatosEvento(mapa, evento);
  if (eventoConectado) cerrarEvento();
  contextoAntesDelEvento = { tipo: tipoActual, elegidas: [...elegidas] };
  cambiarModo('vista'); elegidas.clear();
  mapaDelEvento = copiarDatos(mapa);
  const clave = 'evento:' + resuelto.cabecera.id;
  TIPOS_DE_SALA[clave] = definicionDeMapa(mapaDelEvento);
  construirSelector(clave); redibujar(clave);
  eventoConectado = resuelto;
  alSeleccionarEvento = alSeleccionar || null;
  disponibilidadPerdida = false; sesionDelConector++;
  selector.disabled = true; document.getElementById('modo-editor').disabled = true;
  actualizarIdentidadControles();
  dibujarTodo(); actualizarAforo(salaActual); actualizarResumen();
  anunciar('Evento «' + resuelto.cabecera.nombre + '». Tarifas y disponibilidad proporcionadas por Sin Taquilla.');
  notificarSeleccionEvento();
  return seleccionDelEvento();
}

function actualizarEvento(dato) {
  if (!eventoConectado) throw new Error('No hay un evento conectado.');
  const nuevo = validarDatosEvento(mapaDelEvento, dato);
  const motivo = motivoCambioDeEvento(eventoConectado, nuevo);
  if (motivo) throw new Error(motivo);
  if (nuevo.cabecera.versionEstado < eventoConectado.cabecera.versionEstado) throw new Error('La respuesta de disponibilidad no es más reciente.');
  if (nuevo.cabecera.versionEstado === eventoConectado.cabecera.versionEstado && !disponibilidadPerdida) {
    if (firmaDeEvento(nuevo) !== firmaDeEvento(eventoConectado)) throw new Error('La misma versión contiene datos diferentes.');
    return seleccionDelEvento();
  }
  eventoConectado = nuevo; disponibilidadPerdida = false;
  const quitados = conciliarSeleccionEvento(elegidas, nuevo);
  dibujarTodo(); actualizarResumen(); actualizarAforo(salaActual);
  anunciar(quitados.length ? 'Se soltaron ' + quitados.length + ' lugares por cambios del evento: ' + quitados.map((id) => nuevo.lugares.get(id)?.label || id).join('; ') + '.' : 'Disponibilidad actualizada.');
  notificarSeleccionEvento();
  return seleccionDelEvento();
}

function cerrarEvento() {
  if (!eventoConectado) return;
  const clave = tipoActual;
  eventoConectado = null; mapaDelEvento = null; alSeleccionarEvento = null;
  disponibilidadPerdida = false; sesionDelConector++;
  delete TIPOS_DE_SALA[clave]; delete planos[clave]; delete historiales[clave];
  elegidas.clear();
  for (const id of contextoAntesDelEvento.elegidas) elegidas.add(id);
  selector.disabled = false; document.getElementById('modo-editor').disabled = false;
  construirSelector(contextoAntesDelEvento.tipo); redibujar(contextoAntesDelEvento.tipo);
  contextoAntesDelEvento = null;
}

function perderDisponibilidadEvento(mensaje) {
  if (!eventoConectado) return;
  disponibilidadPerdida = true;
  for (const p of eventoConectado.lugares.values()) {
    p.estado = 'desconocido'; p.disponible = false; p.comprable = false;
    if (p.habilitado) p.motivo = 'disponibilidad sin confirmar';
  }
  for (const g of eventoConectado.grupos.values()) g.comprable = false;
  const quitados = conciliarSeleccionEvento(elegidas, eventoConectado);
  dibujarTodo(); actualizarResumen(); actualizarAforo(salaActual);
  anunciar(mensaje + (quitados.length ? ' Se soltaron ' + quitados.length + ' lugares; vuelve a confirmar su disponibilidad.' : ''));
  notificarSeleccionEvento();
}

function urlDelConector(url) {
  if (typeof url !== 'string' || !url.trim()) throw new Error('Falta la URL del conector.');
  const u = new URL(url, location.href);
  if (!['http:', 'https:'].includes(u.protocol) || u.origin !== location.origin || u.username || u.password || u.hash) throw new Error('El conector requiere una URL del mismo origen, sin credenciales ni fragmento.');
  return u.href;
}

async function intercambiarEvento({ url, csrf, signal, requestKey } = {}, reservar = false) {
  if (!eventoConectado) throw new Error('No hay un evento conectado.');
  const destino = urlDelConector(url);
  if (reservar && (typeof csrf !== 'string' || !csrf.trim())) throw new Error('Falta el token CSRF proporcionado por Sin Taquilla.');
  if (reservar && reservaEnCurso) throw new Error('Ya hay una reserva en curso.');
  const seleccion = seleccionDelEvento();
  if (reservar && !seleccion.cantidad) throw new Error('Selecciona lugares antes de reservar.');
  if (reservar && requestKey !== undefined && (typeof requestKey !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(requestKey))) throw new Error('La clave de solicitud no es válida.');
  const sesion = sesionDelConector;
  const version = eventoConectado.cabecera.versionEstado;
  const headers = { Accept: 'application/json' };
  let body;
  if (reservar) {
    headers['Content-Type'] = 'application/json'; headers['X-CSRF-Token'] = csrf;
    body = JSON.stringify({ ...seleccion.solicitud, request_key: requestKey || crypto.randomUUID() });
    reservaEnCurso = true;
  }
  try {
    const respuesta = await fetch(destino, { method: reservar ? 'POST' : 'GET', credentials: 'same-origin',
      cache: 'no-store', redirect: 'error', headers, ...(body ? { body } : {}), signal });
    if (sesion !== sesionDelConector) throw new Error('La respuesta llegó después de cerrar o cambiar el evento.');
    if (!respuesta.ok) throw new Error(respuesta.status === 409 ? 'La selección cambió; confirma la disponibilidad de nuevo.' : 'Sin Taquilla no pudo confirmar la disponibilidad.');
    const datos = await respuesta.json();
    if (sesion !== sesionDelConector) throw new Error('La respuesta pertenece a una sesión anterior.');
    const actualizada = actualizarEvento(datos.evento);
    return { seleccion: actualizada, ...(reservar ? { resultado: copiarDatos(datos.resultado ?? null) } : {}) };
  } catch (error) {
    if (sesion === sesionDelConector && eventoConectado.cabecera.versionEstado === version) perderDisponibilidadEvento('Disponibilidad sin confirmar.');
    throw error;
  } finally { if (reservar) reservaEnCurso = false; }
}

// Proyeccion para el formulario del anfitrion; no guarda precios en el recinto.
function evaluarConfiguracionEvento(mapa, dato) {
  const e = validarDatosEvento(mapa, dato);
  return copiarDatos({ evento: e.cabecera, conteos: conteosDeEvento(e),
    lugares: [...e.lugares.values()].map((p) => ({ local_place_id: p.local_place_id, event_place_id: p.event_place_id,
      habilitado: p.habilitado, disponible: p.disponible, comprable: p.comprable, categoriaId: p.categoria?.id ?? null,
      precioCentavos: p.categoria?.precioCentavos ?? null, motivo: p.motivo })),
    zonas: mapa.zonas.map((z) => { const ps = [...e.lugares.values()].filter((p) => p.physical_zone.id === z.id);
      return { id: z.id, nombre: z.nombre, inventariados: ps.length, utilizables: ps.filter((p) => !p.blocked).length,
        habilitados: ps.filter((p) => p.habilitado).length, comprables: ps.filter((p) => p.comprable).length }; }) });
}

window.SelectorAsientos = Object.freeze({ version: 1, cargarEvento, actualizarEvento, cerrarEvento,
  seleccion: seleccionDelEvento, evaluarConfiguracion: evaluarConfiguracionEvento,
  refrescar: (opciones) => intercambiarEvento(opciones), reservar: (opciones) => intercambiarEvento(opciones, true) });
