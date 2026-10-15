// Exploración visual: nunca modifica pertenencias, selección ni datos del evento.
function resumenDeZona(lista, evento = null) {
  const resumen = { inventariados: lista.length, utilizables: lista.filter((b) => b.estado !== 'bloqueada').length,
    habilitados: null, comprables: null, desconocidos: null, preciosIndividuales: [], conjuntos: [] };
  if (!evento) return resumen;
  const lugares = lista.map((b) => evento.lugares.get(b.id)).filter(Boolean);
  resumen.utilizables = lugares.filter((p) => !p.blocked).length;
  resumen.habilitados = lugares.filter((p) => p.habilitado).length;
  resumen.comprables = lugares.filter((p) => p.comprable).length;
  resumen.desconocidos = lugares.filter((p) => p.habilitado && p.estado === 'desconocido').length;
  const precios = new Set();
  const grupos = new Set();
  for (const p of lugares) {
    const grupo = evento.grupos.get(p.physical_group?.id);
    if (grupo?.modalidad === 'completa') grupos.add(grupo.id);
    else if (p.habilitado && p.categoria) precios.add(p.categoria.precioCentavos);
  }
  resumen.preciosIndividuales = [...precios].sort((a, b) => a - b);
  for (const id of grupos) {
    const g = evento.grupos.get(id);
    const miembros = g.requeridos.map((k) => evento.lugares.get(k));
    resumen.conjuntos.push({ id, nombre: miembros[0]?.physical_group?.name || 'Conjunto',
      tipo: miembros[0]?.physical_group?.type || 'table', comprable: g.comprable,
      precioCentavos: miembros.length && miembros.every((p) => p.habilitado && p.categoria)
        ? miembros.reduce((s, p) => s + p.categoria.precioCentavos, 0) : null });
  }
  return resumen;
}

