// Cambia los bloques y pasillos de toda la sala y recoloca las mesas:
// - Con el mismo numero de bloques, cada mesa se queda en su bloque y a la misma
//   distancia de su inicio.
// - Si cambia el numero de bloques, conserva su posicion relativa en el ancho de
//   la sala y se ajusta al bloque mas cercano. Asi, al quitar o poner pasillos,
//   las mesas ni se amontonan ni se quedan todas en el primer bloque.
// En ambos casos no se sale de su bloque si cabe. Si aun asi no cabe, lo detecta
// primeraPiezaQueNoCabe al aplicar.
function cambiarDistribucion(plano, sala, distribucion) {
  const nueva = rejillaDeBloques(distribucion);
  const nuevo = copiarPlano(plano);
  nuevo.distribucion = { bloques: [...distribucion.bloques], pasillos: [...distribucion.pasillos] };
  // Un escenario a todo el ancho sigue a todo el ancho.
  if (nuevo.escenario && nuevo.escenario.x === 1 && nuevo.escenario.ancho === sala.ancho) {
    nuevo.escenario.ancho = nueva.ancho;
  }
  const dentro = (bloque, x, ancho) => bloque[0] + Math.max(0, Math.min(x - bloque[0], bloque.length - ancho));
  for (const m of nuevo.mesas) {
    const i = sala.bloques.findIndex((b) => b.includes(m.x));
    if (i < 0) continue;
    const ancho = huellaDe(m).ancho;
    if (nueva.bloques.length === sala.bloques.length) {
      const destino = nueva.bloques[i];
      m.x = dentro(destino, destino[0] + (m.x - sala.bloques[i][0]), ancho);
      continue;
    }
    const objetivo = Math.round(((m.x - 1) / sala.ancho) * nueva.ancho) + 1;
    const distancia = (b) => (objetivo < b[0] ? b[0] - objetivo : objetivo > b.at(-1) ? objetivo - b.at(-1) : 0);
    const cercano = nueva.bloques.reduce((mejor, b) => (distancia(b) < distancia(mejor) ? b : mejor));
    m.x = dentro(cercano, objetivo, ancho);
  }
  return nuevo;
}

// Cambia la zona de una banda. Sin zona ('' o null) se la quita: un espacio o una
// franja sin zona no da precio a nada y lo de dentro hereda de mas afuera.
function cambiarZonaBanda(plano, id, zona) {
  const nuevo = copiarPlano(plano);
  const u = ubicar(nuevo.bandas, id);
  if (!u) return { motivo: 'esa banda ya no existe' };
  if (zona && !zonasDe(nuevo).some((z) => z.id === zona)) return { motivo: 'esa zona ya no existe' };
  if (u.item.tipo === 'filas' && !zona) return { motivo: 'una banda de filas necesita una zona' };
  if (zona) u.item.zona = zona;   // un nombre puesto a mano se queda; el de por defecto sigue a la zona
  else delete u.item.zona;
  return nuevo;
}

// Crear una zona explicitamente no cambia el nombre propio de la banda.
// El hueco de una zona nueva: el primer id «zonaN» libre y un nombre que no choque,
// numerado a partir del que se pida («General 2»). No toca el plano, lo devuelve, y es
// el unico sitio donde se decide como se llama y que id lleva una zona recien nacida.
function zonaNueva(lista, siguiente, nombreBase) {
  const base = String(nombreBase || '').trim().slice(0, NOMBRE_MAXIMO) || 'Zona';
  let nombre = base;
  for (let n = 2; lista.some((z) => z.nombre.toLowerCase() === nombre.toLowerCase()); n++) nombre = base + ' ' + n;
  let k = siguiente || 1;
  while (lista.some((z) => z.id === 'zona' + k)) k++;
  return { zona: { id: 'zona' + k, nombre }, siguiente: k + 1 };
}

function zonaNuevaParaBanda(plano, id, nombre) {
  if (!ubicar(plano.bandas, id)) return { motivo: 'esa banda ya no existe' };
  const nuevo = agregarZona(plano, nombre);
  if (nuevo.motivo) return nuevo;
  ubicar(nuevo.bandas, id).item.zona = nuevo.zonas.at(-1).id;
  return nuevo;
}

// Las mesas que caen dentro de una banda, franja o vertical (tambien las de sus bandas
// interiores: su region esta dentro). Es lo que permite vender de golpe toda una zona de
// mesas por mesa o por lugares.
function mesasDeBanda(sala, id, lista = mesas) {
  const region = sala.regiones.find((r) => r.id === id && r.tipo !== 'resto');
  if (!region) return [];
  return lista.filter((m) => m.x >= region.x && m.x < region.x + region.ancho &&
                             m.y >= region.y && m.y < region.y + region.alto).map((m) => m.id);
}

