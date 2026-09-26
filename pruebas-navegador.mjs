// Recorridos reales en Chrome, sin paquetes ni servidor externo.
// Ejecutar: node --test pruebas-navegador.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const carpeta = fileURLToPath(new URL('.', import.meta.url));
const html = await readFile(join(carpeta, 'index.html'));
const pausa = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function chromeDisponible() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  if (process.platform !== 'win32') return 'google-chrome';
  return [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find(existsSync) || null;
}

async function esperar(comprobar, descripcion, limite = 10000) {
  const hasta = Date.now() + limite;
  while (Date.now() < hasta) {
    const valor = await comprobar();
    if (valor) return valor;
    await pausa(50);
  }
  throw new Error('Tiempo agotado al esperar ' + descripcion);
}

class ProtocoloChrome {
  constructor(socket) {
    this.socket = socket;
    this.siguiente = 0;
    this.pendientes = new Map();
    this.eventos = new Map();
    this.excepciones = [];
    socket.addEventListener('message', ({ data }) => {
      const mensaje = JSON.parse(data);
      if (mensaje.id) {
        const pendiente = this.pendientes.get(mensaje.id);
        if (!pendiente) return;
        this.pendientes.delete(mensaje.id);
        if (mensaje.error) pendiente.reject(new Error(mensaje.error.message));
        else pendiente.resolve(mensaje.result);
      } else {
        if (mensaje.method === 'Runtime.exceptionThrown') {
          this.excepciones.push(mensaje.params.exceptionDetails.text);
        }
        const oyentes = this.eventos.get(mensaje.method) || [];
        this.eventos.delete(mensaje.method);
        for (const resolver of oyentes) resolver(mensaje.params);
      }
    });
  }

