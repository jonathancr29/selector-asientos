// Pruebas de la parte sin DOM de index.html: rejilla, reparto de mesas, datos
// del plano, conciliacion de la seleccion y reglas del editor de mesas.
//
//   node --test pruebas.mjs
//
// No hay copia del codigo: se lee index.html, se toma el <script> hasta la marca
// «Fin de la parte sin DOM» y se evalua. Lo que se prueba es lo que se sirve.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const inicio = html.indexOf('<script>') + '<script>'.length;
const fin = html.indexOf('// === Fin de la parte sin DOM');
assert.ok(inicio > 0 && fin > inicio, 'no se encontro la parte sin DOM en index.html');

const cargar = () => new Function(html.slice(inicio, fin) +
  '\nreturn { ANCHO_SALA, LARGO_MAXIMO, ESTILOS, rejillaDeSala, repartirMesas, generarPlano, butacas,' +
  ' muebles, mesas, conciliarSeleccion, geometriaMesa, celdasOcupadas, motivoNoCabe, buscarHueco,' +
  ' colocarCerca, girarMesa, cambiarLargo, alternarCabeceras, alternarUnLado, buscarSitioLibre,' +
  ' TIPOS_DE_SALA, primeraMesaQueNoCabe, redimensionarBanda, moverBanda, eliminarBanda, agregarBanda,' +
  ' cambiarZonaBanda, planoDesdeSala };')();

const DISPOSICIONES = ['ninguno', 'izquierda', 'derecha', 'ambos'];
const rango = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

test('columnas de pasillo de la sala de ejemplo', () => {
  const { rejillaDeSala, ANCHO_SALA } = cargar();
  const esperado = { ninguno: [], izquierda: [5], derecha: [10], ambos: [5, 10] };
  for (const pasillos of DISPOSICIONES) {
    const { columnas } = rejillaDeSala({ ancho: ANCHO_SALA, pasillos });
    const vacias = rango(1, ANCHO_SALA).filter((c) => !columnas.includes(c));
    assert.deepEqual(vacias, esperado[pasillos], pasillos);
  }
});

test('aforo de la sala de ejemplo (tabla del README)', () => {
  const { generarPlano, butacas } = cargar();
  const esperado = { ninguno: [14, 94], izquierda: [13, 89], derecha: [13, 89], ambos: [12, 84] };
  for (const pasillos of DISPOSICIONES) {
    const sala = generarPlano('mixta-' + pasillos);
    assert.deepEqual([sala.columnas.length, butacas.length], esperado[pasillos], pasillos);
  }
});

test('la rejilla es valida para cualquier ancho', () => {
  const { rejillaDeSala } = cargar();
  for (let ancho = 6; ancho <= 40; ancho++) {
    for (const pasillos of DISPOSICIONES) {
      const { bloques, columnas } = rejillaDeSala({ ancho, pasillos });
      const caso = `${pasillos}, ancho ${ancho}`;
      assert.equal(columnas.length, ancho - (bloques.length - 1), caso);
      assert.ok(columnas.every((c, i) => c >= 1 && c <= ancho && (i === 0 || c > columnas[i - 1])), caso);
      // Dentro de un bloque las columnas son contiguas; entre bloques hay exactamente un hueco.
      bloques.forEach((b, i) => {
        assert.ok(b.every((c, k) => k === 0 || c === b[k - 1] + 1), caso);
        if (i) assert.equal(b[0], bloques[i - 1].at(-1) + 2, caso);
      });
    }
  }
});

test('disposicion desconocida lanza error', () => {
  const { rejillaDeSala } = cargar();
  assert.throws(() => rejillaDeSala({ ancho: 14, pasillos: 'centro' }), /Disposicion desconocida/);
});

test('las mesas caben en su bloque, no cruzan pasillos y no se solapan', () => {
  const { rejillaDeSala, repartirMesas } = cargar();
  for (let ancho = 6; ancho <= 40; ancho++) {
    for (const pasillos of DISPOSICIONES) {
      const sala = rejillaDeSala({ ancho, pasillos });
      for (let cuantas = 0; cuantas <= 12; cuantas++) {
        const caso = `${pasillos}, ancho ${ancho}, ${cuantas} mesas`;
        const arranques = repartirMesas(sala, cuantas);
        const capacidad = sala.bloques.reduce((s, b) => s + Math.floor(b.length / 2), 0);
        assert.equal(arranques.length, Math.min(cuantas, capacidad), caso);
        const ocupadas = new Set();
        for (const x of arranques) {
          assert.ok(sala.bloques.some((b) => b.includes(x) && b.includes(x + 1)), caso + `: mesa en ${x}`);
          for (const c of [x, x + 1]) {
            assert.ok(!ocupadas.has(c), caso + `: columna ${c} repetida`);
            ocupadas.add(c);
          }
        }
      }
    }
  }
});