// El unico sitio donde se escribe 'completa'. Las cuatro formas de marcar la venta
// (una mesa, varias, las de una banda o todas) solo cambian en que mesas eligen, asi
// que lo unico que las separa es el filtro que reciben.
function marcarVenta(plano, completa, quiere) {
  const nuevo = copiarPlano(plano);
  for (const mesa of nuevo.mesas || []) {
    if (!quiere(mesa)) continue;
    if (completa) mesa.completa = true;
    else delete mesa.completa;
  }
  return nuevo;
}

// Pone o quita la venta por mesa en todas las mesas de una banda.
function marcarMesasDeBanda(plano, sala, id, completa) {
  const dentro = new Set(mesasDeBanda(sala, id, plano.mesas || []));
  if (!dentro.size) return { motivo: 'esa banda no tiene mesas' };
  return marcarVenta(plano, completa, (m) => dentro.has(m.id));
}

// ---------------------------------------------------------------------------
// Nombres, duplicar y capas.
//
// Cada banda, vertical y franja puede llevar un nombre propio: se dibuja como
// subtitulo en el plano, pero la etiqueta de las butacas sigue siendo la de su
// zona («Luneta, fila C»). Duplicar crea ids nuevos para todo lo copiado; nunca
// copia la ocupacion, si las bloqueadas (son parte del diseño).
// ---------------------------------------------------------------------------
const NOMBRE_MAXIMO = 40;
const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);
const SUFIJO_COPIA = ' (copia)';
const nombreDeCopia = (nombre) => nombre.slice(0, NOMBRE_MAXIMO - SUFIJO_COPIA.length) + SUFIJO_COPIA;

// Pone o quita (con texto vacio) el nombre propio de una banda, vertical o franja.
function renombrarBanda(plano, id, nombre) {
  const nuevo = copiarPlano(plano);
  const u = ubicar(nuevo.bandas, id);
  if (!u) return { motivo: 'esa banda ya no existe' };
  if (u.item.tipo === 'escenario') return { motivo: 'la franja del escenario no lleva nombre' };
  const limpio = String(nombre).trim().slice(0, NOMBRE_MAXIMO);
  if (limpio) u.item.nombre = limpio;
  else delete u.item.nombre;
  return nuevo;
}

// Copia las butacas bloqueadas de unas piezas o bandas a sus copias. 'ids' es un
// Map de id original -> id de la copia; el id de una butaca empieza por el suyo.
function copiarBloqueadas(bloqueadas = [], ids) {
  const copias = [];
  for (const id of bloqueadas) {
    // Una butaca suelta no lleva guion: su id es el de la pieza.
    const guion = id.indexOf('-');
    const corte = guion > 0 ? guion : id.length;
    const nuevo = ids.get(id.slice(0, corte));
    if (nuevo) copias.push(nuevo + id.slice(corte));
  }
  return [...bloqueadas, ...copias];
}

// Lo mismo para las zonas asignadas a asientos: la copia lleva la zona del original.
function copiarZonasDeAsiento(zonasDeAsiento = {}, ids) {
  const copia = { ...zonasDeAsiento };
  for (const [id, zona] of Object.entries(zonasDeAsiento)) {
    const [nuevo] = copiarBloqueadas([id], ids).slice(1);
    if (nuevo) copia[nuevo] = zona;
  }
  return copia;
}

function copiarIdentidadesDePiezas(plano, ids) {
  if (!plano.identidadFisica) return plano;
  const copia = copiarPlano(plano);
  const usados = new Set([...Object.values(copia.identidadFisica).map((f) => f.id), ...copia.idsRetirados]);
  for (const [clave, f] of Object.entries(plano.identidadFisica)) {
    const [nueva] = copiarBloqueadas([clave], ids).slice(1);
    if (!nueva) continue;
    let id = nueva;
    if (usados.has(id)) do { id = 'L' + copia.siguienteLugar++; } while (usados.has(id));
    usados.add(id);
    copia.identidadFisica[nueva] = { id, zona: f.zona, nivel: f.nivel || 'n1', ...(f.sectorId ? { sectorId: f.sectorId } : {}) };
    if (plano.bloqueadas?.includes(f.id) && !copia.bloqueadas.includes(id)) copia.bloqueadas.push(id);
    if (plano.zonasDeAsiento?.[f.id]) copia.zonasDeAsiento[id] = plano.zonasDeAsiento[f.id];
    if (plano.zonasFisicasConfirmadas?.[f.id]) copia.zonasFisicasConfirmadas[id] = plano.zonasFisicasConfirmadas[f.id];
  }
  for (const p of copia.bloquesFilas) if ([...ids.values()].includes(p.id) && p.ajustes) {
    p.ajustes = Object.fromEntries(Object.entries(p.ajustes).map(([clave, a]) => [clave, { ...a, id: copia.identidadFisica[p.id + '-' + clave]?.id }]));
  }
  return copia;
}

