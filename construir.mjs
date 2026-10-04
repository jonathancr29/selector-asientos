// Une las fuentes en el index.html autonomo. No requiere paquetes.
// Uso: node construir.mjs [--check]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const base = new URL('.', import.meta.url);
const leer = (nombre) => readFileSync(new URL(nombre, base), 'utf8');
const partes = [
  ['{{ESTILOS}}', 'src/estilos.css'],
  ['{{MODELO}}', 'src/modelo.js'],
  ['{{DIBUJO}}', 'src/dibujo.js'],
  ['{{INTERFAZ}}', 'src/interfaz.js'],
  ['{{EDITOR}}', 'src/editor.js'],
  ['{{PERSISTENCIA}}', 'src/persistencia.js'],
  ['{{CONECTOR}}', 'src/conector.js'],
];

let resultado = leer('src/plantilla.html');
for (const [marca, archivo] of partes) {
  if (resultado.split(marca).length !== 2) throw new Error('Marca ausente o repetida: ' + marca);
  resultado = resultado.replace(marca, () => leer(archivo));
}

// Misma aplicacion y mismos datos, con recursos externos para style/script-src self.
const script = partes.filter(([marca]) => marca !== '{{ESTILOS}}').map(([, archivo]) => leer(archivo)).join('\n');
const plantillaExterna = leer('src/plantilla.html').replace('<style>{{ESTILOS}}</style>', '<link rel="stylesheet" href="selector-asientos.css">');
const inicioScript = plantillaExterna.indexOf('<script>');
const finScript = plantillaExterna.indexOf('</script>', inicioScript);
if (inicioScript < 0 || finScript < inicioScript || plantillaExterna.includes('<style>')) throw new Error('Plantilla externa no compatible');
const externa = plantillaExterna.slice(0, inicioScript) + '<script src="selector-asientos.js" defer></script>' + plantillaExterna.slice(finScript + '</script>'.length);
const salidas = [['index.html', resultado], ['integracion/index.html', externa],
  ['integracion/selector-asientos.css', leer('src/estilos.css')], ['integracion/selector-asientos.js', script]];

if (process.argv[2] === '--check') {
  for (const [archivo, contenido] of salidas) if (leer(archivo) !== contenido) throw new Error(archivo + ' no coincide con las fuentes; ejecuta node construir.mjs');
} else if (process.argv.length === 2) {
  mkdirSync(new URL('integracion/', base), { recursive: true });
  for (const [archivo, contenido] of salidas) writeFileSync(new URL(archivo, base), contenido);
} else {
  throw new Error('Uso: node construir.mjs [--check]');
}