// Tiras por fila y tramos separados por huecos: evitan rellenar la herradura
// o el pasillo entre bloques de una misma fila física. Coordenadas de celdas.
function contornosDeZona(lista) {
  const filas = new Map();
  for (const b of lista) {
    const clave = JSON.stringify([b.nivel, b.sectorFisico?.id, b.grupo?.id,
      b.grupo ? '' : b.filaFisica?.id || b.fila || b.id]);
    if (!filas.has(clave)) filas.set(clave, []);
    filas.get(clave).push({ x: b.x + .5, y: b.y + .5, grupo: Boolean(b.grupo) });
  }
  const contornos = [];
  const trazar = (puntos) => {
    if (puntos.length === 1) {
      const { x, y } = puntos[0];
      contornos.push([{ x: x - .7, y: y - .7 }, { x: x + .7, y: y - .7 },
        { x: x + .7, y: y + .7 }, { x: x - .7, y: y + .7 }]); return;
    }
    // Ajuste ortogonal: el contorno no reproduce el ruido de un trazado manual.
    const cx = puntos.reduce((s, p) => s + p.x, 0) / puntos.length;
    const cy = puntos.reduce((s, p) => s + p.y, 0) / puntos.length;
    let xx = 0, yy = 0, xy = 0;
    for (const p of puntos) { xx += (p.x - cx) ** 2; yy += (p.y - cy) ** 2; xy += (p.x - cx) * (p.y - cy); }
    const angulo = Math.atan2(2 * xy, xx - yy) / 2;
    let dx = Math.cos(angulo), dy = Math.sin(angulo);
    // Los tramos casi verticales u horizontales comparten una referencia recta.
    if (Math.abs(dx) < .06) { dx = 0; dy = 1; }
    else if (Math.abs(dy) < .06) { dx = 1; dy = 0; }
    const desvio = Math.max(...puntos.map((p) => Math.abs(-(p.x - cx) * dy + (p.y - cy) * dx)));
    const primero = puntos[0], segundo = puntos[1], ultimo = puntos.at(-1), penultimo = puntos.at(-2);
    const giro = Math.abs(Math.atan2((segundo.x - primero.x) * (ultimo.y - penultimo.y) -
      (segundo.y - primero.y) * (ultimo.x - penultimo.x), (segundo.x - primero.x) * (ultimo.x - penultimo.x) +
      (segundo.y - primero.y) * (ultimo.y - penultimo.y)));
    if (desvio <= .2 && (desvio <= .08 || giro <= Math.PI / 22.5)) {
      const proyecciones = puntos.map((p) => (p.x - cx) * dx + (p.y - cy) * dy);
      const desde = Math.min(...proyecciones) - .7, hasta = Math.max(...proyecciones) + .7;
      const margen = .7 + desvio;
      contornos.push([[desde, margen], [hasta, margen], [hasta, -margen], [desde, -margen]]
        .map(([t, n]) => ({ x: cx + dx * t - dy * n, y: cy + dy * t + dx * n })));
      return;
    }
    // Curva cuadrática continua por los puntos medios: evita quiebres entre butacas.
    const suaves = [primero];
    let inicio = primero;
    for (let i = 1; i < puntos.length - 1; i++) {
      const control = puntos[i], siguiente = puntos[i + 1];
      const fin = i === puntos.length - 2 ? siguiente : { x: (control.x + siguiente.x) / 2, y: (control.y + siguiente.y) / 2 };
      for (let j = 1; j <= 8; j++) {
        const t = j / 8, u = 1 - t;
        suaves.push({ x: u * u * inicio.x + 2 * u * t * control.x + t * t * fin.x,
          y: u * u * inicio.y + 2 * u * t * control.y + t * t * fin.y });
      }
      inicio = fin;
    }
    puntos = suaves;
    const lados = [[], []];
    puntos.forEach((p, i) => {
      const antes = puntos[Math.max(0, i - 1)], despues = puntos[Math.min(puntos.length - 1, i + 1)];
      const largo = Math.hypot(despues.x - antes.x, despues.y - antes.y) || 1;
      const dx = (despues.x - antes.x) / largo, dy = (despues.y - antes.y) / largo;
      const extremo = i === 0 ? -.7 : i === puntos.length - 1 ? .7 : 0;
      lados[0].push({ x: p.x + dx * extremo - dy * .7, y: p.y + dy * extremo + dx * .7 });
      lados[1].push({ x: p.x + dx * extremo + dy * .7, y: p.y + dy * extremo - dx * .7 });
    });
    contornos.push([...lados[0], ...lados[1].reverse()]);
  };
  for (const puntos of filas.values()) {
    if (puntos[0].grupo) {
      const xs = puntos.map((p) => p.x), ys = puntos.map((p) => p.y);
      const x = Math.min(...xs) - .7, y = Math.min(...ys) - .7;
      const w = Math.max(...xs) + .7, h = Math.max(...ys) + .7;
      contornos.push([{ x, y }, { x: w, y }, { x: w, y: h }, { x, y: h }]); continue;
    }
    let tramo = [];
    for (const p of puntos) {
      const anterior = tramo.at(-1);
      if (anterior && Math.hypot(p.x - anterior.x, p.y - anterior.y) > 2.5) { trazar(tramo); tramo = []; }
      tramo.push(p);
    }
    if (tramo.length) trazar(tramo);
  }
  return contornos;
}

// Envolvente ajustada a las butacas, en vez de su rectángulo horizontal.
function envolventeDePalco(lista) {
  const puntos = lista.flatMap((b) => [-.7, .7].flatMap((dx) => [-.7, .7].map((dy) => ({ x: b.x + .5 + dx, y: b.y + .5 + dy }))));
  puntos.sort((a, b) => a.x - b.x || a.y - b.y);
  const giro = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const mitad = (ps) => {
    const borde = [];
    for (const p of ps) {
      while (borde.length > 1 && giro(borde.at(-2), borde.at(-1), p) <= 0) borde.pop();
      borde.push(p);
    }
    return borde.slice(0, -1);
  };
  return puntos.length ? [...mitad(puntos), ...mitad([...puntos].reverse())] : [];
}