// Asigna una zona a un asiento. Si es su zona de siempre ('original'), se quita la
// asignacion. Devuelve el plano nuevo.
function asignarZonaAsiento(plano, id, zona, original) {
  const nuevo = copiarPlano(plano);
  nuevo.zonasDeAsiento = { ...(nuevo.zonasDeAsiento || {}) };
  if (zona === original) delete nuevo.zonasDeAsiento[id];
  else nuevo.zonasDeAsiento[id] = zona;
  const fisica = Object.values(nuevo.identidadFisica || {}).find((f) => f.id === id);
  if (fisica) fijarZonaInventario(nuevo, fisica, zona);
  return nuevo;
}

// La copia de una mesa, bloque, forma o butaca suelta, con id nuevo, junto a la
// original: a su derecha, si no debajo, y si no en el sitio libre mas cercano. Usa
// las celdas de la sala generada desde 'plano'. Devuelve el plano nuevo (el id de
// la copia es el del contador de su lista antes de llamar) o { motivo }.
function duplicarPieza(plano, sala, id) {
  if (id === 'escenario') return { motivo: 'el escenario no se puede duplicar' };
  const tipoDeLista = listaDeId(id);
  const nuevo = copiarPlano(plano);
  const lista = tipoDeLista && nuevo[tipoDeLista.lista];
  const original = lista && lista.find((p) => p.id === id);
  if (!original) return { motivo: 'esa pieza ya no existe' };
  const copia = { ...original, id: nuevoIdDe(nuevo, tipoDeLista) };
  if (copia.nombre) copia.nombre = nombreDeCopia(copia.nombre);
  const sitio = sitioParaCopia(sala, celdasOcupadas(null), copia);
  if (!sitio) return { motivo: 'no hay sitio libre para la copia' };
  lista.push(sitio);
  nuevo.bloqueadas = copiarBloqueadas(nuevo.bloqueadas, new Map([[id, copia.id]]));
  nuevo.zonasDeAsiento = copiarZonasDeAsiento(nuevo.zonasDeAsiento, new Map([[id, copia.id]]));
  return copiarIdentidadesDePiezas(nuevo, new Map([[id, copia.id]]));
}

// ---------------------------------------------------------------------------
// Varias piezas a la vez.
//
// El editor puede tener seleccionadas varias piezas (mesas, bloques, formas y
// butacas sueltas; el escenario no entra: es unico y no se duplica ni se elimina).
// Mover, duplicar y eliminar trabajan con la lista entera, y mover es **todo o
// nada**: si una sola no cabe, no se mueve ninguna y se dice cual.
// ---------------------------------------------------------------------------
// Las piezas que atrapa un marco de seleccion: entra la que tiene la mitad o mas de
// su huella dentro. Asi no hace falta rodear una mesa entera para llevarsela.
function piezasEnMarco(piezas, marco) {
  return piezas.filter((p) => {
    const { ancho, alto } = huellaDe(p);
    const dentroX = Math.min(marco.x2 + 1, p.x + ancho) - Math.max(marco.x1, p.x);
    const dentroY = Math.min(marco.y2 + 1, p.y + alto) - Math.max(marco.y1, p.y);
    if (dentroX <= 0 || dentroY <= 0) return false;
    return dentroX * dentroY * 2 >= ancho * alto;
  }).map((p) => p.id);
}

// La caja que ocupan varias piezas, en celdas.
function cajaDePiezas(piezas) {
  const cajas = piezas.map((p) => ({ p, geo: huellaDe(p) }));
  const x = Math.min(...cajas.map((c) => c.p.x));
  const y = Math.min(...cajas.map((c) => c.p.y));
  return { x, y,
    ancho: Math.max(...cajas.map((c) => c.p.x + c.geo.ancho)) - x,
    alto: Math.max(...cajas.map((c) => c.p.y + c.geo.alto)) - y };
}

// El nombre de una pieza a partir de su configuracion: el mismo que le pone la sala al
// generarse, para que los avisos digan «Mesa 3» y no «M3».
const nombreDeConfig = (c) => c.nombre || (esBloqueFilas(c) ? 'Bloque ' + c.id.slice(1)
  : esForma(c) ? FORMAS[c.forma].nombre + ' ' + c.id.slice(1)
  : esButacaSuelta(c) ? 'Butaca suelta ' + c.id.slice(1) : 'Mesa ' + c.id.slice(1));

