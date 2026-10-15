// El evento vive aparte: nunca se escribe en planos, mapas ni localStorage.
let eventoConectado = null;
const cantidadesGenerales = new Map();

const TIPOS_REFERENCIA_EVENTO = ['nivel', 'zona', 'sector', 'fila', 'grupo', 'lugar'];
const ESTADOS_EVENTO = ['libre', 'reservado', 'vendido', 'desconocido'];
const idDeEventoValido = (id) => typeof id === 'string' && /^[A-Za-z][A-Za-z0-9_-]{2,99}$/.test(id);

function referenciasDeLugar(p) {
  return { nivel: p.level.id, zona: p.physical_zone.id, sector: p.sector?.id,
    fila: p.physical_row?.id, grupo: p.physical_group?.id, lugar: p.local_place_id };
}

// Sin prioridad implicita: dos categorias distintas sobre un mismo lugar son error.
// El resultado materializa pertenencias cruzadas, sin suponer que forman un arbol.
function resolverEventoDeMapa(datoMapa, dato) {
  const preparado = prepararRecintoEvento(datoMapa);
  return preparado.errores ? preparado : resolverEventoDeRecinto(preparado.recinto, dato);
}

// El token no expone el catalogo ni sus indices. Se retira con la sesion y es recolectable.
const RECINTOS_PREPARADOS = new WeakMap();
function congelarDatos(dato) {
  if (!dato || typeof dato !== 'object' || Object.isFrozen(dato)) return dato;
  for (const valor of Object.values(dato)) congelarDatos(valor);
  return Object.freeze(dato);
}
function prepararRecintoEvento(datoMapa) {
  const exportacion = exportarLugaresDeMapa(datoMapa);
  if (exportacion.errores) return exportacion;
  const catalogo = congelarDatos(exportacion.catalogo);
  if (catalogo.revision.estado !== 'publicada') return { errores: ['el evento requiere una revisión física publicada'] };
  const zonasFisicas = congelarDatos(copiarZonas(datoMapa.zonas));
  const indices = Object.fromEntries(TIPOS_REFERENCIA_EVENTO.map((t) => [t, new Set()]));
  const referencias = new Map();
  for (const p of catalogo.lugares) {
    const refs = referenciasDeLugar(p);
    referencias.set(p.local_place_id, refs);
    for (const [t, id] of Object.entries(refs)) if (id) indices[t].add(id);
  }
  for (const z of zonasFisicas) indices.zona.add(z.id);
  for (const n of catalogo.niveles) indices.nivel.add(n.id);
  for (const s of catalogo.sectores) indices.sector.add(s.id);
  for (const f of catalogo.filas) indices.fila.add(f.id);
  for (const g of catalogo.grupos) indices.grupo.add(g.id);
  const recinto = Object.freeze({});
  RECINTOS_PREPARADOS.set(recinto, { catalogo, zonasFisicas, indices, referencias,
    catalogoPorId: new Map(catalogo.lugares.map(p => [p.local_place_id, p])),
    nombresZona: new Map(zonasFisicas.map(z => [z.id, z.nombre])) });
  return { recinto };
}
function resolverEventoDeRecinto(recinto, dato) {
  const fisico = RECINTOS_PREPARADOS.get(recinto);
  if (!fisico) return { errores: ['el recinto no fue preparado por el selector'] };
  const { catalogo, zonasFisicas, indices, referencias, catalogoPorId, nombresZona } = fisico;
  const r = catalogo.revision;
  const error = (mensaje) => ({ errores: [mensaje] });
  if (!dato || dato.formato !== 'sintaquilla/evento-asientos' || ![1, 2].includes(dato.version)) return error('formato de evento no compatible');
  const e = dato.evento;
  if (!e || !idDeEventoValido(e.id) || typeof e.nombre !== 'string' || !e.nombre.trim() || e.nombre.length > 180 ||
      e.moneda !== 'MXN' || !Number.isSafeInteger(e.versionEstado) || e.versionEstado < 0) return error('cabecera del evento inválida');
  if (!e.revision || e.revision.recintoId !== r.recintoId || e.revision.numero !== r.numero || e.revision.huella !== r.huella) return error('el evento corresponde a otra revisión del recinto');
  const lista = (v, max) => Array.isArray(v) && v.length <= max;
  if (!lista(dato.categorias, 20) || !lista(dato.asignaciones, BUTACAS_MAXIMAS * 6) ||
      !lista(dato.grupos, BUTACAS_MAXIMAS) || !lista(dato.lugares, BUTACAS_MAXIMAS)) return error('listas del evento inválidas');
  const categorias = new Map();
  for (const c of dato.categorias) {
    if (!c || !idDeEventoValido(c.id) || categorias.has(c.id) || typeof c.nombre !== 'string' || !c.nombre.trim() ||
        c.nombre.length > 80 || typeof c.activa !== 'boolean' || !esEntero(c.precioCentavos, 0, PRECIO_MAXIMO)) return error('categoría o precio del evento inválido');
    categorias.set(c.id, { id: c.id, nombre: c.nombre, activa: c.activa, precioCentavos: c.precioCentavos });
  }
  const exclusiones = Object.create(null);
  for (const t of TIPOS_REFERENCIA_EVENTO) {
    const v = dato.exclusiones?.[t];
    if (!lista(v, BUTACAS_MAXIMAS) || new Set(v).size !== v.length || v.some((id) => !indices[t].has(id))) return error('exclusiones de ' + t + ' inválidas');
    exclusiones[t] = new Set(v);
  }
  const asignaciones = Object.fromEntries(TIPOS_REFERENCIA_EVENTO.map((t) => [t, new Map()]));
  for (const a of dato.asignaciones) {
    if (!a || !TIPOS_REFERENCIA_EVENTO.includes(a.tipo) || !indices[a.tipo].has(a.id) || !categorias.has(a.categoriaId) ||
        asignaciones[a.tipo].has(a.id)) return error('asignación de tarifa inválida o repetida');
    asignaciones[a.tipo].set(a.id, a.categoriaId);
  }
  const grupos = new Map();
  const idsPublicos = new Set();
  const zonasEvento = new Map();
  if (dato.version === 2) {
    if (!lista(dato.zonas, zonasFisicas.length) || dato.zonas.length !== zonasFisicas.length) return error('faltan modalidades de zonas del evento');
    for (const z of dato.zonas) {
      if (!z || !indices.zona.has(z.id) || zonasEvento.has(z.id) || !['asignada','general'].includes(z.modalidad)) return error('modalidad de zona inválida o repetida');
      if (z.modalidad === 'general' && (!idDeEventoValido(z.event_zone_id) || idsPublicos.has(z.event_zone_id) ||
          !categorias.has(z.categoriaId) || !esEntero(z.cupo,0,BUTACAS_MAXIMAS) ||
          !(z.disponibles === null || esEntero(z.disponibles,0,z.cupo)))) return error('cupo, tarifa o identidad general inválidos');
      if (z.modalidad === 'general') idsPublicos.add(z.event_zone_id);
      zonasEvento.set(z.id, { ...z, nombre: nombresZona.get(z.id) });
    }
  }
  const esGeneral = (p) => zonasEvento.get(p.physical_zone.id)?.modalidad === 'general';
  if (catalogo.lugares.some(p => esGeneral(p) && p.physical_group)) return error('acceso general no admite mesas o palcos físicos en esta versión');
  for (const g of dato.grupos) {
    if (!g || !indices.grupo.has(g.id) || grupos.has(g.id) || !idDeEventoValido(g.event_group_id) ||
        idsPublicos.has(g.event_group_id) || !['individual', 'completa'].includes(g.modalidad)) return error('grupo del evento inválido');
    idsPublicos.add(g.event_group_id);
    grupos.set(g.id, { id: g.id, event_group_id: g.event_group_id, modalidad: g.modalidad, requeridos: [], comprable: false });
  }
  if (grupos.size !== catalogo.grupos.length) return error('falta la modalidad de un grupo físico');
  const estados = new Map();
  for (const p of dato.lugares) {
    if (!p || !indices.lugar.has(p.local_place_id) || estados.has(p.local_place_id) || !idDeEventoValido(p.event_place_id) ||
        idsPublicos.has(p.event_place_id) || (p.estado !== undefined && !ESTADOS_EVENTO.includes(p.estado))) return error('identidad o estado de un lugar del evento inválido');
    if (esGeneral(catalogoPorId.get(p.local_place_id))) return error('una zona general no recibe identidades de butacas del evento');
    idsPublicos.add(p.event_place_id);
    estados.set(p.local_place_id, { event_place_id: p.event_place_id, estado: p.estado ?? 'desconocido' });
  }
  if (estados.size !== catalogo.lugares.filter(p => !esGeneral(p)).length) return error('faltan identidades de lugares del evento');
  const lugares = new Map();
  for (const p of catalogo.lugares) {
    const refs = referencias.get(p.local_place_id);
    const excluido = Object.entries(refs).some(([t, id]) => exclusiones[t].has(id));
    const tarifas = new Set(Object.entries(refs).map(([t, id]) => asignaciones[t].get(id)).filter(Boolean));
    if (tarifas.size > 1) return error('tarifas contradictorias para ' + p.label);
    const categoria = categorias.get([...tarifas][0]);
    const habilitado = !p.blocked && !excluido;
    const general = esGeneral(p);
    if (!general && habilitado && (!categoria || !categoria.activa)) return error('falta una categoría activa para ' + p.label);
    if (general && tarifas.size) return error('la tarifa general debe asignarse a la zona, sin tarifas por butaca');
    const estado = estados.get(p.local_place_id) || { event_place_id: null, estado: 'desconocido' };
    const disponible = !general && habilitado && estado.estado === 'libre';
    lugares.set(p.local_place_id, { ...p, ...estado, categoria: categoria || null, habilitado, disponible,
      comprable: disponible, accesoGeneral: general, motivo: general ? 'acceso general, sin asiento asignado' : p.blocked ? 'físicamente inutilizable' : excluido ? 'no habilitado para esta función' :
        estado.estado === 'desconocido' ? 'disponibilidad sin confirmar' : estado.estado === 'reservado' ? 'reservado' : estado.estado === 'vendido' ? 'vendido' : '' });
    if (p.physical_group && !p.blocked) grupos.get(p.physical_group.id).requeridos.push(p.local_place_id);
  }
  const generales = new Map();
  const capacidades = new Map();
  for (const p of lugares.values()) if (p.habilitado) capacidades.set(p.physical_zone.id, (capacidades.get(p.physical_zone.id) || 0) + 1);
  for (const z of zonasEvento.values()) if (z.modalidad === 'general') {
    const capacidad = capacidades.get(z.id) || 0;
    const categoria = categorias.get(z.categoriaId);
    if (z.cupo > capacidad || (z.cupo && !categoria.activa)) return error('cupo general superior a capacidad habilitada o tarifa inactiva');
    generales.set(z.id, { ...z, categoria, capacidad, comprable: z.cupo > 0 && z.disponibles !== null && z.disponibles > 0 });
  }
  for (const g of grupos.values()) {
    g.comprable = g.requeridos.length > 0 && g.requeridos.every((id) => lugares.get(id).disponible);
    if (g.modalidad === 'completa' && !g.comprable) for (const id of g.requeridos) {
      const p = lugares.get(id); p.comprable = false;
      if (p.disponible) p.motivo = 'conjunto completo no disponible';
    }
  }
  return { evento: { cabecera: { id: e.id, nombre: e.nombre, moneda: e.moneda, versionEstado: e.versionEstado,
    revision: { ...r } }, version: dato.version, lugares, grupos, categorias, catalogo, generales, zonasEvento } };
}