test('conciliar la seleccion suelta ausentes y no libres, y conserva el resto', () => {
  const { generarPlano, butacas, conciliarSeleccion } = cargar();
  generarPlano('mixta-ninguno');
  const libres = new Set(butacas.filter((b) => b.estado === 'libre').map((b) => b.id));
  const elegidas = new Set(['luneta-A1', 'luneta-A13', 'luneta-A14', 'general-B11', 'general-B12', 'M1-N1']);
  for (const id of elegidas) assert.ok(libres.has(id), id + ' deberia estar libre en «ninguno»');

  generarPlano('mixta-ambos');
  const { ausentes, noLibres } = conciliarSeleccion(elegidas, butacas);
  assert.deepEqual(ausentes, ['luneta-A13', 'luneta-A14']);
  assert.deepEqual(noLibres, ['general-B11', 'general-B12']);
  assert.deepEqual([...elegidas], ['luneta-A1', 'M1-N1']);
});

// --- Geometria de mesas ------------------------------------------------------

const resumenGeo = (g) => ({
  ancho: g.ancho, alto: g.alto, tablero: g.tablero,
  lugares: g.lugares.map((l) => l.lado + '@' + l.dx + ',' + l.dy),
});

test('geometria del estilo «lados»: 2 x 3, lugares en sentido horario', () => {
  const { geometriaMesa } = cargar();
  assert.deepEqual(resumenGeo(geometriaMesa({ largo: 2, cabeceras: false, giro: 0 })), {
    ancho: 2, alto: 3, tablero: { dx: 0, dy: 1, w: 2, h: 1 },
    lugares: ['N1@0,0', 'N2@1,0', 'S2@1,2', 'S1@0,2'],
  });
});

test('geometria del estilo «cruz»: 3 x 3, un lugar por lado y la mesa en el centro', () => {
  const { geometriaMesa } = cargar();
  assert.deepEqual(resumenGeo(geometriaMesa({ largo: 1, cabeceras: true, giro: 0 })), {
    ancho: 3, alto: 3, tablero: { dx: 1, dy: 1, w: 1, h: 1 },
    lugares: ['N1@1,0', 'C2@2,1', 'S1@1,2', 'C1@0,1'],
  });
});

test('geometria girada 90 grados: la horizontal en sentido horario', () => {
  const { geometriaMesa } = cargar();
  assert.deepEqual(resumenGeo(geometriaMesa({ largo: 2, cabeceras: false, giro: 90 })), {
    ancho: 3, alto: 2, tablero: { dx: 1, dy: 0, w: 1, h: 2 },
    lugares: ['N1@2,0', 'N2@2,1', 'S2@0,1', 'S1@0,0'],
  });
  const larga = geometriaMesa({ largo: 3, cabeceras: true, giro: 90 });
  assert.deepEqual([larga.ancho, larga.alto, larga.lugares.length], [3, 5, 8]);
  assert.deepEqual(larga.tablero, { dx: 1, dy: 1, w: 1, h: 3 });
});

test('geometria del estilo «barra»: tablero arriba y lugares solo en el lado sur', () => {
  const { geometriaMesa, ESTILOS } = cargar();
  assert.deepEqual(resumenGeo(geometriaMesa({ ...ESTILOS.barra, giro: 0 })), {
    ancho: 4, alto: 2, tablero: { dx: 0, dy: 0, w: 4, h: 1 },
    lugares: ['S4@3,1', 'S3@2,1', 'S2@1,1', 'S1@0,1'],
  });
  // Girada 180: el tablero abajo y los lugares arriba.
  const g = geometriaMesa({ ...ESTILOS.barra, giro: 180 });
  assert.deepEqual([g.tablero.dy, ...new Set(g.lugares.map((l) => l.dy))], [1, 0]);
  // Con cabeceras, las cabeceras van a la altura del tablero.
  assert.deepEqual(resumenGeo(geometriaMesa({ largo: 1, cabeceras: true, unLado: true, giro: 0 })).lugares,
    ['C2@2,0', 'S1@1,1', 'C1@0,0']);
});