// La configuracion guardada de una pieza dentro de un plano, por id.
const configEnPlano = (plano, id) => {
  const tipoDeLista = listaDeId(id);
  const lista = tipoDeLista && plano[tipoDeLista.lista];
  return (lista && lista.find((p) => p.id === id)) || null;
};

function moverPiezas(plano, sala, ids, dx, dy) {
  if (ids.some((id) => id === 'escenario')) return { motivo: 'el escenario se mueve por su cuenta' };
  const nuevo = copiarPlano(plano);
  const ocupadas = celdasOcupadas(new Set(ids));
  const destinos = [];
  for (const id of ids) {
    const config = configEnPlano(nuevo, id);
    if (!config) return { motivo: 'esa pieza ya no existe' };
    const destino = { ...config, x: config.x + dx, y: config.y + dy };
    const motivo = motivoNoCabe(sala, ocupadas, destino);
    if (motivo) return { motivo: nombreDeConfig(config) + ' ' + motivo };
    destinos.push({ config, destino });
  }
  for (const { config, destino } of destinos) Object.assign(config, { x: destino.x, y: destino.y });
  return nuevo;
}

// Duplica varias piezas conservando las distancias entre ellas: el grupo entero se
// copia a la derecha de su caja y, si ahi no cabe entero, debajo.
function duplicarPiezas(plano, sala, ids) {
  if (ids.some((id) => id === 'escenario')) return { motivo: 'el escenario no se puede duplicar' };
  const piezas = ids.map((id) => configEnPlano(plano, id)).filter(Boolean);
  if (piezas.length !== ids.length) return { motivo: 'esa pieza ya no existe' };
  const caja = cajaDePiezas(piezas);
  const ocupadas = celdasOcupadas(null);
  const desplazamiento = [[caja.ancho, 0], [0, caja.alto]].find(([dx, dy]) =>
    piezas.every((p) => !motivoNoCabe(sala, ocupadas, { ...p, x: p.x + dx, y: p.y + dy })));
  if (!desplazamiento) return { motivo: 'no hay sitio libre para las copias' };
  const [dx, dy] = desplazamiento;
  const nuevo = copiarPlano(plano);
  const copias = new Map();
  for (const id of ids) {
    const tipoDeLista = listaDeId(id);
    const original = configEnPlano(nuevo, id);
    const copia = { ...original, id: nuevoIdDe(nuevo, tipoDeLista), x: original.x + dx, y: original.y + dy };
    if (copia.nombre) copia.nombre = nombreDeCopia(copia.nombre);
    nuevo[tipoDeLista.lista].push(copia);
    copias.set(id, copia.id);
  }
  nuevo.bloqueadas = copiarBloqueadas(nuevo.bloqueadas, copias);
  nuevo.zonasDeAsiento = copiarZonasDeAsiento(nuevo.zonasDeAsiento, copias);
  return { plano: copiarIdentidadesDePiezas(nuevo, copias), ids: [...copias.values()] };
}

// Los desplazamientos que se prueban para que un grupo transformado quepa, de menos a
// mas: primero sin moverlo, luego una celda, luego dos.
const DESPLAZAMIENTOS_DE_GRUPO = (() => {
  const lista = [];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) lista.push({ dx, dy });
  return lista.sort((a, b) => Math.abs(a.dx) + Math.abs(a.dy) - (Math.abs(b.dx) + Math.abs(b.dy)));
})();

// Escribe configuraciones nuevas de varias piezas a la vez: todas o ninguna. Si el grupo
// transformado no cabe donde esta, se prueba desplazarlo **entero** unas celdas, igual que
// colocarCerca con una sola pieza, para que las distancias entre ellas no cambien.
// Devuelve { plano, dx, dy } o { motivo } (el de quedarse en su sitio, que es el util).
function aplicarConfigs(plano, sala, configs) {
  const ocupadas = celdasOcupadas(new Set(configs.map((c) => c.id)));
  const primerMotivo = (dx, dy) => {
    const destinoOcupado = new Map();
    for (const c of configs) {
      const destino = { ...c, x: c.x + dx, y: c.y + dy };
      const motivo = motivoNoCabe(sala, ocupadas, destino) || motivoNoCabe(sala, destinoOcupado, destino);
      if (motivo) return nombreDeConfig(c) + ' ' + motivo;
      ocuparPieza(destinoOcupado, destino, nombreDeConfig(c));
    }
    return null;
  };
  let motivo = null;
  for (const { dx, dy } of DESPLAZAMIENTOS_DE_GRUPO) {
    const fallo = primerMotivo(dx, dy);
    if (fallo) {
      if (!dx && !dy) motivo = fallo;
      continue;
    }
    const nuevo = copiarPlano(plano);
    for (const c of configs) {
      const lista = listaDeId(c.id).lista;
      nuevo[lista] = nuevo[lista].map((p) => (p.id === c.id ? { ...c, x: c.x + dx, y: c.y + dy } : p));
    }
    return { plano: nuevo, dx, dy };
  }
  return { motivo };
}