function conteosDeEvento(evento) {
  const todos = [...evento.lugares.values()], lista = todos.filter(p => !p.accesoGeneral);
  const generales = [...(evento.generales?.values() || [])];
  return { inventariados: todos.length, utilizables: todos.filter((p) => !p.blocked).length,
    habilitados: lista.filter((p) => p.habilitado).length + generales.reduce((s,z)=>s+z.cupo,0), disponibles: lista.filter((p) => p.disponible).length + generales.reduce((s,z)=>s+(z.disponibles || 0),0),
    comprables: lista.filter((p) => p.comprable).length + generales.reduce((s,z)=>s+(z.comprable ? z.disponibles : 0),0),
    conjuntosComprables: [...evento.grupos.values()].filter((g) => g.modalidad === 'completa' && g.comprable).length };
}

function firmaDeEvento(evento) {
  const ordenar = (lista) => lista.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify({ cabecera: evento.cabecera,
    lugares: ordenar([...evento.lugares.values()].map((p) => [p.local_place_id, p.event_place_id, p.estado,
      p.habilitado, p.categoria?.id ?? null, p.categoria?.precioCentavos ?? null])),
    grupos: ordenar([...evento.grupos.values()].map((g) => [g.id, g.event_group_id, g.modalidad])),
    zonas: ordenar([...(evento.zonasEvento?.values() || [])].map(z=>[z.id,z.modalidad,z.event_zone_id,z.cupo,z.disponibles,z.categoriaId,evento.categorias.get(z.categoriaId)?.precioCentavos])) });
}

