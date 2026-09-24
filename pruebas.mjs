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
  ' cambiarFilasBloque, letraDeFila, escenario, girarEscenario, cambiarTamanoEscenario,' +
  ' giroHaciaEscenario, disponerBandas, hojasDe, ubicar, agregarVertical, cambiarAnchoVertical,' +
  ' agregarBandaEnVertical, duplicarPieza, duplicarBanda, renombrarBanda, capasDe, bandaEnCelda,' +
  ' alternarGuias, quitarEscenario, agregarEscenario, cambiarAnchoLienzo,' +
  ' formas, butacasSueltas, cambiarTamanoForma,' +
  ' FILAS_MAXIMAS, BUTACAS_MAXIMAS, motivoDeAforo,' +
  ' zonas, editarZona, agregarZona, eliminarZona, leerPrecio, usosDeZona,' +
  ' zonaEnCelda, fijarZonasSueltas, zonaExclusivaDeBanda, zonaNuevaParaBanda, mesasDeBanda,' +
  ' marcarMesasDeBanda, areaDeCeldas, butacasEnArea, asignarZonaEnArea, bloquearEnArea,' +
  ' tiradoresDeSala, redimensionarConTirador,' +
  ' piezasEnMarco, cajaDePiezas, moverPiezas, duplicarPiezas, eliminarPiezas,' +
  ' geometriaMesaRedonda, cambiarLugaresRedonda, huellaDe,' +
  ' marcarMesaCompleta, marcarTodasLasMesas, alternarEleccion, completarMesasElegidas,' +
  ' asignarZonaAsiento };')();

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
  const esperadas = { 'solo-filas': 0, 'solo-mesas': 12, 'mapa-en-blanco': 0 };
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
  assert.deepEqual([sala.alto, sala.filas.min, sala.filas.max], [20, 0, 19]);
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
  assert.deepEqual([salon.filas.min, salon.filas.max], [0, 21]);
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

  assert.deepEqual(api.redimensionarBanda(plano, sala, 'escenario', 1), { motivo: 'la franja del escenario tiene un alto fijo; cambia el tamaño del escenario en el plano' });
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
  assert.equal(mapa.version, 4);
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
  assert.deepEqual(con((m) => { m.version = 5; }), ['versión de mapa no compatible (5)']);
  assert.ok(con((m) => { m.nombre = '   '; }).includes('el nombre debe tener entre 1 y 80 caracteres'));
  assert.ok(con((m) => { m.distribucion.pasillos = [1]; }).includes('columnas: con 3 bloques hacen falta 2 anchos de pasillo'));
  assert.ok(con((m) => { delete m.distribucion; }).includes('columnas: faltan los bloques o los pasillos'));
  assert.ok(con((m) => { m.version = 1; m.pasillos = 'centro'; }).includes('pasillos desconocidos'));
  // Hasta la version 2 el escenario era la primera banda; en la 3 basta con tener alguna.
  assert.ok(con((m) => { m.version = 2; m.bandas.shift(); }).includes('la primera banda debe ser el escenario'));
  assert.ok(con((m) => { m.bandas = []; }).includes('el mapa necesita al menos una banda'));
  assert.ok(con((m) => { m.bandas[1].id = 'x'; m.bandas.push({ id: 'y', tipo: 'escenario' }); }).includes('banda 5: el escenario solo puede ir primero'));
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
  for (const tipo of Object.keys(TIPOS_DE_SALA).filter((t) => t !== 'mapa-en-blanco')) {
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
  assert.equal(convertido.version, 4);
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
  // Despues de la ZZ (fila 702) sigue la AAA: antes daba «undefinedA».
  assert.deepEqual([701, 702, 703, 2599].map(letraDeFila), ['ZZ', 'AAA', 'AAB', 'CUZ']);
});

// --- Escenario movible (fase 2) ----------------------------------------------

// Una sala mixta con una zona de mesas extra al final (filas 20 a 23), para tener
// sitio donde bajar el escenario.
const conZonaAbajo = (api) => {
  const { plano } = planoDe(api, 'mixta-ambos');
  const nuevo = api.agregarBanda(plano, 'mesas');
  return { plano: nuevo, sala: api.generarPlano('mixta-ambos', nuevo) };
};

test('por defecto el escenario ocupa su franja a todo el ancho', () => {
  const api = cargar();
  const sala = api.generarPlano('mixta-ambos');
  const { x, y, ancho, alto } = api.escenario;
  assert.deepEqual([x, y, ancho, alto], [1, 0, 14, 2]);
  const mueble = api.muebles.find((m) => m.tipo === 'escenario');
  assert.deepEqual([mueble.x, mueble.y, mueble.w, mueble.h], [1, 0, 14, 1.2]);
  assert.equal(sala.escenarioPorDefecto, true);
  // Nada se le pone encima.
  const mesa = { id: 'M9', x: 3, y: 1, largo: 2, cabeceras: false, unLado: false, giro: 0 };
  assert.equal(api.motivoNoCabe(sala, api.celdasOcupadas('M9'), mesa), 'choca con el escenario');
  const plano = api.planoDesdeSala('mixta-ambos', sala);
  assert.deepEqual(plano.escenario, { x: 1, y: 0, ancho: 14, alto: 2 });
});

test('el escenario se puede mover y redimensionar, pero no pisar filas ni piezas', () => {
  const api = cargar();
  const { plano, sala } = conZonaAbajo(api);
  const ocupadas = api.celdasOcupadas('escenario');
  const escenario = (x, y, ancho = 14, alto = 2) => ({ id: 'escenario', tipo: 'escenario', x, y, ancho, alto });
  assert.equal(api.motivoNoCabe(sala, ocupadas, escenario(1, 21)), null);
  assert.equal(api.motivoNoCabe(sala, ocupadas, escenario(1, 18)), 'choca con la fila A de General');
  assert.equal(api.motivoNoCabe(sala, ocupadas, escenario(1, 22, 14, 3)), 'se sale de la sala');
  assert.equal(api.motivoNoCabe(sala, ocupadas, escenario(2, 6, 3, 1)), null);           // cruza el pasillo de la 5, vale
  assert.equal(api.motivoNoCabe(sala, ocupadas, escenario(2, 7, 3, 1)), 'choca con Mesa 1');
  assert.deepEqual(api.cambiarTamanoEscenario(escenario(1, 0), -4, 1), escenario(1, 0, 10, 3));
  assert.equal(api.cambiarTamanoEscenario(escenario(1, 0, 1, 2), -1, 0), null);
  assert.equal(api.cambiarTamanoEscenario(escenario(1, 0, 14, 10), 0, 1), null);
  assert.ok(plano.bandas.length === 5);
});

test('girar el escenario intercambia ancho y alto, y dos giros lo dejan donde estaba', () => {
  const { girarEscenario } = cargar();
  const e = { id: 'escenario', tipo: 'escenario', x: 3, y: 4, ancho: 6, alto: 2 };
  const girado = girarEscenario(e);
  assert.deepEqual([girado.ancho, girado.alto], [2, 6]);
  assert.deepEqual(girarEscenario(girado), e);
});

test('con el escenario abajo, las filas lo miran y la A es la mas cercana', () => {
  const api = cargar();
  const { plano } = conZonaAbajo(api);
  const abajo = { ...plano, escenario: { x: 1, y: 22, ancho: 14, alto: 2 } };
  const sala = api.generarPlano('mixta-ambos', abajo);
  assert.equal(api.primeraPiezaQueNoCabe(sala), null);
  const luneta = api.butacas.find((b) => b.id === 'luneta-A1');
  const general = api.butacas.find((b) => b.id === 'general-B1');
  assert.deepEqual([luneta.mira, general.mira], [0, 0], 'miran hacia abajo');
  // General (filas 18 y 19) queda ahora mas cerca: su fila de abajo es la A.
  assert.deepEqual(['general-B1', 'general-A1'].map((id) => etiqueta(api, id)), ['General A1', 'General B1']);
  // Luneta: la fila 4 (local C) es la A.
  assert.deepEqual(['luneta-C1', 'luneta-A1'].map((id) => etiqueta(api, id)), ['Luneta A1', 'Luneta C1']);
  // Los rotulos siguen la letra nueva.
  const rotulo = api.muebles.find((m) => m.tipo === 'rotulo' && m.banda === 'luneta' && m.filaLocal === 2);
  assert.equal(rotulo.texto, 'A');
  // Y la franja de arriba queda libre para piezas.
  const mesa = { id: 'M9', x: 3, y: 0, largo: 2, cabeceras: false, unLado: false, giro: 0 };
  assert.equal(api.motivoNoCabe(sala, api.celdasOcupadas('M9'), mesa), 'choca con la fila C de Luneta');   // la fila 2, ahora la mas lejana
  assert.equal(api.motivoNoCabe(sala, api.celdasOcupadas('M9'), { ...mesa, y: -1 }), 'se sale de la sala');
});

test('un bloque de espaldas al escenario lleva secuencia propia; de frente, entra en la zona', () => {
  const api = cargar();
  const { plano } = conZonaAbajo(api);
  const abajo = { ...plano, escenario: { x: 1, y: 22, ancho: 14, alto: 2 } };
  abajo.bloquesFilas = [bloque('F1', 1, 14), bloque('F2', 8, 14, { ancho: 2, giro: 180 })];
  api.generarPlano('mixta-ambos', abajo);
  // F1 sin girar mira hacia arriba, de espaldas al escenario de abajo.
  assert.equal(etiqueta(api, 'F1-1-1'), 'Bloque 1 A1');
  // F2 girado 180 mira hacia abajo, al escenario: numeracion por zona (Luneta).
  assert.equal(api.butacas.find((b) => b.id === 'F2-1-1').seccion, 'Luneta');
});

test('los bloques nuevos se orientan hacia el escenario', () => {
  const api = cargar();
  api.generarPlano('mixta-ambos', { ...planoDe(api, 'mixta-ambos').plano, escenario: { x: 6, y: 9, ancho: 2, alto: 2 } });
  // Centro del escenario en (7, 10).
  assert.equal(api.giroHaciaEscenario(7, 16), 0);    // debajo: mira arriba
  assert.equal(api.giroHaciaEscenario(7, 3), 180);   // encima: mira abajo
  assert.equal(api.giroHaciaEscenario(1, 10), 90);   // a la izquierda: mira a la derecha
  assert.equal(api.giroHaciaEscenario(13, 10), 270); // a la derecha: mira a la izquierda
});

test('un escenario a todo el ancho sigue a todo el ancho al cambiar las columnas', () => {
  const api = cargar();
  const { plano, sala } = planoDe(api, 'mixta-ambos');
  const ancho = api.cambiarDistribucion(plano, sala, { bloques: [5, 6, 5], pasillos: [2, 2] });
  assert.deepEqual(ancho.escenario, { x: 1, y: 0, ancho: 20, alto: 2 });
  // Uno que no esta a todo el ancho no cambia.
  const corto = api.cambiarDistribucion({ ...plano, escenario: { x: 3, y: 0, ancho: 6, alto: 2 } }, sala,
    { bloques: [5, 6, 5], pasillos: [2, 2] });
  assert.deepEqual(corto.escenario, { x: 3, y: 0, ancho: 6, alto: 2 });
});

test('el mapa guarda el escenario, y sin el se usa el de la franja', () => {
  const api = cargar();
  const { plano } = conZonaAbajo(api);
  const abajo = { ...plano, escenario: { x: 1, y: 22, ancho: 14, alto: 2 } };
  api.generarPlano('mixta-ambos', abajo);
  const mapa = JSON.parse(JSON.stringify(api.mapaDesdePlano('Escenario abajo', abajo, null)));
  assert.deepEqual(mapa.escenario, { x: 1, y: 22, ancho: 14, alto: 2 });
  const { mapa: leido } = api.validarMapa(mapa);
  const clave = api.registrarMapa(leido);
  api.generarPlano(clave);
  assert.deepEqual([api.escenario.y, api.escenario.ancho], [22, 14]);

  const con = (cambio) => { const m = JSON.parse(JSON.stringify(mapa)); cambio(m); return api.validarMapa(m).errores || []; };
  assert.ok(con((m) => { m.escenario.ancho = 0; }).includes('el escenario no es válido'));
  assert.deepEqual(con((m) => { m.escenario.y = 18; }), ['Escenario choca con la fila A de General']);
  assert.deepEqual(con((m) => { delete m.escenario; }), []);
});

// --- Bandas verticales (fase 3) ----------------------------------------------

// «ambos» + una franja dividida al final (filas 20 a 23):
//   banda1 franja · banda2 vertical izquierda (7 columnas) con banda3 zona de mesas (4 de alto)
//                 · banda4 vertical derecha (el resto) con banda5 filas de General (2)
const conFranja = (api, preparar = (plano) => plano) => {
  const { plano } = planoDe(api, 'mixta-ambos');
  const franja = { id: 'banda1', tipo: 'division', verticales: [
    { id: 'banda2', ancho: 7, bandas: [{ id: 'banda3', tipo: 'mesas', alto: 4 }] },
    { id: 'banda4', bandas: [{ id: 'banda5', tipo: 'filas', zona: 'general', filas: 2 }] }] };
  const nuevo = preparar({ ...plano, bandas: [...plano.bandas, franja], siguienteBanda: 6 });
  return { plano: nuevo, sala: api.generarPlano('mixta-ambos', nuevo) };
};
const mesa = (id, x, y) => ({ id, x, y, largo: 2, cabeceras: false, unLado: false, giro: 0 });

test('una franja dividida reparte su ancho en verticales y toma el alto de la mas alta', () => {
  const api = cargar();
  const { sala } = conFranja(api);
  const franja = sala.bandas.at(-1);
  assert.equal(franja.tipo, 'division');
  assert.deepEqual([franja.y, franja.alto], [20, 4]);
  assert.deepEqual(franja.verticales.map((v) => [v.id, v.x, v.anchoOcupado, v.altoPila, v.alto]),
    [['banda2', 1, 7, 4, 4], ['banda4', 8, 7, 2, 4]]);
  assert.equal(sala.alto, 24);
  const resto = sala.regiones.find((r) => r.id === 'banda4:resto');
  assert.deepEqual([resto.x, resto.y, resto.ancho, resto.alto], [8, 22, 7, 2]);
  assert.deepEqual(api.hojasDe(sala.bandas).map((b) => b.id),
    ['escenario', 'luneta', 'mesas', 'general', 'banda3', 'banda5']);
  assert.equal(api.ubicar(sala.bandas, 'banda5').padre.id, 'banda4');
  assert.equal(sala.errorDeBandas, null);
});

