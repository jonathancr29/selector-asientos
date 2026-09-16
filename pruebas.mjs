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
  ' colocarCerca, girarPieza, cambiarLargo, alternarCabeceras, alternarUnLado, buscarSitioLibre,' +
  ' TIPOS_DE_SALA, primeraPiezaQueNoCabe, redimensionarBanda, moverBanda, eliminarBanda, agregarBanda,' +
  ' cambiarZonaBanda, planoDesdeSala, alternarBloqueada, mapaDesdePlano, validarMapa, registrarMapa,' +
  ' claveDeMapa, nombreDeArchivo, FORMATO_MAPA, rejillaDeBloques, distribucionDePasillos, distribucionDeSala,' +
  ' leerDistribucion, cambiarDistribucion, geometriaBloqueFilas, bloquesFilas, cambiarAncho,' +
  ' cambiarFilasBloque, letraDeFila };')();

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
  const { generarPlano, butacas, mesas, girarPieza, cambiarLargo } = cargar();
  const idsDe = (id) => butacas.filter((b) => b.grupo?.id === id).map((b) => b.id).sort();
  generarPlano('mixta-ambos');
  const base = mesas.map(({ id, x, y, largo, cabeceras, unLado, giro }) => ({ id, x, y, largo, cabeceras, unLado, giro }));
  const antes = idsDe('M1');

  generarPlano('mixta-ambos', { mesas: base.map((c) => (c.id === 'M1' ? girarPieza(c) : c)) });
  assert.deepEqual(idsDe('M1'), antes);

  generarPlano('mixta-ambos', { mesas: base.map((c) => (c.id === 'M1' ? cambiarLargo(c, 1) : c)) });
  assert.deepEqual(idsDe('M1'), [...antes, 'M1-N3', 'M1-S3'].sort());
  // Los lugares que ya existian no se movieron: se crece por el extremo final.
  const n1 = butacas.find((b) => b.id === 'M1-N1');
  assert.deepEqual([n1.x, n1.y], [2, 7]);
});

// --- Operaciones del editor --------------------------------------------------

