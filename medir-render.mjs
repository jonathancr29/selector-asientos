// Medicion local, no apta para bloquear CI porque depende del equipo.
// Uso: node medir-render.mjs [ruta-al-html]
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = process.env.CHROME_BIN || (process.platform === 'win32'
  ? ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
     'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(existsSync)
  : 'google-chrome');
if (!chrome) throw new Error('Instala Chrome o Edge, o fija CHROME_BIN');
const perfil = await mkdtemp(join(tmpdir(), 'selector-medicion-'));
const proceso = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--remote-debugging-port=0', `--user-data-dir=${perfil}`, 'about:blank'],
{ windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let puerto;
  for (let i = 0; i < 200; i++) {
    try { puerto = (await readFile(join(perfil, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await new Promise((r) => setTimeout(r, 50)); }
  }
  if (!puerto) throw new Error('Chrome no abrió el puerto de depuración');
  const url = new URL(process.argv[2] || './index.html', import.meta.url).href;
  const destino = await (await fetch(`http://127.0.0.1:${puerto}/json/new?${encodeURIComponent(url)}`,
    { method: 'PUT' })).json();
  socket = new WebSocket(destino.webSocketDebuggerUrl);
  await new Promise((r) => socket.addEventListener('open', r, { once: true }));
  let siguiente = 0;
  const pendientes = new Map();
  socket.addEventListener('message', ({ data }) => {
    const m = JSON.parse(data);
    if (!m.id) return;
    const p = pendientes.get(m.id);
    pendientes.delete(m.id);
    if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result);
  });
  const enviar = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++siguiente;
    pendientes.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluar = async (expression) => {
    const r = await enviar('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  await enviar('Runtime.enable');
  for (let i = 0; i < 200; i++) {
    if (await evaluar('document.readyState === "complete" && typeof dibujarTodo === "function"')) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  const resultado = await evaluar(`(() => {
    const distribucion = { bloques: [60, 60, 60, 60], pasillos: [3, 3, 3] };
    const mapa = {
      formato: FORMATO_MAPA, version: VERSION_MAPA, nombre: 'Arena', guardado: null, distribucion,
      bandas: [{ id: 'escenario', tipo: 'escenario' },
               { id: 'baja', tipo: 'filas', zona: 'luneta', filas: 39 },
               { id: 'alta', tipo: 'filas', zona: 'general', filas: 39 }],
      mesas: [], bloquesFilas: [], formas: [], butacasSueltas: [],
      escenario: { x: 1, y: 0, ancho: 249, alto: 2 }, bloqueadas: [], zonasDeAsiento: {},
      zonas: [{ id: 'mesas', nombre: 'Mesas', precio: 0 },
              { id: 'luneta', nombre: 'Luneta', precio: 150000 },
              { id: 'general', nombre: 'General', precio: 70000 }],
      siguiente: 1, siguienteBanda: 4, siguienteBloque: 1, siguienteForma: 1,
      siguienteZona: 1, siguienteButaca: 1,
    };
    salaActual = generarPlano(definicionDeMapa(mapa), mapa);
    const tiempos = [];
    for (let i = 0; i < 6; i++) {
      const inicio = performance.now();
      dibujarTodo();
      tiempos.push(Math.round(performance.now() - inicio));
    }
    return { butacas: butacas.length, nodos: capaButacas.querySelectorAll('*').length, tiempos };
  })()`);
  const repetidos = resultado.tiempos.slice(1).sort((a, b) => a - b);
  resultado.medianaRedibujadoMs = repetidos[Math.floor(repetidos.length / 2)];
  process.stdout.write(JSON.stringify(resultado) + '\n');
} finally {
  socket?.close();
  proceso.kill();
  await rm(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