test('las filas de una vertical usan las columnas de la sala en su tramo y siguen la numeracion', () => {
  const api = cargar();
  conFranja(api);
  const filas = api.butacas.filter((b) => b.banda === 'banda5');
  // Columnas 8 a 14 de «ambos»: 8, 9 y 11 a 14 (la 10 es pasillo).
  assert.deepEqual([...new Set(filas.map((b) => b.x))], [8, 9, 11, 12, 13, 14]);
  assert.equal(filas.length, 12);
  // General: la banda de siempre (filas 18-19) es A y B; la de la vertical (20-21), C y D.
  assert.deepEqual(['banda5-A1', 'banda5-B6'].map((id) => etiqueta(api, id)), ['General C1', 'General D6']);
  // Acaba en el borde derecho de la sala: su rotulo va a la derecha.
  const rotulos = api.muebles.filter((m) => m.tipo === 'rotulo' && m.banda === 'banda5');
  assert.deepEqual(rotulos.map((m) => [m.texto, m.x]), [['C', 15], ['D', 15]]);
});

test('las piezas se anclan a su region: cambiar el ancho de una vertical mueve lo de la derecha', () => {
  const api = cargar();
  const { plano, sala } = conFranja(api, (p) => ({ ...p, mesas: [...p.mesas, mesa('M9', 6, 20)],
    bloquesFilas: [bloque('F1', 8, 22, { ancho: 3, filas: 2, zona: 'general' })] }));
  assert.equal(api.primeraPiezaQueNoCabe(sala), null);

  const angosta = api.cambiarAnchoVertical(plano, sala, 'banda2', -2);
  const salaAngosta = api.generarPlano('mixta-ambos', angosta);
  assert.deepEqual(salaAngosta.bandas.at(-1).verticales.map((v) => [v.x, v.anchoOcupado]), [[1, 5], [6, 9]]);
  assert.deepEqual(angosta.bloquesFilas.map((b) => [b.x, b.y]), [[6, 22]]);    // viaja con la vertical derecha
  assert.deepEqual(angosta.mesas.filter((m) => m.id === 'M9').map((m) => [m.x, m.y]), [[6, 20]]);   // se queda
  assert.deepEqual(api.cambiarAnchoVertical(plano, sala, 'banda4', 1), { motivo: 'la última banda vertical ocupa el resto; cambia el ancho de las demás' });
  assert.deepEqual(api.cambiarAnchoVertical(plano, sala, 'banda2', 7), { motivo: 'la última banda vertical se quedaría sin ancho' });
});

test('crecer una banda dentro de una vertical recoloca el espacio libre de debajo', () => {
  const api = cargar();
  const { plano, sala } = conFranja(api, (p) => ({ ...p,
    bloquesFilas: [bloque('F1', 8, 22, { ancho: 3, filas: 2, zona: 'general' })] }));
  // Las filas de la derecha pasan de 2 a 3: el espacio libre empieza en la 23 y el
  // bloque, anclado a el, baja y se sale de la sala.
  const mas = api.redimensionarBanda(plano, sala, 'banda5', 1);
  assert.deepEqual(mas.bloquesFilas.map((b) => b.y), [23]);
  const fallo = api.primeraPiezaQueNoCabe(api.generarPlano('mixta-ambos', mas));
  assert.deepEqual([fallo.pieza.id, fallo.motivo], ['F1', 'se sale de la sala']);
  // La zona de mesas de la izquierda pasa a 6 de alto: la franja crece y el bloque se queda.
  const alta = api.redimensionarBanda(plano, sala, 'banda3', 2);
  const salaAlta = api.generarPlano('mixta-ambos', alta);
  assert.deepEqual([salaAlta.bandas.at(-1).alto, salaAlta.alto], [6, 26]);
  assert.deepEqual(alta.bloquesFilas.map((b) => b.y), [22]);
  assert.equal(api.primeraPiezaQueNoCabe(salaAlta), null);
  assert.deepEqual(api.redimensionarBanda(plano, sala, 'banda1', 1), { motivo: 'su alto depende de las bandas que tiene dentro' });
});

test('mover verticales a los lados y la franja arriba o abajo lleva sus piezas', () => {
  const api = cargar();
  const { plano, sala } = conFranja(api, (p) => ({ ...p, mesas: [...p.mesas, mesa('M9', 6, 20)],
    bloquesFilas: [bloque('F1', 8, 22, { ancho: 3, filas: 2, zona: 'general' })] }));
  const derecha = api.moverBanda(plano, sala, 'banda2', 1);
  const franja = derecha.bandas.at(-1);
  assert.deepEqual(franja.verticales.map((v) => [v.id, v.ancho]), [['banda4', 7], ['banda2', undefined]]);
  assert.deepEqual(derecha.bloquesFilas.map((b) => [b.x, b.y]), [[1, 22]]);
  assert.deepEqual(derecha.mesas.filter((m) => m.id === 'M9').map((m) => [m.x, m.y]), [[13, 20]]);
  assert.equal(api.primeraPiezaQueNoCabe(api.generarPlano('mixta-ambos', derecha)), null);
  assert.deepEqual(api.moverBanda(plano, sala, 'banda4', 1), { motivo: 'ya está a la derecha del todo' });

  const arriba = api.moverBanda(plano, sala, 'banda1', -1);   // sube por encima de General
  assert.deepEqual(arriba.bloquesFilas.map((b) => b.y), [20]);
  assert.deepEqual(arriba.mesas.filter((m) => m.id === 'M9').map((m) => m.y), [18]);
});

test('agregar y eliminar verticales y bandas dentro de ellas', () => {
  const api = cargar();
  const { plano, sala } = conFranja(api, (p) => ({ ...p, mesas: [...p.mesas, mesa('M9', 6, 20)],
    bloquesFilas: [bloque('F1', 8, 22, { ancho: 3, filas: 2, zona: 'general' })] }));
  const tres = api.agregarVertical(plano, sala, 'banda1');
  const salaTres = api.generarPlano('mixta-ambos', tres);
  assert.deepEqual(salaTres.bandas.at(-1).verticales.map((v) => [v.x, v.anchoOcupado]), [[1, 7], [8, 3], [11, 4]]);

  const sinDerecha = api.eliminarBanda(plano, sala, 'banda4');
  assert.deepEqual(sinDerecha.bloquesFilas, []);
  assert.deepEqual(sinDerecha.bandas.at(-1).verticales.map((v) => [v.id, v.ancho]), [['banda2', undefined]]);
  const unaSola = api.generarPlano('mixta-ambos', sinDerecha);
  assert.deepEqual(api.eliminarBanda(sinDerecha, unaSola, 'banda2'),
    { motivo: 'una franja dividida necesita al menos una banda vertical; elimina la franja' });

  const sinFranja = api.eliminarBanda(plano, sala, 'banda1');
  assert.deepEqual([sinFranja.bloquesFilas.length, sinFranja.mesas.some((m) => m.id === 'M9')], [0, false]);

  const conMesas = api.agregarBandaEnVertical(plano, sala, 'banda4', 'mesas');
  const salaMesas = api.generarPlano('mixta-ambos', conMesas);
  assert.deepEqual(salaMesas.bandas.at(-1).verticales[1].bandas.map((b) => [b.tipo, b.y, b.alto]),
    [['filas', 20, 2], ['mesas', 22, 4]]);
  assert.equal(salaMesas.bandas.at(-1).alto, 6);
});

test('una franja dividida se guarda en el mapa y se valida al leer', () => {
  const api = cargar();
  const { plano, sala } = conFranja(api);
  const extraido = api.planoDesdeSala('mixta-ambos', sala);
  assert.deepEqual(extraido.bandas.at(-1), {
    id: 'banda1', tipo: 'division',
    verticales: [
      { id: 'banda2', ancho: 7, bandas: [{ id: 'banda3', tipo: 'mesas', alto: 4 }] },
      { id: 'banda4', bandas: [{ id: 'banda5', tipo: 'filas', zona: 'general', filas: 2 }] },
    ],
  });
  const mapa = JSON.parse(JSON.stringify(api.mapaDesdePlano('Franja', extraido, null)));
  const { mapa: leido, errores } = api.validarMapa(mapa);
  assert.equal(errores, undefined);
  const clave = api.registrarMapa(leido);
  assert.equal(api.generarPlano(clave).alto, 24);

  const con = (cambio) => { const m = JSON.parse(JSON.stringify(mapa)); cambio(m); return api.validarMapa(m).errores || []; };
  const franja = (m) => m.bandas.at(-1);
  assert.deepEqual(con((m) => { franja(m).verticales[0].ancho = 14; }),
    ['las bandas verticales de Franja dividida no caben en 14 columnas']);
  assert.ok(con((m) => { delete franja(m).verticales[0].ancho; })
    .includes('banda 5, vertical 1: ancho fuera de rango'));
  assert.ok(con((m) => { franja(m).verticales[1].bandas.push({ id: 'otra', tipo: 'division', verticales: [] }); })
    .includes('banda 5, vertical 2, banda 2: dentro de una vertical solo van filas, mesas o espacios'));
  assert.ok(con((m) => { franja(m).verticales = []; })
    .includes('banda 5: debe tener de 1 a 6 bandas verticales'));
  assert.ok(con((m) => { franja(m).verticales[1].id = 'banda2'; })
    .includes('banda 5, vertical 2: id no válido o repetido'));
});

// --- Duplicar, nombres y capas -------------------------------------------------

test('duplicar una mesa: id nuevo, misma forma, junto a la original y con sus bloqueadas', () => {
  const api = cargar();
  const { plano, sala } = planoDe(api, 'mixta-ambos');
  plano.bloqueadas = [...plano.bloqueadas, 'M1-N1'];
  // A la derecha de M1 hay un pasillo y debajo esta M4: va al sitio libre mas cercano.
  const copia = api.duplicarPieza(plano, sala, 'M1');
  assert.deepEqual(copia.mesas.at(-1), { id: 'M7', x: 2, y: 14, largo: 2, cabeceras: false, unLado: false, giro: 0 });
  assert.equal(copia.siguiente, 8);
  assert.ok(copia.bloqueadas.includes('M1-N1') && copia.bloqueadas.includes('M7-N1'));
  assert.equal(plano.mesas.length, 6);   // no toca el plano de entrada
  assert.equal(api.primeraPiezaQueNoCabe(api.generarPlano('mixta-ambos', copia)), null);
  assert.equal(api.butacas.find((b) => b.id === 'M7-N1').estado, 'bloqueada');
  assert.deepEqual(api.duplicarPieza(plano, sala, 'escenario'), { motivo: 'el escenario no se puede duplicar' });
});

test('duplicar un bloque: a su derecha si cabe, con «(copia)» en su nombre propio', () => {
  const api = cargar();
  const { plano, sala } = conBloques(api, 'mixta-ambos', bloque('F1', 1, 14, { ancho: 3, nombre: 'Palco' }));
  const copia = api.duplicarPieza(plano, sala, 'F1');
  assert.deepEqual(copia.bloquesFilas.map((b) => [b.id, b.x, b.y, b.nombre]), [['F1', 1, 14, 'Palco'], ['F2', 4, 14, 'Palco (copia)']]);
  assert.equal(copia.siguienteBloque, 3);
  // Un nombre largo se recorta para que quepa el sufijo.
  const largo = conBloques(api, 'mixta-ambos', bloque('F1', 1, 14, { ancho: 3, nombre: 'x'.repeat(40) }));
  const nombre = api.duplicarPieza(largo.plano, largo.sala, 'F1').bloquesFilas[1].nombre;
  assert.deepEqual([nombre.length, nombre.endsWith(' (copia)')], [40, true]);
});

test('duplicar una banda de filas: debajo de la original, ids nuevos y la numeracion sigue', () => {
  const api = cargar();
  const { plano, sala } = planoDe(api, 'mixta-ambos');
  const copia = api.duplicarBanda(plano, sala, 'general');
  assert.deepEqual(copia.bandas.map((b) => b.id), ['escenario', 'luneta', 'mesas', 'general', 'banda1']);
  assert.equal(copia.siguienteBanda, 2);
  assert.deepEqual(copia.bloqueadas, ['general-B11', 'general-B12', 'banda1-B11', 'banda1-B12']);
  const salaCopia = api.generarPlano('mixta-ambos', copia);
  assert.deepEqual(resumenBandas(salaCopia).slice(-2), ['General@18+2', 'General 2@20+2']);
  // La ocupacion no se copia; la etiqueta sigue siendo la de la zona.
  assert.ok(api.butacas.filter((b) => b.banda === 'banda1').every((b) => b.estado !== 'ocupada'));
  assert.deepEqual(['banda1-A1', 'banda1-B12'].map((id) => etiqueta(api, id)), ['General C1', 'General D12']);
  // La luneta, arriba del todo: lo de debajo baja con sus mesas.
  const luneta = api.duplicarBanda(plano, sala, 'luneta');
  assert.deepEqual(posiciones(luneta.mesas), { M1: 10, M2: 10, M3: 10, M4: 14, M5: 14, M6: 14 });
  assert.deepEqual(api.duplicarBanda(plano, sala, 'escenario'), { motivo: 'la franja del escenario no se puede duplicar' });
});

test('duplicar una zona de mesas copia sus mesas a la misma distancia', () => {
  const api = cargar();
  const { plano, sala } = planoDe(api, 'mixta-ambos');
  const copia = api.duplicarBanda(plano, sala, 'mesas');
  assert.deepEqual(posiciones(copia.mesas), { M1: 7, M2: 7, M3: 7, M4: 11, M5: 11, M6: 11,
                                              M7: 20, M8: 20, M9: 20, M10: 24, M11: 24, M12: 24 });
  assert.deepEqual(copia.mesas.slice(6).map((m) => m.x), [2, 7, 12, 2, 7, 12]);
  assert.equal(copia.siguiente, 13);
  const salaCopia = api.generarPlano('mixta-ambos', copia);
  assert.deepEqual([salaCopia.alto, api.primeraPiezaQueNoCabe(salaCopia)], [33, null]);
});