// Un palco organiza lugares, pero su geometria sigue siendo la del bloque o butaca.
const piezaDeButaca = (b) => b.grupo?.tipo === 'palco' ? b.bloque || b.suelta : b.grupo?.id || b.bloque || b.suelta;
// La zona propia de varias piezas: sin zona ('' o null) vuelven a heredar la de su banda.
function cambiarZonaDePiezas(plano, ids, zona) {
  const nuevo = copiarPlano(plano);
  for (const id of ids) {
    const config = configEnPlano(nuevo, id);
    if (!config || esForma(config)) continue;   // una forma no tiene butacas ni zona
    if (zona) config.zona = zona;
    else delete config.zona;
  }
  const elegidas = new Set(ids);
  const disposicion = disponerBandas(nuevo.bandas, rejillaDeBloques(nuevo.distribucion).ancho);
  const destinos = new Map(ids.map((id) => {
    const p = configEnPlano(nuevo, id);
    return [id, zona || (p && zonaEnCelda(disposicion, p.x, p.y)) || zonaParaFilas(zonasDe(nuevo))];
  }));
  for (const b of butacas) if (elegidas.has(piezaDeButaca(b))) {
    const f = nuevo.identidadFisica?.[b.claveDiseno || b.id];
    if (f) fijarZonaInventario(nuevo, f, destinos.get(piezaDeButaca(b)));
  }
  return nuevo;
}

// Venta por mesa o por butacas en varias mesas a la vez.
const marcarVentaDeMesas = (plano, ids, completa) =>
  marcarVenta(plano, completa, (m) => ids.includes(m.id));

// Quita varias piezas del plano. El escenario no se elimina: se quita con su boton.
function eliminarPiezas(plano, ids) {
  const nuevo = copiarPlano(plano);
  for (const id of ids) {
    const tipoDeLista = listaDeId(id);
    if (!tipoDeLista) continue;
    nuevo[tipoDeLista.lista] = (nuevo[tipoDeLista.lista] || []).filter((p) => p.id !== id);
  }
  return nuevo;
}

function sitioParaCopia(sala, ocupadas, pieza) {
  const { ancho, alto } = huellaDe(pieza);
  const cabe = (x, y) => !motivoNoCabe(sala, ocupadas, { ...pieza, x, y });
  if (cabe(pieza.x + ancho, pieza.y)) return { ...pieza, x: pieza.x + ancho };
  if (cabe(pieza.x, pieza.y + alto)) return { ...pieza, y: pieza.y + alto };
  let mejor = null;
  for (let y = sala.filas.min; y <= sala.filas.max; y++) {
    for (let x = 1; x <= sala.ancho; x++) {
      const d = Math.abs(x - pieza.x) + Math.abs(y - pieza.y);
      if ((!mejor || d < mejor.d) && cabe(x, y)) mejor = { x, y, d };
    }
  }
  return mejor && { ...pieza, x: mejor.x, y: mejor.y };
}

