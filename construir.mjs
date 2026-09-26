// Une las fuentes en el index.html autonomo. No requiere paquetes.
// Uso: node construir.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';

const base = new URL('.', import.meta.url);
const leer = (nombre) => readFileSync(new URL(nombre, base), 'utf8');
const partes = [
  ['{{ESTILOS}}', 'src/estilos.css'],
  ['{{MODELO}}', 'src/modelo.js'],
  ['{{DIBUJO}}', 'src/dibujo.js'],
  ['{{INTERFAZ}}', 'src/interfaz.js'],
  ['{{EDITOR}}', 'src/editor.js'],
  ['{{PERSISTENCIA}}', 'src/persistencia.js'],
];

let resultado = leer('src/plantilla.html');
for (const [marca, archivo] of partes) {
  if (resultado.split(marca).length !== 2) throw new Error('Marca ausente o repetida: ' + marca);
  resultado = resultado.replace(marca, () => leer(archivo));
}

if (process.argv[2] === '--check') {
  if (leer('index.html') !== resultado) {
    throw new Error('index.html no coincide con las fuentes; ejecuta node construir.mjs');
  }
} else if (process.argv.length === 2) {
  writeFileSync(new URL('index.html', base), resultado);
} else {
  throw new Error('Uso: node construir.mjs [--check]');
}