test('duplicar una franja o una vertical copia todo lo de dentro con ids nuevos', () => {
  const api = cargar();
  const { plano, sala } = conFranja(api, (p) => ({ ...p, mesas: [...p.mesas, mesa('M9', 6, 20)], siguiente: 10,
    bloquesFilas: [bloque('F1', 8, 22, { ancho: 3, filas: 2, zona: 'general', nombre: 'Palco' })], siguienteBloque: 2,
    bloqueadas: ['F1-1-1', 'banda5-A2', 'M9-N1'] }));

  const franja = api.duplicarBanda(plano, sala, 'banda1');
  assert.deepEqual(api.hojasDe(franja.bandas).map((b) => b.id).slice(-4), ['banda3', 'banda5', 'banda8', 'banda10']);
  assert.deepEqual(franja.bandas.at(-1).verticales.map((v) => [v.id, v.ancho]), [['banda7', 7], ['banda9', undefined]]);
  assert.deepEqual(franja.mesas.slice(-2).map((m) => [m.id, m.x, m.y]), [['M9', 6, 20], ['M10', 6, 24]]);
  assert.deepEqual(franja.bloquesFilas.map((b) => [b.id, b.x, b.y, b.nombre]),
    [['F1', 8, 22, 'Palco'], ['F2', 8, 26, 'Palco (copia)']]);
  assert.deepEqual(franja.bloqueadas, ['F1-1-1', 'banda5-A2', 'M9-N1', 'F2-1-1', 'banda10-A2', 'M10-N1']);
  assert.equal(api.primeraPiezaQueNoCabe(api.generarPlano('mixta-ambos', franja)), null);

  // La ultima vertical (7 columnas) se parte entre ella y su copia.
  const ultima = api.duplicarBanda(plano, sala, 'banda4');
  assert.deepEqual(ultima.bandas.at(-1).verticales.map((v) => [v.id, v.ancho]), [['banda2', 7], ['banda4', 3], ['banda6', undefined]]);
  assert.deepEqual(ultima.bloquesFilas.map((b) => [b.id, b.x, b.y]), [['F1', 8, 22], ['F2', 11, 22]]);
  assert.equal(api.primeraPiezaQueNoCabe(api.generarPlano('mixta-ambos', ultima)), null);
});

test('una vertical con 1 columna o una franja llena de verticales no se duplican', () => {
  const api = cargar();
  const { plano, sala } = conFranja(api);
  const angosta = api.cambiarAnchoVertical(plano, sala, 'banda2', 6);   // 13 y 1 columnas
  assert.deepEqual(api.duplicarBanda(angosta, api.generarPlano('mixta-ambos', angosta), 'banda4'),
    { motivo: 'no queda ancho para la copia: Vertical 2 mide 1 columna' });
  let llena = api.cambiarAnchoVertical(plano, sala, 'banda2', -6);   // 1 y 13 columnas
  for (let i = 0; i < 4; i++) llena = api.agregarVertical(llena, api.generarPlano('mixta-ambos', llena), 'banda1');
  assert.deepEqual(api.duplicarBanda(llena, api.generarPlano('mixta-ambos', llena), 'banda2'),
    { motivo: 'ya tiene el máximo de bandas verticales (6)' });
});

test('renombrar bandas y verticales: se guarda, se limpia y sobrevive al cambio de zona', () => {
  const api = cargar();
  const { plano } = conFranja(api);
  let nuevo = api.renombrarBanda(plano, 'banda4', '  Palcos derechos  ');
  nuevo = api.renombrarBanda(nuevo, 'general', 'Gradas');
  nuevo = api.cambiarZonaBanda(nuevo, 'general', 'luneta');
  const salaNueva = api.generarPlano('mixta-ambos', nuevo);
  assert.equal(salaNueva.bandas.at(-1).verticales[1].nombre, 'Palcos derechos');
  assert.equal(api.ubicar(salaNueva.bandas, 'general').item.nombre, 'Gradas');
  // La etiqueta de las butacas sigue siendo la de la zona.
  assert.equal(etiqueta(api, 'general-A1'), 'Luneta D1');
  // planoDesdeSala conserva los nombres propios, no los de por defecto.
  const extraido = api.planoDesdeSala('mixta-ambos', salaNueva);
  assert.deepEqual([extraido.bandas[3].nombre, extraido.bandas[4].nombre, extraido.bandas[4].verticales[1].nombre],
    ['Gradas', undefined, 'Palcos derechos']);
  // Vacio: vuelve al nombre por defecto. El escenario no lleva nombre.
  const sinNombre = api.generarPlano('mixta-ambos', api.renombrarBanda(nuevo, 'banda4', '   '));
  assert.equal(sinNombre.bandas.at(-1).verticales[1].nombre, 'Vertical 2');
  assert.equal(api.renombrarBanda(nuevo, 'nada', 'a').motivo, 'esa banda ya no existe');
  assert.equal(api.renombrarBanda(plano, 'mesas', 'y'.repeat(60)).bandas[2].nombre.length, 40);
  assert.deepEqual(api.renombrarBanda(plano, 'escenario', 'a'), { motivo: 'la franja del escenario no lleva nombre' });
  // Y se guarda en el mapa.
  const mapa = JSON.parse(JSON.stringify(api.mapaDesdePlano('Nombres', nuevo, null)));
  const { mapa: leido } = api.validarMapa(mapa);
  assert.equal(api.generarPlano(api.registrarMapa(leido)).bandas.at(-1).verticales[1].nombre, 'Palcos derechos');
});

test('subtitulos: las bandas de la sala en el margen, las verticales en su borde', () => {
  const api = cargar();
  const { plano, sala } = conFranja(api);
  const subtitulos = api.muebles.filter((m) => m.tipo === 'subtitulo');
  assert.deepEqual(subtitulos.map((m) => [m.lugar, m.banda, m.texto, m.x, m.y]), [
    ['margen', 'luneta', 'Luneta', -2, 2],
    ['margen', 'mesas', 'Zona de mesas', -3, 5],
    ['margen', 'general', 'General', -2, 18],
    ['margen', 'banda1', 'Franja dividida', -3, 20],
    ['borde', 'banda3', 'Vertical 1 · Zona de mesas 2', 1, 20],
    ['borde', 'banda5', 'Vertical 2 · General 2', 8, 20],
  ]);
  // Una segunda banda dentro de una vertical lleva su propio subtitulo.
  api.generarPlano('mixta-ambos', api.agregarBandaEnVertical(plano, sala, 'banda4', 'mesas'));
  assert.deepEqual(api.muebles.filter((m) => m.tipo === 'subtitulo').at(-1),
    { tipo: 'subtitulo', lugar: 'borde', banda: 'banda6', texto: 'Zona de mesas 3', x: 8, y: 22 });
});

test('capas y seleccion de bandas por celda: clic a clic se sube por el arbol', () => {
  const api = cargar();
  const { sala } = conFranja(api);
  assert.deepEqual(api.capasDe(sala.bandas),
    ['luneta', 'mesas', 'general', 'banda1', 'banda2', 'banda3', 'banda4', 'banda5']);
  // Celda (9, 20): filas de la vertical derecha.
  assert.deepEqual([null, 'banda5', 'banda4', 'banda1'].map((actual) => api.bandaEnCelda(sala, 9, 20, actual)),
    ['banda5', 'banda4', 'banda1', null]);
  assert.equal(api.bandaEnCelda(sala, 9, 23), 'banda4');           // espacio libre bajo las filas
  assert.equal(api.bandaEnCelda(sala, 3, 0), null);                // la franja del escenario
  assert.equal(api.bandaEnCelda(sala, 3, 3, 'mesas'), 'luneta');   // con otra seleccionada, la de la celda
});

// --- Mapa en blanco: lienzo, espacios y escenario opcional ---------------------

const conLienzo = (api, preparar = (plano) => plano) => {
  const { plano } = planoDe(api, 'mapa-en-blanco');
  const nuevo = preparar(plano);
  return { plano: nuevo, sala: api.generarPlano('mapa-en-blanco', nuevo) };
};

test('el mapa en blanco es un lienzo de 20 × 10 sin pasillos, sin escenario y vacio', () => {
  const api = cargar();
  const { plano, sala } = conLienzo(api);
  assert.deepEqual([sala.ancho, sala.alto, sala.columnas.length, sala.lienzo], [20, 10, 20, true]);
  assert.deepEqual([api.butacas.length, api.mesas.length, api.bloquesFilas.length, api.escenario.ausente], [0, 0, 0, true]);
  assert.deepEqual(api.muebles.map((m) => m.tipo), ['subtitulo']);   // ni escenario ni rotulos
  assert.deepEqual(resumenBandas(sala), ['Espacio@0+10']);
  assert.deepEqual([plano.escenario, plano.lienzo, plano.bandas], [null, true, [{ id: 'espacio', tipo: 'espacio', alto: 10 }]]);
  // Sin escenario nada ocupa celdas: una mesa cabe en la esquina.
  assert.equal(api.celdasOcupadas(null).size, 0);
  assert.equal(api.primeraPiezaQueNoCabe(sala), null);
});

test('los espacios: alto propio, nombre numerado, guias de fila y dentro de verticales', () => {
  const api = cargar();
  const { plano, sala } = conLienzo(api, (p) => api.agregarBanda(api.alternarGuias(p, 'espacio'), 'espacio', 20));
  assert.deepEqual(resumenBandas(sala), ['Espacio@0+10', 'Espacio 2@10+4']);
  // Guias A a J a la izquierda del primer espacio; no son butacas.
  const guias = api.muebles.filter((m) => m.tipo === 'guia');
  assert.deepEqual(guias.map((m) => m.texto).join(''), 'ABCDEFGHIJ');
  assert.ok(guias.every((m) => m.x === 0 && m.banda === 'espacio'));
  assert.equal(api.butacas.length, 0);
  assert.deepEqual(api.alternarGuias(plano, 'espacio').bandas[0], { id: 'espacio', tipo: 'espacio', alto: 10 });
  assert.deepEqual(api.redimensionarBanda(plano, sala, 'banda1', 2).bandas[1].alto, 6);
  assert.deepEqual(api.alternarGuias(api.planoDesdeSala('mixta-ambos', api.generarPlano('mixta-ambos')), 'luneta'),
    { motivo: 'las guías de fila son para los espacios' });
  // En una vertical: el de la derecha lleva las guias a la derecha de la sala.
  const franja = api.agregarBanda(plano, 'division', 20);
  const conEspacio = api.agregarBandaEnVertical(franja, api.generarPlano('mapa-en-blanco', franja), 'banda5', 'espacio');
  const guiada = api.alternarGuias(conEspacio, 'banda7');
  const salaGuiada = api.generarPlano('mapa-en-blanco', guiada);
  assert.deepEqual(api.ubicar(salaGuiada.bandas, 'banda7').item.nombre, 'Espacio 5');
  assert.deepEqual(api.muebles.filter((m) => m.tipo === 'guia' && m.banda === 'banda7').map((m) => [m.texto, m.x, m.y]),
    [['A', 21, 18], ['B', 21, 19], ['C', 21, 20], ['D', 21, 21]]);
});

test('sin escenario las filas miran arriba y la fila A es la de mas arriba de cada zona', () => {
  const api = cargar();
  conLienzo(api, (p) => ({ ...p, siguienteBloque: 3, bloquesFilas: [
    bloque('F1', 3, 2, { ancho: 4, zona: 'general' }), bloque('F2', 10, 1, { ancho: 2, filas: 1, zona: 'general' })] }));
  assert.deepEqual(['F2-1-1', 'F1-1-1', 'F1-2-4'].map((id) => etiqueta(api, id)), ['General A1', 'General B1', 'General C4']);
  assert.ok(api.butacas.every((b) => b.mira === 180));
  assert.equal(api.giroHaciaEscenario(5, 5), 0);
  // Quitar el escenario de una plantilla: la luneta sigue siendo A desde arriba.
  const { plano } = planoDe(api, 'mixta-ambos');
  const salaSin = api.generarPlano('mixta-ambos', api.quitarEscenario(plano));
  assert.equal(api.escenario.ausente, true);
  assert.deepEqual([etiqueta(api, 'luneta-A1'), etiqueta(api, 'general-B1')], ['Luneta A1', 'General B1']);
  assert.ok(!api.muebles.some((m) => m.tipo === 'escenario'));
  assert.equal(api.primeraPiezaQueNoCabe(salaSin), null);
  assert.equal(api.planoDesdeSala('mixta-ambos', salaSin).escenario, null);
});

test('agregar escenario: a todo el ancho en el primer hueco libre, o mas angosto', () => {
  const api = cargar();
  const { plano, sala } = conLienzo(api, (p) => ({ ...p, siguienteBloque: 2,
    bloquesFilas: [bloque('F1', 3, 0, { ancho: 4, zona: 'general' })] }));
  const conEscenario = api.agregarEscenario(plano, sala);
  assert.deepEqual(conEscenario.escenario, { x: 1, y: 2, ancho: 20, alto: 2 });
  api.generarPlano('mapa-en-blanco', conEscenario);
  assert.equal(api.escenario.ausente, false);
  assert.equal(api.muebles.filter((m) => m.tipo === 'escenario').length, 1);
  // El bloque queda por encima del escenario: mira hacia arriba, de espaldas, con secuencia propia.
  assert.equal(etiqueta(api, 'F1-1-1'), 'Bloque 1 A1');
  // Sin un hueco a todo el ancho, uno de 8 columnas.
  const lleno = conLienzo(api, (p) => ({ ...p, bandas: [{ id: 'espacio', tipo: 'espacio', alto: 3 }], siguienteBloque: 2,
    bloquesFilas: [bloque('F1', 1, 0, { ancho: 12, filas: 3, zona: 'general' })] }));
  assert.deepEqual(api.agregarEscenario(lleno.plano, lleno.sala).escenario, { x: 13, y: 0, ancho: 8, alto: 2 });
  const sinSitio = conLienzo(api, (p) => ({ ...p, bandas: [{ id: 'espacio', tipo: 'espacio', alto: 1 }] }));
  assert.deepEqual(api.agregarEscenario(sinSitio.plano, sinSitio.sala),
    { motivo: 'no hay un hueco libre de 4 × 2 celdas para el escenario' });
});

test('cambiar el ancho del lienzo: las piezas se quedan y el escenario a todo el ancho lo sigue', () => {
  const api = cargar();
  const { plano, sala } = conLienzo(api, (p) => ({ ...p, escenario: { x: 1, y: 0, ancho: 20, alto: 2 }, siguienteBloque: 2,
    bloquesFilas: [bloque('F1', 10, 4, { ancho: 4, zona: 'general' })] }));
  const ancho = api.cambiarAnchoLienzo(plano, sala, 30);
  assert.deepEqual([ancho.distribucion, ancho.escenario, ancho.bloquesFilas[0].x], [{ bloques: [30], pasillos: [] }, { x: 1, y: 0, ancho: 30, alto: 2 }, 10]);
  const salaAncha = api.generarPlano('mapa-en-blanco', ancho);
  assert.deepEqual([salaAncha.ancho, salaAncha.columnas.length, api.primeraPiezaQueNoCabe(salaAncha)], [30, 30, null]);
  // Mas angosto que el bloque: el bloque se sale y el cambio no debe aplicarse.
  const angosto = api.generarPlano('mapa-en-blanco', api.cambiarAnchoLienzo(plano, sala, 12));
  assert.deepEqual([api.primeraPiezaQueNoCabe(angosto).pieza.id, api.primeraPiezaQueNoCabe(angosto).motivo], ['F1', 'se sale de la sala']);
  assert.deepEqual(api.cambiarAnchoLienzo(plano, sala, 41), { motivo: 'el ancho del lienzo debe ser de 1 a 40 columnas' });
  assert.deepEqual(api.cambiarAnchoLienzo(plano, sala, 0), { motivo: 'el ancho del lienzo debe ser de 1 a 40 columnas' });
});

