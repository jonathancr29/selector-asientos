
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

const rejillaDeSala = ({ ancho, pasillos = 'ninguno' }) =>
  rejillaDeBloques(distribucionDePasillos(pasillos, ancho));

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
// Zonas: nombre y precio (en centavos). Cada plano o mapa trae su lista, editable;
// 'zonas' es el indice por id de la sala generada (lo rellena generarPlano), asi que
// zonas[b.zona].nombre y .precio siempre son los de la sala actual.
// La zona 'mesas' es la de los lugares de mesa: no se elimina ni se asigna a filas.
const ZONAS_POR_DEFECTO = [
  { id: 'luneta', nombre: 'Luneta', precio: 35000 },
  { id: 'mesas', nombre: 'Mesas', precio: 50000 },
  { id: 'general', nombre: 'General', precio: 20000 },
];
// Cada banda nueva nace con su zona, asi que el tope tiene que dar para todas las
// bandas de una sala, no solo para unos cuantos precios.
const ZONAS_MAXIMAS = 40;
const PRECIO_MAXIMO = 100000000;   // un millon de pesos, en centavos
const zonas = {};

// Rellena el indice 'zonas' con una lista, en su orden.
function usarZonas(lista) {
  for (const id of Object.keys(zonas)) delete zonas[id];
  for (const { id, nombre, precio } of lista) zonas[id] = { nombre, precio };
}
usarZonas(ZONAS_POR_DEFECTO);

const copiarZonas = (lista) => lista.map((z) => ({ ...z }));
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
    // (un espacio sin precio, una franja) toman el nombre de su tipo.
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
// tiene zona, o null si ninguna la tiene (una mesa sobre un espacio sin precio).
// Es lo que hace que todo lo que cae dentro de una banda cueste lo que ella.
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
    const xRotulo = bordeIzquierdo ? columnas[0] - 1 : bordeDerecho ? columnas.at(-1) + 1 : null;
    if (xRotulo !== null) muebles.push({ tipo: 'rotulo', texto: fila, banda: id, filaLocal: i, x: xRotulo, y: y + i });
  }
}