test('cuatro giros dejan la mesa exactamente donde estaba, y dos la dejan en su huella', () => {
  const { girarPieza, ESTILOS } = cargar();
  const casos = [
    { ...ESTILOS.lados }, { ...ESTILOS.cruz }, { ...ESTILOS.barra },
    { largo: 3, cabeceras: false, unLado: false }, { largo: 4, cabeceras: true, unLado: false },
    { largo: 1, cabeceras: false, unLado: true }, { largo: 2, cabeceras: true, unLado: true },
  ];
  for (const forma of casos) {
    const mesa = { id: 'M9', x: 6, y: 9, giro: 0, ...forma };
    let m = mesa;
    const giros = [];
    for (let i = 0; i < 4; i++) { m = girarPieza(m); giros.push(m.giro); }
    assert.deepEqual(giros, [90, 180, 270, 0], JSON.stringify(forma));
    assert.deepEqual(m, mesa, JSON.stringify(forma));
    const mediaVuelta = girarPieza(girarPieza(mesa));
    assert.deepEqual([mediaVuelta.x, mediaVuelta.y], [6, 9], JSON.stringify(forma));
  }
  // La cruz es cuadrada: girar no la desplaza.
  const cruz = girarPieza({ id: 'M9', x: 6, y: 9, giro: 0, ...ESTILOS.cruz });
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
  const { generarPlano, celdasOcupadas, colocarCerca, girarPieza } = cargar();
  const sala = generarPlano('mixta-ambos');
  const m1 = { id: 'M1', x: 2, y: 7, largo: 2, cabeceras: false, giro: 0 };
  // Girada sobre su centro queda en (1, 7), columnas 1 a 3: cabe sin moverse.
  assert.deepEqual(colocarCerca(sala, celdasOcupadas('M1'), girarPieza(m1)),
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
  assert.equal(api.primeraPiezaQueNoCabe(api.generarPlano('mixta-ambos', masLuneta)), null);
  assert.ok(api.butacas.some((b) => b.id === 'luneta-D1'));

  // La zona de mesas baja de 13 a 8 filas: la General sube a la 13 y pisa la segunda fila de mesas.
  let menos = plano, salaMenos = sala;
  for (let i = 0; i < 5; i++) {
    menos = api.redimensionarBanda(menos, salaMenos, 'mesas', -1);
    salaMenos = api.generarPlano('mixta-ambos', menos);
  }
  const fallo = api.primeraPiezaQueNoCabe(salaMenos);
  assert.deepEqual([fallo.pieza.id, fallo.motivo], ['M4', 'choca con la fila A de General']);

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
  assert.equal(api.primeraPiezaQueNoCabe(salaSubida), null);

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
  assert.equal(api.primeraPiezaQueNoCabe(salaSinLuneta), null);
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

// --- Bloqueos y mapas guardados ----------------------------------------------

const estados = (api) => Object.fromEntries(api.butacas.map((b) => [b.id, b.estado]));

test('las bloqueadas de la plantilla pasan a una lista que se puede editar butaca a butaca', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  assert.deepEqual(plano.bloqueadas, ['general-B11', 'general-B12']);
  assert.ok(plano.bandas.every((b) => b.bloqueadasAlFinal === undefined));

  let editado = api.alternarBloqueada(plano, 'luneta-A1');   // bloquea una de fila
  editado = api.alternarBloqueada(editado, 'M1-N1');         // y un lugar de mesa
  editado = api.alternarBloqueada(editado, 'general-B12');   // y desbloquea una de la plantilla
  assert.deepEqual(plano.bloqueadas, ['general-B11', 'general-B12'], 'el plano original no cambia');
  api.generarPlano('mixta-ambos', editado);
  const e = estados(api);
  assert.deepEqual([e['luneta-A1'], e['M1-N1'], e['general-B11'], e['general-B12']],
    ['bloqueada', 'bloqueada', 'bloqueada', 'libre']);
});

test('un mapa guarda el diseño y las bloqueadas, pero no la ocupacion', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  let editado = api.alternarBloqueada(plano, 'luneta-A1');
  editado = api.agregarBanda(editado, 'filas');
  const sala = api.generarPlano('mixta-ambos', editado);
  const ids = new Set(api.butacas.map((b) => b.id));
  const mapa = api.mapaDesdePlano('Salón Jardín', editado, '2026-09-16T18:30:00Z', ids);

  assert.equal(mapa.formato, api.FORMATO_MAPA);
  assert.equal(mapa.version, 2);
  assert.deepEqual(mapa.distribucion, { bloques: [4, 4, 4], pasillos: [1, 1] });
  assert.equal(mapa.pasillos, undefined);
  const texto = JSON.stringify(mapa);
  assert.ok(!texto.includes('ocupadas') && !texto.includes('filasDeMesas') && !texto.includes('bloqueadasAlFinal'), texto);
  assert.deepEqual(mapa.bloqueadas.sort(), ['general-B11', 'general-B12', 'luneta-A1']);
  assert.equal(mapa.mesas.length, 6);
  assert.equal(sala.bandas.length, 5);

  // Ida y vuelta por JSON: valida, se registra y genera la misma sala sin ocupadas.
  const { mapa: leido, errores } = api.validarMapa(JSON.parse(texto));
  assert.equal(errores, undefined);
  const clave = api.registrarMapa(leido);
  assert.equal(clave, api.claveDeMapa('Salón Jardín'));
  api.generarPlano('mixta-ambos', editado);
  const esperado = estados(api);
  api.generarPlano(clave);
  const obtenido = estados(api);
  assert.deepEqual(Object.keys(obtenido).sort(), Object.keys(esperado).sort());
  for (const [id, estado] of Object.entries(obtenido)) {
    assert.equal(estado, esperado[id] === 'ocupada' ? 'libre' : esperado[id], id);
  }
});

test('las bloqueadas de una banda o mesa eliminada no se guardan', () => {
  const api = cargar();
  const { plano, sala } = planoDe(api, 'mixta-ambos');
  const sinGeneral = api.eliminarBanda(plano, sala, 'general');
  api.generarPlano('mixta-ambos', sinGeneral);
  const mapa = api.mapaDesdePlano('Sin general', sinGeneral, null, new Set(api.butacas.map((b) => b.id)));
  assert.deepEqual(mapa.bloqueadas, []);
});

test('validarMapa rechaza archivos que no son mapas o traen datos no validos', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  const bueno = JSON.parse(JSON.stringify(api.mapaDesdePlano('Bueno', plano, null)));
  const con = (cambio) => { const m = JSON.parse(JSON.stringify(bueno)); cambio(m); return api.validarMapa(m).errores || []; };

  assert.deepEqual(api.validarMapa(null).errores, ['el archivo no contiene un mapa']);
  assert.deepEqual(api.validarMapa([1, 2]).errores, ['el archivo no contiene un mapa']);
  assert.deepEqual(con((m) => { m.formato = 'otra-cosa'; }), ['no es un mapa de este selector de asientos']);
  assert.deepEqual(con((m) => { m.version = 3; }), ['versión de mapa no compatible (3)']);
  assert.ok(con((m) => { m.nombre = '   '; }).includes('el nombre debe tener entre 1 y 80 caracteres'));
  assert.ok(con((m) => { m.distribucion.pasillos = [1]; }).includes('columnas: con 3 bloques hacen falta 2 anchos de pasillo'));
  assert.ok(con((m) => { delete m.distribucion; }).includes('columnas: faltan los bloques o los pasillos'));
  assert.ok(con((m) => { m.version = 1; m.pasillos = 'centro'; }).includes('pasillos desconocidos'));
  assert.ok(con((m) => { m.bandas.shift(); }).includes('la primera banda debe ser el escenario'));
  assert.ok(con((m) => { m.bandas[1].filas = 30; }).includes('banda 2: número de filas fuera de rango'));
  assert.ok(con((m) => { m.bandas[1].zona = 'vip'; }).includes('banda 2: zona desconocida'));
  assert.ok(con((m) => { m.bandas[2].id = 'luneta'; }).includes('banda 3: id no válido o repetido'));
  assert.ok(con((m) => { m.mesas[1].id = 'M1'; }).includes('mesa 2: id no válido o repetido'));
  assert.ok(con((m) => { m.mesas[0].giro = 45; }).includes('M1: giro no válido'));
  assert.ok(con((m) => { m.mesas[0].cabeceras = 'si'; }).includes('M1: cabeceras y unLado deben ser true o false'));
  assert.ok(con((m) => { m.bloqueadas = 'todas'; }).includes('la lista de butacas bloqueadas no es válida'));
  // Estructura valida pero una mesa encima de otra: se genera y se comprueba.
  assert.deepEqual(con((m) => { m.mesas[1].x = m.mesas[0].x; m.mesas[1].y = m.mesas[0].y; }), ['Mesa 1 choca con Mesa 2']);
  assert.deepEqual(con((m) => { m.mesas[0].y = 2; }), ['Mesa 1 choca con la fila A de Luneta']);
});