test('mapas version 3: lienzo, sin escenario y espacios con guias, y se validan al leer', () => {
  const api = cargar();
  const { plano } = conLienzo(api, (p) => api.agregarBanda(api.alternarGuias(p, 'espacio'), 'espacio', 20));
  const mapa = JSON.parse(JSON.stringify(api.mapaDesdePlano('Salón de eventos', plano, null)));
  assert.deepEqual([mapa.version, mapa.lienzo, mapa.escenario, mapa.bandas],
    [4, true, null, [{ id: 'espacio', tipo: 'espacio', alto: 10, guias: true }, { id: 'banda1', tipo: 'espacio', alto: 4 }]]);
  const { mapa: leido, errores } = api.validarMapa(mapa);
  assert.equal(errores, undefined);
  assert.deepEqual([leido.lienzo, leido.escenario, leido.bandas[0].guias], [true, null, true]);
  const sala = api.generarPlano(api.registrarMapa(leido));
  assert.deepEqual([sala.lienzo, sala.alto, api.escenario.ausente], [true, 14, true]);

  const con = (cambio) => { const m = JSON.parse(JSON.stringify(mapa)); cambio(m); return api.validarMapa(m).errores || []; };
  assert.ok(con((m) => { m.distribucion = { bloques: [10, 9], pasillos: [1] }; }).includes('un lienzo no tiene pasillos'));
  assert.ok(con((m) => { m.lienzo = 'si'; }).includes('lienzo debe ser true o false'));
  assert.ok(con((m) => { m.bandas[1].alto = 0; }).includes('banda 2: alto fuera de rango'));
  // Los espacios y el escenario nulo son de la version 3.
  assert.ok(con((m) => { m.version = 2; }).includes('la primera banda debe ser el escenario'));
  assert.ok(con((m) => { m.version = 2; m.bandas.unshift({ id: 'escenario', tipo: 'escenario' }); })
    .includes('banda 2: tipo de banda desconocido'));
  // Un mapa de la version 2 sin campo escenario sigue usando el de por defecto.
  const { plano: clasico } = planoDe(api, 'mixta-ambos');
  const v2 = JSON.parse(JSON.stringify(api.mapaDesdePlano('Clásico', clasico, null)));
  Object.assign(v2, { version: 2 });
  delete v2.escenario;
  const leidoV2 = api.validarMapa(v2).mapa;
  api.generarPlano(api.registrarMapa(leidoV2));
  assert.deepEqual([leidoV2.escenario, api.escenario.ausente, api.escenario.ancho], [undefined, false, 14]);
});

// --- Fase B: butacas sueltas y formas -------------------------------------------

const forma = (id, tipoForma, x, y, extra = {}) =>
  ({ id, tipo: 'forma', forma: tipoForma, x, y, ancho: 4, alto: tipoForma === 'pista' ? 4 : 1, ...extra });
const suelta = (id, x, y, extra = {}) => ({ id, tipo: 'butaca', x, y, zona: 'general', giro: 0, ...extra });

test('una butaca suelta es una butaca con el id de la pieza, que se numera con su zona', () => {
  const api = cargar();
  const { sala } = conLienzo(api, (p) => ({ ...p, siguienteBloque: 2, siguienteButaca: 4,
    bloquesFilas: [bloque('F1', 5, 2, { ancho: 3, filas: 1, zona: 'general' })],
    butacasSueltas: [suelta('B1', 1, 2), suelta('B2', 12, 2, { giro: 90 }), suelta('B3', 3, 5, { zona: 'luneta', giro: 270 })] }));
  assert.equal(api.primeraPiezaQueNoCabe(sala), null);
  const b2 = api.butacas.find((b) => b.id === 'B2');
  assert.deepEqual([b2.suelta, b2.mira, b2.grupo], ['B2', 270, null]);
  // Misma altura que el bloque: B1 va antes (mas a la izquierda) y B2 despues, aunque mire de lado.
  assert.deepEqual(['B1', 'F1-1-1', 'F1-1-3', 'B2', 'B3'].map((id) => etiqueta(api, id)),
    ['General A1', 'General A2', 'General A4', 'General A5', 'Luneta A1']);
  // Ocupa su celda y cruza pasillos como un bloque.
  assert.equal(api.celdasOcupadas(null).get('1,2'), 'la butaca A1 de General');
  assert.equal(api.motivoNoCabe(sala, api.celdasOcupadas('B1'), suelta('B1', 1, 2)), null);
  const conPasillos = api.generarPlano('mixta-ambos');
  assert.equal(api.motivoNoCabe(conPasillos, api.celdasOcupadas(null), suelta('B9', 5, 16)), null);   // la 5 es pasillo
});

test('las formas ocupan sus celdas, giran sobre su centro y cambian de tamaño', () => {
  const api = cargar();
  const { sala } = conLienzo(api, (p) => ({ ...p, siguienteForma: 3,
    formas: [forma('P1', 'pista', 2, 2), forma('P2', 'barra', 10, 0, { nombre: 'Barra libre' })] }));
  assert.deepEqual(api.formas.map((f) => [f.id, f.nombre, f.geo.ancho, f.geo.alto]),
    [['P1', 'Pista de baile 1', 4, 4], ['P2', 'Barra libre', 4, 1]]);
  assert.deepEqual(api.muebles.filter((m) => m.tipo === 'forma').map((m) => [m.forma, m.pieza, m.x, m.y, m.w, m.h, m.texto]),
    [['pista', 'P1', 2, 2, 4, 4, 'Pista de baile 1'], ['barra', 'P2', 10, 0, 4, 1, 'Barra libre']]);
  assert.equal(api.butacas.length, 0);   // no tienen lugares
  const ocupadas = api.celdasOcupadas(null);
  assert.deepEqual([ocupadas.get('5,5'), ocupadas.get('13,0'), ocupadas.get('6,2')], ['Pista de baile 1', 'Barra libre', undefined]);
  assert.equal(api.motivoNoCabe(sala, ocupadas, suelta('B1', 3, 3)), 'choca con Pista de baile 1');
  assert.equal(api.primeraPiezaQueNoCabe(sala), null);
  // Girar intercambia ancho y alto; dos giros la dejan donde estaba.
  const barra = forma('P2', 'barra', 10, 4);
  assert.deepEqual(api.girarEscenario(barra), { ...barra, x: 11, y: 2, ancho: 1, alto: 4 });
  assert.deepEqual(api.girarEscenario(api.girarEscenario(barra)), barra);
  assert.deepEqual(api.cambiarTamanoForma(barra, 1, 1), { ...barra, ancho: 5, alto: 2 });
  assert.equal(api.cambiarTamanoForma(barra, 0, -1), null);
  assert.equal(api.cambiarTamanoForma({ ...barra, ancho: 40 }, 1, 0), null);
});

test('colocarCerca mete en la sala una pieza que se sale por un borde', () => {
  const api = cargar();
  const { sala } = conLienzo(api);
  // Una barra de 4 × 1 en la fila 0 girada queda de 1 × 4 empezando en la fila -2.
  const girada = api.girarEscenario(forma('P1', 'barra', 5, 0));
  assert.deepEqual([girada.x, girada.y], [6, -2]);
  assert.deepEqual(api.colocarCerca(sala, api.celdasOcupadas(null), girada), { ...girada, y: 0 });
});

test('duplicar formas y butacas sueltas, y copiarlas con su banda y sus bloqueadas', () => {
  const api = cargar();
  const { plano, sala } = conLienzo(api, (p) => ({ ...p, siguienteForma: 2, siguienteButaca: 2, bloqueadas: ['B1'],
    formas: [forma('P1', 'pista', 2, 2, { nombre: 'Pista central' })], butacasSueltas: [suelta('B1', 10, 3, { zona: 'luneta' })] }));
  const pista = api.duplicarPieza(plano, sala, 'P1');
  assert.deepEqual([pista.formas.at(-1), pista.siguienteForma],
    [{ id: 'P2', tipo: 'forma', forma: 'pista', x: 6, y: 2, ancho: 4, alto: 4, nombre: 'Pista central (copia)' }, 3]);
  const butaca = api.duplicarPieza(plano, sala, 'B1');
  assert.deepEqual([butaca.butacasSueltas.at(-1), butaca.siguienteButaca, butaca.bloqueadas],
    [{ id: 'B2', tipo: 'butaca', x: 11, y: 3, zona: 'luneta', giro: 0 }, 3, ['B1', 'B2']]);
  // Con el espacio entero: la copia va debajo con sus piezas y la butaca sigue bloqueada.
  const espacio = api.duplicarBanda(plano, sala, 'espacio');
  assert.deepEqual(espacio.formas.map((f) => [f.id, f.x, f.y]), [['P1', 2, 2], ['P2', 2, 12]]);
  assert.deepEqual(espacio.butacasSueltas.map((b) => [b.id, b.x, b.y]), [['B1', 10, 3], ['B2', 10, 13]]);
  assert.deepEqual(espacio.bloqueadas, ['B1', 'B2']);
  const salaCopia = api.generarPlano('mapa-en-blanco', espacio);
  assert.deepEqual([salaCopia.alto, api.primeraPiezaQueNoCabe(salaCopia)], [20, null]);
  // Eliminar la banda quita sus piezas; moverla, las lleva.
  const sin = api.eliminarBanda(espacio, salaCopia, 'banda1');
  assert.deepEqual([sin.formas.length, sin.butacasSueltas.length], [1, 1]);
  const arriba = api.moverBanda(espacio, salaCopia, 'banda1', -1);
  assert.deepEqual(arriba.formas.map((f) => [f.id, f.y]), [['P1', 12], ['P2', 2]]);
});

test('planoDesdeSala y los mapas guardan formas, butacas sueltas y sus contadores', () => {
  const api = cargar();
  const { sala } = conLienzo(api, (p) => ({ ...p, siguienteForma: 5, siguienteButaca: 2,
    formas: [forma('P4', 'barra', 1, 0, { nombre: 'Barra libre' })], butacasSueltas: [suelta('B1', 8, 3, { giro: 180 })] }));
  const plano = api.planoDesdeSala('mapa-en-blanco', sala);
  assert.deepEqual([plano.formas, plano.butacasSueltas, plano.siguienteForma, plano.siguienteButaca],
    [[forma('P4', 'barra', 1, 0, { nombre: 'Barra libre' })], [suelta('B1', 8, 3, { giro: 180 })], 5, 2]);
  const mapa = JSON.parse(JSON.stringify(api.mapaDesdePlano('Salón', plano, null)));
  const { mapa: leido, errores } = api.validarMapa(mapa);
  assert.equal(errores, undefined);
  api.generarPlano(api.registrarMapa(leido));
  assert.deepEqual([api.formas.length, api.butacasSueltas.length, api.butacas[0].mira], [1, 1, 0]);

  const con = (cambio) => { const m = JSON.parse(JSON.stringify(mapa)); cambio(m); return api.validarMapa(m).errores || []; };
  assert.ok(con((m) => { m.formas[0].forma = 'toString'; }).includes('P4: forma desconocida'));
  assert.ok(con((m) => { m.formas[0].alto = 21; }).includes('P4: tamaño fuera de rango'));
  assert.ok(con((m) => { m.formas.push({ ...m.formas[0] }); }).includes('forma 2: id no válido o repetido'));
  assert.ok(con((m) => { m.formas = 'no'; }).includes('la lista de formas no es válida'));
  assert.ok(con((m) => { m.butacasSueltas[0].zona = 'vip'; }).includes('B1: zona desconocida'));
  assert.ok(con((m) => { m.butacasSueltas[0].giro = 45; }).includes('B1: giro no válido'));
  assert.ok(con((m) => { m.butacasSueltas[0].id = 'F1'; }).includes('butaca suelta 1: id no válido o repetido'));
  assert.deepEqual(con((m) => { m.butacasSueltas[0].x = 2; m.butacasSueltas[0].y = 0; }), ['Barra libre choca con la butaca A1 de General']);
  // Sin las listas (mapas anteriores), vacias; los contadores no bajan de lo que existe.
  const viejo = api.validarMapa({ ...mapa, formas: undefined, butacasSueltas: undefined, siguienteForma: undefined });
  assert.deepEqual([viejo.mapa.formas, viejo.mapa.butacasSueltas, viejo.mapa.siguienteForma], [[], [], 1]);
  const bajo = api.validarMapa({ ...mapa, siguienteForma: 1 });
  assert.equal(bajo.mapa.siguienteForma, 5);
});

// --- Rendimiento y topes ----------------------------------------------------------

// Un lienzo de 40 columnas sin pasillos con 'n' bandas de 26 filas de General:
// n × 26 × 40 butacas.
const mapaDeFilas = (api, n) => {
  const { plano } = planoDe(api, 'mapa-en-blanco');
  const mapa = JSON.parse(JSON.stringify(api.mapaDesdePlano('Grande', plano, null)));
  mapa.distribucion = { bloques: [40], pasillos: [] };
  mapa.bandas = Array.from({ length: n }, (_, i) => ({ id: 'b' + i, tipo: 'filas', zona: 'general', filas: api.FILAS_MAXIMAS }));
  return mapa;
};

test('numerar 100.000 butacas no es cuadratico', () => {
  const api = cargar();
  const mapa = mapaDeFilas(api, 100);
  const t = performance.now();
  api.generarPlano({ ...mapa, bandas: mapa.bandas }, mapa);
  const ms = performance.now() - t;
  assert.equal(api.butacas.length, 104000);
  // La numeracion por zona sigue bien: 2.600 filas (A... CVZ) de 40 butacas.
  assert.deepEqual([etiqueta(api, 'b0-A1'), etiqueta(api, 'b99-Z40')], ['General A1', 'General CUZ40']);
  // Con recorridos anidados tardaba unos 6 s; agrupado, menos de 100 ms. El margen es amplio
  // para maquinas lentas, pero sigue muy por debajo del caso cuadratico.
  assert.ok(ms < 1500, 'numerar 104.000 butacas tardo ' + Math.round(ms) + ' ms: ¿vuelve a ser cuadratico?');
});

test('un mapa no puede pasar de 20.000 butacas', () => {
  const api = cargar();
  assert.equal(api.BUTACAS_MAXIMAS, 20000);
  const { mapa, errores } = api.validarMapa(mapaDeFilas(api, 19));   // 19.760
  assert.equal(errores, undefined);
  assert.equal(api.generarPlano(api.registrarMapa(mapa)).bandas.length, 19);
  assert.deepEqual(api.validarMapa(mapaDeFilas(api, 21)).errores,     // 21.840
    ['la sala tendría 21,840 butacas y el máximo es 20,000']);
  assert.equal(api.motivoDeAforo(20000), null);
  assert.equal(api.motivoDeAforo(20001), 'la sala tendría 20,001 butacas y el máximo es 20,000');
});

