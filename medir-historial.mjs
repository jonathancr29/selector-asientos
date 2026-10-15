// Texto retenido por el historial; no mide el heap del motor ni fija umbrales de CI.
// Uso: node medir-historial.mjs [referencia-git]
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const base = new URL('.', import.meta.url);
const referencia = process.argv[2];
const html = referencia ? execFileSync('git', ['show', referencia + ':index.html'],
  {cwd:fileURLToPath(base),encoding:'utf8',windowsHide:true}) : readFileSync(new URL('index.html',base),'utf8');
const fuente = html.slice(html.indexOf('<script>')+8,html.indexOf('// === Fin de la parte sin DOM'));
const nombres = [...fuente.matchAll(/^(?:function\s+|(?:const|let)\s+)([A-Za-z_$][A-Za-z0-9_$]*)/gm)].map(m=>m[1]);
const a = new Function(fuente+';return {'+nombres.join(',')+'};')();
for (const grande of [false,true]) {
  const dato = grande ? {formato:a.FORMATO_MAPA,version:4,nombre:'Medicion',
    distribucion:{bloques:[60,60,60,60],pasillos:[3,3,3]},escenario:null,
    bandas:Array.from({length:3},(_,i)=>({id:'b'+i,tipo:'filas',zona:'luneta',filas:26})),
    mesas:[],bloquesFilas:[],formas:[],butacasSueltas:[],bloqueadas:[],zonasDeAsiento:{}}
    : JSON.parse(readFileSync(new URL('docs/ejemplo-conector-evento.json',base),'utf8')).mapa;
  const validado = a.validarMapa(dato);
  assert.ok(!validado.errores,JSON.stringify(validado.errores));
  const mapa = validado.mapa;
  mapa.revisionFisica = {recintoId:'r-medicion',numero:1,estado:'borrador'};
  const lugares = Object.keys(mapa.identidadFisica).length;
  const foto = n => {const texto=JSON.stringify({...mapa,nombre:'Paso '+String(n).padStart(2,'0')});return {plano:texto,firma:texto};};
  const inicial = foto(0);
  const h = a.crearHistorial(inicial);
  let actual = inicial;
  for(let n=1;n<=60;n++){actual=foto(n);h.registrar(actual);}
  let estados = 0, bytes = inicial.firma.length * 2;
  do {estados++;bytes+=2*((actual.plano?.length||0)+actual.firma.length);}while((actual=h.deshacer()));
  if(h.medidas){assert.equal(h.medidas().bytes,bytes);assert.equal(h.medidas().estados,estados);}
  console.log(JSON.stringify({referencia:referencia||'fuentes',node:process.version,lugares,cambios:60,
    estadosRetenidos:estados,bytesTextoRetenido:bytes,MiB:Math.round(bytes/1024/1024*100)/100}));
}