// Duplica una banda, una vertical o una franja entera, con todo lo que tiene
// dentro (bandas, verticales, mesas y bloques) y ids nuevos. La copia va justo
// despues de la original: debajo, o a su derecha si es una vertical. El id de la
// copia es 'banda' + el contador de antes. Devuelve el plano nuevo o { motivo }.
function duplicarBanda(plano, sala, id) {
  const nuevo = copiarPlano(plano);
  const u = ubicar(nuevo.bandas, id);
  if (!u) return { motivo: 'esa banda ya no existe' };
  if (u.item.tipo === 'escenario') return { motivo: 'la franja del escenario no se puede duplicar' };
  const ids = new Map();
  const nuevoId = (viejo) => {
    const n = 'banda' + nuevo.siguienteBanda++;
    ids.set(viejo, n);
    return n;
  };
  // Sin ocupacion de ejemplo ni mesas automaticas: solo el diseño.
  const copiar = ({ ocupadas, bloqueadasAlFinal, filasDeMesas, ...b }) => ({
    ...b, id: nuevoId(b.id),
    ...(b.verticales ? { verticales: b.verticales.map(copiar) } : {}),
    ...(b.bandas ? { bandas: b.bandas.map(copiar) } : {}),
  });
  const copia = copiar(u.item);
  if (copia.nombre) copia.nombre = nombreDeCopia(copia.nombre);

  if (u.esVertical) {
    if (u.lista.length >= VERTICALES_MAXIMAS) {
      return { motivo: 'ya tiene el máximo de bandas verticales (' + VERTICALES_MAXIMAS + ')' };
    }
    // Los anchos se fijan desde lo que ocupan ahora. La copia mide lo mismo que la
    // original si la ultima vertical puede cederle ese ancho; si no (o si la
    // original es la ultima), la original se parte por la mitad entre las dos.
    const colocadas = bandaDe(sala, u.padre.id).verticales;
    u.lista.forEach((v, i) => { v.ancho = colocadas[i].anchoOcupado; });
    const ancho = colocadas[u.indice].anchoOcupado;
    const esUltima = u.indice === u.lista.length - 1;
    if (!esUltima && u.lista.at(-1).ancho - ancho >= 1) {
      copia.ancho = ancho;
    } else {
      if (ancho < 2) return { motivo: 'no queda ancho para la copia: ' + colocadas[u.indice].nombre + ' mide 1 columna' };
      u.item.ancho = Math.floor(ancho / 2);
      copia.ancho = ancho - u.item.ancho;
    }
    u.lista.splice(u.indice + 1, 0, copia);
    delete u.lista.at(-1).ancho;   // la ultima ocupa el resto
  } else {
    u.lista.splice(u.indice + 1, 0, copia);
  }

  const resultado = reanclarPiezas(plano, nuevo, sala.ancho, sala.ancho);
  // Las piezas que empezaban dentro de la original se copian a la misma distancia
  // de la copia.
  const antes = disponerBandas(plano.bandas, sala.ancho).regiones.find((r) => r.id === id);
  const destino = disponerBandas(resultado.bandas, sala.ancho).regiones.find((r) => r.id === copia.id);
  const dentro = (p) => p.x >= antes.x && p.x < antes.x + antes.ancho && p.y >= antes.y && p.y < antes.y + antes.alto;
  const trasladar = (p, nuevoIdPieza) => {
    ids.set(p.id, nuevoIdPieza);
    return { ...p, id: nuevoIdPieza, x: destino.x + (p.x - antes.x), y: destino.y + (p.y - antes.y),
             ...(p.nombre ? { nombre: nombreDeCopia(p.nombre) } : {}) };
  };
  for (const tipoDeLista of LISTAS_DE_PIEZAS) {
    for (const p of (plano[tipoDeLista.lista] || []).filter(dentro)) {
      resultado[tipoDeLista.lista].push(trasladar(p, nuevoIdDe(resultado, tipoDeLista)));
    }
  }
  resultado.bloqueadas = copiarBloqueadas(resultado.bloqueadas, ids);
  resultado.zonasDeAsiento = copiarZonasDeAsiento(resultado.zonasDeAsiento, ids);
  return copiarIdentidadesDePiezas(resultado, ids);
}

// ---------------------------------------------------------------------------
// Zonas editables. Devuelven un plano nuevo o { motivo }.
// ---------------------------------------------------------------------------
// Cuantas veces usan una zona las bandas y las piezas con zona propia. Una pieza que
// hereda no cuenta: su zona ya la sujeta la banda.
function usosDeZona(plano, id) {
  const locales = [plano, ...nivelesDe(plano).filter((n) => n.plano).map((n) => n.plano)];
  const bandas = locales.flatMap((p) => nodosDeBandas(p.bandas)).filter((b) => zonaDeBanda(b) === id).length;
  const piezas = [...(plano.mesas || []), ...(plano.bloquesFilas || []), ...(plano.butacasSueltas || [])]
    .filter((p) => p.zona === id).length;
  const asientos = Object.values(plano.zonasDeAsiento || {}).filter((z) => z === id).length;
  const fisicos = Object.values(plano.identidadFisica || {}).filter((f) => f.zona === id).length;
  const otrasPiezas = locales.slice(1).flatMap((p) => piezasDe(p)).filter((p) => p.zona === id).length;
  const regiones = locales.flatMap((p) => p.regionesLibres || []).filter((r) => r.zona === id).length;
  const entidades = Object.values(TIPOS_FISICOS).flatMap((t) => plano[t.lista] || []).filter((e) => e.zona === id).length;
  return entidades + bandas + piezas + otrasPiezas + regiones + asientos + (fisicos && !bandas && !piezas && !asientos ? 1 : 0);
}