test('una franja nueva trae dos verticales con un espacio vacio cada una, sin butacas', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  const nuevo = api.agregarBanda(plano, 'division', 14);
  assert.deepEqual(nuevo.bandas.at(-1), { id: 'banda1', tipo: 'division', verticales: [
    { id: 'banda2', ancho: 7, bandas: [{ id: 'banda3', tipo: 'espacio', alto: 4 }] },
    { id: 'banda4', bandas: [{ id: 'banda5', tipo: 'espacio', alto: 4 }] }] });
  assert.equal(nuevo.siguienteBanda, 6);
  const antes = api.butacas.length;
  const sala = api.generarPlano('mixta-ambos', nuevo);
  assert.deepEqual([api.butacas.length, sala.bandas.at(-1).alto, sala.alto], [antes, 4, 24]);
  assert.deepEqual(api.muebles.filter((m) => m.tipo === 'subtitulo' && m.lugar === 'borde').map((m) => m.texto),
    ['Vertical 1 · Espacio', 'Vertical 2 · Espacio 2']);
});

// --- Zonas editables ---------------------------------------------------------------

test('las zonas de un plano cambian nombres, precios y etiquetas de su sala', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  assert.deepEqual(plano.zonas, [
    { id: 'luneta', nombre: 'Luneta', precio: 35000 }, { id: 'mesas', nombre: 'Mesas', precio: 50000 },
    { id: 'general', nombre: 'General', precio: 20000 }]);
  let nuevo = api.editarZona(plano, 'luneta', { nombre: '  Preferente ', precio: 125050 });
  nuevo = api.editarZona(nuevo, 'mesas', { precio: 0 });
  const sala = api.generarPlano('mixta-ambos', nuevo);
  assert.deepEqual(api.zonas.luneta, { nombre: 'Preferente', precio: 125050 });
  assert.equal(etiqueta(api, 'luneta-A1'), 'Preferente A1');
  assert.equal(sala.bandas[1].nombre, 'Preferente');   // el nombre por defecto sigue a la zona
  assert.equal(api.zonas.mesas.precio, 0);
  // Otra sala generada sin zonas propias vuelve a las de siempre.
  api.generarPlano('solo-filas');
  assert.equal(api.zonas.luneta.nombre, 'Luneta');
  // No se toca el plano de entrada.
  assert.equal(plano.zonas[0].nombre, 'Luneta');
});

test('editarZona valida nombre y precio', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  assert.deepEqual(api.editarZona(plano, 'general', { nombre: 'luneta' }), { motivo: 'ya hay una zona llamada «luneta»' });
  assert.deepEqual(api.editarZona(plano, 'general', { nombre: '   ' }), { motivo: 'el nombre de la zona debe tener entre 1 y 40 caracteres' });
  assert.deepEqual(api.editarZona(plano, 'general', { precio: -1 }), { motivo: 'el precio debe ser de 0 a 1,000,000.00' });
  assert.deepEqual(api.editarZona(plano, 'general', { precio: 12.5 }), { motivo: 'el precio debe ser de 0 a 1,000,000.00' });
  assert.deepEqual(api.editarZona(plano, 'vip', { precio: 1 }), { motivo: 'esa zona ya no existe' });
  assert.equal(api.editarZona(plano, 'general', { nombre: 'General' }).zonas[2].nombre, 'General');   // el suyo, si
  assert.deepEqual(['350', '350.5', '$1,200.00', ' 0 ', '1000000', '1000000.01', '12.345', 'abc', '-5', ''].map(api.leerPrecio),
    [35000, 35050, 120000, 0, 100000000, null, null, null, null, null]);
});

test('agregar y eliminar zonas: las nuevas sirven para filas, las usadas no se eliminan', () => {
  const api = cargar();
  const { plano, sala } = planoDe(api, 'mixta-ambos');
  const conVip = api.editarZona(api.agregarZona(plano), 'zona1', { nombre: 'VIP', precio: 90000 });
  assert.deepEqual([conVip.zonas.at(-1), conVip.siguienteZona], [{ id: 'zona1', nombre: 'VIP', precio: 90000 }, 2]);
  const vip = api.cambiarZonaBanda(conVip, 'luneta', 'zona1');
  api.generarPlano('mixta-ambos', vip);
  assert.deepEqual([etiqueta(api, 'luneta-C12'), api.zonas[api.butacas.find((b) => b.id === 'luneta-C12').zona].precio], ['VIP C12', 90000]);

  assert.deepEqual(api.eliminarZona(vip, 'zona1'), { motivo: 'VIP está en uso (1 banda o pieza); cámbialas de zona antes' });
  assert.deepEqual(api.eliminarZona(vip, 'mesas'), { motivo: 'la zona de mesas no se puede eliminar' });
  const sinLuneta = api.eliminarZona(vip, 'luneta');
  assert.deepEqual(sinLuneta.zonas.map((z) => z.id), ['mesas', 'general', 'zona1']);
  // Cuentan tambien las bandas dentro de verticales, los bloques y las butacas sueltas.
  assert.match(api.eliminarZona({ ...vip, bloquesFilas: [bloque('F1', 1, 14, { zona: 'luneta' })] }, 'luneta').motivo, /en uso/);
  assert.match(api.eliminarZona({ ...vip, butacasSueltas: [{ id: 'B1', tipo: 'butaca', x: 1, y: 14, zona: 'luneta', giro: 0 }] }, 'luneta').motivo, /en uso/);
  const soloGeneral = api.eliminarZona(api.eliminarZona(api.cambiarZonaBanda(plano, 'luneta', 'general'), 'luneta'), 'general');
  // La ultima zona de filas no se elimina (aunque ademas este en uso).
  assert.deepEqual(soloGeneral, { motivo: 'debe quedar al menos una zona para filas' });
  assert.deepEqual(api.eliminarZona(api.agregarZona(plano), 'general'), { motivo: 'General está en uso (1 banda o pieza); cámbialas de zona antes' });
  const lienzo = planoDe(api, 'mapa-en-blanco').plano;
  const sinGeneral = api.eliminarZona(lienzo, 'luneta');
  assert.deepEqual(api.eliminarZona(sinGeneral, 'general'), { motivo: 'debe quedar al menos una zona para filas' });
  // Sin General, las bandas de filas nuevas nacen en la primera zona de filas.
  const sinGen = api.eliminarZona(api.agregarZona(lienzo), 'general');
  assert.equal(api.agregarBanda(sinGen, 'filas').bandas.at(-1).zona, 'luneta');
  let lleno = plano;
  for (let i = 0; i < 17; i++) lleno = api.agregarZona(lleno);
  assert.deepEqual(api.agregarZona(lleno), { motivo: 'ya hay el máximo de zonas (20)' });
  void sala;
});

test('los mapas guardan y validan las zonas; sin ellas, las de siempre', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  const nuevo = api.cambiarZonaBanda(api.editarZona(api.agregarZona(plano), 'zona1', { nombre: 'VIP', precio: 90000 }), 'general', 'zona1');
  const mapa = JSON.parse(JSON.stringify(api.mapaDesdePlano('Con VIP', nuevo, null)));
  assert.deepEqual([mapa.zonas.at(-1), mapa.siguienteZona], [{ id: 'zona1', nombre: 'VIP', precio: 90000 }, 2]);
  const { mapa: leido, errores } = api.validarMapa(mapa);
  assert.equal(errores, undefined);
  const sala = api.generarPlano(api.registrarMapa(leido));
  assert.deepEqual([sala.bandas.at(-1).nombre, etiqueta(api, 'general-A1'), api.zonas.zona1.precio], ['VIP', 'VIP A1', 90000]);
  assert.deepEqual(api.planoDesdeSala(api.registrarMapa(leido), sala).zonas, mapa.zonas);

  const con = (cambio) => { const m = JSON.parse(JSON.stringify(mapa)); cambio(m); return api.validarMapa(m).errores || []; };
  assert.ok(con((m) => { m.zonas = m.zonas.filter((z) => z.id !== 'mesas'); }).includes('falta la zona de mesas'));
  assert.ok(con((m) => { m.zonas[3].nombre = 'luneta'; }).includes('zona 4: nombre repetido'));
  assert.ok(con((m) => { m.zonas[3].precio = -5; }).includes('zona 4: precio no válido'));
  assert.ok(con((m) => { m.zonas[3].id = 'Zona 1'; }).includes('zona 4: id no válido o repetido'));
  assert.ok(con((m) => { m.zonas = []; }).includes('debe haber de 1 a 20 zonas'));
  assert.ok(con((m) => { m.zonas = [{ id: 'mesas', nombre: 'Mesas', precio: 1 }]; }).includes('falta una zona para filas'));
  assert.ok(con((m) => { m.bandas[1].zona = 'mesas'; }).includes('banda 2: zona desconocida'));
  // Sin zonas en el archivo (mapas anteriores): Luneta, Mesas y General de siempre.
  const viejo = api.validarMapa({ ...mapa, zonas: undefined, bandas: mapa.bandas.map((b) => (b.zona === 'zona1' ? { ...b, zona: 'general' } : b)) });
  assert.deepEqual(viejo.mapa.zonas.map((z) => z.nombre), ['Luneta', 'Mesas', 'General']);
  assert.ok(api.validarMapa({ ...mapa, zonas: undefined }).errores.includes('banda 4: zona desconocida'));
});

// --- Mesas redondas -------------------------------------------------------------

const etiquetaDeLugarDeMesa = (api, id) => {
  const b = api.butacas.find((x) => x.id === id);
  return b.grupo.nombre + ', lugar ' + b.numero;
};
const redonda = (id, x, y, lugares, giro = 0) => ({ id, tipo: 'redonda', x, y, lugares, giro });
// El plano de la mesa como texto: ● el tablero y el numero de cada lugar.
const dibujoDeRedonda = (api, lugares, giro = 0) => {
  const geo = api.geometriaMesaRedonda({ lugares, giro });
  const rejilla = Array.from({ length: geo.alto }, () => Array(geo.ancho).fill('.'));
  for (let y = 0; y < geo.redonda.diametro; y++) {
    for (let x = 0; x < geo.redonda.diametro; x++) rejilla[geo.redonda.dy + y][geo.redonda.dx + x] = '●';
  }
  for (const l of geo.lugares) rejilla[l.dy][l.dx] = l.lado;
  return rejilla.map((f) => f.join(''));
};

test('una mesa redonda pone sus sillas por parejas en cada lado, sin usar las esquinas', () => {
  const api = cargar();
  // 8 lugares: tablero de 2 celdas, huella 4 × 4 y dos sillas por lado.
  const ocho = api.geometriaMesaRedonda({ lugares: 8 });
  assert.deepEqual([ocho.ancho, ocho.alto, ocho.tablero, ocho.redonda],
    [4, 4, null, { dx: 1, dy: 1, diametro: 2 }]);
  assert.deepEqual(dibujoDeRedonda(api, 8), ['.12.', '8●●3', '7●●4', '.65.']);
  assert.deepEqual(ocho.lugares.map((l) => l.mira), [0, 0, 90, 90, 180, 180, 270, 270]);
  // Dos lugares: uno enfrente del otro. Cuatro: en cruz.
  assert.deepEqual(dibujoDeRedonda(api, 2), ['.1.', '.●.', '.2.']);
  assert.deepEqual(dibujoDeRedonda(api, 4), ['.1.', '4●2', '.3.']);
  // Diez: la mesa crece a 5 × 5, con tres sillas arriba y abajo y dos a cada lado.
  assert.deepEqual(dibujoDeRedonda(api, 10), ['.123.', '0●●●4', '9●●●5', '.●●●.', '.876.']
    .map((f) => f.replace('0', '10')));
  // El tablero crece con los lugares: cuatro sillas por lado como maximo.
  assert.deepEqual([2, 4, 6, 8, 10, 12, 14, 16].map((n) => api.geometriaMesaRedonda({ lugares: n }).redonda.diametro),
    [1, 1, 2, 2, 3, 3, 4, 4]);
  // Los lugares son pares: un numero impar se redondea.
  assert.equal(api.geometriaMesaRedonda({ lugares: 9 }).lugares.length, 10);
  assert.equal(api.geometriaMesaRedonda({ lugares: 1 }).lugares.length, 2);
  assert.equal(api.geometriaMesaRedonda({ lugares: 40 }).lugares.length, 16);
  // Girar lleva las sillas al lado siguiente; la huella es cuadrada y no se mueve.
  assert.deepEqual(dibujoDeRedonda(api, 4, 90), ['.4.', '3●1', '.2.']);
  assert.deepEqual(api.geometriaMesaRedonda({ lugares: 4, giro: 90 }).lugares.map((l) => l.mira), [90, 180, 270, 0]);
  assert.deepEqual(api.huellaDe(redonda('M1', 2, 2, 16)).ancho, 6);
});

test('quitar y poner lugares en una mesa redonda, de dos en dos y con sus topes', () => {
  const api = cargar();
  assert.equal(api.cambiarLugaresRedonda(redonda('M1', 1, 1, 8), 1).lugares, 10);
  assert.equal(api.cambiarLugaresRedonda(redonda('M1', 1, 1, 8), -1).lugares, 6);
  assert.equal(api.cambiarLugaresRedonda(redonda('M1', 1, 1, 14), 1).lugares, 16);
  assert.equal(api.cambiarLugaresRedonda(redonda('M1', 1, 1, 2), -1), null);
  assert.equal(api.cambiarLugaresRedonda(redonda('M1', 1, 1, 16), 1), null);
  // La esquina de la huella no se mueve al cambiar los lugares.
  const crecida = api.cambiarLugaresRedonda(redonda('M1', 3, 4, 8), 1);
  assert.deepEqual([crecida.x, crecida.y], [3, 4]);
});