test('cada lugar mira hacia el tablero en cualquier giro', () => {
  const { geometriaMesa, LARGO_MAXIMO } = cargar();
  // mira 0 = hacia abajo; cada 90 grados gira en sentido horario: izquierda, arriba, derecha.
  const direccion = { 0: [0, 1], 90: [-1, 0], 180: [0, -1], 270: [1, 0] };
  for (let largo = 1; largo <= 3; largo++) {
    for (const cabeceras of [false, true]) {
      for (const unLado of [false, true]) {
        for (const giro of [0, 90, 180, 270]) {
          const g = geometriaMesa({ largo, cabeceras, unLado, giro });
          const caso = JSON.stringify({ largo, cabeceras, unLado, giro });
          for (const l of g.lugares) {
            const [ddx, ddy] = direccion[l.mira];
            const x = l.dx + ddx, y = l.dy + ddy;
            const t = g.tablero;
            assert.ok(x >= t.dx && x < t.dx + t.w && y >= t.dy && y < t.dy + t.h, caso + ': ' + l.lado);
          }
        }
      }
    }
  }
  assert.ok(LARGO_MAXIMO >= 3);
});

test('las celdas de lugares y tablero no se solapan y caben en la huella', () => {
  const { geometriaMesa, LARGO_MAXIMO } = cargar();
  for (let largo = 1; largo <= LARGO_MAXIMO; largo++) {
    for (const cabeceras of [false, true]) {
      for (const unLado of [false, true]) {
        for (const giro of [0, 90, 180, 270]) {
          const g = geometriaMesa({ largo, cabeceras, unLado, giro });
          const caso = JSON.stringify({ largo, cabeceras, unLado, giro });
          assert.equal(g.lugares.length, (unLado ? 1 : 2) * largo + (cabeceras ? 2 : 0), caso);
          const vistas = new Set();
          const marcar = (dx, dy) => {
            assert.ok(dx >= 0 && dx < g.ancho && dy >= 0 && dy < g.alto, caso + `: ${dx},${dy} fuera`);
            assert.ok(!vistas.has(dx + ',' + dy), caso + `: ${dx},${dy} repetida`);
            vistas.add(dx + ',' + dy);
          };
          g.lugares.forEach((l) => marcar(l.dx, l.dy));
          for (let i = 0; i < g.tablero.w; i++) {
            for (let j = 0; j < g.tablero.h; j++) marcar(g.tablero.dx + i, g.tablero.dy + j);
          }
        }
      }
    }
  }
});

test('los lugares se llaman por lado, se numeran en sentido horario y conservan la reserva de M2', () => {
  const { generarPlano, butacas } = cargar();
  generarPlano('mixta-ambos');
  const m2 = butacas.filter((b) => b.grupo?.id === 'M2');
  assert.deepEqual(m2.map((b) => [b.id, b.numero, b.estado]), [
    ['M2-N1', 1, 'libre'], ['M2-N2', 2, 'libre'], ['M2-S2', 3, 'ocupada'], ['M2-S1', 4, 'ocupada'],
  ]);
});

test('girar y alargar no renombran los lugares existentes', () => {
  const { generarPlano, butacas, mesas, girarMesa, cambiarLargo } = cargar();
  const idsDe = (id) => butacas.filter((b) => b.grupo?.id === id).map((b) => b.id).sort();
  generarPlano('mixta-ambos');
  const base = mesas.map(({ id, x, y, largo, cabeceras, unLado, giro }) => ({ id, x, y, largo, cabeceras, unLado, giro }));
  const antes = idsDe('M1');

  generarPlano('mixta-ambos', { mesas: base.map((c) => (c.id === 'M1' ? girarMesa(c) : c)) });
  assert.deepEqual(idsDe('M1'), antes);

  generarPlano('mixta-ambos', { mesas: base.map((c) => (c.id === 'M1' ? cambiarLargo(c, 1) : c)) });
  assert.deepEqual(idsDe('M1'), [...antes, 'M1-N3', 'M1-S3'].sort());
  // Los lugares que ya existian no se movieron: se crece por el extremo final.
  const n1 = butacas.find((b) => b.id === 'M1-N1');
  assert.deepEqual([n1.x, n1.y], [2, 7]);
});