// Franja radial para un conjunto de palcos dispuesto alrededor del escenario.
// No impone una herradura a mapas con uno/dos palcos o una disposición recta.
function contornosDePalcos(lista, centro) {
  const grupos = new Map();
  for (const b of lista) {
    if (!grupos.has(b.grupo.id)) grupos.set(b.grupo.id, []);
    grupos.get(b.grupo.id).push(b);
  }
  const separados = () => [...grupos.values()].map(envolventeDePalco);
  if (grupos.size < 3 || !Number.isFinite(centro.x) || !Number.isFinite(centro.y)) return separados();
  const esquinas = lista.flatMap((b) => [-.85, .85].flatMap((dx) => [-.85, .85].map((dy) => {
    const x = b.x + .5 + dx - centro.x, y = b.y + .5 + dy - centro.y;
    return { angulo: Math.atan2(y, x), radio: Math.hypot(x, y) };
  })));
  const min = Math.min(...esquinas.map((p) => p.angulo)), max = Math.max(...esquinas.map((p) => p.angulo));
  if (max - min < 1 || max - min > Math.PI * 1.5) return separados();
  const cantidad = Math.ceil((max - min) / .035);
  const paso = (max - min) / cantidad;
  const bandas = Array.from({ length: cantidad + 1 }, () => ({ interior: Infinity, exterior: -Infinity }));
  for (let i = 0; i < esquinas.length; i += 4) {
    const ps = esquinas.slice(i, i + 4);
    const desde = Math.max(0, Math.floor((Math.min(...ps.map((p) => p.angulo)) - min) / paso));
    const hasta = Math.min(cantidad, Math.ceil((Math.max(...ps.map((p) => p.angulo)) - min) / paso));
    const interior = Math.min(...ps.map((p) => p.radio)), exterior = Math.max(...ps.map((p) => p.radio));
    for (let j = desde; j <= hasta; j++) {
      bandas[j].interior = Math.min(bandas[j].interior, interior);
      bandas[j].exterior = Math.max(bandas[j].exterior, exterior);
    }
  }
  for (let i = 0; i <= cantidad; i++) if (!Number.isFinite(bandas[i].interior)) {
    let antes = i - 1, despues = i + 1;
    while (antes >= 0 && !Number.isFinite(bandas[antes].interior)) antes--;
    while (despues <= cantidad && !Number.isFinite(bandas[despues].interior)) despues++;
    if (antes < 0 || despues > cantidad || (despues - antes) * paso > .45) return separados();
    const t = (i - antes) / (despues - antes);
    bandas[i] = { interior: bandas[antes].interior * (1 - t) + bandas[despues].interior * t,
      exterior: bandas[antes].exterior * (1 - t) + bandas[despues].exterior * t };
  }
  const internos = [], externos = [];
  // Suavizar la franja completa y compensar hacia fuera conserva todas las butacas
  // sin trasladar al borde cada salto entre compartimentos.
  const suavizar = (campo) => bandas.map((_, i) => {
    let total = 0, peso = 0;
    for (let j = Math.max(0, i - 12); j <= Math.min(cantidad, i + 12); j++) {
      const w = Math.exp(-((j - i) ** 2) / 32);
      total += bandas[j][campo] * w; peso += w;
    }
    return total / peso;
  });
  const interiorSuave = suavizar('interior'), exteriorSuave = suavizar('exterior');
  const margenInterior = Math.max(0, ...bandas.map((b, i) => interiorSuave[i] - b.interior)) + .2;
  const margenExterior = Math.max(0, ...bandas.map((b, i) => b.exterior - exteriorSuave[i])) + .2;
  for (let i = 0; i <= cantidad; i++) {
    const interior = Math.max(.1, interiorSuave[i] - margenInterior);
    const exterior = exteriorSuave[i] + margenExterior;
    const angulo = min + i * paso;
    internos.push({ x: centro.x + Math.cos(angulo) * interior, y: centro.y + Math.sin(angulo) * interior });
    externos.push({ x: centro.x + Math.cos(angulo) * exterior, y: centro.y + Math.sin(angulo) * exterior });
  }
  return [[...externos, ...internos.reverse()]];
}