function motivoCambioDeEvento(actual, nuevo) {
  if (nuevo.cabecera.id !== actual.cabecera.id) return 'La respuesta pertenece a otro evento.';
  if (actual.version !== nuevo.version) return 'Cambió la versión del contrato del evento.';
  for (const [id,z] of actual.zonasEvento || []) {
    const otra = nuevo.zonasEvento.get(id);
    if (otra?.modalidad !== z.modalidad || otra?.event_zone_id !== z.event_zone_id) return 'Cambió la modalidad o identidad de una zona; vuelve a cargar el evento.';
  }
  for (const [id, p] of actual.lugares) if (nuevo.lugares.get(id)?.event_place_id !== p.event_place_id) return 'Cambió la identidad de un lugar del evento.';
  for (const [id, g] of actual.grupos) if (nuevo.grupos.get(id)?.event_group_id !== g.event_group_id) return 'Cambió la identidad de un grupo del evento.';
  return null;
}

function alternarLugarEvento(ids, id, evento) {
  const p = evento.lugares.get(id);
  if (!p?.comprable) return null;
  const g = evento.grupos.get(p.physical_group?.id);
  const afectados = g?.modalidad === 'completa' ? g.requeridos : [id];
  const quitar = afectados.some((x) => ids.has(x));
  for (const x of afectados) if (quitar) ids.delete(x); else ids.add(x);
  return !quitar;
}

