
const NS = 'http://www.w3.org/2000/svg';
const PASO = 12;        // distancia entre centros de celda, en unidades del viewBox
const GLIFO = 10;       // tamano dibujado de la butaca dentro de su celda
const ANCHO_SALA = 14;  // columnas de la sala. Constante: el pasillo se come una butaca,
                        // no ensancha el recinto.

// ---------------------------------------------------------------------------
// La rejilla de la sala.
//
// Unica fuente de verdad de las columnas. Todas las bandas del plano la
// consumen, asi que quedan alineadas por construccion: no es posible que dos
// bandas usen esquemas de columnas distintos y el plano quede descuadrado.
//
// El ancho es constante entre disposiciones. Lo que cambia es el aforo, igual
// que en un recinto real: el pasillo se lleva lugares que si no serian butacas.
// ---------------------------------------------------------------------------
// Una disposicion con nombre ('ambos', 'izquierda'...) repartida en un ancho fijo:
// devuelve la distribucion equivalente, con pasillos de una columna. Es lo que
// usan las plantillas; el editor puede luego cambiar bloques y pasillos a mano.
function distribucionDePasillos(pasillos = 'ninguno', ancho = ANCHO_SALA) {
  const reparto = {
    ninguno:   [1],        // sin cortes
    izquierda: [1, 2],     // un pasillo, escorado a la izquierda
    derecha:   [2, 1],     // un pasillo, escorado a la derecha
    ambos:     [1, 1, 1],  // dos pasillos
  }[pasillos];
  if (!reparto) throw new Error('Disposicion desconocida: ' + pasillos);

  const huecos = reparto.length - 1;
  const cuantas = ancho - huecos;
  const peso = reparto.reduce((s, p) => s + p, 0);

  const tamanos = reparto.map((p) => Math.floor((cuantas * p) / peso));
  // El sobrante va al bloque mas ancho, para que izquierda y derecha salgan simetricas.
  const mayor = reparto.indexOf(Math.max(...reparto));
  tamanos[mayor] += cuantas - tamanos.reduce((s, t) => s + t, 0);

  return { bloques: tamanos, pasillos: Array(huecos).fill(1) };
}

// La rejilla desde una distribucion libre: { bloques: [4, 6, 4], pasillos: [1, 2] }
// son tres bloques de 4, 6 y 4 butacas separados por pasillos de 1 y 2 columnas.
// El ancho de la sala sale de sumarlo todo.
function rejillaDeBloques({ bloques, pasillos }) {
  const columnasPorBloque = [];
  let columna = 1;
  bloques.forEach((tamano, i) => {
    columnasPorBloque.push(Array.from({ length: tamano }, () => columna++));
    if (i < bloques.length - 1) columna += pasillos[i];   // las columnas del pasillo quedan vacias
  });
  return { ancho: columna - 1, bloques: columnasPorBloque, columnas: columnasPorBloque.flat() };
}

// La distribucion de una rejilla ya calculada (el camino inverso).
const distribucionDeSala = (sala) => ({
  bloques: sala.bloques.map((b) => b.length),
  pasillos: sala.bloques.slice(1).map((b, i) => b[0] - sala.bloques[i].at(-1) - 1),
});

const BLOQUES_MAXIMOS = 20;
const BUTACAS_POR_BLOQUE = 60;
const PASILLO_MAXIMO = 10;
const ANCHO_MAXIMO = 300;
const esEntero = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
// Aforo maximo de un plano: mas butacas hacen lento el dibujo (varios nodos SVG por
// butaca). Lo aplican validarMapa y el editor, asi que ningun mapa guardado lo supera.
const BUTACAS_MAXIMAS = 20000;
const ELEMENTOS_MAPA_MAXIMOS = 22000;
const numeroConMiles = (n) => n.toLocaleString('es-MX');
const motivoDeAforo = (n) => (n > BUTACAS_MAXIMAS
  ? 'la sala tendría ' + numeroConMiles(n) + ' butacas y el máximo es ' + numeroConMiles(BUTACAS_MAXIMAS) : null);

// null si la distribucion es valida, o el motivo en palabras.
function motivoDistribucion(d) {
  if (!d || !Array.isArray(d.bloques) || !Array.isArray(d.pasillos)) return 'faltan los bloques o los pasillos';
  const n = d.bloques.length;
  if (n < 1 || n > BLOQUES_MAXIMOS) return 'debe haber de 1 a ' + BLOQUES_MAXIMOS + ' bloques';
  if (!d.bloques.every((b) => esEntero(b, 1, BUTACAS_POR_BLOQUE))) {
    return 'cada bloque debe tener de 1 a ' + BUTACAS_POR_BLOQUE + ' butacas';
  }
  if (d.pasillos.length !== n - 1) {
    return n === 1 ? 'con un solo bloque no hay pasillos'
                   : 'con ' + n + ' bloques hacen falta ' + (n - 1) + ' anchos de pasillo';
  }
  if (!d.pasillos.every((a) => esEntero(a, 1, PASILLO_MAXIMO))) {
    return 'cada pasillo debe medir de 1 a ' + PASILLO_MAXIMO + ' columnas';
  }
  const ancho = [...d.bloques, ...d.pasillos].reduce((s, v) => s + v, 0);
  if (ancho > ANCHO_MAXIMO) return 'la sala mediría ' + ancho + ' columnas y el máximo es ' + ANCHO_MAXIMO;
  return null;
}

// Lee lo que se escribe en el editor: «4, 6, 4» y «1, 2». Sin anchos de pasillo,
// todos miden una columna. Devuelve { distribucion } o { motivo }.
function leerDistribucion(textoBloques, textoPasillos = '') {
  const numeros = (texto) => texto.split(/[\s,;]+/).filter(Boolean).map(Number);
  const bloques = numeros(textoBloques);
  if (!bloques.length) return { motivo: 'escribe cuántas butacas lleva cada bloque, separadas por comas' };
  const pasillos = textoPasillos.trim() ? numeros(textoPasillos) : Array(bloques.length - 1).fill(1);
  const motivo = motivoDistribucion({ bloques, pasillos });
  return motivo ? { motivo } : { distribucion: { bloques, pasillos } };
}

// Reparte mesas por los bloques, a prorrata de su tamano, y las espacia dentro
// de cada uno. Una mesa nunca cruza un pasillo porque solo se coloca DENTRO de
// un bloque, que es donde las columnas son contiguas.
function repartirMesas(sala, cuantas, ancho = 2) {
  const aptos = sala.bloques.filter((b) => b.length >= ancho);
  const capacidad = aptos.map((b) => Math.floor(b.length / ancho));
  const total = capacidad.reduce((s, c) => s + c, 0);
  if (!total) return [];
  cuantas = Math.min(cuantas, total);

  const cuota = capacidad.map((c) => Math.floor((cuantas * c) / total));
  let resto = cuantas - cuota.reduce((s, c) => s + c, 0);
  for (let i = 0; resto > 0; i = (i + 1) % cuota.length) {
    if (cuota[i] < capacidad[i]) { cuota[i]++; resto--; }
  }

  const arranques = [];
  aptos.forEach((bloque, i) => {
    const n = cuota[i];
    if (!n) return;
    const hueco = (bloque.length - n * ancho) / (n + 1);
    for (let k = 0; k < n; k++) {
      arranques.push(bloque[Math.round(hueco * (k + 1)) + k * ancho]);
    }
  });
  return arranques;
}

// ---------------------------------------------------------------------------
// Datos. Esto es lo que devolveria el servidor: una fila por butaca.
// ---------------------------------------------------------------------------
// Zonas fisicas: identidad y nombre. Las tarifas pertenecen al evento.
// 'zonas' es el indice por id de la sala generada (lo rellena generarPlano), asi que
// zonas[b.zona].nombre siempre es el de la sala actual.
// La zona 'mesas' es la de los lugares de mesa: no se elimina ni se asigna a filas.
const ZONAS_POR_DEFECTO = [
  { id: 'luneta', nombre: 'Luneta' },
  { id: 'mesas', nombre: 'Mesas' },
  { id: 'general', nombre: 'General' },
];
// Catalogo independiente del numero de bandas.
const ZONAS_MAXIMAS = 40;
const PRECIO_MAXIMO = 100000000;   // tarifas de evento y antecedentes; nunca precios del recinto
const zonas = {};

// Rellena el indice 'zonas' con una lista, en su orden.
function usarZonas(lista) {
  for (const id of Object.keys(zonas)) delete zonas[id];
  for (const { id, nombre } of lista) zonas[id] = { nombre };
}
usarZonas(ZONAS_POR_DEFECTO);

const copiarZonas = (lista) => lista.map(({ id, nombre }) => ({ id, nombre }));
const zonasDe = (plano) => (plano && plano.zonas) || ZONAS_POR_DEFECTO;
// La zona con la que nacen filas, bloques y butacas sueltas: General si existe; si no,
// la primera que no sea la de mesas.
const zonaParaFilas = (lista) => (lista.some((z) => z.id === 'general') ? 'general'
  : (lista.find((z) => z.id !== 'mesas') || {}).id);
// La zona de una banda de mesas que no lleva la suya: la de mesas si existe. Se lee del
// indice, no de una lista, porque la usa disponerBandas al colocar el arbol.
const zonaDeMesasActual = () => (zonas.mesas ? 'mesas' : Object.keys(zonas)[0] || null);
// La zona efectiva de una banda: la suya y, en una zona de mesas sin zona propia, la de
// mesas. Es la que heredan las piezas que caen dentro (ver zonaEnCelda).
const zonaDeBanda = (banda) => banda.zona || (banda.tipo === 'mesas' ? zonaDeMesasActual() : null);

// Butacas. 'id' es estable: no cambia al mover piezas, y es lo que usan la
// seleccion, las reservas y las bloqueadas. 'fila', 'numero' y 'seccion' son la
// etiqueta visible («Luneta, fila B, butaca 3»), que se recalcula al generar.
const butacas = [];   // {id, fila, numero, seccion, banda|bloque, filaLocal, numeroLocal, x, y, mira, zona, grupo, estado}
const muebles = [];   // decorado: escenario y mesas. No se vende, solo se dibuja.

// ---------------------------------------------------------------------------
// Tipos de sala y bandas.
//
// Una sala es una lista de bandas horizontales, de arriba abajo, sobre la misma
// rejilla de columnas:
//   escenario   2 filas de rejilla, siempre la primera
//   filas       'filas' filas de butacas; cada banda empieza su secuencia en A
//   mesas       'alto' filas de rejilla libres, con 'filasDeMesas' automaticas
//   espacio     'alto' filas de rejilla vacias, para llenar con piezas; con
//               'guias', letras de referencia en cada fila (no son butacas)
// Cada tipo de sala define sus pasillos y sus bandas. Las mesas pueden ir en
// cualquier hueco libre de la sala, no solo en su banda.
//
// Como dos bandas pueden tener una fila A, el id de una butaca de fila lleva la
// banda delante: luneta-A1, general-A1.
// ---------------------------------------------------------------------------
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const FILAS_MAXIMAS = LETRAS.length;
const ALTO_MAXIMO = 40;
const ESCENARIO = { id: 'escenario', tipo: 'escenario' };

// Las cuatro salas mixtas son las disposiciones de pasillos de siempre.
const mixta = (pasillos, nombre) => ({
  nombre, grupo: 'Mixta', pasillos,
  mesasOcupadas: { M2: ['S1', 'S2'] },   // ocupacion de ejemplo; no es parte del diseño
  bandas: [
    ESCENARIO,
    { id: 'luneta', tipo: 'filas', zona: 'luneta', filas: 3, ocupadas: { B: [5, 6], C: [11] } },
    // Dos filas de mesas automaticas (filas 7 y 11 de la rejilla) y, debajo, una
    // franja libre donde el editor coloca las mesas nuevas.
    { id: 'mesas', tipo: 'mesas', alto: 13, filasDeMesas: 2 },
    { id: 'general', tipo: 'filas', zona: 'general', filas: 2,
      ocupadas: { A: [1, 2, 3] }, bloqueadasAlFinal: { B: 2 } },
  ],
});