test('una mesa redonda ocupa toda su huella y respeta los pasillos', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  // Huella de 4 × 4: cabe en el bloque de columnas 1 a 4 de «ambos».
  const conRedonda = { ...plano, mesas: [...plano.mesas, redonda('M7', 1, 14, 8)], siguiente: 8 };
  const sala = api.generarPlano('mixta-ambos', conRedonda);
  assert.equal(api.primeraPiezaQueNoCabe(sala), null);
  const lugares = api.butacas.filter((b) => b.grupo && b.grupo.id === 'M7');
  assert.deepEqual(lugares.map((b) => b.id).slice(0, 3), ['M7-1', 'M7-2', 'M7-3']);
  assert.deepEqual([lugares.length, lugares[0].zona, etiquetaDeLugarDeMesa(api, 'M7-1')], [8, 'mesas', 'Mesa 7, lugar 1']);
  const ocupadas = api.celdasOcupadas('M7');
  // Sus propias celdas no le estorban; las de otra mesa si.
  assert.equal(api.motivoNoCabe(sala, ocupadas, redonda('M9', 1, 14, 8)), null);
  assert.equal(api.motivoNoCabe(sala, api.celdasOcupadas(null), redonda('M9', 1, 14, 8)), 'choca con Mesa 7');
  // Como cualquier mesa, no puede caer sobre un pasillo (la columna 5 de «ambos»).
  assert.equal(api.motivoNoCabe(sala, api.celdasOcupadas(null), redonda('M9', 7, 14, 8)), 'cae sobre un pasillo');
  // El tablero se dibuja como un mueble redondo con su diametro.
  assert.deepEqual(api.muebles.filter((m) => m.tipo === 'mesa-redonda').map((m) => [m.mesa, m.x, m.y, m.w]),
    [['M7', 2, 15, 2]]);
});

test('las mesas redondas se guardan en el plano y en el mapa, y se validan al leer', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  const conRedonda = { ...plano, mesas: [...plano.mesas, redonda('M7', 1, 14, 8, 90)], siguiente: 8 };
  const sala = api.generarPlano('mixta-ambos', conRedonda);
  const extraido = api.planoDesdeSala('mixta-ambos', sala);
  assert.deepEqual(extraido.mesas.at(-1), redonda('M7', 1, 14, 8, 90));
  assert.deepEqual(extraido.mesas[0], { id: 'M1', x: 2, y: 7, largo: 2, cabeceras: false, unLado: false, giro: 0 });
  const mapa = JSON.parse(JSON.stringify(api.mapaDesdePlano('Redondas', extraido, null)));
  const { mapa: leido, errores } = api.validarMapa(mapa);
  assert.equal(errores, undefined);
  assert.deepEqual(leido.mesas.at(-1), redonda('M7', 1, 14, 8, 90));
  api.generarPlano(api.registrarMapa(leido));
  assert.equal(api.butacas.filter((b) => b.grupo && b.grupo.id === 'M7').length, 8);

  const con = (cambio) => { const m = JSON.parse(JSON.stringify(mapa)); cambio(m); return api.validarMapa(m).errores || []; };
  const fueraDeRango = 'M7: los lugares de una mesa redonda deben ser un número par de 2 a 16';
  assert.ok(con((m) => { m.mesas.at(-1).lugares = 1; }).includes(fueraDeRango));
  assert.ok(con((m) => { m.mesas.at(-1).lugares = 18; }).includes(fueraDeRango));
  assert.ok(con((m) => { m.mesas.at(-1).lugares = 9; }).includes(fueraDeRango));
  assert.ok(con((m) => { m.mesas.at(-1).giro = 45; }).includes('M7: giro no válido'));
  assert.ok(con((m) => { m.mesas[0].tipo = 'ovalada'; }).includes('M1: tipo de mesa desconocido'));
  // Duplicar una redonda copia sus lugares.
  const copia = api.duplicarPieza(conRedonda, sala, 'M7');
  assert.deepEqual(copia.mesas.at(-1), redonda('M8', 6, 14, 8, 90));
});

// --- Mesas completas --------------------------------------------------------------

test('marcar una mesa, o todas, para venderlas completas', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  const una = api.marcarMesaCompleta(plano, 'M3', true);
  assert.deepEqual(una.mesas.filter((m) => m.completa).map((m) => m.id), ['M3']);
  assert.equal(plano.mesas.some((m) => m.completa), false);   // no toca el plano de entrada
  assert.equal(api.marcarMesaCompleta(una, 'M3', false).mesas.some((m) => 'completa' in m), false);
  assert.deepEqual(api.marcarMesaCompleta(plano, 'M99', true), { motivo: 'esa mesa ya no existe' });
  const todas = api.marcarTodasLasMesas(plano, true);
  assert.ok(todas.mesas.every((m) => m.completa));
  assert.ok(api.marcarTodasLasMesas(todas, false).mesas.every((m) => !('completa' in m)));
  // Los lugares de una mesa completa lo llevan en su grupo.
  api.generarPlano('mixta-ambos', una);
  assert.deepEqual(api.butacas.find((b) => b.id === 'M3-N1').grupo, { id: 'M3', nombre: 'Mesa 3', completa: true });
  assert.equal(api.butacas.find((b) => b.id === 'M1-N1').grupo.completa, false);
});

test('en una mesa completa se eligen y se sueltan todos sus lugares libres a la vez', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  // M3 completa, con un lugar bloqueado: se vende con los otros tres.
  api.generarPlano('mixta-ambos', { ...api.marcarMesaCompleta(plano, 'M3', true), bloqueadas: ['M3-S2'] });
  const ids = new Set();
  const lugar = (id) => api.butacas.find((b) => b.id === id);
  assert.equal(api.alternarEleccion(ids, lugar('M3-N1'), api.butacas), true);
  assert.deepEqual([...ids], ['M3-N1', 'M3-N2', 'M3-S1']);
  // Tocar otro de sus lugares la suelta entera.
  assert.equal(api.alternarEleccion(ids, lugar('M3-S1'), api.butacas), false);
  assert.equal(ids.size, 0);
  // Un lugar bloqueado no se puede tocar; una mesa por lugares elige de uno en uno.
  assert.equal(api.alternarEleccion(ids, lugar('M3-S2'), api.butacas), null);
  assert.equal(api.alternarEleccion(ids, lugar('M1-N1'), api.butacas), true);
  assert.deepEqual([...ids], ['M1-N1']);
});

test('una mesa completa con algun lugar ocupado se vendio entera', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  // La plantilla tiene dos lugares ocupados en M2 (S1 y S2).
  api.generarPlano('mixta-ambos', api.marcarMesaCompleta(plano, 'M2', true));
  assert.deepEqual(api.butacas.filter((b) => b.grupo && b.grupo.id === 'M2').map((b) => b.estado),
    ['ocupada', 'ocupada', 'ocupada', 'ocupada']);
  assert.equal(api.alternarEleccion(new Set(), api.butacas.find((b) => b.id === 'M2-N1'), api.butacas), null);
  // Por lugares, siguen libres los que no se vendieron.
  api.generarPlano('mixta-ambos', plano);
  assert.equal(api.butacas.find((b) => b.id === 'M2-N1').estado, 'libre');
});

test('al marcar una mesa completa, una seleccion parcial se completa', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  api.generarPlano('mixta-ambos', api.marcarMesaCompleta(plano, 'M1', true));
  const ids = new Set(['M1-N1', 'luneta-A1']);
  assert.deepEqual(api.completarMesasElegidas(ids, api.butacas), ['Mesa 1']);
  assert.deepEqual([...ids].sort(), ['M1-N1', 'M1-N2', 'M1-S1', 'M1-S2', 'luneta-A1']);
  assert.deepEqual(api.completarMesasElegidas(ids, api.butacas), []);   // ya estaba completa
});

test('los mapas guardan y validan las mesas completas', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  const conCompletas = { ...api.marcarMesaCompleta(plano, 'M3', true),
    mesas: [...api.marcarMesaCompleta(plano, 'M3', true).mesas,
            { id: 'M7', tipo: 'redonda', x: 1, y: 14, lugares: 8, giro: 0, completa: true }], siguiente: 8 };
  const sala = api.generarPlano('mixta-ambos', conCompletas);
  const extraido = api.planoDesdeSala('mixta-ambos', sala);
  assert.deepEqual(extraido.mesas.filter((m) => m.completa).map((m) => m.id), ['M3', 'M7']);
  assert.equal('completa' in extraido.mesas[0], false);
  const mapa = JSON.parse(JSON.stringify(api.mapaDesdePlano('Completas', extraido, null)));
  const { mapa: leido, errores } = api.validarMapa(mapa);
  assert.equal(errores, undefined);
  assert.deepEqual(leido.mesas.filter((m) => m.completa).map((m) => m.id), ['M3', 'M7']);
  const con = (cambio) => { const m = JSON.parse(JSON.stringify(mapa)); cambio(m); return api.validarMapa(m).errores || []; };
  assert.ok(con((m) => { m.mesas[0].completa = 'si'; }).includes('M1: completa debe ser true o false'));
});

// --- Zona por asiento ---------------------------------------------------------------

const conVip = (api) => {
  const { plano } = planoDe(api, 'mixta-ambos');
  return api.editarZona(api.agregarZona(plano), 'zona1', { nombre: 'VIP', precio: 90000 });
};

test('asignar una zona a un asiento cambia su precio y su seccion, no su fila ni su numero', () => {
  const api = cargar();
  const vip = conVip(api);
  const pintado = api.asignarZonaAsiento(vip, 'luneta-A3', 'zona1', 'luneta');
  assert.deepEqual(pintado.zonasDeAsiento, { 'luneta-A3': 'zona1' });
  assert.deepEqual(vip.zonasDeAsiento, {});   // no toca el plano de entrada
  api.generarPlano('mixta-ambos', pintado);
  const a3 = api.butacas.find((b) => b.id === 'luneta-A3');
  assert.deepEqual([a3.zona, a3.zonaOriginal, a3.seccion, a3.fila, a3.numero], ['zona1', 'luneta', 'VIP', 'A', 3]);
  // Sus vecinas no cambian: la A4 sigue siendo la A4 de Luneta.
  assert.equal(etiqueta(api, 'luneta-A4'), 'Luneta A4');
  // Volver a su zona de siempre quita la asignacion.
  assert.deepEqual(api.asignarZonaAsiento(pintado, 'luneta-A3', 'luneta', 'luneta').zonasDeAsiento, {});
});

test('un lugar de mesa tambien puede tener otra zona, y una mesa completa suma su precio', () => {
  const api = cargar();
  const vip = api.marcarMesaCompleta(api.asignarZonaAsiento(conVip(api), 'M1-N1', 'zona1', 'mesas'), 'M1', true);
  api.generarPlano('mixta-ambos', vip);
  const lugares = api.butacas.filter((b) => b.grupo && b.grupo.id === 'M1');
  assert.deepEqual(lugares.map((b) => b.zona), ['zona1', 'mesas', 'mesas', 'mesas']);
  assert.equal(lugares.reduce((s, b) => s + api.zonas[b.zona].precio, 0), 90000 + 3 * 50000);
  // Una zona asignada que ya no existe se ignora.
  api.generarPlano('mixta-ambos', { ...vip, zonasDeAsiento: { 'M1-N2': 'fantasma' } });
  assert.equal(api.butacas.find((b) => b.id === 'M1-N2').zona, 'mesas');
});

test('una zona asignada a asientos esta en uso y no se elimina', () => {
  const api = cargar();
  const pintado = api.asignarZonaAsiento(conVip(api), 'luneta-A3', 'zona1', 'luneta');
  assert.match(api.eliminarZona(pintado, 'zona1').motivo, /VIP está en uso \(1 banda o pieza\)/);
  const limpio = api.asignarZonaAsiento(pintado, 'luneta-A3', 'luneta', 'luneta');
  assert.equal(api.eliminarZona(limpio, 'zona1').zonas.some((z) => z.id === 'zona1'), false);
});

test('duplicar copia las zonas de los asientos, y el mapa las guarda y valida', () => {
  const api = cargar();
  const pintado = api.asignarZonaAsiento(conVip(api), 'M1-N1', 'zona1', 'mesas');
  const sala = api.generarPlano('mixta-ambos', pintado);
  // La copia de M1 es M7: su lugar N1 tambien es VIP.
  assert.deepEqual(api.duplicarPieza(pintado, sala, 'M1').zonasDeAsiento, { 'M1-N1': 'zona1', 'M7-N1': 'zona1' });
  // Duplicar una banda tambien: la copia de la Luneta es banda1, y su A3 es VIP.
  const conFila = api.asignarZonaAsiento(pintado, 'luneta-A3', 'zona1', 'luneta');
  const salaFila = api.generarPlano('mixta-ambos', conFila);
  assert.equal(api.duplicarBanda(conFila, salaFila, 'luneta').zonasDeAsiento['banda1-A3'], 'zona1');
  api.generarPlano('mixta-ambos', pintado);
  const extraido = api.planoDesdeSala('mixta-ambos', sala);
  assert.deepEqual(extraido.zonasDeAsiento, { 'M1-N1': 'zona1' });
  const mapa = JSON.parse(JSON.stringify(api.mapaDesdePlano('Con VIP', extraido, null)));
  const { mapa: leido, errores } = api.validarMapa(mapa);
  assert.equal(errores, undefined);
  assert.deepEqual(leido.zonasDeAsiento, { 'M1-N1': 'zona1' });
  api.generarPlano(api.registrarMapa(leido));
  assert.equal(api.butacas.find((b) => b.id === 'M1-N1').zona, 'zona1');
  const con = (cambio) => { const m = JSON.parse(JSON.stringify(mapa)); cambio(m); return api.validarMapa(m).errores || []; };
  assert.ok(con((m) => { m.zonasDeAsiento['M1-N2'] = 'vip'; }).includes('asiento M1-N2: zona desconocida'));
  assert.ok(con((m) => { m.zonasDeAsiento = ['x']; }).includes('las zonas de los asientos no son válidas'));
  // Sin el campo (mapas anteriores), ningun asiento cambia de zona.
  assert.deepEqual(api.validarMapa({ ...mapa, zonasDeAsiento: undefined }).mapa.zonasDeAsiento, {});
  // Las asignaciones de asientos que ya no existen se limpian al guardar.
  const idsExistentes = new Set(['M1-N2']);
  assert.deepEqual(api.mapaDesdePlano('Con VIP', extraido, null, idsExistentes).zonasDeAsiento, {});
});

// --- Herencia de zona por banda -----------------------------------------------------

test('las mesas heredan la zona de su banda, y la suya manda sobre ella', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  // Sin zona propia, los lugares de una mesa cuestan lo que su banda: la zona de mesas.
  api.generarPlano('mixta-ambos', plano);
  assert.equal('zona' in plano.mesas[0], false);
  assert.equal(api.butacas.find((b) => b.id === 'M1-N1').zona, 'mesas');
  // La banda pasa a Luneta y sus mesas con ella, sin tocar ninguna mesa.
  const deLuneta = api.cambiarZonaBanda(plano, 'mesas', 'luneta');
  api.generarPlano('mixta-ambos', deLuneta);
  assert.deepEqual(api.mesas.map((m) => m.zonaEfectiva), api.mesas.map(() => 'luneta'));
  assert.equal(api.zonas[api.butacas.find((b) => b.id === 'M1-N1').zona].precio, 35000);
  // Una mesa con zona propia no hereda: se queda en la suya.
  const propia = { ...deLuneta, mesas: deLuneta.mesas.map((m) => (m.id === 'M1' ? { ...m, zona: 'general' } : m)) };
  api.generarPlano('mixta-ambos', propia);
  assert.equal(api.butacas.find((b) => b.id === 'M1-N1').zona, 'general');
  assert.equal(api.butacas.find((b) => b.id === 'M2-N1').zona, 'luneta');
  // Y la zona pintada en un lugar manda sobre la de su mesa.
  api.generarPlano('mixta-ambos', api.asignarZonaAsiento(propia, 'M1-N1', 'luneta', 'general'));
  assert.equal(api.butacas.find((b) => b.id === 'M1-N1').zona, 'luneta');
});