// Agrega una zona fisica con nombre unico, por defecto «Zona», al final de la lista.
// No la ata a ninguna banda: para eso esta zonaNuevaParaBanda, que delega aqui.
function agregarZona(plano, nombre = 'Zona') {
  const nuevo = copiarPlano(plano);
  const lista = copiarZonas(zonasDe(nuevo));
  if (lista.length >= ZONAS_MAXIMAS) return { motivo: 'ya hay el máximo de zonas (' + ZONAS_MAXIMAS + ')' };
  const { zona, siguiente } = zonaNueva(lista, nuevo.siguienteZona, nombre);
  lista.push(zona);
  nuevo.zonas = lista;
  nuevo.siguienteZona = siguiente;
  return nuevo;
}

// Cambia el nombre fisico; rechaza tarifas para evitar reintroducirlas en el mapa.
function editarZona(plano, id, { nombre, precio }) {
  if (precio !== undefined) return { motivo: 'las tarifas se configuran por evento en Sin Taquilla' };
  const nuevo = copiarPlano(plano);
  const lista = copiarZonas(zonasDe(nuevo));
  const zona = lista.find((z) => z.id === id);
  if (!zona) return { motivo: 'esa zona ya no existe' };
  if (nombre !== undefined) {
    const limpio = String(nombre).trim();
    if (!limpio || limpio.length > NOMBRE_MAXIMO) return { motivo: 'el nombre de la zona debe tener entre 1 y ' + NOMBRE_MAXIMO + ' caracteres' };
    if (lista.some((z) => z.id !== id && z.nombre.toLowerCase() === limpio.toLowerCase())) {
      return { motivo: 'ya hay una zona llamada «' + limpio + '»' };
    }
    zona.nombre = limpio;
  }
  nuevo.zonas = lista;
  return nuevo;
}

// Elimina una zona que nadie usa. La de mesas y la ultima zona de filas se quedan.
function eliminarZona(plano, id) {
  const lista = zonasDe(plano);
  const zona = lista.find((z) => z.id === id);
  if (!zona) return { motivo: 'esa zona ya no existe' };
  if (id === 'mesas') return { motivo: 'la zona de mesas no se puede eliminar' };
  if (!lista.some((z) => z.id !== id && z.id !== 'mesas')) return { motivo: 'debe quedar al menos una zona para filas' };
  const usos = usosDeZona(plano, id);
  if (usos) return { motivo: zona.nombre + ' está en uso (' + plural(usos, 'banda o pieza', 'bandas o piezas') + '); cámbialas de zona antes' };
  const nuevo = copiarPlano(plano);
  nuevo.zonas = copiarZonas(lista.filter((z) => z.id !== id));
  return nuevo;
}

// Una pieza con butacas fuera de toda banda con zona no tiene de quien heredar,
// asi que se le escribe la propia: el editor no guarda una pieza sin zona.
// Devuelve { plano, fijadas } con los ids a los que hubo que ponersela (el plano es el
// mismo objeto si no hizo falta ninguna).
const LISTAS_CON_BUTACAS = ['mesas', 'bloquesFilas', 'butacasSueltas'];
function fijarZonasSueltas(plano, sala) {
  const fijadas = [];
  for (const lista of LISTAS_CON_BUTACAS) {
    for (const pieza of plano[lista] || []) {
      if (zonas[pieza.zona] || zonaEnCelda(sala, pieza.x, pieza.y)) continue;
      fijadas.push(pieza.id);
    }
  }
  if (!fijadas.length) return { plano, fijadas };
  const zona = zonaParaFilas(zonasDe(plano));
  const nuevo = copiarPlano(plano);
  for (const lista of LISTAS_CON_BUTACAS) {
    for (const pieza of nuevo[lista] || []) if (fijadas.includes(pieza.id)) pieza.zona = zona;
  }
  return { plano: nuevo, fijadas, zona };
}

// ---------------------------------------------------------------------------
// Mesas completas.
//
// Compatibilidad de mapas autonomos: conservan 'completa' y la seleccion conjunta
// historica. En eventos conectados, Sin Taquilla decide modalidad y tarifas;
// alternarLugarEvento exige el conjunto utilizable completo, sin recortarlo.
// ---------------------------------------------------------------------------
// Marca o desmarca una mesa como completa. Devuelve el plano nuevo o { motivo }.
function marcarMesaCompleta(plano, id, completa) {
  if (!(plano.mesas || []).some((m) => m.id === id)) return { motivo: 'esa mesa ya no existe' };
  return marcarVenta(plano, completa, (m) => m.id === id);
}

// Lo mismo para todas las mesas del plano.
const marcarTodasLasMesas = (plano, completa) => marcarVenta(plano, completa, () => true);