test('validarMapa descarta campos desconocidos y no deja reutilizar ids', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  const dato = JSON.parse(JSON.stringify(api.mapaDesdePlano('Limpio', api.agregarBanda(plano, 'mesas'), null)));
  dato.script = '<script>alert(1)</script>';
  dato.mesas[0].color = 'rojo';
  dato.bandas[1].ocupadas = { A: [1] };
  dato.siguiente = 2;          // por debajo de M6
  dato.siguienteBanda = 1;     // por debajo de banda1
  dato.bloqueadas = ['luneta-A1', 'luneta-A1'];
  const { mapa } = api.validarMapa(dato);
  assert.equal(mapa.script, undefined);
  assert.equal(mapa.mesas[0].color, undefined);
  assert.equal(mapa.bandas[1].ocupadas, undefined);
  assert.equal(mapa.siguiente, 7);
  assert.equal(mapa.siguienteBanda, 2);
  assert.deepEqual(mapa.bloqueadas, ['luneta-A1']);
  // Al editar un mapa registrado, los contadores parten de lo guardado.
  const clave = api.registrarMapa({ ...mapa, siguiente: 20 });
  const sala = api.generarPlano(clave);
  assert.equal(api.planoDesdeSala(clave, sala).siguiente, 20);
});

test('nombreDeArchivo quita tildes y simbolos', () => {
  const { nombreDeArchivo } = cargar();
  assert.equal(nombreDeArchivo('Salón Jardín, boda'), 'salon-jardin-boda.json');
  assert.equal(nombreDeArchivo('¡¡!!'), 'mapa.json');
});


test('las butacas de fila miran al escenario, que siempre esta arriba', () => {
  const { generarPlano, butacas, TIPOS_DE_SALA } = cargar();
  // mira 180: respaldo abajo, mirando hacia arriba.
  for (const tipo of Object.keys(TIPOS_DE_SALA)) {
    const sala = generarPlano(tipo);
    const escenario = sala.bandas[0];
    assert.equal(escenario.tipo, 'escenario', tipo);
    for (const b of butacas.filter((x) => !x.grupo)) {
      assert.equal(b.mira, 180, tipo + ': ' + b.id);
      assert.ok(b.y > escenario.y, tipo + ': ' + b.id + ' queda debajo del escenario');
    }
  }
});

