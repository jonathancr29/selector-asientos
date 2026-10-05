
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
    for (const b of butacas) { b.nivel = n.id; b.nombreNivel = n.nombre; }
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
  for (const mesa of mesas.filter((m) => m.completa)) {
    const lugares = butacas.filter((b) => b.grupo && b.grupo.id === mesa.id);
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

function reasignarZonaFisica(plano, ids, zona) {
  if (!zonasDe(plano).some((z) => z.id === zona)) return { motivo: 'zona física desconocida' };
  const nuevo = copiarPlano(plano);
  const elegidos = new Set(ids);
  for (const f of Object.values(nuevo.identidadFisica || {})) if (elegidos.has(f.id)) {
    fijarZonaInventario(nuevo, f, zona);
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
function motivoDeCabecera(dato) {
  if (!dato || typeof dato !== 'object' || Array.isArray(dato)) return 'el archivo no contiene un mapa';
  if (dato.formato !== FORMATO_MAPA) return 'no es un mapa de este selector de asientos';
  if (![1, 2, 3, 4, 5, 6, 7, VERSION_MAPA].includes(dato.version)) return 'versión de mapa no compatible (' + dato.version + ')';
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
      limpio[t.lista].push({ id: e.id, nombre: e.nombre.trim(), nivel: e.nivel, zona: e.zona });
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
    for (const p of m.bloquesFilas) {
      if (p.region && !m.regionesLibres.some((r) => r.id === p.region)) errores.push('región desconocida de ' + p.id);
      for (const [clave, a] of Object.entries(p.ajustes || {})) if (m.identidadFisica[p.id + '-' + clave]?.id !== a.id) errores.push('corrección de un ID retirado o distinto');
    }
    const dibujo = [...nodosDeBandas(m.bandas).map((p) => p.id), ...piezasDe(m).filter((p) => p.id).map((p) => p.id), ...m.regionesLibres.map((r) => r.id)];
    for (const id of dibujo) { if (idsDibujo.has(id)) errores.push('ID de dibujo repetido entre niveles: ' + id); idsDibujo.add(id); }
    for (const [k, f] of Object.entries(m.identidadFisica)) { if (identidad[k]) errores.push('clave de lugar repetida entre niveles'); identidad[k] = f; }
    if (!i) { principal = m; niveles.push({ id: n.id, nombre: n.nombre.trim() }); }
    else niveles.push({ id: n.id, nombre: n.nombre.trim(), plano: geometriaDeNivel(m) });
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
  for (const b of butacas) if (elegidas.has(b.grupo?.tipo === 'palco' ? b.bloque || b.suelta : b.grupo?.id || b.bloque || b.suelta)) {
    const f = nuevo.identidadFisica?.[b.claveDiseno || b.id];
    if (f) fijarZonaInventario(nuevo, f, destinos.get(b.grupo?.tipo === 'palco' ? b.bloque || b.suelta : b.grupo?.id || b.bloque || b.suelta));
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

// Agrega una zona fisica suelta, «Zona» y las siguientes numeradas al final de
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
    actualizarActual(estado) { estados[indice] = estado; },
    marcarGuardado() { guardado = estados[indice].firma; },
    tieneCambios() { return estados[indice].firma !== guardado; },
  };
}

// El evento vive aparte: nunca se escribe en planos, mapas ni localStorage.
let eventoConectado = null;

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
  const exportacion = exportarLugaresDeMapa(datoMapa);
  if (exportacion.errores) return exportacion;
  const catalogo = exportacion.catalogo;
  const r = catalogo.revision;
  const error = (mensaje) => ({ errores: [mensaje] });
  if (r.estado !== 'publicada') return error('el evento requiere una revisión física publicada');
  if (!dato || dato.formato !== 'sintaquilla/evento-asientos' || dato.version !== 1) return error('formato de evento no compatible');
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
  const indices = Object.fromEntries(TIPOS_REFERENCIA_EVENTO.map((t) => [t, new Set()]));
  for (const p of catalogo.lugares) for (const [t, id] of Object.entries(referenciasDeLugar(p))) if (id) indices[t].add(id);
  // Tambien se pueden cerrar grupos o zonas vacios, sin fabricar lugares.
  for (const z of datoMapa.zonas) indices.zona.add(z.id);
  for (const n of catalogo.niveles) indices.nivel.add(n.id);
  for (const s of catalogo.sectores) indices.sector.add(s.id);
  for (const f of catalogo.filas) indices.fila.add(f.id);
  for (const g of catalogo.grupos) indices.grupo.add(g.id);
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
    idsPublicos.add(p.event_place_id);
    estados.set(p.local_place_id, { event_place_id: p.event_place_id, estado: p.estado ?? 'desconocido' });
  }
  if (estados.size !== catalogo.lugares.length) return error('faltan identidades de lugares del evento');
  const lugares = new Map();
  for (const p of catalogo.lugares) {
    const refs = referenciasDeLugar(p);
    const excluido = Object.entries(refs).some(([t, id]) => exclusiones[t].has(id));
    const tarifas = new Set(Object.entries(refs).map(([t, id]) => asignaciones[t].get(id)).filter(Boolean));
    if (tarifas.size > 1) return error('tarifas contradictorias para ' + p.label);
    const categoria = categorias.get([...tarifas][0]);
    const habilitado = !p.blocked && !excluido;
    if (habilitado && (!categoria || !categoria.activa)) return error('falta una categoría activa para ' + p.label);
    const estado = estados.get(p.local_place_id);
    const disponible = habilitado && estado.estado === 'libre';
    lugares.set(p.local_place_id, { ...p, ...estado, categoria: categoria || null, habilitado, disponible,
      comprable: disponible, motivo: p.blocked ? 'físicamente inutilizable' : excluido ? 'no habilitado para esta función' :
        estado.estado === 'desconocido' ? 'disponibilidad sin confirmar' : estado.estado === 'reservado' ? 'reservado' : estado.estado === 'vendido' ? 'vendido' : '' });
    if (p.physical_group && !p.blocked) grupos.get(p.physical_group.id).requeridos.push(p.local_place_id);
  }
  for (const g of grupos.values()) {
    g.comprable = g.requeridos.length > 0 && g.requeridos.every((id) => lugares.get(id).disponible);
    if (g.modalidad === 'completa' && !g.comprable) for (const id of g.requeridos) {
      const p = lugares.get(id); p.comprable = false;
      if (p.disponible) p.motivo = 'conjunto completo no disponible';
    }
  }
  return { evento: { cabecera: { id: e.id, nombre: e.nombre, moneda: e.moneda, versionEstado: e.versionEstado,
    revision: { ...r } }, lugares, grupos, categorias, catalogo } };
}

function conteosDeEvento(evento) {
  const lista = [...evento.lugares.values()];
  return { inventariados: lista.length, utilizables: lista.filter((p) => !p.blocked).length,
    habilitados: lista.filter((p) => p.habilitado).length, disponibles: lista.filter((p) => p.disponible).length,
    comprables: lista.filter((p) => p.comprable).length,
    conjuntosComprables: [...evento.grupos.values()].filter((g) => g.modalidad === 'completa' && g.comprable).length };
}

function firmaDeEvento(evento) {
  const ordenar = (lista) => lista.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify({ cabecera: evento.cabecera,
    lugares: ordenar([...evento.lugares.values()].map((p) => [p.local_place_id, p.event_place_id, p.estado,
      p.habilitado, p.categoria?.id ?? null, p.categoria?.precioCentavos ?? null])),
    grupos: ordenar([...evento.grupos.values()].map((g) => [g.id, g.event_group_id, g.modalidad])) });
}

function motivoCambioDeEvento(actual, nuevo) {
  if (nuevo.cabecera.id !== actual.cabecera.id) return 'La respuesta pertenece a otro evento.';
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

function solicitudDeSeleccionEvento(ids, evento) {
  const lugares = [], grupos = new Set();
  let totalCentavos = 0;
  for (const id of ids) {
    const p = evento.lugares.get(id);
    if (!p?.comprable) return { errores: ['la selección incluye un lugar no comprable'] };
    const g = evento.grupos.get(p.physical_group?.id);
    if (g?.modalidad === 'completa') {
      if (!g.requeridos.every((x) => ids.has(x))) return { errores: ['la selección contiene un conjunto parcial'] };
      grupos.add(g.event_group_id);
    } else lugares.push(p.event_place_id);
    totalCentavos += p.categoria.precioCentavos;
  }
  if (!Number.isSafeInteger(totalCentavos)) return { errores: ['importe fuera de rango'] };
  return { solicitud: { event_id: evento.cabecera.id, revision: { ...evento.cabecera.revision },
    state_version: evento.cabecera.versionEstado, event_place_ids: lugares, event_group_ids: [...grupos] },
    cantidad: ids.size, totalCentavos };
}

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

// === Fin de la parte sin DOM. pruebas.mjs evalua todo lo anterior en Node. ===

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
const svg = document.getElementById('plano');
const capaMuebles = document.getElementById('muebles');
const capaRealceZona = document.getElementById('realce-zona');
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
const etiquetaDe = (b) => ((salaActual?.niveles?.length > 1 ? b.nombreNivel + ', ' : '') + (b.sectorFisico ? b.sectorFisico.nombre + ', ' : '') + (b.grupo?.tipo === 'palco' ? zonas[b.zona].nombre + ', ' + b.grupo.nombre + ', lugar ' + b.numero : b.grupo ? zonas[b.zona].nombre + ', mesa ' + b.numeroMesa +
  (b.grupo.completa ? ' completa' : '') + ', lugar ' + b.numero
  : b.seccion + ', fila ' + b.fila + ', butaca ' + b.numero));

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
  const palcos = new Map();
  for (const b of butacasVisibles()) if (b.grupo?.tipo === 'palco') {
    if (!palcos.has(b.grupo.id)) palcos.set(b.grupo.id, []);
    palcos.get(b.grupo.id).push(b);
  }
  for (const lista of palcos.values()) {
    const x = Math.min(...lista.map((b) => b.x));
    const y = Math.min(...lista.map((b) => b.y));
    const ancho = Math.max(...lista.map((b) => b.x)) + 1 - x;
    const alto = Math.max(...lista.map((b) => b.y)) + 1 - y;
    const g = nodo('g', { class: 'palco-fisico', 'aria-hidden': 'true' });
    g.append(nodo('rect', { x: x * PASO - 2, y: y * PASO - 2, width: ancho * PASO + 4, height: alto * PASO + 4, rx: 3 }),
      texto('subtitulo', x * PASO, y * PASO - 4, lista[0].grupo.nombre));
    capaMuebles.appendChild(g);
  }
  for (const r of planos[tipoActual]?.regionesLibres || TIPOS_DE_SALA[tipoActual].regionesLibres || []) {
    const g = nodo('g', { class: 'region-libre', 'aria-hidden': 'true', transform: `translate(${r.x * PASO} ${r.y * PASO}) rotate(${r.giro})` });
    g.append(nodo('rect', { x: 0, y: 0, width: r.ancho * PASO, height: r.alto * PASO, rx: 2 }), texto('subtitulo', 3, 5, r.nombre));
    capaMuebles.appendChild(g);
  }
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
  const numerando = modo === 'editor' && ['numeracion', 'ajustar', 'fisica'].includes(herramienta);
  const pincel = document.getElementById('zona-pincel').value;
  // En el primer dibujo se injerta un fragmento. En los siguientes, cada id conserva
  // su nodo, foco y lugar en el arbol si no cambio; solo se mueven los que cambiaron
  // de orden y se quitan los ids que ya no existen.
  const trozo = anteriores.size ? null : document.createDocumentFragment();
  let siguiente = capaButacas.firstElementChild;
  butacasVisibles().forEach((b, indice) => {
    const seleccionable = b.estado === 'libre';
    const elegida = modo === 'editor' && herramienta === 'fisica' ? seleccionFisica.has(b.id) : elegidas.has(b.id);
    // Al bloquear, cada butaca es un checkbox de «bloqueada»; las ocupadas no se tocan.
    // Con el pincel, cada butaca es un checkbox de «de la zona elegida», marcada con la
    // palomita si ya es de esa zona. Las ocupadas no cambian de zona.
    const dePincel = pintando && b.zona === pincel;
    const marcada = bloqueando ? b.estado === 'bloqueada' : pintando ? dePincel : elegida;
    const inactiva = numerando ? false : bloqueando || pintando ? b.estado === 'ocupada' : !seleccionable;
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
    const pieza = b.grupo && b.grupo.tipo !== 'palco' ? b.grupo.id : b.bloque || b.suelta || '';
    const clase = 'butaca' + (seleccionable ? '' : ' ' + b.estado) +
      (modo === 'editor' && herramienta === 'fisica' && seleccionFisica.has(b.id) ? ' fisica-seleccionada' : '') +
      (elegida || dePincel ? ' elegida' : '') +
      (piezasActivas.has(pieza) && modo === 'editor' && !conButacas() ? ' de-pieza-activa' : '');
    const etiqueta = etiquetaDe(b) + (bloqueando
      ? (b.estado === 'ocupada' ? ', ocupada' : ', bloquear')
      : pintando ? ', zona ' + zonas[b.zona].nombre + (b.estado === 'ocupada' ? ', ocupada' : '')
      : (b.motivoEvento ? ', ' + b.motivoEvento : seleccionable ? '' : ', ' + b.estado));
    // tabindex movil: un solo punto de tabulacion. Colocando mesas, ninguno.
    const tabindex = (modo === 'vista' || conButacas()) && indice === 0 ? '0' : '-1';
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
    const pieza = nodo(m.geo.libre ? 'path' : 'rect', {
      class: 'pieza' + (activa ? ' activa' : ''), x: m.x * PASO + 0.5, y: m.y * PASO + 0.5,
      width: m.geo.ancho * PASO - 1, height: m.geo.alto * PASO - 1, rx: 3,
      role: 'button', 'aria-label': etiquetaPieza(m), 'aria-describedby': 'pista',
      'aria-pressed': String(activa),
      tabindex: (hayActiva ? principal : indice === 0) ? '0' : '-1',
    });
    if (m.geo.libre) {
      pieza.setAttribute('d', m.geo.lugares.map((l) => `M${(m.x+l.dx)*PASO+.5},${(m.y+l.dy)*PASO+.5}h${PASO-1}v${PASO-1}h${1-PASO}z`).join(' '));
    }
    pieza.dataset.pieza = m.id;
    capaPiezas.appendChild(pieza);
  });
}

function dibujarTodo() {
  if (eventoConectado) aplicarEventoAButacas();
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
  actualizarExploradorZonas();
}

// ---------------------------------------------------------------------------
// Panel de bandas (editor). Es HTML normal: una lista con botones, recorrible
// con Tab. Se rehace entero con cada cambio y el foco vuelve al mismo control.
// ---------------------------------------------------------------------------
const listaBandas = document.getElementById('lista-bandas');

// Estado transitorio del visor; no pertenece al plano ni a la selección de compra.
let zonaExplorada = null;
const botonesZonasVista = document.getElementById('zonas-vista');
const selectorNivelZona = document.getElementById('nivel-zona');
const lugaresDeZonaVisible = () => butacasVisibles().filter((b) => b.zona === zonaExplorada);

function textoDeZona(lista) {
  const r = resumenDeZona(lista, eventoConectado);
  const nombreNivel = salaActual.niveles.find((n) => n.id === salaActual.nivel)?.nombre || '';
  const partes = [zonas[zonaExplorada].nombre + ' · ' + nombreNivel,
    r.inventariados + ' lugares físicos'];
  if (!eventoConectado) return partes.join(' · ') + ' · Precio no disponible · Disponibilidad sin confirmar';
  const formato = new Intl.NumberFormat('es-MX', { style: 'currency', currency: eventoConectado.cabecera.moneda });
  const precio = (v) => v === 0 ? 'Gratis' : formato.format(v / 100);
  const rango = (ps) => ps.length === 1 ? precio(ps[0]) : 'De ' + precio(ps[0]) + ' a ' + precio(ps.at(-1));
  partes.push(r.habilitados ? r.habilitados + ' habilitados' : 'No habilitada para esta función');
  partes.push(r.comprables + ' lugares comprables');
  if (r.desconocidos) partes.push(r.desconocidos + ' con disponibilidad sin confirmar');
  if (r.preciosIndividuales.length) partes.push(rango(r.preciosIndividuales) + ' por lugar');
  if (r.conjuntos.length) {
    const ps = [...new Set(r.conjuntos.map((g) => g.precioCentavos).filter((v) => v !== null))].sort((a, b) => a - b);
    const palcos = r.conjuntos.every((g) => g.tipo === 'box');
    partes.push(r.conjuntos.filter((g) => g.comprable).length + (palcos ? ' palcos completos comprables' : ' conjuntos completos comprables'));
    if (ps.length) partes.push(rango(ps) + (palcos ? ' por palco completo' : ' por conjunto completo'));
  }
  if (!r.preciosIndividuales.length && !r.conjuntos.some((g) => g.precioCentavos !== null)) partes.push('Precio no disponible');
  return partes.join(' · ');
}

function actualizarExploradorZonas() {
  const panel = document.getElementById('explorador-zonas');
  panel.hidden = modo !== 'vista';
  capaRealceZona.textContent = '';
  if (panel.hidden) return;
  const presentes = new Set(butacas.map((b) => b.zona));
  if (zonaExplorada && !presentes.has(zonaExplorada)) zonaExplorada = null;
  for (const boton of [...botonesZonasVista.children]) if (!presentes.has(boton.dataset.zona)) boton.remove();
  for (const [id, z] of Object.entries(zonas)) {
    if (!presentes.has(id)) continue;
    let boton = [...botonesZonasVista.children].find((b) => b.dataset.zona === id);
    if (!boton) {
      boton = document.createElement('button'); boton.type = 'button'; boton.dataset.zona = id;
      botonesZonasVista.appendChild(boton);
    }
    boton.textContent = z.nombre;
    boton.setAttribute('aria-pressed', String(zonaExplorada === id));
    boton.setAttribute('aria-controls', 'panel-nivel resumen-zona');
  }
  document.getElementById('quitar-realce-zona').hidden = !zonaExplorada;
  const niveles = salaActual.niveles.filter((n) => butacas.some((b) => b.zona === zonaExplorada && b.nivel === n.id));
  document.getElementById('etiqueta-nivel-zona').hidden = niveles.length < 2;
  const opciones = JSON.stringify(niveles.map((n) => [n.id, n.nombre]));
  if (selectorNivelZona.dataset.opciones !== opciones) {
    selectorNivelZona.textContent = '';
    for (const n of niveles) selectorNivelZona.appendChild(new Option(n.nombre, n.id));
    selectorNivelZona.dataset.opciones = opciones;
  }
  selectorNivelZona.value = salaActual.nivel;
  const resumen = document.getElementById('resumen-zona');
  if (!zonaExplorada) { resumen.textContent = 'Elige una zona para ver su ubicación e información.'; return; }
  const lista = lugaresDeZonaVisible();
  resumen.textContent = lista.length ? textoDeZona(lista) : zonas[zonaExplorada].nombre + ' · Esta zona está en otro nivel.';
  for (const puntos of contornosDeZona(lista)) {
    capaRealceZona.appendChild(nodo('path', { d: puntos.map((p, i) => (i ? 'L' : 'M') + p.x * PASO + ',' + p.y * PASO).join(' ') + 'Z' }));
  }
}

function encuadrarZona() {
  const lista = lugaresDeZonaVisible();
  if (!lista.length) return;
  const caja = svg.getBoundingClientRect();
  if (!caja.width || !caja.height) return;
  const xs = lista.map((b) => b.x), ys = lista.map((b) => b.y);
  const x = (Math.min(...xs) - 1.5) * PASO, y = (Math.min(...ys) - 1.5) * PASO;
  const w = (Math.max(...xs) - Math.min(...xs) + 4) * PASO;
  const h = (Math.max(...ys) - Math.min(...ys) + 4) * PASO;
  const ancho = Math.min(vistaInicial.w, Math.max(VISTA_MINIMA, w, h * caja.width / caja.height));
  vista = { x: x + w / 2 - ancho / 2, y: y + h / 2 - ancho * caja.height / caja.width / 2,
    w: ancho, h: ancho * caja.height / caja.width };
  aplicarVista();
}

function explorarZona(id, nivel = null) {
  if (modo !== 'vista' || !zonas[id]) return;
  const lista = butacas.filter((b) => b.zona === id);
  if (!lista.length) return;
  zonaExplorada = id;
  const destino = nivel || (lista.some((b) => b.nivel === salaActual.nivel) ? salaActual.nivel : lista[0].nivel);
  cambiarNivelVista(destino);
  actualizarExploradorZonas();
  reencuadrar();
  encuadrarZona();
}

botonesZonasVista.addEventListener('click', (e) => {
  const boton = e.target.closest('button[data-zona]');
  if (boton) explorarZona(boton.dataset.zona);
});
botonesZonasVista.addEventListener('keydown', (e) => {
  const boton = e.target.closest('button[data-zona]');
  if (boton && ['Enter', ' '].includes(e.key)) { e.preventDefault(); boton.click(); }
});
selectorNivelZona.addEventListener('change', () => explorarZona(zonaExplorada, selectorNivelZona.value));
document.getElementById('quitar-realce-zona').addEventListener('click', () => {
  zonaExplorada = null; actualizarExploradorZonas(); reencuadrar();
});

// Las zonas fisicas que pueden llevar filas (todas menos la de mesas).
// 'heredada' es la zona que la pieza tomaria de su banda: con ella, la primera opcion
// es heredarla, que es como nacen las piezas. Sin ella (una pieza fuera de toda banda
// con zona) hay que elegir una: el plano nunca guarda una butaca sin zona.
function llenarZonasDeFilas(select, actual, { heredada = null, conMesas = false, mezcla = false } = {}) {
  select.textContent = '';
  // Varias piezas con zonas distintas: se ve que no coinciden y elegir una las iguala.
  if (mezcla) select.appendChild(new Option('— varias zonas —', 'mezcla', false, true));
  if (heredada && zonas[heredada]) {
    select.appendChild(new Option('Hereda: ' + zonas[heredada].nombre,
                                  '', false, !actual && !mezcla));
  }
  for (const [id, { nombre }] of Object.entries(zonas)) {
    if (id !== 'mesas' || conMesas) select.appendChild(new Option(nombre, id, false, id === actual));
  }
}

// Un icono del sprite, para los botones que crea el script.
function iconoDe(id) {
  const svgIcono = nodo('svg', { class: 'ico', 'aria-hidden': 'true', focusable: 'false' });
  svgIcono.appendChild(nodo('use', { href: '#i-' + id }));
  return svgIcono;
}

// Boton de icono del panel: el nombre va en aria-label y en el tooltip.
function boton(icono, etiqueta, op, banda, deshabilitado = false) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'icono';
  b.appendChild(iconoDe(icono));
  b.setAttribute('aria-label', etiqueta);
  b.dataset.tooltip = etiqueta;
  b.dataset.op = op;
  b.dataset.banda = banda;
  b.disabled = deshabilitado;
  return b;
}