// Separadores entre compartimentos vecinos: perpendiculares al recorrido y
// recortados contra la franja, sin añadir cajas ni límites de compra.
function divisionesDePalcos(lista, centro) {
  const grupos = new Map();
  for (const b of lista) {
    if (!grupos.has(b.grupo.id)) grupos.set(b.grupo.id, []);
    grupos.get(b.grupo.id).push(b);
  }
  if (grupos.size < 3) return [];
  const contornos = contornosDePalcos(lista, centro);
  if (contornos.length !== 1) return [];
  const orden = [...grupos.entries()].map(([id, lugares]) => {
    const x = lugares.reduce((s, b) => s + b.x + .5, 0) / lugares.length;
    const y = lugares.reduce((s, b) => s + b.y + .5, 0) / lugares.length;
    return { id, lugares, x, y, angulo: Math.atan2(y - centro.y, x - centro.x) };
  }).sort((a, b) => a.angulo - b.angulo);
  const resultado = [];
  for (let i = 1; i < orden.length; i++) {
    const a = orden[i - 1], b = orden[i];
    const distancia = Math.hypot(b.x - a.x, b.y - a.y);
    if (distancia < .01) continue;
    const nx = (b.x - a.x) / distancia, ny = (b.y - a.y) / distancia;
    const proyeccion = (p) => (p.x + .5) * nx + (p.y + .5) * ny;
    const finA = Math.max(...a.lugares.map(proyeccion)), inicioB = Math.min(...b.lugares.map(proyeccion));
    // Si no hay una separación legible, no atravesar una butaca para inventarla.
    if (inicioB - finA < 1) continue;
    const mitad = (inicioB + finA) / 2;
    const ajuste = mitad - ((a.x + b.x) / 2 * nx + (a.y + b.y) / 2 * ny);
    const p = { x: (a.x + b.x) / 2 + ajuste * nx, y: (a.y + b.y) / 2 + ajuste * ny };
    const dx = -ny, dy = nx, cruces = [];
    const borde = contornos[0];
    for (let j = 0; j < borde.length; j++) {
      const v = borde[j], w = borde[(j + 1) % borde.length];
      const ex = w.x - v.x, ey = w.y - v.y, determinante = dx * ey - dy * ex;
      if (Math.abs(determinante) < 1e-8) continue;
      const vx = v.x - p.x, vy = v.y - p.y;
      const t = (vx * ey - vy * ex) / determinante;
      const u = (vx * dy - vy * dx) / determinante;
      if (u >= 0 && u < 1) cruces.push(t);
    }
    cruces.sort((x, y) => x - y);
    // Escoger el tramo dentro de la franja que queda junto a estos dos palcos,
    // aunque la recta también cruce el otro lateral de la herradura.
    let tramo = null, cercania = Infinity;
    for (let j = 0; j + 1 < cruces.length; j += 2) {
      const desde = cruces[j], hasta = cruces[j + 1];
      const distanciaTramo = desde > 0 ? desde : hasta < 0 ? -hasta : 0;
      if (distanciaTramo < cercania) { tramo = [desde, hasta]; cercania = distanciaTramo; }
    }
    if (tramo) resultado.push({ palcos: [a.id, b.id], desde: { x: p.x + dx * tramo[0], y: p.y + dy * tramo[0] }, hasta: { x: p.x + dx * tramo[1], y: p.y + dy * tramo[1] } });
  }
  return resultado;
}

// Rótulo visual hacia el exterior del palco; no cambia su nombre físico.
function rotuloDePalco(lista, centro, divisiones = [], lineasExplicitas = null) {
  if (!lista.length) return null;
  const nombre = lista[0].grupo.nombre.replace(/^Palco\s+/i, '');
  const lineas = lineasExplicitas || (/^presidencial$/i.test(nombre) ? ['PALCO', 'PRESIDENCIAL'] : [nombre]);
  const cx = lista.reduce((s, b) => s + b.x + .5, 0) / lista.length;
  const cy = lista.reduce((s, b) => s + b.y + .5, 0) / lista.length;
  const finito = Number.isFinite(centro.x) && Number.isFinite(centro.y);
  const distancia = finito ? Math.hypot(cx - centro.x, cy - centro.y) : 0;
  const nx = distancia > .01 ? (cx - centro.x) / distancia : 0;
  const ny = distancia > .01 ? (cy - centro.y) / distancia : -1;
  const exterior = Math.max(...lista.map(b => (b.x + .5 - cx) * nx + (b.y + .5 - cy) * ny));
  const semiancho = Math.max(...lineas.map(l => l.length)) * .17;
  const semialto = lineas.length === 2 ? .5 : .3;
  const margen = .7 + Math.abs(nx) * semiancho + Math.abs(ny) * semialto;
  const posicion = { x: cx + nx * (exterior + margen), y: cy + ny * (exterior + margen), lineas };
  const limites = divisiones.filter(d => d.palcos.includes(lista[0].grupo.id)).map(d => {
    const dx = d.hasta.x - d.desde.x, dy = d.hasta.y - d.desde.y, largo = Math.hypot(dx, dy);
    const signo = (cx - d.desde.x) * -dy + (cy - d.desde.y) * dx >= 0 ? 1 : -1;
    return { x: d.desde.x, y: d.desde.y, nx: -dy / largo * signo, ny: dx / largo * signo };
  });
  limites.push({ x: cx + nx * (exterior + .7), y: cy + ny * (exterior + .7), nx, ny });
  for (let i = 0; i < 32; i++) for (const l of limites) {
    const espacio = (posicion.x - l.x) * l.nx + (posicion.y - l.y) * l.ny;
    const requerido = Math.abs(l.nx) * semiancho + Math.abs(l.ny) * semialto + .15;
    if (espacio < requerido) {
      posicion.x += l.nx * (requerido - espacio); posicion.y += l.ny * (requerido - espacio);
    }
  }
  return posicion;
}

