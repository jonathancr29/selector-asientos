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
  '\nreturn { ANCHO_SALA, MESA, rejillaDeSala, repartirMesas, generarPlano, butacas, muebles, mesas,' +
  ' conciliarSeleccion, celdasOcupadas, motivoNoCabe, buscarHueco };')();

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
    const sala = generarPlano(pasillos);
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
  generarPlano('ninguno');
  const libres = new Set(butacas.filter((b) => b.estado === 'libre').map((b) => b.id));
  const elegidas = new Set(['A1', 'A13', 'A14', 'H11', 'H12', 'M1-1']);
  for (const id of elegidas) assert.ok(libres.has(id), id + ' deberia estar libre en «ninguno»');

  generarPlano('ambos');
  const { ausentes, noLibres } = conciliarSeleccion(elegidas, butacas);
  assert.deepEqual(ausentes, ['A13', 'A14']);
  assert.deepEqual(noLibres, ['H11', 'H12']);
  assert.deepEqual([...elegidas], ['A1', 'M1-1']);
});

// --- Editor de mesas ---------------------------------------------------------

test('las posiciones automaticas son validas en todas las disposiciones', () => {
  const { generarPlano, mesas, celdasOcupadas, motivoNoCabe } = cargar();
  for (const pasillos of DISPOSICIONES) {
    const sala = generarPlano(pasillos);
    assert.equal(mesas.length, 6, pasillos);
    for (const m of mesas) {
      assert.equal(motivoNoCabe(sala, celdasOcupadas(m.id), m.x, m.y), null, `${pasillos}, ${m.id}`);
    }
  }
});

test('una mesa ocupa 6 celdas: 4 lugares alrededor y la mesa en las 2 de en medio', () => {
  const { generarPlano, butacas, muebles, mesas } = cargar();
  generarPlano('ninguno', { M1: { x: 5, y: 8 } });
  const m1 = mesas.find((m) => m.id === 'M1');
  assert.deepEqual([m1.x, m1.y], [5, 8]);
  const lugares = butacas.filter((b) => b.grupo?.id === 'M1').map((b) => [b.id, b.x, b.y]);
  assert.deepEqual(lugares, [['M1-1', 5, 8], ['M1-2', 6, 8], ['M1-3', 5, 10], ['M1-4', 6, 10]]);
  const tablero = muebles.find((x) => x.tipo === 'mesa' && x.mesa === 'M1');
  assert.deepEqual([tablero.x, tablero.y, tablero.w, tablero.h], [5, 9, 2, 1]);
});

test('motivoNoCabe: pasillo, choque, fuera de la sala y sitio valido', () => {
  const { generarPlano, mesas, celdasOcupadas, motivoNoCabe } = cargar();
  // «ambos»: pasillos en las columnas 5 y 10; mesas en las columnas 2, 7 y 12, filas 7 y 11.
  const sala = generarPlano('ambos');
  assert.deepEqual(mesas.map((m) => [m.id, m.x, m.y]),
    [['M1', 2, 7], ['M4', 2, 11], ['M2', 7, 7], ['M5', 7, 11], ['M3', 12, 7], ['M6', 12, 11]]);

  const sinM1 = celdasOcupadas('M1');
  assert.equal(motivoNoCabe(sala, sinM1, 4, 7), 'cae sobre un pasillo');   // columnas 4 y 5
  assert.equal(motivoNoCabe(sala, sinM1, 1, 3), 'choca con la fila B');
  assert.equal(motivoNoCabe(sala, sinM1, 7, 7), 'choca con Mesa 2');
  assert.equal(motivoNoCabe(sala, sinM1, 3, 12), 'choca con Mesa 4');
  assert.equal(motivoNoCabe(sala, sinM1, 0, 7), 'se sale de la sala');
  assert.equal(motivoNoCabe(sala, sinM1, 14, 7), 'se sale de la sala');   // la segunda columna seria la 15
  assert.equal(motivoNoCabe(sala, sinM1, 1, 5), null);
  assert.equal(motivoNoCabe(sala, sinM1, 2, 7), null);                    // su propio sitio no le estorba

  const sinM4 = celdasOcupadas('M4');
  assert.equal(motivoNoCabe(sala, sinM4, 2, 12), null);                   // filas 12 a 14, justo antes de G
  assert.equal(motivoNoCabe(sala, sinM4, 2, 13), 'choca con la fila G');
});

test('buscarHueco salta pasillos, no atraviesa filas y se detiene en el borde', () => {
  const { generarPlano, mesas, celdasOcupadas, buscarHueco } = cargar();
  // «izquierda»: pasillo en la columna 5; mesas en las columnas 2, 8 y 11.
  const sala = generarPlano('izquierda');
  assert.deepEqual(mesas.filter((m) => m.y === 7).map((m) => m.x), [2, 8, 11]);
  const sinM1 = celdasOcupadas('M1');

  assert.deepEqual(buscarHueco(sala, sinM1, 2, 7, 1, 0), { x: 3, y: 7 });
  // Desde la columna 3: la 4 y la 5 caen en el pasillo; salta a la 6.
  assert.deepEqual(buscarHueco(sala, sinM1, 3, 7, 1, 0), { x: 6, y: 7 });
  assert.deepEqual(buscarHueco(sala, sinM1, 2, 7, 0, 1), { x: 2, y: 8 });
  // Desde la fila 8 hacia abajo solo quedan Mesa 4 y las filas G y H: no hay hueco.
  assert.equal(buscarHueco(sala, sinM1, 2, 8, 0, 1), null);
  // Hacia arriba desde la fila 5 estan las filas A a C.
  assert.equal(buscarHueco(sala, sinM1, 2, 5, 0, -1), null);
  assert.equal(buscarHueco(sala, sinM1, 1, 7, -1, 0), null);
});