// --- Operaciones del editor --------------------------------------------------

test('cuatro giros dejan la mesa exactamente donde estaba, y dos la dejan en su huella', () => {
  const { girarMesa, ESTILOS } = cargar();
  const casos = [
    { ...ESTILOS.lados }, { ...ESTILOS.cruz }, { ...ESTILOS.barra },
    { largo: 3, cabeceras: false, unLado: false }, { largo: 4, cabeceras: true, unLado: false },
    { largo: 1, cabeceras: false, unLado: true }, { largo: 2, cabeceras: true, unLado: true },
  ];
  for (const forma of casos) {
    const mesa = { id: 'M9', x: 6, y: 9, giro: 0, ...forma };
    let m = mesa;
    const giros = [];
    for (let i = 0; i < 4; i++) { m = girarMesa(m); giros.push(m.giro); }
    assert.deepEqual(giros, [90, 180, 270, 0], JSON.stringify(forma));
    assert.deepEqual(m, mesa, JSON.stringify(forma));
    const mediaVuelta = girarMesa(girarMesa(mesa));
    assert.deepEqual([mediaVuelta.x, mediaVuelta.y], [6, 9], JSON.stringify(forma));
  }
  // La cruz es cuadrada: girar no la desplaza.
  const cruz = girarMesa({ id: 'M9', x: 6, y: 9, giro: 0, ...ESTILOS.cruz });
  assert.deepEqual([cruz.x, cruz.y], [6, 9]);
});

test('cambiarLargo respeta el minimo y el maximo', () => {
  const { cambiarLargo, LARGO_MAXIMO } = cargar();
  const mesa = { id: 'M9', x: 1, y: 1, largo: 1, cabeceras: false, giro: 0 };
  assert.equal(cambiarLargo(mesa, -1), null);
  assert.equal(cambiarLargo({ ...mesa, largo: LARGO_MAXIMO }, 1), null);
  assert.equal(cambiarLargo(mesa, 1).largo, 2);
});

test('cabeceras, un lado y largo no mueven el tablero, y alternar dos veces vuelve al inicio', () => {
  const { alternarCabeceras, alternarUnLado, cambiarLargo, geometriaMesa } = cargar();
  const inicioTablero = (m) => {
    const t = geometriaMesa(m).tablero;
    return [m.x + t.dx, m.y + t.dy];
  };
  for (const giro of [0, 90, 180, 270]) {
    for (const unLado of [false, true]) {
      const mesa = { id: 'M9', x: 5, y: 8, largo: 2, cabeceras: false, unLado, giro };
      const caso = JSON.stringify({ giro, unLado });
      for (const cambio of [alternarCabeceras, alternarUnLado, (m) => cambiarLargo(m, 1)]) {
        assert.deepEqual(inicioTablero(cambio(mesa)), inicioTablero(mesa), caso + ' ' + cambio.name);
      }
      assert.deepEqual(alternarCabeceras(alternarCabeceras(mesa)), mesa, caso);
      assert.deepEqual(alternarUnLado(alternarUnLado(mesa)), mesa, caso);
    }
  }
});

test('pasar a un solo lado quita los lugares del norte y conserva los del sur', () => {
  const { generarPlano, butacas, mesas, alternarUnLado } = cargar();
  generarPlano('mixta-ambos');
  const base = mesas.map(({ id, x, y, largo, cabeceras, unLado, giro }) => ({ id, x, y, largo, cabeceras, unLado, giro }));
  const antes = butacas.filter((b) => b.id.startsWith('M2-S')).map((b) => [b.id, b.x, b.y, b.estado]);
  generarPlano('mixta-ambos', { mesas: base.map((c) => (c.id === 'M2' ? alternarUnLado(c) : c)) });
  const m2 = butacas.filter((b) => b.grupo?.id === 'M2');
  assert.deepEqual(m2.map((b) => b.id), ['M2-S2', 'M2-S1']);
  // Mismas celdas que antes: el tablero no se movio y los del sur siguen debajo.
  const sur = Object.fromEntries(m2.map((b) => [b.id, [b.x, b.y, b.estado]]));
  for (const [id, x, y, estado] of antes) assert.deepEqual(sur[id], [x, y, estado], id);
});