// Un lienzo: sin pasillos (una sola columna de bloques; el pasillo es el hueco que
// se deja entre piezas), sin escenario y con un solo espacio vacio. Su ancho se
// cambia con cambiarAnchoLienzo.
const ANCHO_LIENZO = 20;
const ALTO_LIENZO = 10;
const TIPOS_DE_SALA = {
  'mapa-en-blanco': {
    nombre: 'Mapa en blanco', grupo: 'Nuevo', lienzo: true,
    distribucion: { bloques: [ANCHO_LIENZO], pasillos: [] },
    bandas: [{ id: 'espacio', tipo: 'espacio', alto: ALTO_LIENZO }],
    escenario: null, mesas: [], bloquesFilas: [], siguienteBanda: 1,
  },
  'mixta-ambos':     mixta('ambos', 'Dos pasillos, al centro'),
  'mixta-izquierda': mixta('izquierda', 'Un pasillo, a la izquierda'),
  'mixta-derecha':   mixta('derecha', 'Un pasillo, a la derecha'),
  'mixta-ninguno':   mixta('ninguno', 'Sin pasillos'),
  'solo-filas': {
    nombre: 'Solo filas · dos pasillos', grupo: 'Otras', pasillos: 'ambos',
    bandas: [
      ESCENARIO,
      { id: 'platea', tipo: 'filas', zona: 'luneta', nombre: 'Platea', filas: 7,
        ocupadas: { B: [5, 6], D: [7, 8, 9] } },
      { id: 'general', tipo: 'filas', zona: 'general', filas: 5,
        ocupadas: { A: [1, 2] }, bloqueadasAlFinal: { E: 2 } },
    ],
  },
  'solo-mesas': {
    nombre: 'Solo mesas · sin pasillos', grupo: 'Otras', pasillos: 'ninguno',
    mesasOcupadas: { M2: ['S1', 'S2'] },
    bandas: [
      ESCENARIO,
      { id: 'salon', tipo: 'mesas', nombre: 'Salón', alto: 20, filasDeMesas: 4 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Franjas divididas y bandas verticales.
//
// Una banda de tipo 'division' (franja dividida) ocupa el ancho de la sala y lo
// reparte en bandas verticales, de izquierda a derecha:
//   { id, tipo: 'division', verticales: [{ id, ancho, bandas: [...] }, ..., { id, bandas }] }
// Cada vertical tiene 'ancho' en columnas, salvo la ultima, que ocupa el resto.
// Dentro, cada vertical apila bandas horizontales de filas o de mesas. El alto de
// la franja es el de su vertical mas alta; las demas dejan espacio libre abajo.
//
// Las filas de una banda dentro de una vertical usan las columnas de la sala que
// caen en su tramo: los pasillos siguen alineados con el resto de la sala.
// ---------------------------------------------------------------------------
const VERTICALES_MAXIMAS = 6;
const esDivision = (banda) => banda.tipo === 'division';

// Todas las bandas «hoja» (escenario, filas, mesas) de un arbol, en orden.
function hojasDe(bandas) {
  const hojas = [];
  for (const b of bandas) {
    if (esDivision(b)) for (const v of b.verticales) hojas.push(...hojasDe(v.bandas));
    else hojas.push(b);
  }
  return hojas;
}

// Busca una banda o vertical por id en un arbol (de un plano o de una sala ya
// dispuesta). Devuelve { item, lista, indice, padre, enVertical } o null.
function ubicar(bandas, id, padre = null) {
  for (let i = 0; i < bandas.length; i++) {
    const b = bandas[i];
    if (b.id === id) return { item: b, lista: bandas, indice: i, padre, enVertical: Boolean(padre) };
    if (!esDivision(b)) continue;
    for (let j = 0; j < b.verticales.length; j++) {
      const v = b.verticales[j];
      if (v.id === id) return { item: v, lista: b.verticales, indice: j, padre: b, esVertical: true };
      const dentro = ubicar(v.bandas, id, v);
      if (dentro) return dentro;
    }
  }
  return null;
}

// Todos los nodos del arbol: bandas, franjas y verticales. Las hojas no bastan cuando
// lo que se busca (una zona, por ejemplo) puede estar en cualquier nivel.
function nodosDeBandas(bandas) {
  const todos = [];
  for (const b of bandas) {
    todos.push(b);
    for (const v of b.verticales || []) todos.push(v, ...nodosDeBandas(v.bandas));
  }
  return todos;
}

// Los ids de una banda o vertical y de todo lo que tiene dentro.
function idsDentro(item) {
  const ids = [item.id, item.id + ':resto'];
  for (const v of item.verticales || []) ids.push(...idsDentro(v));
  for (const b of item.bandas || []) ids.push(...idsDentro(b));
  return ids;
}

const copiarBandas = (lista) => lista.map((b) => (esDivision(b)
  ? { ...b, verticales: b.verticales.map((v) => ({ ...v, bandas: copiarBandas(v.bandas) })) }
  : { ...b }));

// Coloca un arbol de bandas en la rejilla. Devuelve las bandas colocadas (con x,
// y, anchoOcupado, alto y nombre), las regiones (rectangulos con id y
// profundidad, para anclar piezas) y un error si las verticales no caben.
function disponerBandas(bandas, anchoSala) {
  const regiones = [];
  const vistos = {};
  let error = null;
  const nombreDe = (banda) => {
    if (banda.nombre) return banda.nombre;
    if (banda.tipo === 'escenario') return 'Escenario';
    // Una banda con zona se llama como su zona: son la misma cosa. Las que no tienen
    // (un espacio sin zona, una franja) toman el nombre de su tipo.
    const zona = zonaDeBanda(banda);
    const base = zona && zonas[zona] ? zonas[zona].nombre
      : banda.tipo === 'mesas' ? 'Zona de mesas' : banda.tipo === 'espacio' ? 'Espacio' : 'Franja dividida';
    vistos[base] = (vistos[base] || 0) + 1;
    return vistos[base] > 1 ? base + ' ' + vistos[base] : base;
  };
  const pila = (lista, x, y, ancho, profundidad) => {
    let cursor = y;
    const colocadas = lista.map((banda) => {
      const colocada = { ...banda, nombre: nombreDe(banda), nombrePropio: banda.nombre || null,
                         zona: zonaDeBanda(banda), zonaPropia: banda.zona || null,
                         x, y: cursor, anchoOcupado: ancho, profundidad };
      if (esDivision(banda)) {
        const n = banda.verticales.length;
        const resto = ancho - banda.verticales.slice(0, -1).reduce((s, v) => s + v.ancho, 0);
        if (resto < 1 && !error) error = 'las bandas verticales de ' + colocada.nombre + ' no caben en ' + ancho + ' columnas';
        let vx = x;
        colocada.verticales = banda.verticales.map((v, i) => {
          const w = i < n - 1 ? v.ancho : Math.max(1, resto);
          const interior = pila(v.bandas, vx, cursor, w, profundidad + 2);
          const colV = { ...v, nombre: v.nombre || 'Vertical ' + (i + 1), nombrePropio: v.nombre || null,
                         zona: v.zona || null, zonaPropia: v.zona || null,
                         x: vx, y: cursor, anchoOcupado: w,
                         profundidad: profundidad + 1, bandas: interior.colocadas, altoPila: interior.alto };
          vx += w;
          return colV;
        });
        colocada.alto = Math.max(1, ...colocada.verticales.map((v) => v.altoPila));
        for (const v of colocada.verticales) {
          v.alto = colocada.alto;
          regiones.push({ id: v.id, tipo: 'vertical', zona: v.zona, x: v.x, y: v.y, ancho: v.anchoOcupado, alto: v.alto, profundidad: v.profundidad });
          if (v.altoPila < v.alto) {
            regiones.push({ id: v.id + ':resto', tipo: 'resto', x: v.x, y: v.y + v.altoPila, ancho: v.anchoOcupado,
                            alto: v.alto - v.altoPila, profundidad: v.profundidad + 1 });
          }
        }
      } else {
        colocada.alto = altoDeBanda(banda);
      }
      regiones.push({ id: banda.id, tipo: 'banda', zona: colocada.zona, x, y: cursor, ancho, alto: colocada.alto, profundidad });
      cursor += colocada.alto;
      return colocada;
    });
    return { colocadas, alto: cursor - y };
  };
  const { colocadas, alto } = pila(bandas, 1, 0, anchoSala, 0);
  return { colocadas, regiones, alto, error };
}

// La zona que se hereda en una celda: la de la banda mas interna que la cubre y
// tiene zona, o null si ninguna la tiene (una mesa sobre un espacio sin zona).
// Es la referencia de herencia fisica inicial, no una asignacion de tarifa.
// Gana la mas profunda, no la primera: el orden de 'regiones' es cosa de
// disponerBandas y no debe decidir el precio de nadie.
function zonaEnCelda(sala, x, y) {
  let mejor = null;
  for (const r of sala.regiones) {
    if (!r.zona || x < r.x || x >= r.x + r.ancho || y < r.y || y >= r.y + r.alto) continue;
    if (!mejor || r.profundidad > mejor.profundidad) mejor = r;
  }
  return mejor && mejor.zona;
}

// Las columnas de la sala que caen en el tramo de una banda colocada.
const columnasDeBanda = (sala, banda) =>
  sala.columnas.filter((c) => c >= (banda.x || 1) && c < (banda.x || 1) + (banda.anchoOcupado || sala.ancho));

// Recoloca las piezas de 'nuevo' tras cambiar sus bandas. Cada pieza se ancla a la
// region mas profunda que contiene su esquina superior izquierda en 'antes' (una
// banda, el espacio libre bajo una vertical, la vertical...) y conserva su distancia
// a ella en 'nuevo'. Asi una mesa viaja con su banda, tanto en vertical como en
// horizontal. Las que estaban en una region de 'quitar' se eliminan (el escenario
// nunca: se queda donde esta).
// Las piezas que se guardan en listas del plano: su lista, el prefijo de su id y el
// contador que da ids nuevos (nunca se reutilizan). El escenario va aparte.
const LISTAS_DE_PIEZAS = [
  { lista: 'mesas', prefijo: 'M', contador: 'siguiente' },
  { lista: 'bloquesFilas', prefijo: 'F', contador: 'siguienteBloque' },
  { lista: 'formas', prefijo: 'P', contador: 'siguienteForma' },
  { lista: 'butacasSueltas', prefijo: 'B', contador: 'siguienteButaca' },
];
const listaDeId = (id) => LISTAS_DE_PIEZAS.find((l) => new RegExp('^' + l.prefijo + '\\d+$').test(id)) || null;
// Da el siguiente id de una lista y avanza su contador.
function nuevoIdDe(plano, { prefijo, contador }) {
  const n = plano[contador] || 1;
  plano[contador] = n + 1;
  return prefijo + n;
}

function reanclarPiezas(antes, nuevo, anchoAntes, anchoDespues, quitar = []) {
  const regionesAntes = disponerBandas(antes.bandas, anchoAntes).regiones;
  const despues = new Map(disponerBandas(nuevo.bandas, anchoDespues).regiones.map((r) => [r.id, r]));
  const fuera = new Set(quitar);
  const recolocar = (pieza, sePuedeQuitar = true) => {
    const cadena = regionesAntes
      .filter((r) => pieza.x >= r.x && pieza.x < r.x + r.ancho && pieza.y >= r.y && pieza.y < r.y + r.alto)
      .sort((a, b) => b.profundidad - a.profundidad);
    if (sePuedeQuitar && cadena.some((r) => fuera.has(r.id))) return false;
    const r = cadena.find((c) => despues.has(c.id));
    if (r) {
      const d = despues.get(r.id);
      pieza.x = d.x + (pieza.x - r.x);
      pieza.y = d.y + (pieza.y - r.y);
    }
    return true;
  };
  for (const { lista } of LISTAS_DE_PIEZAS) nuevo[lista] = (nuevo[lista] || []).filter((p) => recolocar(p));
  if (nuevo.escenario) recolocar(nuevo.escenario, false);
  return nuevo;
}

// Bandas cuyo alto es un dato propio (no sale de sus filas ni de lo de dentro).
const tieneAlto = (banda) => banda.tipo === 'mesas' || banda.tipo === 'espacio';

const altoDeBanda = (banda) =>
  (banda.tipo === 'escenario' ? 2 : banda.tipo === 'filas' ? banda.filas : banda.alto);

// La butaca n de la fila va a columnas[n-1]: nunca a la columna n a secas.
// Es lo que mantiene todas las bandas en la misma rejilla.
//
// Las butacas de fila miran al escenario. Con el escenario arriba (lo normal) se
// giran 180 grados: respaldo abajo, mirando hacia arriba. Si el escenario se mueve
// debajo de una banda, sus filas miran hacia abajo (0): ver miraHaciaEscenario.
const MIRA_ESCENARIO = 180;
const MIRA_ABAJO = 0;

function agregarFilas(banda, columnas, anchoSala = Infinity) {
  const { id, nombre, zona, y, filas, ocupadas = {} } = banda;
  for (let i = 0; i < filas; i++) {
    const fila = LETRAS[i];
    columnas.forEach((columna, indice) => {
      const numero = indice + 1;
      const estado = (ocupadas[fila] || []).includes(numero) ? 'ocupada' : 'libre';
      butacas.push({
        id: id + '-' + fila + numero, fila, numero, banda: id, bandaNombre: nombre,
        filaLocal: i, numeroLocal: numero,
        x: columna, y: y + i, mira: MIRA_ESCENARIO, zona, grupo: null, estado,
      });
    });
    // El texto del rotulo se pone al numerar: con la numeracion por zona, la fila
    // local A de una banda puede ser la C de su zona.
    // A la izquierda si la banda empieza en el borde izquierdo de la sala; a la
    // derecha si acaba en el derecho; en medio de una franja dividida, sin rotulo
    // (no hay columna libre segura a su lado).
    if (!columnas.length) continue;
    const bordeIzquierdo = (banda.x || 1) === 1;
    const bordeDerecho = (banda.x || 1) + (banda.anchoOcupado || anchoSala) - 1 >= anchoSala;
    const xRotulo = banda.ladoRotulo === 'izquierdo' || (!banda.ladoRotulo && bordeIzquierdo) ? columnas[0] - 1 :
      banda.ladoRotulo === 'derecho' || (!banda.ladoRotulo && bordeDerecho) ? columnas.at(-1) + 1 : null;
    if (xRotulo !== null) muebles.push({ tipo: 'rotulo', texto: fila, banda: id, filaLocal: i, x: xRotulo, y: y + i });
  }
}

// Letras de referencia en las filas de un espacio con 'guias': A, B, C... en el
// mismo sitio que los rotulos de fila. Solo ayudan a ubicarse; no son butacas.
function agregarGuias(banda, anchoSala) {
  const desde = banda.x || 1, ancho = banda.anchoOcupado || anchoSala;
  const x = banda.ladoRotulo === 'izquierdo' ? desde - 1 : banda.ladoRotulo === 'derecho' ? desde + ancho :
    desde === 1 ? 0 : desde + ancho - 1 >= anchoSala ? anchoSala + 1 : null;
  if (x === null) return;
  for (let i = 0; i < banda.alto; i++) {
    muebles.push({ tipo: 'guia', texto: letraDeFila(i), banda: banda.id, x, y: banda.y + i });
  }
}

// Pone o quita las guias de fila de un espacio.
function alternarGuias(plano, id) {
  const nuevo = copiarPlano(plano);
  const banda = ubicar(nuevo.bandas, id).item;
  if (banda.tipo !== 'espacio') return { motivo: 'las guías de fila son para los espacios' };
  if (banda.guias) delete banda.guias;
  else banda.guias = true;
  return nuevo;
}

// Ids bloqueados por las bandas de una plantilla: 'bloqueadasAlFinal: { B: 2 }'
// bloquea las dos ultimas butacas de la fila B. Solo se usa si el plano no trae
// su propia lista de bloqueadas.
function idsBloqueadosPorBandas(sala) {
  const ids = [];
  for (const banda of hojasDe(sala.bandas)) {
    const columnas = columnasDeBanda(sala, banda).length;
    for (const [fila, cuantas] of Object.entries(banda.bloqueadasAlFinal || {})) {
      for (let n = columnas - cuantas + 1; n <= columnas; n++) {
        ids.push(banda.id + '-' + fila + n);
      }
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Mesas.
//
// Una mesa se describe con cuatro datos ademas de su posicion:
//   largo       celdas de tablero (1, 2, 3...)
//   cabeceras   si lleva un lugar en cada extremo
//   unLado      si solo tiene lugares en un lado largo (el sur, antes de girar)
//   giro        0, 90, 180 o 270 grados en sentido horario
// De ahi sale su geometria. Los estilos son el mismo modelo:
//   lados  largo 2        cruz  largo 1, cabeceras     barra  largo 4, un lado
//      N1 N2                    N1                       [    Mesa    ]
//     [ Mesa ]               C1 [4] C2                    S4 S3 S2 S1
//      S1 S2                    S1
// La huella es el rectangulo completo: las esquinas vacias quedan reservadas.
//
// Los lugares se identifican por lado, no por orden: M2-N1, M2-S2, M2-C1. Asi
// alargar solo anade lugares, girar no cambia ninguno y moverla tampoco.
// ---------------------------------------------------------------------------
const LARGO_MAXIMO = 8;
const ESTILOS = {
  lados:   { largo: 2, cabeceras: false, unLado: false },
  cruz:    { largo: 1, cabeceras: true,  unLado: false },
  barra:   { largo: 4, cabeceras: false, unLado: true },
  redonda: { tipo: 'redonda', lugares: 8 },
};

// ---------------------------------------------------------------------------
// Mesas redondas.
//
// Se describen con una sola medida: cuantos lugares tienen. El diametro del
// tablero sale de ahi, porque los lugares van en el anillo de celdas que lo
// rodea, que tiene 4 x (diametro + 1) celdas:
//   2 a 8 lugares    tablero de 1 celda, huella 3 x 3
//   9 a 12           tablero de 2,       huella 4 x 4
//   13 a 16          tablero de 3,       huella 5 x 5
// Los lugares se reparten por angulo desde arriba, en sentido horario, y cada
// uno toma la celda del anillo mas cercana a su angulo; los de las esquinas
// miran al centro en diagonal (45 grados). El id de un lugar es su posicion
// (M7-1, M7-2...), asi que girar o mover la mesa no lo cambia.
// ---------------------------------------------------------------------------
const LUGARES_MINIMOS_REDONDA = 2;
const LUGARES_MAXIMOS_REDONDA = 16;
const esMesaRedonda = (pieza) => Boolean(pieza) && pieza.tipo === 'redonda';
const esMesa = (pieza) => !pieza.tipo || esMesaRedonda(pieza);
// El diametro crece con los lugares: caben 'diametro' sillas por lado, sin usar las
// esquinas, asi que el diametro es los lugares entre cuatro, redondeando hacia arriba.
const diametroRedonda = (lugares) => Math.max(1, Math.ceil(lugares / 4));

// Cuantas sillas van en cada lado. Se reparten de cuatro en cuatro y, si sobran dos,
// van arriba y abajo: 8 lugares son dos por lado; 10, tres arriba, tres abajo y dos a
// cada costado.
function ladosDeRedonda(lugares) {
  const porLado = Math.floor(lugares / 4);
  const sobran = lugares - porLado * 4;   // 0 o 2, porque los lugares son pares
  return { arriba: porLado + (sobran ? 1 : 0), derecha: porLado,
           abajo: porLado + (sobran ? 1 : 0), izquierda: porLado };
}

// Las sillas de un lado, centradas en el: con 2 sillas en un lado de 3 celdas, quedan
// en las dos primeras.
const arranqueDeLado = (cuantas, diametro) => Math.floor((diametro - cuantas) / 2);

// Las sillas miran al centro: la de arriba hacia abajo (0), la derecha hacia la
// izquierda (90), la de abajo hacia arriba (180) y la izquierda hacia la derecha (270).
function geometriaMesaRedonda({ lugares, giro = 0 }) {
  const cuantos = lugaresValidosRedonda(lugares);
  const diametro = diametroRedonda(cuantos);
  const lado = diametro + 2;
  const { arriba, derecha, abajo, izquierda } = ladosDeRedonda(cuantos);
  const celdas = [];
  // En sentido horario: arriba de izquierda a derecha, la derecha de arriba abajo,
  // abajo de derecha a izquierda y la izquierda de abajo arriba.
  for (let i = 0; i < arriba; i++) celdas.push({ dx: 1 + arranqueDeLado(arriba, diametro) + i, dy: 0, mira: 0 });
  for (let i = 0; i < derecha; i++) celdas.push({ dx: lado - 1, dy: 1 + arranqueDeLado(derecha, diametro) + i, mira: 90 });
  for (let i = abajo - 1; i >= 0; i--) celdas.push({ dx: 1 + arranqueDeLado(abajo, diametro) + i, dy: lado - 1, mira: 180 });
  for (let i = izquierda - 1; i >= 0; i--) celdas.push({ dx: 0, dy: 1 + arranqueDeLado(izquierda, diametro) + i, mira: 270 });
  let geo = { ancho: lado, alto: lado, tablero: null,
              lugares: celdas.map((celda, i) => ({ lado: String(i + 1), ...celda })) };
  for (let g = 0; g < giro; g += 90) geo = girar90(geo);
  // El tablero redondo: centrado en la huella, con el diametro en celdas.
  return { ...geo, redonda: { dx: 1, dy: 1, diametro } };
}

// Los lugares de una mesa redonda son pares, de LUGARES_MINIMOS a LUGARES_MAXIMOS.
const lugaresValidosRedonda = (lugares) =>
  Math.min(Math.max(Math.round(lugares / 2) * 2, LUGARES_MINIMOS_REDONDA), LUGARES_MAXIMOS_REDONDA);

// Quita o pone sillas a una mesa redonda, de dos en dos ('pasos' de 1 o -1): dos
// sillas mas o dos menos. La esquina de la huella no se mueve.
function cambiarLugaresRedonda(mesa, pasos) {
  const lugares = mesa.lugares + pasos * 2;
  if (lugares < LUGARES_MINIMOS_REDONDA || lugares > LUGARES_MAXIMOS_REDONDA) return null;
  return { ...mesa, lugares };
}

const configDeRedonda = ({ id, x, y, lugares, giro }) => ({ id, tipo: 'redonda', x, y, lugares, giro });
// La configuracion guardable de cualquier mesa, redonda o rectangular.
// 'completa' solo se guarda si esta marcada: los mapas anteriores se leen como venta
// por lugares.
const configDeMesa = (mesa) => ({
  ...(esMesaRedonda(mesa) ? configDeRedonda(mesa)
    : { id: mesa.id, x: mesa.x, y: mesa.y, largo: mesa.largo, cabeceras: mesa.cabeceras,
        unLado: mesa.unLado, giro: mesa.giro }),
  ...(mesa.completa ? { completa: true } : {}),
  // Solo la zona puesta a mano se guarda: sin ella, la mesa hereda la de su banda.
  ...(mesa.zona ? { zona: mesa.zona } : {}),
});
const mesas = [];     // {id, nombre, x, y, largo, cabeceras, unLado, giro, geo}

// Geometria relativa a la esquina superior izquierda (dx, dy en celdas). Cada
// lugar lleva 'mira': cuanto girar su icono para que mire al tablero. El icono
// sin girar tiene el respaldo arriba, asi que mira hacia abajo.
function geometriaMesa({ largo, cabeceras, unLado = false, giro = 0 }) {
  const extremo = cabeceras ? 1 : 0;
  const ancho = largo + 2 * extremo;
  const alto = unLado ? 2 : 3;
  const filaTablero = unLado ? 0 : 1;
  // Primero sin girar. Los lugares van en sentido horario, que es el orden en que
  // se numeran para mostrar: norte, cabecera derecha, sur, cabecera izquierda.
  const lugares = [];
  if (!unLado) {
    for (let i = 0; i < largo; i++) lugares.push({ lado: 'N' + (i + 1), dx: extremo + i, dy: 0, mira: 0 });
  }
  if (cabeceras) lugares.push({ lado: 'C2', dx: ancho - 1, dy: filaTablero, mira: 90 });
  for (let i = largo - 1; i >= 0; i--) {
    lugares.push({ lado: 'S' + (i + 1), dx: extremo + i, dy: alto - 1, mira: 180 });
  }
  if (cabeceras) lugares.push({ lado: 'C1', dx: 0, dy: filaTablero, mira: 270 });
  let geo = { ancho, alto, tablero: { dx: extremo, dy: filaTablero, w: largo, h: 1 }, lugares };
  for (let g = 0; g < giro; g += 90) geo = girar90(geo);
  return geo;
}

// Un cuarto de vuelta en sentido horario: (dx, dy) -> (alto - 1 - dy, dx). El
// orden horario se conserva, asi que la numeracion no cambia al girar.
function girar90({ ancho, alto, tablero, lugares, redonda }) {
  return {
    ancho: alto, alto: ancho,
    ...(redonda ? { redonda } : {}),
    tablero: tablero && { dx: alto - tablero.dy - tablero.h, dy: tablero.dx, w: tablero.h, h: tablero.w },
    lugares: lugares.map((l) => ({ ...l, dx: alto - 1 - l.dy, dy: l.dx, mira: (l.mira + 90) % 360 })),
  };
}

// 'zona' es la que acaban teniendo sus lugares: la propia de la mesa si la lleva, o
// la que hereda de su banda (la resuelve generarPlano).
function agregarMesa(config, ocupadas = [], zona = zonaDeMesasActual()) {
  const { id, x, y } = config;
  const nombre = 'Mesa ' + id.slice(1);
  const geo = esMesaRedonda(config) ? geometriaMesaRedonda(config) : geometriaMesa(config);
  mesas.push({ ...config, nombre, zonaEfectiva: zona, geo });
  if (geo.redonda) {
    muebles.push({ tipo: 'mesa-redonda', mesa: id, x: x + geo.redonda.dx, y: y + geo.redonda.dy,
                   w: geo.redonda.diametro, h: geo.redonda.diametro, texto: nombre, numero: id.slice(1) });
  } else {
    muebles.push({ tipo: 'mesa', mesa: id, x: x + geo.tablero.dx, y: y + geo.tablero.dy,
                   w: geo.tablero.w, h: geo.tablero.h, texto: nombre, numero: id.slice(1) });
  }
  geo.lugares.forEach((l, i) => {
    butacas.push({
      id: id + '-' + l.lado, fila: id, numero: i + 1, x: x + l.dx, y: y + l.dy, mira: l.mira,
      zona, grupo: { id, nombre, completa: Boolean(config.completa) },
      estado: ocupadas.includes(l.lado) ? 'ocupada' : 'libre',
    });
  });
}

// ---------------------------------------------------------------------------
// Bloques de filas libres.
//
// Un bloque es un rectangulo de butacas que se coloca en cualquier hueco de la
// sala, como una mesa: 'ancho' butacas por fila, 'filas' filas, su 'zona' y su
// 'giro'. Sin girar, sus butacas miran al escenario (arriba) y la fila de delante
// es la de arriba. Girado 90 grados mira a la derecha (un lateral izquierdo);
// 270, a la izquierda (un lateral derecho).
//
// El id de cada butaca es posicion dentro del bloque: F2-1-3 es la fila 1,
// butaca 3 del bloque F2. No depende de donde este el bloque, asi que moverlo
// o girarlo no pierde la seleccion ni las bloqueadas.
// ---------------------------------------------------------------------------
const ANCHO_BLOQUE_MAXIMO = 40;
const bloquesFilas = [];   // {id, tipo: 'filas', x, y, ancho, filas, zona, giro, nombre, nombrePropio, geo}
const esBloqueFilas = (pieza) => Boolean(pieza) && pieza.tipo === 'filas';

function geometriaBloqueFilas(config) {
  const { ancho, filas, giro = 0 } = config;
  if (config.geometria) return geometriaFilasLibre(config);
  const lugares = [];
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < ancho; c++) lugares.push({ fila: f, columna: c, dx: c, dy: f, mira: MIRA_ESCENARIO });
  }
  let geo = { ancho, alto: filas, tablero: null, lugares };
  for (let g = 0; g < giro; g += 90) geo = girar90(geo);
  return geo;
}

const normalizarAngulo = (a) => ((a % 360) + 360) % 360;
const rotarPunto = (x, y, giro) => ({
  x: x * Math.cos(giro * Math.PI / 180) - y * Math.sin(giro * Math.PI / 180),
  y: x * Math.sin(giro * Math.PI / 180) + y * Math.cos(giro * Math.PI / 180),
});

// Las correcciones viven en coordenadas de fila: viajan y giran con ella.
function geometriaFilasLibre(config) {
  const { ancho, filas, giro = 0, geometria: g } = config;
  const lugares = [];
  for (let f = 0; f < filas; f++) for (let c = 0; c < ancho; c++) {
    let x = c * g.separacion, y = f * g.separacionFilas, mira = 0;
    if (g.tipo === 'arco') {
      const a = (ancho === 1 ? 0 : -g.apertura / 2 + c * g.apertura / (ancho - 1)) * Math.PI / 180;
      const r = g.radio + f * g.separacionFilas;
      x = r * Math.sin(a); y = r * Math.cos(a) - g.radio;
      mira = -a * 180 / Math.PI;
    }
    const ajuste = config.ajustes?.[(f + 1) + '-' + (c + 1)];
    x += ajuste?.dx || 0; y += ajuste?.dy || 0;
    const p = rotarPunto(x, y, giro);
    lugares.push({ fila: f, columna: c, dx: p.x, dy: p.y,
      mira: normalizarAngulo(MIRA_ESCENARIO + (g.orientacion === 'manual' ? g.anguloButacas : mira) + giro + (ajuste?.giro || 0)) });
  }
  const minX = Math.min(...lugares.map((l) => l.dx));
  const minY = Math.min(...lugares.map((l) => l.dy));
  for (const l of lugares) { l.dx -= minX; l.dy -= minY; }
  return { ancho: Math.max(...lugares.map((l) => l.dx)) + 1,
    alto: Math.max(...lugares.map((l) => l.dy)) + 1, tablero: null, lugares, libre: true };
}

const geometriaInicial = () => ({ tipo: 'recta', separacion: 1.5, separacionFilas: 1.5,
  radio: 8, apertura: 90, orientacion: 'fila', anguloButacas: 0 });

function cambiarGeometriaBloque(plano, sala, id, valores) {
  const bloque = plano.bloquesFilas.find((p) => p.id === id);
  if (!bloque) return { motivo: 'elige un bloque de filas' };
  const geometria = { ...geometriaInicial(), ...bloque.geometria, ...valores.geometria };
  const nuevo = { ...bloque, geometria, giro: normalizarAngulo(valores.giro ?? bloque.giro ?? 0),
    x: valores.x ?? bloque.x, y: valores.y ?? bloque.y };
  const motivo = motivoGeometria(nuevo) || motivoNoCabe(sala, celdasOcupadas(id), nuevo);
  if (motivo) return { motivo };
  const copia = copiarPlano(plano);
  copia.bloquesFilas = copia.bloquesFilas.map((p) => p.id === id ? nuevo : p);
  return copia;
}

function ajustarLugar(plano, sala, id, valores) {
  const b = butacas.find((p) => p.id === id && p.nivel === sala.nivel);
  if (!b?.bloque) return { motivo: 'elige una butaca de un bloque libre' };
  const bloque = plano.bloquesFilas.find((p) => p.id === b.bloque);
  if (!bloque?.geometria) return { motivo: 'activa primero la geometría libre del bloque' };
  if (![valores.dx, valores.dy, valores.giro].every((v) => Number.isFinite(v) && Math.abs(v) <= 360)) return { motivo: 'ajustes fuera de rango' };
  const ajustes = JSON.parse(JSON.stringify(bloque.ajustes || {}));
  ajustes[(b.filaLocal + 1) + '-' + b.numeroLocal] = { id, ...valores };
  const nuevo = { ...bloque, ajustes };
  const motivo = motivoNoCabe(sala, celdasOcupadas(b.bloque), nuevo);
  if (motivo) return { motivo };
  const copia = copiarPlano(plano);
  copia.bloquesFilas = copia.bloquesFilas.map((p) => p.id === b.bloque ? nuevo : p);
  return copia;
}

function motivoGeometria(p) {
  const g = p.geometria;
  if (!g || !['recta', 'arco'].includes(g.tipo) || !['fila', 'escenario', 'manual'].includes(g.orientacion) ||
      ![p.giro, p.x, p.y, g.separacion, g.separacionFilas, g.radio, g.apertura, g.anguloButacas].every(Number.isFinite) ||
      p.giro < 0 || p.giro >= 360 || g.separacion < 1 || g.separacion > 10 ||
      g.separacionFilas < 1 || g.separacionFilas > 10 || g.radio < 1 || g.radio > 300 ||
      g.apertura < 1 || g.apertura > 330 || Math.abs(g.anguloButacas) > 360) return 'geometría de filas inválida';
  return null;
}

// En una curva la siguiente butaca puede estar a la izquierda en coordenadas.
function vecinoDeLugar(lista, origen, dx, dy) {
  const visibles = lista.filter((b) => b.id !== origen.id && b.nivel === origen.nivel);
  if (origen.libre) {
    const local = visibles.find((b) => b.bloque === origen.bloque && b.filaLocal === origen.filaLocal + dy && b.numeroLocal === origen.numeroLocal + dx);
    if (local) return local;
  }
  const candidatas = visibles.filter((b) => dx ? Math.sign(b.x - origen.x) === dx &&
    (origen.libre || b.libre || Math.abs(b.y - origen.y) < .001) : Math.sign(b.y - origen.y) === dy);
  return candidatas.reduce((mejor, b) => {
    const d = Math.abs(b.x - origen.x) + Math.abs(b.y - origen.y) * 1.5;
    return d < mejor.d ? { b, d } : mejor;
  }, { b:null, d:Infinity }).b;
}

// La huella de cualquier pieza: mesa, bloque de filas, forma, butaca suelta o escenario.
const huellaDe = (pieza) => (esEscenario(pieza) || esForma(pieza)
  ? { ancho: pieza.ancho, alto: pieza.alto, tablero: null, lugares: [] }
  : esButacaSuelta(pieza)
  ? { ancho: 1, alto: 1, tablero: null, lugares: [{ dx: 0, dy: 0, mira: (MIRA_ESCENARIO + (pieza.giro || 0)) % 360 }] }
  : esBloqueFilas(pieza) ? geometriaBloqueFilas(pieza)
  : esMesaRedonda(pieza) ? geometriaMesaRedonda(pieza) : geometriaMesa(pieza));

// ---------------------------------------------------------------------------
// Formas: pista de baile y barra.
//
// Rectangulos con nombre que ocupan sus celdas (nada se les pone encima) y no
// tienen lugares: { id: 'P1', tipo: 'forma', forma, x, y, ancho, alto, nombre? }.
// Se mueven, giran (intercambian ancho y alto), cambian de tamaño y se duplican.
// Pueden cruzar pasillos.
// ---------------------------------------------------------------------------
const FORMAS = {
  pista: { nombre: 'Pista de baile', ancho: 4, alto: 4 },
  barra: { nombre: 'Barra', ancho: 4, alto: 1 },
};
const FORMA_ANCHO_MAXIMO = 40;
const FORMA_ALTO_MAXIMO = 20;
const formas = [];   // {id, tipo: 'forma', forma, x, y, ancho, alto, nombre, nombrePropio, geo}
const esForma = (pieza) => Boolean(pieza) && pieza.tipo === 'forma';
const esFormaConocida = (forma) => Object.prototype.hasOwnProperty.call(FORMAS, forma);

function agregarForma(config) {
  const nombre = config.nombre || FORMAS[config.forma].nombre + ' ' + config.id.slice(1);
  formas.push({ ...config, nombre, nombrePropio: config.nombre || null, geo: huellaDe(config) });
  muebles.push({ tipo: 'forma', forma: config.forma, pieza: config.id, x: config.x, y: config.y,
                 w: config.ancho, h: config.alto, texto: nombre });
}

function cambiarTamanoForma(f, dAncho, dAlto) {
  const ancho = f.ancho + dAncho, alto = f.alto + dAlto;
  if (ancho < 1 || ancho > FORMA_ANCHO_MAXIMO || alto < 1 || alto > FORMA_ALTO_MAXIMO) return null;
  return { ...f, ancho, alto };
}

const configDeForma = ({ id, forma, x, y, ancho, alto, nombrePropio }) =>
  ({ id, tipo: 'forma', forma, x, y, ancho, alto, ...(nombrePropio ? { nombre: nombrePropio } : {}) });

// ---------------------------------------------------------------------------
// Butacas sueltas.
//
// Una sola butaca que se coloca en cualquier hueco: { id: 'B1', tipo: 'butaca', x,
// y, zona, giro }. Su id de butaca es el de la pieza (B1). Se numera con las demas
// butacas de su zona, por altura y de izquierda a derecha, mire hacia donde mire.
// ---------------------------------------------------------------------------
const butacasSueltas = [];   // {id, tipo: 'butaca', x, y, zona, giro, nombre, geo}
const esButacaSuelta = (pieza) => Boolean(pieza) && pieza.tipo === 'butaca';

function agregarButacaSuelta(config, zona = config.zona) {
  const geo = huellaDe(config);
  butacasSueltas.push({ ...config, nombre: 'Butaca suelta ' + config.id.slice(1), zonaEfectiva: zona, geo });
  butacas.push({ id: config.id, fila: 'A', numero: 1, suelta: config.id, x: config.x, y: config.y,
                 mira: geo.lugares[0].mira, zona, grupo: null, estado: 'libre' });
}

const configDeButaca = ({ id, x, y, zona, giro }) => ({ id, tipo: 'butaca', x, y, giro, ...(zona ? { zona } : {}) });

function agregarBloqueFilas(config, zona = config.zona) {
  const geo = geometriaBloqueFilas(config);
  const nombre = config.nombre || 'Bloque ' + config.id.slice(1);
  bloquesFilas.push({ ...config, nombre, nombrePropio: config.nombre || null, zonaEfectiva: zona, geo });
  for (const l of geo.lugares) {
    butacas.push({
      id: config.id + '-' + (l.fila + 1) + '-' + (l.columna + 1),
      fila: LETRAS[l.fila], numero: l.columna + 1, seccion: nombre,
      bloque: config.id, filaLocal: l.fila, numeroLocal: l.columna + 1,
      x: config.x + l.dx, y: config.y + l.dy, mira: l.mira, libre: Boolean(config.geometria),
      zona, grupo: null, estado: 'libre',
    });
  }
}

// ---------------------------------------------------------------------------
// El escenario.
//
// Es una pieza: { x, y, ancho, alto } en celdas, que se mueve y cambia de tamaño
// como una mesa. Por defecto ocupa la franja de la banda «escenario» a todo el
// ancho de la sala. Las filas miran hacia el y la numeracion se mide desde el.
// ---------------------------------------------------------------------------
// Un escenario tiene que poder cruzar la sala entera, asi que va con ANCHO_MAXIMO.
const ESCENARIO_ANCHO_MAXIMO = ANCHO_MAXIMO;
const ESCENARIO_ALTO_MAXIMO = 10;
// Es opcional: un plano con 'escenario: null' no lo tiene ('ausente'). Sin escenario,
// su centro queda infinitamente arriba: las filas miran hacia arriba, la fila A es
// la de mas arriba de cada zona y los bloques nuevos no se giran.
const escenario = { id: 'escenario', tipo: 'escenario', nombre: 'Escenario', x: 1, y: 0, ancho: 1, alto: 2, ausente: false };
const esEscenario = (pieza) => Boolean(pieza) && pieza.tipo === 'escenario';
const centroDelEscenario = () => (escenario.ausente ? { x: 0, y: -Infinity }
  : { x: escenario.x + escenario.ancho / 2, y: escenario.y + escenario.alto / 2 });

// Hacia donde miran las butacas de una fila en la altura y: arriba si el escenario
// esta por encima (o a su altura), abajo si esta por debajo.
const miraHaciaEscenario = (y) => (centroDelEscenario().y > y + 1 ? MIRA_ABAJO : MIRA_ESCENARIO);

// Si una butaca mira al escenario de frente: su giro es vertical y apunta hacia el.
// Las que miran de lado (90 o 270) o de espaldas forman filas fisicas
// independientes, pero toman letras de la misma secuencia de su zona.
function miraDeFrente(butaca) {
  const centro = centroDelEscenario().y;
  if (butaca.mira === MIRA_ESCENARIO) return centro <= butaca.y + 0.5;
  if (butaca.mira === MIRA_ABAJO) return centro > butaca.y + 0.5;
  return false;
}

// Giro con el que un bloque nuevo en (x, y) mira hacia el escenario.
function giroHaciaEscenario(x, y) {
  const c = centroDelEscenario();
  const dx = c.x - x, dy = c.y - y;
  if (Math.abs(dy) >= Math.abs(dx)) return dy <= 0 ? 0 : 180;
  return dx > 0 ? 90 : 270;
}

// Gira el escenario 90 grados sobre su centro: intercambia ancho y alto. Con el
// mismo redondeo que las mesas, girar dos veces lo deja donde estaba.
function girarEscenario(e) {
  const despues = { ...e, ancho: e.alto, alto: e.ancho };
  const redondear = despues.alto > despues.ancho ? Math.floor : Math.ceil;
  return {
    ...despues,
    x: redondear(e.x + (e.ancho - despues.ancho) / 2),
    y: redondear(e.y + (e.alto - despues.alto) / 2),
  };
}

// Cambia el ancho o el alto del escenario desde su esquina superior izquierda.
function cambiarTamanoEscenario(e, dAncho, dAlto) {
  const ancho = e.ancho + dAncho, alto = e.alto + dAlto;
  if (ancho < 1 || ancho > ESCENARIO_ANCHO_MAXIMO || alto < 1 || alto > ESCENARIO_ALTO_MAXIMO) return null;
  return { ...e, ancho, alto };
}

// Letra de la fila n (0 = A). Despues de la Z siguen AA, AB... ZZ, AAA: como las
// columnas de una hoja de calculo, sin limite de filas.
function letraDeFila(n) {
  let letras = '';
  for (let k = n + 1; k > 0; k = Math.floor((k - 1) / LETRAS.length)) letras = LETRAS[(k - 1) % LETRAS.length] + letras;
  return letras;
}

// La etiqueta visible de las butacas de fila, como en un teatro:
// - Las que miran al escenario de frente (las bandas siempre; los bloques cuyo giro
//   apunta hacia el) se numeran por zona. En cada zona, la fila mas cercana al
//   escenario es la A; todas las butacas de esa zona a esa altura, de cualquier
//   banda o bloque, se numeran de izquierda a derecha: A1-A5 y A6-A7.
// - Las de un bloque que no mira al escenario de frente (girado de lado o de
//   espaldas) forman filas fisicas distintas y toman letra de la zona.
function numerarFilas() {
  const porZona = new Map();
  const centro = centroDelEscenario().y;
  for (const b of butacas) {
    if (b.grupo) continue;
    if (!porZona.has(b.zona)) porZona.set(b.zona, new Map());
    // Las filas laterales o de espaldas no comparten letra con una fila horizontal
    // que pasa por la misma altura. El id del bloque solo separa sus filas fisicas.
    const clave = b.bloque && (b.libre || !miraDeFrente(b)) ? b.bloque + ':' + b.filaLocal : 'y:' + b.y;
    const filas = porZona.get(b.zona);
    if (!filas.has(clave)) filas.set(clave, []);
    filas.get(clave).push(b);
  }
  for (const [zona, filas] of porZona) {
    const distancia = (y) => centro === -Infinity ? y : Math.abs(y + 0.5 - centro);
    const grupos = [...filas.values()].map((lista) => ({
      lista,
      primera: lista.reduce((b, actual) => actual.y < b.y ||
        (actual.y === b.y && actual.x < b.x) ? actual : b),
    })).sort((a, c) => distancia(a.primera.y) - distancia(c.primera.y) ||
      a.primera.y - c.primera.y || a.primera.x - c.primera.x ||
      a.primera.id.localeCompare(c.primera.id));
    grupos.forEach(({ lista }, i) => {
      lista.sort((a, c) => a.bloque && !miraDeFrente(a) ? a.numeroLocal - c.numeroLocal
        : a.x - c.x || a.id.localeCompare(c.id));
      lista.forEach((b, k) => Object.assign(b, {
        fila: letraDeFila(i), numero: k + 1, seccion: zonas[zona].nombre,
      }));
    });
  }
  // Los rotulos de las bandas muestran la letra de su zona: la de la primera butaca de
  // cada (banda, fila local), indexada una vez. Map anidado y no clave de texto, para
  // no confundir una butaca sin banda (undefined) con una banda llamada «undefined».
  const primeraDeFila = new Map();
  for (const b of butacas) {
    if (!primeraDeFila.has(b.banda)) primeraDeFila.set(b.banda, new Map());
    const filas = primeraDeFila.get(b.banda);
    if (!filas.has(b.filaLocal)) filas.set(b.filaLocal, b);
  }
  for (const m of muebles) {
    if (m.tipo !== 'rotulo') continue;
    const butaca = primeraDeFila.get(m.banda)?.get(m.filaLocal);
    if (butaca) m.texto = butaca.fila;
  }
}

// El numero visible de mesa depende de su zona y posicion; M... sigue siendo el id.
function numerarMesas() {
  const porZona = new Map();
  const lugares = new Map();
  const tablero = new Map(muebles.filter((m) => m.mesa).map((m) => [m.mesa, m]));
  for (const b of butacas) if (b.grupo) {
    if (!lugares.has(b.grupo.id)) lugares.set(b.grupo.id, []);
    lugares.get(b.grupo.id).push(b);
  }
  for (const mesa of mesas) {
    if (!porZona.has(mesa.zonaEfectiva)) porZona.set(mesa.zonaEfectiva, []);
    porZona.get(mesa.zonaEfectiva).push(mesa);
  }
  for (const lista of porZona.values()) {
    lista.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id, 'es', { numeric: true }));
    lista.forEach((mesa, i) => {
      mesa.numeroVisible = i + 1;
      mesa.nombre = 'Mesa ' + mesa.numeroVisible;
      const mueble = tablero.get(mesa.id);
      if (mueble) {
        mueble.texto = mesa.nombre;
        mueble.numero = String(mesa.numeroVisible);
      }
      for (const b of lugares.get(mesa.id) || []) {
        b.grupo.nombre = mesa.nombre;
        b.numeroMesa = mesa.numeroVisible;
      }
    });
  }
}

// Posicion automatica: en cada banda de mesas, 'filasDeMesas' filas de tres mesas
// de estilo «lados», cada cuatro filas de rejilla empezando en la tercera. Los ids
// siguen el orden de lectura: M1, M2, M3 en la primera fila, M4... en la segunda.
function mesasAutomaticas(sala) {
  const lista = [];
  const base = { ...ESTILOS.lados, giro: 0 };
  for (const banda of hojasDe(sala.bandas)) {
    if (banda.tipo !== 'mesas') continue;
    const desde = banda.x || 1, hasta = desde + (banda.anchoOcupado || sala.ancho);
    const bloques = sala.bloques.map((b) => b.filter((c) => c >= desde && c < hasta)).filter((b) => b.length);
    const arranques = repartirMesas({ bloques }, 3);
    for (let k = 0; k < (banda.filasDeMesas || 0); k++) {
      const y = banda.y + 2 + 4 * k;
      if (y + geometriaMesa(base).alto > banda.y + banda.alto) break;
      for (const x of arranques) lista.push({ id: 'M' + (lista.length + 1), x, y, ...base });
    }
  }
  return lista;
}

// El nombre de cada banda como subtitulo del plano, sin pisar butacas:
// - Las de la sala (filas, mesas, franjas), en el margen izquierdo, a la altura de
//   su primera fila. 'x' y 'w' reservan su ancho aproximado para el encuadre.
// - Las verticales y las bandas de dentro, en su borde superior. La primera banda
//   de una vertical empieza en el mismo borde: comparten subtitulo («Vertical 1 ·
//   General 2»), que al editarse lleva a la banda.
const ANCHO_LETRA_SUBTITULO = 2.2;   // unidades del viewBox por caracter, aproximado
function agregarSubtitulos(bandas) {
  for (const banda of bandas) {
    if (banda.tipo === 'escenario') continue;
    const w = Math.ceil((banda.nombre.length * ANCHO_LETRA_SUBTITULO + 3) / PASO);
    muebles.push({ tipo: 'subtitulo', lugar: 'margen', banda: banda.id, texto: banda.nombre, x: -w, y: banda.y, w, h: 1 });
    for (const v of banda.verticales || []) {
      const [primera, ...resto] = v.bandas;
      muebles.push({ tipo: 'subtitulo', lugar: 'borde', banda: primera ? primera.id : v.id, vertical: v.id,
                     texto: v.nombre + (primera ? ' · ' + primera.nombre : ''), x: v.x, y: v.y });
      for (const b of resto) {
        muebles.push({ tipo: 'subtitulo', lugar: 'borde', banda: b.id, texto: b.nombre, x: b.x, y: b.y });
      }
    }
  }
}

// 'tipo' es la clave de TIPOS_DE_SALA o directamente una definicion. 'plano' es
// lo que guarda el editor para ese tipo: { bandas, mesas, bloquesFilas, bloqueadas,
// distribucion, siguiente, siguienteBanda, siguienteBloque }. Sin plano, se usan las bandas del tipo y sus mesas (las
// guardadas si es un mapa, las automaticas si es una plantilla).
const CAMPOS_DE_NIVEL = ['distribucion', 'bandas', 'mesas', 'bloquesFilas', 'formas', 'butacasSueltas', 'escenario', 'lienzo', 'regionesLibres'];
const copiarDatos = (dato) => JSON.parse(JSON.stringify(dato));
const geometriaDeNivel = (plano) => copiarDatos(Object.fromEntries(CAMPOS_DE_NIVEL.filter((k) => plano[k] !== undefined).map((k) => [k, plano[k]])));
const nivelesDe = (plano) => plano.niveles || [{ id: 'n1', nombre: 'Planta baja' }];
let nivelGenerado = 'n1';
const butacasVisibles = () => butacas.filter((b) => !b.nivel || b.nivel === nivelGenerado);

// La vista no cambia el documento: al guardar se vuelve siempre al primer nivel.
function cambiarNivelPlano(plano, id) {
  const niveles = copiarDatos(nivelesDe(plano));
  if (!niveles.some((n) => n.id === id)) return { motivo: 'nivel desconocido' };
  const actual = plano.nivelEnEdicion || niveles[0].id;
  if (actual === id) return { ...copiarPlano(plano), niveles, nivelEnEdicion: id };
  niveles.find((n) => n.id === actual).plano = geometriaDeNivel(plano);
  const destino = niveles.find((n) => n.id === id);
  const nuevo = copiarPlano(plano);
  for (const k of CAMPOS_DE_NIVEL) delete nuevo[k];
  Object.assign(nuevo, destino.plano);
  delete destino.plano;
  return { ...nuevo, niveles, nivelEnEdicion: id };
}

function agregarNivel(plano, nombre) {
  const niveles = nivelesDe(plano);
  if (niveles.length >= 12 || typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 40) return { motivo: 'nombre de nivel inválido o límite de 12 niveles' };
  if (niveles.some((n) => n.nombre.toLocaleUpperCase('es') === nombre.trim().toLocaleUpperCase('es'))) return { motivo: 'ese nombre de nivel ya existe' };
  const nuevo = copiarPlano(plano);
  nuevo.niveles = copiarDatos(niveles);
  const id = 'n' + (nuevo.siguienteNivel || 2);
  nuevo.siguienteNivel = (nuevo.siguienteNivel || 2) + 1;
  const banda = 'banda' + nuevo.siguienteBanda++;
  nuevo.niveles.push({ id, nombre: nombre.trim(), plano: { lienzo: true, distribucion: { bloques: [30], pasillos: [] },
    bandas: [{ id: banda, tipo: 'espacio', alto: 30 }], mesas: [], bloquesFilas: [], formas: [], butacasSueltas: [], escenario: null, regionesLibres: [] } });
  return cambiarNivelPlano(nuevo, id);
}

function renombrarNivel(plano, id, nombre) {
  if (!nivelesDe(plano).some((n) => n.id === id)) return { motivo: 'nivel desconocido' };
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 40 || nivelesDe(plano).some((n) => n.id !== id && n.nombre.toLocaleUpperCase('es') === nombre.trim().toLocaleUpperCase('es'))) return { motivo: 'nombre de nivel inválido o repetido' };
  const nuevo = copiarPlano(plano);
  nuevo.niveles = copiarDatos(nivelesDe(plano)).map((n) => n.id === id ? { ...n, nombre: nombre.trim() } : n);
  return nuevo;
}
function mostrarButacasNumeradas(plano, id, mostrar) {
  if (typeof mostrar !== 'boolean' || !nivelesDe(plano).some((n) => n.id === id)) return { motivo: 'nivel u opción inválidos' };
  if (plano.revisionFisica?.estado === 'publicada') return { motivo: 'Crea un borrador antes de cambiar la presentación del nivel.' };
  const nuevo = copiarPlano(plano);
  nuevo.niveles = copiarDatos(nivelesDe(plano));
  const nivel = nuevo.niveles.find((n) => n.id === id);
  if (nivel.butacasNumeradas) nivel.siluetaAmplia = true;
  if (mostrar) nivel.butacasNumeradas = true;
  else delete nivel.butacasNumeradas;
  return nuevo;
}
function mostrarSiluetaAmplia(plano, id, mostrar) {
  if (typeof mostrar !== 'boolean' || !nivelesDe(plano).some(n => n.id === id)) return { motivo: 'nivel u opción inválidos' };
  if (plano.revisionFisica?.estado === 'publicada') return { motivo: 'Crea un borrador antes de cambiar la presentación del nivel.' };
  const nuevo = copiarPlano(plano);
  nuevo.niveles = copiarDatos(nivelesDe(plano));
  const nivel = nuevo.niveles.find(n => n.id === id);
  if (mostrar) nivel.siluetaAmplia = true;
  else { delete nivel.siluetaAmplia; delete nivel.butacasNumeradas; }
  return nuevo;
}
function eliminarNivel(plano, id) {
  const niveles = nivelesDe(plano);
  if (!niveles.some((n) => n.id === id)) return { motivo: 'nivel desconocido' };
  if (niveles.length === 1) return { motivo: 'el recinto necesita al menos un nivel' };
  const otro = niveles.find((n) => n.id !== id);
  const nuevo = cambiarNivelPlano(plano, otro.id);
  nuevo.niveles = nuevo.niveles.filter((n) => n.id !== id);
  for (const t of Object.values(TIPOS_FISICOS)) {
    nuevo.entidadesRetiradas.push(...nuevo[t.lista].filter((e) => e.nivel === id).map((e) => e.id));
    nuevo[t.lista] = nuevo[t.lista].filter((e) => e.nivel !== id);
  }
  return nuevo;
}

function generarPlano(tipo, plano = null) {
  const definicion = typeof tipo === 'string' ? TIPOS_DE_SALA[tipo] : tipo;
  const dato = plano || definicion;
  const niveles = nivelesDe(dato);
  const activo = dato.nivelEnEdicion || niveles[0].id;
  const lista = [];
  let sala;
  for (const n of [...niveles.filter((n) => n.id !== activo), niveles.find((n) => n.id === activo)]) {
    const local = n.id === activo ? dato : { ...dato, ...n.plano };
    nivelGenerado = n.id;
    sala = generarPlanoNivel(definicion, n.id === activo && !plano ? null : local);
    sala.nivel = n.id;
    sala.niveles = niveles.map(({ id, nombre }) => ({ id, nombre }));
    for (const b of butacas) { b.nivel = n.id; b.nombreNivel = n.nombre; b.butacaNumerada = n.butacasNumeradas === true; b.siluetaAmplia = n.siluetaAmplia === true || b.butacaNumerada; }
    if (niveles.length > 1 || bloquesFilas.some((p) => p.geometria)) {
      const fallo = primeraPiezaQueNoCabe(sala);
      if (fallo) sala.errorDeGeometria = fallo;
    }
    lista.push(...butacas);
  }
  butacas.length = 0; butacas.push(...lista);
  aplicarEstructuraFisica(dato);
  nivelGenerado = activo;
  sala.datosNiveles = { niveles: copiarDatos(niveles), nivelEnEdicion: activo,
    siguienteNivel: dato.siguienteNivel || 2, siguienteRegion: dato.siguienteRegion || 1,
    regionesLibres: copiarDatos(dato.regionesLibres || []) };
  sala.registroFisico = { ...(sala.registroFisico || {}), ...estructuraFisicaDe(dato) };
  return sala;
}

function generarPlanoNivel(tipo, plano = null) {
  const definicion = typeof tipo === 'string' ? TIPOS_DE_SALA[tipo] : tipo;
  if (!definicion) throw new Error('Tipo de sala desconocido: ' + tipo);
  butacas.length = 0;
  muebles.length = 0;
  mesas.length = 0;
  bloquesFilas.length = 0;
  formas.length = 0;
  butacasSueltas.length = 0;
  // Columnas: la distribucion editada, la de un mapa guardado o la de la plantilla.
  const sala = rejillaDeBloques((plano && plano.distribucion) || definicion.distribucion ||
                                distribucionDePasillos(definicion.pasillos));

  // Zonas: las del plano, las del mapa o las de siempre. Antes de disponer las bandas,
  // que toman de ellas su nombre por defecto.
  const listaDeZonas = (plano && plano.zonas) || definicion.zonas || ZONAS_POR_DEFECTO;
  usarZonas(listaDeZonas);

  // Las bandas se apilan: cada una empieza donde acaba la anterior. Las que no
  // traen nombre toman el de su zona, numerado si se repite: General, General 2.
  // Una franja dividida reparte su ancho en bandas verticales (ver disponerBandas).
  const disposicion = disponerBandas((plano && plano.bandas) || definicion.bandas, sala.ancho);
  sala.bandas = disposicion.colocadas;
  sala.regiones = disposicion.regiones;
  sala.alto = disposicion.alto;
  sala.errorDeBandas = disposicion.error;
  for (const banda of hojasDe(sala.bandas)) {
    if (banda.tipo === 'filas') agregarFilas(banda, columnasDeBanda(sala, banda), sala.ancho);
    if (banda.tipo === 'espacio' && banda.guias) agregarGuias(banda, sala.ancho);
  }
  sala.lienzo = Boolean((plano && plano.lienzo) || definicion.lienzo);
  agregarSubtitulos(sala.bandas);
  const y = sala.alto;

  // El escenario: el del plano o el del mapa; si no dicen nada, la franja de la
  // banda «escenario» a todo el ancho de la sala. 'null' es que no hay escenario.
  const franja = sala.bandas.find((b) => b.tipo === 'escenario');
  const configEscenario = plano && plano.escenario !== undefined ? plano.escenario : definicion.escenario;
  Object.assign(escenario, { x: 1, y: franja ? franja.y : 0, ancho: sala.ancho, alto: franja ? franja.alto : 2 },
                configEscenario || {}, { ausente: configEscenario === null });
  sala.escenarioPorDefecto = configEscenario === undefined;
  // Se dibuja con algo de aire abajo: con 2 celdas de alto, 1,2 de rectangulo.
  if (!escenario.ausente) {
    muebles.push({ tipo: 'escenario', x: escenario.x, y: escenario.y, w: escenario.ancho,
                   h: Math.max(0.8, escenario.alto - 0.8) });
  }
  escenario.geo = huellaDe(escenario);
  // Las filas de las bandas miran hacia donde este el escenario.
  for (const b of butacas) if (b.banda) b.mira = miraHaciaEscenario(b.y);

  // La zona fisica de una pieza: la propia si la lleva, la de la banda que la
  // contiene, o la de las filas como ultimo recurso (una pieza fuera de toda zona; el
  // editor obliga a elegirle una, ver zonasObligatorias).
  const respaldo = zonaParaFilas(listaDeZonas);
  const zonaDePieza = (config) => (zonas[config.zona] && config.zona) ||
    (plano?.regionesLibres || []).find((r) => r.id === config.region)?.zona ||
    zonaEnCelda(sala, config.x, config.y) || respaldo;

  const ocupadasDeMesas = definicion.mesasOcupadas || {};
  for (const config of plano ? plano.mesas : definicion.mesas || mesasAutomaticas(sala)) {
    agregarMesa(config, ocupadasDeMesas[config.id], zonaDePieza(config));
  }
  for (const config of (plano && plano.bloquesFilas) || definicion.bloquesFilas || []) {
    agregarBloqueFilas(config, zonaDePieza(config));
  }
  const porBloque = new Map(bloquesFilas.map((p) => [p.id, p]));
  for (const b of butacas) if (b.bloque) {
    const p = porBloque.get(b.bloque);
    if (p.geometria?.orientacion === 'escenario' && !escenario.ausente) {
      const centro = centroDelEscenario();
      const ajuste = p.ajustes?.[(b.filaLocal + 1) + '-' + b.numeroLocal];
      b.mira = normalizarAngulo(MIRA_ESCENARIO + Math.atan2(centro.x - b.x - .5, b.y + .5 - centro.y) * 180 / Math.PI + (ajuste?.giro || 0));
    }
  }
  for (const config of (plano && plano.formas) || definicion.formas || []) agregarForma(config);
  for (const config of (plano && plano.butacasSueltas) || definicion.butacasSueltas || []) {
    agregarButacaSuelta(config, zonaDePieza(config));
  }

  // Identidad fisica resuelta, antes de aplicar estados por ID.
  for (const b of butacas) b.zonaOriginal = b.zona;
  aplicarIdentidadFisica(plano || definicion);
  // Bloqueadas: la lista del plano o del mapa manda; si no hay, las de las bandas.
  const bloqueadas = new Set((plano && plano.bloqueadas) || definicion.bloqueadas ||
                             idsBloqueadosPorBandas(sala));
  for (const b of butacas) if (bloqueadas.has(b.id)) b.estado = 'bloqueada';
  const lugaresPorMesa = agruparLugaresPorGrupo(butacas);
  for (const mesa of mesas.filter((m) => m.completa)) {
    const lugares = lugaresPorMesa.get(mesa.id) || [];
    if (lugares.some((b) => b.estado === 'ocupada')) {
      for (const b of lugares) if (b.estado === 'libre') b.estado = 'ocupada';
    }
  }
  // La zona pintada determina ubicacion fisica y numeracion visible. El precio
  // sigue siendo solo una referencia de previsualizacion hasta integrar tarifas.
  const zonasDeAsiento = (plano && plano.zonasDeAsiento) || definicion.zonasDeAsiento || {};
  for (const b of butacas) {
    const zona = zonasDeAsiento[b.id];
    if ((plano || definicion).identidadFisica?.[b.claveDiseno] || !zona || !zonas[zona] || zona === b.zona) continue;
    b.zona = zona;
  }
  numerarFilas();
  numerarMesas();
  aplicarNumeracionOficial(plano || definicion);
  const fisico = plano || definicion;
  if (fisico.identidadFisica) sala.registroFisico = {
    identidadFisica: fisico.identidadFisica, idsRetirados: fisico.idsRetirados || [],
    zonasDeAsiento: fisico.zonasDeAsiento || {}, zonasFisicasConfirmadas: fisico.zonasFisicasConfirmadas || {},
    siguienteLugar: fisico.siguienteLugar, modoNumeracion: fisico.modoNumeracion, revisionFisica: fisico.revisionFisica,
  };

  // Filas de la rejilla donde puede haber piezas: toda la sala. El escenario
  // ocupa sus celdas, asi que nada se le pone encima.
  sala.filas = { min: 0, max: y - 1 };
  return sala;
}

// ---------------------------------------------------------------------------
// Editor: colocar mesas en la rejilla.
//
// La sala se trata como una tabla de celdas. Cada celda esta libre o la ocupa
// algo: una butaca de fila, una mesa (todo su rectangulo) o un pasillo. Una
// mesa cabe en (x, y) si todas las celdas de su huella estan dentro de la sala
// y libres. Las operaciones devuelven una configuracion nueva; no tocan la actual.
// ---------------------------------------------------------------------------
const celda = (x, y) => x + ',' + y;

// Celda -> quien la ocupa, en palabras para el aviso. 'excluir' es la pieza (mesa
// o bloque) que se esta editando: sus propias celdas no le estorban.
// 'excluir' es el id de la pieza que se esta editando o, al mover varias a la vez, un
// Set con todas: las celdas del grupo no se estorban entre ellas porque viajan juntas.
const excluida = (excluir, id) => (excluir instanceof Set ? excluir.has(id) : id === excluir);

function celdasOcupadas(excluir) {
  const ocupadas = new Map();
  for (const b of butacasVisibles()) {
    if ((b.grupo && b.grupo.tipo !== 'palco') || (b.bloque && excluida(excluir, b.bloque)) || (b.suelta && excluida(excluir, b.suelta))) continue;
    ocuparRectangulo(ocupadas, { x: b.x, y: b.y, ancho: 1, alto: 1 }, (b.suelta ? 'la butaca ' + b.fila + b.numero : 'la fila ' + b.fila) + ' de ' + b.seccion);
  }
  for (const m of mesas) {
    if (excluida(excluir, m.id)) continue;
    ocuparRectangulo(ocupadas, { x: m.x, y: m.y, ancho: m.geo.ancho, alto: m.geo.alto }, m.nombre);
  }
  for (const f of formas) {
    if (excluida(excluir, f.id)) continue;
    ocuparRectangulo(ocupadas, f, f.nombre);
  }
  if (!excluida(excluir, 'escenario') && !escenario.ausente) {
    ocuparRectangulo(ocupadas, escenario, 'el escenario');
  }
  return ocupadas;
}

const solapanRectangulos = (a, b) => a.x < b.x + b.ancho - 1e-7 && a.x + a.ancho > b.x + 1e-7 &&
  a.y < b.y + b.alto - 1e-7 && a.y + a.alto > b.y + 1e-7;
function celdasDeRectangulo(r) {
  const claves = [];
  for (let y = Math.floor(r.y + 1e-7); y < Math.ceil(r.y + r.alto - 1e-7); y++) {
    for (let x = Math.floor(r.x + 1e-7); x < Math.ceil(r.x + r.ancho - 1e-7); x++) claves.push(celda(x, y));
  }
  return claves;
}
function ocuparRectangulo(ocupadas, r, nombre) {
  if (!ocupadas.huellas) ocupadas.huellas = new Map();
  for (const clave of celdasDeRectangulo(r)) {
    ocupadas.set(clave, nombre);
    if (!ocupadas.huellas.has(clave)) ocupadas.huellas.set(clave, []);
    ocupadas.huellas.get(clave).push({ ...r, nombre });
  }
}
function choqueDeRectangulo(ocupadas, r) {
  for (const clave of celdasDeRectangulo(r)) {
    if (ocupadas.huellas?.has(clave)) {
      const choque = ocupadas.huellas.get(clave).find((a) => solapanRectangulos(r, a));
      if (choque) return choque.nombre;
    } else if (ocupadas.has(clave)) return ocupadas.get(clave);
  }
  return null;
}
function rectangulosDePieza(pieza) {
  const geo = huellaDe(pieza);
  return geo.libre ? geo.lugares.map((l) => ({ x: pieza.x + l.dx, y: pieza.y + l.dy, ancho: 1, alto: 1 }))
    : [{ x: pieza.x, y: pieza.y, ancho: geo.ancho, alto: geo.alto }];
}
function ocuparPieza(ocupadas, pieza, nombre) {
  for (const r of rectangulosDePieza(pieza)) ocuparRectangulo(ocupadas, r, nombre);
}

// Devuelve null si la pieza (una configuracion con x, y) cabe, o el motivo por el
// que no. Una mesa nunca queda partida por un pasillo; un bloque de filas si puede
// ocupar columnas de pasillo: sus pasillos son el espacio que se deja entre bloques.
function motivoNoCabe(sala, ocupadas, pieza) {
  if (pieza.geometria) {
    const propia = new Map();
    for (const r of rectangulosDePieza(pieza)) {
      if (r.x < 1 - 1e-7 || r.x + r.ancho > sala.ancho + 1 + 1e-7 || r.y < sala.filas.min - 1e-7 || r.y + r.alto > sala.filas.max + 1 + 1e-7) return 'se sale de la sala';
      if (choqueDeRectangulo(propia, r)) return 'sus butacas se solapan';
      const choque = choqueDeRectangulo(ocupadas, r);
      if (choque) return 'choca con ' + choque;
      ocuparRectangulo(propia, r, 'otra butaca');
    }
    return null;
  }
  const { ancho, alto } = huellaDe(pieza);
  // Solo las mesas respetan los pasillos; el resto puede cruzarlos.
  const respetaPasillos = esMesa(pieza);
  for (let dy = 0; dy < alto; dy++) {
    for (let dx = 0; dx < ancho; dx++) {
      const cx = pieza.x + dx, cy = pieza.y + dy;
      if (cx < 1 || cx > sala.ancho || cy < sala.filas.min || cy > sala.filas.max) {
        return 'se sale de la sala';
      }
      if (respetaPasillos && !sala.columnas.includes(cx)) return 'cae sobre un pasillo';
      const quien = choqueDeRectangulo(ocupadas, { x: cx, y: cy, ancho: 1, alto: 1 });
      if (quien) return 'choca con ' + quien;
    }
  }
  return null;
}

const fueraDeSala = (sala, x, y) =>
  x < 1 || x > sala.ancho || y < sala.filas.min || y > sala.filas.max;

// Para el teclado: el primer sitio donde cabe avanzando en (dx, dy). Salta por
// encima de pasillos y otras mesas, que con el raton se cruzan sin mas.
function buscarHueco(sala, ocupadas, mesa, dx, dy) {
  for (let paso = 1; ; paso++) {
    const x = mesa.x + dx * paso, y = mesa.y + dy * paso;
    if (fueraDeSala(sala, x, y)) return null;
    if (!motivoNoCabe(sala, ocupadas, { ...mesa, x, y })) return { x, y };
  }
}

// Coloca la configuracion en su sitio o, si ahi no cabe, en el mas cercano a
// una celda de distancia (primero en cruz, luego en diagonal). Si se sale por un
// borde (una barra larga girada junto a la pared), prueba tambien metida en la sala.
// Devuelve la configuracion colocada, o { motivo } con la razon del sitio original.
function colocarCerca(sala, ocupadas, mesa) {
  const desplazamientos = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1],
                           [-1, -1], [1, -1], [-1, 1], [1, 1]];
  for (const [dx, dy] of desplazamientos) {
    const intento = { ...mesa, x: mesa.x + dx, y: mesa.y + dy };
    if (!motivoNoCabe(sala, ocupadas, intento)) return intento;
  }
  const { ancho, alto } = huellaDe(mesa);
  const dentro = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
  const metida = { ...mesa, x: dentro(mesa.x, 1, sala.ancho - ancho + 1),
                   y: dentro(mesa.y, sala.filas.min, sala.filas.max - alto + 1) };
  if ((metida.x !== mesa.x || metida.y !== mesa.y) && !motivoNoCabe(sala, ocupadas, metida)) return metida;
  return { motivo: motivoNoCabe(sala, ocupadas, mesa) };
}

