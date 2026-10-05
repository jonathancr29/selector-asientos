// Recorridos reales en Chrome, sin paquetes ni servidor externo.
// Ejecutar: node --test pruebas-navegador.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const carpeta = fileURLToPath(new URL('.', import.meta.url));
const html = await readFile(join(carpeta, 'index.html'));
const ejemploEvento = JSON.parse(await readFile(join(carpeta, 'docs/ejemplo-conector-evento.json'), 'utf8'));
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

test('interfaz: guardado, recarga, importacion, grupo, teclado y accesibilidad', { timeout: 120000 }, async (t) => {
  const chrome = chromeDisponible();
  assert.ok(chrome, 'Chrome o Edge no esta instalado; fija CHROME_BIN');
  let eventoServidor = structuredClone(ejemploEvento.evento);
  const solicitudesAPI = [];
  const servidor = createServer(async (peticion, respuesta) => {
    if (peticion.url === '/evento' || peticion.url === '/reserva') {
      if (peticion.method === 'POST') {
        let cuerpo=''; for await (const parte of peticion) cuerpo+=parte;
        const solicitud=JSON.parse(cuerpo);solicitudesAPI.push({solicitud,csrf:peticion.headers['x-csrf-token']});
        eventoServidor.evento.versionEstado++;
        for(const p of eventoServidor.lugares) if(solicitud.event_place_ids.includes(p.event_place_id)||
          eventoServidor.grupos.some(g=>solicitud.event_group_ids.includes(g.event_group_id)&&ejemploEvento.mapa.identidadFisica[p.local_place_id]?.grupoId===g.id)) p.estado='reservado';
      }
      respuesta.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({evento:eventoServidor,resultado:{reserva:'res_ejemplo'}}));return;
    }
    if (peticion.url?.startsWith('/integracion/')) {
      const archivos={'/integracion/index.html':['index.html','text/html'],'/integracion/selector-asientos.js':['selector-asientos.js','text/javascript'],'/integracion/selector-asientos.css':['selector-asientos.css','text/css']};
      const archivo=archivos[peticion.url];if(!archivo){respuesta.writeHead(404).end();return;}
      respuesta.writeHead(200,{'Content-Type':archivo[1]+'; charset=utf-8','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'"});
      respuesta.end(await readFile(join(carpeta,'integracion',archivo[0])));return;
    }
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

    await t.test('exportar lugares pide confirmar la zona fisica heredada', async () => {
      await protocolo.evaluar(`(() => {
        document.querySelector('#modo-editor').click();
        planos[tipoActual] = asignarZonaAsiento(planoEditable(), 'luneta-A3', 'general', 'luneta');
        regenerar('');
        document.querySelector('#exportar-lugares').click();
      })()`);
      assert.match(await protocolo.evaluar('document.querySelector("#estado").textContent'), /confirma la zona física/);
      await protocolo.evaluar(`(() => {
        window.confirm = () => true;
        document.querySelector('#confirmar-zonas-fisicas').click();
      })()`);
      assert.equal(await protocolo.evaluar('planos[tipoActual].zonasFisicasConfirmadas["luneta-A3"]'), 'general');
      await protocolo.evaluar('document.querySelector("#exportar-lugares").click()');
      assert.match(await protocolo.evaluar('document.querySelector("#estado").textContent'), /Catálogo de \d+ lugares validado/);
    });

    await t.test('dos mesas numero 1 de zonas distintas no se mezclan en el resumen', async () => {
      const resumen = await protocolo.evaluar(`(() => {
        const plano = planoEditable();
        planos[tipoActual] = cambiarZonaDePiezas(plano, ['M2'], 'luneta');
        regenerar('');
        elegidas.add('M1-N1');
        elegidas.add('M2-N1');
        actualizarResumen();
        const textos = [...document.querySelectorAll('#detalle li')].map(li => li.textContent);
        elegidas.clear();
        actualizarResumen();
        return textos;
      })()`);
      assert.equal(resumen.length, 2);
      assert.ok(resumen.some((t) => t.includes('Mesa 1 · Mesas')));
      assert.ok(resumen.some((t) => t.includes('Mesa 1 · Luneta')));
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

    await t.test('bandas y zonas independientes sin tarifas; migracion y recarga', async () => {
      await protocolo.evaluar(`(() => {
        redibujar('mixta-ambos');
        cambiarModo('editor');
        window.__bandasAntes = planoEditable().bandas.length;
        document.querySelector('#agregar-zona').click();
      })()`);
      assert.equal(await protocolo.evaluar('planoEditable().bandas.length === window.__bandasAntes'), true);
      assert.equal(await protocolo.evaluar('document.querySelectorAll("#lista-zonas input").length === Object.keys(zonas).length'), true);
      assert.equal(await protocolo.evaluar('document.querySelector(".precio-zona, #venta-mesa, #completa-todas") === null'), true);
      const nombres = await protocolo.evaluar(`(() => {
        const campo = document.querySelector('#lista-bandas input[data-banda="luneta"]');
        campo.value = 'Bloque izquierdo';
        campo.dispatchEvent(new Event('change', { bubbles: true }));
        const nombreZona = document.querySelector('#lista-zonas input[data-zona="luneta"]');
        nombreZona.value = 'Preferente';
        nombreZona.dispatchEvent(new Event('change', { bubbles: true }));
        return [bandaDe(salaActual, 'luneta').nombre, zonas.luneta.nombre, etiquetaDe(butacas.find(b => b.id === 'luneta-A1'))];
      })()`);
      assert.equal(nombres[0], 'Bloque izquierdo');
      assert.equal(nombres[1], 'Preferente');
      assert.match(nombres[2], /Preferente/);
      await protocolo.evaluar(`(() => {
        const antes = Object.keys(zonas).length;
        document.querySelector('#agregar-banda-filas').click();
        window.__sinZonaNueva = Object.keys(zonas).length === antes;
        document.querySelector('#lista-bandas button[data-op="eliminar"][data-banda="luneta"]').click();
      })()`);
      assert.equal(await protocolo.evaluar('window.__sinZonaNueva && zonas.luneta.nombre === "Preferente"'), true);
      await protocolo.evaluar(`(() => {
        const mapa = mapaDesdePlano('Migrado', planoEditable(), null);
        mapa.version = 4;
        mapa.zonas.forEach(z => { z.precio = 12300; });
        mapa.mesas[0].completa = true;
        const clave = registrarMapa(validarMapa(mapa).mapa);
        redibujar(clave);
        document.querySelector('#guardar-mapa').click();
      })()`);
      assert.equal(await protocolo.evaluar('butacas.every(b => !b.grupo?.completa)'), true);
      assert.match(await protocolo.evaluar('document.querySelector("#antecedentes-comerciales").textContent'), /pendientes de revisión/);
      assert.equal(await protocolo.evaluar('document.querySelector("#total").textContent'), 'Precio no disponible');
      assert.equal(await protocolo.evaluar('historiales[tipoActual].tieneCambios()'), false);
      // Otros mapas editados por recorridos anteriores no deben bloquear esta recarga.
      await protocolo.evaluar('Object.entries(historiales).filter(([tipo]) => tipo !== tipoActual).forEach(([, h]) => h.marcarGuardado())');
      const recarga = protocolo.evento('Page.loadEventFired');
      await protocolo.enviar('Page.reload', { ignoreCache: true });
      await recarga;
      await protocolo.evaluar(`redibujar('mapa:Migrado'); cambiarModo('editor');`);
      assert.equal(await protocolo.evaluar('planoEditable().antecedentesComerciales.mesasCompletas[0]'), 'M1');
      assert.equal(await protocolo.evaluar('document.querySelector("#antecedentes-comerciales").hidden'), false);
      assert.equal(await protocolo.evaluar('planoEditable().zonas.every(z => !("precio" in z)) && butacas.every(b => !b.grupo?.completa)'), true);
    });

    await t.test('numeracion oficial por teclado conserva zona e identidad al mover, guardar y reabrir', async () => {
      await protocolo.evaluar(`(() => {
        redibujar('mixta-ninguno'); cambiarModo('editor');
        window.__confirmOriginal = window.confirm; window.confirm = () => true;
        const selector = document.querySelector('#modo-numeracion');
        selector.value = 'oficial'; selector.dispatchEvent(new Event('change', {bubbles:true}));
        document.querySelector('#herramienta-numeracion').click();
        document.querySelector('.butaca[data-id="luneta-A1"]').focus();
      })()`);
      await protocolo.tecla('Enter', 'Enter', 13);
      assert.equal(await protocolo.evaluar('document.activeElement.id'), 'fila-oficial');
      await protocolo.evaluar(`(() => {
        document.querySelector('#fila-oficial').value = 'AA';
        document.querySelector('#numero-oficial').value = '03';
        document.querySelector('#formulario-numeracion').requestSubmit();
      })()`);
      assert.match(await protocolo.evaluar('document.querySelector(".butaca[data-id=\\"luneta-A1\\"]").getAttribute("aria-label")'), /fila AA, butaca 03/);
      await protocolo.evaluar(`(() => {
        const antes = butacas.find(b => b.id === 'M1-N1'); window.__zonaAntes = antes.zona;
        const nuevo = cambiarZonaBanda(planoEditable(), 'mesas', 'luneta');
        nuevo.mesas[0].giro = 180; planos[tipoActual] = nuevo; regenerar('');
        document.querySelector('#nombre-mapa').value = 'Oficial navegador'; document.querySelector('#guardar-mapa').click();
      })()`);
      assert.equal(await protocolo.evaluar('butacas.find(b => b.id === "M1-N1").zona === window.__zonaAntes'), true);
      assert.equal(await protocolo.evaluar('butacas.find(b => b.id === "luneta-A1").numero'), '03');
      await protocolo.evaluar('Object.values(historiales).forEach(h => h.marcarGuardado())');
      const carga = protocolo.evento('Page.loadEventFired'); await protocolo.enviar('Page.reload', {ignoreCache:true}); await carga;
      await protocolo.evaluar(`redibujar('mapa:Oficial navegador'); cambiarModo('editor');`);
      assert.deepEqual(await protocolo.evaluar('(() => {const b = butacas.find(b => b.id === "luneta-A1"); return [b.fila,b.numero,b.zona];})()'), ['AA','03','luneta']);
    });

    await t.test('congelar revision cierra la edicion y nuevo borrador conserva la anterior', async () => {
      await protocolo.evaluar(`(() => {
        window.confirm = () => true;
        document.querySelector('#publicar-revision').click();
      })()`);
      assert.equal(await protocolo.evaluar('TIPOS_DE_SALA[tipoActual].revisionFisica.estado'), 'publicada');
      assert.equal(await protocolo.evaluar('document.querySelector("#modo-editor").disabled && modo === "vista"'), true);
      await protocolo.evaluar('document.querySelector("#nuevo-borrador").click()');
      assert.equal(await protocolo.evaluar('modo'), 'editor');
      assert.equal(await protocolo.evaluar('TIPOS_DE_SALA[tipoActual].revisionFisica.numero'), 2);
      assert.equal(await protocolo.evaluar('butacas.find(b => b.id === "luneta-A1").numero'), '03');
      assert.equal(await protocolo.evaluar('JSON.parse(localStorage.getItem("selector-asientos:mapas"))["Oficial navegador"].revisionFisica.estado'), 'publicada');
      await protocolo.evaluar(`(() => {
        document.querySelector('#nombre-mapa').value = 'Oficial navegador'; document.querySelector('#guardar-mapa').click();
      })()`);
      assert.match(await protocolo.evaluar('document.querySelector("#estado").textContent'), /otro nombre/);
      assert.equal(await protocolo.evaluar('JSON.parse(localStorage.getItem("selector-asientos:mapas"))["Oficial navegador"].revisionFisica.numero'), 1);
    });

    await t.test('niveles conservan seleccion y vista; editar y guardar tres pisos no mezcla geometria', async () => {
      await protocolo.evaluar(`(() => {
        redibujar('mapa-en-blanco'); cambiarModo('editor'); window.confirm = () => true;
        document.querySelector('#agregar-bloque').click();
      })()`);
      // Crear el primer bloque por el control que ya ofrece el editor.
      assert.equal(await protocolo.evaluar('bloquesFilas.length'), 1);
      await protocolo.evaluar(`(() => {
        cambiarModo('vista'); document.querySelector('.butaca').focus(); document.querySelector('.butaca').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
        window.__seleccionNivel1 = [...elegidas][0]; cambiarModo('editor');
        document.querySelector('#nombre-nivel').value = 'Palcos'; document.querySelector('#agregar-nivel').click();
        document.querySelector('#agregar-bloque').click();
        cambiarModo('vista'); document.querySelector('.butaca').focus(); document.querySelector('.butaca').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
        window.__seleccionNivel2 = [...elegidas].find(id => id !== window.__seleccionNivel1); cambiarModo('editor');
        document.querySelector('#nombre-nivel').value = 'Galería'; document.querySelector('#agregar-nivel').click();
      })()`);
      assert.equal(await protocolo.evaluar('salaActual.niveles.length'), 3);
      assert.equal(await protocolo.evaluar('elegidas.size'), 2);
      assert.equal(await protocolo.evaluar('document.querySelectorAll(".butaca").length'), 0);
      await protocolo.evaluar(`(() => {
        const elegir = (id) => document.querySelector('#nivel-vista [data-nivel="' + id + '"]').click(); elegir('n1');
        window.__vistaNivel1 = { ...vista };
        elegir('n2');
        document.querySelector('#nombre-mapa').value = 'Tres pisos navegador'; document.querySelector('#guardar-mapa').click();
        elegir('n1');
      })()`);
      assert.equal(await protocolo.evaluar('historiales[tipoActual].tieneCambios()'), false);
      assert.equal(await protocolo.evaluar('elegidas.has(window.__seleccionNivel1) && elegidas.has(window.__seleccionNivel2)'), true);
      assert.equal(await protocolo.evaluar('document.querySelector(".butaca").getAttribute("aria-label").startsWith("Planta baja")'), true);
      assert.deepEqual(await protocolo.evaluar('vista'), await protocolo.evaluar('window.__vistaNivel1'));
      await protocolo.evaluar('Object.values(historiales).forEach(h => h.marcarGuardado())');
      const carga = protocolo.evento('Page.loadEventFired'); await protocolo.enviar('Page.reload',{ignoreCache:true}); await carga;
      await protocolo.evaluar(`redibujar('mapa:Tres pisos navegador'); cambiarModo('editor'); cambiarNivelVista('n2');`);
      assert.equal(await protocolo.evaluar('salaActual.niveles.length'),3);
      assert.equal(await protocolo.evaluar('bloquesFilas[0].id'),'F2');
      await protocolo.evaluar(`(() => {
        cambiarHerramienta('bloquear'); aplicarArea({x1:0,y1:0,x2:30,y2:30});
      })()`);
      assert.equal(await protocolo.evaluar('butacas.filter(b => b.nivel === "n1").every(b => b.estado !== "bloqueada")'),true);
    });

    await t.test('arcos, regiones y ajustes por teclado sobreviven al guardado y rechazan solapamientos', async () => {
      await protocolo.evaluar(`(() => {
        cambiarHerramienta('mesas'); marcarActiva('F2'); document.querySelector('#grupo-geometria').open = true;
        document.querySelector('#geometria-tipo').value = 'arco';
        document.querySelector('#geometria-x').value = '4.2'; document.querySelector('#geometria-y').value = '5.1';
        document.querySelector('#geometria-giro').value = '32'; document.querySelector('#geometria-radio').value = '8';
        document.querySelector('#formulario-geometria').requestSubmit();
      })()`);
      assert.equal(await protocolo.evaluar('bloquesFilas[0].geometria.tipo'),'arco');
      assert.equal(await protocolo.evaluar('bloquesFilas[0].giro'),32);
      await protocolo.evaluar(`(() => {
        document.querySelector('#nombre-region').value = 'Lateral izquierdo'; document.querySelector('#agregar-region').click();
        document.querySelector('#geometria-region').value = document.querySelector('#region-activa').value;
        document.querySelector('#formulario-geometria').requestSubmit();
        document.querySelector('#herramienta-ajustar').click(); document.querySelector('.butaca').focus();
        window.__ajustada = document.querySelector('.butaca').dataset.id;
      })()`);
      await protocolo.tecla('ArrowRight','ArrowRight',39);
      assert.notEqual(await protocolo.evaluar('document.activeElement.dataset.id'),await protocolo.evaluar('window.__ajustada'));
      await protocolo.tecla('Enter','Enter',13);
      assert.equal(await protocolo.evaluar('document.activeElement.id'),'ajuste-dx');
      await protocolo.evaluar(`(() => {
        document.querySelector('#ajuste-dx').value = '.1'; document.querySelector('#ajuste-giro').value = '7';
        document.querySelector('#formulario-ajuste').requestSubmit(); window.__idAjuste = document.querySelector('#id-lugar-ajuste').value;
        document.querySelector('#guardar-mapa').click();
      })()`);
      assert.equal(await protocolo.evaluar('Object.values(planoEditable().bloquesFilas[0].ajustes)[0].giro'),7);
      await protocolo.evaluar(`(() => {
        cambiarHerramienta('mesas'); marcarActiva('F2');
        document.querySelector('#geometria-x').value = '29.9'; document.querySelector('#formulario-geometria').requestSubmit();
      })()`);
      assert.match(await protocolo.evaluar('document.querySelector("#estado").textContent'),/sale de la sala/);
      assert.equal(await protocolo.evaluar('planoEditable().bloquesFilas[0].x'),4.2);
      const guardado = await protocolo.evaluar('JSON.parse(localStorage.getItem("selector-asientos:mapas"))["Tres pisos navegador"]');
      await protocolo.evaluar(`(() => { const leido = validarMapa(${JSON.stringify(guardado)}); const clave = registrarMapa(leido.mapa); delete planos[clave]; redibujar(clave); cambiarNivelVista('n2'); })()`);
      assert.equal(await protocolo.evaluar('bloquesFilas[0].geometria.tipo'),'arco');
      assert.equal(await protocolo.evaluar('Object.values(bloquesFilas[0].ajustes)[0].giro'),7);
    });

    await t.test('pestanas de niveles: foco, activacion manual, nombres y seleccion compartida', async () => {
      await protocolo.evaluar(`(() => {
        cambiarModo('vista'); document.querySelector('#pestana-n2').focus();
        window.__compraTabs=[...elegidas]; window.__huellaTabs=huellaRevision(mapaDesdePlano(tipoActual,planoEditable()));
      })()`);
      await protocolo.tecla('ArrowRight','ArrowRight',39);
      assert.equal(await protocolo.evaluar('document.activeElement.id'),'pestana-n3');
      assert.equal(await protocolo.evaluar('salaActual.nivel'),'n2');
      await protocolo.tecla('Enter','Enter',13);
      assert.equal(await protocolo.evaluar('salaActual.nivel'),'n3');
      assert.equal(await protocolo.evaluar('document.activeElement.id'),'pestana-n3');
      await protocolo.tecla('ArrowRight','ArrowRight',39);
      assert.equal(await protocolo.evaluar('document.activeElement.id'),'pestana-n1');
      await protocolo.tecla('End','End',35);
      assert.equal(await protocolo.evaluar('document.activeElement.id'),'pestana-n3');
      await protocolo.tecla('Home','Home',36);
      await protocolo.tecla(' ','Space',32);
      assert.equal(await protocolo.evaluar('salaActual.nivel'),'n1');
      assert.equal(await protocolo.evaluar('document.querySelectorAll("#nivel-vista [aria-selected=true]").length'),1);
      assert.equal(await protocolo.evaluar('document.querySelector("#panel-nivel").getAttribute("aria-labelledby")'),'pestana-n1');
      assert.deepEqual(await protocolo.evaluar('[...elegidas]'),await protocolo.evaluar('__compraTabs'));
      assert.equal(await protocolo.evaluar('huellaRevision(mapaDesdePlano(tipoActual,planoEditable()))'),await protocolo.evaluar('__huellaTabs'));
      await protocolo.evaluar(`cambiarModo('editor'); document.querySelector('#nombre-nivel').value='Luneta principal'; document.querySelector('#renombrar-nivel').click();`);
      assert.equal(await protocolo.evaluar('document.querySelector("#pestana-n1").textContent'),'Luneta principal');
    });

    await t.test('laterales amplian solo el piso actual, conservan lugares y se deshacen y guardan', async () => {
      await protocolo.evaluar(`(() => {
        delete planos['mapa-en-blanco']; delete historiales['mapa-en-blanco']; redibujar('mapa-en-blanco'); cambiarModo('editor');
        document.querySelector('#agregar-bloque').click();
        planos[tipoActual]=alternarGuias(planoEditable(),planos[tipoActual].bandas[0].id);
        planos[tipoActual].escenario={x:8,y:0,ancho:8,alto:2}; regenerar('');
        window.__guiasLateral=muebles.filter(m=>m.tipo==='guia').map(m=>({texto:m.texto,x:m.x,y:m.y,banda:m.banda}));
        window.__anchoLateral=salaActual.ancho;
        window.__lugaresLateral=butacas.map(b=>({id:b.id,x:b.x,y:b.y,zona:b.zona,fila:b.fila,numero:b.numero}));
        window.__escenarioLateral={...configDeEscenario(escenario)};
        document.querySelector('#nombre-nivel').value='Segundo piso'; document.querySelector('#agregar-nivel').click();
        document.querySelector('#pestana-n1').click(); document.querySelector('#grupo-niveles').open=true;
        document.querySelector('#agregar-lateral-izquierdo').click(); document.querySelector('#agregar-lateral-derecho').click();
      })()`);
      assert.equal(await protocolo.evaluar('salaActual.ancho'),(await protocolo.evaluar('__anchoLateral'))+14);
      assert.deepEqual(await protocolo.evaluar('butacasVisibles().map(b=>({id:b.id,x:b.x,y:b.y,zona:b.zona,fila:b.fila,numero:b.numero}))'),
        (await protocolo.evaluar('__lugaresLateral')).map(b=>({...b,x:b.x+7})));
      assert.deepEqual(await protocolo.evaluar('configDeEscenario(escenario)'),{...(await protocolo.evaluar('__escenarioLateral')),x:15});
      assert.equal(await protocolo.evaluar('document.querySelector("#region-activa").value'),'region2');
      assert.equal(await protocolo.evaluar('document.querySelectorAll(".region-libre").length'),2);
      assert.deepEqual(await protocolo.evaluar('muebles.filter(m=>m.tipo==="guia").map(m=>({texto:m.texto,x:m.x,y:m.y,banda:m.banda}))'),
        (await protocolo.evaluar('__guiasLateral')).map(m=>({...m,x:m.x+7})));
      await protocolo.evaluar(`document.querySelector('#deshacer').click()`);
      assert.equal(await protocolo.evaluar('salaActual.ancho'),(await protocolo.evaluar('__anchoLateral'))+7);
      assert.equal(await protocolo.evaluar('planoEditable().regionesLibres.length'),1);
      await protocolo.evaluar(`document.querySelector('#rehacer').click(); document.querySelector('#pestana-n2').click()`);
      assert.equal(await protocolo.evaluar('salaActual.ancho'),30);
      assert.equal(await protocolo.evaluar('planoEditable().regionesLibres.length'),0);
      await protocolo.evaluar(`document.querySelector('#pestana-n1').click(); document.querySelector('#nombre-mapa').value='Laterales navegador'; document.querySelector('#guardar-mapa').click();`);
      await protocolo.evaluar(`(() => { const guardado=JSON.parse(localStorage.getItem('selector-asientos:mapas'))['Laterales navegador'];
        const r=validarMapa(guardado); if(r.errores)throw Error(r.errores.join(';')); const clave=registrarMapa(r.mapa); delete planos[clave]; redibujar(clave); cambiarModo('editor'); })()`);
      assert.equal(await protocolo.evaluar('salaActual.ancho'),(await protocolo.evaluar('__anchoLateral'))+14);
      assert.equal(await protocolo.evaluar('planoEditable().regionesLibres.length'),2);
      assert.deepEqual(await protocolo.evaluar('muebles.filter(m=>m.tipo==="guia").map(m=>({texto:m.texto,x:m.x,y:m.y,banda:m.banda}))'),
        (await protocolo.evaluar('__guiasLateral')).map(m=>({...m,x:m.x+7})));
      await protocolo.enviar('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await protocolo.evaluar(`reencuadrar();window.scrollTo(0,0);document.querySelector('#grupo-niveles').open=true;`);
      if (process.env.SELECTOR_CAPTURA_NIVELES) {
        const escritorio = await protocolo.enviar('Page.captureScreenshot', { format: 'png' });
        await writeFile(process.env.SELECTOR_CAPTURA_NIVELES + '-escritorio.png', Buffer.from(escritorio.data, 'base64'));
      }
      await protocolo.enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await protocolo.evaluar(`reencuadrar();document.querySelector('#pestana-n2').click();document.querySelector('#pestana-n1').click();document.querySelector('#nivel-vista').scrollIntoView({block:'start'});`);
      assert.equal(await protocolo.evaluar('document.querySelectorAll("#nivel-vista [role=tab]").length'),2);
      assert.equal(await protocolo.evaluar('document.documentElement.scrollWidth <= innerWidth'),true);
      if (process.env.SELECTOR_CAPTURA_NIVELES) {
        const movil = await protocolo.enviar('Page.captureScreenshot', { format: 'png' });
        await writeFile(process.env.SELECTOR_CAPTURA_NIVELES + '-movil.png', Buffer.from(movil.data, 'base64'));
      }
      await protocolo.enviar('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await protocolo.evaluar('reencuadrar()');
      await protocolo.evaluar(`planos[tipoActual].distribucion={bloques:[60],pasillos:[]}; regenerar('');window.__rechazoLateral=JSON.stringify(planoEditable());document.querySelector('#agregar-lateral-derecho').click();`);
      assert.equal(await protocolo.evaluar('JSON.stringify(planoEditable())'),await protocolo.evaluar('__rechazoLateral'));
      assert.match(await protocolo.evaluar('document.querySelector("#estado").textContent'),/No se agregó el lateral/);
      await protocolo.evaluar('Object.values(historiales).forEach(h=>h.marcarGuardado());actualizarEstadoEdicion()');
    });

    await t.test('estructura fisica se crea y asigna por teclado sin cambiar seleccion de compra', async () => {
      await protocolo.evaluar(`(() => {
        delete planos['mapa-en-blanco']; delete historiales['mapa-en-blanco']; redibujar('mapa-en-blanco'); cambiarModo('editor');
        document.querySelector('#agregar-bloque').click(); document.querySelector('#grupo-estructura').open=true;
        const crear=(tipo,nombre)=>{ const sel=document.querySelector('#tipo-fisico'); sel.value=tipo; sel.dispatchEvent(new Event('change')); document.querySelector('#nombre-entidad-fisica').value=nombre; document.querySelector('#agregar-entidad-fisica').click(); };
        crear('sector','Izquierdo'); document.querySelector('#herramienta-fisica').click(); document.querySelector('.butaca').focus();
      })()`);
      await protocolo.tecla('Enter','Enter',13); await protocolo.tecla('ArrowRight','ArrowRight',39); await protocolo.tecla('Enter','Enter',13);
      assert.equal(await protocolo.evaluar('seleccionFisica.size'),2);
      assert.equal(await protocolo.evaluar('elegidas.size'),0);
      assert.equal(await protocolo.evaluar('document.querySelectorAll(".fisica-seleccionada[aria-checked=true]").length'),2);
      await protocolo.evaluar(`(() => {
        document.querySelector('#asignar-entidad-fisica').click();
        const tipo=document.querySelector('#tipo-fisico'); tipo.value='fila'; tipo.dispatchEvent(new Event('change'));
        document.querySelector('#nombre-entidad-fisica').value='AA'; document.querySelector('#agregar-entidad-fisica').click(); document.querySelector('#asignar-entidad-fisica').click();
      })()`);
      assert.equal(await protocolo.evaluar('miembrosFisicos(planoEditable(),"fila","fila1").length'),2);
      assert.match(await protocolo.evaluar('document.querySelector(".butaca").getAttribute("aria-label")'),/Izquierdo.*fila AA/);
      await protocolo.evaluar(`document.querySelector('#eliminar-entidad-fisica').click()`);
      assert.match(await protocolo.evaluar('document.querySelector("#estado").textContent'),/desvincula/);
      assert.equal(await protocolo.evaluar('planoEditable().filasFisicas.length'),1);
    });

    await t.test('palco exige desvincular fila, guarda numeracion propia y mantiene piezas editables', async () => {
      await protocolo.evaluar(`(() => {
        const tipo=document.querySelector('#tipo-fisico'); tipo.value='palco'; tipo.dispatchEvent(new Event('change'));
        document.querySelector('#nombre-entidad-fisica').value='B'; document.querySelector('#agregar-entidad-fisica').click(); document.querySelector('#asignar-entidad-fisica').click();
      })()`);
      assert.match(await protocolo.evaluar('document.querySelector("#estado").textContent'),/desvincula la fila/);
      await protocolo.evaluar(`(() => {
        const tipo=document.querySelector('#tipo-fisico'); tipo.value='fila'; tipo.dispatchEvent(new Event('change')); document.querySelector('#desvincular-entidad-fisica').click();
        tipo.value='palco'; tipo.dispatchEvent(new Event('change')); const sel=document.querySelector('#entidad-fisica'); sel.value='palco1'; sel.dispatchEvent(new Event('change')); document.querySelector('#asignar-entidad-fisica').click();
      })()`);
      assert.equal(await protocolo.evaluar('butacas.filter(b=>b.grupo?.tipo==="palco").length'),2);
      assert.equal(await protocolo.evaluar('document.querySelectorAll(".palco-fisico").length'),1);
      await protocolo.tecla('Enter','Enter',13);
      assert.equal(await protocolo.evaluar('seleccionFisica.size'),1);
      await protocolo.evaluar(`(() => {
        document.querySelector('#numero-lugar-palco').value='07'; document.querySelector('#formulario-numero-palco').requestSubmit();
        cambiarHerramienta('mesas'); marcarActiva('F1'); ejecutarAccion('girar');
        document.querySelector('#nombre-mapa').value='Palco navegador'; document.querySelector('#guardar-mapa').click();
      })()`);
      assert.equal(await protocolo.evaluar('miembrosFisicos(planoEditable(),"palco","palco1").length'),2);
      assert.ok(await protocolo.evaluar('butacas.some(b=>b.grupo?.tipo==="palco"&&b.numero==="07")'));
      assert.match(await protocolo.evaluar('butacas.find(b=>b.grupo?.tipo==="palco"&&b.numero==="07").nodo.getAttribute("aria-label")'),/Palco B, lugar 07/);
      const carga=protocolo.evento('Page.loadEventFired'); await protocolo.enviar('Page.reload',{ignoreCache:true}); await carga;
      await protocolo.evaluar(`redibujar('mapa:Palco navegador'); cambiarModo('editor'); document.querySelector('#grupo-estructura').open=true;`);
      assert.equal(await protocolo.evaluar('planoEditable().palcos[0].nombre'),'B');
      assert.ok(await protocolo.evaluar('butacas.some(b=>b.grupo?.tipo==="palco"&&b.numero==="07")'));
      await protocolo.evaluar(`(() => { const tipo=document.querySelector('#tipo-fisico'); tipo.value='palco'; tipo.dispatchEvent(new Event('change')); const sel=document.querySelector('#entidad-fisica'); sel.value='palco1'; sel.dispatchEvent(new Event('change')); document.querySelector('#fisica-miembros').click(); })()`);
      assert.equal(await protocolo.evaluar('seleccionFisica.size'),2);
      assert.equal(await protocolo.evaluar('elegidas.size'),0);
    });

    await t.test('deshacer estructura conserva IDs; salir y cambiar nivel limpian solo seleccion fisica', async () => {
      await protocolo.evaluar(`(() => {
        document.querySelector('#nombre-entidad-fisica').value='C'; document.querySelector('#formulario-entidad-fisica').requestSubmit();
      })()`);
      assert.equal(await protocolo.evaluar('planoEditable().palcos[0].nombre'),'C');
      await protocolo.evaluar(`restaurarEdicion('deshacer')`);
      assert.equal(await protocolo.evaluar('planoEditable().palcos[0].nombre'),'B');
      await protocolo.evaluar(`restaurarEdicion('rehacer')`);
      assert.equal(await protocolo.evaluar('planoEditable().palcos[0].id'),'palco1');
      await protocolo.evaluar(`(() => { cambiarModo('vista'); alternar(document.querySelector('.butaca')); window.__elegidaFisica=[...elegidas][0]; cambiarModo('editor'); document.querySelector('#fisica-miembros').click(); document.querySelector('#nombre-nivel').value='Superior'; document.querySelector('#agregar-nivel').click(); })()`);
      assert.equal(await protocolo.evaluar('seleccionFisica.size'),0);
      assert.equal(await protocolo.evaluar('elegidas.has(window.__elegidaFisica)'),true);
    });

    await t.test('visor de zonas: teclado resalta sin seleccionar y no inventa datos comerciales', async () => {
      await protocolo.evaluar(`cambiarModo('vista');redibujar('mixta-ambos');
        document.querySelector('#zonas-vista button').focus();window.__seleccionAntesZona=[...elegidas];`);
      await protocolo.tecla('Enter', 'Enter', 13);
      assert.deepEqual(await protocolo.evaluar('[...elegidas]'), await protocolo.evaluar('__seleccionAntesZona'));
      assert.equal(await protocolo.evaluar('document.activeElement.getAttribute("aria-pressed")'), 'true');
      assert.match(await protocolo.evaluar('document.querySelector("#resumen-zona").textContent'), /Precio no disponible.*Disponibilidad sin confirmar/);
      assert.ok(await protocolo.evaluar('document.querySelectorAll("#realce-zona path").length') > 0);
      assert.equal(await protocolo.evaluar('getComputedStyle(capaRealceZona).pointerEvents'), 'none');
      await protocolo.evaluar('document.querySelector("#quitar-realce-zona").click()');
      assert.equal(await protocolo.evaluar('document.querySelectorAll("#realce-zona path").length'), 0);
      await protocolo.evaluar(`cambiarModo('editor')`);
      assert.equal(await protocolo.evaluar('document.querySelector("#explorador-zonas").hidden'), true);
      await protocolo.evaluar(`cambiarModo('vista')`);
    });

    await t.test('conector: carga revision publicada con tarifas externas y cierra el editor', async () => {
      await protocolo.evaluar(`window.__fixtureEvento=${JSON.stringify(ejemploEvento)}; window.__cambiosEvento=[];
        SelectorAsientos.cargarEvento({...__fixtureEvento,alSeleccionar:s=>__cambiosEvento.push(s)});`);
      assert.equal(await protocolo.evaluar('document.querySelector("#modo-editor").disabled'),true);
      assert.equal(await protocolo.evaluar('document.querySelector("#tipo-sala").disabled'),true);
      assert.equal(await protocolo.evaluar('document.querySelector("#nuevo-borrador").disabled'),true);
      assert.equal(await protocolo.evaluar('document.querySelector("#revision-publicada").hidden'),true);
      assert.equal(await protocolo.evaluar('modo'),'vista');
      assert.deepEqual(await protocolo.evaluar('SelectorAsientos.seleccion().conteos'),ejemploEvento.esperado);
      assert.match(await protocolo.evaluar('document.querySelector("#aforo").textContent'),/15 inventariados.*13 utilizables.*11 habilitados/);
      await protocolo.evaluar(`cambiarModo('editor')`);assert.equal(await protocolo.evaluar('modo'),'vista');
      assert.match(await protocolo.evaluar('document.querySelector("#estado").textContent'),/revisión fija/);
      assert.equal(await protocolo.evaluar('document.querySelector(".butaca[data-id=F2-1-1]").getAttribute("aria-disabled")'),'true');
      assert.match(await protocolo.evaluar('document.querySelector(".butaca[data-id=F2-1-1]").getAttribute("aria-label")'),/no habilitado/);
    });

    await t.test('visor de zonas: navega entre pisos, muestra tarifas y conserva compra y revisión', async () => {
      await protocolo.evaluar(`window.__mapaAntesExplorar=JSON.stringify(mapaDesdePlano(TIPOS_DE_SALA[tipoActual].nombre,planoEditable(),null));
        document.querySelector('#zonas-vista button[data-zona="general"]').click();`);
      assert.equal(await protocolo.evaluar('butacasVisibles().some(b=>b.zona==="general")'), true);
      assert.match(await protocolo.evaluar('document.querySelector("#resumen-zona").textContent'), /200.*por lugar/);
      assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().cantidad'), 0);
      assert.equal(await protocolo.evaluar('document.querySelector("#etiqueta-nivel-zona").hidden'), false);
      await protocolo.evaluar(`document.querySelector('#nivel-zona').value='n3';document.querySelector('#nivel-zona').dispatchEvent(new Event('change'));`);
      assert.equal(await protocolo.evaluar('salaActual.nivel'), 'n3');
      await protocolo.evaluar('document.querySelector("#zonas-vista button[data-zona=luneta]").click()');
      assert.equal(await protocolo.evaluar('salaActual.nivel'), 'n1');
      assert.match(await protocolo.evaluar('document.querySelector("#resumen-zona").textContent'), /700.*por palco completo/);
      await protocolo.evaluar(`document.querySelector('.butaca[data-id="F3-1-1"]').focus()`);
      await protocolo.tecla('Enter', 'Enter', 13);
      await protocolo.evaluar(`document.querySelector('#zonas-vista button[data-zona=general]').click()`);
      assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().cantidad'), 2);
      await protocolo.evaluar(`document.querySelector('#quitar-realce-zona').click();cambiarNivelVista('n1');
        document.querySelector('.butaca[data-id="F3-1-1"]').focus()`);
      await protocolo.tecla('Enter', 'Enter', 13);
      assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().cantidad'), 0);
      assert.equal(await protocolo.evaluar('JSON.stringify(mapaDesdePlano(TIPOS_DE_SALA[tipoActual].nombre,planoEditable(),null))'),
        await protocolo.evaluar('__mapaAntesExplorar'));
    });

    await t.test('visor de zonas: actualiza gratuito, disponibilidad desconocida y zona excluida', async () => {
      await protocolo.evaluar(`explorarZona('general');window.__zonaEvento=structuredClone(__fixtureEvento.evento);
        __zonaEvento.evento.versionEstado=2;__zonaEvento.categorias.find(c=>c.id==='ett_general').precioCentavos=0;
        for(const p of __zonaEvento.lugares)if(eventoConectado.lugares.get(p.local_place_id).physical_zone.id==='general')p.estado='desconocido';
        SelectorAsientos.actualizarEvento(__zonaEvento);`);
      assert.match(await protocolo.evaluar('document.querySelector("#resumen-zona").textContent'), /Gratis por lugar/);
      assert.match(await protocolo.evaluar('document.querySelector("#resumen-zona").textContent'), /0 lugares comprables.*disponibilidad sin confirmar/);
      await protocolo.evaluar(`__zonaEvento.evento.versionEstado=3;__zonaEvento.exclusiones.zona.push('general');SelectorAsientos.actualizarEvento(__zonaEvento)`);
      assert.match(await protocolo.evaluar('document.querySelector("#resumen-zona").textContent'), /No habilitada para esta función/);
      assert.ok(await protocolo.evaluar('capaRealceZona.children.length') > 0);
      await protocolo.evaluar('SelectorAsientos.cerrarEvento();SelectorAsientos.cargarEvento({...__fixtureEvento,alSeleccionar:s=>__cambiosEvento.push(s)})');
    });

    await t.test('conector: teclado selecciona palco completo y conserva compra entre niveles', async () => {
      await protocolo.evaluar(`window.__muebleAntes=capaMuebles.firstElementChild;document.querySelector('.butaca[data-id="F3-1-1"]').focus()`);
      await protocolo.tecla('Enter','Enter',13);assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().cantidad'),2);
      assert.equal(await protocolo.evaluar('capaMuebles.firstElementChild===window.__muebleAntes'),true);
      assert.match(await protocolo.evaluar('document.activeElement.getAttribute("aria-label")'),/selecciona el palco completo/);
      assert.match(await protocolo.evaluar('document.querySelector("#total").textContent'),/700/);
      assert.match(await protocolo.evaluar('document.querySelector("#detalle").textContent'),/palco completo/);
      await protocolo.evaluar(`cambiarNivelVista('n2');document.querySelector('.butaca[data-id="F4-1-1"]').focus()`);
      await protocolo.tecla(' ','Space',32);assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().cantidad'),3);
      assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().totalCentavos'),90000);
      await protocolo.evaluar(`cambiarNivelVista('n1')`);
      assert.equal(await protocolo.evaluar('document.querySelector(".butaca[data-id=F3-1-2]").getAttribute("aria-checked")'),'true');
      assert.equal(await protocolo.evaluar('window.__cambiosEvento.at(-1).cantidad'),3);
    });

    await t.test('conector: disponibilidad cambiante suelta todo el grupo y rechaza snapshots antiguos', async () => {
      await protocolo.evaluar(`window.__actualizacion=structuredClone(__fixtureEvento.evento);__actualizacion.evento.versionEstado=2;
        __actualizacion.lugares.find(p=>p.local_place_id==='F3-1-1').estado='reservado';SelectorAsientos.actualizarEvento(__actualizacion);`);
      assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().cantidad'),1);
      assert.match(await protocolo.evaluar('document.querySelector("#estado").textContent'),/soltaron 2/);
      assert.match(await protocolo.evaluar('document.querySelector(".butaca[data-id=F3-1-2]").getAttribute("aria-label")'),/conjunto completo no disponible/);
      assert.equal(await protocolo.evaluar(`(()=>{try{SelectorAsientos.actualizarEvento(__fixtureEvento.evento);return false;}catch(e){return /más reciente/.test(e.message);}})()`),true);
      assert.equal(await protocolo.evaluar('SelectorAsientos.actualizarEvento(__actualizacion).cantidad'),1);
      assert.equal(await protocolo.evaluar(`(()=>{const d=structuredClone(__actualizacion);d.lugares[0].estado='vendido';try{SelectorAsientos.actualizarEvento(d);return false;}catch(e){return /datos diferentes/.test(e.message);}})()`),true);
      assert.equal(await protocolo.evaluar('eventoConectado.cabecera.versionEstado'),2);
      assert.equal(await protocolo.evaluar('butacas.find(b=>b.id==="F3-1-2").estado'),'bloqueada');
    });

    await t.test('conector: refresca y reserva por HTTP solo con IDs opacos y CSRF', async () => {
      await protocolo.evaluar(`SelectorAsientos.cerrarEvento();SelectorAsientos.cargarEvento(__fixtureEvento);`);
      await protocolo.evaluar(`SelectorAsientos.refrescar({url:'/evento'})`);
      await protocolo.evaluar(`document.querySelector('.butaca[data-id="F1-1-1"]').focus()`);await protocolo.tecla('Enter','Enter',13);
      const respuesta=await protocolo.evaluar(`SelectorAsientos.reservar({url:'/reserva',csrf:'csrf_de_prueba',requestKey:'solicitud_prueba_1234'})`);
      assert.equal(respuesta.resultado.reserva,'res_ejemplo');assert.equal(respuesta.seleccion.cantidad,0);
      assert.equal(solicitudesAPI.length,1);assert.equal(solicitudesAPI[0].csrf,'csrf_de_prueba');
      assert.equal(solicitudesAPI[0].solicitud.request_key,'solicitud_prueba_1234');
      assert.equal(solicitudesAPI[0].solicitud.event_place_ids.length,1);assert.deepEqual(solicitudesAPI[0].solicitud.event_group_ids,[]);
      assert.ok(!JSON.stringify(solicitudesAPI[0].solicitud).includes('precio'));
      assert.equal(await protocolo.evaluar(`(()=>{try{urlDelConector('https://otro.example/reservar');return false;}catch{return true;}})()`),true);
      assert.equal(await protocolo.evaluar(`(()=>{try{urlDelConector();return false;}catch{return true;}})()`),true);
      assert.equal(await protocolo.evaluar(`SelectorAsientos.reservar({url:'/reserva'}).then(()=>false,()=>true)`),true);
    });

    await t.test('conector: fallo de red suspende compra, permite recuperar y no guarda tarifas', async () => {
      await protocolo.evaluar(`document.querySelector('.butaca[data-id="F1-1-2"]').focus()`);await protocolo.tecla('Enter','Enter',13);
      assert.equal(await protocolo.evaluar(`SelectorAsientos.refrescar({url:'/no-existe'}).then(()=>false,()=>true)`),true);
      assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().cantidad'),0);
      assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().conteos.comprables'),0);
      assert.match(await protocolo.evaluar('document.querySelector("#estado").textContent'),/sin confirmar.*soltaron 1/);
      await protocolo.evaluar(`SelectorAsientos.refrescar({url:'/evento'})`);
      assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().conteos.comprables'),10);
      assert.equal(await protocolo.evaluar(`Object.values(JSON.parse(localStorage.getItem('selector-asientos:mapas'))).some(m=>JSON.stringify(m).includes('ett_luneta'))`),false);
      await protocolo.evaluar('SelectorAsientos.cerrarEvento()');
      assert.equal(await protocolo.evaluar('document.querySelector("#modo-editor").disabled'),false);
      assert.equal(await protocolo.evaluar('document.querySelector("#total").textContent'),'Precio no disponible');
    });

    await t.test('conector: mesa completa, modalidad individual y formulario anfitrion', async () => {
      await protocolo.evaluar(`SelectorAsientos.cargarEvento(__fixtureEvento);alternarMesaPorTablero('M1');`);
      assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().cantidad'),4);
      assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().totalCentavos'),200000);
      assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().solicitud.event_group_ids.length'),1);
      await protocolo.evaluar(`window.__individual=structuredClone(__fixtureEvento.evento);__individual.evento.versionEstado=2;
        __individual.grupos.forEach(g=>g.modalidad='individual');SelectorAsientos.actualizarEvento(__individual);`);
      assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().cantidad'),4);
      assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().solicitud.event_place_ids.length'),4);
      await protocolo.evaluar(`alternar(document.querySelector('.butaca[data-id="M1-N1"]'));`);
      assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().cantidad'),3);
      const proyeccion=await protocolo.evaluar('SelectorAsientos.evaluarConfiguracion(__fixtureEvento.mapa,__individual)');
      assert.equal(proyeccion.zonas.find(z=>z.id==='luneta').nombre,'Luneta');assert.equal(proyeccion.lugares.find(p=>p.local_place_id==='F2-1-1').habilitado,false);
      assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().cantidad'),3);
      await protocolo.evaluar('SelectorAsientos.cerrarEvento()');
    });

    await t.test('conector: respuestas tardias no alteran otra sesion ni disponibilidad mas reciente', async () => {
      await protocolo.evaluar(`SelectorAsientos.cargarEvento(__fixtureEvento);window.__fetchOriginal=window.fetch;
        window.fetch=()=>new Promise(r=>window.__resolverFetch=r);window.__peticion=SelectorAsientos.refrescar({url:'/evento'}).then(()=>false,()=>true);
        SelectorAsientos.cerrarEvento();window.__otroEvento=structuredClone(__fixtureEvento.evento);__otroEvento.evento.id='evt_otro';SelectorAsientos.cargarEvento({mapa:__fixtureEvento.mapa,evento:__otroEvento});
        __resolverFetch({ok:true,json:async()=>({evento:__fixtureEvento.evento})});`);
      assert.equal(await protocolo.evaluar('__peticion'),true);assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().solicitud.event_id'),'evt_otro');
      assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().conteos.comprables'),11);
      await protocolo.evaluar(`SelectorAsientos.cerrarEvento();SelectorAsientos.cargarEvento(__fixtureEvento);
        window.__peticion=SelectorAsientos.refrescar({url:'/evento'}).then(()=>false,()=>true);
        window.__nuevoEvento=structuredClone(__fixtureEvento.evento);__nuevoEvento.evento.versionEstado=2;SelectorAsientos.actualizarEvento(__nuevoEvento);
        __resolverFetch({ok:true,json:async()=>({evento:__fixtureEvento.evento})});`);
      assert.equal(await protocolo.evaluar('__peticion'),true);assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().conteos.comprables'),11);
      await protocolo.evaluar('window.fetch=__fetchOriginal;SelectorAsientos.cerrarEvento()');
    });

    await t.test('conector: recursos externos funcionan bajo CSP sin estilos ni scripts inline', async () => {
      await protocolo.evaluar('for(const h of Object.values(historiales))h.marcarGuardado();actualizarEstadoEdicion()');
      await protocolo.enviar('Page.addScriptToEvaluateOnNewDocument',{source:"window.__cspViolaciones=[];document.addEventListener('securitypolicyviolation',e=>__cspViolaciones.push(e.violatedDirective));"});
      await protocolo.enviar('Page.navigate',{url:`http://127.0.0.1:${puertoWeb}/integracion/index.html`});
      await esperar(()=>protocolo.evaluar('location.pathname === "/integracion/index.html" && document.readyState === "complete" && !!window.SelectorAsientos && !!document.querySelector(".butaca")'),'entrega CSP');
      assert.equal(await protocolo.evaluar('document.querySelectorAll("style,script:not([src]),[style],[onclick]").length'),0);
      const estilo=await protocolo.evaluar('getComputedStyle(document.body).backgroundColor');assert.notEqual(estilo,'rgba(0, 0, 0, 0)');
      await protocolo.evaluar(`SelectorAsientos.cargarEvento(${JSON.stringify(ejemploEvento)});`);
      await protocolo.evaluar(`document.querySelector('.butaca[data-id="F3-1-1"]').focus()`);await protocolo.tecla('Enter','Enter',13);
      assert.equal(await protocolo.evaluar('SelectorAsientos.seleccion().cantidad'),2);
      assert.deepEqual(await protocolo.evaluar('window.__cspViolaciones'),[]);
      if(process.env.SELECTOR_CAPTURA){
        await protocolo.enviar('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
        await protocolo.evaluar('reencuadrar()');
        const captura=await protocolo.enviar('Page.captureScreenshot',{format:'png'});await writeFile(process.env.SELECTOR_CAPTURA,Buffer.from(captura.data,'base64'));
      }
      await protocolo.evaluar('SelectorAsientos.cerrarEvento()');
    });

    assert.deepEqual(protocolo.excepciones, [], 'errores JavaScript en el navegador');
  } finally {
    protocolo?.socket.close();
    proceso.kill();
    await new Promise((resolver) => servidor.close(resolver));
    await rm(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
  }
});
