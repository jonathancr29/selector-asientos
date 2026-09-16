// Pruebas de la parte sin DOM de index.html: rejilla, reparto de mesas, datos
// del plano y conciliacion de la seleccion.
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
  '\nreturn { ANCHO_SALA, rejillaDeSala, repartirMesas, generarPlano, butacas, conciliarSeleccion };')();

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