function dibujarBandas() {
  if (modo !== 'editor') return;
  // Los campos de columnas muestran la sala actual, salvo mientras se escriben.
  const { bloques, pasillos } = distribucionDeSala(salaActual);
  const campoBloques = document.getElementById('bloques-sala');
  const campoPasillos = document.getElementById('pasillos-sala');
  if (document.activeElement !== campoBloques) campoBloques.value = bloques.join(', ');
  if (document.activeElement !== campoPasillos) campoPasillos.value = pasillos.join(', ');
  // Un lienzo solo muestra su ancho; una plantilla, bloques y pasillos.
  for (const id of ['columnas-lienzo', 'ayuda-lienzo']) document.getElementById(id).hidden = !salaActual.lienzo;
  for (const id of ['columnas-plantilla', 'ayuda-columnas']) document.getElementById(id).hidden = salaActual.lienzo;
  const campoAncho = document.getElementById('ancho-lienzo');
  if (document.activeElement !== campoAncho) campoAncho.value = String(salaActual.ancho);
  const activo = document.activeElement;
  const foco = listaBandas.contains(activo) ? { op: activo.dataset.op, banda: activo.dataset.banda } : null;
  listaBandas.textContent = '';
  for (const li of filasDeBandas(salaActual.bandas, false)) listaBandas.appendChild(li);
  if (foco) {
    const destino = listaBandas.querySelector(`[data-op="${foco.op}"][data-banda="${foco.banda}"]`);
    if (destino && !destino.disabled) destino.focus();
    else document.getElementById('agregar-banda-filas').focus();
  }
}

// Catalogo de zonas fisicas, separado de la distribucion: se rehace y el foco
// vuelve al mismo control.
const listaZonas = document.getElementById('lista-zonas');

function dibujarZonas() {
  if (modo !== 'editor') return;
  const antecedentes = planos[tipoActual]?.antecedentesComerciales || TIPOS_DE_SALA[tipoActual].antecedentesComerciales;
  const aviso = document.getElementById('antecedentes-comerciales');
  const precios = antecedentes?.preciosPorZona.length || 0;
  const completas = antecedentes?.mesasCompletas.length || 0;
  aviso.hidden = !precios && !completas;
  aviso.textContent = 'Antecedentes pendientes de revisión: ' + precios + ' precios de zona y ' + completas +
    ' mesas completas. Se conservan al guardar, pero no configuran este mapa ni futuros eventos.';
  const activo = document.activeElement;
  const foco = listaZonas.contains(activo) ? { op: activo.dataset.op, zona: activo.dataset.zona } : null;
  listaZonas.textContent = '';
  const usadas = { bandas: salaActual.bandas, mesas, bloquesFilas, butacasSueltas,
    zonasDeAsiento: Object.fromEntries(butacas.filter((b) => b.zona !== b.zonaOriginal).map((b) => [b.id, b.zona])) };
  const sueltas = Object.entries(zonas);
  listaZonas.hidden = false;
  for (const [id, { nombre }] of sueltas) {
    const li = document.createElement('li');
    li.className = 'banda';
    const campo = (clase, op, valor, etiqueta, extra = {}) => {
      const input = document.createElement('input');
      Object.assign(input, { type: 'text', className: clase, value: valor, autocomplete: 'off' }, extra);
      input.setAttribute('aria-label', etiqueta);
      input.dataset.op = op;
      input.dataset.zona = id;
      return input;
    };
    const lugares = butacas.filter((b) => b.zona === id).length;
    const detalle = document.createElement('span');
    detalle.className = 'banda-detalle';
    detalle.textContent = plural(lugares, 'lugar', 'lugares') + (id === 'mesas' ? ' · lugares de mesa' : '');
    const usos = id === 'mesas' ? 0 : usosDeZona(usadas, id);
    const eliminar = document.createElement('button');
    eliminar.type = 'button';
    eliminar.className = 'icono';
    eliminar.appendChild(iconoDe('eliminar'));
    eliminar.setAttribute('aria-label', 'Eliminar la zona ' + nombre);
    eliminar.dataset.tooltip = 'Eliminar la zona ' + nombre;
    eliminar.dataset.op = 'eliminar-zona';
    eliminar.dataset.zona = id;
    eliminar.disabled = id === 'mesas' || usos > 0 || Object.keys(zonas).filter((z) => z !== 'mesas').length <= 1;
    li.append(
      campo('nombre-zona', 'nombre-zona', nombre, 'Nombre de la zona ' + nombre, { maxLength: NOMBRE_MAXIMO }),
      eliminar, detalle);
    listaZonas.appendChild(li);
  }
  if (foco) {
    const destino = listaZonas.querySelector('[data-op="' + foco.op + '"][data-zona="' + foco.zona + '"]');
    if (destino && !destino.disabled) destino.focus();
    else document.getElementById('agregar-zona').focus();
  }
}

function aplicarCampoDeZona(campo) {
  const { op, zona: id } = campo.dataset;
  const zona = zonas[id];
  if (!zona) return;
  if (op === 'nombre-zona') {
    const nombre = campo.value.trim();
    if (nombre === zona.nombre) return;
    if (!aplicarBandas(editarZona(planoEditable(), id, { nombre }), zona.nombre + ' se llama ahora «' + nombre + '».')) {
      campo.value = zona.nombre;
    }
    return;
  }

}

listaZonas.addEventListener('change', (e) => {
  const campo = e.target.closest('input[data-zona]');
  if (campo) aplicarCampoDeZona(campo);
});
listaZonas.addEventListener('keydown', (e) => {
  const campo = e.target.closest('input[data-zona]');
  if (!campo) return;
  if (e.key === 'Enter') {
    aplicarCampoDeZona(campo);
  } else if (e.key === 'Escape') {
    const zona = zonas[campo.dataset.zona];
    if (zona) campo.value = zona.nombre;
  }
});
listaZonas.addEventListener('click', (e) => {
  const boton = e.target.closest('button[data-op="eliminar-zona"]');
  if (!boton) return;
  const nombre = zonas[boton.dataset.zona].nombre;
  aplicarBandas(eliminarZona(planoEditable(), boton.dataset.zona), 'Zona «' + nombre + '» eliminada.');
});
// Crear zona no modifica la distribucion del plano.
document.getElementById('agregar-zona').addEventListener('click', () => {
  if (!aplicarBandas(agregarZona(planoEditable()), 'Zona física agregada. Escribe su nombre.')) return;
  const campo = listaZonas.querySelector('li:last-child input');
  if (campo) { campo.focus(); campo.select(); }
});