  enviar(method, params = {}) {
    const id = ++this.siguiente;
    return new Promise((resolve, reject) => {
      this.pendientes.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  evento(method) {
    return new Promise((resolver) => {
      const lista = this.eventos.get(method) || [];
      lista.push(resolver);
      this.eventos.set(method, lista);
    });
  }

  async evaluar(expression) {
    const respuesta = await this.enviar('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true, userGesture: true,
    });
    if (respuesta.exceptionDetails) {
      throw new Error(respuesta.exceptionDetails.exception?.description || respuesta.exceptionDetails.text);
    }
    return respuesta.result.value;
  }

  async tecla(key, code, virtual, modifiers = 0) {
    const datos = { key, code, windowsVirtualKeyCode: virtual, modifiers };
    await this.enviar('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...datos });
    await this.enviar('Input.dispatchKeyEvent', { type: 'keyUp', ...datos });
  }

  async clicPieza(id, modifiers = 0) {
    const centro = await this.evaluar(`(() => {
      const r = document.querySelector('.pieza[data-pieza="${id}"]').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    const punto = { ...centro, button: 'left', clickCount: 1, modifiers };
    await this.enviar('Input.dispatchMouseEvent', { type: 'mousePressed', ...punto });
    await this.enviar('Input.dispatchMouseEvent', { type: 'mouseReleased', ...punto });
  }
}

test('interfaz: guardado, recarga, importacion, grupo, teclado y accesibilidad', { timeout: 60000 }, async (t) => {
  const chrome = chromeDisponible();
  assert.ok(chrome, 'Chrome o Edge no esta instalado; fija CHROME_BIN');
  const servidor = createServer((peticion, respuesta) => {
    if (peticion.url?.split('?')[0] !== '/index.html') {
      respuesta.writeHead(404).end();
      return;
    }
    respuesta.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    respuesta.end(html);
  });
  await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
  const puertoWeb = servidor.address().port;
  const perfil = await mkdtemp(join(tmpdir(), 'selector-navegador-'));
  const proceso = spawn(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--no-first-run', '--no-default-browser-check', '--window-size=1440,900',
    '--remote-debugging-port=0', `--user-data-dir=${perfil}`, 'about:blank',
  ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let errorChrome = '';
  proceso.stderr.on('data', (trozo) => { errorChrome = (errorChrome + trozo).slice(-3000); });
  let protocolo;
  try {
    const puerto = await esperar(async () => {
      if (proceso.exitCode !== null) throw new Error('Chrome termino: ' + errorChrome);
      try { return (await readFile(join(perfil, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; }
      catch { return null; }
    }, 'el puerto de Chrome');
    const url = `http://127.0.0.1:${puertoWeb}/index.html`;
    const objetivo = await (await fetch(`http://127.0.0.1:${puerto}/json/new?${encodeURIComponent(url)}`, {
      method: 'PUT',
    })).json();
    const socket = new WebSocket(objetivo.webSocketDebuggerUrl);
    await new Promise((resolver, rechazar) => {
      socket.addEventListener('open', resolver, { once: true });
      socket.addEventListener('error', rechazar, { once: true });
    });
    protocolo = new ProtocoloChrome(socket);
    await protocolo.enviar('Page.enable');
    await protocolo.enviar('Runtime.enable');
    await esperar(() => protocolo.evaluar('document.readyState === "complete" && !!document.querySelector("#tipo-sala option")'), 'la pagina');

    await t.test('teclado elige y suelta una butaca', async () => {
      await protocolo.evaluar('document.querySelector(".butaca[role=checkbox]:not([aria-disabled=true])").focus()');
      await protocolo.tecla('Enter', 'Enter', 13);
      assert.equal(await protocolo.evaluar('document.querySelector("#cuenta").textContent'), '1');
      await protocolo.evaluar('dibujarTodo()');
      assert.equal(await protocolo.evaluar('document.activeElement.getAttribute("aria-checked") === "true" && !!document.activeElement.querySelector(".marca")'), true);
      await protocolo.tecla('Enter', 'Enter', 13);
      assert.equal(await protocolo.evaluar('document.querySelector("#cuenta").textContent'), '0');
      await protocolo.evaluar('dibujarTodo()');
      assert.equal(await protocolo.evaluar('document.activeElement.getAttribute("aria-checked") === "false" && !document.activeElement.querySelector(".marca")'), true);
    });

    await t.test('guardar y recargar conserva el mapa', async () => {
      await protocolo.evaluar(`(() => {
        document.querySelector('#modo-editor').click();
        document.querySelector('#agregar-zona').click();
        document.querySelector('#nombre-mapa').value = 'Prueba navegador';
        document.querySelector('#guardar-mapa').click();
      })()`);
      assert.equal(await protocolo.evaluar('document.querySelector("#tipo-sala").value'), 'mapa:Prueba navegador');
      assert.equal(await protocolo.evaluar('JSON.parse(localStorage.getItem("selector-asientos:mapas"))["Prueba navegador"].zonas.some(z => z.nombre === "Zona")'), true);
      const recarga = protocolo.evento('Page.loadEventFired');
      await protocolo.enviar('Page.reload', { ignoreCache: true });
      await recarga;
      assert.equal(await protocolo.evaluar('[...document.querySelector("#tipo-sala").options].some(o => o.value === "mapa:Prueba navegador")'), true);
      await protocolo.evaluar(`(() => {
        const selector = document.querySelector('#tipo-sala');
        selector.value = 'mapa:Prueba navegador';
        selector.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      assert.equal(await protocolo.evaluar('document.querySelector("#estado-guardado").textContent'), 'Sin cambios pendientes.');
    });

    await t.test('importar JSON mediante el control de archivo', async () => {
      await protocolo.evaluar(`(() => {
        const mapa = JSON.parse(localStorage.getItem('selector-asientos:mapas'))['Prueba navegador'];
        mapa.nombre = 'Mapa importado';
        const datos = new DataTransfer();
        datos.items.add(new File([JSON.stringify(mapa)], 'mapa.json', { type: 'application/json' }));
        const entrada = document.querySelector('#archivo-mapa');
        entrada.files = datos.files;
        entrada.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      await esperar(() => protocolo.evaluar('document.querySelector("#tipo-sala").value === "mapa:Mapa importado"'), 'el mapa importado');
      assert.equal(await protocolo.evaluar('!!JSON.parse(localStorage.getItem("selector-asientos:mapas"))["Mapa importado"]'), true);
    });

    await t.test('edicion de grupo y atajo de deshacer', async () => {
      await protocolo.evaluar('document.querySelector("#modo-editor").click()');
      await protocolo.clicPieza('M1');
      await protocolo.clicPieza('M2', 2);
      assert.match(await protocolo.evaluar('document.querySelector("#mesa-activa").textContent'), /2 piezas seleccionadas/);
      await protocolo.evaluar('window.__lugarMesa = butacas.find(b => b.grupo?.id === "M1").nodo');
      await protocolo.evaluar('document.querySelector("[data-accion=girar]").click()');
      assert.equal(await protocolo.evaluar('mesas.filter(m => ["M1", "M2"].includes(m.id)).every(m => m.giro === 90)'), true);
      assert.equal(await protocolo.evaluar('window.__lugarMesa === butacas.find(b => b.grupo?.id === "M1").nodo'), true);
      assert.equal(await protocolo.evaluar('Number(window.__lugarMesa.firstElementChild.getAttribute("x")) === butacas.find(b => b.grupo?.id === "M1").x * PASO'), true);
      await protocolo.evaluar('document.querySelector("#deshacer").focus()');
      await protocolo.tecla('z', 'KeyZ', 90, 2);
      assert.equal(await protocolo.evaluar('mesas.filter(m => ["M1", "M2"].includes(m.id)).every(m => m.giro === 0)'), true);
    });

    await t.test('vista estrecha, nombres accesibles y redibujado', async () => {
      await protocolo.enviar('Emulation.setDeviceMetricsOverride', {
        width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
      });
      assert.equal(await protocolo.evaluar('window.innerWidth'), 390);
      assert.equal(await protocolo.evaluar('document.documentElement.scrollWidth <= window.innerWidth'), true);
      assert.equal(await protocolo.evaluar('document.querySelector("#modo-editor").getAttribute("aria-label")'), 'Editar plano');
      assert.equal(await protocolo.evaluar('document.querySelector(".butaca[role=checkbox]").getAttribute("aria-label").includes("fila")'), true);
      const arbolEditor = await protocolo.enviar('Accessibility.getFullAXTree');
      assert.ok(arbolEditor.nodes.some((n) => n.role?.value === 'button' && n.name?.value === 'Guardar el mapa'));
      await protocolo.evaluar('document.querySelector("#modo-vista").click()');
      const arbolVista = await protocolo.enviar('Accessibility.getFullAXTree');
      assert.ok(arbolVista.nodes.some((n) => n.role?.value === 'checkbox' && n.name?.value?.includes('fila A')));
      assert.equal(await protocolo.evaluar(`(() => {
        const asiento = document.querySelector('.butaca[role=checkbox]:not([aria-disabled=true])');
        asiento.focus();
        dibujarTodo();
        return document.activeElement === asiento && porId.get(asiento.dataset.id).nodo === asiento;
      })()`), true);
      await protocolo.evaluar('window.__nodoMesaAntesCambio = document.querySelector(".butaca[data-pieza=M1]")');
      await protocolo.evaluar(`(() => {
        const selector = document.querySelector('#tipo-sala');
        selector.value = 'mixta-ambos';
        selector.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      assert.equal(await protocolo.evaluar('window.__nodoMesaAntesCambio !== document.querySelector(".butaca[data-pieza=M1]")'), true);
      await protocolo.evaluar(`(() => {
        const selector = document.querySelector('#tipo-sala');
        selector.value = 'solo-filas';
        selector.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      assert.equal(await protocolo.evaluar('document.querySelectorAll(".butaca[role=checkbox]").length === butacas.length'), true);
      assert.equal(await protocolo.evaluar('document.querySelector(".butaca[data-pieza=M1]") === null'), true);
    });

    assert.deepEqual(protocolo.excepciones, [], 'errores JavaScript en el navegador');
  } finally {
    protocolo?.socket.close();
    proceso.kill();
    await new Promise((resolver) => servidor.close(resolver));
    await rm(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
  }
});