// --- Columnas: bloques de butacas y anchos de pasillo ------------------------

test('rejillaDeBloques: bloques separados por pasillos del ancho que se pida', () => {
  const { rejillaDeBloques, distribucionDeSala } = cargar();
  const sala = rejillaDeBloques({ bloques: [4, 6, 4], pasillos: [1, 2] });
  assert.equal(sala.ancho, 17);
  assert.deepEqual(sala.bloques, [[1, 2, 3, 4], [6, 7, 8, 9, 10, 11], [14, 15, 16, 17]]);
  assert.equal(sala.columnas.length, 14);
  assert.deepEqual(distribucionDeSala(sala), { bloques: [4, 6, 4], pasillos: [1, 2] });
  assert.deepEqual(rejillaDeBloques({ bloques: [10], pasillos: [] }).ancho, 10);
});

test('las plantillas con pasillos por nombre dan la misma rejilla que antes', () => {
  const { rejillaDeSala, rejillaDeBloques, distribucionDePasillos } = cargar();
  for (const pasillos of DISPOSICIONES) {
    for (let ancho = 6; ancho <= 30; ancho++) {
      const d = distribucionDePasillos(pasillos, ancho);
      assert.ok(d.pasillos.every((a) => a === 1), pasillos);
      assert.deepEqual(rejillaDeBloques(d), rejillaDeSala({ ancho, pasillos }), pasillos + ' ' + ancho);
      assert.equal(rejillaDeBloques(d).ancho, ancho);
    }
  }
});

test('leerDistribucion entiende lo que se escribe y explica lo que no vale', () => {
  const { leerDistribucion } = cargar();
  assert.deepEqual(leerDistribucion('4, 6, 4', '1, 2'), { distribucion: { bloques: [4, 6, 4], pasillos: [1, 2] } });
  assert.deepEqual(leerDistribucion(' 4 6;4 ', ''), { distribucion: { bloques: [4, 6, 4], pasillos: [1, 1] } });
  assert.deepEqual(leerDistribucion('12', ''), { distribucion: { bloques: [12], pasillos: [] } });
  const motivo = (b, p) => leerDistribucion(b, p).motivo;
  assert.equal(motivo('', ''), 'escribe cuántas butacas lleva cada bloque, separadas por comas');
  assert.equal(motivo('4, 6, 4', '1'), 'con 3 bloques hacen falta 2 anchos de pasillo');
  assert.equal(motivo('12', '1'), 'con un solo bloque no hay pasillos');
  assert.equal(motivo('4, x, 4', ''), 'cada bloque debe tener de 1 a 40 butacas');
  assert.equal(motivo('4, 4.5', ''), 'cada bloque debe tener de 1 a 40 butacas');
  assert.equal(motivo('4, 0', ''), 'cada bloque debe tener de 1 a 40 butacas');
  assert.equal(motivo('4, 4', '0'), 'cada pasillo debe medir de 1 a 10 columnas');
  assert.equal(motivo('30, 30', '5'), 'la sala mediría 65 columnas y el máximo es 60');
  assert.equal(motivo('1,1,1,1,1,1,1,1,1,1,1', ''), 'debe haber de 1 a 10 bloques');
});

test('una sala con columnas propias: pasillos vacios, escenario al ancho y aforo', () => {
  const api = cargar();
  const { plano, sala } = planoDe(api, 'mixta-ambos');
  assert.deepEqual(plano.distribucion, { bloques: [4, 4, 4], pasillos: [1, 1] });
  const nuevo = api.cambiarDistribucion(plano, sala, { bloques: [4, 6, 4], pasillos: [1, 2] });
  const otra = api.generarPlano('mixta-ambos', nuevo);
  assert.equal(otra.ancho, 17);
  const usadas = new Set(api.butacas.map((b) => b.x));
  assert.deepEqual([5, 12, 13].filter((c) => usadas.has(c)), [], 'las columnas de pasillo quedan vacias');
  assert.equal(api.butacas.filter((b) => b.banda === 'luneta').length, 3 * 14);
  assert.equal(api.muebles.find((m) => m.tipo === 'escenario').w, 17);
  assert.equal(api.primeraPiezaQueNoCabe(otra), null);
});