test('motivoNoCabe: pasillo, choque, fuera de la sala y sitio valido', () => {
  const { generarPlano, mesas, celdasOcupadas, motivoNoCabe } = cargar();
  // «ambos»: pasillos en las columnas 5 y 10; mesas en las columnas 2, 7 y 12,
  // filas 7 y 11; banda General (filas A y B) en la 18 y la 19.
  const sala = generarPlano('mixta-ambos');
  assert.deepEqual(mesas.map((m) => [m.id, m.x, m.y]),
    [['M1', 2, 7], ['M2', 7, 7], ['M3', 12, 7], ['M4', 2, 11], ['M5', 7, 11], ['M6', 12, 11]]);
  const lados = (x, y) => ({ id: 'M1', x, y, largo: 2, cabeceras: false, giro: 0 });

  const sinM1 = celdasOcupadas('M1');
  assert.equal(motivoNoCabe(sala, sinM1, lados(4, 7)), 'cae sobre un pasillo');   // columnas 4 y 5
  assert.equal(motivoNoCabe(sala, sinM1, lados(1, 3)), 'choca con la fila B de Luneta');
  assert.equal(motivoNoCabe(sala, sinM1, lados(7, 7)), 'choca con Mesa 2');
  assert.equal(motivoNoCabe(sala, sinM1, lados(3, 12)), 'choca con Mesa 4');
  assert.equal(motivoNoCabe(sala, sinM1, lados(0, 7)), 'se sale de la sala');
  assert.equal(motivoNoCabe(sala, sinM1, lados(14, 7)), 'se sale de la sala');   // la segunda columna seria la 15
  assert.equal(motivoNoCabe(sala, sinM1, lados(1, 5)), null);
  assert.equal(motivoNoCabe(sala, sinM1, lados(2, 7)), null);                    // su propio sitio no le estorba
  assert.equal(motivoNoCabe(sala, sinM1, lados(2, 15)), null);                   // filas 15 a 17, justo antes de General
  assert.equal(motivoNoCabe(sala, sinM1, lados(2, 16)), 'choca con la fila A de General');

  // Las esquinas vacias de la cruz estan reservadas. En «ninguno», Mesa 1 ocupa las
  // columnas 3-4 desde la fila 7. Una cruz en (1, 5) ocupa columnas 1-3 y filas 5-7:
  // solo su esquina inferior derecha, (3, 7), cae sobre Mesa 1, y aun asi no cabe.
  const salaSinPasillos = generarPlano('mixta-ninguno');
  const cruz = { id: 'M9', x: 1, y: 5, largo: 1, cabeceras: true, giro: 0 };
  assert.equal(motivoNoCabe(salaSinPasillos, celdasOcupadas('M9'), cruz), 'choca con Mesa 1');
  assert.equal(motivoNoCabe(salaSinPasillos, celdasOcupadas('M9'), { ...cruz, y: 4 }), 'choca con la fila C de Luneta');
  generarPlano('mixta-ambos');
  // Vertical, la mesa de lados ocupa 3 columnas: en «ambos» cabe en el bloque 1-4.
  assert.equal(motivoNoCabe(sala, sinM1, { ...lados(2, 14), giro: 90 }), null);
  assert.equal(motivoNoCabe(sala, sinM1, { ...lados(3, 14), giro: 90 }), 'cae sobre un pasillo');
});

test('buscarHueco salta pasillos, no atraviesa filas y se detiene en el borde', () => {
  const { generarPlano, mesas, celdasOcupadas, buscarHueco } = cargar();
  // «izquierda»: pasillo en la columna 5; mesas en las columnas 2, 8 y 11.
  const sala = generarPlano('mixta-izquierda');
  assert.deepEqual(mesas.filter((m) => m.y === 7).map((m) => m.x), [2, 8, 11]);
  const sinM1 = celdasOcupadas('M1');
  const m1 = (x, y) => ({ id: 'M1', x, y, largo: 2, cabeceras: false, giro: 0 });

  assert.deepEqual(buscarHueco(sala, sinM1, m1(2, 7), 1, 0), { x: 3, y: 7 });
  // Desde la columna 3: la 4 y la 5 caen en el pasillo; salta a la 6.
  assert.deepEqual(buscarHueco(sala, sinM1, m1(3, 7), 1, 0), { x: 6, y: 7 });
  assert.deepEqual(buscarHueco(sala, sinM1, m1(2, 7), 0, 1), { x: 2, y: 8 });
  // Desde la fila 8 hacia abajo salta Mesa 4 (filas 11 a 13) hasta la franja libre.
  assert.deepEqual(buscarHueco(sala, sinM1, m1(2, 8), 0, 1), { x: 2, y: 14 });
  // Desde la 15 ya no queda sitio antes de la banda General.
  assert.equal(buscarHueco(sala, sinM1, m1(2, 15), 0, 1), null);
  // Hacia arriba desde la fila 5 estan las filas A a C.
  assert.equal(buscarHueco(sala, sinM1, m1(2, 5), 0, -1), null);
  assert.equal(buscarHueco(sala, sinM1, m1(1, 7), -1, 0), null);
});