// Los botones de información de los grupos: abren y cierran su texto de ayuda. Van
// dentro del <summary>, así que el clic no debe abrir ni cerrar también el grupo.
for (const [boton, ayuda] of [['info-columnas', 'ayuda-de-columnas'], ['info-zonas', 'ayuda-de-zonas']]) {
  document.getElementById(boton).addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const panel = document.getElementById(ayuda);
    panel.hidden = !panel.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
    reencuadrar();   // en pantallas angostas la ayuda empuja el plano
  });
}

// Una lista de bandas (de la sala o de una vertical) como elementos <li>.
// El principio de la fila de una banda o vertical: muestra de su color, su nombre
// (un campo; vacio, el de por defecto) y la marca de seleccionada.
function inicioDeFila(item, clase) {
  const li = document.createElement('li');
  li.className = clase;
  li.dataset.banda = item.id;
  const detalle = document.createElement('span');
  detalle.className = 'banda-detalle';
  const nombre = document.createElement('span');
  nombre.className = 'banda-nombre';
  if (item.tipo === 'escenario') {
    nombre.textContent = item.nombre;
    li.append(nombre, detalle);
    return { li, detalle };
  }
  li.style.setProperty('--capa', colorDeCapa(item.id));
  if (item.id === bandaActiva) {
    li.classList.add('activa');
    li.setAttribute('aria-current', 'true');
  }
  const muestra = document.createElement('span');
  muestra.className = 'muestra-capa';
  muestra.setAttribute('aria-hidden', 'true');
  const campo = document.createElement('input');
  Object.assign(campo, { type: 'text', maxLength: NOMBRE_MAXIMO, autocomplete: 'off',
                         value: item.nombrePropio || '',
                         placeholder: item.nombre });
  campo.setAttribute('aria-label', 'Nombre de ' + item.nombre);
  campo.dataset.op = 'nombre';
  campo.dataset.banda = item.id;
  nombre.appendChild(campo);
  li.append(muestra, nombre, boton('aplicar', 'Guardar el nombre de ' + item.nombre, 'guardar', item.id), detalle);
  return { li, detalle };
}

// Zona fisica asignada a la banda; varias pueden compartir numeracion.
function selectorDeZona(banda) {
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Zona de ' + banda.nombre);
  select.dataset.op = 'zona';
  select.dataset.banda = banda.id;
  if (banda.tipo !== 'filas' && banda.tipo !== 'mesas') {
    select.appendChild(new Option('Sin zona', '', false, !banda.zona));
  }
  for (const [id, { nombre }] of Object.entries(zonas)) {
    if (id === 'mesas' && banda.tipo === 'filas') continue;   // la de mesas no numera filas
    select.appendChild(new Option(nombre, id, false, id === banda.zona));
  }
  select.appendChild(new Option('Zona nueva…', 'nueva'));
  return select;
}

function filasDeBandas(bandas, enVertical) {
  return bandas.map((banda, i) => {
    const { li, detalle } = inicioDeFila(banda, 'banda');
    const controles = document.createElement('div');
    controles.className = 'banda-controles';
    const n = banda.nombre;
    if (banda.tipo === 'escenario') {
      detalle.textContent = escenario.ausente
        ? 'Franja inicial · sin escenario: agrégalo con «Agregar escenario» en la barra del editor'
        : 'Franja inicial · el escenario se mueve y cambia de tamaño en el plano';
      return li;
    }
    if (banda.tipo === 'filas') {
      detalle.textContent = plural(banda.filas, 'fila', 'filas') +
        (enVertical ? ' · ' + plural(banda.anchoOcupado, 'columna', 'columnas') : '');
      controles.append(
        boton('menos-fila', 'Quitar una fila a ' + n, 'menos', banda.id, banda.filas <= 1),
        boton('mas-fila', 'Agregar una fila a ' + n, 'mas', banda.id, banda.filas >= FILAS_MAXIMAS),
        selectorDeZona(banda));
    } else if (tieneAlto(banda)) {
      detalle.textContent = plural(banda.alto, 'fila', 'filas');
      controles.append(
        boton('menos-fila', 'Quitar una fila de alto a ' + n, 'menos', banda.id, banda.alto <= 1),
        boton('mas-fila', 'Agregar una fila de alto a ' + n, 'mas', banda.id, banda.alto >= ALTO_MAXIMO),
        selectorDeZona(banda));
      if (banda.tipo === 'espacio') {
        const guias = boton('guias', 'Guías de fila en ' + n, 'guias', banda.id);
        guias.setAttribute('aria-pressed', String(Boolean(banda.guias)));
        controles.appendChild(guias);
      }
    } else {
      detalle.textContent = plural(banda.verticales.length, 'banda vertical', 'bandas verticales') +
        ' · ' + plural(banda.alto, 'fila', 'filas');
      controles.append(
        boton('agregar-vertical', 'Agregar una banda vertical a ' + n, 'agregar-vertical', banda.id,
              banda.verticales.length >= VERTICALES_MAXIMAS),
        selectorDeZona(banda));
    }
    const anterior = bandas[i - 1];
    controles.append(
      boton('arriba', 'Subir ' + n, 'subir', banda.id, !anterior || anterior.tipo === 'escenario'),
      boton('abajo', 'Bajar ' + n, 'bajar', banda.id, i === bandas.length - 1),
      boton('duplicar', 'Duplicar ' + n, 'duplicar', banda.id),
      boton('eliminar', 'Eliminar ' + n, 'eliminar', banda.id));
    li.appendChild(controles);
    if (esDivision(banda)) {
      const ol = document.createElement('ol');
      ol.setAttribute('aria-label', 'Bandas verticales de ' + n);
      banda.verticales.forEach((v, k) => ol.appendChild(filaDeVertical(v, k, banda.verticales)));
      li.appendChild(ol);
    }
    return li;
  });
}

function filaDeVertical(v, k, verticales) {
  const { li, detalle } = inicioDeFila(v, 'banda banda-vertical');
  const ultima = k === verticales.length - 1;
  detalle.textContent = plural(v.anchoOcupado, 'columna', 'columnas') + (ultima ? ' (el resto)' : '');
  const n = v.nombre;
  const controles = document.createElement('div');
  controles.className = 'banda-controles';
  controles.append(
    boton('acortar', 'Quitar una columna de ancho a ' + n, 'angosta', v.id, ultima || v.anchoOcupado <= 1),
    boton('alargar', 'Agregar una columna de ancho a ' + n, 'ancha', v.id, ultima),
    boton('izquierda', 'Mover ' + n + ' a la izquierda', 'izquierda', v.id, k === 0),
    boton('derecha', 'Mover ' + n + ' a la derecha', 'derecha', v.id, ultima),
    boton('agregar-filas', 'Agregar una banda de filas en ' + n, 'agregar-filas-en', v.id),
    boton('agregar-mesas', 'Agregar una zona de mesas en ' + n, 'agregar-mesas-en', v.id),
    boton('agregar-espacio', 'Agregar un espacio en ' + n, 'agregar-espacio-en', v.id),
    boton('duplicar', 'Duplicar ' + n, 'duplicar', v.id, verticales.length >= VERTICALES_MAXIMAS),
    boton('eliminar', 'Eliminar ' + n, 'eliminar', v.id, verticales.length === 1));
  li.appendChild(controles);
  const ol = document.createElement('ol');
  ol.setAttribute('aria-label', 'Bandas de ' + n);
  for (const hija of filasDeBandas(v.bandas, true)) ol.appendChild(hija);
  li.appendChild(ol);
  return li;
}

// Aplica un plano nuevo de bandas si todas las mesas siguen cabiendo. Si alguna
// no cabe, se vuelve al plano anterior y se explica cual y por que.
function aplicarBandas(resultado, mensaje) {
  if (resultado.motivo) {
    anunciar('No se pudo: ' + resultado.motivo + '.');
    return false;
  }
  const antes = fotoDeButacas();
  const mesasAntes = new Map([...mesas, ...bloquesFilas, ...formas, ...butacasSueltas].map((m) => [m.id, m.nombre]));
  const previo = planos[tipoActual];
  planos[tipoActual] = resultado;
  salaActual = generarPlano(tipoActual, resultado);
  const errorDeBandas = salaActual.errorDeBandas || motivoDeAforo(butacas.length);
  const fallo = !errorDeBandas && primeraPiezaQueNoCabe(salaActual);
  if (errorDeBandas || fallo) {
    planos[tipoActual] = previo;
    salaActual = generarPlano(tipoActual, previo);
    anunciar('No se pudo: ' + (errorDeBandas || fallo.pieza.nombre + ' ' + fallo.motivo) + '.');
    return false;
  }
  const quitadas = [...mesasAntes].filter(([id]) => !piezasDe(resultado).some((m) => m.id === id))
                                  .map(([, nombre]) => nombre);
  regenerar(mensaje + (quitadas.length ? ' Se quitaron con ella: ' + quitadas.join(', ') + '.' : ''), antes);
  calcularEncuadre();
  return true;
}

// Duplica una banda, vertical o franja y selecciona la copia. Si el foco estaba en
// el panel, pasa al mismo control de la copia.
function duplicarBandaPorId(id) {
  const banda = bandaDe(salaActual, id);
  if (!banda) return;
  const plano = planoEditable();
  const nuevoId = 'banda' + plano.siguienteBanda;
  const esVertical = ubicar(salaActual.bandas, id).esVertical;
  const op = listaBandas.contains(document.activeElement) && document.activeElement.dataset.op;
  if (!aplicarBandas(duplicarBanda(plano, salaActual, id), '')) return;
  const copia = bandaDe(salaActual, nuevoId);
  const destino = op && listaBandas.querySelector('[data-op="' + op + '"][data-banda="' + nuevoId + '"]');
  if (destino && !destino.disabled) destino.focus();
  marcarBandaActiva(nuevoId);
  anunciar(banda.nombre + ' duplicada: ' + copia.nombre + (esVertical ? ', a su derecha.' : ', debajo.') +
           ' Queda seleccionada.');
}

function aplicarNombreDeBanda(campo) {
  const id = campo.dataset.banda;
  const banda = bandaDe(salaActual, id);
  if (!banda) return;
  const nombre = campo.value.trim().slice(0, NOMBRE_MAXIMO);
  if (nombre === (banda.nombrePropio || '')) return;
  aplicarBandas(renombrarBanda(planoEditable(), id, nombre),
    nombre ? banda.nombre + ' se llama ahora «' + nombre + '».' : banda.nombre + ' vuelve a su nombre por defecto.');
}

// Selecciona una banda (o ninguna, con null): contorno en el plano y fila marcada
// en el panel. Sin redibujar, para no perder el foco ni lo que se escribe.
function marcarBandaActiva(id) {
  bandaActiva = id;
  if (id && mesaActiva) marcarActiva(null);
  for (const li of listaBandas.querySelectorAll('li[data-banda]')) {
    const si = li.dataset.banda === id;
    li.classList.toggle('activa', si);
    if (si) li.setAttribute('aria-current', 'true');
    else li.removeAttribute('aria-current');
  }
  dibujarSeleccionBanda();
}

listaBandas.addEventListener('click', (e) => {
  const control = e.target.closest('button[data-op]');
  if (!control) return;
  const { op, banda: id } = control.dataset;
  const plano = planoEditable();
  const banda = bandaDe(salaActual, id);
  const n = banda.nombre;
  if (op === 'menos' || op === 'mas') {
    const delta = op === 'mas' ? 1 : -1;
    const resultado = redimensionarBanda(plano, salaActual, id, delta);
    const valor = banda.tipo === 'filas' ? banda.filas + delta : banda.alto + delta;
    aplicarBandas(resultado, n + ': ' + (banda.tipo === 'filas'
      ? plural(valor, 'fila', 'filas') + '.' : plural(valor, 'fila', 'filas') + ' de alto.'));
  } else if (op === 'subir' || op === 'bajar') {
    aplicarBandas(moverBanda(plano, salaActual, id, op === 'subir' ? -1 : 1),
                  n + (op === 'subir' ? ' subida.' : ' bajada.'));
  } else if (op === 'izquierda' || op === 'derecha') {
    aplicarBandas(moverBanda(plano, salaActual, id, op === 'izquierda' ? -1 : 1),
                  n + ' movida a la ' + op + '.');
  } else if (op === 'angosta' || op === 'ancha') {
    const delta = op === 'ancha' ? 1 : -1;
    aplicarBandas(cambiarAnchoVertical(plano, salaActual, id, delta),
                  n + ': ' + plural(banda.anchoOcupado + delta, 'columna', 'columnas') + '.');
  } else if (op === 'agregar-vertical') {
    aplicarBandas(agregarVertical(plano, salaActual, id), 'Banda vertical agregada a ' + n + '.');
  } else if (op === 'agregar-filas-en' || op === 'agregar-mesas-en' || op === 'agregar-espacio-en') {
    const tipo = op.split('-')[1];
    aplicarBandas(agregarBandaEnVertical(plano, salaActual, id, tipo),
                  { filas: 'Banda de 2 filas agregada', mesas: 'Zona de mesas de 4 filas agregada',
                    espacio: 'Espacio de 4 filas agregado' }[tipo] + ' en ' + n + '.');
  } else if (op === 'guias') {
    aplicarBandas(alternarGuias(plano, id), (banda.guias ? 'Sin guías de fila en ' : 'Guías de fila en ') + n + '.');
  } else if (op === 'guardar') {
    const campo = control.closest('li[data-banda]').querySelector('input[data-op="nombre"]');
    if (campo) aplicarNombreDeBanda(campo);
  } else if (op === 'duplicar') {
    duplicarBandaPorId(id);
  } else if (op === 'eliminar') {
    aplicarBandas(eliminarBanda(plano, salaActual, id), n + ' eliminada.');
  }
});

// Tocar cualquier control de una banda la selecciona.
listaBandas.addEventListener('focusin', (e) => {
  const li = e.target.closest('li[data-banda]');
  if (li && li.dataset.banda !== 'escenario' && li.dataset.banda !== bandaActiva) marcarBandaActiva(li.dataset.banda);
});

listaBandas.addEventListener('keydown', (e) => {
  const campo = e.target.closest('input[data-op]');
  if (!campo) return;
  const esNombre = campo.dataset.op === 'nombre';
  if (e.key === 'Enter') {
    if (esNombre) aplicarNombreDeBanda(campo);
  } else if (e.key === 'Escape') {
    const banda = bandaDe(salaActual, campo.dataset.banda);
    campo.value = (banda && banda.nombrePropio) || '';
  }
});