test('al cambiar las columnas cada mesa se queda en su bloque', () => {
  const api = cargar();
  const { plano, sala } = planoDe(api, 'mixta-ambos');
  // Antes: bloques 1-4, 6-9, 11-14; mesas en 2, 7 y 12 (segunda columna de cada bloque).
  const ancho = api.cambiarDistribucion(plano, sala, { bloques: [6, 6, 6], pasillos: [2, 2] });
  // Despues: bloques 1-6, 9-14, 17-22. Misma distancia al inicio: 2, 10 y 18.
  assert.deepEqual(ancho.mesas.filter((m) => m.y === 7).map((m) => m.x), [2, 10, 18]);
  assert.equal(api.primeraPiezaQueNoCabe(api.generarPlano('mixta-ambos', ancho)), null);

  // Con bloques mas estrechos, la mesa se corre dentro del bloque para no salirse.
  const estrecho = api.cambiarDistribucion(plano, sala, { bloques: [2, 2, 2], pasillos: [1, 1] });
  assert.deepEqual(estrecho.mesas.filter((m) => m.y === 7).map((m) => m.x), [1, 4, 7]);
  assert.equal(api.primeraPiezaQueNoCabe(api.generarPlano('mixta-ambos', estrecho)), null);

  // Si cambia el numero de bloques, cada mesa conserva su posicion relativa en la
  // sala y se ajusta al bloque mas cercano: al quitar pasillos no se amontonan.
  const unBloque = api.cambiarDistribucion(plano, sala, { bloques: [12], pasillos: [] });
  assert.deepEqual(unBloque.mesas.filter((m) => m.y === 7).map((m) => m.x), [2, 6, 10]);
  assert.equal(api.primeraPiezaQueNoCabe(api.generarPlano('mixta-ambos', unBloque)), null);
  const dosBloques = api.cambiarDistribucion(plano, sala, { bloques: [6, 6], pasillos: [2] });
  // La del centro caeria en el pasillo (columnas 7-8): pasa al bloque mas cercano, el primero.
  assert.deepEqual(dosBloques.mesas.filter((m) => m.y === 7).map((m) => m.x), [2, 5, 12]);
  // Y al volver a poner bloques, se reparten en vez de quedarse en el primero.
  const deUno = api.generarPlano('mixta-ambos', unBloque);
  const tres = api.cambiarDistribucion(unBloque, deUno, { bloques: [8, 8, 8], pasillos: [2, 2] });
  assert.deepEqual(tres.mesas.filter((m) => m.y === 7).map((m) => m.x), [3, 13, 22]);
  assert.equal(api.primeraPiezaQueNoCabe(api.generarPlano('mixta-ambos', tres)), null);
  assert.equal(api.primeraPiezaQueNoCabe(api.generarPlano('mixta-ambos', dosBloques)), null);

  // Un bloque de 1 butaca no cabe una mesa de 2 columnas.
  const angosto = api.cambiarDistribucion(plano, sala, { bloques: [1, 4, 4], pasillos: [1, 1] });
  const falloAngosto = api.primeraPiezaQueNoCabe(api.generarPlano('mixta-ambos', angosto));
  assert.deepEqual([falloAngosto.pieza.id, falloAngosto.motivo], ['M1', 'cae sobre un pasillo']);
});

test('un mapa guarda las columnas y un mapa de la version 1 se sigue leyendo', () => {
  const api = cargar();
  const { plano, sala } = planoDe(api, 'mixta-ambos');
  const conColumnas = api.cambiarDistribucion(plano, sala, { bloques: [4, 6, 4], pasillos: [1, 2] });
  api.generarPlano('mixta-ambos', conColumnas);
  const mapa = JSON.parse(JSON.stringify(api.mapaDesdePlano('Columnas', conColumnas, null)));
  const { mapa: leido } = api.validarMapa(mapa);
  assert.deepEqual(leido.distribucion, { bloques: [4, 6, 4], pasillos: [1, 2] });
  const clave = api.registrarMapa(leido);
  assert.equal(api.generarPlano(clave).ancho, 17);

  // Version 1: 'pasillos' con nombre y sin distribucion.
  const { plano: base } = planoDe(api, 'mixta-izquierda');
  const viejo = JSON.parse(JSON.stringify(api.mapaDesdePlano('Viejo', base, null)));
  viejo.version = 1;
  viejo.pasillos = 'izquierda';
  delete viejo.distribucion;
  const { mapa: convertido, errores } = api.validarMapa(viejo);
  assert.equal(errores, undefined);
  assert.equal(convertido.version, 2);
  assert.deepEqual(convertido.distribucion, { bloques: [4, 9], pasillos: [1] });
  assert.equal(convertido.pasillos, undefined);
});