// Gira 90 grados en sentido horario sobre el centro. Si el centro cae entre
// celdas, al quedar en vertical (90 o 270) se redondea hacia abajo y al volver a
// horizontal hacia arriba: cuatro giros dejan la pieza exactamente donde estaba.
function girarPieza(pieza) {
  const antes = huellaDe(pieza);
  const giro = ((pieza.giro || 0) + 90) % 360;
  const despues = huellaDe({ ...pieza, giro });
  const redondear = giro % 180 ? Math.floor : Math.ceil;
  return {
    ...pieza, giro,
    x: redondear(pieza.x + (antes.ancho - despues.ancho) / 2),
    y: redondear(pieza.y + (antes.alto - despues.alto) / 2),
  };
}

// Recoloca un bloque cambiado para que su primera butaca (fila de delante, butaca
// 1) siga en la misma celda: al crecer o encoger, el bloque no se desplaza.
function anclarPrimeraButaca(antes, despues) {
  const primera = (bloque) => huellaDe(bloque).lugares.find((l) => l.fila === 0 && l.columna === 0);
  const a = primera(antes), d = primera(despues);
  return { ...despues, x: antes.x + a.dx - d.dx, y: antes.y + a.dy - d.dy };
}

// Butacas por fila de un bloque: crecen por el final de cada fila.
function cambiarAncho(bloque, delta) {
  const ancho = bloque.ancho + delta;
  if (ancho < 1 || ancho > ANCHO_BLOQUE_MAXIMO) return null;
  return anclarPrimeraButaca(bloque, { ...bloque, ancho });
}