// No completa selecciones parciales tras un cambio comercial: exige elegir de nuevo.
function conciliarSeleccionEvento(ids, evento) {
  const quitados = new Set([...ids].filter((id) => !evento.lugares.get(id)?.comprable));
  for (const g of evento.grupos.values()) if (g.modalidad === 'completa') {
    const parcial = g.requeridos.some((id) => ids.has(id)) && !g.requeridos.every((id) => ids.has(id));
    if (!g.comprable || parcial) for (const id of g.requeridos) if (ids.has(id)) quitados.add(id);
  }
  for (const id of quitados) ids.delete(id);
  return [...quitados];
}

function conciliarCantidadesGenerales(cantidades, evento) {
  const quitadas = [];
  for (const [id,cantidad] of cantidades) {
    const z = evento.generales?.get(id);
    if (!z?.comprable || !esEntero(cantidad,1,z.disponibles)) { cantidades.delete(id); quitadas.push(id); }
  }
  return quitadas;
}

function cambiarCantidadGeneral(cantidades, id, cantidad, evento) {
  const zona = evento.generales?.get(id);
  if (!zona || !esEntero(cantidad, 0, BUTACAS_MAXIMAS) || (cantidad && (!zona.comprable || cantidad > zona.disponibles))) return { motivo: 'Cantidad general no disponible o inválida.' };
  if (cantidad) cantidades.set(id, cantidad);
  else cantidades.delete(id);
  return { cantidad };
}

function solicitudDeSeleccionEvento(ids, evento, cantidades = new Map()) {
  const lugares = [], grupos = new Set();
  let totalCentavos = 0;
  for (const id of ids) {
    const p = evento.lugares.get(id);
    if (!p?.comprable) return { errores: ['la selección incluye un lugar no comprable'] };
    const g = evento.grupos.get(p.physical_group?.id);
    if (g?.modalidad === 'completa') {
      if (!grupos.has(g.event_group_id) && !g.requeridos.every((x) => ids.has(x))) return { errores: ['la selección contiene un conjunto parcial'] };
      grupos.add(g.event_group_id);
    } else lugares.push(p.event_place_id);
    totalCentavos += p.categoria.precioCentavos;
  }
  const generales = [];
  let cantidadGeneral = 0;
  for (const [id,cantidad] of cantidades) {
    const z = evento.generales?.get(id);
    if (!z?.comprable || !esEntero(cantidad,1,z.disponibles)) return { errores: ['cantidad general no disponible o inválida'] };
    generales.push({event_zone_id:z.event_zone_id,cantidad});
    cantidadGeneral += cantidad; totalCentavos += cantidad * z.categoria.precioCentavos;
  }
  if (!Number.isSafeInteger(totalCentavos)) return { errores: ['importe fuera de rango'] };
  return { solicitud: { event_id: evento.cabecera.id, revision: { ...evento.cabecera.revision },
    state_version: evento.cabecera.versionEstado, event_place_ids: lugares, event_group_ids: [...grupos],
    ...(evento.version === 2 ? { accesos_generales: generales } : {}) },
    cantidad: ids.size + cantidadGeneral, totalCentavos };
}