// --- Bloques de filas libres (fase 1) -----------------------------------------

const bloque = (id, x, y, extra = {}) => ({ id, tipo: 'filas', x, y, ancho: 5, filas: 2, zona: 'luneta', giro: 0, ...extra });
const conBloques = (api, tipo, ...bloques) => {
  const { plano } = planoDe(api, tipo);
  plano.bloquesFilas = bloques;
  plano.siguienteBloque = bloques.length + 1;
  return { plano, sala: api.generarPlano(tipo, plano) };
};
const etiqueta = (api, id) => {
  const b = api.butacas.find((x) => x.id === id);
  return b.seccion + ' ' + b.fila + b.numero;
};

test('geometria de un bloque: filas de delante arriba, mirando al escenario, y girado', () => {
  const { geometriaBloqueFilas } = cargar();
  const g = geometriaBloqueFilas({ ancho: 3, filas: 2, giro: 0 });
  assert.deepEqual([g.ancho, g.alto, g.tablero], [3, 2, null]);
  assert.deepEqual(g.lugares.map((l) => [l.fila, l.columna, l.dx, l.dy, l.mira]),
    [[0, 0, 0, 0, 180], [0, 1, 1, 0, 180], [0, 2, 2, 0, 180], [1, 0, 0, 1, 180], [1, 1, 1, 1, 180], [1, 2, 2, 1, 180]]);
  // Girado 90: 2 de ancho y 3 de alto; la fila de delante queda a la derecha y mira a la derecha.
  const lateral = geometriaBloqueFilas({ ancho: 3, filas: 2, giro: 90 });
  assert.deepEqual([lateral.ancho, lateral.alto], [2, 3]);
  const delante = lateral.lugares.filter((l) => l.fila === 0);
  assert.ok(delante.every((l) => l.dx === 1 && l.mira === 270));
});

test('las filas se numeran por zona, de izquierda a derecha, a traves de bloques y bandas', () => {
  const api = cargar();
  // «ambos»: Luneta en las filas 2-4 (A-C). Dos bloques de Luneta en la franja libre (fila 14):
  // uno de 5 butacas y, dejando dos columnas libres, otro de 2.
  conBloques(api, 'mixta-ambos', bloque('F1', 1, 14), bloque('F2', 8, 14, { ancho: 2 }));
  assert.equal(etiqueta(api, 'luneta-A1'), 'Luneta A1');
  assert.equal(etiqueta(api, 'luneta-C12'), 'Luneta C12');
  assert.deepEqual(['F1-1-1', 'F1-1-5', 'F2-1-1', 'F2-1-2'].map((id) => etiqueta(api, id)),
    ['Luneta D1', 'Luneta D5', 'Luneta D6', 'Luneta D7']);
  assert.deepEqual(['F1-2-1', 'F2-2-2'].map((id) => etiqueta(api, id)), ['Luneta E1', 'Luneta E7']);
  // General sigue con su propia secuencia.
  assert.equal(etiqueta(api, 'general-A1'), 'General A1');
});

test('un bloque de General a la altura de la banda General comparte fila y sigue la numeracion', () => {
  const api = cargar();
  // Quitando las ultimas columnas de General no hay hueco en su fila; se usa «solo mesas» con una banda
  // de General agregada y un bloque de General al lado de la misma fila.
  const { plano } = planoDe(api, 'solo-mesas');
  let conGeneral = api.agregarBanda(plano, 'filas');
  conGeneral.bandas.at(-1).zona = 'general';
  // La banda se agrega abajo (fila 22-23). Un bloque de General en la fila 20, encima.
  conGeneral.bloquesFilas = [bloque('F1', 5, 20, { zona: 'general', ancho: 3, filas: 1 })];
  api.generarPlano('solo-mesas', conGeneral);
  assert.deepEqual(['F1-1-1', 'F1-1-3', 'banda1-A1', 'banda1-B14'].map((id) => etiqueta(api, id)),
    ['General A1', 'General A3', 'General B1', 'General C14']);
});