// Filas de un bloque: crecen por detras, lejos del escenario.
function cambiarFilasBloque(bloque, delta) {
  const filas = bloque.filas + delta;
  if (filas < 1 || filas > FILAS_MAXIMAS) return null;
  return anclarPrimeraButaca(bloque, { ...bloque, filas });
}

// Recoloca 'despues' para que su tablero empiece en la misma celda que el de
// 'antes'. Asi alargar, cabeceras y un lado cambian los lugares sin mover la mesa.
function anclarTablero(antes, despues) {
  const a = geometriaMesa(antes).tablero, d = geometriaMesa(despues).tablero;
  return { ...despues, x: antes.x + a.dx - d.dx, y: antes.y + a.dy - d.dy };
}

// Alarga o acorta una celda. El tablero crece desde su primera celda hacia la
// derecha, o hacia abajo si esta en vertical. Devuelve null fuera de los limites.
function cambiarLargo(mesa, delta) {
  const largo = mesa.largo + delta;
  if (largo < 1 || largo > LARGO_MAXIMO) return null;
  return anclarTablero(mesa, { ...mesa, largo });
}

// Pone o quita las cabeceras: la huella crece o encoge una celda por extremo.
const alternarCabeceras = (mesa) => anclarTablero(mesa, { ...mesa, cabeceras: !mesa.cabeceras });