// Referencias optativas de filas de un sector lateral, independientes de compra.
function referenciasDeFilasLaterales(lista, centro) {
  const sectores = new Map();
  for (const b of lista) {
    if (!b.sectorFisico?.mostrarFilasEnVisor || !b.filaFisica || b.grupo) continue;
    const id = b.sectorFisico.id;
    if (!sectores.has(id)) sectores.set(id, new Map());
    const filas = sectores.get(id);
    if (!filas.has(b.filaFisica.id)) filas.set(b.filaFisica.id, []);
    filas.get(b.filaFisica.id).push({ ...b, grupo: { id: b.filaFisica.id, nombre: b.filaFisica.nombre } });
  }
  const rotulos = [], divisiones = [];
  for (const filas of sectores.values()) {
    const orden = [...filas.values()].map(lugares => ({ lugares,
      x: lugares.reduce((s, b) => s + b.x + .5, 0) / lugares.length,
      y: lugares.reduce((s, b) => s + b.y + .5, 0) / lugares.length }));
    orden.sort((a, b) => Number.isFinite(centro.y) ? Math.atan2(a.y - centro.y, a.x - centro.x) - Math.atan2(b.y - centro.y, b.x - centro.x) : a.y - b.y);
    const limites = [];
    for (let i = 1; i < orden.length; i++) {
      const a = orden[i - 1], b = orden[i], largo = Math.hypot(b.x - a.x, b.y - a.y);
      if (largo < .01) continue;
      const nx = (b.x - a.x) / largo, ny = (b.y - a.y) / largo, dx = -ny, dy = nx;
      const proyectar = p => (p.x + .5) * nx + (p.y + .5) * ny;
      const fin = Math.max(...a.lugares.map(proyectar)), inicio = Math.min(...b.lugares.map(proyectar));
      if (inicio - fin < 1) continue;
      const mitad = (fin + inicio) / 2, x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      const ajuste = mitad - x * nx - y * ny;
      const origen = { x: x + ajuste * nx, y: y + ajuste * ny };
      const posiciones = [...a.lugares, ...b.lugares].map(p => (p.x + .5 - origen.x) * dx + (p.y + .5 - origen.y) * dy);
      const desde = Math.min(...posiciones) - .7, hasta = Math.max(...posiciones) + .7;
      limites.push({ palcos: [a.lugares[0].grupo.id, b.lugares[0].grupo.id],
        desde: { x: origen.x + dx * desde, y: origen.y + dy * desde }, hasta: { x: origen.x + dx * hasta, y: origen.y + dy * hasta } });
    }
    for (const fila of orden) rotulos.push({ fila: fila.lugares[0].grupo.id,
      ...rotuloDePalco(fila.lugares, centro, limites, [fila.lugares[0].filaFisica.nombre]) });
    divisiones.push(...limites.map(d => ({ filas: d.palcos, desde: d.desde, hasta: d.hasta })));
  }
  return { rotulos, divisiones };
}

// === Fin de la parte sin DOM. pruebas.mjs evalua todo lo anterior en Node. ===
