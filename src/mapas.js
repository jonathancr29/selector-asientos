// ---------------------------------------------------------------------------
// Mapas guardados.
//
// Un mapa es el diseño de un recinto en JSON: nombre, columnas (bloques y
// pasillos), bandas, mesas y butacas bloqueadas. No guarda la ocupacion ni la seleccion, que son datos de
// venta. Se guarda en el navegador y se exporta o importa como archivo .json.
//
// Al importar, el archivo es un dato que no se ha visto nunca: se comprueba campo
// por campo, se descarta lo desconocido y se verifica que todas las mesas quepan.
//
// Version 2: 'distribucion' ({ bloques, pasillos }). La version 1 guardaba
// 'pasillos' con nombre ('ambos'...); al leerla se convierte a distribucion.
// Version 3: 'lienzo' (un bloque, sin pasillos), 'escenario: null' (sin escenario),
// bandas de tipo 'espacio' (con 'guias') y el escenario ya no es banda obligatoria.
// ---------------------------------------------------------------------------
const FORMATO_MAPA = 'selector-asientos/mapa';
const VERSION_MAPA = 8;

// La ubicacion pertenece al inventario, nunca a un contenedor de dibujo.
const TIPOS_FISICOS = {
  sector: { lista: 'sectores', campo: 'sectorId', prefijo: 'sector', contador: 'siguienteSector' },
  fila: { lista: 'filasFisicas', campo: 'filaId', prefijo: 'fila', contador: 'siguienteFilaFisica' },
  palco: { lista: 'palcos', campo: 'grupoId', prefijo: 'palco', contador: 'siguientePalco' },
};
const estructuraFisicaDe = (p) => ({ sectores: copiarDatos(p.sectores || []), filasFisicas: copiarDatos(p.filasFisicas || []),
  palcos: copiarDatos(p.palcos || []), siguienteSector: p.siguienteSector || 1,
  siguienteFilaFisica: p.siguienteFilaFisica || 1, siguientePalco: p.siguientePalco || 1,
  entidadesRetiradas: [...(p.entidadesRetiradas || [])] });
const entidadFisicaDe = (p, tipo, id) => (p[TIPOS_FISICOS[tipo]?.lista] || []).find((e) => e.id === id);
const miembrosFisicos = (p, tipo, id) => Object.values(p.identidadFisica || {}).filter((f) => f[TIPOS_FISICOS[tipo]?.campo] === id).map((f) => f.id);
const nombreFisicoNormalizado = (s) => s.normalize('NFKC').trim().toLocaleUpperCase('es');

function agregarEntidadFisica(plano, tipo, nombre, nivel, zona) {
  const t = TIPOS_FISICOS[tipo];
  if (!t || !etiquetaOficialValida(nombre) || !nivelesDe(plano).some((n) => n.id === nivel) || !zonasDe(plano).some((z) => z.id === zona)) return { motivo: 'tipo, nombre, nivel o zona física inválidos' };
  const lista = plano[t.lista] || [];
  if (lista.length >= 1000 || lista.some((e) => e.nivel === nivel && e.zona === zona && nombreFisicoNormalizado(e.nombre) === nombreFisicoNormalizado(nombre))) return { motivo: 'nombre físico repetido o límite de 1.000 entidades por tipo' };
  const nuevo = copiarPlano(plano);
  let siguiente = nuevo[t.contador] || 1;
  const usados = new Set([...(nuevo.entidadesRetiradas || []), ...lista.map((e) => e.id)]);
  let id;
  do { id = t.prefijo + siguiente++; } while (usados.has(id));
  if (siguiente > 1e6) return { motivo: 'se agotaron los IDs de este tipo físico' };
  nuevo[t.lista] = [...lista, { id, nombre: nombre.trim(), nivel, zona }];
  nuevo[t.contador] = siguiente;
  return { plano: nuevo, id };
}

function mostrarFilasDeSector(plano, id, mostrar) {
  if (!entidadFisicaDe(plano, 'sector', id) || typeof mostrar !== 'boolean') return { motivo: 'sector o referencia visual inválidos' };
  const nuevo = copiarPlano(plano);
  const sector = nuevo.sectores.find(e => e.id === id);
  if (mostrar) sector.mostrarFilasEnVisor = true;
  else delete sector.mostrarFilasEnVisor;
  return nuevo;
}

function renombrarEntidadFisica(plano, tipo, id, nombre) {
  const t = TIPOS_FISICOS[tipo];
  const e = entidadFisicaDe(plano, tipo, id);
  if (!e || !etiquetaOficialValida(nombre) || (plano[t.lista] || []).some((otra) => otra.id !== id && otra.nivel === e.nivel && otra.zona === e.zona && nombreFisicoNormalizado(otra.nombre) === nombreFisicoNormalizado(nombre))) return { motivo: 'entidad desconocida o nombre físico inválido/repetido' };
  const nuevo = copiarPlano(plano);
  nuevo[t.lista].find((otra) => otra.id === id).nombre = nombre.trim();
  if (tipo === 'fila') for (const f of Object.values(nuevo.identidadFisica || {})) if (f.filaId === id && f.fila !== undefined) f.fila = nombre.trim();
  return nuevo;
}

function eliminarEntidadFisica(plano, tipo, id) {
  const t = TIPOS_FISICOS[tipo];
  if (!entidadFisicaDe(plano, tipo, id)) return { motivo: 'entidad física desconocida' };
  if (miembrosFisicos(plano, tipo, id).length) return { motivo: 'reasigna o desvincula sus lugares antes de eliminarla' };
  const nuevo = copiarPlano(plano);
  nuevo[t.lista] = nuevo[t.lista].filter((e) => e.id !== id);
  nuevo.entidadesRetiradas = [...new Set([...(nuevo.entidadesRetiradas || []), id])];
  return nuevo;
}

function asignarPertenenciaFisica(plano, ids, tipo, id) {
  const t = TIPOS_FISICOS[tipo];
  const e = id ? entidadFisicaDe(plano, tipo, id) : null;
  if (!t || (id && !e) || !Array.isArray(ids) || !ids.length) return { motivo: 'entidad física o selección inválida' };
  const nuevo = copiarPlano(plano);
  const porId = new Map(Object.entries(nuevo.identidadFisica || {}).map(([k,f]) => [f.id, { k, f }]));
  const elegidos = [...new Set(ids)].map((i) => porId.get(i));
  if (elegidos.some((p) => !p || (e && (p.f.nivel !== e.nivel || p.f.zona !== e.zona)) || (id && tipo !== 'sector' && p.k.startsWith('M')))) return { motivo: 'los lugares deben existir y compartir nivel y zona; una mesa no se convierte en fila o palco' };
  if (id && tipo === 'fila' && elegidos.some(({ f }) => f.grupoId)) return { motivo: 'desvincula el palco antes de asignar una fila' };
  if (id && tipo === 'palco' && elegidos.some(({ f }) => f.filaId)) return { motivo: 'desvincula la fila antes de asignar un palco' };
  let numero = 1;
  const usados = new Set(Object.values(nuevo.identidadFisica).filter((f) => f.grupoId === id).map((f) => f.numeroGrupo));
  for (const { f } of elegidos) {
    if (!id) { delete f[t.campo]; if (tipo === 'palco') delete f.numeroGrupo; }
    else {
      if (tipo === 'palco' && f.grupoId !== id) {
        while (usados.has(String(numero))) numero++;
        f.numeroGrupo = String(numero++); usados.add(f.numeroGrupo);
      }
      f[t.campo] = id;
      if (tipo === 'fila' && f.fila !== undefined) f.fila = e.nombre;
    }
  }
  return nuevo;
}

function editarNumeroPalco(plano, id, numero) {
  const nuevo = copiarPlano(plano);
  const f = Object.values(nuevo.identidadFisica || {}).find((p) => p.id === id);
  if (!f?.grupoId || !etiquetaOficialValida(numero)) return { motivo: 'lugar de palco o etiqueta inválidos' };
  if (Object.values(nuevo.identidadFisica).some((otra) => otra.id !== id && otra.grupoId === f.grupoId && nombreFisicoNormalizado(otra.numeroGrupo) === nombreFisicoNormalizado(numero))) return { motivo: 'número de lugar repetido en el palco' };
  f.numeroGrupo = numero.trim(); return nuevo;
}

function aplicarEstructuraFisica(plano) {
  const sectores = new Map((plano.sectores || []).map((e) => [e.id,e]));
  const filas = new Map((plano.filasFisicas || []).map((e) => [e.id,e]));
  const palcos = new Map((plano.palcos || []).map((e) => [e.id,e]));
  for (const b of butacas) {
    const f = plano.identidadFisica?.[b.claveDiseno];
    if (!f) continue;
    b.sectorFisico = sectores.get(f.sectorId) || null;
    b.filaFisica = filas.get(f.filaId) || null;
    if (b.filaFisica) b.fila = b.filaFisica.nombre;
    const palco = palcos.get(f.grupoId);
    if (palco) { b.grupo = { id: palco.id, nombre: 'Palco ' + palco.nombre, tipo: 'palco', completa: false }; b.numero = f.numeroGrupo; b.fila = null; b.numeroMesa = null; }
  }
}

// La clave del dibujo identifica una ranura del generador; el ID identifica un lugar.
// Al retirar una ranura su ID queda registrado y una ampliacion obtiene otro.
const idFisicoValido = (id) => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,59}$/.test(id);
const etiquetaOficialValida = (s) => typeof s === 'string' && s.trim().length > 0 && s.length <= 40 && !/[\u0000-\u001f]/.test(s);
const copiarIdentidad = (plano) => JSON.parse(JSON.stringify(plano.identidadFisica || {}));
const nuevoRecintoId = () => 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);