test('un bloque y una butaca suelta sin zona heredan la de la banda donde caen', () => {
  const api = cargar();
  const { plano } = conZonaAbajo(api);   // zona de mesas al final, filas 20 a 23
  const sinZona = { ...plano,
    bloquesFilas: [{ id: 'F1', tipo: 'filas', x: 1, y: 20, ancho: 3, filas: 2, giro: 0 }],
    butacasSueltas: [{ id: 'B1', tipo: 'butaca', x: 8, y: 20, giro: 0 }] };
  api.generarPlano('mixta-ambos', sinZona);
  assert.deepEqual([api.butacas.find((b) => b.id === 'F1-1-1').zona, api.butacas.find((b) => b.id === 'B1').zona],
    ['mesas', 'mesas']);
  // Con zona propia, la suya; y planoDesdeSala solo guarda la propia.
  const conPropia = { ...sinZona,
    bloquesFilas: [{ ...sinZona.bloquesFilas[0], zona: 'general' }],
    butacasSueltas: [{ ...sinZona.butacasSueltas[0], zona: 'luneta' }] };
  const sala = api.generarPlano('mixta-ambos', conPropia);
  assert.deepEqual([api.butacas.find((b) => b.id === 'F1-1-1').zona, api.butacas.find((b) => b.id === 'B1').zona],
    ['general', 'luneta']);
  const extraido = api.planoDesdeSala('mixta-ambos', sala);
  assert.deepEqual([extraido.bloquesFilas[0].zona, extraido.butacasSueltas[0].zona], ['general', 'luneta']);
  assert.equal('zona' in api.planoDesdeSala('mixta-ambos', api.generarPlano('mixta-ambos', sinZona)).bloquesFilas[0], false);
});

test('zonaEnCelda da la zona de la banda mas interna, o null si ninguna la tiene', () => {
  const api = cargar();
  const { sala } = conFranja(api, (plano) => api.cambiarZonaBanda(plano, 'banda4', 'luneta'));
  // La franja ocupa las filas 20 a 23: banda3 (zona de mesas) a la izquierda, banda5
  // (filas de General, 2 de alto) a la derecha, con el resto de su vertical debajo.
  assert.equal(api.zonaEnCelda(sala, 1, 20), 'mesas');     // la banda de dentro manda
  assert.equal(api.zonaEnCelda(sala, 9, 20), 'general');
  assert.equal(api.zonaEnCelda(sala, 9, 22), 'luneta');    // bajo banda5: la vertical
  // Un lienzo nace con espacios sin zona: ahi no hay nada que heredar.
  const lienzo = conLienzo(api).sala;
  assert.equal(api.zonaEnCelda(lienzo, 1, 1), null);
});

test('el editor no deja una pieza fuera de toda zona: fijarZonasSueltas le escribe la suya', () => {
  const api = cargar();
  const { plano } = conLienzo(api);
  const conMesa = { ...plano, mesas: [{ id: 'M1', x: 1, y: 1, largo: 2, cabeceras: false, unLado: false, giro: 0 }],
                    siguiente: 2 };
  const sala = api.generarPlano('mapa-en-blanco', conMesa);
  const { plano: fijado, fijadas, zona } = api.fijarZonasSueltas(conMesa, sala);
  assert.deepEqual([fijadas, zona, fijado.mesas[0].zona], [['M1'], 'general', 'general']);
  assert.equal(conMesa.mesas[0].zona, undefined);   // no toca el plano de entrada
  // Con zona en el espacio hay de quien heredar, y ya no se le escribe ninguna.
  const conZona = api.cambiarZonaBanda(conMesa, 'espacio', 'luneta');
  const salaConZona = api.generarPlano('mapa-en-blanco', conZona);
  assert.deepEqual(api.fijarZonasSueltas(conZona, salaConZona).fijadas, []);
  assert.equal(api.butacas.find((b) => b.id === 'M1-N1').zona, 'luneta');
});

test('una zona que solo usa una mesa esta en uso; la que solo se hereda, no', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  const vip = api.editarZona(api.agregarZona(plano), 'zona1', { nombre: 'VIP', precio: 90000 });
  assert.equal(api.usosDeZona(vip, 'zona1'), 0);
  const conMesaVip = { ...vip, mesas: vip.mesas.map((m) => (m.id === 'M1' ? { ...m, zona: 'zona1' } : m)) };
  assert.equal(api.usosDeZona(conMesaVip, 'zona1'), 1);
  assert.match(api.eliminarZona(conMesaVip, 'zona1').motivo, /VIP está en uso/);
  // La zona de mesas la sujeta su banda, aunque ninguna mesa la lleve escrita.
  assert.ok(api.usosDeZona(plano, 'mesas') > 0);
});

test('mapas version 4: la zona de una mesa y la de una banda de mesas son opcionales', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  const nuevo = { ...api.cambiarZonaBanda(plano, 'mesas', 'luneta'),
                  mesas: plano.mesas.map((m) => (m.id === 'M1' ? { ...m, zona: 'general' } : m)) };
  const mapa = JSON.parse(JSON.stringify(api.mapaDesdePlano('Herencia', nuevo, null)));
  assert.deepEqual([mapa.version, mapa.mesas[0].zona, mapa.mesas[1].zona, mapa.bandas[2].zona],
    [4, 'general', undefined, 'luneta']);
  const { mapa: leido, errores } = api.validarMapa(mapa);
  assert.equal(errores, undefined);
  api.generarPlano(api.registrarMapa(leido));
  assert.deepEqual([api.butacas.find((b) => b.id === 'M1-N1').zona, api.butacas.find((b) => b.id === 'M2-N1').zona],
    ['general', 'luneta']);
  const con = (cambio) => { const m = JSON.parse(JSON.stringify(mapa)); cambio(m); return api.validarMapa(m).errores || []; };
  assert.ok(con((m) => { m.mesas[1].zona = 'vip'; }).includes('M2: zona desconocida'));
  assert.ok(con((m) => { m.bandas[2].zona = 'vip'; }).includes('banda 3: zona desconocida'));
  // Un mapa de la version 3: sus mesas no traian zona y pasan a heredar la de su banda.
  const viejo = { ...JSON.parse(JSON.stringify(api.mapaDesdePlano('Viejo', plano, null))), version: 3 };
  const leidoViejo = api.validarMapa(viejo).mapa;
  assert.equal(leidoViejo.version, 4);
  api.generarPlano(api.registrarMapa(leidoViejo));
  assert.equal(api.butacas.find((b) => b.id === 'M1-N1').zona, 'mesas');
});

// --- Un solo panel: la banda lleva su zona y su precio -------------------------------

test('una banda tiene su zona para ella sola hasta que otra banda o pieza la usa', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  assert.equal(api.zonaExclusivaDeBanda(plano, 'luneta'), 'luneta');
  assert.equal(api.zonaExclusivaDeBanda(plano, 'mesas'), 'mesas');   // la zona de mesas, tambien
  // Otra banda con la misma zona: ya no es de nadie en exclusiva.
  const compartida = api.cambiarZonaBanda(plano, 'general', 'luneta');
  assert.equal(api.zonaExclusivaDeBanda(compartida, 'luneta'), null);
  // Una pieza con esa zona propia cuenta igual.
  const conPieza = { ...plano, bloquesFilas: [bloque('F1', 1, 20, { zona: 'luneta' })] };
  assert.equal(api.zonaExclusivaDeBanda(conPieza, 'luneta'), null);
  // Una banda sin zona (un espacio) no tiene ninguna.
  const { plano: lienzo } = conLienzo(api);
  assert.equal(api.zonaExclusivaDeBanda(lienzo, 'espacio'), null);
});

test('zonaNuevaParaBanda le da a la banda una zona propia con su nombre', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  const compartida = api.cambiarZonaBanda(plano, 'general', 'luneta');
  const propia = api.zonaNuevaParaBanda(compartida, 'general', 'Luneta');
  // El nombre choca con el de la zona Luneta, asi que se numera.
  assert.deepEqual([propia.zonas.at(-1), propia.siguienteZona], [{ id: 'zona1', nombre: 'Luneta 2', precio: 0 }, 2]);
  const sala = api.generarPlano('mixta-ambos', propia);
  assert.equal(sala.bandas.at(-1).nombre, 'Luneta 2');
  assert.equal(api.butacas.find((b) => b.id === 'general-A1').zona, 'zona1');
  assert.equal(api.zonaExclusivaDeBanda(propia, 'general'), 'zona1');
  // El nombre puesto a mano se va: ahora el nombre vive en la zona.
  const conNombre = api.renombrarBanda(compartida, 'general', 'Balcón');
  assert.equal('nombre' in api.zonaNuevaParaBanda(conNombre, 'general', 'Balcón').bandas.at(-1), false);
  assert.deepEqual(api.zonaNuevaParaBanda(plano, 'fantasma', 'X'), { motivo: 'esa banda ya no existe' });
  let lleno = plano;
  for (let i = 0; i < 17; i++) lleno = api.agregarZona(lleno);
  assert.deepEqual(api.zonaNuevaParaBanda(lleno, 'general', 'X'), { motivo: 'ya hay el máximo de zonas (20)' });
});

test('una banda que no es de filas se puede quedar sin zona', () => {
  const api = cargar();
  const { plano } = conLienzo(api);
  const conZona = api.cambiarZonaBanda(plano, 'espacio', 'luneta');
  assert.equal(conZona.bandas[0].zona, 'luneta');
  assert.equal('zona' in api.cambiarZonaBanda(conZona, 'espacio', ''), false);
  const { plano: mixta } = planoDe(api, 'mixta-ambos');
  assert.deepEqual(api.cambiarZonaBanda(mixta, 'luneta', ''), { motivo: 'una banda de filas necesita una zona' });
  assert.deepEqual(api.cambiarZonaBanda(mixta, 'luneta', 'fantasma'), { motivo: 'esa zona ya no existe' });
});

test('la venta por mesa se puede poner y quitar en toda una zona de mesas', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  const sala = api.generarPlano('mixta-ambos', plano);
  // Las seis mesas de la plantilla estan en la banda de mesas; la Luneta no tiene ninguna.
  assert.deepEqual(api.mesasDeBanda(sala, 'mesas'), ['M1', 'M2', 'M3', 'M4', 'M5', 'M6']);
  assert.deepEqual(api.mesasDeBanda(sala, 'luneta'), []);
  const porMesa = api.marcarMesasDeBanda(plano, sala, 'mesas', true);
  assert.equal(porMesa.mesas.every((m) => m.completa), true);
  api.generarPlano('mixta-ambos', porMesa);
  assert.equal(api.butacas.find((b) => b.id === 'M1-N1').grupo.completa, true);
  // Con mesas en dos bandas, cada una va por su lado: la de abajo se queda por butacas.
  const { plano: dosBandas, sala: salaDos } = conZonaAbajo(api);
  const conMesaAbajo = { ...dosBandas, mesas: [...dosBandas.mesas, mesa('M7', 1, 20)], siguiente: 8 };
  const salaAbajo = api.generarPlano('mixta-ambos', conMesaAbajo);
  assert.deepEqual(api.mesasDeBanda(salaAbajo, 'banda1'), ['M7']);
  const arriba = api.marcarMesasDeBanda(conMesaAbajo, salaAbajo, 'mesas', true);
  assert.deepEqual(arriba.mesas.filter((m) => m.completa).map((m) => m.id), ['M1', 'M2', 'M3', 'M4', 'M5', 'M6']);
  const abajo = api.marcarMesasDeBanda(arriba, salaAbajo, 'banda1', true);
  assert.equal(abajo.mesas.every((m) => m.completa), true);
  assert.deepEqual(api.marcarMesasDeBanda(abajo, salaAbajo, 'mesas', false).mesas.filter((m) => m.completa).map((m) => m.id), ['M7']);
  void salaDos;
  const porButacas = api.marcarMesasDeBanda(porMesa, sala, 'mesas', false);
  assert.equal(porButacas.mesas.some((m) => m.completa), false);
  assert.equal(plano.mesas.some((m) => m.completa), false);   // no toca el plano de entrada
  assert.deepEqual(api.marcarMesasDeBanda(plano, sala, 'luneta', true), { motivo: 'esa banda no tiene mesas' });
});

// --- Asignar zona y bloquear por area -----------------------------------------------

// El area de la Luneta de «ambos»: filas 2 a 4, columnas 1 a 15 (con dos pasillos).
const areaLuneta = { x1: 1, y1: 2, x2: 5, y2: 3 };

test('un area es un rectangulo de celdas con las esquinas en cualquier orden', () => {
  const api = cargar();
  assert.deepEqual(api.areaDeCeldas({ x: 5, y: 9 }, { x: 2, y: 3 }), { x1: 2, y1: 3, x2: 5, y2: 9 });
  assert.deepEqual(api.areaDeCeldas({ x: 2, y: 3 }, { x: 2, y: 3 }), { x1: 2, y1: 3, x2: 2, y2: 3 });
  api.generarPlano('mixta-ambos');
  const dentro = api.butacasEnArea(api.butacas, areaLuneta).map((b) => b.id);
  // Dos filas de la Luneta, hasta la columna 5 (la 5 es pasillo, asi que son 4 butacas).
  assert.deepEqual(dentro, ['luneta-A1', 'luneta-A2', 'luneta-A3', 'luneta-A4',
                            'luneta-B1', 'luneta-B2', 'luneta-B3', 'luneta-B4']);
});