// Pasa de lugares en los dos lados largos a solo uno (se quedan los del sur) o al revés.
const alternarUnLado = (mesa) => anclarTablero(mesa, { ...mesa, unLado: !mesa.unLado });

// Primer sitio libre para una mesa nueva, recorriendo la sala por filas.
function buscarSitioLibre(sala, ocupadas, config) {
  for (let y = sala.filas.min; y <= sala.filas.max; y++) {
    for (let x = 1; x <= sala.ancho; x++) {
      if (!motivoNoCabe(sala, ocupadas, { ...config, x, y })) return { ...config, x, y };
    }
  }
  return null;
}

// Tras cambiar bandas o columnas, la primera pieza (mesa o bloque) que ya no cabe
// (se sale, choca con una fila u otra pieza), o null si todas caben.
function primeraPiezaQueNoCabe(sala) {
  for (const pieza of [...(escenario.ausente ? [] : [escenario]), ...mesas, ...bloquesFilas, ...formas, ...butacasSueltas]) {
    const motivo = motivoNoCabe(sala, celdasOcupadas(pieza.id), pieza);
    if (motivo) return { pieza, motivo };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Editor de bandas. Cada operacion recibe el plano y la sala generada desde el
// (con 'y' y 'alto' de cada banda) y devuelve un plano nuevo, o { motivo }.
// Las mesas que quedan debajo de una banda que cambia de alto se desplazan con
// ella; las que estan dentro de una banda que se mueve, viajan con la banda.
// ---------------------------------------------------------------------------
const copiarPlano = (plano) => ({
  ...plano, ...estructuraFisicaDe(plano), bandas: copiarBandas(plano.bandas),
  ...(plano.niveles ? { niveles: copiarDatos(plano.niveles) } : {}),
  regionesLibres: copiarDatos(plano.regionesLibres || []),
  ...(plano.zonas ? { zonas: copiarZonas(plano.zonas) } : {}),
  ...(plano.zonasDeAsiento ? { zonasDeAsiento: { ...plano.zonasDeAsiento } } : {}),
  ...(plano.zonasFisicasConfirmadas ? { zonasFisicasConfirmadas: { ...plano.zonasFisicasConfirmadas } } : {}),
  ...(plano.identidadFisica ? { identidadFisica: copiarIdentidad(plano) } : {}),
  ...(plano.idsRetirados ? { idsRetirados: [...plano.idsRetirados] } : {}),
  ...(plano.revisionFisica ? { revisionFisica: { ...plano.revisionFisica } } : {}),
  ...Object.fromEntries(LISTAS_DE_PIEZAS.map(({ lista }) => [lista, (plano[lista] || []).map((p) => ({ ...p }))])),
  ...(plano.escenario ? { escenario: { ...plano.escenario } } : {}),   // null (sin escenario) llega con ...plano
});
const piezasDe = (plano) => [...LISTAS_DE_PIEZAS.flatMap(({ lista }) => plano[lista] || []),
                             ...(plano.escenario ? [plano.escenario] : [])];
// Una banda o vertical de una sala ya dispuesta, por id (con nombre, x, y, alto...).
const bandaDe = (sala, id) => { const u = ubicar(sala.bandas, id); return u && u.item; };

// Alto de una banda de filas (sus filas) o de una zona de mesas (su alto).
function redimensionarBanda(plano, sala, id, delta) {
  const nuevo = copiarPlano(plano);
  const u = ubicar(nuevo.bandas, id);
  const banda = u.item;
  if (banda.tipo === 'escenario') return { motivo: 'la franja del escenario tiene un alto fijo; cambia el tamaño del escenario en el plano' };
  if (esDivision(banda) || u.esVertical) return { motivo: 'su alto depende de las bandas que tiene dentro' };
  const clave = banda.tipo === 'filas' ? 'filas' : 'alto';
  const valor = banda[clave] + delta;
  const maximo = banda.tipo === 'filas' ? FILAS_MAXIMAS : ALTO_MAXIMO;
  if (valor < 1) return { motivo: 'ya tiene el mínimo' };
  if (valor > maximo) return { motivo: 'ya tiene el máximo (' + maximo + ')' };
  banda[clave] = valor;
  return reanclarPiezas(plano, nuevo, sala.ancho, sala.ancho);
}

// Sube o baja una banda dentro de su lista (la sala o una vertical), o mueve una
// vertical a izquierda (-1) o derecha (+1) dentro de su franja.
function moverBanda(plano, sala, id, sentido) {
  const nuevo = copiarPlano(plano);
  const u = ubicar(nuevo.bandas, id);
  const j = u.indice + sentido;
  if (u.esVertical) {
    if (j < 0 || j >= u.lista.length) {
      return { motivo: sentido < 0 ? 'ya está a la izquierda del todo' : 'ya está a la derecha del todo' };
    }
    // Los anchos se fijan desde lo que ocupan ahora; tras mover, la ultima ocupa el resto.
    const colocadas = bandaDe(sala, u.padre.id).verticales;
    u.lista.forEach((v, i) => { v.ancho = colocadas[i].anchoOcupado; });
    [u.lista[u.indice], u.lista[j]] = [u.lista[j], u.lista[u.indice]];
    delete u.lista.at(-1).ancho;
    return reanclarPiezas(plano, nuevo, sala.ancho, sala.ancho);
  }
  if (j < 0 || j >= u.lista.length || u.lista[j].tipo === 'escenario' || u.item.tipo === 'escenario') {
    return { motivo: sentido < 0 ? 'ya está arriba del todo' : 'ya está abajo del todo' };
  }
  [u.lista[u.indice], u.lista[j]] = [u.lista[j], u.lista[u.indice]];
  return reanclarPiezas(plano, nuevo, sala.ancho, sala.ancho);
}

// Quita una banda, una vertical o una franja entera, con las piezas que empiezan
// dentro; lo de alrededor se recoloca.
function eliminarBanda(plano, sala, id) {
  const nuevo = copiarPlano(plano);
  const u = ubicar(nuevo.bandas, id);
  if (u.item.tipo === 'escenario') return { motivo: 'el escenario no se puede eliminar' };
  if (u.esVertical) {
    if (u.lista.length === 1) return { motivo: 'una franja dividida necesita al menos una banda vertical; elimina la franja' };
    u.lista.splice(u.indice, 1);
    delete u.lista.at(-1).ancho;   // la nueva ultima ocupa el resto
  } else {
    u.lista.splice(u.indice, 1);
  }
  // El catalogo fisico tiene vida propia; eliminar una banda no elimina su zona.
  return reanclarPiezas(plano, nuevo, sala.ancho, sala.ancho, idsDentro(u.item));
}

// Agrega al final de la sala una banda de filas, una zona de mesas, un espacio o una
// franja dividida en dos verticales, cada una con un espacio vacio de 4 filas (sin
// butacas: se llena despues). Los ids no reutilizan los de bandas eliminadas.
// Las bandas nuevas reutilizan zonas existentes. Crear zona es una accion explicita.
function agregarBanda(plano, tipo, anchoSala = ANCHO_SALA) {
  const nuevo = copiarPlano(plano);
  const nuevoId = () => 'banda' + nuevo.siguienteBanda++;
  const banda = nuevaBanda(tipo, nuevoId, anchoSala, zonaParaFilas(zonasDe(nuevo)));
  nuevo.bandas.push(banda);
  return nuevo;
}

function nuevaBanda(tipo, nuevoId, anchoSala, zona = 'general') {
  if (tipo === 'filas') return { id: nuevoId(), tipo: 'filas', zona, filas: 2 };
  if (tipo === 'mesas') return { id: nuevoId(), tipo: 'mesas', alto: 4 };
  if (tipo === 'espacio') return { id: nuevoId(), tipo: 'espacio', alto: 4 };
  const id = nuevoId();
  return {
    id, tipo: 'division',
    verticales: [
      { id: nuevoId(), ancho: Math.max(1, Math.floor(anchoSala / 2)), bandas: [nuevaBanda('espacio', nuevoId)] },
      { id: nuevoId(), bandas: [nuevaBanda('espacio', nuevoId)] },
    ],
  };
}

// Agrega una banda de filas o de mesas al final de una vertical.
function agregarBandaEnVertical(plano, sala, verticalId, tipo) {
  const nuevo = copiarPlano(plano);
  const u = ubicar(nuevo.bandas, verticalId);
  const banda = nuevaBanda(tipo, () => 'banda' + nuevo.siguienteBanda++, sala.ancho, zonaParaFilas(zonasDe(nuevo)));
  u.item.bandas.push(banda);
  return reanclarPiezas(plano, nuevo, sala.ancho, sala.ancho);
}

// Agrega una vertical a la derecha de una franja: la que era la ultima pasa a
// ocupar la mitad de su ancho y la nueva, el resto.
function agregarVertical(plano, sala, divisionId) {
  const nuevo = copiarPlano(plano);
  const division = ubicar(nuevo.bandas, divisionId).item;
  if (division.verticales.length >= VERTICALES_MAXIMAS) {
    return { motivo: 'ya tiene el máximo de bandas verticales (' + VERTICALES_MAXIMAS + ')' };
  }
  const colocada = bandaDe(sala, divisionId).verticales.at(-1);
  const mitad = Math.floor(colocada.anchoOcupado / 2);
  if (mitad < 1) return { motivo: 'no queda ancho para otra banda vertical' };
  division.verticales.at(-1).ancho = mitad;
  division.verticales.push({ id: 'banda' + nuevo.siguienteBanda++, bandas: [] });
  return reanclarPiezas(plano, nuevo, sala.ancho, sala.ancho);
}

// Cambia el ancho de una vertical; la ultima absorbe la diferencia.
function cambiarAnchoVertical(plano, sala, verticalId, delta) {
  const nuevo = copiarPlano(plano);
  const u = ubicar(nuevo.bandas, verticalId);
  if (u.indice === u.lista.length - 1) {
    return { motivo: 'la última banda vertical ocupa el resto; cambia el ancho de las demás' };
  }
  const ancho = u.item.ancho + delta;
  const ultima = bandaDe(sala, u.padre.id).verticales.at(-1).anchoOcupado - delta;
  if (ancho < 1) return { motivo: 'ya tiene el mínimo' };
  if (ultima < 1) return { motivo: 'la última banda vertical se quedaría sin ancho' };
  u.item.ancho = ancho;
  return reanclarPiezas(plano, nuevo, sala.ancho, sala.ancho);
}

// ---------------------------------------------------------------------------
// Tiradores: redimensionar bandas con el raton.
//
// Los botones − / + del panel siguen siendo el camino accesible; esto es la
// comodidad del raton. Hay dos tiradores:
//
// - la **esquina** de una banda con alto propio (un espacio o una zona de mesas),
//   que cambia su alto y, si esta dentro de una vertical que no es la ultima,
//   tambien el ancho de esa vertical: el gesto de la esquina mueve las dos
//   medidas a la vez;
// - el **borde** entre dos verticales, que cambia el ancho de la de su izquierda.
//
// El ancho de una banda nunca es suyo: es el de lo que la contiene. Por eso
// «ensanchar un espacio» es, en realidad, ensanchar su vertical, y un espacio al
// nivel de la sala solo cambia de alto.
// ---------------------------------------------------------------------------
function tiradoresDeSala(sala) {
  const lista = [];
  const recorrer = (bandas, vertical) => {
    for (const b of bandas) {
      if (esDivision(b)) {
        b.verticales.forEach((v, i) => {
          // La ultima vertical ocupa el resto: su ancho no se agarra, se deduce.
          const ultima = i === b.verticales.length - 1;
          if (!ultima) {
            lista.push({ tipo: 'borde', vertical: v.id, banda: null,
                         x: v.x + v.anchoOcupado, y: v.y, alto: v.alto });
          }
          recorrer(v.bandas, ultima ? null : v);
        });
      } else if (tieneAlto(b)) {
        lista.push({ tipo: 'esquina', banda: b.id, vertical: vertical && vertical.id,
                     x: b.x + b.anchoOcupado, y: b.y + b.alto });
      }
    }
  };
  recorrer(sala.bandas, null);
  return lista;
}

// Aplica de una vez las medidas que ha dejado el tirador: el alto de la banda (en
// filas) y el ancho de su vertical (en columnas). Las dos son opcionales, y ninguna
// se escribe si la otra no cabe: o el gesto entero, o nada.
function redimensionarConTirador(plano, sala, { banda, vertical, alto, ancho }) {
  const nuevo = copiarPlano(plano);
  if (alto !== undefined && banda) {
    const u = ubicar(nuevo.bandas, banda);
    if (!u || !tieneAlto(u.item)) return { motivo: 'esa banda no tiene un alto propio' };
    if (alto < 1) return { motivo: 'ya tiene el mínimo' };
    if (alto > ALTO_MAXIMO) return { motivo: 'ya tiene el máximo (' + ALTO_MAXIMO + ')' };
    u.item.alto = alto;
  }
  if (ancho !== undefined && vertical) {
    const u = ubicar(nuevo.bandas, vertical);
    if (!u || !u.esVertical) return { motivo: 'esa banda vertical ya no existe' };
    if (u.indice === u.lista.length - 1) {
      return { motivo: 'la última banda vertical ocupa el resto; cambia el ancho de las demás' };
    }
    if (ancho < 1) return { motivo: 'ya tiene el mínimo' };
    // Lo que le queda a la ultima: el ancho de la franja menos el de las demas.
    const franja = bandaDe(sala, u.padre.id);
    const otras = u.lista.slice(0, -1).reduce((s, v, i) => s + (i === u.indice ? ancho : v.ancho), 0);
    if (franja.anchoOcupado - otras < 1) return { motivo: 'la última banda vertical se quedaría sin ancho' };
    u.item.ancho = ancho;
  }
  return reanclarPiezas(plano, nuevo, sala.ancho, sala.ancho);
}

// El plano editable de una sala ya generada: bandas y mesas como datos. De cada
// banda se quitan lo calculado al generar (y, nombre por defecto) pero no los
// datos propios: el alto de una zona de mesas SI es un dato, el de las demas no.
// Las bloqueadas pasan a ser una lista de ids: asi se pueden editar una a una.
function planoDesdeSala(tipo, sala) {
  const definicion = { ...(typeof tipo === 'string' ? TIPOS_DE_SALA[tipo] : tipo), ...(sala.registroFisico || {}) };
  // Quita lo calculado al disponer (posicion, alto calculado, nombre por defecto).
  const limpiar = (lista) => lista.map(({ x, y, alto, anchoOcupado, profundidad, altoPila, nombre, nombrePropio,
                                          zona, zonaPropia, bloqueadasAlFinal, verticales, ...banda }) => ({
    ...banda,
    ...(tieneAlto(banda) ? { alto } : {}),
    ...(nombrePropio ? { nombre: nombrePropio } : {}),
    // Solo la zona puesta a mano: la de una zona de mesas sin zona propia se calcula.
    ...(zonaPropia ? { zona: zonaPropia } : {}),
    ...(verticales ? {
      verticales: verticales.map(({ x: _x, y: _y, alto: _a, anchoOcupado: _w, profundidad: _p, altoPila: _h,
                                   nombre: _n, nombrePropio: propioV, zona: _z, zonaPropia: propiaV, bandas, ...v }) => ({
        ...v, ...(propioV ? { nombre: propioV } : {}), ...(propiaV ? { zona: propiaV } : {}), bandas: limpiar(bandas),
      })),
    } : {}),
  }));
  return sincronizarIdentidad({
    ...estructuraFisicaDe(definicion),
    ...(sala.datosNiveles || {}),
    bandas: limpiar(sala.bandas),
    mesas: mesas.map(configDeMesa),
    bloquesFilas: bloquesFilas.map(configDeBloque),
    formas: formas.map(configDeForma),
    butacasSueltas: butacasSueltas.map(configDeButaca),
    escenario: escenario.ausente ? null : configDeEscenario(escenario),
    ...(sala.lienzo ? { lienzo: true } : {}),
    distribucion: distribucionDeSala(sala),
    bloqueadas: butacas.filter((b) => b.estado === 'bloqueada').map((b) => b.id),
    zonasDeAsiento: definicion.identidadFisica ? { ...(definicion.zonasDeAsiento || {}) }
      : Object.fromEntries(butacas.filter((b) => b.zona !== b.zonaOriginal).map((b) => [b.id, b.zona])),
    zonasFisicasConfirmadas: { ...(definicion.zonasFisicasConfirmadas || {}) },
    siguiente: Math.max(definicion.siguiente || 0, ...mesas.map((m) => Number(m.id.slice(1)) + 1), 1),
    siguienteBanda: Math.max(definicion.siguienteBanda || 1, 1),
    siguienteBloque: Math.max(definicion.siguienteBloque || 1, ...bloquesFilas.map((b) => Number(b.id.slice(1)) + 1), 1),
    siguienteForma: Math.max(definicion.siguienteForma || 1, ...formas.map((f) => Number(f.id.slice(1)) + 1), 1),
    siguienteButaca: Math.max(definicion.siguienteButaca || 1, ...butacasSueltas.map((b) => Number(b.id.slice(1)) + 1), 1),
    zonas: Object.entries(zonas).map(([id, { nombre }]) => ({ id, nombre })),
    ...(definicion.antecedentesComerciales ? { antecedentesComerciales: JSON.parse(JSON.stringify(definicion.antecedentesComerciales)) } : {}),
    siguienteZona: Math.max(definicion.siguienteZona || 1, 1),
    ...(definicion.identidadFisica ? { identidadFisica: copiarIdentidad(definicion), idsRetirados: [...definicion.idsRetirados], siguienteLugar: definicion.siguienteLugar,
      modoNumeracion: definicion.modoNumeracion, revisionFisica: { ...definicion.revisionFisica } } : {}),
  });
}

const configDeEscenario = ({ x, y, ancho, alto }) => ({ x, y, ancho, alto });

// Quita el escenario: las piezas ya no lo rodean ni se numeran desde el.
function quitarEscenario(plano) {
  const nuevo = copiarPlano(plano);
  nuevo.escenario = null;
  return nuevo;
}

// Pone un escenario de 2 filas de alto en el primer hueco libre: a todo el ancho si
// cabe, si no de 8 o de 4 columnas. Usa las celdas de la sala generada desde 'plano'.
function agregarEscenario(plano, sala) {
  const ocupadas = celdasOcupadas(null);
  for (const ancho of [...new Set([sala.ancho, Math.min(8, sala.ancho), Math.min(4, sala.ancho)])]) {
    const sitio = buscarSitioLibre(sala, ocupadas, { id: 'escenario', tipo: 'escenario', x: 0, y: 0, ancho, alto: 2 });
    if (sitio) {
      const nuevo = copiarPlano(plano);
      nuevo.escenario = configDeEscenario(sitio);
      return nuevo;
    }
  }
  return { motivo: 'no hay un hueco libre de 4 × 2 celdas para el escenario' };
}

// Cambia el ancho de un lienzo. Las piezas se quedan donde estan: solo cambia el
// ancho de la ultima vertical de cada franja, que no se desplaza. Si alguna pieza
// deja de caber, lo detecta aplicarBandas.
function cambiarAnchoLienzo(plano, sala, ancho) {
  if (!esEntero(ancho, 1, BUTACAS_POR_BLOQUE)) {
    return { motivo: 'el ancho del lienzo debe ser de 1 a ' + BUTACAS_POR_BLOQUE + ' columnas' };
  }
  const nuevo = copiarPlano(plano);
  nuevo.distribucion = { bloques: [ancho], pasillos: [] };
  // Un escenario a todo el ancho sigue a todo el ancho.
  if (nuevo.escenario && nuevo.escenario.x === 1 && nuevo.escenario.ancho === sala.ancho) {
    nuevo.escenario.ancho = Math.min(ancho, ESCENARIO_ANCHO_MAXIMO);
  }
  return nuevo;
}

// La configuracion guardable de un bloque: sin geometria ni nombre por defecto.
const configDeBloque = ({ id, x, y, ancho, filas, zona, giro, nombrePropio, geometria, ajustes, region }) =>
  ({ id, tipo: 'filas', x, y, ancho, filas, giro, ...(zona ? { zona } : {}),
     ...(geometria ? { geometria: { ...geometria }, ajustes: copiarDatos(ajustes || {}) } : {}),
     ...(region ? { region } : {}), ...(nombrePropio ? { nombre: nombrePropio } : {}) });

// Bloquea o desbloquea una butaca por id. Es parte del diseño del recinto (una
// butaca sin visibilidad), no de la venta: por eso se guarda con el mapa.
function alternarBloqueada(plano, id) {
  const nuevo = copiarPlano(plano);
  const lista = new Set(nuevo.bloqueadas || []);
  if (!lista.delete(id)) lista.add(id);
  nuevo.bloqueadas = [...lista];
  return nuevo;
}

// ---------------------------------------------------------------------------
// Trabajar por area.
//
// Asignar zona y bloquear van butaca a butaca, que es lo justo para retocar dos
// lugares pero imposible para «las tres primeras filas del bloque central». Un
// area es un rectangulo de celdas, con las esquinas en cualquier orden: lo que
// se arrastra en el plano o se extiende con Mayus y las flechas.
//
// Las dos operaciones devuelven { plano, cambiadas, ocupadas } para poder decir
// que paso: las ocupadas no cambian nunca, ni de zona ni de bloqueo.
// ---------------------------------------------------------------------------
const areaDeCeldas = (a, b) => ({ x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y),
                                  x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y) });