function sincronizarIdentidad(plano, lista = butacas) {
  const nuevo = copiarPlano(plano);
  const anteriores = plano.identidadFisica;
  const identidad = {};
  const retirados = new Set(plano.idsRetirados || []);
  const presentes = new Set(lista.map((b) => b.claveDiseno || b.id));
  for (const [clave, lugar] of Object.entries(anteriores || {})) {
    if (!presentes.has(clave)) retirados.add(lugar.id);
  }
  let siguiente = plano.siguienteLugar || 1;
  const usados = new Set([...retirados, ...Object.values(anteriores || {}).map((p) => p.id)]);
  for (const b of lista) {
    const clave = b.claveDiseno || b.id;
    if (anteriores?.[clave]) identidad[clave] = { ...anteriores[clave], nivel: anteriores[clave].nivel || b.nivel || 'n1' };
    else {
      let id = clave;
      if (usados.has(id)) {
        do { id = 'L' + siguiente++; } while (usados.has(id));
      }
      usados.add(id);
      identidad[clave] = { id, zona: b.zona, nivel: b.nivel || 'n1' };
    }
  }
  nuevo.identidadFisica = identidad;
  for (const local of [nuevo, ...nivelesDe(nuevo).filter((n) => n.plano).map((n) => n.plano)]) {
    for (const p of local.bloquesFilas || []) if (p.ajustes) {
      p.ajustes = Object.fromEntries(Object.entries(p.ajustes).filter(([clave, a]) => identidad[p.id + '-' + clave]?.id === a.id));
    }
  }
  const activos = new Set(Object.values(identidad).map((f) => f.id));
  nuevo.bloqueadas = (nuevo.bloqueadas || []).filter((id) => activos.has(id));
  nuevo.zonasDeAsiento = Object.fromEntries(Object.entries(nuevo.zonasDeAsiento || {}).filter(([id]) => activos.has(id)));
  nuevo.zonasFisicasConfirmadas = Object.fromEntries(Object.entries(nuevo.zonasFisicasConfirmadas || {}).filter(([id, zona]) => activos.has(id) && nuevo.zonasDeAsiento[id] === zona));
  nuevo.idsRetirados = [...retirados];
  nuevo.siguienteLugar = siguiente;
  nuevo.modoNumeracion = plano.modoNumeracion || 'automatica';
  nuevo.revisionFisica = { ...(plano.revisionFisica || { recintoId: nuevoRecintoId(), numero: 1, estado: 'borrador' }) };
  return nuevo;
}

function aplicarIdentidadFisica(dato) {
  for (const b of butacas) {
    b.claveDiseno = b.id;
    const fisica = dato.identidadFisica?.[b.claveDiseno];
    if (!fisica) continue;
    b.id = fisica.id;
    if (b.id !== b.claveDiseno && b.estado === 'ocupada') b.estado = 'libre';
    b.zona = fisica.zona;
  }
  const porPieza = new Map();
  for (const b of butacas) {
    const pieza = b.grupo?.id || b.bloque || b.suelta;
    if (pieza && !porPieza.has(pieza)) porPieza.set(pieza, b.zona);
  }
  for (const p of [...mesas, ...bloquesFilas, ...butacasSueltas]) if (porPieza.has(p.id)) p.zonaEfectiva = porPieza.get(p.id);
}

// Deshacer restaura los mismos lugares; una nueva accion no reutiliza lo descartado.
function conciliarIdentidadAlRestaurar(actual, destino) {
  const nuevo = copiarPlano(destino);
  const vivos = new Set(Object.values(nuevo.identidadFisica || {}).map((f) => f.id));
  const retirados = new Set([...(actual.idsRetirados || []), ...(nuevo.idsRetirados || []),
    ...Object.values(actual.identidadFisica || {}).map((f) => f.id)]);
  nuevo.idsRetirados = [...retirados].filter((id) => !vivos.has(id));
  const entidadesVivas = new Set(Object.values(TIPOS_FISICOS).flatMap((t) => (nuevo[t.lista] || []).map((e) => e.id)));
  nuevo.entidadesRetiradas = [...new Set([...(actual.entidadesRetiradas || []), ...(nuevo.entidadesRetiradas || []),
    ...Object.values(TIPOS_FISICOS).flatMap((t) => (actual[t.lista] || []).map((e) => e.id))])].filter((id) => !entidadesVivas.has(id));
  for (const t of Object.values(TIPOS_FISICOS)) nuevo[t.contador] = Math.max(actual[t.contador] || 1, nuevo[t.contador] || 1);
  for (const k of ['siguiente', 'siguienteBanda', 'siguienteBloque', 'siguienteButaca', 'siguienteForma', 'siguienteZona', 'siguienteLugar', 'siguienteNivel', 'siguienteRegion']) {
    nuevo[k] = Math.max(actual[k] || 1, nuevo[k] || 1);
  }
  return nuevo;
}

function aplicarNumeracionOficial(dato) {
  if (dato.modoNumeracion !== 'oficial') return;
  for (const b of butacas) {
    const f = dato.identidadFisica?.[b.claveDiseno];
    if (b.grupo && f?.mesa) b.numeroMesa = f.mesa;
    if (!f?.numero) continue;
    b.numero = f.numero;
    if (b.grupo) b.numeroMesa = f.mesa;
    else b.fila = f.fila;
    b.seccion = zonas[b.zona].nombre;
  }
  // Los rotulos de banda siguen la primera butaca, incluso con letras explicitas.
  const primeras = new Map();
  for (const b of butacas) if (b.banda) {
    const clave = b.banda + ':' + b.filaLocal;
    if (!primeras.has(clave)) primeras.set(clave, b);
  }
  for (const m of muebles) if (m.tipo === 'rotulo') {
    const b = primeras.get(m.banda + ':' + m.filaLocal);
    if (b) m.texto = b.fila;
  }
  const nombres = new Map();
  for (const b of butacas) if (b.grupo) {
    b.grupo.nombre = 'Mesa ' + b.numeroMesa;
    nombres.set(b.grupo.id, b.numeroMesa);
  }
  for (const m of muebles) if (m.mesa && nombres.has(m.mesa)) {
    m.numero = String(nombres.get(m.mesa)); m.texto = 'Mesa ' + m.numero;
  }
}

function cambiarNumeracion(plano, modo, lista = butacas) {
  if (!['automatica', 'oficial'].includes(modo)) return { motivo: 'modo de numeración desconocido' };
  const nuevo = sincronizarIdentidad(plano, lista);
  nuevo.modoNumeracion = modo;
  if (modo === 'oficial') for (const b of lista) {
    const f = nuevo.identidadFisica[b.claveDiseno || b.id];
    if (b.grupo?.tipo === 'palco') { delete f.numero; delete f.fila; delete f.mesa; continue; }
    f.numero = String(b.numero);
    if (b.grupo) f.mesa = String(b.numeroMesa);
    else f.fila = String(b.fila);
  }
  else for (const f of Object.values(nuevo.identidadFisica)) { delete f.numero; delete f.fila; delete f.mesa; }
  return nuevo;
}

const claveEtiquetaFisica = (f) => JSON.stringify([f.nivel || 'n1', f.zona, f.sectorId || '', f.grupoId || '', f.grupoId ? 'palco' : f.mesa ? 'mesa' : 'fila', f.grupoId || f.mesa || f.fila, f.grupoId ? f.numeroGrupo : f.numero]
  .map((s) => String(s).normalize('NFKC').trim().toLocaleUpperCase('es')));
function editarEtiquetaOficial(plano, id, valores) {
  if (plano.modoNumeracion !== 'oficial') return { motivo: 'activa la numeración oficial primero' };
  const nuevo = copiarPlano(plano);
  const lugar = Object.values(nuevo.identidadFisica || {}).find((f) => f.id === id);
  if (!lugar) return { motivo: 'ese lugar ya no existe' };
  if (lugar.grupoId) return editarNumeroPalco(plano, id, String(valores.numero ?? ''));
  if (lugar.filaId && valores.fila !== entidadFisicaDe(plano, 'fila', lugar.filaId)?.nombre) return { motivo: 'renombra la fila física desde su catálogo' };
  const claveLugar = Object.keys(nuevo.identidadFisica).find((k) => nuevo.identidadFisica[k] === lugar);
  const deMesa = claveLugar.startsWith('M');
  const fila = String(valores.fila ?? '').trim();
  const numero = String(valores.numero ?? '').trim();
  if (!etiquetaOficialValida(fila) || !etiquetaOficialValida(numero)) return { motivo: 'las etiquetas deben tener entre 1 y 40 caracteres, sin controles' };
  lugar.numero = numero;
  if (deMesa) {
    // El numero de mesa es comun a todos sus lugares, no solo al seleccionado.
    const clave = Object.keys(nuevo.identidadFisica).find((k) => nuevo.identidadFisica[k] === lugar);
    const mesaId = clave.split('-')[0];
    for (const [k, f] of Object.entries(nuevo.identidadFisica)) if (k.startsWith(mesaId + '-')) f.mesa = fila;
  } else lugar.fila = fila;
  const etiquetas = new Set();
  for (const f of Object.values(nuevo.identidadFisica)) if (f.numero) {
    const clave = claveEtiquetaFisica(f);
    if (etiquetas.has(clave)) return { motivo: 'esa etiqueta ya pertenece a otro lugar de la zona' };
    etiquetas.add(clave);
  }
  return nuevo;
}

function fijarZonaInventario(plano, f, zona) {
  f.zona = zona;
  for (const [tipo,t] of Object.entries(TIPOS_FISICOS)) if (f[t.campo] && entidadFisicaDe(plano,tipo,f[t.campo])?.zona !== zona) {
    delete f[t.campo]; if (tipo === 'palco') delete f.numeroGrupo;
  }
}

function nuevaRevisionFisica(plano) {
  const nuevo = copiarPlano(plano);
  nuevo.revisionFisica = { recintoId: plano.revisionFisica.recintoId, numero: plano.revisionFisica.numero + 1, estado: 'borrador' };
  return nuevo;
}

function identidadDeMapa(dato, errores, idsZona) {
  if (dato.identidadFisica === undefined && dato.version < 6) return {};
  const entrada = dato.identidadFisica;
  const resultado = {};
  const ids = new Set();
  const retirados = dato.idsRetirados;
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada) || Object.keys(entrada).length > BUTACAS_MAXIMAS) {
    errores.push('el inventario de identidad física no es válido'); return {};
  }
  if (!Array.isArray(retirados) || retirados.length > BUTACAS_MAXIMAS || !retirados.every(idFisicoValido) || new Set(retirados).size !== retirados.length) {
    errores.push('el registro de IDs retirados no es válido');
  }
  const retiradosSet = new Set(Array.isArray(retirados) ? retirados : []);
  const etiquetasMesa = new Map();
  for (const [clave, f] of Object.entries(entrada)) {
    if (!idFisicoValido(clave) || !f || typeof f !== 'object' || Array.isArray(f) || !idFisicoValido(f.id) || !idsZona.has(f.zona)) {
      errores.push('identidad física inválida en ' + clave.slice(0, 60)); continue;
    }
    if (ids.has(f.id) || retiradosSet.has(f.id)) errores.push('ID físico repetido o retirado: ' + f.id);
    ids.add(f.id);
    resultado[clave] = { id: f.id, zona: f.zona, ...(f.nivel ? { nivel: f.nivel } : {}),
      ...Object.fromEntries(['sectorId','filaId','grupoId','numeroGrupo'].filter((k) => f[k] !== undefined).map((k) => [k,f[k]])) };
    if (clave.startsWith('M') && f.mesa !== undefined) {
      const grupo = clave.split('-')[0];
      if (!etiquetaOficialValida(f.mesa)) errores.push('etiqueta de mesa inválida en ' + f.id);
      else {
        if (etiquetasMesa.has(grupo) && etiquetasMesa.get(grupo) !== f.mesa) errores.push('etiquetas oficiales contradictorias en la mesa ' + grupo);
        etiquetasMesa.set(grupo, f.mesa);
        resultado[clave].mesa = f.mesa;
      }
    }
    if (f.numero !== undefined) {
      const mesa = clave.startsWith('M');
      if (!etiquetaOficialValida(f.numero) || !etiquetaOficialValida(mesa ? f.mesa : f.fila)) errores.push('etiqueta oficial inválida en ' + f.id);
      else Object.assign(resultado[clave], { numero: f.numero, ...(mesa ? { mesa: f.mesa } : { fila: f.fila }) });
    }
  }
  if (!['automatica', 'oficial'].includes(dato.modoNumeracion)) errores.push('modo de numeración inválido');
  const r = dato.revisionFisica;
  if (!r || !idFisicoValido(r.recintoId) || !esEntero(r.numero, 1, 1e6) || !['borrador', 'publicada'].includes(r.estado)) errores.push('revisión física inválida');
  if (!esEntero(dato.siguienteLugar, 1, 1e6)) errores.push('contador de lugares inválido');
  return resultado;
}