test('colocarCerca busca el sitio mas proximo y, si no hay, devuelve el motivo', () => {
  const { generarPlano, celdasOcupadas, colocarCerca, girarMesa } = cargar();
  const sala = generarPlano('mixta-ambos');
  const m1 = { id: 'M1', x: 2, y: 7, largo: 2, cabeceras: false, giro: 0 };
  // Girada sobre su centro queda en (1, 7), columnas 1 a 3: cabe sin moverse.
  assert.deepEqual(colocarCerca(sala, celdasOcupadas('M1'), girarMesa(m1)),
    { ...m1, giro: 90, x: 1, y: 7 });
  // En (4, 7) cae sobre el pasillo; a una celda, (3, 7) si cabe.
  assert.deepEqual(colocarCerca(sala, celdasOcupadas('M1'), { ...m1, x: 4 }), { ...m1, x: 3 });
  // Encima de la fila A no hay nada a una celda de distancia.
  assert.deepEqual(colocarCerca(sala, celdasOcupadas('M1'), { ...m1, y: 2 }), { motivo: 'choca con la fila A de Luneta' });
});

test('buscarSitioLibre encuentra hueco en las salas con zona de mesas, y no en «solo filas»', () => {
  const { generarPlano, celdasOcupadas, buscarSitioLibre, motivoNoCabe, ESTILOS, TIPOS_DE_SALA } = cargar();
  const sinHueco = generarPlano('solo-filas');
  assert.equal(buscarSitioLibre(sinHueco, celdasOcupadas(null), { id: 'M1', x: 0, y: 0, ...ESTILOS.lados, giro: 0 }), null);
  for (const pasillos of Object.keys(TIPOS_DE_SALA).filter((tipo) => tipo !== 'solo-filas')) {
    const sala = generarPlano(pasillos);
    for (const estilo of ['lados', 'cruz', 'barra']) {
      const config = { id: 'M7', x: 0, y: 0, ...ESTILOS[estilo], giro: 0 };
      const sitio = buscarSitioLibre(sala, celdasOcupadas(null), config);
      assert.ok(sitio, `${pasillos}, ${estilo}: sin sitio`);
      assert.equal(motivoNoCabe(sala, celdasOcupadas(null), sitio), null, `${pasillos}, ${estilo}`);
    }
  }
});

test('las posiciones automaticas son validas en todos los tipos de sala', () => {
  const { generarPlano, mesas, celdasOcupadas, motivoNoCabe, TIPOS_DE_SALA } = cargar();
  const esperadas = { 'solo-filas': 0, 'solo-mesas': 12 };
  for (const pasillos of Object.keys(TIPOS_DE_SALA)) {
    const sala = generarPlano(pasillos);
    assert.equal(mesas.length, esperadas[pasillos] ?? 6, pasillos);
    for (const m of mesas) {
      assert.equal(motivoNoCabe(sala, celdasOcupadas(m.id), m), null, `${pasillos}, ${m.id}`);
    }
  }
});

// --- Tipos de sala y bandas ------------------------------------------------

// El plano se saca de la sala generada con la misma funcion que usa el editor.
const planoDe = (api, tipo) => {
  const sala = api.generarPlano(tipo);
  return { sala, plano: api.planoDesdeSala(tipo, sala) };
};
const resumenBandas = (sala) => sala.bandas.map((b) => b.nombre + '@' + b.y + '+' + b.alto);
const posiciones = (mesas) => Object.fromEntries(mesas.map((m) => [m.id, m.y]));