const butacasEnArea = (lista, area) => lista.filter((b) =>
  b.x >= area.x1 && b.x <= area.x2 && b.y >= area.y1 && b.y <= area.y2);

// Mesas completas historicas con lugares de varias zonas: se devuelven sus nombres
// para avisar de pertenencias fisicas mezcladas, sin deducir ninguna tarifa.
function mesasConZonasMezcladas(plano, lista) {
  const porMesa = new Map();
  for (const b of lista) {
    if (!b.grupo || !b.grupo.completa) continue;
    if (!porMesa.has(b.grupo.id)) porMesa.set(b.grupo.id, { nombre: b.grupo.nombre, zonas: new Set() });
    porMesa.get(b.grupo.id).zonas.add((plano.zonasDeAsiento || {})[b.id] || b.zonaOriginal);
  }
  return [...porMesa.values()].filter((m) => m.zonas.size > 1).map((m) => m.nombre);
}

// Asigna una zona a todas las butacas libres de un area. Sin zona ('' o null) las
// devuelve a la suya de siempre, que es lo que hace Alt. Una butaca que ya esta en
// la zona de destino no cuenta como cambiada.
// El recorrido que comparten las dos operaciones por area: las butacas libres del
// rectangulo, una a una, apartando las ocupadas para poder avisar de ellas. 'aplicar'
// devuelve si la butaca cambio de verdad; las ocupadas nunca se tocan.
function recorrerArea(lista, area, aplicar) {
  const cambiadas = [], ocupadas = [];
  for (const b of butacasEnArea(lista, area)) {
    if (b.estado === 'ocupada') ocupadas.push(b.id);
    else if (aplicar(b)) cambiadas.push(b.id);
  }
  return { cambiadas, ocupadas };
}