listaBandas.addEventListener('change', (e) => {
  const campo = e.target.closest('input[data-op]');
  if (campo) {
    if (campo.dataset.op === 'nombre') aplicarNombreDeBanda(campo);
    return;
  }
  const control = e.target.closest('select[data-op]');
  if (!control) return;
  const { op, banda: id } = control.dataset;
  const antes = bandaDe(salaActual, id).nombre;
  if (control.value === 'nueva') {
    if (aplicarBandas(zonaNuevaParaBanda(planoEditable(), id, antes), '')) {
      const puesta = bandaDe(salaActual, id);
      anunciar(antes + ' pasa a la zona física «' + zonas[puesta.zona].nombre + '».');
    }
    return;
  }
  aplicarBandas(cambiarZonaBanda(planoEditable(), id, control.value),
                control.value ? antes + ' pasa a la zona ' + zonas[control.value].nombre + '.'
                              : antes + ' se queda sin zona: lo de dentro hereda de más afuera.');
});

function aplicarColumnas() {
  const { distribucion, motivo } = leerDistribucion(
    document.getElementById('bloques-sala').value, document.getElementById('pasillos-sala').value);
  if (motivo) {
    anunciar('No se pudo: ' + motivo + '.');
    return;
  }
  const { bloques, pasillos } = distribucion;
  const butacasPorFila = bloques.reduce((s, b) => s + b, 0);
  aplicarBandas(cambiarDistribucion(planoEditable(), salaActual, distribucion),
    'Columnas: ' + bloques.join(', ') +
    (pasillos.length ? ' · pasillos de ' + pasillos.join(', ') : ' · sin pasillos') +
    ' · ' + plural(butacasPorFila, 'butaca', 'butacas') + ' por fila.');
}

document.getElementById('aplicar-columnas').addEventListener('click', aplicarColumnas);
for (const id of ['bloques-sala', 'pasillos-sala']) {
  document.getElementById(id).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') aplicarColumnas();
  });
}

document.getElementById('agregar-banda-filas').addEventListener('click', () => {
  aplicarBandas(agregarBanda(planoEditable(), 'filas'), 'Banda de 2 filas agregada al final.');
});
document.getElementById('agregar-banda-mesas').addEventListener('click', () => {
  aplicarBandas(agregarBanda(planoEditable(), 'mesas'), 'Zona de mesas de 4 filas agregada al final.');
});
document.getElementById('agregar-espacio').addEventListener('click', () => {
  aplicarBandas(agregarBanda(planoEditable(), 'espacio'), 'Espacio de 4 filas agregado al final.');
});

function aplicarAnchoLienzo() {
  const texto = document.getElementById('ancho-lienzo').value.trim();
  const ancho = /^\d+$/.test(texto) ? Number(texto) : NaN;
  if (ancho === salaActual.ancho) return;
  aplicarBandas(cambiarAnchoLienzo(planoEditable(), salaActual, ancho),
                'Lienzo de ' + plural(ancho, 'columna', 'columnas') + '.');
}
document.getElementById('aplicar-ancho-lienzo').addEventListener('click', aplicarAnchoLienzo);
document.getElementById('ancho-lienzo').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') aplicarAnchoLienzo();
});

document.getElementById('agregar-division').addEventListener('click', () => {
  aplicarBandas(agregarBanda(planoEditable(), 'division', salaActual.ancho),
                'Franja con dos bandas verticales agregada al final, cada una con un espacio vacío de 4 filas.');
});

// ---------------------------------------------------------------------------
// Zoom y desplazamiento: se mueve el viewBox, no el DOM.
// ---------------------------------------------------------------------------
let vista, vistaInicial;

// El encuadre abarca todo lo dibujado, butacas y muebles (escenario, mesas,
// rotulos de fila), y la sala entera aunque una zona de mesas este vacia, mas
// una celda de margen. Cada elemento ocupa una celda
// salvo que declare w y h.
//
// Si el plano tiene un alto fijo (Previsualizar: ajustado a la pantalla), el encuadre
// se ensancha o se alarga para tener la misma proporcion que el <svg>, centrado. Asi
// el viewBox llena el elemento sin franjas y cada pixel sigue siendo una misma
// distancia en unidades, que es lo que suponen enUnidades y el arrastre.
function calcularEncuadre() {
  const cajas = [...butacasVisibles(), ...muebles, { x: 0, y: 0, w: salaActual.ancho + 1, h: salaActual.alto }];
  const margen = PASO;
  let x = Math.min(...cajas.map((c) => c.x)) * PASO - margen;
  let y = Math.min(...cajas.map((c) => c.y)) * PASO - margen;
  let w = Math.max(...cajas.map((c) => c.x + (c.w || 1))) * PASO + margen - x;
  let h = Math.max(...cajas.map((c) => c.y + (c.h || 1))) * PASO + margen - y;
  const caja = svg.getBoundingClientRect();
  if (caja.width > 0 && caja.height > 0) {
    const proporcion = caja.width / caja.height;
    if (w / h < proporcion) {
      const ancho = h * proporcion;
      x -= (ancho - w) / 2;
      w = ancho;
    } else {
      const alto = w / proporcion;
      y -= (alto - h) / 2;
      h = alto;
    }
  }
  vistaInicial = { x, y, w, h };
  vista = { ...vistaInicial };
  aplicarVista();
}

// El alto del plano lo da el CSS: en escritorio, el hueco entre el encabezado y el pie
// (la sala se ve completa sin scroll); en pantallas angostas o bajas, el ancho. Aqui solo
// se limpia un alto puesto a mano por una version anterior.
function ajustarAltoDelPlano() {
  if (svg.style.height) svg.style.height = '';
}

// Vuelve a ajustar el alto y el encuadre. Con 'conservarZoom', mantiene el centro y la
// proporcion de zoom de la vista actual (al cambiar el tamaño de la ventana).
function reencuadrar(conservarZoom = false) {
  const anterior = conservarZoom && vista && vistaInicial
    ? { factor: vista.w / vistaInicial.w, cx: vista.x + vista.w / 2, cy: vista.y + vista.h / 2 } : null;
  ajustarAltoDelPlano();
  calcularEncuadre();
  if (anterior && anterior.factor < 0.999) {
    vista.w = vistaInicial.w * anterior.factor;
    vista.h = vistaInicial.h * anterior.factor;
    vista.x = anterior.cx - vista.w / 2;
    vista.y = anterior.cy - vista.h / 2;
    aplicarVista();
  }
}

// ---------------------------------------------------------------------------
// Paneles del encabezado (hojas de informacion) y del pie (detalle de la seleccion).
// En escritorio flotan sobre el plano; en pantallas angostas empujan el contenido y hay
// que reencuadrar. Se cierran con su boton, con Esc o al tocar el plano.
// ---------------------------------------------------------------------------
const hojasInfo = document.getElementById('hojas-info');
const hojas = [...hojasInfo.querySelectorAll('.hoja')];
const puntos = [...hojasInfo.querySelectorAll('.punto')];
let hojaActual = 0;

function abrirPanel(panel, boton, abrir) {
  if (panel.hidden === !abrir) return;
  panel.hidden = !abrir;
  boton.setAttribute('aria-expanded', String(abrir));
  reencuadrar(true);
}

function mostrarHoja(indice) {
  hojaActual = Math.max(0, Math.min(hojas.length - 1, indice));
  hojas.forEach((hoja, i) => { hoja.hidden = i !== hojaActual; });
  puntos.forEach((punto, i) => {
    if (i === hojaActual) punto.setAttribute('aria-current', 'true');
    else punto.removeAttribute('aria-current');
  });
  document.getElementById('hoja-anterior').disabled = hojaActual === 0;
  document.getElementById('hoja-siguiente').disabled = hojaActual === hojas.length - 1;
}

const cerrarPlegables = () => {
  abrirPanel(hojasInfo, document.getElementById('boton-info'), false);
  abrirPanel(document.getElementById('panel-detalle'), document.getElementById('boton-detalle'), false);
};
svg.addEventListener('pointerdown', cerrarPlegables);

document.getElementById('boton-info').addEventListener('click', () => {
  const abrir = hojasInfo.hidden;
  abrirPanel(hojasInfo, document.getElementById('boton-info'), abrir);
  if (abrir) mostrarHoja(hojaActual);
});
document.getElementById('hoja-anterior').addEventListener('click', () => mostrarHoja(hojaActual - 1));
document.getElementById('hoja-siguiente').addEventListener('click', () => mostrarHoja(hojaActual + 1));
for (const punto of puntos) punto.addEventListener('click', () => mostrarHoja(Number(punto.dataset.hoja)));
document.getElementById('cerrar-info').addEventListener('click', () => {
  abrirPanel(hojasInfo, document.getElementById('boton-info'), false);
  document.getElementById('boton-info').focus();
});
// Las flechas del teclado pasan de hoja mientras el foco esta en el panel.
hojasInfo.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    mostrarHoja(hojaActual + (e.key === 'ArrowRight' ? 1 : -1));
  }
});
document.getElementById('boton-detalle').addEventListener('click', () => {
  const panel = document.getElementById('panel-detalle');
  abrirPanel(panel, document.getElementById('boton-detalle'), panel.hidden);
});

let esperaDeTamano = null;
addEventListener('resize', () => {
  clearTimeout(esperaDeTamano);
  esperaDeTamano = setTimeout(() => reencuadrar(true), 120);
});

function aplicarVista() {
  // La vista no puede salir del encuadre inicial: el plano nunca se pierde de
  // vista. Como el zoom minimo ES el encuadre inicial, el rango nunca es vacio.
  const limitar = (v, min, max) => Math.min(Math.max(v, min), max);
  vista.x = limitar(vista.x, vistaInicial.x, vistaInicial.x + vistaInicial.w - vista.w);
  vista.y = limitar(vista.y, vistaInicial.y, vistaInicial.y + vistaInicial.h - vista.h);
  svg.setAttribute('viewBox', [vista.x, vista.y, vista.w, vista.h].join(' '));
}

// Lo mas cerca que se deja llegar. No puede salir del encuadre inicial: ese encuadre se
// estira a la proporcion del hueco del plano, asi que cuanto mas alto es el recinto mas
// ancho es, y «seis veces mas cerca» acerca cada vez menos. En un recinto de 20.000
// butacas el tope dejaba 2,6 px por butaca, ilegible (paso). Topado en celdas, en
// cualquier recinto se llega a ver el ancho de una sala clasica: unos 40 px por butaca.
const VISTA_MINIMA = ANCHO_SALA * PASO;

// Devuelve si la vista cambio, para que la rueda sepa si debe ceder el scroll
// a la pagina.
function escalar(factor, centro) {
  // Si el recinto entero cabe en menos que eso, el tope es el propio encuadre.
  const minimo = Math.min(vistaInicial.w, VISTA_MINIMA);
  const nuevoAncho = Math.min(vistaInicial.w, Math.max(minimo, vista.w * factor));
  const razon = nuevoAncho / vista.w;
  if (Math.abs(razon - 1) < 1e-9) return false;
  const c = centro || { x: vista.x + vista.w / 2, y: vista.y + vista.h / 2 };
  vista.x = c.x - (c.x - vista.x) * razon;
  vista.y = c.y - (c.y - vista.y) * razon;
  vista.w = nuevoAncho;   // exacto, no w *= razon: asi el tope se alcanza sin error de redondeo
  vista.h *= razon;
  aplicarVista();
  return true;
}

function enUnidades(evento) {
  const caja = svg.getBoundingClientRect();
  return {
    x: vista.x + ((evento.clientX - caja.left) / caja.width) * vista.w,
    y: vista.y + ((evento.clientY - caja.top) / caja.height) * vista.h,
  };
}

svg.addEventListener('wheel', (e) => {
  // Proporcional al delta, no un paso fijo por evento: una muesca de rueda
  // (~100 px) da x1.15, y un trackpad, que manda muchos deltas pequenos, avanza
  // suave. El pellizco de trackpad llega como wheel con ctrlKey y deltas cortos.
  const porModo = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 1 : 0.002;
  const factor = Math.pow(2, e.deltaY * porModo * (e.ctrlKey ? 10 : 1));
  // En el tope del zoom la rueda vuelve a desplazar la pagina. Con ctrlKey se
  // bloquea siempre, o el navegador haria zoom de la pagina entera.
  if (escalar(factor, enUnidades(e)) || e.ctrlKey) e.preventDefault();
}, { passive: false });

// Punteros activos (raton, dedos, lapiz) por pointerId. Con uno se arrastra;
// con dos se arrastra y se pellizca a la vez.
const punteros = new Map();
let arrastre = null;
// Con la barra espaciadora pulsada, el arrastre siempre mueve el plano: es la salida
// para desplazarse mientras una herramienta de butacas se queda con el arrastre.
let espacioPulsado = false;
document.addEventListener('keydown', (e) => {
  // En un campo de texto, la barra escribe un espacio: ahi no es para el plano.
  if (e.code === 'Space' && !e.repeat && !e.target.closest('input, select, textarea')) espacioPulsado = true;
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space') espacioPulsado = false;
});
window.addEventListener('blur', () => { espacioPulsado = false; });

function centroDePunteros() {
  const [a, b] = punteros.values();
  if (!b) return { x: a.x, y: a.y, d: 0 };
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
}