test('las bandas se apilan y cada banda de filas empieza su secuencia en A', () => {
  const { generarPlano, butacas } = cargar();
  const sala = generarPlano('mixta-ambos');
  assert.deepEqual(resumenBandas(sala), ['Escenario@0+2', 'Luneta@2+3', 'Zona de mesas@5+13', 'General@18+2']);
  assert.deepEqual([sala.alto, sala.filas.min, sala.filas.max], [20, 2, 19]);
  const a1 = butacas.filter((b) => b.fila === 'A' && b.numero === 1).map((b) => [b.id, b.bandaNombre, b.y]);
  assert.deepEqual(a1, [['luneta-A1', 'Luneta', 2], ['general-A1', 'General', 18]]);
  // Ocupadas y bloqueadas salen de la definicion de cada banda.
  assert.deepEqual(butacas.filter((b) => b.banda === 'general' && b.estado !== 'libre').map((b) => b.id + ':' + b.estado),
    ['general-A1:ocupada', 'general-A2:ocupada', 'general-A3:ocupada', 'general-B11:bloqueada', 'general-B12:bloqueada']);
});

test('«solo filas» y «solo mesas» generan salas sin mesas y sin filas', () => {
  const { generarPlano, butacas, mesas } = cargar();
  const filas = generarPlano('solo-filas');
  assert.deepEqual(resumenBandas(filas), ['Escenario@0+2', 'Platea@2+7', 'General@9+5']);
  assert.equal(mesas.length, 0);
  assert.equal(butacas.length, 12 * 12);
  assert.deepEqual([...new Set(butacas.filter((b) => b.banda === 'platea').map((b) => b.fila))].join(''), 'ABCDEFG');

  const salon = generarPlano('solo-mesas');
  assert.deepEqual(resumenBandas(salon), ['Escenario@0+2', 'Salón@2+20']);
  assert.equal(butacas.filter((b) => !b.grupo).length, 0);
  assert.equal(mesas.length, 12);
  assert.deepEqual([salon.filas.min, salon.filas.max], [2, 21]);
});

test('las bandas sin nombre toman el de su zona, numerado si se repite', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  const conOtra = api.agregarBanda(api.agregarBanda(plano, 'filas'), 'mesas');
  assert.deepEqual(conOtra.bandas.slice(-2).map((b) => b.id), ['banda1', 'banda2']);
  assert.equal(conOtra.siguienteBanda, 3);
  const sala = api.generarPlano('mixta-ambos', conOtra);
  assert.deepEqual(resumenBandas(sala).slice(-2), ['General 2@20+2', 'Zona de mesas 2@22+4']);
  assert.ok(api.butacas.some((b) => b.id === 'banda1-A1' && b.bandaNombre === 'General 2'));
  // Cambiar la zona cambia el nombre y el precio.
  const luneta = api.generarPlano('mixta-ambos', api.cambiarZonaBanda(conOtra, 'banda1', 'luneta'));
  assert.equal(luneta.bandas.find((b) => b.id === 'banda1').nombre, 'Luneta 2');
  assert.equal(api.butacas.find((b) => b.id === 'banda1-A1').zona, 'luneta');
});

test('redimensionar una banda desplaza lo de debajo y detecta mesas que dejan de caber', () => {
  const api = cargar();
  const { plano, sala } = planoDe(api, 'mixta-ambos');

  const masLuneta = api.redimensionarBanda(plano, sala, 'luneta', 1);
  assert.deepEqual(posiciones(masLuneta.mesas), { M1: 8, M2: 8, M3: 8, M4: 12, M5: 12, M6: 12 });
  api.generarPlano('mixta-ambos', masLuneta);
  assert.equal(api.primeraMesaQueNoCabe(api.generarPlano('mixta-ambos', masLuneta)), null);
  assert.ok(api.butacas.some((b) => b.id === 'luneta-D1'));

  // La zona de mesas baja de 13 a 8 filas: la General sube a la 13 y pisa la segunda fila de mesas.
  let menos = plano, salaMenos = sala;
  for (let i = 0; i < 5; i++) {
    menos = api.redimensionarBanda(menos, salaMenos, 'mesas', -1);
    salaMenos = api.generarPlano('mixta-ambos', menos);
  }
  const fallo = api.primeraMesaQueNoCabe(salaMenos);
  assert.deepEqual([fallo.mesa.id, fallo.motivo], ['M4', 'choca con la fila A de General']);

  assert.deepEqual(api.redimensionarBanda(plano, sala, 'escenario', 1), { motivo: 'el escenario tiene un alto fijo' });
  assert.deepEqual(api.redimensionarBanda(plano, sala, 'general', -2), { motivo: 'ya tiene el mínimo' });
});

