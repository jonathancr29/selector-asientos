// Medicion del motor y los grupos, sin DOM ni red. No fija umbrales de CI.
// Uso: node medir-conector.mjs [referencia-git]
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const base = new URL('.', import.meta.url);
const referencia = process.argv[2];
const leer = archivo => referencia ? execFileSync('git', ['show', referencia + ':' + archivo],
  { cwd: fileURLToPath(base), encoding: 'utf8', windowsHide: true }) : readFileSync(new URL(archivo, base), 'utf8');
// Leer la entrega permite medir tambien referencias Git anteriores a separar el modelo.
const html = leer('index.html');
let fuente = html.slice(html.indexOf('<script>') + '<script>'.length).split('// === Fin de la parte sin DOM')[0];
const cuentas = { generaciones: 0, visitasMesas: 0, visitasIndice: 0, consultasMesa: 0, consultasButaca: 0 };
const instrumentar = (texto, de, por, obligatoria = false) => {
  const n = texto.split(de).length - 1;
  if (n > 1 || (obligatoria && n !== 1)) throw new Error('Instrumentacion ambigua o ausente: ' + de);
  return texto.replace(de, () => por);
};
for (const [de,por,obligatoria] of [
  ['function generarPlano(tipo, plano = null) {','function generarPlano(tipo, plano = null) { cuentas.generaciones++;',true],
  ['b => b.grupo && b.grupo.id === mesa.id','b => (cuentas.visitasMesas++, b.grupo && b.grupo.id === mesa.id)'],
  ['(b) => b.grupo && b.grupo.id === mesa.id','(b) => (cuentas.visitasMesas++, b.grupo && b.grupo.id === mesa.id)'],
  ['const lugaresDeMesa = (id, lista) => lista.filter((b) => b.grupo && b.grupo.id === id);',
    'const lugaresDeMesa = (id, lista) => lista.filter((b) => (cuentas.visitasMesas++, b.grupo && b.grupo.id === id));'],
  ['function agruparLugaresPorGrupo(lista) {','function agruparLugaresPorGrupo(lista) { cuentas.visitasIndice+=lista.length;'],
]) fuente = instrumentar(fuente,de,por,obligatoria);
const nombres = [...fuente.matchAll(/^(?:function\s+|(?:const|let)\s+)([A-Za-z_$][A-Za-z0-9_$]*)/gm)].map(m => m[1]);
const a = new Function('cuentas', fuente + '\nreturn {' + nombres.join(',') + '};')(cuentas);
const medir = calcular => {
  const tiempos = [];
  for (let i = 0; i < 5; i++) { const inicio = performance.now(); calcular(); tiempos.push(performance.now() - inicio); }
  tiempos.sort((x,y) => x-y); return Math.round(tiempos[2] * 10) / 10;
};
for (const caso of ['filas', 'mesas']) {
  const raw = { formato: a.FORMATO_MAPA, version: 4, nombre: 'Medicion ' + caso,
    distribucion: { bloques: [60,60,60,60], pasillos: [3,3,3] }, escenario: null,
    bandas: caso === 'filas' ? Array.from({length:3},(_,i)=>({id:'b'+i,tipo:'filas',zona:i===2?'general':'luneta',filas:26}))
      : Array.from({length:4},(_,i)=>({id:'b'+i,tipo:'espacio',alto:40,zona:'mesas'})),
    mesas: [], bloquesFilas: [], formas: [], butacasSueltas: [], bloqueadas: [], zonasDeAsiento: {} };
  if (caso === 'mesas') {
    const rejilla = a.rejillaDeBloques(raw.distribucion);
    const posiciones = rejilla.bloques.flatMap(b=>Array.from({length:12},(_,i)=>b[0]+i*5));
    raw.mesas = Array.from({length:300},(_,i)=>({id:'M'+(i+1),tipo:'redonda',lugares:8,giro:0,x:posiciones[i%48],y:Math.floor(i/48)*5}));
  }
  const publicada = a.publicarRevisionFisica(raw);
  if (publicada.errores) throw new Error(publicada.errores.join('; '));
  const mapa = publicada.mapa, catalogo = publicada.catalogo;
  const dato = { formato:'sintaquilla/evento-asientos',version:1,
    evento:{id:'evt_medicion',nombre:'Medicion',moneda:'MXN',versionEstado:1,revision:catalogo.revision},
    categorias:[{id:'cat_medicion',nombre:'Medicion',activa:true,precioCentavos:10000}],
    asignaciones:mapa.zonas.map(z=>({tipo:'zona',id:z.id,categoriaId:'cat_medicion'})),
    exclusiones:Object.fromEntries(['nivel','zona','sector','fila','grupo','lugar'].map(k=>[k,[]])),
    grupos:catalogo.grupos.map((g,i)=>({id:g.id,event_group_id:'eg_'+i,modalidad:'completa'})),
    lugares:catalogo.lugares.map((p,i)=>({local_place_id:p.local_place_id,event_place_id:'ep_'+i,estado:'libre'})) };
  const prepararMs = medir(()=>{const r=a.resolverEventoDeMapa(mapa,dato);if(r.errores)throw new Error(r.errores.join('; '));});
  const preparado = a.prepararRecintoEvento?.(mapa);
  if(preparado?.errores)throw new Error(preparado.errores.join('; '));
  const actualizar = () => {
    const r=preparado ? a.resolverEventoDeRecinto(preparado.recinto,dato) : a.resolverEventoDeMapa(mapa,dato);
    if(r.errores)throw new Error(r.errores.join('; ')); return r;
  };
  actualizar(); cuentas.generaciones=0;
  const actualizacionMs = medir(actualizar), generaciones = cuentas.generaciones / 5;
  let gruposMs = null;
  let tablerosMs = null;
  let visitasIndice = 0;
  if (caso === 'mesas') {
    const config = {...mapa,mesas:mapa.mesas.map(m=>({...m,completa:true}))};
    const ids = new Set(catalogo.grupos.map(g=>g.lugares[0]));
    cuentas.visitasMesas=0; cuentas.visitasIndice=0;
    gruposMs=medir(()=>{a.generarPlano(a.definicionDeMapa(config),config);a.completarMesasElegidas(new Set(ids),a.butacas);});
    visitasIndice=cuentas.visitasIndice/5;
    // Misma funcion del visor, sin medir creacion/pintura SVG ni estilos.
    let marcador = leer('src/dibujo.js').match(/function marcarTableroDeMesa\([^]*?\n\}/)[0];
    marcador = instrumentar(marcador,'mesas.find((m) => m.id === id)', 'mesas.find((m) => (cuentas.consultasMesa++,m.id === id))');
    marcador = instrumentar(marcador,'butacas.filter((b) => b.grupo && b.grupo.id === id && b.estado === \'libre\')',
      'butacas.filter((b) => (cuentas.consultasButaca++,b.grupo && b.grupo.id === id && b.estado === \'libre\'))');
    tablerosMs=medir(()=>{
      const mapaMesas=a.agruparLugaresPorGrupo ? new Map(a.mesas.map(m=>[m.id,m])) : null;
      const mapaLugares=a.agruparLugaresPorGrupo?.(a.butacas);
      const marcar=new Function('mesas','butacas','elegidas','mesasPorId','lugaresPorGrupo','cuentas',marcador+';return marcarTableroDeMesa;')
        (a.mesas,a.butacas,ids,mapaMesas,mapaLugares,cuentas);
      for(const m of a.mesas)marcar({classList:{add(){}}},m.id);
    });
  }
  console.log(JSON.stringify({referencia:referencia||'fuentes',node:process.version,caso,lugares:catalogo.lugares.length,grupos:catalogo.grupos.length,
    prepararMs,actualizacionMs,generacionesPorActualizacion:generaciones,regenerarCompletarMs:gruposMs,
    visitasMesasPorRegeneracion:cuentas.visitasMesas/5,visitasIndicePorRegeneracion:visitasIndice,
    marcarTablerosSinPinturaMs:tablerosMs,consultasMesaPorMarcado:cuentas.consultasMesa/5,consultasButacaPorMarcado:cuentas.consultasButaca/5}));
}