svg.addEventListener('pointerdown', (e) => {
  // El boton central siempre mueve el plano, tambien mientras se pinta por area.
  if (e.button !== 0 && e.button !== 1) return;   // el derecho no elige butaca
  const soloMover = e.button === 1 || espacioPulsado;
  if (e.button === 1) e.preventDefault();
  punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
  svg.setPointerCapture(e.pointerId);
  if (punteros.size === 1) {
    // En el editor, agarrar una mesa la mueve; agarrar el fondo mueve el plano.
    if (arrastreMesa) terminarArrastreMesa(false);   // nunca dos arrastres de mesa a la vez
    // Un tirador se lleva el gesto: ni mueve el plano ni selecciona nada hasta soltar.
    const tirador = !soloMover && modo === 'editor' && !conButacas() && e.target.closest('[data-tirador]');
    if (tirador) {
      const { tirador: tipo, banda, vertical } = tirador.dataset;
      arrastreTirador = { tipo, banda: banda || null, vertical: vertical || null, pointerId: e.pointerId };
      dibujarFantasma({});
      return;
    }
    const pieza = modo === 'editor' && e.target.closest('.pieza');
    if (pieza) {
      // Ctrl (o Cmd) mete o saca la pieza de la selección en vez de arrastrarla.
      if (e.ctrlKey || e.metaKey) {
        alternarPiezaActiva(pieza.dataset.pieza);
        return;
      }
      arrastreMesa = iniciarArrastreMesa(pieza, e);
      return;
    }
    arrastre = {
      x: e.clientX, y: e.clientY, movido: 0,
      // Con la herramienta de zona o de bloqueo, arrastrar dibuja un rectangulo en vez
      // de mover el plano; Alt lo deshace (zona de siempre, o desbloquear).
      area: modo === 'editor' && ['zona', 'bloquear'].includes(herramienta) && !soloMover ? { desde: celdaBajo(e), alt: e.altKey } : null,
      // Colocando piezas, arrastrar el fondo las selecciona; con Ctrl, se suman a las
      // que ya estaban.
      marco: modo === 'editor' && !conButacas() && !soloMover
        ? { desde: celdaBajo(e), suma: e.ctrlKey || e.metaKey } : null,
      // La butaca se anota AQUI, no en pointerup: setPointerCapture retargetea al
      // <svg> todos los eventos de puntero siguientes, asi que al soltar el boton
      // e.target ya es el <svg> y closest('.butaca') devuelve null.
      butaca: e.target.closest('.butaca'),
      tablero: modo === 'vista' ? e.target.closest('.mueble.completa') : null,
      celda: modo === 'editor' ? celdaBajo(e) : null,
    };
  } else {
    // Un segundo dedo convierte el toque en gesto de plano: si se movia una
    // mesa, se cancela y el pellizco sigue normal.
    if (arrastreMesa) terminarArrastreMesa(false);
    if (arrastre && arrastre.area) {
      arrastre.area = null;
      dibujarArea(null);
    }
    if (arrastre) arrastre.movido = Infinity;
    else arrastre = { x: e.clientX, y: e.clientY, movido: Infinity, butaca: null };
  }
});
svg.addEventListener('pointermove', (e) => {
  if (arrastreTirador) {
    if (e.pointerId === arrastreTirador.pointerId) dibujarFantasma(medidasDeTirador(e));
    return;
  }
  if (arrastreMesa) {
    if (e.pointerId === arrastreMesa.pointerId) moverSombra(e);
    return;
  }
  if (!arrastre || !punteros.has(e.pointerId)) return;
  // Incremental: se compara el centro antes y despues de ESTE movimiento. Asi
  // poner o levantar un dedo no hace saltar el plano.
  const antes = centroDePunteros();
  punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const despues = centroDePunteros();

  if (punteros.size === 1) {
    arrastre.movido = Math.max(arrastre.movido,
      Math.abs(e.clientX - arrastre.x) + Math.abs(e.clientY - arrastre.y));
  }
  if (arrastre.movido > 4) svg.classList.add('arrastrando');
  if (arrastre.area) {
    arrastre.area.hasta = celdaBajo(e);
    dibujarArea(areaDeCeldas(arrastre.area.desde, arrastre.area.hasta), arrastre.area.alt);
    return;   // el plano se queda quieto: el gesto es del rectangulo
  }
  if (arrastre.marco) {
    arrastre.marco.hasta = celdaBajo(e);
    const marco = areaDeCeldas(arrastre.marco.desde, arrastre.marco.hasta);
    dibujarArea(marco, false, plural(piezasEnMarco(piezasDelPlano(), marco).length, 'pieza', 'piezas'));
    return;
  }

  const caja = svg.getBoundingClientRect();
  vista.x -= ((despues.x - antes.x) / caja.width) * vista.w;
  vista.y -= ((despues.y - antes.y) / caja.height) * vista.h;
  aplicarVista();
  if (antes.d && despues.d) {
    escalar(antes.d / despues.d, enUnidades({ clientX: despues.x, clientY: despues.y }));
  }
});
function soltarPuntero(e, cancelado) {
  if (!punteros.delete(e.pointerId)) return;
  if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
  if (arrastreTirador) {
    terminarArrastreTirador(!cancelado, e);
    return;
  }
  if (arrastreMesa) {
    terminarArrastreMesa(!cancelado);
    return;
  }
  if (punteros.size) return;   // queda un dedo: el gesto sigue
  svg.classList.remove('arrastrando');
  // Un rectangulo solo cuenta si hubo arrastre de verdad: un temblor de la mano al
  // hacer clic no puede comerse el clic (que selecciona la banda o toca la butaca).
  const rectangulo = arrastre && arrastre.movido > 4 &&
    ((arrastre.marco && arrastre.marco.hasta && 'marco') || (arrastre.area && arrastre.area.hasta && 'area'));
  if (arrastre && (arrastre.marco || arrastre.area)) dibujarArea(null);
  if (rectangulo) {
    const gesto = arrastre[rectangulo];
    const caja = areaDeCeldas(gesto.desde, gesto.hasta);
    if (!cancelado) {
      if (rectangulo === 'marco') aplicarMarco(caja, gesto.suma);
      else aplicarArea(caja, gesto.alt);
    }
    arrastre = null;
    return;
  }
  // Un arrastre no debe contar como clic sobre la butaca que quedo debajo.
  if (!cancelado && arrastre && arrastre.movido <= 4) {
    // En el editor, un clic en el fondo selecciona la banda de debajo (y otro clic,
    // la que la contiene); con la herramienta de bloqueo, el clic en una butaca la
    // bloquea o desbloquea.
    if (modo === 'editor' && !conButacas()) seleccionarBandaEnPlano(arrastre.celda);
    else if (arrastre.tablero && !arrastre.butaca) alternarMesaPorTablero(arrastre.tablero.dataset.pieza);
    else alternar(arrastre.butaca);
  }
  arrastre = null;
}
svg.addEventListener('pointerup', (e) => soltarPuntero(e, false));

function seleccionarBandaEnPlano(c) {
  const id = c && Number.isFinite(c.x) ? bandaEnCelda(salaActual, c.x, c.y, bandaActiva) : null;
  if (!id) {
    marcarActiva(null);
    marcarBandaActiva(null);
    return;
  }
  marcarBandaActiva(id);
  anunciar(bandaDe(salaActual, id).nombre + ' seleccionada.');
}

// Doble clic en un subtitulo: selecciona su banda y lleva a su nombre en el panel.
svg.addEventListener('dblclick', (e) => {
  if (modo !== 'editor' || conButacas()) return;
  const subtitulo = e.target.closest('[data-subtitulo]');
  if (!subtitulo) return;
  const id = subtitulo.dataset.subtitulo;
  marcarBandaActiva(id);
  const campo = listaBandas.querySelector('input[data-op="nombre"][data-banda="' + id + '"]');
  if (campo) {
    campo.focus();
    campo.select();
  }
});
svg.addEventListener('pointercancel', (e) => soltarPuntero(e, true));

document.getElementById('acercar').addEventListener('click', () => escalar(1 / 1.3));
document.getElementById('alejar').addEventListener('click', () => escalar(1.3));
document.getElementById('ajustar').addEventListener('click', () => {
  vista = { ...vistaInicial };
  aplicarVista();
});

// ---------------------------------------------------------------------------
// Seleccion y teclado
// ---------------------------------------------------------------------------
const porNodo = (elemento) => porId.get(elemento.dataset.id);

function alternar(elemento) {
  if (modo === 'editor') {        // en el editor no se elige: se coloca o se bloquea
    if (herramienta === 'bloquear' && elemento) alternarBloqueo(elemento);
    if (herramienta === 'zona' && elemento) pintarZona(elemento);
    if (herramienta === 'numeracion' && elemento) elegirEtiquetaOficial(elemento);
    else if (herramienta === 'ajustar' && elemento) elegirLugarAjuste(elemento);
    else if (herramienta === 'fisica' && elemento) elegirLugarFisico(elemento);
    return;
  }
  const b = elemento && porNodo(elemento);
  if (eventoConectado) {
    const elegida = alternarLugarEvento(elegidas, b?.id, eventoConectado);
    if (elegida === null) return;
    const grupo = eventoConectado.grupos.get(b.grupo?.id);
    const afectados = grupo?.modalidad === 'completa' ? grupo.requeridos : [b.id];
    // Elegir no regenera geometria: conserva el coste de la compra por lugar/grupo.
    for (const id of afectados) {
      const x = porId.get(id);
      if (!x?.nodo) continue;
      if (elegida) ponerMarca(x);
      x.nodo.classList.toggle('elegida', elegida); x.nodo.setAttribute('aria-checked', String(elegida));
    }
    if (grupo?.modalidad === 'completa') marcarTableroElegido(grupo.id, elegida);
    actualizarResumen(); notificarSeleccionEvento(); return;
  }
  const elegida = alternarEleccion(elegidas, b, butacas);
  if (elegida === null) return;
  // El DOM refleja el dato; nunca se lee de vuelta. En una mesa completa cambian todos
  // sus lugares y el tablero.
  const afectadas = b.grupo && b.grupo.completa ? lugaresDeMesa(b.grupo.id, butacas).filter((x) => x.estado === 'libre') : [b];
  for (const x of afectadas) {
    // La palomita de una butaca libre no existe hasta que se elige.
    if (elegida) ponerMarca(x);
    x.nodo.classList.toggle('elegida', elegida);
    x.nodo.setAttribute('aria-checked', String(elegida));
  }
  if (b.grupo && b.grupo.completa) marcarTableroElegido(b.grupo.id, elegida);
  actualizarResumen();
}

function marcarTableroElegido(id, elegida) {
  for (const n of capaMuebles.querySelectorAll('.mueble[data-pieza="' + id + '"]')) n.classList.toggle('elegida', elegida);
}

// Clic en el tablero de una mesa completa: la elige como si fuera uno de sus lugares.
function alternarMesaPorTablero(id) {
  const primera = butacas.find((b) => b.grupo && b.grupo.id === id && b.grupo.completa && b.estado === 'libre');
  if (primera) alternar(primera.nodo);
}

function moverFoco(desde, dx, dy) {
  const origen = porNodo(desde);
  if (!origen) return;
  const destino = vecinoDeLugar(butacasVisibles(), origen, dx, dy);
  if (!destino) return;
  destino.nodo.focus();   // el tabindex y el encuadre los ajusta 'focusin'
}

// Desplaza el viewBox lo justo para que la caja (en celdas) quede dentro, con
// media celda de margen. Sin esto, con zoom, el foco podia irse fuera de vista.
function asegurarVisible({ x: cx, y: cy, w = 1, h = 1 }) {
  const margen = PASO / 2;
  const x = cx * PASO, y = cy * PASO, ancho = w * PASO, alto = h * PASO;
  if (x - margen < vista.x) vista.x = x - margen;
  else if (x + ancho + margen > vista.x + vista.w) vista.x = x + ancho + margen - vista.w;
  if (y - margen < vista.y) vista.y = y - margen;
  else if (y + alto + margen > vista.y + vista.h) vista.y = y + alto + margen - vista.h;
  aplicarVista();
}

// El foco puede llegar por flechas o por clic: en ambos casos el elemento
// enfocado pasa a ser el unico punto de tabulacion de su capa (butacas en la
// previsualizacion, mesas en el editor).
svg.addEventListener('focusin', (e) => {
  const elemento = e.target.closest('.butaca, .pieza');
  if (!elemento) return;
  for (const n of elemento.parentNode.querySelectorAll('[tabindex="0"]')) {
    if (n !== elemento) n.setAttribute('tabindex', '-1');
  }
  elemento.setAttribute('tabindex', '0');
  // Durante un clic no se reencuadra: moveria el plano bajo el puntero y el
  // arrastre, que parte de la vista anterior, lo haria saltar.
  const esPieza = elemento.classList.contains('pieza');
  // Tocar una pieza que ya está en la selección no la deshace: pasa a ser la principal,
  // que es lo que deja arrastrar el grupo desde cualquiera de las suyas.
  if (esPieza && piezasActivas.has(elemento.dataset.pieza)) {
    mesaActiva = elemento.dataset.pieza;
    actualizarControles();
  } else if (esPieza) {
    marcarActiva(elemento.dataset.pieza);
  }
  if (arrastre || arrastreMesa) return;
  const m = esPieza && piezaPorId(elemento.dataset.pieza);
  const caja = m ? { x: m.x, y: m.y, w: m.geo.ancho, h: m.geo.alto } : porNodo(elemento);
  if (caja) asegurarVisible(caja);
});

svg.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && arrastreTirador) {
    e.preventDefault();
    terminarArrastreTirador(false);
    anunciar('Cambio de tamaño cancelado.');
    return;
  }
  if (e.key === 'Escape' && arrastreMesa) {
    e.preventDefault();
    terminarArrastreMesa(false);
    anunciar('Movimiento cancelado.');
    return;
  }
  const pieza = e.target.closest('.pieza');
  if (pieza) {
    const id = pieza.dataset.pieza;
    const flecha = FLECHAS[e.key];
    const accion = ATAJOS[e.key];
    if (flecha) {
      e.preventDefault();
      moverMesaConTeclado(id, flecha);
    } else if (accion) {
      e.preventDefault();
      ejecutarAccion(accion, id);
      // El DOM se rehizo: el foco vuelve a la pieza activa (la copia, al duplicar), o
      // a la primera si se elimino.
      const destino = capaPiezas.querySelector('[data-pieza="' + (mesaActiva || id) + '"]') ||
                      capaPiezas.querySelector('.pieza');
      if (destino) destino.focus();
    }
    return;
  }
  const elemento = e.target.closest('.butaca');
  if (!elemento) return;
  const porArea = modo === 'editor' && ['zona', 'bloquear'].includes(herramienta);
  if (e.key === 'Escape' && areaTeclado) {
    e.preventDefault();
    limpiarArea();
    anunciar('Área cancelada.');
    return;
  }
  // Con una herramienta de butacas, la barra mueve el plano mientras se pinta por
  // area: ahi no activa la butaca enfocada, que se aplica con Enter.
  if (e.key === ' ' && porArea) {
    e.preventDefault();
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    // Con un área extendida con Mayús, Enter la aplica (Alt+Enter la deshace).
    if (areaTeclado && areaTeclado.hasta) {
      const area = areaDeCeldas(areaTeclado.desde, areaTeclado.hasta);
      const id = porNodo(elemento).id;
      limpiarArea();
      aplicarArea(area, e.altKey);
      const vuelta = porId.get(id);
      if (vuelta) vuelta.nodo.focus({ preventScroll: true });
      return;
    }
    alternar(elemento);
    return;
  }
  const flecha = FLECHAS[e.key];
  if (flecha && e.shiftKey && porArea) {
    e.preventDefault();
    extenderArea(elemento, flecha);
    return;
  }
  if (flecha) {
    e.preventDefault();
    if (areaTeclado) limpiarArea();
    moverFoco(elemento, flecha.dx, flecha.dy);
  }
});