test('dos bandas de la misma zona continuan la secuencia en lugar de reiniciar en A', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  const conOtra = api.agregarBanda(plano, 'filas');   // otra de General, al final
  api.generarPlano('mixta-ambos', conOtra);
  assert.deepEqual(['general-A1', 'general-B1', 'banda1-A1', 'banda1-B1'].map((id) => etiqueta(api, id)),
    ['General A1', 'General B1', 'General C1', 'General D1']);
  // El rotulo de la banda muestra la letra de su zona.
  const rotulos = api.muebles.filter((m) => m.tipo === 'rotulo' && m.banda === 'banda1').map((m) => m.texto);
  assert.deepEqual(rotulos, ['C', 'D']);
});

test('un bloque girado lleva su nombre y su propia secuencia', () => {
  const api = cargar();
  conBloques(api, 'mixta-ambos', bloque('F1', 1, 14, { giro: 90, ancho: 3, filas: 2, nombre: 'Lateral izquierdo' }));
  assert.deepEqual(['F1-1-1', 'F1-1-3', 'F1-2-2'].map((id) => etiqueta(api, id)),
    ['Lateral izquierdo A1', 'Lateral izquierdo A3', 'Lateral izquierdo B2']);
  // Sin nombre propio, se llama «Bloque N».
  conBloques(api, 'mixta-ambos', bloque('F4', 1, 14, { giro: 270 }));
  assert.equal(etiqueta(api, 'F4-1-1'), 'Bloque 4 A1');
});

test('mover o girar un bloque no cambia los ids, aunque cambie la etiqueta', () => {
  const api = cargar();
  const ids = () => api.butacas.filter((b) => b.bloque === 'F1').map((b) => b.id).sort();
  conBloques(api, 'mixta-ambos', bloque('F1', 1, 14));
  const antes = ids();
  assert.equal(etiqueta(api, 'F1-1-1'), 'Luneta D1');
  conBloques(api, 'mixta-ambos', bloque('F1', 6, 16));
  assert.deepEqual(ids(), antes);
  assert.equal(etiqueta(api, 'F1-1-1'), 'Luneta D1');
  conBloques(api, 'mixta-ambos', api.girarPieza(bloque('F1', 6, 14)));
  assert.deepEqual(ids(), antes);
  assert.equal(etiqueta(api, 'F1-1-1'), 'Bloque 1 A1');
});

test('un bloque puede ocupar columnas de pasillo pero no pisar filas, mesas ni otros bloques', () => {
  const api = cargar();
  const { sala } = conBloques(api, 'mixta-ambos', bloque('F1', 1, 14));
  const libre = api.celdasOcupadas('F9');
  // «ambos» tiene pasillos en 5 y 10: un bloque de 5 desde la columna 4 los cruza sin problema.
  assert.equal(api.motivoNoCabe(sala, api.celdasOcupadas('F2'), bloque('F2', 6, 16)), null);
  assert.equal(api.motivoNoCabe(sala, api.celdasOcupadas('F2'), bloque('F2', 4, 14)), 'choca con la fila D de Luneta');
  assert.equal(api.motivoNoCabe(sala, libre, bloque('F2', 2, 12)), 'choca con Mesa 4');
  assert.equal(api.motivoNoCabe(sala, libre, bloque('F2', 1, 3)), 'choca con la fila B de Luneta');
  assert.equal(api.motivoNoCabe(sala, libre, bloque('F2', 12, 14)), 'se sale de la sala');
  // Y una mesa no puede ir encima de un bloque.
  const mesa = { id: 'M9', x: 2, y: 13, largo: 2, cabeceras: false, unLado: false, giro: 0 };
  assert.equal(api.motivoNoCabe(sala, api.celdasOcupadas('M9'), mesa), 'choca con Mesa 4');
  assert.equal(api.motivoNoCabe(sala, api.celdasOcupadas('M9'), { ...mesa, y: 15 }), 'choca con la fila E de Luneta');
});

test('crecer o encoger un bloque no mueve su primera butaca', () => {
  const api = cargar();
  const primera = (b) => {
    const l = api.geometriaBloqueFilas(b).lugares.find((x) => x.fila === 0 && x.columna === 0);
    return [b.x + l.dx, b.y + l.dy];
  };
  for (const giro of [0, 90, 180, 270]) {
    const b = bloque('F1', 10, 10, { giro });
    for (const cambio of [(x) => api.cambiarAncho(x, 1), (x) => api.cambiarAncho(x, -1),
                          (x) => api.cambiarFilasBloque(x, 1), (x) => api.cambiarFilasBloque(x, -1)]) {
      assert.deepEqual(primera(cambio(b)), primera(b), 'giro ' + giro);
    }
  }
  assert.equal(api.cambiarAncho(bloque('F1', 1, 1, { ancho: 1 }), -1), null);
  assert.equal(api.cambiarFilasBloque(bloque('F1', 1, 1, { filas: 26 }), 1), null);
  assert.equal(api.cambiarAncho(bloque('F1', 1, 1, { ancho: 40 }), 1), null);
});