// Letras de referencia en las filas de un espacio con 'guias': A, B, C... en el
// mismo sitio que los rotulos de fila. Solo ayudan a ubicarse; no son butacas.
function agregarGuias(banda, anchoSala) {
  const desde = banda.x || 1, ancho = banda.anchoOcupado || anchoSala;
  const x = desde === 1 ? 0 : desde + ancho - 1 >= anchoSala ? anchoSala + 1 : null;
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

function geometriaBloqueFilas({ ancho, filas, giro = 0 }) {
  const lugares = [];
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < ancho; c++) lugares.push({ fila: f, columna: c, dx: c, dy: f, mira: MIRA_ESCENARIO });
  }
  let geo = { ancho, alto: filas, tablero: null, lugares };
  for (let g = 0; g < giro; g += 90) geo = girar90(geo);
  return geo;
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
      x: config.x + l.dx, y: config.y + l.dy, mira: l.mira,
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
// Las que miran de lado (90 o 270) o de espaldas llevan secuencia propia.
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
//   espaldas) llevan el nombre del bloque y su propia secuencia: fila A la de
//   delante, numeradas en el orden del bloque.
function numerarFilas() {
  const bloquePorId = new Map(bloquesFilas.map((b) => [b.id, b]));
  const porZona = new Map();
  const centro = centroDelEscenario().y;
  for (const b of butacas) {
    if (b.grupo) continue;
    const bloque = b.bloque && bloquePorId.get(b.bloque);
    if (bloque && !miraDeFrente(b)) {
      Object.assign(b, { fila: letraDeFila(b.filaLocal), numero: b.numeroLocal, seccion: bloque.nombre });
      continue;
    }
    if (!porZona.has(b.zona)) porZona.set(b.zona, []);
    porZona.get(b.zona).push(b);
  }
  for (const [zona, lista] of porZona) {
    // Por distancia al escenario; a igual distancia, primero la de arriba.
    // Sin escenario todas estan a distancia infinita (Infinity - Infinity es NaN): manda la altura.
    const distancia = (y) => Math.abs(y + 0.5 - centro);
    // Agrupadas una sola vez por altura: filtrar la lista por cada altura era cuadratico
    // (6 s con 100.000 butacas). push conserva el orden y sort es estable.
    const porAltura = new Map();
    for (const b of lista) {
      if (!porAltura.has(b.y)) porAltura.set(b.y, []);
      porAltura.get(b.y).push(b);
    }
    const alturas = [...porAltura.keys()].sort((a, c) => distancia(a) - distancia(c) || a - c);
    alturas.forEach((y, i) => {
      porAltura.get(y).sort((a, c) => a.x - c.x).forEach((b, k) => {
        Object.assign(b, { fila: letraDeFila(i), numero: k + 1, seccion: zonas[zona].nombre });
      });
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
function generarPlano(tipo, plano = null) {
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

  // El precio de una pieza: el de su zona propia si la lleva, el de la banda que la
  // contiene, o el de las filas como ultimo recurso (una pieza fuera de toda zona; el
  // editor obliga a elegirle una, ver zonasObligatorias).
  const respaldo = zonaParaFilas(listaDeZonas);
  const zonaDePieza = (config) => (zonas[config.zona] && config.zona) ||
    zonaEnCelda(sala, config.x, config.y) || respaldo;

  const ocupadasDeMesas = definicion.mesasOcupadas || {};
  for (const config of plano ? plano.mesas : definicion.mesas || mesasAutomaticas(sala)) {
    agregarMesa(config, ocupadasDeMesas[config.id], zonaDePieza(config));
  }
  for (const config of (plano && plano.bloquesFilas) || definicion.bloquesFilas || []) {
    agregarBloqueFilas(config, zonaDePieza(config));
  }
  for (const config of (plano && plano.formas) || definicion.formas || []) agregarForma(config);
  for (const config of (plano && plano.butacasSueltas) || definicion.butacasSueltas || []) {
    agregarButacaSuelta(config, zonaDePieza(config));
  }

  // Bloqueadas: la lista del plano o del mapa manda; si no hay, las de las bandas.
  const bloqueadas = new Set((plano && plano.bloqueadas) || definicion.bloqueadas ||
                             idsBloqueadosPorBandas(sala));
  for (const b of butacas) if (bloqueadas.has(b.id)) b.estado = 'bloqueada';
  for (const mesa of mesas.filter((m) => m.completa)) {
    const lugares = butacas.filter((b) => b.grupo && b.grupo.id === mesa.id);
    if (lugares.some((b) => b.estado === 'ocupada')) {
      for (const b of lugares) if (b.estado === 'libre') b.estado = 'ocupada';
    }
  }
  numerarFilas();
  // Zona asignada a mano a un asiento: cambia su precio y el nombre de su seccion,
  // pero no su fila ni su numero, que ya se calcularon con la zona de siempre.
  const zonasDeAsiento = (plano && plano.zonasDeAsiento) || definicion.zonasDeAsiento || {};
  for (const b of butacas) {
    b.zonaOriginal = b.zona;
    const zona = zonasDeAsiento[b.id];
    if (!zona || !zonas[zona] || zona === b.zona) continue;
    b.zona = zona;
    if (!b.grupo) b.seccion = zonas[zona].nombre;
  }

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
  for (const b of butacas) {
    if (b.grupo || (b.bloque && excluida(excluir, b.bloque)) || (b.suelta && excluida(excluir, b.suelta))) continue;
    ocupadas.set(celda(b.x, b.y), (b.suelta ? 'la butaca ' + b.fila + b.numero : 'la fila ' + b.fila) + ' de ' + b.seccion);
  }
  for (const m of mesas) {
    if (excluida(excluir, m.id)) continue;
    for (let dy = 0; dy < m.geo.alto; dy++) {
      for (let dx = 0; dx < m.geo.ancho; dx++) ocupadas.set(celda(m.x + dx, m.y + dy), m.nombre);
    }
  }
  for (const f of formas) {
    if (excluida(excluir, f.id)) continue;
    for (let dy = 0; dy < f.alto; dy++) {
      for (let dx = 0; dx < f.ancho; dx++) ocupadas.set(celda(f.x + dx, f.y + dy), f.nombre);
    }
  }
  if (!excluida(excluir, 'escenario') && !escenario.ausente) {
    for (let dy = 0; dy < escenario.alto; dy++) {
      for (let dx = 0; dx < escenario.ancho; dx++) ocupadas.set(celda(escenario.x + dx, escenario.y + dy), 'el escenario');
    }
  }
  return ocupadas;
}

// Devuelve null si la pieza (una configuracion con x, y) cabe, o el motivo por el
// que no. Una mesa nunca queda partida por un pasillo; un bloque de filas si puede
// ocupar columnas de pasillo: sus pasillos son el espacio que se deja entre bloques.
function motivoNoCabe(sala, ocupadas, pieza) {
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
      const quien = ocupadas.get(celda(cx, cy));
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
  ...plano, bandas: copiarBandas(plano.bandas),
  ...(plano.zonas ? { zonas: copiarZonas(plano.zonas) } : {}),
  ...(plano.zonasDeAsiento ? { zonasDeAsiento: { ...plano.zonasDeAsiento } } : {}),
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
  // La zona era de esa banda: si no la usa nadie mas, se va con ella.
  const zona = zonaDeBanda(u.item);
  if (zona && zona !== 'mesas' && !usosDeZona(nuevo, zona) && zonasDe(nuevo).length > 1) {
    nuevo.zonas = copiarZonas(zonasDe(nuevo).filter((z) => z.id !== zona));
  }
  return reanclarPiezas(plano, nuevo, sala.ancho, sala.ancho, idsDentro(u.item));
}

// Agrega al final de la sala una banda de filas, una zona de mesas, un espacio o una
// franja dividida en dos verticales, cada una con un espacio vacio de 4 filas (sin
// butacas: se llena despues). Los ids no reutilizan los de bandas eliminadas.
// Una zona y una banda son la misma cosa: la banda nueva se queda con una zona propia,
// con su nombre, su precio a 0 y su color. Los espacios y las franjas nacen **sin** zona
// (un hueco no da precio a nada); a un espacio se le da la suya con «Zona nueva».
function agregarBanda(plano, tipo, anchoSala = ANCHO_SALA) {
  const nuevo = copiarPlano(plano);
  const nuevoId = () => 'banda' + nuevo.siguienteBanda++;
  const banda = nuevaBanda(tipo, nuevoId, anchoSala, zonaParaFilas(zonasDe(nuevo)));
  nuevo.bandas.push(banda);
  return conZonaPropia(nuevo, banda);
}

// Le da a la banda recien creada su zona, si es de las que llevan una (filas y mesas).
// Con el catalogo lleno se queda con la que tenga, que es la unica salida razonable.
function conZonaPropia(plano, banda) {
  if (banda.tipo !== 'filas' && banda.tipo !== 'mesas') return plano;
  // El nombre sale de la zona con la que nace, numerado si ya existe («General 2»).
  const base = zonasDe(plano).find((z) => z.id === zonaDeBanda(banda));
  const resultado = zonaNuevaParaBanda(plano, banda.id, base && base.nombre);
  return resultado.motivo ? plano : resultado;
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
  return reanclarPiezas(plano, conZonaPropia(nuevo, banda), sala.ancho, sala.ancho);
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
  const definicion = typeof tipo === 'string' ? TIPOS_DE_SALA[tipo] : tipo;
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
  return {
    bandas: limpiar(sala.bandas),
    mesas: mesas.map(configDeMesa),
    bloquesFilas: bloquesFilas.map(configDeBloque),
    formas: formas.map(configDeForma),
    butacasSueltas: butacasSueltas.map(configDeButaca),
    escenario: escenario.ausente ? null : configDeEscenario(escenario),
    ...(sala.lienzo ? { lienzo: true } : {}),
    distribucion: distribucionDeSala(sala),
    bloqueadas: butacas.filter((b) => b.estado === 'bloqueada').map((b) => b.id),
    zonasDeAsiento: Object.fromEntries(butacas.filter((b) => b.zona !== b.zonaOriginal).map((b) => [b.id, b.zona])),
    siguiente: Math.max(definicion.siguiente || 0, ...mesas.map((m) => Number(m.id.slice(1)) + 1), 1),
    siguienteBanda: Math.max(definicion.siguienteBanda || 1, 1),
    siguienteBloque: Math.max(definicion.siguienteBloque || 1, ...bloquesFilas.map((b) => Number(b.id.slice(1)) + 1), 1),
    siguienteForma: Math.max(definicion.siguienteForma || 1, ...formas.map((f) => Number(f.id.slice(1)) + 1), 1),
    siguienteButaca: Math.max(definicion.siguienteButaca || 1, ...butacasSueltas.map((b) => Number(b.id.slice(1)) + 1), 1),
    zonas: Object.entries(zonas).map(([id, { nombre, precio }]) => ({ id, nombre, precio })),
    siguienteZona: Math.max(definicion.siguienteZona || 1, 1),
  };
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
const configDeBloque = ({ id, x, y, ancho, filas, zona, giro, nombrePropio }) =>
  ({ id, tipo: 'filas', x, y, ancho, filas, giro, ...(zona ? { zona } : {}),
     ...(nombrePropio ? { nombre: nombrePropio } : {}) });

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

// Las mesas que se venden completas y acaban con lugares de mas de una zona: su
// precio deja de ser el de una sola zona, asi que hay que decirlo.
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
const VERSION_MAPA = 4;
const PASILLOS_VALIDOS = ['ninguno', 'izquierda', 'derecha', 'ambos'];
const GRUPO_MAPAS = 'Mis mapas';
const claveDeMapa = (nombre) => 'mapa:' + nombre;

// El mapa de lo que hay ahora en un tipo de sala. 'idsExistentes' limpia las
// bloqueadas que ya no existen (de una banda o mesa eliminada).
function mapaDesdePlano(nombre, plano, guardado, idsExistentes = null) {
  return {
    formato: FORMATO_MAPA, version: VERSION_MAPA, nombre, guardado,
    distribucion: { bloques: [...plano.distribucion.bloques], pasillos: [...plano.distribucion.pasillos] },
    // Sin ocupacion de ejemplo, ni bloqueos por plantilla (ya van en la lista),
    // ni filas de mesas automaticas (las mesas van explicitas).
    bandas: limpiarBandasParaMapa(plano.bandas),
    mesas: plano.mesas.map(configDeMesa),
    bloquesFilas: (plano.bloquesFilas || []).map((b) => ({ ...b })),
    formas: (plano.formas || []).map((f) => ({ ...f })),
    butacasSueltas: (plano.butacasSueltas || []).map((b) => ({ ...b })),
    ...(plano.escenario !== undefined ? { escenario: plano.escenario && { ...plano.escenario } } : {}),
    ...(plano.lienzo ? { lienzo: true } : {}),
    bloqueadas: (plano.bloqueadas || []).filter((id) => !idsExistentes || idsExistentes.has(id)),
    zonasDeAsiento: Object.fromEntries(Object.entries(plano.zonasDeAsiento || {})
      .filter(([id]) => !idsExistentes || idsExistentes.has(id))),
    siguiente: plano.siguiente,
    siguienteBanda: plano.siguienteBanda,
    siguienteBloque: plano.siguienteBloque || 1,
    siguienteForma: plano.siguienteForma || 1,
    siguienteButaca: plano.siguienteButaca || 1,
    zonas: copiarZonas(zonasDe(plano)),
    siguienteZona: plano.siguienteZona || 1,
  };
}

// Sin ocupacion de ejemplo, bloqueos por plantilla ni mesas automaticas, en todo el arbol.
const limpiarBandasParaMapa = (lista) => lista.map(({ ocupadas, bloqueadasAlFinal, filasDeMesas, verticales, ...banda }) => ({
  ...banda,
  ...(verticales ? { verticales: verticales.map((v) => ({ ...v, bandas: limpiarBandasParaMapa(v.bandas) })) } : {}),
}));

const definicionDeMapa = (mapa) => ({
  nombre: mapa.nombre, grupo: GRUPO_MAPAS, lienzo: Boolean(mapa.lienzo), distribucion: mapa.distribucion, bandas: mapa.bandas,
  mesas: mapa.mesas, bloquesFilas: mapa.bloquesFilas, formas: mapa.formas, butacasSueltas: mapa.butacasSueltas,
  escenario: mapa.escenario, bloqueadas: mapa.bloqueadas, zonasDeAsiento: mapa.zonasDeAsiento,
  siguiente: mapa.siguiente, siguienteBanda: mapa.siguienteBanda, siguienteBloque: mapa.siguienteBloque,
  siguienteForma: mapa.siguienteForma, siguienteButaca: mapa.siguienteButaca,
  zonas: mapa.zonas, siguienteZona: mapa.siguienteZona,
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
function motivoDeCabecera(dato) {
  if (!dato || typeof dato !== 'object' || Array.isArray(dato)) return 'el archivo no contiene un mapa';
  if (dato.formato !== FORMATO_MAPA) return 'no es un mapa de este selector de asientos';
  if (![1, 2, 3, VERSION_MAPA].includes(dato.version)) return 'versión de mapa no compatible (' + dato.version + ')';
  return null;
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
      if (!esEntero(z.precio, 0, PRECIO_MAXIMO)) queja('precio no válido');
      return { id: z.id, nombre: nombreZona, precio: z.precio };
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
      const completa = m.completa === true ? { completa: true } : {};
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
      if (!esEntero(b.x, 0, 999) || !esEntero(b.y, 0, 999)) queja('posición no válida');
      if (!esEntero(b.ancho, 1, ANCHO_BLOQUE_MAXIMO)) queja('butacas por fila fuera de rango');
      if (!esEntero(b.filas, 1, FILAS_MAXIMAS)) queja('número de filas fuera de rango');
      if (b.zona !== undefined && !zonaDeFilas(b.zona)) queja('zona desconocida');
      if (![0, 90, 180, 270].includes(b.giro)) queja('giro no válido');
      const limpio = { id: b.id, tipo: 'filas', x: b.x, y: b.y, ancho: b.ancho, filas: b.filas, giro: b.giro,
                       ...(b.zona !== undefined ? { zona: b.zona } : {}) };
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
function validarMapa(dato) {
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

  const bloqueadas = dato.bloqueadas === undefined ? [] : dato.bloqueadas;
  if (!Array.isArray(bloqueadas) || !bloqueadas.every((id) => typeof id === 'string' && id.length <= 60)) {
    errores.push('la lista de butacas bloqueadas no es válida');
  }
  const zonasDeAsiento = zonasDeAsientoDeMapa(dato, errores, idsZona);
  if (errores.length) return { errores };

  // Los contadores nunca por debajo de lo que ya existe: un id no se reutiliza.
  const maximo = (ids, patron) => Math.max(0, ...[...ids].map((id) => Number((id.match(patron) || [])[1]) || 0));
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
    siguiente: contador(dato.siguiente, idsMesa, /^M(\d+)$/),
    siguienteBanda: contador(dato.siguienteBanda, idsBanda, /^banda(\d+)$/),
    siguienteBloque: contador(dato.siguienteBloque, idsBloque, /^F(\d+)$/),
    siguienteForma: contador(dato.siguienteForma, idsForma, /^P(\d+)$/),
    zonas: zonasLimpias,
    siguienteZona: contador(dato.siguienteZona, idsZona, /^zona(\d+)$/),
    siguienteButaca: contador(dato.siguienteButaca, idsButaca, /^B(\d+)$/),
  };
  const sala = generarPlano(definicionDeMapa(mapa));
  const aforo = motivoDeAforo(butacas.length);
  if (aforo) return { errores: [aforo] };
  const fallo = primeraPiezaQueNoCabe(sala);
  if (fallo) return { errores: [fallo.pieza.nombre + ' ' + fallo.motivo] };
  return { mapa };
}

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

// La zona que una banda tiene para ella sola: nadie mas la usa, ni otra banda ni una
// pieza con zona propia. Es la que se puede renombrar desde la fila de la banda, porque
// renombrarla no cambia el precio de nada mas.
function zonaExclusivaDeBanda(plano, id) {
  const banda = nodosDeBandas(plano.bandas).find((b) => b.id === id);
  const zona = banda && zonaDeBanda(banda);
  if (!zona) return null;
  const otras = nodosDeBandas(plano.bandas).filter((b) => b.id !== id && zonaDeBanda(b) === zona);
  const piezas = [...(plano.mesas || []), ...(plano.bloquesFilas || []), ...(plano.butacasSueltas || [])]
    .filter((p) => p.zona === zona);
  return otras.length || piezas.length ? null : zona;
}

// Le da a una banda una zona nueva, con su nombre y precio 0. El nombre de la banda
// pasa a ser el de la zona: en el panel son lo mismo.
// El hueco de una zona nueva: el primer id «zonaN» libre y un nombre que no choque,
// numerado a partir del que se pida («General 2»). No toca el plano, lo devuelve, y es
// el unico sitio donde se decide como se llama y que id lleva una zona recien nacida.
function zonaNueva(lista, siguiente, nombreBase) {
  const base = String(nombreBase || '').trim().slice(0, NOMBRE_MAXIMO) || 'Zona';
  let nombre = base;
  for (let n = 2; lista.some((z) => z.nombre.toLowerCase() === nombre.toLowerCase()); n++) nombre = base + ' ' + n;
  let k = siguiente || 1;
  while (lista.some((z) => z.id === 'zona' + k)) k++;
  return { zona: { id: 'zona' + k, nombre, precio: 0 }, siguiente: k + 1 };
}

function zonaNuevaParaBanda(plano, id, nombre) {
  const nuevo = copiarPlano(plano);
  const u = ubicar(nuevo.bandas, id);
  if (!u) return { motivo: 'esa banda ya no existe' };
  const lista = copiarZonas(zonasDe(nuevo));
  if (lista.length >= ZONAS_MAXIMAS) return { motivo: 'ya hay el máximo de zonas (' + ZONAS_MAXIMAS + ')' };
  const { zona, siguiente } = zonaNueva(lista, nuevo.siguienteZona, nombre);
  lista.push(zona);
  nuevo.zonas = lista;
  nuevo.siguienteZona = siguiente;
  u.item.zona = zona.id;
  delete u.item.nombre;   // el nombre vive ahora en la zona
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

// Asigna una zona a un asiento. Si es su zona de siempre ('original'), se quita la
// asignacion. Devuelve el plano nuevo.
function asignarZonaAsiento(plano, id, zona, original) {
  const nuevo = copiarPlano(plano);
  nuevo.zonasDeAsiento = { ...(nuevo.zonasDeAsiento || {}) };
  if (zona === original) delete nuevo.zonasDeAsiento[id];
  else nuevo.zonasDeAsiento[id] = zona;
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
  return nuevo;
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
  return { plano: nuevo, ids: [...copias.values()] };
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
      const { ancho, alto } = huellaDe(destino);
      for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
        destinoOcupado.set(celda(destino.x + x, destino.y + y), nombreDeConfig(c));
      }
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

// La zona propia de varias piezas: sin zona ('' o null) vuelven a heredar la de su banda.
function cambiarZonaDePiezas(plano, ids, zona) {
  const nuevo = copiarPlano(plano);
  for (const id of ids) {
    const config = configEnPlano(nuevo, id);
    if (!config || esForma(config)) continue;   // una forma no tiene butacas ni zona
    if (zona) config.zona = zona;
    else delete config.zona;
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
  return resultado;
}

// ---------------------------------------------------------------------------
// Zonas editables. Devuelven un plano nuevo o { motivo }.
// ---------------------------------------------------------------------------
// Cuantas veces usan una zona las bandas y las piezas con zona propia. Una pieza que
// hereda no cuenta: su zona ya la sujeta la banda.
function usosDeZona(plano, id) {
  const bandas = nodosDeBandas(plano.bandas).filter((b) => zonaDeBanda(b) === id).length;
  const piezas = [...(plano.mesas || []), ...(plano.bloquesFilas || []), ...(plano.butacasSueltas || [])]
    .filter((p) => p.zona === id).length;
  const asientos = Object.values(plano.zonasDeAsiento || {}).filter((z) => z === id).length;
  return bandas + piezas + asientos;
}

// Agrega una zona suelta, «Zona» y las siguientes numeradas, con precio 0 al final de
// la lista. No la ata a ninguna banda: para eso esta zonaNuevaParaBanda.
function agregarZona(plano) {
  const nuevo = copiarPlano(plano);
  const lista = copiarZonas(zonasDe(nuevo));
  if (lista.length >= ZONAS_MAXIMAS) return { motivo: 'ya hay el máximo de zonas (' + ZONAS_MAXIMAS + ')' };
  const { zona, siguiente } = zonaNueva(lista, nuevo.siguienteZona, 'Zona');
  lista.push(zona);
  nuevo.zonas = lista;
  nuevo.siguienteZona = siguiente;
  return nuevo;
}

// Cambia el nombre o el precio (en centavos) de una zona.
function editarZona(plano, id, { nombre, precio }) {
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
  if (precio !== undefined) {
    if (!esEntero(precio, 0, PRECIO_MAXIMO)) return { motivo: 'el precio debe ser de 0 a 1,000,000.00' };
    zona.precio = precio;
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

// Una pieza con butacas que cae fuera de toda banda con zona se queda sin precio de
// quien heredar, asi que se le escribe el suyo: el editor no guarda una pieza sin zona.
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

// Lee un precio escrito en pesos («350», «350.50», «$1,200.00») y lo da en centavos, o null.
function leerPrecio(texto) {
  const limpio = String(texto).replace(/[$\s,]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const centavos = Math.round(Number(limpio) * 100);
  return centavos <= PRECIO_MAXIMO ? centavos : null;
}

// ---------------------------------------------------------------------------
// Mesas completas.
//
// El organizador decide mesa por mesa si se vende completa (un solo control, que
// elige todos sus lugares a la vez) o lugar por lugar. El precio de una mesa completa
// es la suma de sus lugares libres, cada uno al de su zona; los bloqueados no se venden.
// ---------------------------------------------------------------------------
// Marca o desmarca una mesa como completa. Devuelve el plano nuevo o { motivo }.
function marcarMesaCompleta(plano, id, completa) {
  if (!(plano.mesas || []).some((m) => m.id === id)) return { motivo: 'esa mesa ya no existe' };
  return marcarVenta(plano, completa, (m) => m.id === id);
}

// Lo mismo para todas las mesas del plano.
const marcarTodasLasMesas = (plano, completa) => marcarVenta(plano, completa, () => true);

// Los lugares de una mesa, en orden.
const lugaresDeMesa = (id, lista) => lista.filter((b) => b.grupo && b.grupo.id === id);

// Elige o suelta una butaca. En una mesa completa, elige o suelta todos sus lugares
// libres a la vez. Devuelve si quedo elegida (o null si no se puede elegir).
function alternarEleccion(ids, butaca, lista) {
  if (!butaca || butaca.estado !== 'libre') return null;
  if (!butaca.grupo || !butaca.grupo.completa) {
    if (ids.delete(butaca.id)) return false;
    ids.add(butaca.id);
    return true;
  }
  const libres = lugaresDeMesa(butaca.grupo.id, lista).filter((b) => b.estado === 'libre');
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
  const mesasCompletas = new Map();
  for (const b of lista) {
    if (b.grupo && b.grupo.completa) mesasCompletas.set(b.grupo.id, b.grupo.nombre);
  }
  for (const [id, nombre] of mesasCompletas) {
    const libres = lugaresDeMesa(id, lista).filter((b) => b.estado === 'libre');
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

// Historial acotado por mapa. La firma compara el diseño visible; el plano conserva
// también si se estaba usando la plantilla original (null) para restaurarla tal cual.
function crearHistorial(inicial, maximo = 51) {
  const estados = [inicial];
  let indice = 0;
  let guardado = inicial.firma;
  return {
    registrar(estado) {
      if (estado.firma === estados[indice].firma) return false;
      estados.splice(indice + 1);
      estados.push(estado);
      if (estados.length > maximo) estados.shift();
      indice = estados.length - 1;
      return true;
    },
    deshacer() { return indice ? estados[--indice] : null; },
    rehacer() { return indice < estados.length - 1 ? estados[++indice] : null; },
    puedeDeshacer() { return indice > 0; },
    puedeRehacer() { return indice < estados.length - 1; },
    marcarGuardado() { guardado = estados[indice].firma; },
    tieneCambios() { return estados[indice].firma !== guardado; },
  };
}

// === Fin de la parte sin DOM. pruebas.mjs evalua todo lo anterior en Node. ===