const FLECHAS = {
  ArrowLeft:  { dx: -1, dy: 0, hacia: 'la izquierda' },
  ArrowRight: { dx: 1,  dy: 0, hacia: 'la derecha' },
  ArrowUp:    { dx: 0, dy: -1, hacia: 'arriba' },
  ArrowDown:  { dx: 0, dy: 1,  hacia: 'abajo' },
};

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
const conButacas = () => ['bloquear', 'zona', 'numeracion', 'ajustar', 'fisica'].includes(herramienta);
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
  actualizarIdentidadControles();
  actualizarControlesGeometria();
  actualizarControlesFisicos();
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

  const soloMesas = todas.length > 0 && todas.every((p) => esMesa(p) && !esEscenario(p));
  const deMesa = varias ? soloMesas : Boolean(m) && esMesa(m) && !esEscenario(m);
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
  const canonico = plano ? cambiarNivelPlano(plano, nivelesDe(plano)[0].id) : null;
  if (canonico) delete canonico.nivelEnEdicion;
  return { plano: plano ? JSON.stringify(plano) : null,
           firma: JSON.stringify(canonico || planoDesdeSala(tipoActual, salaActual), (k,v) => v && typeof v === 'object' && !Array.isArray(v)
             ? Object.fromEntries(Object.keys(v).sort().map((key) => [key,v[key]])) : v) };
}

function actualizarEstadoEdicion() {
  const historial = historiales[tipoActual];
  document.getElementById('deshacer').disabled = !historial || !historial.puedeDeshacer();
  document.getElementById('rehacer').disabled = !historial || !historial.puedeRehacer();
  document.getElementById('estado-guardado').textContent = historial && historial.tieneCambios()
    ? 'Cambios sin guardar en este plano.' : 'Sin cambios pendientes.';
}