test('cuatro giros dejan un bloque donde estaba', () => {
  const { girarPieza } = cargar();
  for (const [ancho, filas] of [[5, 2], [2, 2], [4, 3], [1, 6]]) {
    const b = bloque('F1', 8, 9, { ancho, filas });
    let g = b;
    for (let i = 0; i < 4; i++) g = girarPieza(g);
    assert.deepEqual(g, b, ancho + 'x' + filas);
  }
});

test('las bandas desplazan y eliminan los bloques como a las mesas', () => {
  const api = cargar();
  const { plano, sala } = conBloques(api, 'mixta-ambos', bloque('F1', 1, 14), bloque('F2', 8, 5, { ancho: 2, filas: 1 }));
  const masLuneta = api.redimensionarBanda(plano, sala, 'luneta', 1);
  assert.deepEqual(masLuneta.bloquesFilas.map((b) => b.y), [15, 6]);
  const sinMesas = api.eliminarBanda(plano, sala, 'mesas');
  assert.deepEqual(sinMesas.bloquesFilas, []);
  assert.deepEqual(api.primeraPiezaQueNoCabe(api.generarPlano('mixta-ambos', masLuneta)), null);
  // Estrechar la sala a 8 columnas deja fuera el bloque de las columnas 8-9: se detecta.
  const estrecha = api.cambiarDistribucion(plano, sala, { bloques: [2, 2, 2], pasillos: [1, 1] });
  const fallo = api.primeraPiezaQueNoCabe(api.generarPlano('mixta-ambos', estrecha));
  assert.deepEqual([fallo.pieza.id, fallo.motivo], ['F2', 'se sale de la sala']);
});

test('los bloques se guardan en el mapa, con nombre propio, y se validan al leer', () => {
  const api = cargar();
  const { plano } = conBloques(api, 'mixta-ambos', bloque('F1', 1, 14), bloque('F3', 9, 14, { giro: 90, ancho: 3, nombre: 'Lateral' }));
  const extraido = api.planoDesdeSala('mixta-ambos', api.generarPlano('mixta-ambos', plano));
  assert.deepEqual(extraido.bloquesFilas.map((b) => [b.id, b.nombre]), [['F1', undefined], ['F3', 'Lateral']]);
  assert.equal(extraido.siguienteBloque, 4);

  const mapa = JSON.parse(JSON.stringify(api.mapaDesdePlano('Con bloques', extraido, null)));
  const { mapa: leido, errores } = api.validarMapa(mapa);
  assert.equal(errores, undefined);
  assert.equal(leido.bloquesFilas.length, 2);
  assert.equal(leido.siguienteBloque, 4);
  const clave = api.registrarMapa(leido);
  api.generarPlano(clave);
  assert.equal(etiqueta(api, 'F3-1-1'), 'Lateral A1');

  const con = (cambio) => { const m = JSON.parse(JSON.stringify(mapa)); cambio(m); return api.validarMapa(m).errores || []; };
  assert.ok(con((m) => { m.bloquesFilas[0].id = 'X1'; }).includes('bloque 1: id no válido o repetido'));
  assert.ok(con((m) => { m.bloquesFilas[0].ancho = 0; }).includes('F1: butacas por fila fuera de rango'));
  assert.ok(con((m) => { m.bloquesFilas[0].zona = 'vip'; }).includes('F1: zona desconocida'));
  assert.ok(con((m) => { m.bloquesFilas[0].giro = 45; }).includes('F1: giro no válido'));
  assert.deepEqual(con((m) => { m.bloquesFilas[0].y = 2; }), ['Bloque 1 choca con la fila A de Luneta']);
  // Un mapa sin bloques (los anteriores) sigue siendo valido.
  assert.equal(con((m) => { delete m.bloquesFilas; delete m.siguienteBloque; }).length, 0);
});

test('letraDeFila sigue con AA, AB... despues de la Z', () => {
  const { letraDeFila } = cargar();
  assert.deepEqual([0, 25, 26, 27, 51, 52].map(letraDeFila), ['A', 'Z', 'AA', 'AB', 'AZ', 'BA']);
});