test('asignarZonaEnArea pinta las butacas libres del area y deja las ocupadas', () => {
  const api = cargar();
  const vip = conVip(api);
  api.generarPlano('mixta-ambos', vip);
  const { plano, cambiadas, ocupadas } = api.asignarZonaEnArea(vip, api.butacas, areaLuneta, 'zona1');
  assert.equal(cambiadas.length, 8);
  assert.deepEqual(ocupadas, []);
  assert.equal(vip.zonasDeAsiento['luneta-A1'], undefined);   // no toca el plano de entrada
  api.generarPlano('mixta-ambos', plano);
  assert.equal(etiqueta(api, 'luneta-A1'), 'VIP A1');
  // Las ocupadas (B5 y B6 de la plantilla) no cambian, y se devuelven para avisar.
  const conOcupadas = api.asignarZonaEnArea(vip, api.butacas, { x1: 4, y1: 3, x2: 8, y2: 3 }, 'zona1');
  assert.deepEqual(conOcupadas.ocupadas, ['luneta-B5', 'luneta-B6']);
  assert.equal(conOcupadas.cambiadas.includes('luneta-B5'), false);
  // Sin zona, vuelven a la suya de siempre: el mapa se queda sin entradas.
  const vuelta = api.asignarZonaEnArea(plano, api.butacas, areaLuneta, '');
  assert.deepEqual([vuelta.cambiadas.length, vuelta.plano.zonasDeAsiento], [8, {}]);
  // Pintar lo que ya esta pintado no cuenta como cambio.
  api.generarPlano('mixta-ambos', plano);
  assert.deepEqual(api.asignarZonaEnArea(plano, api.butacas, areaLuneta, 'zona1').cambiadas, []);
});

test('pintar un area avisa de las mesas completas que quedan con dos zonas', () => {
  const api = cargar();
  const vip = api.marcarMesaCompleta(conVip(api), 'M1', true);
  const sala = api.generarPlano('mixta-ambos', vip);
  const mesa = api.mesas.find((m) => m.id === 'M1');
  // Media mesa: solo su fila de arriba entra en el area.
  const media = { x1: mesa.x, y1: mesa.y, x2: mesa.x + mesa.geo.ancho - 1, y2: mesa.y };
  assert.deepEqual(api.asignarZonaEnArea(vip, api.butacas, media, 'zona1').mesas, ['Mesa 1']);
  // Entera: todos sus lugares en la misma zona, nada que avisar.
  const entera = { x1: mesa.x, y1: mesa.y, x2: mesa.x + mesa.geo.ancho - 1, y2: mesa.y + mesa.geo.alto - 1 };
  assert.deepEqual(api.asignarZonaEnArea(vip, api.butacas, entera, 'zona1').mesas, []);
  void sala;
});

test('bloquearEnArea bloquea y desbloquea el area, sin tocar las ocupadas', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  api.generarPlano('mixta-ambos', plano);
  const { plano: bloqueado, cambiadas } = api.bloquearEnArea(plano, api.butacas, areaLuneta, true);
  assert.equal(cambiadas.length, 8);
  assert.equal(bloqueado.bloqueadas.filter((id) => id.startsWith('luneta-')).length, 8);
  api.generarPlano('mixta-ambos', bloqueado);
  assert.equal(api.butacas.find((b) => b.id === 'luneta-A1').estado, 'bloqueada');
  // Volver a bloquear lo ya bloqueado no cambia nada; desbloquear lo devuelve.
  assert.deepEqual(api.bloquearEnArea(bloqueado, api.butacas, areaLuneta, true).cambiadas, []);
  const libre = api.bloquearEnArea(bloqueado, api.butacas, areaLuneta, false);
  assert.deepEqual([libre.cambiadas.length, libre.plano.bloqueadas.filter((id) => id.startsWith('luneta-')).length],
    [8, 0]);
  // Una butaca ocupada no se bloquea.
  api.generarPlano('mixta-ambos', plano);
  const conOcupadas = api.bloquearEnArea(plano, api.butacas, { x1: 4, y1: 3, x2: 8, y2: 3 }, true);
  assert.deepEqual(conOcupadas.ocupadas, ['luneta-B5', 'luneta-B6']);
  assert.equal(conOcupadas.plano.bloqueadas.includes('luneta-B5'), false);
  assert.deepEqual(plano.bloqueadas.filter((id) => id.startsWith('luneta-')), []);   // no toca el de entrada
});

// --- Tiradores: redimensionar con el raton -------------------------------------------

test('cada espacio o zona de mesas tiene su tirador, y cada borde entre verticales el suyo', () => {
  const api = cargar();
  const sala = api.generarPlano('mixta-ambos');
  // En la sala solo hay una banda con alto propio: la zona de mesas, sin vertical.
  assert.deepEqual(api.tiradoresDeSala(sala),
    [{ tipo: 'esquina', banda: 'mesas', vertical: null, x: 15, y: 18 }]);

  const { sala: conFranjaSala } = conFranja(api);
  const tiradores = api.tiradoresDeSala(conFranjaSala);
  assert.deepEqual(tiradores.map((t) => [t.tipo, t.banda, t.vertical]), [
    ['esquina', 'mesas', null],      // la zona de mesas de la sala
    ['borde', null, 'banda2'],       // el borde entre las dos verticales
    ['esquina', 'banda3', 'banda2'], // dentro de la primera vertical: alto y ancho
    // banda5 son filas (no tiene alto propio) y su vertical es la ultima: sin tirador
  ]);
  // Un espacio dentro de la ULTIMA vertical no puede ensancharse: su ancho es el resto.
  const { sala: conEspacio } = conFranja(api, (p) => api.agregarBandaEnVertical(p, conFranjaSala, 'banda4', 'espacio'));
  const dentro = api.tiradoresDeSala(conEspacio).find((x) => x.banda === 'banda6');
  assert.deepEqual([dentro.tipo, dentro.vertical], ['esquina', null]);
  // El borde va donde acaba la primera vertical y cubre todo el alto de la franja.
  assert.deepEqual(tiradores[1], { tipo: 'borde', banda: null, vertical: 'banda2', x: 8, y: 20, alto: 4 });
});

test('el tirador cambia el alto de la banda y el ancho de su vertical de una vez', () => {
  const api = cargar();
  const { plano, sala } = conFranja(api);
  // Solo el alto.
  const masAlto = api.redimensionarConTirador(plano, sala, { banda: 'banda3', vertical: null, alto: 7 });
  const salaAlta = api.generarPlano('mixta-ambos', masAlto);
  assert.equal(api.ubicar(salaAlta.bandas, 'banda3').item.alto, 7);
  // Alto y ancho en el mismo gesto: la ultima vertical absorbe el resto.
  const ambos = api.redimensionarConTirador(plano, sala, { banda: 'banda3', vertical: 'banda2', alto: 6, ancho: 10 });
  const salaAmbos = api.generarPlano('mixta-ambos', ambos);
  const franja = api.ubicar(salaAmbos.bandas, 'banda1').item;
  assert.deepEqual([franja.verticales[0].anchoOcupado, franja.verticales[1].anchoOcupado], [10, 4]);
  assert.equal(api.ubicar(salaAmbos.bandas, 'banda3').item.alto, 6);
  assert.equal(plano.bandas.at(-1).verticales[0].ancho, 7);   // no toca el plano de entrada
});

test('el tirador respeta los topes: alto de 1 a 40 y una columna para la ultima vertical', () => {
  const api = cargar();
  const { plano, sala } = conFranja(api);
  assert.deepEqual(api.redimensionarConTirador(plano, sala, { banda: 'banda3', alto: 0 }), { motivo: 'ya tiene el mínimo' });
  assert.deepEqual(api.redimensionarConTirador(plano, sala, { banda: 'banda3', alto: 41 }), { motivo: 'ya tiene el máximo (40)' });
  assert.deepEqual(api.redimensionarConTirador(plano, sala, { banda: 'banda5', alto: 3 }),
    { motivo: 'esa banda no tiene un alto propio' });   // es de filas: su alto son sus filas
  assert.deepEqual(api.redimensionarConTirador(plano, sala, { vertical: 'banda2', ancho: 14 }),
    { motivo: 'la última banda vertical se quedaría sin ancho' });
  assert.equal(api.redimensionarConTirador(plano, sala, { vertical: 'banda2', ancho: 13 }).motivo, undefined);
  assert.deepEqual(api.redimensionarConTirador(plano, sala, { vertical: 'banda4', ancho: 3 }),
    { motivo: 'la última banda vertical ocupa el resto; cambia el ancho de las demás' });
});

test('al redimensionar con el tirador, las piezas de dentro viajan con su banda', () => {
  const api = cargar();
  // Una mesa en la zona de mesas de la sala (filas 5 a 17) y otra debajo, en la franja.
  const { plano, sala } = conFranja(api, (p) => ({ ...p, mesas: [...p.mesas, mesa('M7', 1, 20)], siguiente: 8 }));
  const masAlta = api.redimensionarConTirador(plano, sala, { banda: 'mesas', alto: 15 });
  const nueva = api.generarPlano('mixta-ambos', masAlta);
  // La zona de mesas crece 2 filas: la franja baja 2 y su mesa con ella.
  assert.equal(nueva.bandas.at(-1).y, 22);
  assert.equal(masAlta.mesas.find((m) => m.id === 'M7').y, 22);
});

// --- Varias piezas a la vez ---------------------------------------------------------

test('el marco atrapa la pieza que tiene la mitad o mas de su huella dentro', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  api.generarPlano('mixta-ambos', plano);
  // M1 es una mesa de 2 × 3 en la columna 2, fila 7.
  const m1 = api.mesas.find((m) => m.id === 'M1');
  assert.deepEqual([m1.x, m1.y, m1.geo.ancho, m1.geo.alto], [2, 7, 2, 3]);
  const marco = (x1, y1, x2, y2) => api.piezasEnMarco(api.mesas, { x1, y1, x2, y2 });
  // Entera dentro, y justo la mitad (una de sus dos columnas): entra.
  assert.deepEqual(marco(1, 6, 4, 10), ['M1']);
  assert.deepEqual(marco(1, 7, 2, 9), ['M1']);
  // Dos columnas por una fila de tres es un tercio: se queda fuera.
  assert.deepEqual(marco(2, 7, 3, 7), []);
  // Dos de las tres filas pasan; una sola, no.
  assert.deepEqual(marco(2, 7, 3, 8), ['M1']);
  assert.deepEqual(marco(1, 9, 2, 9), []);
  // Sin tocarla, nada.
  assert.deepEqual(marco(20, 20, 25, 25), []);
  assert.deepEqual(api.cajaDePiezas([m1]), { x: 2, y: 7, ancho: 2, alto: 3 });
});

test('mover varias piezas es todo o nada', () => {
  const api = cargar();
  const { plano } = planoDe(api, 'mixta-ambos');
  const sala = api.generarPlano('mixta-ambos', plano);
  const movido = api.moverPiezas(plano, sala, ['M1', 'M4'], 1, 0);
  assert.deepEqual(movido.mesas.filter((m) => ['M1', 'M4'].includes(m.id)).map((m) => m.x), [3, 3]);
  assert.deepEqual(plano.mesas.find((m) => m.id === 'M1').x, 2);   // no toca el plano de entrada
  // Si una sola no cabe, no se mueve ninguna y se dice cual.
  const fuera = api.moverPiezas(plano, sala, ['M1', 'M4'], -2, 0);
  assert.deepEqual(fuera, { motivo: 'Mesa 1 se sale de la sala' });
  // Las celdas del grupo no se estorban entre ellas: en un lienzo con dos mesas pegadas,
  // la primera cae donde estaba la segunda porque las dos se mueven a la vez.
  const pegadas = conLienzo(api, (p) => ({ ...p,
    mesas: [{ id: 'M1', x: 1, y: 1, largo: 2, cabeceras: false, unLado: false, giro: 0 },
            { id: 'M2', x: 3, y: 1, largo: 2, cabeceras: false, unLado: false, giro: 0 }], siguiente: 3 }));
  const juntas = api.moverPiezas(pegadas.plano, pegadas.sala, ['M1', 'M2'], 2, 0);
  assert.deepEqual(juntas.mesas.map((m) => m.x), [3, 5]);
  assert.deepEqual(api.moverPiezas(plano, sala, ['escenario'], 0, 1), { motivo: 'el escenario se mueve por su cuenta' });
});

test('duplicar varias conserva las distancias y da ids nuevos a todas', () => {
  const api = cargar();
  // En una sala con sitio: el mapa en blanco, con dos mesas juntas.
  const { plano, sala } = conLienzo(api, (p) => ({ ...p,
    mesas: [{ id: 'M1', x: 1, y: 1, largo: 2, cabeceras: false, unLado: false, giro: 0 },
            { id: 'M2', x: 6, y: 1, largo: 2, cabeceras: false, unLado: false, giro: 0 }], siguiente: 3 }));
  const resultado = api.duplicarPiezas(plano, sala, ['M1', 'M2']);
  assert.deepEqual(resultado.ids, ['M3', 'M4']);
  const copias = resultado.plano.mesas.filter((m) => ['M3', 'M4'].includes(m.id));
  // El grupo se copia a la derecha de su caja (7 columnas de ancho): la distancia entre
  // las dos copias es la misma que entre las originales.
  assert.deepEqual(copias.map((m) => [m.x, m.y]), [[8, 1], [13, 1]]);
  assert.equal(plano.mesas.length, 2);   // no toca el plano de entrada
  // Sin sitio a la derecha ni debajo, no se duplica nada: una pista de 19 × 6 en un
  // lienzo de 20 × 10 no cabe ni al lado ni abajo.
  const lleno = { ...plano, mesas: [],
    formas: [{ id: 'P1', tipo: 'forma', forma: 'pista', x: 1, y: 1, ancho: 19, alto: 6 }], siguienteForma: 2 };
  const salaLlena = api.generarPlano('mapa-en-blanco', lleno);
  assert.deepEqual(api.duplicarPiezas(lleno, salaLlena, ['P1']), { motivo: 'no hay sitio libre para las copias' });
});

test('duplicar y eliminar varias copian y quitan tambien sus bloqueadas y zonas', () => {
  const api = cargar();
  const { plano, sala } = conLienzo(api, (p) => ({ ...p,
    mesas: [{ id: 'M1', x: 1, y: 1, largo: 2, cabeceras: false, unLado: false, giro: 0 }],
    bloquesFilas: [bloque('F1', 6, 1, { zona: 'general' })],
    bloqueadas: ['M1-N1'], zonasDeAsiento: { 'F1-1-1': 'luneta' }, siguiente: 2, siguienteBloque: 2 }));
  const resultado = api.duplicarPiezas(plano, sala, ['M1', 'F1']);
  assert.deepEqual(resultado.ids, ['M2', 'F2']);
  assert.ok(resultado.plano.bloqueadas.includes('M2-N1'));
  assert.equal(resultado.plano.zonasDeAsiento['F2-1-1'], 'luneta');
  // Eliminar varias las quita de sus listas y deja el resto igual.
  const sinEllas = api.eliminarPiezas(resultado.plano, ['M1', 'F2']);
  assert.deepEqual(sinEllas.mesas.map((m) => m.id), ['M2']);
  assert.deepEqual(sinEllas.bloquesFilas.map((b) => b.id), ['F1']);
  assert.equal(plano.mesas.length, 1);   // no toca el plano de entrada
});