function restaurarEdicion(accion) {
  const actual = planoEditable();
  const historial = historiales[tipoActual];
  const estado = historial && historial[accion]();
  if (!estado) return;
  if (estado.plano === null) delete planos[tipoActual];
  else planos[tipoActual] = conciliarIdentidadAlRestaurar(actual, JSON.parse(estado.plano));
  restaurandoHistorial = true;
  try {
    regenerar(accion === 'deshacer' ? 'Último cambio deshecho.' : 'Cambio rehecho.');
    if (planos[tipoActual]) {
      historial.actualizarActual(fotoDelPlano()); actualizarEstadoEdicion();
    }
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
const fotoDeButacas = () => butacas.map((b) => ({ id: b.id, estado: b.estado,
  sectorId: b.sectorFisico?.id, filaId: b.filaFisica?.id, grupoId: b.grupo?.tipo === 'palco' ? b.grupo.id : undefined }));

// 'antes' se puede pasar hecho cuando el plano ya se genero para validarlo.
function regenerar(mensaje, antes = fotoDeButacas()) {
  salaActual = generarPlano(tipoActual, planos[tipoActual]);
  if (planos[tipoActual]) {
    planos[tipoActual] = sincronizarIdentidad(planos[tipoActual]);
    salaActual = generarPlano(tipoActual, planos[tipoActual]);
  }
  // Una pieza que quedo fuera de toda banda con zona no tiene de quien heredar: se le
  // escribe la suya y se anuncia la ubicacion fisica resuelta.
  let sueltas = { fijadas: [] };
  if (planos[tipoActual]) {
    sueltas = fijarZonasSueltas(planos[tipoActual], salaActual);
    if (sueltas.fijadas.length) {
      planos[tipoActual] = sueltas.plano;
      salaActual = generarPlano(tipoActual, sueltas.plano);
    }
  }
  const existe = new Set(butacas.map((b) => b.id));
  const porIdFisico = new Map(butacas.map((b) => [b.id,b]));
  const desvinculadas = antes.filter((a) => {
    const b = porIdFisico.get(a.id);
    return b && ((a.sectorId && a.sectorId !== b.sectorFisico?.id) || (a.filaId && a.filaId !== b.filaFisica?.id) || (a.grupoId && a.grupoId !== b.grupo?.id));
  }).map((a) => a.id);
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
    desvinculadas.length ? 'Pertenencias físicas desvinculadas o reasignadas: ' + desvinculadas.join(', ') + '.' : '',
    frase(ausentes, 'ya no existe en el plano', 'ya no existen en el plano'),
    frase(noLibres, 'ya no está libre', 'ya no están libres'),
    ocupadasQuitadas.length
      ? 'Atención: se quitaron lugares ocupados: ' + ocupadasQuitadas.join(', ') + '.' : '',
    completadas.length ? 'Se venden completas, así que se eligieron todos sus lugares: ' + completadas.join(', ') + '.' : '',
    sueltas.fijadas.length
      ? 'Fuera de toda zona, así que se les asignó ' + zonas[sueltas.zona].nombre + ': ' +
        sueltas.fijadas.join(', ') + '.' : '',
    butacas.some((b) => b.zona !== b.zonaOriginal)
      ? 'Hay lugares con zona física distinta de su región de dibujo. Mover conserva la ubicación; usa Asignar zona para reasignarla.' : '',
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
function confirmarRetiroDeFilas(configs) {
  const retiradas = [];
  for (const c of configs.filter((c) => c.tipo === 'filas' && c.geometria)) {
    const claves = new Set(geometriaBloqueFilas(c).lugares.map((l) => c.id + '-' + (l.fila + 1) + '-' + (l.columna + 1)));
    retiradas.push(...butacasVisibles().filter((b) => b.bloque === c.id && !claves.has(b.claveDiseno)));
  }
  return !retiradas.length || confirm('Se retirarán ' + retiradas.length + ' lugares: ' + retiradas.slice(0, 5).map((b) => b.id + ' (' + etiquetaDe(b) + ')').join('; ') + '. Sus IDs no se reutilizarán. ¿Continuar?');
}

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
  if (!confirmarRetiroDeFilas(configs)) return;
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
  if (!confirmarRetiroDeFilas([nueva])) return;
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
             (zona ? ' a la zona ' + zona.nombre + '.'
                   : ' heredan la zona de su banda.'));
    return;
  }
  const pieza = piezaPorId(mesaActiva);
  if (!pieza || esForma(pieza) || esEscenario(pieza)) return;
  planos[tipoActual] = cambiarZonaDePiezas(planoEditable(), [pieza.id], e.target.value);
  regenerar('');
  const despues = piezaPorId(pieza.id);
  const zona = zonas[e.target.value] || zonas[zonaEnCelda(salaActual, despues.x, despues.y)];
  anunciar(pieza.nombre + (e.target.value ? ' pasa a la zona ' : ' hereda la zona de su banda: ') +
           zona.nombre + '.');
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
  if (eventoConectado && nuevo === 'editor') { anunciar('La compra utiliza una revisión fija. Abre el editor fuera del evento.'); return; }
  if (nuevo === 'editor' && TIPOS_DE_SALA[tipoActual].revisionFisica?.estado === 'publicada') {
    anunciar('Esta revisión está publicada. Crea una nueva revisión en borrador para editar.'); return;
  }
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
  document.getElementById('herramienta-numeracion').setAttribute('aria-pressed', 'false');
  document.getElementById('herramienta-ajustar').setAttribute('aria-pressed', 'false');
  herramienta = 'mesas';
  seleccionFisica.clear();
  svg.classList.remove('bloqueando', 'pintando', 'numerando');
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
  svg.classList.toggle('numerando', ['numeracion', 'ajustar', 'fisica'].includes(herramienta));
  document.getElementById('herramienta-fisica').setAttribute('aria-pressed', String(herramienta === 'fisica'));
  document.getElementById('herramienta-numeracion').setAttribute('aria-pressed', String(herramienta === 'numeracion'));
  document.getElementById('herramienta-ajustar').setAttribute('aria-pressed', String(herramienta === 'ajustar'));
  svg.classList.toggle('bloqueando', bloqueando);
  svg.classList.toggle('pintando', pintando);
  document.getElementById('herramienta-bloquear').setAttribute('aria-pressed', String(bloqueando));
  document.getElementById('herramienta-zona').setAttribute('aria-pressed', String(pintando));
  document.getElementById('pincel-zona').hidden = !pintando;
  if (pintando) llenarPincel();
  document.getElementById('pista').textContent = herramienta === 'numeracion'
    ? 'Haz clic en un lugar o pulsa Enter para editar su etiqueta oficial. Las flechas recorren los lugares.'
    : herramienta === 'fisica' ? 'Haz clic o pulsa Enter para añadir o quitar un lugar de la selección física; después aplica la pertenencia.'
    : herramienta === 'ajustar' ? 'Haz clic o pulsa Enter en una butaca de bloque libre para ajustar su posición y orientación.'
    : PISTAS[bloqueando ? 'bloquear' : pintando ? 'zona' : modo];
  actualizarAccesoButacas();
  marcarActivas([]);
  bandaActiva = null;
  dibujarTodo();
  actualizarControles();
  anunciar(bloqueando
    ? 'Bloquear butacas: haz clic en una butaca para bloquearla o desbloquearla.'
    : pintando
    ? 'Asignar zona: elige la zona y haz clic en las butacas. Las marcadas con la palomita ya son de esa zona.'
    : herramienta === 'fisica' ? 'Seleccionar lugares para asignar su pertenencia física; la selección de compra se conserva.'
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

// Las opciones del pincel: todas las zonas fisicas de la sala. Conserva la
// elegida si sigue existiendo; si no, General o la primera.
function llenarPincel() {
  const select = document.getElementById('zona-pincel');
  const antes = select.value;
  select.textContent = '';
  for (const [id, { nombre }] of Object.entries(zonas)) select.appendChild(new Option(nombre, id));
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
  anunciar(etiquetaDe(nueva) + ': zona ' + zonas[nueva.zona].nombre +
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
const libresEnArea = (area) => butacasEnArea(butacasVisibles(), area).filter((b) => b.estado !== 'ocupada');

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
    ? asignarZonaEnArea(plano, butacasVisibles(), area, devolver ? '' : pincel)
    : bloquearEnArea(plano, butacasVisibles(), area, !devolver);
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
      ? (zona ? ' a la zona ' + zona.nombre + '.' : ' de vuelta a su zona de siempre.')
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
document.getElementById('agregar-redonda').addEventListener('click', () => conTopeDeAforo(() => agregarMesaNueva('redonda')));
document.getElementById('agregar-bloque').addEventListener('click', () => conTopeDeAforo(agregarBloqueNuevo));
document.getElementById('agregar-butaca').addEventListener('click', () => conTopeDeAforo(agregarButacaNueva));
document.getElementById('agregar-pista').addEventListener('click', () => agregarFormaNueva('pista'));
document.getElementById('agregar-forma-barra').addEventListener('click', () => agregarFormaNueva('barra'));
for (const boton of botonesDeMesa()) {
  boton.addEventListener('click', () => ejecutarAccion(boton.dataset.accion));
}

const vistasDeNiveles = Object.create(null);
function cambiarNivelVista(id) {
  if (id === salaActual.nivel) return;
  const plano = planoEditable();
  const clave = tipoActual + ':' + salaActual.nivel;
  vistasDeNiveles[clave] = { ...vista };
  const nuevo = cambiarNivelPlano(plano, id);
  if (nuevo.motivo) { anunciar(nuevo.motivo); return; }
  if (arrastreMesa) terminarArrastreMesa(false);
  limpiarArea(); marcarActivas([]); bandaActiva = null;
  seleccionFisica.clear();
  planos[tipoActual] = nuevo;
  salaActual = generarPlano(tipoActual, nuevo);
  dibujarTodo(); actualizarResumen(); actualizarAforo(salaActual); actualizarControles();
  reencuadrar();
  const anterior = vistasDeNiveles[tipoActual + ':' + id];
  if (anterior) { Object.assign(vista, anterior); aplicarVista(); }
  historiales[tipoActual]?.actualizarActual(fotoDelPlano()); actualizarEstadoEdicion();
  anunciar('Nivel ' + salaActual.niveles.find((n) => n.id === id).nombre + '. Se conserva la selección de todo el recinto.');
}
const pestanasNiveles = document.getElementById('nivel-vista');
pestanasNiveles.addEventListener('click', (e) => {
  const tab = e.target.closest('[role="tab"]');
  if (tab) cambiarNivelVista(tab.dataset.nivel);
});
pestanasNiveles.addEventListener('keydown', (e) => {
  const tabs = [...pestanasNiveles.querySelectorAll('[role="tab"]')];
  const i = tabs.indexOf(e.target);
  if (i >= 0 && ['Enter', ' '].includes(e.key)) { e.preventDefault(); tabs[i].click(); return; }
  if (i < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const destino = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 :
    (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  for (const tab of tabs) tab.tabIndex = -1;
  tabs[destino].tabIndex = 0;
  tabs[destino].focus();
  tabs[destino].scrollIntoView({ block: 'nearest', inline: 'nearest' });
});

function actualizarPestanasNiveles() {
  const ids = new Set(salaActual.niveles.map((n) => n.id));
  for (const tab of [...pestanasNiveles.children]) if (!ids.has(tab.dataset.nivel)) tab.remove();
  for (const [i, n] of salaActual.niveles.entries()) {
    let tab = [...pestanasNiveles.children].find((t) => t.dataset.nivel === n.id);
    if (!tab) {
      tab = document.createElement('button'); tab.type = 'button'; tab.setAttribute('role', 'tab');
      tab.dataset.nivel = n.id; tab.id = 'pestana-' + n.id; tab.setAttribute('aria-controls', 'panel-nivel');
      pestanasNiveles.appendChild(tab);
    }
    if (pestanasNiveles.children[i] !== tab) pestanasNiveles.insertBefore(tab, pestanasNiveles.children[i]);
    tab.textContent = n.nombre;
    tab.setAttribute('aria-selected', String(n.id === salaActual.nivel));
    tab.tabIndex = n.id === salaActual.nivel ? 0 : -1;
  }
  document.getElementById('panel-nivel').setAttribute('aria-labelledby', 'pestana-' + salaActual.nivel);
}
document.getElementById('agregar-nivel').addEventListener('click', () => {
  const nuevo = agregarNivel(planoEditable(), document.getElementById('nombre-nivel').value);
  if (nuevo.motivo) { anunciar(nuevo.motivo); return; }
  planos[tipoActual] = nuevo; marcarActivas([]); limpiarArea(); regenerar('Nivel agregado.'); reencuadrar();
});
document.getElementById('renombrar-nivel').addEventListener('click', () => {
  const nuevo = renombrarNivel(planoEditable(), salaActual.nivel, document.getElementById('nombre-nivel').value);
  if (nuevo.motivo) { anunciar(nuevo.motivo); return; }
  planos[tipoActual] = nuevo; regenerar('Nivel renombrado.');
});
document.getElementById('eliminar-nivel').addEventListener('click', () => {
  const afectados = butacasVisibles();
  if (afectados.length && !confirm('Se retirarán ' + afectados.length + ' lugares de este nivel: ' + afectados.slice(0, 5).map(etiquetaDe).join('; ') + '. ¿Eliminarlo?')) return;
  const nuevo = eliminarNivel(planoEditable(), salaActual.nivel);
  if (nuevo.motivo) { anunciar(nuevo.motivo); return; }
  planos[tipoActual] = nuevo; marcarActivas([]); limpiarArea(); regenerar('Nivel eliminado; sus IDs quedan retirados.'); reencuadrar();
});

function actualizarControlesGeometria() {
  if (!salaActual) return;
  const plano = planos[tipoActual] || TIPOS_DE_SALA[tipoActual];
  actualizarPestanasNiveles();
  document.getElementById('eliminar-nivel').disabled = salaActual.niveles.length === 1;
  const p = piezaPorId(mesaActiva);
  const bloque = piezasActivas.size === 1 && esBloqueFilas(p) ? p : null;
  const g = { ...geometriaInicial(), ...bloque?.geometria };
  for (const campo of document.getElementById('formulario-geometria').elements) campo.disabled = !bloque;
  for (const [k,v] of Object.entries(g)) document.getElementById('geometria-' + k).value = v;
  for (const k of ['x','y','giro']) document.getElementById('geometria-' + k).value = bloque?.[k] ?? 0;
  const regionBloque = document.getElementById('geometria-region');
  regionBloque.textContent = ''; regionBloque.appendChild(new Option('Sin región', ''));
  const regionActiva = document.getElementById('region-activa');
  const activa = regionActiva.value;
  regionActiva.textContent = '';
  for (const r of plano.regionesLibres || []) { regionBloque.appendChild(new Option(r.nombre,r.id)); regionActiva.appendChild(new Option(r.nombre,r.id)); }
  regionBloque.value = bloque?.region || '';
  if ([...regionActiva.options].some((o) => o.value === activa)) regionActiva.value = activa;
  llenarRegionActiva();
  document.getElementById('herramienta-ajustar').disabled = !bloque?.geometria && herramienta !== 'ajustar';
  const existe = butacasVisibles().some((b) => b.id === document.getElementById('id-lugar-ajuste').value && b.bloque);
  for (const campo of document.getElementById('formulario-ajuste').elements) campo.disabled = !existe;
}
function llenarRegionActiva() {
  const r = planos[tipoActual]?.regionesLibres?.find((r) => r.id === document.getElementById('region-activa').value);
  for (const campo of document.getElementById('formulario-region').elements) campo.disabled = !r;
  document.getElementById('eliminar-region').disabled = !r;
  if (!r) return;
  document.getElementById('nombre-region').value = r.nombre;
  for (const k of ['x','y','ancho','alto','giro']) document.getElementById('region-' + k).value = r[k];
}
document.getElementById('region-activa').addEventListener('change', llenarRegionActiva);
document.getElementById('agregar-region').addEventListener('click', () => {
  const nuevo = agregarRegion(planoEditable(), document.getElementById('nombre-region').value || 'Región ' + (planoEditable().siguienteRegion || 1));
  if (nuevo.motivo) { anunciar(nuevo.motivo); return; }
  planos[tipoActual] = nuevo; regenerar('Región agregada.');
  document.getElementById('region-activa').value = nuevo.regionesLibres.at(-1).id; llenarRegionActiva();
});

for (const lado of ['izquierdo', 'derecho']) {
  document.getElementById('agregar-lateral-' + lado).addEventListener('click', () => {
    const nuevo = agregarLateral(planoEditable(), salaActual, lado);
    if (nuevo.motivo) { anunciar('No se agregó el lateral: ' + nuevo.motivo); return; }
    planos[tipoActual] = nuevo;
    regenerar('Lateral ' + lado + ' agregado. Se conservan el escenario y las pertenencias físicas.');
    document.getElementById('region-activa').value = nuevo.regionesLibres.at(-1).id;
    llenarRegionActiva(); reencuadrar();
  });
}
document.getElementById('formulario-region').addEventListener('submit', (e) => {
  e.preventDefault(); const valores = { nombre: document.getElementById('nombre-region').value };
  for (const k of ['x','y','ancho','alto','giro']) valores[k] = Number(document.getElementById('region-' + k).value);
  const nuevo = cambiarRegion(planoEditable(), salaActual, document.getElementById('region-activa').value, valores);
  if (nuevo.motivo) { anunciar('No se cambió la región: ' + nuevo.motivo); return; }
  planos[tipoActual] = nuevo; regenerar('Región y bloques vinculados actualizados.'); calcularEncuadre();
});
document.getElementById('eliminar-region').addEventListener('click', () => {
  planos[tipoActual] = eliminarRegion(planoEditable(), document.getElementById('region-activa').value);
  regenerar('Región eliminada; sus bloques y lugares se conservan.');
});
document.getElementById('formulario-geometria').addEventListener('submit', (e) => {
  e.preventDefault(); const geometria = {};
  for (const k of Object.keys(geometriaInicial())) geometria[k] = ['tipo','orientacion'].includes(k) ? document.getElementById('geometria-' + k).value : Number(document.getElementById('geometria-' + k).value);
  const valores = { geometria };
  for (const k of ['x','y','giro']) valores[k] = Number(document.getElementById('geometria-' + k).value);
  const nuevo = cambiarGeometriaBloque(planoEditable(), salaActual, mesaActiva, valores);
  if (nuevo.motivo) { anunciar('No se cambió la geometría: ' + nuevo.motivo); return; }
  const bloque = nuevo.bloquesFilas.find((p) => p.id === mesaActiva);
  const region = document.getElementById('geometria-region').value;
  if (region) bloque.region = region; else delete bloque.region;
  planos[tipoActual] = nuevo; regenerar('Geometría aplicada; IDs y etiquetas oficiales conservados.'); calcularEncuadre();
});
document.getElementById('herramienta-ajustar').addEventListener('click', () => cambiarHerramienta(herramienta === 'ajustar' ? 'mesas' : 'ajustar'));
function elegirLugarAjuste(elemento) {
  const b = porNodo(elemento);
  if (!b?.bloque || !piezaPorId(b.bloque)?.geometria) { anunciar('Elige una butaca de un bloque con geometría libre.'); return; }
  const ajuste = piezaPorId(b.bloque).ajustes?.[(b.filaLocal + 1) + '-' + b.numeroLocal] || { dx:0, dy:0, giro:0 };
  document.getElementById('id-lugar-ajuste').value = b.id;
  actualizarControlesGeometria();
  for (const k of ['dx','dy','giro']) document.getElementById('ajuste-' + k).value = ajuste[k];
  document.getElementById('ajuste-dx').focus(); anunciar('Ajuste relativo de ' + etiquetaDe(b));
}
document.getElementById('formulario-ajuste').addEventListener('submit', (e) => {
  e.preventDefault(); const valores = {};
  for (const k of ['dx','dy','giro']) valores[k] = Number(document.getElementById('ajuste-' + k).value);
  const nuevo = ajustarLugar(planoEditable(), salaActual, document.getElementById('id-lugar-ajuste').value, valores);
  if (nuevo.motivo) { anunciar('No se aplicó el ajuste: ' + nuevo.motivo); return; }
  planos[tipoActual] = nuevo; regenerar('Ajuste guardado. Viajará y girará con su fila.');
});

function actualizarIdentidadControles() {
  const plano = planos[tipoActual];
  const r = plano?.revisionFisica || TIPOS_DE_SALA[tipoActual].revisionFisica;
  const publicada = r?.estado === 'publicada';
  document.getElementById('revision-fisica').textContent = r ? 'Revisión ' + r.numero + ' · ' + r.estado : 'Revisión 1 · borrador';
  document.getElementById('revision-publicada').hidden = !publicada || Boolean(eventoConectado);
  document.getElementById('nuevo-borrador').disabled = Boolean(eventoConectado);
  document.getElementById('modo-editor').disabled = Boolean(publicada || eventoConectado);
  document.getElementById('modo-numeracion').value = plano?.modoNumeracion || TIPOS_DE_SALA[tipoActual].modoNumeracion || 'automatica';
  const oficial = document.getElementById('modo-numeracion').value === 'oficial';
  document.getElementById('herramienta-numeracion').disabled = !oficial;
  const id = document.getElementById('id-lugar-oficial').value;
  const existe = oficial && butacas.some((b) => b.id === id);
  for (const campo of ['fila-oficial', 'numero-oficial', 'guardar-etiqueta']) document.getElementById(campo).disabled = !existe;
  const lugar = butacas.find((b) => b.id === id);
  if (lugar?.filaFisica || lugar?.grupo?.tipo === 'palco') document.getElementById('fila-oficial').disabled = true;
}

document.getElementById('modo-numeracion').addEventListener('change', (e) => {
  const plano = planoEditable();
  const modoNuevo = e.target.value;
  const ejemplos = butacas.slice(0, 3).map((b) => etiquetaDe(b)).join('; ');
  if (!confirm('Cambiar a numeración ' + (modoNuevo === 'oficial' ? 'oficial explícita' : 'automática por posición') +
      ' afecta las etiquetas de ' + butacas.length + ' lugares. ' +
      (modoNuevo === 'oficial' ? 'Se conservarán como oficiales las etiquetas visibles actuales.' : 'Las etiquetas volverán a calcularse por zona y posición.') +
      '\nEtiquetas actuales afectadas (ejemplos): ' + ejemplos + '\n\n¿Aplicar el cambio?')) {
    e.target.value = plano.modoNumeracion; return;
  }
  planos[tipoActual] = cambiarNumeracion(plano, modoNuevo);
  regenerar('Numeración ' + modoNuevo + ' aplicada.');
  if (modoNuevo !== 'oficial' && herramienta === 'numeracion') cambiarHerramienta('mesas');
});
document.getElementById('herramienta-numeracion').addEventListener('click', () =>
  cambiarHerramienta(herramienta === 'numeracion' ? 'mesas' : 'numeracion'));

function elegirEtiquetaOficial(elemento) {
  const b = porNodo(elemento);
  if (!b) return;
  document.getElementById('id-lugar-oficial').value = b.id;
  document.getElementById('fila-oficial').value = b.grupo?.tipo === 'palco' ? b.grupo.nombre : b.grupo ? b.numeroMesa : b.fila;
  document.getElementById('numero-oficial').value = b.numero;
  actualizarIdentidadControles();
  document.getElementById(document.getElementById('fila-oficial').disabled ? 'numero-oficial' : 'fila-oficial').focus();
  anunciar('Etiqueta de ' + etiquetaDe(b) + '. El ID ' + b.id + ' se conserva.');
}
document.getElementById('formulario-numeracion').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('id-lugar-oficial').value;
  const resultado = editarEtiquetaOficial(planoEditable(), id, { fila: document.getElementById('fila-oficial').value,
    numero: document.getElementById('numero-oficial').value });
  if (resultado.motivo) { anunciar('No se cambió la etiqueta: ' + resultado.motivo + '.'); return; }
  planos[tipoActual] = resultado;
  regenerar('Etiqueta oficial guardada para ' + id + '.');
});

// Esta seleccion edita pertenencias; nunca cambia la seleccion de compra.
const seleccionFisica = new Set();
function llenarOpcionesFisicas(id, opciones, inicial = '') {
  const s = document.getElementById(id);
  const previo = s.value;
  s.textContent = '';
  for (const [valor,nombre] of opciones) {
    const o = document.createElement('option'); o.value = valor; o.textContent = nombre; s.appendChild(o);
  }
  s.value = opciones.some(([valor]) => valor === previo) ? previo : inicial;
}
function actualizarControlesFisicos() {
  const plano = planos[tipoActual] || TIPOS_DE_SALA[tipoActual];
  const visibles = new Set(butacasVisibles().map((b) => b.id));
  for (const id of seleccionFisica) if (!visibles.has(id) || modo !== 'editor') seleccionFisica.delete(id);
  const tipo = document.getElementById('tipo-fisico').value;
  llenarOpcionesFisicas('zona-fisica-entidad', zonasDe(plano).map((z) => [z.id,z.nombre]), zonaParaFilas(zonasDe(plano)));
  const zona = document.getElementById('zona-fisica-entidad').value;
  const lista = (plano[TIPOS_FISICOS[tipo].lista] || []).filter((e) => e.nivel === salaActual.nivel && e.zona === zona);
  llenarOpcionesFisicas('entidad-fisica', [['','— crear o elegir —'], ...lista.map((e) => [e.id,e.nombre])]);
  const id = document.getElementById('entidad-fisica').value;
  const entidad = entidadFisicaDe(plano,tipo,id);
  document.getElementById('detalle-entidad-fisica').textContent = entidad ? entidad.id + ' · ' + miembrosFisicos(plano,tipo,id).length + ' lugares · ' + salaActual.niveles.find((n) => n.id === entidad.nivel).nombre : 'Las entidades vacías no añaden aforo.';
  for (const boton of ['renombrar-entidad-fisica','eliminar-entidad-fisica','fisica-miembros']) document.getElementById(boton).disabled = !entidad;
  document.getElementById('asignar-entidad-fisica').disabled = !entidad || !seleccionFisica.size;
  document.getElementById('desvincular-entidad-fisica').disabled = !seleccionFisica.size;
  document.getElementById('detalle-seleccion-fisica').textContent = seleccionFisica.size + ' lugares para asignar: ' + [...seleccionFisica].slice(0,5).join(', ');
  const f = seleccionFisica.size === 1 ? Object.values(plano.identidadFisica || {}).find((p) => p.id === [...seleccionFisica][0]) : null;
  document.getElementById('numero-lugar-palco').disabled = !f?.grupoId;
  document.getElementById('guardar-numero-palco').disabled = !f?.grupoId;
  document.getElementById('numero-lugar-palco').value = f?.numeroGrupo || '';
  document.getElementById('herramienta-fisica').setAttribute('aria-pressed', String(herramienta === 'fisica'));
}
function elegirLugarFisico(elemento) {
  const b = porNodo(elemento);
  if (!b) return;
  if (seleccionFisica.has(b.id)) seleccionFisica.delete(b.id); else seleccionFisica.add(b.id);
  actualizarControlesFisicos(); dibujarTodo();
  porId.get(b.id)?.nodo.focus();
  anunciar(seleccionFisica.size + ' lugares en la selección física.');
}
function aplicarResultadoFisico(resultado, mensaje) {
  if (modo !== 'editor' || planoEditable().revisionFisica?.estado === 'publicada') { anunciar('Crea un borrador editable antes de cambiar la estructura física.'); return false; }
  if (resultado.motivo) { anunciar('No se aplicó: ' + resultado.motivo + '.'); return false; }
  planos[tipoActual] = resultado.plano || resultado; regenerar(mensaje); return true;
}
for (const id of ['tipo-fisico','zona-fisica-entidad','entidad-fisica']) document.getElementById(id).addEventListener('change', () => {
  actualizarControlesFisicos();
  const e = entidadFisicaDe(planoEditable(),document.getElementById('tipo-fisico').value,document.getElementById('entidad-fisica').value);
  document.getElementById('nombre-entidad-fisica').value = e?.nombre || '';
});
document.getElementById('agregar-entidad-fisica').addEventListener('click', () => {
  const resultado = agregarEntidadFisica(planoEditable(),document.getElementById('tipo-fisico').value,document.getElementById('nombre-entidad-fisica').value,salaActual.nivel,document.getElementById('zona-fisica-entidad').value);
  if (aplicarResultadoFisico(resultado,'Entidad física creada sin mover ni añadir lugares.')) {
    document.getElementById('entidad-fisica').value = resultado.id; actualizarControlesFisicos();
  }
});
document.getElementById('formulario-entidad-fisica').addEventListener('submit', (e) => {
  e.preventDefault(); aplicarResultadoFisico(renombrarEntidadFisica(planoEditable(),document.getElementById('tipo-fisico').value,document.getElementById('entidad-fisica').value,document.getElementById('nombre-entidad-fisica').value),'Nombre físico actualizado; IDs conservados.');
});
document.getElementById('eliminar-entidad-fisica').addEventListener('click', () => aplicarResultadoFisico(eliminarEntidadFisica(planoEditable(),document.getElementById('tipo-fisico').value,document.getElementById('entidad-fisica').value),'Entidad vacía eliminada; su ID queda retirado.'));
document.getElementById('herramienta-fisica').addEventListener('click', () => cambiarHerramienta(herramienta === 'fisica' ? 'mesas' : 'fisica'));
document.getElementById('fisica-desde-piezas').addEventListener('click', () => {
  const ids = butacasVisibles().filter((b) => piezasActivas.has(b.grupo?.tipo === 'palco' ? b.bloque || b.suelta : b.grupo?.id || b.bloque || b.suelta)).map((b) => b.id);
  seleccionFisica.clear(); ids.forEach((id) => seleccionFisica.add(id)); cambiarHerramienta('fisica');
});
document.getElementById('fisica-miembros').addEventListener('click', () => {
  seleccionFisica.clear(); miembrosFisicos(planoEditable(),document.getElementById('tipo-fisico').value,document.getElementById('entidad-fisica').value).forEach((id) => seleccionFisica.add(id)); cambiarHerramienta('fisica');
});
document.getElementById('vaciar-seleccion-fisica').addEventListener('click', () => { seleccionFisica.clear(); actualizarControlesFisicos(); dibujarTodo(); });
for (const [boton,asignar] of [['asignar-entidad-fisica',true],['desvincular-entidad-fisica',false]]) document.getElementById(boton).addEventListener('click', () => {
  const tipo = document.getElementById('tipo-fisico').value;
  const id = asignar ? document.getElementById('entidad-fisica').value : '';
  if (asignar && !id) return;
  aplicarResultadoFisico(asignarPertenenciaFisica(planoEditable(),[...seleccionFisica],tipo,id),'Pertenencia física ' + (asignar ? 'asignada' : 'desvinculada') + '; geometría, IDs y selección de compra conservados.');
});
document.getElementById('formulario-numero-palco').addEventListener('submit', (e) => {
  e.preventDefault(); if (seleccionFisica.size !== 1) return;
  aplicarResultadoFisico(editarNumeroPalco(planoEditable(),[...seleccionFisica][0],document.getElementById('numero-lugar-palco').value),'Número de lugar del palco actualizado.');
});

// ---------------------------------------------------------------------------
// Resumen: agrupa por mesa cuando la butaca pertenece a una.
// ---------------------------------------------------------------------------
function actualizarResumen() {
  // En orden de plano, no de clic: el detalle sale estable.
  const lista = butacas.filter((b) => elegidas.has(b.id));
  document.getElementById('cuenta').textContent = String(lista.length);
  const seleccionEvento = eventoConectado && solicitudDeSeleccionEvento(elegidas, eventoConectado);
  document.getElementById('total').textContent = seleccionEvento && !seleccionEvento.errores
    ? dinero(seleccionEvento.totalCentavos) : 'Precio no disponible';
  document.getElementById('vacio').hidden = lista.length > 0;
  document.getElementById('detalle-vacio').hidden = lista.length > 0;

  const cubos = new Map();
  for (const b of lista) {
    const clave = b.nivel + ':' + (b.grupo ? 'mesa:' + b.grupo.id : 'zona:' + b.zona);
    if (!cubos.has(clave)) cubos.set(clave, []);
    cubos.get(clave).push(b);
  }
  const detalle = document.getElementById('detalle');
  detalle.textContent = '';
  for (const items of cubos.values()) {
    const li = document.createElement('li');
    const zonasDelGrupo = new Set(items.map((b) => b.zona));
    const nombre = items[0].grupo ? items[0].grupo.nombre + ' · ' +
      (zonasDelGrupo.size === 1 ? zonas[items[0].zona].nombre : 'varias zonas') : items[0].seccion;
    const cuantos = (items[0].grupo && items[0].grupo.completa ? (items[0].grupo.tipo === 'palco' ? 'palco completo, ' : 'mesa completa, ') : '') +
                    (items.length === 1 ? '1 lugar' : items.length + ' lugares');
    const cuales = items.map((b) => (b.grupo ? b.numero : b.fila + b.numero)).join(', ');
    li.textContent = (salaActual.niveles.length > 1 ? items[0].nombreNivel + ' · ' : '') + nombre + ' · ' + cuantos + ' (' + cuales + ')' +
      (eventoConectado ? ' · ' + dinero(items.reduce((s, b) => s + eventoConectado.lugares.get(b.id).categoria.precioCentavos, 0)) : '');
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
  if (eventoConectado) {
    const c = conteosDeEvento(eventoConectado);
    document.getElementById('aforo').textContent = c.inventariados + ' inventariados · ' + c.utilizables + ' utilizables · ' +
      c.habilitados + ' habilitados · ' + c.disponibles + ' libres · ' + c.comprables + ' comprables · ' + c.conjuntosComprables + ' conjuntos completos disponibles';
    return;
  }
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
    ...(sala.niveles.length > 1 ? [butacasVisibles().length + ' lugares en ' + sala.niveles.find((n) => n.id === sala.nivel).nombre] : []),
    butacas.length + ' lugares en total',
  ].join(' · ');
}

function redibujar(tipo) {
  if (eventoConectado && tipo !== tipoActual) { anunciar('El evento conserva su recinto y revisión.'); return; }
  zonaExplorada = null;
  seleccionFisica.clear();
  if (arrastreMesa) terminarArrastreMesa(false);
  tipoActual = tipo;
  if (TIPOS_DE_SALA[tipo].revisionFisica?.estado === 'publicada' && modo === 'editor') cambiarModo('vista');
  marcarActivas([]);
  bandaActiva = null;
  const esMapa = TIPOS_DE_SALA[tipo].grupo === GRUPO_MAPAS;
  document.getElementById('nombre-mapa').value = esMapa ? TIPOS_DE_SALA[tipo].nombre : '';
  document.getElementById('eliminar-mapa').hidden = !esMapa;
  salaActual = generarPlano(tipo, planos[tipo]);
  if (!planos[tipo]) planos[tipo] = planoDesdeSala(tipo, salaActual);
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
  if (TIPOS_DE_SALA[clave]?.revisionFisica?.estado === 'publicada') {
    anunciar('La revisión publicada se conserva. Guarda el borrador con otro nombre.'); return;
  }
  if (TIPOS_DE_SALA[clave] && clave !== tipoActual &&
      !confirm('Ya hay un mapa llamado «' + nombre + '». ¿Sobrescribirlo?')) return;
  const nivelAntes = salaActual.nivel;
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
  if (salaActual.niveles.some((n) => n.id === nivelAntes) && salaActual.nivel !== nivelAntes) cambiarNivelVista(nivelAntes);
  anunciar('Mapa «' + nombre + '» guardado en este navegador.');
}

function descargarDocumento(dato, nombre) {
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(new Blob([JSON.stringify(dato, null, 2) + '\n'], { type: 'application/json' }));
  enlace.download = nombre;
  document.body.appendChild(enlace); enlace.click(); enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 0);
}

document.getElementById('publicar-revision').addEventListener('click', () => {
  const nombre = campoNombre.value.trim() || TIPOS_DE_SALA[tipoActual].nombre;
  if (TIPOS_DE_SALA[claveDeMapa(nombre)]?.revisionFisica?.estado === 'publicada') {
    anunciar('Ese nombre identifica una revisión publicada. Usa otro nombre.'); return;
  }
  const candidato = mapaDesdePlano(nombre, planoEditable(), new Date().toISOString(), idsActuales());
  const resultado = publicarRevisionFisica(candidato);
  salaActual = generarPlano(tipoActual, planos[tipoActual]); dibujarTodo();
  if (resultado.errores) { anunciar('No se congeló la revisión: ' + resultado.errores.slice(0, 3).join('; ') + '.'); return; }
  if (!confirm('Congelar la revisión ' + candidato.revisionFisica.numero + ' con ' + resultado.catalogo.lugares.length +
      ' lugares. Sus IDs y ubicación quedarán cerrados; para editar crearás otra revisión. ¿Continuar?')) return;
  const almacen = leerAlmacen();
  if (almacen) { almacen[nombre] = resultado.mapa; if (!escribirAlmacen(almacen)) { anunciar('No se pudo guardar la revisión. Exporta el borrador y vuelve a intentar.'); return; } }
  const clave = registrarMapa(resultado.mapa);
  historiales[tipoActual].marcarGuardado(); delete planos[clave]; delete historiales[clave];
  descargarDocumento(resultado.mapa, nombreDeArchivo(nombre).replace('.json', '-revision-' + candidato.revisionFisica.numero + '.json'));
  construirSelector(clave); redibujar(clave);
  anunciar('Revisión ' + candidato.revisionFisica.numero + ' congelada y exportada. No se ha publicado en Sin Taquilla.');
});

document.getElementById('nuevo-borrador').addEventListener('click', () => {
  if (eventoConectado) { anunciar('El evento conserva su revisión publicada. Abre el editor fuera de la compra.'); return; }
  const origen = planoEditable();
  const nuevo = nuevaRevisionFisica(origen);
  const conocidas = Object.values(TIPOS_DE_SALA).map((d) => d.revisionFisica).filter((r) => r?.recintoId === origen.revisionFisica.recintoId);
  nuevo.revisionFisica.numero = Math.max(origen.revisionFisica.numero, ...conocidas.map((r) => r.numero)) + 1;
  const nombre = (TIPOS_DE_SALA[tipoActual].nombre.slice(0, 50) + ' · borrador ' + nuevo.revisionFisica.numero);
  const mapa = mapaDesdePlano(nombre, nuevo, null);
  const clave = registrarMapa(mapa); construirSelector(clave); redibujar(clave); cambiarModo('editor');
  anunciar('Nuevo borrador creado; la revisión anterior se conserva. Guarda este borrador cuando termines.');
});

function exportarMapa() {
  const nombre = campoNombre.value.trim() || TIPOS_DE_SALA[tipoActual].nombre;
  const mapa = mapaDesdePlano(nombre, planoEditable(), new Date().toISOString(), idsActuales());
  salaActual = generarPlano(tipoActual, planos[tipoActual]); dibujarTodo();
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

function revisarZonasFisicas() {
  const asignadas = Object.entries(planoEditable().zonasDeAsiento || {});
  if (!asignadas.length) {
    anunciar('No hay zonas físicas asignadas a lugares individuales.');
    return;
  }
  for (let i = 0; i < asignadas.length; i += 20) {
    const muestra = asignadas.slice(i, i + 20).map(([id, zona]) => id + ' → ' + (zonas[zona]?.nombre || zona));
    const pregunta = 'Comprueba que estas asignaciones indican ubicación física, no solo tarifa ' +
      '(' + (i + 1) + '–' + Math.min(i + 20, asignadas.length) + ' de ' + asignadas.length + '):\n\n' +
      muestra.join('\n') + '\n\n¿Confirmas estas zonas físicas?';
    if (!confirm(pregunta)) return;
  }
  planos[tipoActual] = confirmarZonasFisicas(planoEditable());
  regenerar('Zonas físicas confirmadas para ' + asignadas.length + ' lugares.');
}

function exportarCatalogoLugares() {
  const nombre = campoNombre.value.trim() || TIPOS_DE_SALA[tipoActual].nombre;
  const mapa = mapaDesdePlano(nombre, planoEditable(), new Date().toISOString(), idsActuales());
  const { catalogo, errores } = exportarLugaresDeMapa(mapa);
  // La validacion genera el mapa candidato: vuelve a mostrar el que se edita.
  salaActual = generarPlano(tipoActual, planos[tipoActual]);
  dibujarTodo();
  if (errores) {
    anunciar('No se pudo exportar el catálogo: ' + errores.slice(0, 3).join('; ') +
      (errores.length > 3 ? '… (' + errores.length + ' problemas)' : '') + '.');
    return;
  }
  const archivo = new Blob([JSON.stringify(catalogo, null, 2) + '\n'], { type: 'application/json' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = nombreDeArchivo(nombre).replace(/\.json$/, '-lugares.json');
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 0);
  anunciar('Catálogo de ' + catalogo.lugares.length + ' lugares validado y exportado.');
}

// Un mapa real ocupa pocos KB: un archivo mayor no se lee, para no bloquear la pestaña
// leyendo y validando algo que no es un mapa razonable.
const ARCHIVO_MAXIMO = 8 * 1024 * 1024;

async function importarMapa(archivo) {
  if (archivo.size > ARCHIVO_MAXIMO) {
    anunciar('No se pudo importar ' + archivo.name + ': es demasiado grande para ser un mapa (pasa de 8 MB).');
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
  if (TIPOS_DE_SALA[clave]?.revisionFisica?.estado === 'publicada') {
    anunciar('No se sobrescribe una revisión publicada. Usa otro nombre para importar el borrador.'); return;
  }
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
document.getElementById('exportar-lugares').addEventListener('click', exportarCatalogoLugares);
document.getElementById('confirmar-zonas-fisicas').addEventListener('click', revisarZonasFisicas);
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