// Comprobacion local de integridad, no firma de seguridad ni sustituto del servidor.
function huellaRevision(mapa) {
  const claves = ['niveles', 'regionesLibres', 'siguienteNivel', 'siguienteRegion', 'distribucion', 'bandas', 'mesas', 'bloquesFilas', 'formas', 'butacasSueltas', 'escenario', 'lienzo',
    'bloqueadas', 'zonasDeAsiento', 'zonasFisicasConfirmadas', 'zonas', 'identidadFisica', 'idsRetirados', 'siguienteLugar', 'modoNumeracion',
    'siguiente', 'siguienteBanda', 'siguienteBloque', 'siguienteForma', 'siguienteButaca', 'siguienteZona',
    'sectores', 'filasFisicas', 'palcos', 'siguienteSector', 'siguienteFilaFisica', 'siguientePalco', 'entidadesRetiradas'];
  const texto = JSON.stringify({ revision: { recintoId: mapa.revisionFisica.recintoId, numero: mapa.revisionFisica.numero },
    contenido: Object.fromEntries(claves.map((k) => [k, mapa[k]])) });
  let a = 2166136261;
  let b = 5381;
  for (let i = 0; i < texto.length; i++) {
    a = Math.imul(a ^ texto.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ texto.charCodeAt(i);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

function publicarRevisionFisica(dato) {
  const { mapa, errores } = validarMapa(dato);
  if (errores) return { errores };
  const exportacion = exportarLugaresDeMapa(mapa);
  if (exportacion.errores) return exportacion;
  mapa.revisionFisica.estado = 'publicada';
  mapa.revisionFisica.huella = huellaRevision(mapa);
  return { mapa, catalogo: { ...exportacion.catalogo, revision: { ...mapa.revisionFisica } } };
}
const PASILLOS_VALIDOS = ['ninguno', 'izquierda', 'derecha', 'ambos'];
const GRUPO_MAPAS = 'Mis mapas';
const claveDeMapa = (nombre) => 'mapa:' + nombre;

// Se conservan para revision humana, nunca se consultan al seleccionar o cotizar.
function antecedentesDeMapa(dato, errores = []) {
  const previo = dato.antecedentesComerciales;
  if (previo !== undefined && (!previo || typeof previo !== 'object' || Array.isArray(previo))) {
    errores.push('los antecedentes comerciales no son válidos');
  }
  const precios = previo?.preciosPorZona ?? [];
  const completas = previo?.mesasCompletas ?? [];
  const resultado = { preciosPorZona: [], mesasCompletas: [] };
  if (!Array.isArray(precios) || precios.length > ZONAS_MAXIMAS ||
      !Array.isArray(completas) || completas.length > BUTACAS_MAXIMAS) {
    errores.push('las listas de antecedentes comerciales no son válidas');
    return resultado;
  }
  const vistos = new Set();
  // Los mapas antiguos sin catalogo usaban estas tarifas implicitas de ejemplo.
  const zonasAnteriores = Array.isArray(dato.zonas) ? dato.zonas : dato.zonas === undefined && dato.version < 5
    ? [{ id: 'luneta', precio: 35000 }, { id: 'mesas', precio: 50000 }, { id: 'general', precio: 20000 }] : [];
  for (const p of [...precios, ...zonasAnteriores.filter((z) => z && z.precio !== undefined)
    .map((z) => ({ zona: z.id, precio: z.precio }))]) {
    if (!p || typeof p.zona !== 'string' || !/^[a-z][a-z0-9]{0,30}$/.test(p.zona) || !esEntero(p.precio, 0, PRECIO_MAXIMO)) {
      errores.push('un precio anterior no es válido');
      continue;
    }
    if (!vistos.has(p.zona)) resultado.preciosPorZona.push({ zona: p.zona, precio: p.precio });
    vistos.add(p.zona);
  }
  for (const id of [...completas, ...(Array.isArray(dato.mesas) ? dato.mesas : []).filter((m) => m?.completa === true).map((m) => m.id)]) {
    if (typeof id !== 'string' || !/^M[1-9]\d{0,5}$/.test(id)) errores.push('una mesa completa anterior no es válida');
    else if (!resultado.mesasCompletas.includes(id)) resultado.mesasCompletas.push(id);
  }
  return resultado;
}

// El mapa de lo que hay ahora en un tipo de sala. 'idsExistentes' limpia las
// bloqueadas que ya no existen (de una banda o mesa eliminada).
function mapaDesdePlano(nombre, plano, guardado, idsExistentes = null) {
  plano = cambiarNivelPlano(plano, nivelesDe(plano)[0].id);
  generarPlano({ bandas: plano.bandas, distribucion: plano.distribucion, zonas: zonasDe(plano) }, plano);
  plano = sincronizarIdentidad(plano);
  return {
    formato: FORMATO_MAPA, version: VERSION_MAPA, nombre, guardado,
    ...estructuraFisicaDe(plano),
    niveles: copiarDatos(nivelesDe(plano)), siguienteNivel: plano.siguienteNivel || 2,
    regionesLibres: copiarDatos(plano.regionesLibres || []), siguienteRegion: plano.siguienteRegion || 1,
    distribucion: { bloques: [...plano.distribucion.bloques], pasillos: [...plano.distribucion.pasillos] },
    // Sin ocupacion de ejemplo, ni bloqueos por plantilla (ya van en la lista),
    // ni filas de mesas automaticas (las mesas van explicitas).
    bandas: limpiarBandasParaMapa(plano.bandas),
    mesas: plano.mesas.map((m) => { const { completa, ...fisica } = configDeMesa(m); return fisica; }),
    antecedentesComerciales: antecedentesDeMapa(plano),
    bloquesFilas: (plano.bloquesFilas || []).map((b) => ({ ...b })),
    formas: (plano.formas || []).map((f) => ({ ...f })),
    butacasSueltas: (plano.butacasSueltas || []).map((b) => ({ ...b })),
    ...(plano.escenario !== undefined ? { escenario: plano.escenario && { ...plano.escenario } } : {}),
    ...(plano.lienzo ? { lienzo: true } : {}),
    bloqueadas: (plano.bloqueadas || []).filter((id) => !idsExistentes || idsExistentes.has(id)),
    zonasDeAsiento: Object.fromEntries(Object.entries(plano.zonasDeAsiento || {})
      .filter(([id]) => !idsExistentes || idsExistentes.has(id))),
    zonasFisicasConfirmadas: Object.fromEntries(Object.entries(plano.zonasFisicasConfirmadas || {})
      .filter(([id, zona]) => (!idsExistentes || idsExistentes.has(id)) && plano.zonasDeAsiento?.[id] === zona)),
    siguiente: plano.siguiente,
    siguienteBanda: plano.siguienteBanda,
    siguienteBloque: plano.siguienteBloque || 1,
    siguienteForma: plano.siguienteForma || 1,
    siguienteButaca: plano.siguienteButaca || 1,
    zonas: copiarZonas(zonasDe(plano)),
    siguienteZona: plano.siguienteZona || 1,
    identidadFisica: copiarIdentidad(plano), idsRetirados: [...plano.idsRetirados],
    siguienteLugar: plano.siguienteLugar, modoNumeracion: plano.modoNumeracion,
    revisionFisica: { ...plano.revisionFisica },
  };
}

// Sin ocupacion de ejemplo, bloqueos por plantilla ni mesas automaticas, en todo el arbol.
const limpiarBandasParaMapa = (lista) => lista.map(({ ocupadas, bloqueadasAlFinal, filasDeMesas, verticales, ...banda }) => ({
  ...banda,
  ...(verticales ? { verticales: verticales.map((v) => ({ ...v, bandas: limpiarBandasParaMapa(v.bandas) })) } : {}),
}));

const definicionDeMapa = (mapa) => ({
  ...estructuraFisicaDe(mapa),
  nombre: mapa.nombre, grupo: GRUPO_MAPAS, lienzo: Boolean(mapa.lienzo), distribucion: mapa.distribucion, bandas: mapa.bandas,
  mesas: mapa.mesas, bloquesFilas: mapa.bloquesFilas, formas: mapa.formas, butacasSueltas: mapa.butacasSueltas,
  escenario: mapa.escenario, bloqueadas: mapa.bloqueadas, zonasDeAsiento: mapa.zonasDeAsiento,
  zonasFisicasConfirmadas: mapa.zonasFisicasConfirmadas,
  siguiente: mapa.siguiente, siguienteBanda: mapa.siguienteBanda, siguienteBloque: mapa.siguienteBloque,
  siguienteForma: mapa.siguienteForma, siguienteButaca: mapa.siguienteButaca,
  zonas: mapa.zonas, siguienteZona: mapa.siguienteZona,
  antecedentesComerciales: mapa.antecedentesComerciales,
  identidadFisica: mapa.identidadFisica, idsRetirados: mapa.idsRetirados, siguienteLugar: mapa.siguienteLugar,
  modoNumeracion: mapa.modoNumeracion, revisionFisica: mapa.revisionFisica,
  niveles: mapa.niveles, regionesLibres: mapa.regionesLibres, siguienteNivel: mapa.siguienteNivel, siguienteRegion: mapa.siguienteRegion,
});

function registrarMapa(mapa) {
  const clave = claveDeMapa(mapa.nombre);
  TIPOS_DE_SALA[clave] = definicionDeMapa(mapa);
  return clave;
}

function nombreDeArchivo(nombre) {
  const base = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (base || 'mapa') + '.json';
}

// Validacion de un mapa, por partes.
//
// Cada parte recibe la lista de 'errores' y la va llenando; ninguna corta, para que un
// archivo malo diga de una vez todo lo que le pasa. El orden en que validarMapa las llama
// es el orden en que salen los errores.

// Lo que impide siquiera mirar el archivo. Devuelve el motivo, o null si se puede seguir.
function motivoRecursosMapa(dato) {
  let elementos = 0;
  const contar = (lista) => {
    if (!Array.isArray(lista)) return false;
    elementos += lista.length;
    return elementos > ELEMENTOS_MAPA_MAXIMOS;
  };
  const niveles = Array.isArray(dato.niveles) ? dato.niveles : [];
  if (niveles.length > 12) return 'se requieren de 1 a 12 niveles';
  for (const plano of [dato, ...niveles.slice(1).map((n) => n?.plano)]) {
    if (!plano || typeof plano !== 'object') continue;
    for (const campo of ['bandas', 'mesas', 'bloquesFilas', 'formas', 'butacasSueltas', 'regionesLibres']) {
      if (contar(plano[campo])) return 'el mapa supera el máximo de ' + ELEMENTOS_MAPA_MAXIMOS + ' elementos de dibujo';
    }
    for (const b of Array.isArray(plano.bandas) ? plano.bandas : []) {
      if (contar(b?.verticales)) return 'el mapa supera el máximo de ' + ELEMENTOS_MAPA_MAXIMOS + ' elementos de dibujo';
      for (const v of Array.isArray(b?.verticales) ? b.verticales : []) {
        if (contar(v?.bandas)) return 'el mapa supera el máximo de ' + ELEMENTOS_MAPA_MAXIMOS + ' elementos de dibujo';
      }
    }
  }
  return null;
}

// Validar no debe sustituir los objetos a los que apuntan el SVG y porId.
function conservarEscenaGenerada(calcular) {
  const listas = [butacas, muebles, mesas, bloquesFilas, formas, butacasSueltas];
  const anteriores = listas.map((lista) => lista.slice());
  const indice = { ...zonas }, referencia = { ...escenario }, nivel = nivelGenerado;
  try { return calcular(); }
  finally {
    listas.forEach((lista, i) => { lista.length = 0; for (const elemento of anteriores[i]) lista.push(elemento); });
    for (const k of Object.keys(zonas)) delete zonas[k];
    Object.assign(zonas, indice);
    for (const k of Object.keys(escenario)) delete escenario[k];
    Object.assign(escenario, referencia);
    nivelGenerado = nivel;
  }
}

function motivoDeCabecera(dato) {
  if (!dato || typeof dato !== 'object' || Array.isArray(dato)) return 'el archivo no contiene un mapa';
  if (dato.formato !== FORMATO_MAPA) return 'no es un mapa de este selector de asientos';
  if (![1, 2, 3, 4, 5, 6, 7, VERSION_MAPA].includes(dato.version)) return 'versión de mapa no compatible (' + dato.version + ')';
  return motivoRecursosMapa(dato);
}

// Recorre una lista de piezas del mapa: comprueba el id contra su patron, aparta los
// repetidos y deja que 'limpiar' valide lo demas y devuelva la pieza limpia. 'como' es
// como se nombra la pieza mientras no hay id de fiar («mesa 2: id no válido»); pasado ese
// punto, el id ya sirve de etiqueta («M2: giro no válido»), salvo que 'etiqueta' diga otra
// cosa. Devuelve { limpias, ids }; las que fallan el id quedan como null, y para entonces
// ya hay errores y el mapa no se llega a montar.
function listaDeMapa(lista, { como, patron, errores, limpiar, etiqueta = (p) => p.id }) {
  const ids = new Set();
  const limpias = (Array.isArray(lista) ? lista : []).map((p, i) => {
    if (!p || typeof p.id !== 'string' || !patron.test(p.id) || ids.has(p.id)) {
      errores.push(como + ' ' + (i + 1) + ': id no válido o repetido');
      return null;
    }
    ids.add(p.id);
    return limpiar(p, (queja) => errores.push(etiqueta(p, i) + ': ' + queja));
  });
  return { limpias, ids };
}

// Una lista que los mapas anteriores no traian: sin ella, vacia; con algo que no es una
// lista, un error y vacia.
function listaOpcionalDeMapa(dato, campo, nombreLista, errores) {
  if (dato[campo] === undefined) return [];
  if (Array.isArray(dato[campo])) return dato[campo];
  errores.push('la lista de ' + nombreLista + ' no es válida');
  return [];
}

// Las columnas de toda la sala. La version 1 las guardaba como una disposicion con nombre.
function columnasDeMapa(dato, errores) {
  let distribucion = null;
  if (dato.version === 1) {
    if (PASILLOS_VALIDOS.includes(dato.pasillos)) distribucion = distribucionDePasillos(dato.pasillos);
    else errores.push('pasillos desconocidos');
  } else {
    const d = dato.distribucion;
    const motivo = motivoDistribucion(d);
    if (motivo) errores.push('columnas: ' + motivo);
    else distribucion = { bloques: [...d.bloques], pasillos: [...d.pasillos] };
  }
  const lienzo = dato.lienzo === true;
  if (dato.lienzo !== undefined && typeof dato.lienzo !== 'boolean') errores.push('lienzo debe ser true o false');
  if (lienzo && distribucion && distribucion.bloques.length !== 1) errores.push('un lienzo no tiene pasillos');
  return { distribucion, lienzo };
}

// Zonas: opcionales (sin ellas, las de siempre). Van antes que las bandas, que las usan.
function zonasDeMapa(dato, errores) {
  if (dato.zonas === undefined) return copiarZonas(ZONAS_POR_DEFECTO);
  const lista = Array.isArray(dato.zonas) ? dato.zonas : [];
  if (!Array.isArray(dato.zonas) || !lista.length || lista.length > ZONAS_MAXIMAS) {
    errores.push('debe haber de 1 a ' + ZONAS_MAXIMAS + ' zonas');
  }
  const nombres = new Set();
  const { limpias, ids } = listaDeMapa(lista, {
    como: 'zona', patron: /^[a-z][a-z0-9]{0,30}$/, errores,
    // Una zona se nombra por su sitio en la lista, no por su id: el id no se ve.
    etiqueta: (z, i) => 'zona ' + (i + 1),
    limpiar: (z, queja) => {
      const nombreZona = typeof z.nombre === 'string' ? z.nombre.trim() : '';
      if (!nombreZona || nombreZona.length > NOMBRE_MAXIMO) queja('el nombre debe tener entre 1 y ' + NOMBRE_MAXIMO + ' caracteres');
      else if (nombres.has(nombreZona.toLowerCase())) queja('nombre repetido');
      nombres.add(nombreZona.toLowerCase());
      if (dato.version < 5 && z.precio !== undefined && !esEntero(z.precio, 0, PRECIO_MAXIMO)) queja('precio no válido');
      return { id: z.id, nombre: nombreZona };
    },
  });
  if (Array.isArray(dato.zonas) && !ids.has('mesas')) errores.push('falta la zona de mesas');
  if (Array.isArray(dato.zonas) && ![...ids].some((id) => id !== 'mesas')) errores.push('falta una zona para filas');
  return limpias.filter(Boolean);
}

// El arbol de bandas: franjas de la sala, con sus verticales y las bandas de dentro.
function bandasDeMapa(dato, { errores, zonaDeFilas, zonaHeredable }) {
  const bandasDato = Array.isArray(dato.bandas) ? dato.bandas : [];
  // Hasta la version 2, el escenario era siempre la primera banda.
  if (dato.version < 3 && (!bandasDato.length || !bandasDato[0] || bandasDato[0].tipo !== 'escenario')) {
    errores.push('la primera banda debe ser el escenario');
  } else if (!bandasDato.length) {
    errores.push('el mapa necesita al menos una banda');
  }
  const ids = new Set();
  const idValido = (id) => typeof id === 'string' && /^[a-z][a-z0-9]{0,30}$/i.test(id) && !ids.has(id);
  // Una banda hoja (escenario, filas, mesas) o, en la sala, una franja dividida.
  const limpiarBanda = (b, donde, enVertical, indice) => {
    if (!b || !idValido(b.id)) {
      errores.push(donde + ': id no válido o repetido');
      return null;
    }
    ids.add(b.id);
    const limpia = { id: b.id, tipo: b.tipo };
    if (b.ladoRotulo !== undefined) {
      if (!['filas', 'espacio'].includes(b.tipo) || !['izquierdo', 'derecho'].includes(b.ladoRotulo)) errores.push(donde + ': lado de rótulo inválido');
      else limpia.ladoRotulo = b.ladoRotulo;
    }
    if (typeof b.nombre === 'string' && b.nombre.trim()) limpia.nombre = b.nombre.trim().slice(0, 40);
    if (b.tipo === 'escenario') {
      if (enVertical || indice > 0) errores.push(donde + ': el escenario solo puede ir primero');
    } else if (b.tipo === 'filas') {
      if (!esEntero(b.filas, 1, FILAS_MAXIMAS)) errores.push(donde + ': número de filas fuera de rango');
      if (!zonaDeFilas(b.zona)) errores.push(donde + ': zona desconocida');
      Object.assign(limpia, { zona: b.zona, filas: b.filas });
    } else if (b.tipo === 'mesas' || (b.tipo === 'espacio' && dato.version >= 3)) {
      if (!esEntero(b.alto, 1, ALTO_MAXIMO)) errores.push(donde + ': alto fuera de rango');
      limpia.alto = b.alto;
      if (!zonaHeredable(b.zona)) errores.push(donde + ': zona desconocida');
      else if (b.zona !== undefined) limpia.zona = b.zona;
      if (b.tipo === 'espacio' && b.guias === true) limpia.guias = true;
    } else if (b.tipo === 'division' && !enVertical) {
      const verticales = Array.isArray(b.verticales) ? b.verticales : [];
      if (verticales.length < 1 || verticales.length > VERTICALES_MAXIMAS) {
        errores.push(donde + ': debe tener de 1 a ' + VERTICALES_MAXIMAS + ' bandas verticales');
      }
      if (!zonaHeredable(b.zona)) errores.push(donde + ': zona desconocida');
      else if (b.zona !== undefined) limpia.zona = b.zona;
      limpia.verticales = verticales.map((v, k) => {
        const dondeV = donde + ', vertical ' + (k + 1);
        if (!v || !idValido(v.id)) {
          errores.push(dondeV + ': id no válido o repetido');
          return null;
        }
        ids.add(v.id);
        const limpiaV = { id: v.id };
        if (typeof v.nombre === 'string' && v.nombre.trim()) limpiaV.nombre = v.nombre.trim().slice(0, 40);
        if (!zonaHeredable(v.zona)) errores.push(dondeV + ': zona desconocida');
        else if (v.zona !== undefined) limpiaV.zona = v.zona;
        if (k < verticales.length - 1) {
          if (!esEntero(v.ancho, 1, ANCHO_MAXIMO)) errores.push(dondeV + ': ancho fuera de rango');
          limpiaV.ancho = v.ancho;
        }
        const interiores = Array.isArray(v.bandas) ? v.bandas : [];
        if (!Array.isArray(v.bandas)) errores.push(dondeV + ': falta la lista de bandas');
        limpiaV.bandas = interiores.map((bi, n) => {
          if (bi && !['filas', 'mesas', 'espacio'].includes(bi.tipo)) {
            errores.push(dondeV + ', banda ' + (n + 1) + ': dentro de una vertical solo van filas, mesas o espacios');
            return null;
          }
          return limpiarBanda(bi, dondeV + ', banda ' + (n + 1), true, n);
        });
        return limpiaV;
      });
    } else {
      errores.push(donde + ': tipo de banda desconocido');
    }
    return limpia;
  };
  return { bandas: bandasDato.map((b, i) => limpiarBanda(b, 'banda ' + (i + 1), false, i)), ids };
}

function mesasDeMapa(dato, { errores, zonaHeredable }) {
  if (!Array.isArray(dato.mesas)) errores.push('falta la lista de mesas');
  return listaDeMapa(dato.mesas, {
    como: 'mesa', patron: /^M[1-9]\d{0,5}$/, errores,
    limpiar: (m, queja) => {
      if (!esEntero(m.x, 0, 999) || !esEntero(m.y, 0, 999)) queja('posición no válida');
      if (![0, 90, 180, 270].includes(m.giro)) queja('giro no válido');
      if (m.completa !== undefined && typeof m.completa !== 'boolean') queja('completa debe ser true o false');
      const completa = {};
      // Sin zona propia, los lugares de la mesa heredan la de su banda.
      if (!zonaHeredable(m.zona)) queja('zona desconocida');
      const zonaPropia = zonaHeredable(m.zona) && m.zona !== undefined ? { zona: m.zona } : {};
      // Mesa redonda: solo lugares. Las rectangulares no llevan 'tipo' (mapas anteriores).
      if (m.tipo === 'redonda') {
        if (!esEntero(m.lugares, LUGARES_MINIMOS_REDONDA, LUGARES_MAXIMOS_REDONDA) || m.lugares % 2) {
          queja('los lugares de una mesa redonda deben ser un número par de ' +
                LUGARES_MINIMOS_REDONDA + ' a ' + LUGARES_MAXIMOS_REDONDA);
        }
        return { id: m.id, tipo: 'redonda', x: m.x, y: m.y, lugares: m.lugares, giro: m.giro, ...completa, ...zonaPropia };
      }
      if (m.tipo !== undefined) queja('tipo de mesa desconocido');
      if (!esEntero(m.largo, 1, LARGO_MAXIMO)) queja('largo fuera de rango');
      if (typeof m.cabeceras !== 'boolean' || typeof m.unLado !== 'boolean') {
        queja('cabeceras y unLado deben ser true o false');
      }
      return { id: m.id, x: m.x, y: m.y, largo: m.largo, cabeceras: m.cabeceras, unLado: m.unLado, giro: m.giro, ...completa, ...zonaPropia };
    },
  });
}

// Bloques de filas: opcionales (los mapas anteriores no los tienen).
function bloquesDeMapa(dato, { errores, zonaDeFilas }) {
  return listaDeMapa(listaOpcionalDeMapa(dato, 'bloquesFilas', 'bloques de filas', errores), {
    como: 'bloque', patron: /^F[1-9]\d{0,5}$/, errores,
    limpiar: (b, queja) => {
      if (![b.x, b.y].every((v) => Number.isFinite(v) && v >= 0 && v <= 999 && (b.geometria || Number.isInteger(v)))) queja('posición no válida');
      if (!esEntero(b.ancho, 1, ANCHO_BLOQUE_MAXIMO)) queja('butacas por fila fuera de rango');
      if (!esEntero(b.filas, 1, FILAS_MAXIMAS)) queja('número de filas fuera de rango');
      if (b.zona !== undefined && !zonaDeFilas(b.zona)) queja('zona desconocida');
      if (b.geometria) { if (motivoGeometria(b)) queja('geometría no válida'); }
      else if (![0, 90, 180, 270].includes(b.giro)) queja('giro no válido');
      const limpio = { id: b.id, tipo: 'filas', x: b.x, y: b.y, ancho: b.ancho, filas: b.filas, giro: b.giro,
                       ...(b.zona !== undefined ? { zona: b.zona } : {}) };
      if (b.geometria) {
        limpio.geometria = Object.fromEntries(Object.keys(geometriaInicial()).map((k) => [k, b.geometria[k]]));
        limpio.ajustes = ajustesDeMapa(b, queja);
      }
      if (b.region !== undefined) { if (!idFisicoValido(b.region)) queja('región inválida'); else limpio.region = b.region; }
      if (typeof b.nombre === 'string' && b.nombre.trim()) limpio.nombre = b.nombre.trim().slice(0, 40);
      return limpio;
    },
  });
}

// Formas y butacas sueltas: opcionales (los mapas anteriores no las tienen).
function formasDeMapa(dato, { errores }) {
  return listaDeMapa(listaOpcionalDeMapa(dato, 'formas', 'formas', errores), {
    como: 'forma', patron: /^P[1-9]\d{0,5}$/, errores,
    limpiar: (f, queja) => {
      if (!esFormaConocida(f.forma)) queja('forma desconocida');
      if (!esEntero(f.x, 0, 999) || !esEntero(f.y, 0, 999)) queja('posición no válida');
      if (!esEntero(f.ancho, 1, FORMA_ANCHO_MAXIMO) || !esEntero(f.alto, 1, FORMA_ALTO_MAXIMO)) {
        queja('tamaño fuera de rango');
      }
      const limpia = { id: f.id, tipo: 'forma', forma: f.forma, x: f.x, y: f.y, ancho: f.ancho, alto: f.alto };
      if (typeof f.nombre === 'string' && f.nombre.trim()) limpia.nombre = f.nombre.trim().slice(0, NOMBRE_MAXIMO);
      return limpia;
    },
  });
}

function butacasSueltasDeMapa(dato, { errores, zonaDeFilas }) {
  return listaDeMapa(listaOpcionalDeMapa(dato, 'butacasSueltas', 'butacas sueltas', errores), {
    como: 'butaca suelta', patron: /^B[1-9]\d{0,5}$/, errores,
    limpiar: (b, queja) => {
      if (!esEntero(b.x, 0, 999) || !esEntero(b.y, 0, 999)) queja('posición no válida');
      if (b.zona !== undefined && !zonaDeFilas(b.zona)) queja('zona desconocida');
      if (![0, 90, 180, 270].includes(b.giro)) queja('giro no válido');
      return { id: b.id, tipo: 'butaca', x: b.x, y: b.y, giro: b.giro, ...(b.zona !== undefined ? { zona: b.zona } : {}) };
    },
  });
}

// Escenario: opcional (sin el, la franja de la banda «escenario» a todo el ancho; con
// null, desde la version 3, no hay escenario). Devuelve undefined si el mapa no lo trae,
// que no es lo mismo que null.
function escenarioDeMapa(dato, errores) {
  if (dato.escenario === null && dato.version >= 3) return null;
  if (dato.escenario === undefined) return undefined;
  const e = dato.escenario;
  if (!e || !esEntero(e.x, 0, 999) || !esEntero(e.y, 0, 999) ||
      !esEntero(e.ancho, 1, ESCENARIO_ANCHO_MAXIMO) || !esEntero(e.alto, 1, ESCENARIO_ALTO_MAXIMO)) {
    errores.push('el escenario no es válido');
    return undefined;
  }
  return { x: e.x, y: e.y, ancho: e.ancho, alto: e.alto };
}

// Zonas asignadas a asientos: opcional. Cada una debe ser una zona del mapa.
function zonasDeAsientoDeMapa(dato, errores, idsZona) {
  const limpias = {};
  if (dato.zonasDeAsiento === undefined) return limpias;
  const dz = dato.zonasDeAsiento;
  if (!dz || typeof dz !== 'object' || Array.isArray(dz)) {
    errores.push('las zonas de los asientos no son válidas');
    return limpias;
  }
  for (const [id, zona] of Object.entries(dz)) {
    if (id.length > 60 || typeof zona !== 'string' || !idsZona.has(zona)) {
      errores.push('asiento ' + id.slice(0, 60) + ': zona desconocida');
    } else {
      limpias[id] = zona;
    }
  }
  return limpias;
}

// Devuelve { mapa } limpio y valido, o { errores: [...] } en palabras. Genera el
// plano para comprobar que las mesas quepan: cambia butacas, muebles y mesas, asi
// que quien la llame debe volver a generar su sala despues.
function ajustesDeMapa(b, queja) {
  const ajustes = {};
  if (b.ajustes === undefined) return ajustes;
  if (!b.ajustes || typeof b.ajustes !== 'object' || Array.isArray(b.ajustes) || Object.keys(b.ajustes).length > b.ancho * b.filas) { queja('ajustes inválidos'); return ajustes; }
  for (const [clave, a] of Object.entries(b.ajustes)) {
    const partes = clave.split('-').map(Number);
    if (!/^\d+-\d+$/.test(clave) || partes[0] < 1 || partes[0] > b.filas || partes[1] < 1 || partes[1] > b.ancho ||
        !a || !idFisicoValido(a.id) || ![a.dx, a.dy, a.giro].every((v) => Number.isFinite(v) && Math.abs(v) <= 360)) { queja('corrección individual inválida'); continue; }
    ajustes[clave] = { id: a.id, dx: a.dx, dy: a.dy, giro: a.giro };
  }
  return ajustes;
}

function regionesDeMapa(lista, idsZona, errores) {
  if (lista === undefined) return [];
  if (!Array.isArray(lista) || lista.length > 100) { errores.push('lista de regiones inválida'); return []; }
  const ids = new Set();
  const regiones = [];
  for (const r of lista) {
    if (!r || !idFisicoValido(r.id) || ids.has(r.id) || typeof r.nombre !== 'string' || !r.nombre.trim() || r.nombre.length > 40 ||
        ![r.x, r.y, r.ancho, r.alto, r.giro].every(Number.isFinite) || r.x < 1 || r.y < 0 || r.ancho < 1 || r.ancho > 300 ||
        r.alto < 1 || r.alto > 999 || r.giro < 0 || r.giro >= 360 || (r.zona !== undefined && !idsZona.has(r.zona))) { errores.push('región inválida o repetida'); continue; }
    ids.add(r.id);
    regiones.push({ id: r.id, nombre: r.nombre.trim(), x: r.x, y: r.y, ancho: r.ancho, alto: r.alto, giro: r.giro,
      ...(r.zona ? { zona: r.zona } : {}) });
  }
  return regiones;
}

function validarEstructuraFisica(dato, errores) {
  const limpio = {};
  const niveles = new Set((Array.isArray(dato.niveles) ? dato.niveles : []).map((n) => n?.id));
  const zonasFisicas = new Set((Array.isArray(dato.zonas) ? dato.zonas : []).map((z) => z?.id));
  const retirados = dato.entidadesRetiradas;
  const patron = /^(sector|fila|palco)[1-9]\d{0,5}$/;
  if (!Array.isArray(retirados) || retirados.length > BUTACAS_MAXIMAS || !retirados.every((id) => typeof id === 'string' && patron.test(id)) || new Set(retirados).size !== retirados.length) errores.push('registro de entidades retiradas inválido');
  limpio.entidadesRetiradas = Array.isArray(retirados) ? [...retirados] : [];
  const idsRetirados = new Set(limpio.entidadesRetiradas);
  for (const [tipo,t] of Object.entries(TIPOS_FISICOS)) {
    const lista = dato[t.lista];
    limpio[t.lista] = [];
    if (!Array.isArray(lista) || lista.length > 1000) { errores.push('lista física inválida: ' + tipo); continue; }
    const ids = new Set();
    const nombres = new Set();
    for (const e of lista) {
      if (!e || typeof e.id !== 'string' || !new RegExp('^' + t.prefijo + '[1-9]\\d{0,5}$').test(e.id) || ids.has(e.id) || idsRetirados.has(e.id) || !etiquetaOficialValida(e.nombre) || !niveles.has(e.nivel) || !zonasFisicas.has(e.zona)) { errores.push('entidad física inválida o retirada: ' + tipo); continue; }
      ids.add(e.id);
      const nombre = JSON.stringify([e.nivel,e.zona,nombreFisicoNormalizado(e.nombre)]);
      if (nombres.has(nombre)) errores.push('nombre físico repetido: ' + tipo);
      nombres.add(nombre);
      if (e.mostrarFilasEnVisor !== undefined && (tipo !== 'sector' || typeof e.mostrarFilasEnVisor !== 'boolean')) errores.push('referencia visual de filas inválida: ' + e.id);
      limpio[t.lista].push({ id: e.id, nombre: e.nombre.trim(), nivel: e.nivel, zona: e.zona,
        ...(tipo === 'sector' && e.mostrarFilasEnVisor === true ? { mostrarFilasEnVisor: true } : {}) });
    }
    if (!esEntero(dato[t.contador],1,1e6)) errores.push('contador físico inválido: ' + tipo);
    limpio[t.contador] = Math.max(dato[t.contador] || 1, ...[...ids, ...limpio.entidadesRetiradas.filter((id) => id.startsWith(t.prefijo))].map((id) => Number(id.slice(t.prefijo.length)) + 1));
  }
  const porTipo = new Map(Object.entries(TIPOS_FISICOS).map(([tipo,t]) => [tipo,new Map(limpio[t.lista].map((e) => [e.id,e]))]));
  const etiquetasPalco = new Set();
  for (const [clave,f] of Object.entries(dato.identidadFisica || {})) {
    if (!f || typeof f !== 'object') continue;
    for (const [tipo,t] of Object.entries(TIPOS_FISICOS)) if (f[t.campo] !== undefined) {
      const e = porTipo.get(tipo).get(f[t.campo]);
      if (!e || e.nivel !== f.nivel || e.zona !== f.zona || (tipo !== 'sector' && clave.startsWith('M'))) errores.push('pertenencia física incompatible: ' + f.id + ' (' + tipo + ')');
      if (tipo === 'fila' && e && f.fila !== undefined && f.fila !== e.nombre) errores.push('etiqueta distinta de la fila física: ' + f.id);
    }
    if (f.filaId && f.grupoId) errores.push('un lugar de palco no pertenece también a una fila: ' + f.id);
    if (f.grupoId) {
      if (!etiquetaOficialValida(f.numeroGrupo)) errores.push('número de lugar de palco inválido: ' + f.id);
      else {
        const etiqueta = JSON.stringify([f.grupoId,nombreFisicoNormalizado(f.numeroGrupo)]);
        if (etiquetasPalco.has(etiqueta)) errores.push('número repetido en palco: ' + f.id);
        etiquetasPalco.add(etiqueta);
      }
    } else if (f.numeroGrupo !== undefined) errores.push('número de palco sin grupo: ' + f.id);
  }
  return limpio;
}

function validarMapa(dato) {
  const cabecera = motivoDeCabecera(dato);
  if (cabecera) return { errores: [cabecera] };
  if (dato.version < 8) {
    // Los formatos anteriores no pueden inyectar pertenencias futuras.
    const anterior = copiarDatos(dato);
    for (const t of Object.values(TIPOS_FISICOS)) { delete anterior[t.lista]; delete anterior[t.contador]; }
    delete anterior.entidadesRetiradas;
    for (const f of Object.values(anterior.identidadFisica || {})) if (f && typeof f === 'object') for (const k of ['sectorId','filaId','grupoId','numeroGrupo']) delete f[k];
    const r = validarMapaNiveles(anterior);
    if (r.errores) return r;
    Object.assign(r.mapa, estructuraFisicaDe({}));
    if (r.mapa.revisionFisica.estado === 'publicada') r.mapa.revisionFisica.huella = huellaRevision(r.mapa);
    generarPlano(definicionDeMapa(r.mapa));
    return r;
  }
  const errores = [];
  const estructura = validarEstructuraFisica(dato, errores);
  if (errores.length) return { errores };
  const entrada = { ...dato, version: 7, revisionFisica: { ...dato.revisionFisica, estado: 'borrador' } };
  // La revision completa se comprueba despues de limpiar tanto dibujo como pertenencias.
  const r = validarMapaNiveles(entrada);
  if (r.errores) return r;
  Object.assign(r.mapa, estructura, { revisionFisica: { recintoId: dato.revisionFisica.recintoId,
    numero: dato.revisionFisica.numero, estado: dato.revisionFisica.estado,
    ...(dato.revisionFisica.estado === 'publicada' ? { huella: dato.revisionFisica.huella } : {}) } });
  if (!['borrador','publicada'].includes(r.mapa.revisionFisica.estado)) return { errores: ['revisión física inválida'] };
  if (r.mapa.revisionFisica.estado === 'publicada' && r.mapa.revisionFisica.huella !== huellaRevision(r.mapa)) return { errores: ['la revisión publicada fue modificada: crea un nuevo borrador'] };
  generarPlano(definicionDeMapa(r.mapa));
  return r;
}

function validarMapaNiveles(dato) {
  const cabecera = motivoDeCabecera(dato);
  if (cabecera) return { errores: [cabecera] };
  if (dato.version < 7) {
    const resultado = validarMapaBase(dato);
    if (resultado.errores) return resultado;
    const m = resultado.mapa;
    m.niveles = [{ id: 'n1', nombre: 'Planta baja' }]; m.siguienteNivel = 2; m.siguienteRegion = 1; m.regionesLibres = [];
    for (const f of Object.values(m.identidadFisica)) f.nivel = 'n1';
    if (m.revisionFisica.estado === 'publicada') m.revisionFisica.huella = huellaRevision(m);
    generarPlano(definicionDeMapa(m));
    return resultado;
  }
  const errores = [];
  if (!Array.isArray(dato.niveles) || !dato.niveles.length || dato.niveles.length > 12) return { errores: ['se requieren de 1 a 12 niveles'] };
  if (!esEntero(dato.siguienteNivel, 2, 1e6) || !esEntero(dato.siguienteRegion, 1, 1e6)) errores.push('contadores de nivel o región inválidos');
  const idsNivel = new Set();
  const nombres = new Set();
  const idsDibujo = new Set();
  const identidad = {};
  const niveles = [];
  let principal;
  for (let i = 0; i < dato.niveles.length; i++) {
    const n = dato.niveles[i];
    if (n?.butacasNumeradas !== undefined && typeof n.butacasNumeradas !== 'boolean') errores.push('opción de butacas numeradas inválida');
    if (n?.siluetaAmplia !== undefined && typeof n.siluetaAmplia !== 'boolean') errores.push('opción de silueta amplia inválida');
    if (!n || !/^n[1-9]\d{0,5}$/.test(n.id) || idsNivel.has(n.id) || typeof n.nombre !== 'string' || !n.nombre.trim() || n.nombre.length > 40 ||
        nombres.has(n.nombre.trim().toLocaleUpperCase('es')) || (i > 0 && (!n.plano || typeof n.plano !== 'object'))) { errores.push('nivel inválido o repetido'); continue; }
    idsNivel.add(n.id); nombres.add(n.nombre.trim().toLocaleUpperCase('es'));
    const fisica = Object.fromEntries(Object.entries(dato.identidadFisica || {}).filter(([,f]) => f?.nivel === n.id));
    const local = { ...dato };
    for (const k of CAMPOS_DE_NIVEL) delete local[k];
    Object.assign(local, geometriaDeNivel(i ? n.plano : dato), { niveles: undefined, version: 6,
      identidadFisica: fisica, revisionFisica: { ...dato.revisionFisica, estado: 'borrador' } });
    const resultado = validarMapaBase(local);
    if (resultado.errores) { errores.push(...resultado.errores.map((e) => dato.niveles.length > 1 ? n.nombre + ': ' + e : e)); continue; }
    const m = resultado.mapa;
    m.regionesLibres = regionesDeMapa(local.regionesLibres, new Set(m.zonas.map((z) => z.id)), errores);
    const aforoAcumulado = motivoDeAforo(Object.keys(identidad).length + Object.keys(m.identidadFisica).length);
    if (aforoAcumulado) return { errores: [aforoAcumulado] };
    for (const p of m.bloquesFilas) {
      if (p.region && !m.regionesLibres.some((r) => r.id === p.region)) errores.push('región desconocida de ' + p.id);
      for (const [clave, a] of Object.entries(p.ajustes || {})) if (m.identidadFisica[p.id + '-' + clave]?.id !== a.id) errores.push('corrección de un ID retirado o distinto');
    }
    const dibujo = [...nodosDeBandas(m.bandas).map((p) => p.id), ...piezasDe(m).filter((p) => p.id).map((p) => p.id), ...m.regionesLibres.map((r) => r.id)];
    for (const id of dibujo) { if (idsDibujo.has(id)) errores.push('ID de dibujo repetido entre niveles: ' + id); idsDibujo.add(id); }
    for (const [k, f] of Object.entries(m.identidadFisica)) { if (identidad[k]) errores.push('clave de lugar repetida entre niveles'); identidad[k] = f; }
    const presentacion = { ...(n.butacasNumeradas ? { butacasNumeradas: true } : {}), ...(n.siluetaAmplia ? { siluetaAmplia: true } : {}) };
    if (!i) { principal = m; niveles.push({ id: n.id, nombre: n.nombre.trim(), ...presentacion }); }
    else niveles.push({ id: n.id, nombre: n.nombre.trim(), ...presentacion, plano: geometriaDeNivel(m) });
  }
  if (errores.length) return { errores };
  if (Object.keys(identidad).length !== Object.keys(dato.identidadFisica || {}).length) return { errores: ['nivel físico desconocido en el inventario'] };
  const ids = Object.values(identidad).map((f) => f.id);
  if (new Set(ids).size !== ids.length) return { errores: ['ID físico repetido entre niveles'] };
  const aforo = motivoDeAforo(ids.length);
  if (aforo) return { errores: [aforo] };
  const mapa = { ...principal, niveles, identidadFisica: identidad,
    siguienteNivel: Math.max(dato.siguienteNivel, ...niveles.map((n) => Number(n.id.slice(1)) + 1)),
    siguienteRegion: dato.siguienteRegion, revisionFisica: { ...dato.revisionFisica } };
  for (const k of ['siguiente', 'siguienteBanda', 'siguienteBloque', 'siguienteForma', 'siguienteButaca']) {
    mapa[k] = Math.max(mapa[k], ...niveles.filter((n) => n.plano).flatMap((n) => piezasDe(n.plano).map((p) => {
      const prefijo = { siguiente: 'M', siguienteBloque: 'F', siguienteForma: 'P', siguienteButaca: 'B' }[k];
      return prefijo && p.id?.startsWith(prefijo) ? Number(p.id.slice(1)) + 1 : 1;
    })));
  }
  mapa.siguienteBanda = Math.max(mapa.siguienteBanda, ...[...idsDibujo].map((id) => Number(id.match(/^banda(\d+)$/)?.[1] || 0) + 1));
  mapa.siguienteRegion = Math.max(mapa.siguienteRegion, ...[...idsDibujo].map((id) => Number(id.match(/^region(\d+)$/)?.[1] || 0) + 1));
  // Las reglas por asiento pertenecen al documento completo, no a la vista local.
  mapa.bloqueadas = [...new Set(dato.bloqueadas || [])]; mapa.zonasDeAsiento = { ...(dato.zonasDeAsiento || {}) };
  mapa.zonasFisicasConfirmadas = { ...(dato.zonasFisicasConfirmadas || {}) };
  if (mapa.revisionFisica.estado === 'publicada' && mapa.revisionFisica.huella !== huellaRevision(mapa)) return { errores: ['la revisión publicada fue modificada: crea un nuevo borrador'] };
  generarPlano(definicionDeMapa(mapa));
  return { mapa };
}

function agregarRegion(plano, nombre) {
  if ((plano.regionesLibres || []).length >= 100 || typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 40) return { motivo: 'nombre de región inválido o límite de 100 regiones' };
  const nuevo = copiarPlano(plano);
  const id = 'region' + (nuevo.siguienteRegion || 1);
  nuevo.siguienteRegion = (nuevo.siguienteRegion || 1) + 1;
  nuevo.regionesLibres.push({ id, nombre: nombre.trim(), x: 1, y: 0, ancho: 6, alto: 8, giro: 0 });
  return nuevo;
}

// Amplia solo el piso visible. Cada banda central conserva su ancho y sus IDs;
// las nuevas verticales vacias reservan el espacio lateral sin generar lugares.
function agregarLateral(plano, sala, lado) {
  if (!['izquierdo', 'derecho'].includes(lado)) return { motivo: 'lado desconocido' };
  if (plano.revisionFisica?.estado === 'publicada') return { motivo: 'crea un borrador para modificar una revisión publicada' };
  if (sala.alto > 999) return { motivo: 'la región lateral supera el alto máximo de 999 celdas' };
  if (plano.bandas.some((b) => esDivision(b) && b.verticales.length >= VERTICALES_MAXIMAS)) return { motivo: 'una franja ya tiene el máximo de bandas verticales (' + VERTICALES_MAXIMAS + ')' };
  const izquierda = lado === 'izquierdo';
  const ancho = 6;
  const margen = ancho + 1;
  const distribucion = distribucionDeSala(sala);
  const nuevaDistribucion = sala.lienzo ? { bloques: [sala.ancho + margen], pasillos: [] } : {
    bloques: izquierda ? [ancho, ...distribucion.bloques] : [...distribucion.bloques, ancho],
    pasillos: izquierda ? [1, ...distribucion.pasillos] : [...distribucion.pasillos, 1],
  };
  const motivo = motivoDistribucion(nuevaDistribucion);
  if (motivo) return { motivo };
  const nuevo = agregarRegion(plano, 'Lateral ' + lado);
  if (nuevo.motivo) return nuevo;
  nuevo.distribucion = nuevaDistribucion;
  const idBanda = () => 'banda' + nuevo.siguienteBanda++;
  for (const b of hojasDe(nuevo.bandas)) {
    if (b.ladoRotulo || !(b.tipo === 'filas' || (b.tipo === 'espacio' && b.guias))) continue;
    const colocada = bandaDe(sala, b.id);
    if (colocada.x === 1) b.ladoRotulo = 'izquierdo';
    else if (colocada.x + colocada.anchoOcupado - 1 >= sala.ancho) b.ladoRotulo = 'derecho';
  }
  nuevo.bandas = nuevo.bandas.map((b) => {
    if (b.tipo === 'escenario') return b;
    const lateral = { id: idBanda(), nombre: 'Lateral ' + lado, ancho: margen, bandas: [] };
    if (esDivision(b)) {
      const colocada = sala.bandas.find((p) => p.id === b.id);
      const centrales = b.verticales.map((v, i) => ({ ...v, ancho: colocada.verticales[i].anchoOcupado }));
      return { ...b, verticales: izquierda ? [lateral, ...centrales] : [...centrales, lateral] };
    }
    const central = { id: idBanda(), ancho: sala.ancho, bandas: [b] };
    return { id: idBanda(), tipo: 'division', verticales: izquierda ? [lateral, central] : [central, lateral] };
  });
  const dx = izquierda ? margen : 0;
  for (const { lista } of LISTAS_DE_PIEZAS) nuevo[lista] = nuevo[lista].map((p) => ({ ...p, x: p.x + dx }));
  const franja = sala.bandas.find((b) => b.tipo === 'escenario');
  const escenarioAnterior = plano.escenario === undefined ? { x: 1, y: franja?.y || 0, ancho: sala.ancho, alto: franja?.alto || 2 } : plano.escenario;
  nuevo.escenario = escenarioAnterior ? { ...escenarioAnterior, x: escenarioAnterior.x + dx } : null;
  const region = nuevo.regionesLibres.at(-1);
  nuevo.regionesLibres = nuevo.regionesLibres.map((r) => r.id === region.id ? {
    ...r, x: izquierda ? 1 : sala.ancho + 2, y: 0, ancho, alto: sala.alto,
  } : { ...r, x: r.x + dx });
  return nuevo;
}

// Region grafica: moverla transforma solo los bloques vinculados, no su zona oficial.
function cambiarRegion(plano, sala, id, valores) {
  const region = (plano.regionesLibres || []).find((r) => r.id === id);
  if (!region) return { motivo: 'región desconocida' };
  const r = { ...region, ...valores, giro: normalizarAngulo(valores.giro ?? region.giro) };
  const errores = [];
  regionesDeMapa([r], new Set(zonasDe(plano).map((z) => z.id)), errores);
  if (errores.length) return { motivo: errores[0] };
  const nuevo = copiarPlano(plano);
  nuevo.regionesLibres = nuevo.regionesLibres.map((p) => p.id === id ? r : p);
  const configs = plano.bloquesFilas.filter((p) => p.region === id).map((p) => {
    const nueva = { ...p, geometria: p.geometria || { ...geometriaInicial(), separacion: 1, separacionFilas: 1 }, giro: normalizarAngulo(p.giro + r.giro - region.giro) };
    const antes = huellaDe(p).lugares[0];
    const despues = huellaDe(nueva).lugares[0];
    const punto = rotarPunto(p.x + antes.dx - region.x, p.y + antes.dy - region.y, r.giro - region.giro);
    return { ...nueva, x: r.x + punto.x - despues.dx, y: r.y + punto.y - despues.dy };
  });
  if (!configs.length) return nuevo;
  // Las regiones no buscan un desplazamiento alternativo: respetan exactamente el gesto.
  const ocupadas = celdasOcupadas(new Set(configs.map((p) => p.id)));
  for (const p of configs) { const motivo = motivoNoCabe(sala, ocupadas, p); if (motivo) return { motivo }; ocuparPieza(ocupadas, p, p.id); }
  nuevo.bloquesFilas = nuevo.bloquesFilas.map((p) => configs.find((c) => c.id === p.id) || p);
  return nuevo;
}

function eliminarRegion(plano, id) {
  const nuevo = copiarPlano(plano);
  nuevo.regionesLibres = nuevo.regionesLibres.filter((r) => r.id !== id);
  nuevo.bloquesFilas = nuevo.bloquesFilas.map((p) => { const copia = { ...p }; if (copia.region === id) delete copia.region; return copia; });
  return nuevo;
}

function validarMapaBase(dato) {
  const cabecera = motivoDeCabecera(dato);
  if (cabecera) return { errores: [cabecera] };
  const errores = [];

  const nombre = typeof dato.nombre === 'string' ? dato.nombre.trim() : '';
  if (!nombre || nombre.length > 80) errores.push('el nombre debe tener entre 1 y 80 caracteres');
  const { distribucion, lienzo } = columnasDeMapa(dato, errores);
  const zonasLimpias = zonasDeMapa(dato, errores);
  const idsZona = new Set(zonasLimpias.map((z) => z.id));
  // Desde la version 4, una mesa, un bloque, una butaca suelta o una banda que no es de
  // filas pueden no traer zona: heredan la de la banda que las contiene. Si la traen,
  // tiene que ser una zona del mapa.
  const con = {
    errores,
    zonaDeFilas: (zona) => zona !== 'mesas' && idsZona.has(zona),
    zonaHeredable: (zona) => zona === undefined || idsZona.has(zona),
  };
  usarZonas(zonasLimpias);   // disponerBandas toma de aqui los nombres por defecto

  const { bandas, ids: idsBanda } = bandasDeMapa(dato, con);
  if (!errores.length && distribucion) {
    const { error } = disponerBandas(bandas, rejillaDeBloques(distribucion).ancho);
    if (error) errores.push(error);
  }
  const { limpias: mesasLimpias, ids: idsMesa } = mesasDeMapa(dato, con);
  const { limpias: bloquesLimpios, ids: idsBloque } = bloquesDeMapa(dato, con);
  const { limpias: formasLimpias, ids: idsForma } = formasDeMapa(dato, con);
  const { limpias: butacasLimpias, ids: idsButaca } = butacasSueltasDeMapa(dato, con);
  const escenarioLimpio = escenarioDeMapa(dato, errores);
  const antecedentesComerciales = antecedentesDeMapa(dato, errores);
  const identidadFisica = identidadDeMapa(dato, errores, idsZona);

  const bloqueadas = dato.bloqueadas === undefined ? [] : dato.bloqueadas;
  if (!Array.isArray(bloqueadas) || !bloqueadas.every((id) => typeof id === 'string' && id.length <= 60)) {
    errores.push('la lista de butacas bloqueadas no es válida');
  }
  const zonasDeAsiento = zonasDeAsientoDeMapa(dato, errores, idsZona);
  const confirmadas = zonasDeAsientoDeMapa({ zonasDeAsiento: dato.zonasFisicasConfirmadas }, errores, idsZona);
  for (const [id, zona] of Object.entries(confirmadas)) {
    if (zonasDeAsiento[id] !== zona) errores.push('asiento ' + id + ': confirmación de zona física desactualizada');
  }
  if (errores.length) return { errores };

  // Los contadores nunca por debajo de lo que ya existe: un id no se reutiliza.
  const maximo = (ids, patron) => [...ids].reduce((mayor, id) => Math.max(mayor, Number((id.match(patron) || [])[1]) || 0), 0);
  const contador = (valor, ids, patron) =>
    Math.max(esEntero(valor, 1, 1e6) ? valor : 1, maximo(ids, patron) + 1);
  const mapa = {
    formato: FORMATO_MAPA, version: VERSION_MAPA, nombre,
    guardado: typeof dato.guardado === 'string' ? dato.guardado.slice(0, 40) : null,
    ...(lienzo ? { lienzo: true } : {}),
    distribucion, bandas, mesas: mesasLimpias, bloquesFilas: bloquesLimpios,
    formas: formasLimpias, butacasSueltas: butacasLimpias,
    ...(escenarioLimpio !== undefined ? { escenario: escenarioLimpio } : {}),
    bloqueadas: [...new Set(bloqueadas)],
    zonasDeAsiento,
    zonasFisicasConfirmadas: confirmadas,
    siguiente: contador(dato.siguiente, idsMesa, /^M(\d+)$/),
    siguienteBanda: contador(dato.siguienteBanda, idsBanda, /^banda(\d+)$/),
    siguienteBloque: contador(dato.siguienteBloque, idsBloque, /^F(\d+)$/),
    siguienteForma: contador(dato.siguienteForma, idsForma, /^P(\d+)$/),
    zonas: zonasLimpias,
    antecedentesComerciales,
    siguienteZona: contador(dato.siguienteZona, idsZona, /^zona(\d+)$/),
    siguienteButaca: contador(dato.siguienteButaca, idsButaca, /^B(\d+)$/),
    ...(dato.version >= 6 ? { identidadFisica, idsRetirados: [...dato.idsRetirados], siguienteLugar: dato.siguienteLugar,
      modoNumeracion: dato.modoNumeracion, revisionFisica: { recintoId: dato.revisionFisica.recintoId, numero: dato.revisionFisica.numero, estado: dato.revisionFisica.estado,
        ...(dato.revisionFisica.estado === 'publicada' ? { huella: dato.revisionFisica.huella } : {}) } } : {}),
  };
  // Contar con las medidas limpias antes de crear miles de objetos de butaca.
  const rejilla = rejillaDeBloques(distribucion);
  const dispuesta = disponerBandas(bandas, rejilla.ancho);
  const aforoPrevio = hojasDe(dispuesta.colocadas).reduce((n, b) => n + (b.tipo === 'filas'
    ? b.filas * columnasDeBanda(rejilla, b).length : 0), 0)
    + bloquesLimpios.reduce((n, b) => n + b.ancho * b.filas, 0)
    + mesasLimpias.reduce((n, m) => n + (esMesaRedonda(m) ? m.lugares : m.largo * (m.unLado ? 1 : 2) + (m.cabeceras ? 2 : 0)), 0)
    + butacasLimpias.length;
  const exceso = motivoDeAforo(aforoPrevio);
  if (exceso) return { errores: [exceso] };
  const sala = generarPlano(definicionDeMapa(mapa));
  const aforo = motivoDeAforo(butacas.length);
  if (aforo) return { errores: [aforo] };
  const fallo = primeraPiezaQueNoCabe(sala);
  if (fallo) return { errores: [fallo.pieza.nombre + ' ' + fallo.motivo] };
  if (dato.version >= 6) {
    const claves = new Set(butacas.map((b) => b.claveDiseno));
    if (claves.size !== Object.keys(identidadFisica).length || Object.keys(identidadFisica).some((k) => !claves.has(k))) return { errores: ['el inventario físico no coincide con los lugares del dibujo'] };
    const etiquetas = new Set();
    for (const f of Object.values(identidadFisica)) if (f.numero) {
      const clave = claveEtiquetaFisica(f);
      if (etiquetas.has(clave)) return { errores: ['etiqueta oficial repetida'] };
      etiquetas.add(clave);
    }
  } else {
    const migrado = sincronizarIdentidad(mapa);
    Object.assign(mapa, { identidadFisica: migrado.identidadFisica, idsRetirados: migrado.idsRetirados,
      siguienteLugar: migrado.siguienteLugar, modoNumeracion: migrado.modoNumeracion, revisionFisica: migrado.revisionFisica });
  }
  if (mapa.revisionFisica.estado === 'publicada' && mapa.revisionFisica.huella !== huellaRevision(mapa)) return { errores: ['la revisión publicada fue modificada: crea un nuevo borrador'] };
  return { mapa };
}

// Confirma expresamente que las zonas pintadas son ubicaciones fisicas. Los mapas
// antiguos no traen esta evidencia: pudieron usar la misma accion solo para precio.
function confirmarZonasFisicas(plano) {
  return { ...copiarPlano(plano), zonasFisicasConfirmadas: { ...(plano.zonasDeAsiento || {}) } };
}

// Catalogo de un borrador apto para publicar. El evento, la revision, la tarifa y
// el precio de venta los asignara Sin Taquilla; aqui solo hay identidad local y lugar.
function exportarLugaresDeMapa(dato) {
  const validacion = validarMapa(dato);
  if (validacion.errores) return { errores: validacion.errores };
  const mapa = validacion.mapa;
  const errores = [];
  const usados = new Map();
  const zonasConLugares = new Set(butacas.map((b) => b.zona));
  const normalizar = (s) => s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleUpperCase('es');
  const nombres = new Set();
  for (const z of mapa.zonas.filter((z) => zonasConLugares.has(z.id))) {
    const nombre = normalizar(z.nombre);
    if (/^ZONA(?: \d+)?$/.test(nombre)) errores.push('la zona ' + z.id + ' necesita un nombre definitivo');
    if (nombres.has(nombre)) errores.push('nombre de zona repetido: ' + z.nombre);
    nombres.add(nombre);
  }
  for (const [id, zona] of Object.entries(mapa.zonasDeAsiento)) {
    if (mapa.zonasFisicasConfirmadas[id] !== zona) {
      errores.push('confirma la zona física de ' + id + ' (' + zonas[zona].nombre + ')');
    }
  }
  if (mapa.modoNumeracion === 'oficial') for (const f of Object.values(mapa.identidadFisica)) {
    if (!f.numero && !f.grupoId) errores.push('asigna una etiqueta oficial al lugar nuevo ' + f.id);
  }
  const zonasPorMesa = new Map();
  for (const b of butacas) if (b.grupo) {
    if (!zonasPorMesa.has(b.grupo.id)) zonasPorMesa.set(b.grupo.id, new Set());
    zonasPorMesa.get(b.grupo.id).add(b.zona);
  }
  for (const [id, lista] of zonasPorMesa) if (lista.size > 1) {
    errores.push('la mesa ' + id + ' tiene lugares en varias zonas físicas');
  }
  const lugares = [];
  for (const b of butacas) {
    const zona = zonas[b.zona];
    if (!zona || !normalizar(zona.nombre)) {
      errores.push('el lugar ' + b.id + ' no tiene zona física con nombre');
      continue;
    }
    const palco = b.grupo?.tipo === 'palco';
    const mesa = Boolean(b.grupo) && !palco;
    const clave = claveEtiquetaFisica({ nivel: b.nivel, zona: b.zona, numero: b.numero,
      sectorId: b.sectorFisico?.id, filaId: b.filaFisica?.id, ...(palco ? { grupoId: b.grupo.id, numeroGrupo: b.numero } : mesa ? { mesa: b.numeroMesa } : { fila: b.fila }) });
    if (usados.has(clave)) errores.push('etiqueta repetida: ' + usados.get(clave) + ' y ' + b.id);
    usados.set(clave, b.id);
    lugares.push({
      local_place_id: b.id,
      level: { id: b.nivel, name: b.nombreNivel },
      physical_zone: { id: b.zona, name: zona.nombre },
      sector: b.sectorFisico ? { id: b.sectorFisico.id, name: b.sectorFisico.nombre } : null,
      physical_row: b.filaFisica ? { id: b.filaFisica.id, name: b.filaFisica.nombre } : null,
      physical_group: b.grupo ? { id: b.grupo.id, type: palco ? 'box' : 'table', name: b.grupo.nombre } : null,
      group_place_number: b.grupo ? b.numero : null,
      kind: palco ? 'box_place' : mesa ? 'table_place' : 'row_seat',
      row: b.grupo ? null : b.fila,
      seat_number: b.grupo ? null : b.numero,
      table_id: mesa ? b.grupo.id : null,
      table_number: mesa ? b.numeroMesa : null,
      table_place_number: mesa ? b.numero : null,
      label: (mapa.niveles.length > 1 ? b.nombreNivel + ', ' : '') + (b.sectorFisico ? b.sectorFisico.nombre + ', ' : '') + (palco ? zona.nombre + ', ' + b.grupo.nombre + ', lugar ' + b.numero : mesa ? zona.nombre + ', mesa ' + b.numeroMesa + ', lugar ' + b.numero
        : zona.nombre + ', fila ' + b.fila + ', butaca ' + b.numero),
      x: b.x, y: b.y, orientation: b.mira, blocked: b.estado === 'bloqueada',
    });
  }
  if (errores.length) return { errores };
  return { catalogo: {
    formato: 'selector-asientos/lugares', version: 5, mapa: mapa.nombre,
    revision: { ...mapa.revisionFisica }, modoNumeracion: mapa.modoNumeracion, idsRetirados: [...mapa.idsRetirados],
    niveles: copiarDatos(mapa.niveles).map(({ id, nombre }) => ({ id, nombre })),
    sectores: copiarDatos(mapa.sectores), filas: copiarDatos(mapa.filasFisicas),
    grupos: gruposFisicosDelCatalogo(mapa, butacas), entidadesRetiradas: [...mapa.entidadesRetiradas], lugares,
  } };
}

function gruposFisicosDelCatalogo(plano, lista) {
  const grupos = new Map((plano.palcos || []).map((e) => [e.id, { ...e, tipo: 'palco', lugares: [] }]));
  for (const b of lista) if (b.grupo) {
    if (!grupos.has(b.grupo.id)) grupos.set(b.grupo.id, { id: b.grupo.id, tipo: 'mesa', nombre: b.grupo.nombre, nivel: b.nivel, zona: b.zona, lugares: [] });
    grupos.get(b.grupo.id).lugares.push(b.id);
  }
  return [...grupos.values()];
}