function asignarZonaEnArea(plano, lista, area, zona) {
  const nuevo = copiarPlano(plano);
  nuevo.zonasDeAsiento = { ...(nuevo.zonasDeAsiento || {}) };
  const { cambiadas, ocupadas } = recorrerArea(lista, area, (b) => {
    const destino = zona || b.zonaOriginal;
    if (destino === b.zona) return false;
    // Solo se guarda lo que se aparta de su zona de siempre: asi el mapa no engorda
    // con lo que ya heredaba de su banda.
    if (destino === b.zonaOriginal) delete nuevo.zonasDeAsiento[b.id];
    else nuevo.zonasDeAsiento[b.id] = destino;
    const fisica = nuevo.identidadFisica?.[b.claveDiseno || b.id];
    if (fisica) fijarZonaInventario(nuevo, fisica, destino);
    return true;
  });
  return { plano: nuevo, cambiadas, ocupadas, mesas: mesasConZonasMezcladas(nuevo, lista) };
}

// Bloquea o desbloquea todas las butacas libres de un area.
function bloquearEnArea(plano, lista, area, bloquear) {
  const nuevo = copiarPlano(plano);
  const bloqueadas = new Set(nuevo.bloqueadas || []);
  const { cambiadas, ocupadas } = recorrerArea(lista, area, (b) => {
    if (bloquear === bloqueadas.has(b.id)) return false;
    if (bloquear) bloqueadas.add(b.id);
    else bloqueadas.delete(b.id);
    return true;
  });
  nuevo.bloqueadas = [...bloqueadas];
  return { plano: nuevo, cambiadas, ocupadas };
}