// Los lugares de una mesa, en orden.
function agruparLugaresPorGrupo(lista) {
  const grupos = new Map();
  for (const b of lista) if (b.grupo) {
    if (!grupos.has(b.grupo.id)) grupos.set(b.grupo.id, []);
    grupos.get(b.grupo.id).push(b);
  }
  return grupos;
}
const lugaresDeMesa = (id, lista, grupos = null) => grupos ? grupos.get(id) || [] : lista.filter((b) => b.grupo && b.grupo.id === id);

// Elige o suelta una butaca. En una mesa completa, elige o suelta todos sus lugares
// libres a la vez. Devuelve si quedo elegida (o null si no se puede elegir).
function alternarEleccion(ids, butaca, lista, grupos = null) {
  if (!butaca || butaca.estado !== 'libre') return null;
  if (!butaca.grupo || !butaca.grupo.completa) {
    if (ids.delete(butaca.id)) return false;
    ids.add(butaca.id);
    return true;
  }
  const libres = lugaresDeMesa(butaca.grupo.id, lista, grupos).filter((b) => b.estado === 'libre');
  const elegida = libres.some((b) => ids.has(b.id));
  for (const b of libres) {
    if (elegida) ids.delete(b.id);
    else ids.add(b.id);
  }
  return !elegida;
}

// Tras regenerar, una mesa completa con solo parte de sus lugares elegidos (porque se
// marco completa despues, o se agrego un lugar) pasa a tenerlos todos. Devuelve los
// nombres de las mesas que se completaron, para avisar.
function completarMesasElegidas(ids, lista) {
  const completadas = [];
  const grupos = agruparLugaresPorGrupo(lista);
  const mesasCompletas = new Map();
  for (const b of lista) {
    if (b.grupo && b.grupo.completa) mesasCompletas.set(b.grupo.id, b.grupo.nombre);
  }
  for (const [id, nombre] of mesasCompletas) {
    const libres = lugaresDeMesa(id, lista, grupos).filter((b) => b.estado === 'libre');
    const elegidos = libres.filter((b) => ids.has(b.id)).length;
    if (elegidos && elegidos < libres.length) {
      for (const b of libres) ids.add(b.id);
      completadas.push(nombre);
    }
  }
  return completadas;
}

// Las capas de la sala: franjas, verticales y bandas (sin el escenario), en orden
// de arbol. Cada capa tiene su color de seleccion por su posicion en esta lista.
function capasDe(bandas) {
  const ids = [];
  for (const b of bandas) {
    if (b.tipo === 'escenario') continue;
    ids.push(b.id);
    for (const v of b.verticales || []) {
      ids.push(v.id);
      ids.push(...capasDe(v.bandas));
    }
  }
  return ids;
}

// Que banda se selecciona con un clic en la celda (x, y): la mas concreta que la
// contiene. Si esa ya estaba seleccionada (o una de dentro), la que la contiene;
// despues de la de fuera, ninguna. Asi, clic a clic, se sube por el arbol.
function bandaEnCelda(sala, x, y, actual = null) {
  const cadena = sala.regiones
    .filter((r) => r.tipo !== 'resto' && r.id !== 'escenario' &&
                   x >= r.x && x < r.x + r.ancho && y >= r.y && y < r.y + r.alto)
    .sort((a, b) => b.profundidad - a.profundidad)
    .map((r) => r.id);
  const i = cadena.indexOf(actual);
  return i < 0 ? cadena[0] || null : cadena[i + 1] || null;
}

// ---------------------------------------------------------------------------
// Seleccion. Es estado de datos, no del DOM: un conjunto de identificadores.
// Asi sobrevive a redibujar sin leer clases de nodos que van a desaparecer.
// ---------------------------------------------------------------------------
const elegidas = new Set();

// La identidad es banda + fila + numero y es estable entre salas mixtas: solo
// cambia la columna. Lo unico que no sobrevive es una butaca que la nueva sala
// ya no tiene (el pasillo se llevo su lugar, o se quito la banda o la mesa), o
// una que sigue existiendo pero ahi no esta libre. Ambas se devuelven para
// avisar, nunca en silencio.
function conciliarSeleccion(ids, lista) {
  const indice = new Map(lista.map((b) => [b.id, b]));
  const ausentes = [], noLibres = [];
  for (const id of ids) {
    const b = indice.get(id);
    if (!b) ausentes.push(id);
    else if (b.estado !== 'libre') noLibres.push(id);
  }
  for (const id of [...ausentes, ...noLibres]) ids.delete(id);
  return { ausentes, noLibres };
}