test('mover una banda lleva consigo sus mesas y no pasa por encima del escenario', () => {
  const api = cargar();
  const { plano, sala } = planoDe(api, 'mixta-ambos');
  // General sube por encima de la zona de mesas: ocupa las filas 5-6 y las mesas bajan 2.
  const subida = api.moverBanda(plano, sala, 'general', -1);
  const salaSubida = api.generarPlano('mixta-ambos', subida);
  assert.deepEqual(resumenBandas(salaSubida), ['Escenario@0+2', 'Luneta@2+3', 'General@5+2', 'Zona de mesas@7+13']);
  assert.deepEqual(posiciones(subida.mesas), { M1: 9, M2: 9, M3: 9, M4: 13, M5: 13, M6: 13 });
  assert.equal(api.primeraMesaQueNoCabe(salaSubida), null);

  assert.deepEqual(api.moverBanda(plano, sala, 'luneta', -1), { motivo: 'ya está arriba del todo' });
  assert.deepEqual(api.moverBanda(plano, sala, 'general', 1), { motivo: 'ya está abajo del todo' });
});

test('eliminar una banda quita sus mesas y sube lo de debajo', () => {
  const api = cargar();
  const { plano, sala } = planoDe(api, 'mixta-ambos');
  const sinMesas = api.eliminarBanda(plano, sala, 'mesas');
  assert.deepEqual(sinMesas.mesas, []);
  assert.deepEqual(resumenBandas(api.generarPlano('mixta-ambos', sinMesas)), ['Escenario@0+2', 'Luneta@2+3', 'General@5+2']);

  const sinLuneta = api.eliminarBanda(plano, sala, 'luneta');
  assert.deepEqual(posiciones(sinLuneta.mesas), { M1: 4, M2: 4, M3: 4, M4: 8, M5: 8, M6: 8 });
  const salaSinLuneta = api.generarPlano('mixta-ambos', sinLuneta);
  assert.equal(api.primeraMesaQueNoCabe(salaSinLuneta), null);
  assert.ok(!api.butacas.some((b) => b.banda === 'luneta'));

  assert.deepEqual(api.eliminarBanda(plano, sala, 'escenario'), { motivo: 'el escenario no se puede eliminar' });
});

test('una mesa puede ir en cualquier hueco libre de la sala, tambien en una zona agregada', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'solo-filas');
  const conZona = api.agregarBanda(plano, 'mesas');
  const sala = api.generarPlano('solo-filas', conZona);
  const sitio = api.buscarSitioLibre(sala, api.celdasOcupadas(null), { id: 'M1', x: 0, y: 0, ...api.ESTILOS.lados, giro: 0 });
  // La zona nueva ocupa las filas 14 a 17: la mesa de 3 de alto cabe desde la 14.
  assert.deepEqual([sitio.x, sitio.y], [1, 14]);
});

test('planoDesdeSala conserva el alto de las zonas de mesas y regenera la misma sala', () => {
  const api = cargar();
  for (const tipo of Object.keys(api.TIPOS_DE_SALA)) {
    const { sala, plano } = planoDe(api, tipo);
    const antes = resumenBandas(sala);
    const ids = api.butacas.map((b) => b.id);
    for (const banda of plano.bandas.filter((b) => b.tipo === 'mesas')) assert.equal(typeof banda.alto, 'number', tipo);
    assert.ok(plano.bandas.every((b) => b.y === undefined), tipo);
    const otra = api.generarPlano(tipo, plano);
    assert.deepEqual(resumenBandas(otra), antes, tipo);
    assert.deepEqual(api.butacas.map((b) => b.id), ids, tipo);
  }
  // Solo guarda los nombres puestos a mano: «Platea» si, «General» no.
  const { plano } = planoDe(api, 'solo-filas');
  assert.deepEqual(plano.bandas.map((b) => b.nombre), [undefined, 'Platea', undefined]);
});

