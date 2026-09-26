// ---------------------------------------------------------------------------
// Panel de bandas (editor). Es HTML normal: una lista con botones, recorrible
// con Tab. Se rehace entero con cada cambio y el foco vuelve al mismo control.
// ---------------------------------------------------------------------------
const listaBandas = document.getElementById('lista-bandas');

// Las zonas que pueden llevar filas (todas menos la de mesas), con su precio.
// 'heredada' es la zona que la pieza tomaria de su banda: con ella, la primera opcion
// es heredarla, que es como nacen las piezas. Sin ella (una pieza fuera de toda banda
// con zona) hay que elegir una: el plano nunca guarda una butaca sin precio.
function llenarZonasDeFilas(select, actual, { heredada = null, conMesas = false, mezcla = false } = {}) {
  select.textContent = '';
  // Varias piezas con zonas distintas: se ve que no coinciden y elegir una las iguala.
  if (mezcla) select.appendChild(new Option('— varias zonas —', 'mezcla', false, true));
  if (heredada && zonas[heredada]) {
    select.appendChild(new Option('Hereda: ' + zonas[heredada].nombre + ' · ' + dinero(zonas[heredada].precio),
                                  '', false, !actual && !mezcla));
  }
  for (const [id, { nombre, precio }] of Object.entries(zonas)) {
    if (id !== 'mesas' || conMesas) select.appendChild(new Option(nombre + ' · ' + dinero(precio), id, false, id === actual));
  }
}

// Un icono del sprite, para los botones que crea el script.
function iconoDe(id) {
  const svgIcono = nodo('svg', { class: 'ico', 'aria-hidden': 'true', focusable: 'false' });
  svgIcono.appendChild(nodo('use', { href: '#i-' + id }));
  return svgIcono;
}

// Boton de icono del panel: el nombre va en aria-label y en el tooltip.
function boton(icono, etiqueta, op, banda, deshabilitado = false) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'icono';
  b.appendChild(iconoDe(icono));
  b.setAttribute('aria-label', etiqueta);
  b.dataset.tooltip = etiqueta;
  b.dataset.op = op;
  b.dataset.banda = banda;
  b.disabled = deshabilitado;
  return b;
}

function dibujarBandas() {
  if (modo !== 'editor') return;
  // Los campos de columnas muestran la sala actual, salvo mientras se escriben.
  const { bloques, pasillos } = distribucionDeSala(salaActual);
  const campoBloques = document.getElementById('bloques-sala');
  const campoPasillos = document.getElementById('pasillos-sala');
  if (document.activeElement !== campoBloques) campoBloques.value = bloques.join(', ');
  if (document.activeElement !== campoPasillos) campoPasillos.value = pasillos.join(', ');
  // Un lienzo solo muestra su ancho; una plantilla, bloques y pasillos.
  for (const id of ['columnas-lienzo', 'ayuda-lienzo']) document.getElementById(id).hidden = !salaActual.lienzo;
  for (const id of ['columnas-plantilla', 'ayuda-columnas']) document.getElementById(id).hidden = salaActual.lienzo;
  const campoAncho = document.getElementById('ancho-lienzo');
  if (document.activeElement !== campoAncho) campoAncho.value = String(salaActual.ancho);
  const activo = document.activeElement;
  const foco = listaBandas.contains(activo) ? { op: activo.dataset.op, banda: activo.dataset.banda } : null;
  listaBandas.textContent = '';
  for (const li of filasDeBandas(salaActual.bandas, false)) listaBandas.appendChild(li);
  if (foco) {
    const destino = listaBandas.querySelector(`[data-op="${foco.op}"][data-banda="${foco.banda}"]`);
    if (destino && !destino.disabled) destino.focus();
    else document.getElementById('agregar-banda-filas').focus();
  }
}

// Zonas y precios (editor). Como el panel de bandas: se rehace entero y el foco
// vuelve al mismo control.
const listaZonas = document.getElementById('lista-zonas');

function dibujarZonas() {
  if (modo !== 'editor') return;
  const activo = document.activeElement;
  const foco = listaZonas.contains(activo) ? { op: activo.dataset.op, zona: activo.dataset.zona } : null;
  listaZonas.textContent = '';
  const usadas = { bandas: salaActual.bandas, mesas, bloquesFilas, butacasSueltas,
    zonasDeAsiento: Object.fromEntries(butacas.filter((b) => b.zona !== b.zonaOriginal).map((b) => [b.id, b.zona])) };
  // Las zonas de las bandas se editan en su fila: aqui solo quedan las demas (las de
  // una pieza suelta, las pintadas a mano y las que aun no usa nadie).
  const deBandas = new Set(nodosDeBandas(salaActual.bandas).map(zonaDeBanda).filter(Boolean));
  const sueltas = Object.entries(zonas).filter(([id]) => !deBandas.has(id));
  listaZonas.hidden = !sueltas.length;
  for (const [id, { nombre, precio }] of sueltas) {
    const li = document.createElement('li');
    li.className = 'banda';
    const campo = (clase, op, valor, etiqueta, extra = {}) => {
      const input = document.createElement('input');
      Object.assign(input, { type: 'text', className: clase, value: valor, autocomplete: 'off' }, extra);
      input.setAttribute('aria-label', etiqueta);
      input.dataset.op = op;
      input.dataset.zona = id;
      return input;
    };
    const lugares = butacas.filter((b) => b.zona === id).length;
    const detalle = document.createElement('span');
    detalle.className = 'banda-detalle';
    detalle.textContent = plural(lugares, 'lugar', 'lugares') + (id === 'mesas' ? ' · lugares de mesa' : '');
    const usos = id === 'mesas' ? 0 : usosDeZona(usadas, id);
    const eliminar = document.createElement('button');
    eliminar.type = 'button';
    eliminar.className = 'icono';
    eliminar.appendChild(iconoDe('eliminar'));
    eliminar.setAttribute('aria-label', 'Eliminar la zona ' + nombre);
    eliminar.dataset.tooltip = 'Eliminar la zona ' + nombre;
    eliminar.dataset.op = 'eliminar-zona';
    eliminar.dataset.zona = id;
    eliminar.disabled = id === 'mesas' || usos > 0 || Object.keys(zonas).filter((z) => z !== 'mesas').length <= 1;
    li.append(
      campo('nombre-zona', 'nombre-zona', nombre, 'Nombre de la zona ' + nombre, { maxLength: NOMBRE_MAXIMO }),
      campo('precio-zona', 'precio-zona', (precio / 100).toFixed(2), 'Precio por lugar de ' + nombre + ', en pesos',
            { inputMode: 'decimal' }),
      eliminar, detalle);
    listaZonas.appendChild(li);
  }
  if (foco) {
    const destino = listaZonas.querySelector('[data-op="' + foco.op + '"][data-zona="' + foco.zona + '"]');
    if (destino && !destino.disabled) destino.focus();
    else document.getElementById('agregar-zona').focus();
  }
}

function aplicarCampoDeZona(campo) {
  const { op, zona: id } = campo.dataset;
  const zona = zonas[id];
  if (!zona) return;
  if (op === 'nombre-zona') {
    const nombre = campo.value.trim();
    if (nombre === zona.nombre) return;
    if (!aplicarBandas(editarZona(planoEditable(), id, { nombre }), zona.nombre + ' se llama ahora «' + nombre + '».')) {
      campo.value = zona.nombre;
    }
    return;
  }
  const precio = leerPrecio(campo.value);
  if (precio === null) {
    anunciar('No se pudo: escribe el precio en pesos, por ejemplo 350 o 350.50 (hasta 1,000,000).');
    campo.value = (zona.precio / 100).toFixed(2);
    return;
  }
  if (precio === zona.precio) {
    campo.value = (precio / 100).toFixed(2);
    return;
  }
  aplicarBandas(editarZona(planoEditable(), id, { precio }), zona.nombre + ': ' + dinero(precio) + ' por lugar.');
}

listaZonas.addEventListener('change', (e) => {
  const campo = e.target.closest('input[data-zona]');
  if (campo) aplicarCampoDeZona(campo);
});
listaZonas.addEventListener('keydown', (e) => {
  const campo = e.target.closest('input[data-zona]');
  if (!campo) return;
  if (e.key === 'Enter') {
    aplicarCampoDeZona(campo);
  } else if (e.key === 'Escape') {
    const zona = zonas[campo.dataset.zona];
    if (zona) campo.value = campo.dataset.op === 'nombre-zona' ? zona.nombre : (zona.precio / 100).toFixed(2);
  }
});
listaZonas.addEventListener('click', (e) => {
  const boton = e.target.closest('button[data-op="eliminar-zona"]');
  if (!boton) return;
  const nombre = zonas[boton.dataset.zona].nombre;
  aplicarBandas(eliminarZona(planoEditable(), boton.dataset.zona), 'Zona «' + nombre + '» eliminada.');
});
// Una zona nueva es una banda nueva: un espacio con su zona, su color y su precio.
document.getElementById('agregar-zona').addEventListener('click', () => {
  const plano = planoEditable();
  const id = 'banda' + plano.siguienteBanda;
  const conEspacio = agregarBanda(plano, 'espacio', salaActual.ancho);
  const conZona = zonaNuevaParaBanda(conEspacio, id, 'Zona');
  if (!aplicarBandas(conZona, '')) return;
  const banda = bandaDe(salaActual, id);
  marcarBandaActiva(id);
  anunciar('Zona «' + banda.nombre + '» agregada, a ' + dinero(0) + ' por lugar. Escribe su nombre y su precio.');
  const campo = listaBandas.querySelector('input[data-op="nombre"][data-banda="' + id + '"]');
  if (campo) {
    campo.focus();
    campo.select();
  }
});

// Los botones de información de los grupos: abren y cierran su texto de ayuda. Van
// dentro del <summary>, así que el clic no debe abrir ni cerrar también el grupo.
for (const [boton, ayuda] of [['info-columnas', 'ayuda-de-columnas'], ['info-zonas', 'ayuda-de-zonas']]) {
  document.getElementById(boton).addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const panel = document.getElementById(ayuda);
    panel.hidden = !panel.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
    reencuadrar();   // en pantallas angostas la ayuda empuja el plano
  });
}

// Una lista de bandas (de la sala o de una vertical) como elementos <li>.
// El principio de la fila de una banda o vertical: muestra de su color, su nombre
// (un campo; vacio, el de por defecto) y la marca de seleccionada.
function inicioDeFila(item, clase) {
  const li = document.createElement('li');
  li.className = clase;
  li.dataset.banda = item.id;
  const detalle = document.createElement('span');
  detalle.className = 'banda-detalle';
  const nombre = document.createElement('span');
  nombre.className = 'banda-nombre';
  if (item.tipo === 'escenario') {
    nombre.textContent = item.nombre;
    li.append(nombre, detalle);
    return { li, detalle };
  }
  li.style.setProperty('--capa', colorDeCapa(item.id));
  if (item.id === bandaActiva) {
    li.classList.add('activa');
    li.setAttribute('aria-current', 'true');
  }
  const muestra = document.createElement('span');
  muestra.className = 'muestra-capa';
  muestra.setAttribute('aria-hidden', 'true');
  // El nombre de una banda que tiene su zona para ella sola es el de la zona: son lo
  // mismo en el panel, asi que renombrarla renombra la zona y las etiquetas la siguen.
  const propia = zonaExclusivaDeBanda(planoEditable(), item.id);
  const campo = document.createElement('input');
  Object.assign(campo, { type: 'text', maxLength: NOMBRE_MAXIMO, autocomplete: 'off',
                         value: propia ? zonas[propia].nombre : item.nombrePropio || '',
                         placeholder: item.nombre });
  campo.setAttribute('aria-label', 'Nombre de ' + item.nombre);
  campo.dataset.op = 'nombre';
  campo.dataset.banda = item.id;
  if (propia) campo.dataset.zona = propia;
  nombre.appendChild(campo);
  const precio = precioDeBanda(item);
  li.append(muestra, nombre, precio);
  // El ✓ guarda lo escrito en la fila: el nombre y el precio a la vez. Enter y salir del
  // campo siguen funcionando; esto es la forma visible de lo mismo.
  if (precio) li.appendChild(boton('aplicar', 'Guardar el nombre y el precio de ' + item.nombre, 'guardar', item.id));
  li.appendChild(detalle);   // la seleccionada: borde de su color y aria-current
  return { li, detalle };
}

// El precio por lugar de la zona de una banda, editable en su propia fila. Las bandas
// sin zona (espacios y franjas que no dan precio a nada) no lo llevan.
function precioDeBanda(item) {
  const zona = item.zona && zonas[item.zona];
  if (!zona) return '';
  const campo = document.createElement('input');
  Object.assign(campo, { type: 'text', className: 'precio-zona', inputMode: 'decimal', autocomplete: 'off',
                         value: (zona.precio / 100).toFixed(2) });
  campo.setAttribute('aria-label', 'Precio por lugar de ' + zona.nombre + ', en pesos');
  campo.dataset.op = 'precio';
  campo.dataset.banda = item.id;
  campo.dataset.zona = item.zona;
  return campo;
}

// La zona de una banda: la suya o la de otra banda (así dos bandas comparten precio y
// numeración), «Zona nueva» para darle una propia, y «Sin zona» donde se puede no dar
// precio (espacios y franjas: lo de dentro hereda de más afuera).
function selectorDeZona(banda) {
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Zona de ' + banda.nombre);
  select.dataset.op = 'zona';
  select.dataset.banda = banda.id;
  if (banda.tipo !== 'filas' && banda.tipo !== 'mesas') {
    select.appendChild(new Option('Sin zona', '', false, !banda.zona));
  }
  for (const [id, { nombre }] of Object.entries(zonas)) {
    if (id === 'mesas' && banda.tipo === 'filas') continue;   // la de mesas no numera filas
    // Sin el precio: el de la zona de esta banda ya esta en su campo, al lado.
    select.appendChild(new Option(nombre, id, false, id === banda.zona));
  }
  select.appendChild(new Option('Zona nueva…', 'nueva'));
  return select;
}

// En una zona de mesas, cómo se venden todas sus mesas. «Mixta» solo aparece cuando ya
// lo son, para no perder el estado de cada mesa sin querer.
function selectorDeVenta(banda) {
  const dentro = mesasDeBanda(salaActual, banda.id);
  if (!dentro.length) return null;
  const completas = dentro.filter((id) => mesas.find((m) => m.id === id).completa).length;
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Venta de las mesas de ' + banda.nombre);
  select.dataset.op = 'venta';
  select.dataset.banda = banda.id;
  const mixta = completas > 0 && completas < dentro.length;
  if (mixta) select.appendChild(new Option('Venta mixta', 'mixta', false, true));
  select.appendChild(new Option('Venta por butacas', 'butacas', false, !mixta && !completas));
  select.appendChild(new Option('Venta por mesa', 'mesa', false, !mixta && completas === dentro.length));
  return select;
}

function filasDeBandas(bandas, enVertical) {
  return bandas.map((banda, i) => {
    const { li, detalle } = inicioDeFila(banda, 'banda');
    const controles = document.createElement('div');
    controles.className = 'banda-controles';
    const n = banda.nombre;
    if (banda.tipo === 'escenario') {
      detalle.textContent = escenario.ausente
        ? 'Franja inicial · sin escenario: agrégalo con «Agregar escenario» en la barra del editor'
        : 'Franja inicial · el escenario se mueve y cambia de tamaño en el plano';
      return li;
    }
    if (banda.tipo === 'filas') {
      detalle.textContent = plural(banda.filas, 'fila', 'filas') +
        (enVertical ? ' · ' + plural(banda.anchoOcupado, 'columna', 'columnas') : '');
      controles.append(
        boton('menos-fila', 'Quitar una fila a ' + n, 'menos', banda.id, banda.filas <= 1),
        boton('mas-fila', 'Agregar una fila a ' + n, 'mas', banda.id, banda.filas >= FILAS_MAXIMAS),
        selectorDeZona(banda));
    } else if (tieneAlto(banda)) {
      detalle.textContent = plural(banda.alto, 'fila', 'filas');
      controles.append(
        boton('menos-fila', 'Quitar una fila de alto a ' + n, 'menos', banda.id, banda.alto <= 1),
        boton('mas-fila', 'Agregar una fila de alto a ' + n, 'mas', banda.id, banda.alto >= ALTO_MAXIMO),
        selectorDeZona(banda));
      if (banda.tipo === 'espacio') {
        const guias = boton('guias', 'Guías de fila en ' + n, 'guias', banda.id);
        guias.setAttribute('aria-pressed', String(Boolean(banda.guias)));
        controles.appendChild(guias);
      }
      // La venta de las mesas de la banda va al final, tras los botones de siempre.
      banda.ventaAlFinal = selectorDeVenta(banda);
    } else {
      detalle.textContent = plural(banda.verticales.length, 'banda vertical', 'bandas verticales') +
        ' · ' + plural(banda.alto, 'fila', 'filas');
      controles.append(
        boton('agregar-vertical', 'Agregar una banda vertical a ' + n, 'agregar-vertical', banda.id,
              banda.verticales.length >= VERTICALES_MAXIMAS),
        selectorDeZona(banda));
    }
    const anterior = bandas[i - 1];
    controles.append(
      boton('arriba', 'Subir ' + n, 'subir', banda.id, !anterior || anterior.tipo === 'escenario'),
      boton('abajo', 'Bajar ' + n, 'bajar', banda.id, i === bandas.length - 1),
      boton('duplicar', 'Duplicar ' + n, 'duplicar', banda.id),
      boton('eliminar', 'Eliminar ' + n, 'eliminar', banda.id));
    if (banda.ventaAlFinal) controles.appendChild(banda.ventaAlFinal);
    li.appendChild(controles);
    if (esDivision(banda)) {
      const ol = document.createElement('ol');
      ol.setAttribute('aria-label', 'Bandas verticales de ' + n);
      banda.verticales.forEach((v, k) => ol.appendChild(filaDeVertical(v, k, banda.verticales)));
      li.appendChild(ol);
    }
    return li;
  });
}

function filaDeVertical(v, k, verticales) {
  const { li, detalle } = inicioDeFila(v, 'banda banda-vertical');
  const ultima = k === verticales.length - 1;
  detalle.textContent = plural(v.anchoOcupado, 'columna', 'columnas') + (ultima ? ' (el resto)' : '');
  const n = v.nombre;
  const controles = document.createElement('div');
  controles.className = 'banda-controles';
  controles.append(
    boton('acortar', 'Quitar una columna de ancho a ' + n, 'angosta', v.id, ultima || v.anchoOcupado <= 1),
    boton('alargar', 'Agregar una columna de ancho a ' + n, 'ancha', v.id, ultima),
    boton('izquierda', 'Mover ' + n + ' a la izquierda', 'izquierda', v.id, k === 0),
    boton('derecha', 'Mover ' + n + ' a la derecha', 'derecha', v.id, ultima),
    boton('agregar-filas', 'Agregar una banda de filas en ' + n, 'agregar-filas-en', v.id),
    boton('agregar-mesas', 'Agregar una zona de mesas en ' + n, 'agregar-mesas-en', v.id),
    boton('agregar-espacio', 'Agregar un espacio en ' + n, 'agregar-espacio-en', v.id),
    boton('duplicar', 'Duplicar ' + n, 'duplicar', v.id, verticales.length >= VERTICALES_MAXIMAS),
    boton('eliminar', 'Eliminar ' + n, 'eliminar', v.id, verticales.length === 1));
  li.appendChild(controles);
  const ol = document.createElement('ol');
  ol.setAttribute('aria-label', 'Bandas de ' + n);
  for (const hija of filasDeBandas(v.bandas, true)) ol.appendChild(hija);
  li.appendChild(ol);
  return li;
}

// Aplica un plano nuevo de bandas si todas las mesas siguen cabiendo. Si alguna
// no cabe, se vuelve al plano anterior y se explica cual y por que.
function aplicarBandas(resultado, mensaje) {
  if (resultado.motivo) {
    anunciar('No se pudo: ' + resultado.motivo + '.');
    return false;
  }
  const antes = fotoDeButacas();
  const mesasAntes = new Map([...mesas, ...bloquesFilas, ...formas, ...butacasSueltas].map((m) => [m.id, m.nombre]));
  const previo = planos[tipoActual];
  planos[tipoActual] = resultado;
  salaActual = generarPlano(tipoActual, resultado);
  const errorDeBandas = salaActual.errorDeBandas || motivoDeAforo(butacas.length);
  const fallo = !errorDeBandas && primeraPiezaQueNoCabe(salaActual);
  if (errorDeBandas || fallo) {
    planos[tipoActual] = previo;
    salaActual = generarPlano(tipoActual, previo);
    anunciar('No se pudo: ' + (errorDeBandas || fallo.pieza.nombre + ' ' + fallo.motivo) + '.');
    return false;
  }
  const quitadas = [...mesasAntes].filter(([id]) => !piezasDe(resultado).some((m) => m.id === id))
                                  .map(([, nombre]) => nombre);
  regenerar(mensaje + (quitadas.length ? ' Se quitaron con ella: ' + quitadas.join(', ') + '.' : ''), antes);
  calcularEncuadre();
  return true;
}

// Duplica una banda, vertical o franja y selecciona la copia. Si el foco estaba en
// el panel, pasa al mismo control de la copia.
function duplicarBandaPorId(id) {
  const banda = bandaDe(salaActual, id);
  if (!banda) return;
  const plano = planoEditable();
  const nuevoId = 'banda' + plano.siguienteBanda;
  const esVertical = ubicar(salaActual.bandas, id).esVertical;
  const op = listaBandas.contains(document.activeElement) && document.activeElement.dataset.op;
  if (!aplicarBandas(duplicarBanda(plano, salaActual, id), '')) return;
  const copia = bandaDe(salaActual, nuevoId);
  const destino = op && listaBandas.querySelector('[data-op="' + op + '"][data-banda="' + nuevoId + '"]');
  if (destino && !destino.disabled) destino.focus();
  marcarBandaActiva(nuevoId);
  anunciar(banda.nombre + ' duplicada: ' + copia.nombre + (esVertical ? ', a su derecha.' : ', debajo.') +
           ' Queda seleccionada.');
}

function aplicarNombreDeBanda(campo) {
  const id = campo.dataset.banda;
  const banda = bandaDe(salaActual, id);
  if (!banda) return;
  const nombre = campo.value.trim().slice(0, NOMBRE_MAXIMO);
  // Con zona para ella sola, el nombre es el de la zona: las etiquetas lo siguen.
  const propia = campo.dataset.zona;
  if (propia) {
    if (nombre === zonas[propia].nombre) return;
    if (!aplicarBandas(editarZona(planoEditable(), propia, { nombre }),
                       zonas[propia].nombre + ' se llama ahora «' + nombre + '».')) {
      campo.value = zonas[propia].nombre;
    }
    return;
  }
  if (nombre === (banda.nombrePropio || '')) return;
  aplicarBandas(renombrarBanda(planoEditable(), id, nombre),
    nombre ? banda.nombre + ' se llama ahora «' + nombre + '».' : banda.nombre + ' vuelve a su nombre por defecto.');
}

// Selecciona una banda (o ninguna, con null): contorno en el plano y fila marcada
// en el panel. Sin redibujar, para no perder el foco ni lo que se escribe.
function marcarBandaActiva(id) {
  bandaActiva = id;
  if (id && mesaActiva) marcarActiva(null);
  for (const li of listaBandas.querySelectorAll('li[data-banda]')) {
    const si = li.dataset.banda === id;
    li.classList.toggle('activa', si);
    if (si) li.setAttribute('aria-current', 'true');
    else li.removeAttribute('aria-current');
  }
  dibujarSeleccionBanda();
}

listaBandas.addEventListener('click', (e) => {
  const control = e.target.closest('button[data-op]');
  if (!control) return;
  const { op, banda: id } = control.dataset;
  const plano = planoEditable();
  const banda = bandaDe(salaActual, id);
  const n = banda.nombre;
  if (op === 'menos' || op === 'mas') {
    const delta = op === 'mas' ? 1 : -1;
    const resultado = redimensionarBanda(plano, salaActual, id, delta);
    const valor = banda.tipo === 'filas' ? banda.filas + delta : banda.alto + delta;
    aplicarBandas(resultado, n + ': ' + (banda.tipo === 'filas'
      ? plural(valor, 'fila', 'filas') + '.' : plural(valor, 'fila', 'filas') + ' de alto.'));
  } else if (op === 'subir' || op === 'bajar') {
    aplicarBandas(moverBanda(plano, salaActual, id, op === 'subir' ? -1 : 1),
                  n + (op === 'subir' ? ' subida.' : ' bajada.'));
  } else if (op === 'izquierda' || op === 'derecha') {
    aplicarBandas(moverBanda(plano, salaActual, id, op === 'izquierda' ? -1 : 1),
                  n + ' movida a la ' + op + '.');
  } else if (op === 'angosta' || op === 'ancha') {
    const delta = op === 'ancha' ? 1 : -1;
    aplicarBandas(cambiarAnchoVertical(plano, salaActual, id, delta),
                  n + ': ' + plural(banda.anchoOcupado + delta, 'columna', 'columnas') + '.');
  } else if (op === 'agregar-vertical') {
    aplicarBandas(agregarVertical(plano, salaActual, id), 'Banda vertical agregada a ' + n + '.');
  } else if (op === 'agregar-filas-en' || op === 'agregar-mesas-en' || op === 'agregar-espacio-en') {
    const tipo = op.split('-')[1];
    aplicarBandas(agregarBandaEnVertical(plano, salaActual, id, tipo),
                  { filas: 'Banda de 2 filas agregada', mesas: 'Zona de mesas de 4 filas agregada',
                    espacio: 'Espacio de 4 filas agregado' }[tipo] + ' en ' + n + '.');
  } else if (op === 'guias') {
    aplicarBandas(alternarGuias(plano, id), (banda.guias ? 'Sin guías de fila en ' : 'Guías de fila en ') + n + '.');
  } else if (op === 'guardar') {
    // Los dos campos se leen ANTES de aplicar nada: el primer cambio rehace la lista y se
    // llevaria por delante lo escrito en el otro (paso: el precio volvia al de antes).
    const fila = control.closest('li[data-banda]');
    const copia = (campo) => campo && { value: campo.value, dataset: { ...campo.dataset } };
    const nombre = copia(fila.querySelector('input[data-op="nombre"]'));
    const precio = copia(fila.querySelector('input[data-op="precio"]'));
    if (nombre) aplicarNombreDeBanda(nombre);
    if (precio) aplicarPrecioDeBanda(precio);
  } else if (op === 'duplicar') {
    duplicarBandaPorId(id);
  } else if (op === 'eliminar') {
    aplicarBandas(eliminarBanda(plano, salaActual, id), n + ' eliminada.');
  }
});

// Tocar cualquier control de una banda la selecciona.
listaBandas.addEventListener('focusin', (e) => {
  const li = e.target.closest('li[data-banda]');
  if (li && li.dataset.banda !== 'escenario' && li.dataset.banda !== bandaActiva) marcarBandaActiva(li.dataset.banda);
});

listaBandas.addEventListener('keydown', (e) => {
  const campo = e.target.closest('input[data-op]');
  if (!campo) return;
  const esNombre = campo.dataset.op === 'nombre';
  if (e.key === 'Enter') {
    if (esNombre) aplicarNombreDeBanda(campo);
    else aplicarPrecioDeBanda(campo);
  } else if (e.key === 'Escape') {
    const banda = bandaDe(salaActual, campo.dataset.banda);
    const zona = zonas[campo.dataset.zona];
    campo.value = !esNombre ? (zona ? (zona.precio / 100).toFixed(2) : campo.value)
      : zona ? zona.nombre : (banda && banda.nombrePropio) || '';
  }
});

listaBandas.addEventListener('change', (e) => {
  const campo = e.target.closest('input[data-op]');
  if (campo) {
    if (campo.dataset.op === 'nombre') aplicarNombreDeBanda(campo);
    else aplicarPrecioDeBanda(campo);
    return;
  }
  const control = e.target.closest('select[data-op]');
  if (!control) return;
  const { op, banda: id } = control.dataset;
  const antes = bandaDe(salaActual, id).nombre;
  if (op === 'venta') {
    if (control.value === 'mixta') return;
    const completa = control.value === 'mesa';
    aplicarBandas(marcarMesasDeBanda(planoEditable(), salaActual, id, completa),
                  'Las mesas de ' + antes + ' se venden ' + (completa ? 'por mesa.' : 'por butacas.'));
    return;
  }
  if (control.value === 'nueva') {
    if (aplicarBandas(zonaNuevaParaBanda(planoEditable(), id, antes), '')) {
      const puesta = bandaDe(salaActual, id);
      anunciar(antes + ' pasa a su propia zona «' + zonas[puesta.zona].nombre + '», a ' + dinero(0) +
               ' por lugar. Escribe su precio.');
    }
    return;
  }
  aplicarBandas(cambiarZonaBanda(planoEditable(), id, control.value),
                control.value ? antes + ' pasa a la zona ' + zonas[control.value].nombre + '.'
                              : antes + ' se queda sin zona: lo de dentro hereda de más afuera.');
});

// El precio por lugar escrito en la fila de una banda: es el de su zona.
function aplicarPrecioDeBanda(campo) {
  const zona = zonas[campo.dataset.zona];
  if (!zona) return;
  const precio = leerPrecio(campo.value);
  if (precio === null) {
    anunciar('No se pudo: el precio debe ser de 0 a 1,000,000.00.');
    campo.value = (zona.precio / 100).toFixed(2);
    return;
  }
  if (precio === zona.precio) return;
  aplicarBandas(editarZona(planoEditable(), campo.dataset.zona, { precio }),
                zona.nombre + ': ' + dinero(precio) + ' por lugar.');
}

function aplicarColumnas() {
  const { distribucion, motivo } = leerDistribucion(
    document.getElementById('bloques-sala').value, document.getElementById('pasillos-sala').value);
  if (motivo) {
    anunciar('No se pudo: ' + motivo + '.');
    return;
  }
  const { bloques, pasillos } = distribucion;
  const butacasPorFila = bloques.reduce((s, b) => s + b, 0);
  aplicarBandas(cambiarDistribucion(planoEditable(), salaActual, distribucion),
    'Columnas: ' + bloques.join(', ') +
    (pasillos.length ? ' · pasillos de ' + pasillos.join(', ') : ' · sin pasillos') +
    ' · ' + plural(butacasPorFila, 'butaca', 'butacas') + ' por fila.');
}

document.getElementById('aplicar-columnas').addEventListener('click', aplicarColumnas);
for (const id of ['bloques-sala', 'pasillos-sala']) {
  document.getElementById(id).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') aplicarColumnas();
  });
}

document.getElementById('agregar-banda-filas').addEventListener('click', () => {
  aplicarBandas(agregarBanda(planoEditable(), 'filas'), 'Banda de 2 filas agregada al final.');
});
document.getElementById('agregar-banda-mesas').addEventListener('click', () => {
  aplicarBandas(agregarBanda(planoEditable(), 'mesas'), 'Zona de mesas de 4 filas agregada al final.');
});
document.getElementById('agregar-espacio').addEventListener('click', () => {
  aplicarBandas(agregarBanda(planoEditable(), 'espacio'), 'Espacio de 4 filas agregado al final.');
});

function aplicarAnchoLienzo() {
  const texto = document.getElementById('ancho-lienzo').value.trim();
  const ancho = /^\d+$/.test(texto) ? Number(texto) : NaN;
  if (ancho === salaActual.ancho) return;
  aplicarBandas(cambiarAnchoLienzo(planoEditable(), salaActual, ancho),
                'Lienzo de ' + plural(ancho, 'columna', 'columnas') + '.');
}
document.getElementById('aplicar-ancho-lienzo').addEventListener('click', aplicarAnchoLienzo);
document.getElementById('ancho-lienzo').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') aplicarAnchoLienzo();
});

document.getElementById('agregar-division').addEventListener('click', () => {
  aplicarBandas(agregarBanda(planoEditable(), 'division', salaActual.ancho),
                'Franja con dos bandas verticales agregada al final, cada una con un espacio vacío de 4 filas.');
});

// ---------------------------------------------------------------------------
// Zoom y desplazamiento: se mueve el viewBox, no el DOM.
// ---------------------------------------------------------------------------
let vista, vistaInicial;

// El encuadre abarca todo lo dibujado, butacas y muebles (escenario, mesas,
// rotulos de fila), y la sala entera aunque una zona de mesas este vacia, mas
// una celda de margen. Cada elemento ocupa una celda
// salvo que declare w y h.
//
// Si el plano tiene un alto fijo (Previsualizar: ajustado a la pantalla), el encuadre
// se ensancha o se alarga para tener la misma proporcion que el <svg>, centrado. Asi
// el viewBox llena el elemento sin franjas y cada pixel sigue siendo una misma
// distancia en unidades, que es lo que suponen enUnidades y el arrastre.
function calcularEncuadre() {
  const cajas = [...butacas, ...muebles, { x: 0, y: 0, w: salaActual.ancho + 1, h: salaActual.alto }];
  const margen = PASO;
  let x = Math.min(...cajas.map((c) => c.x)) * PASO - margen;
  let y = Math.min(...cajas.map((c) => c.y)) * PASO - margen;
  let w = Math.max(...cajas.map((c) => c.x + (c.w || 1))) * PASO + margen - x;
  let h = Math.max(...cajas.map((c) => c.y + (c.h || 1))) * PASO + margen - y;
  const caja = svg.getBoundingClientRect();
  if (caja.width > 0 && caja.height > 0) {
    const proporcion = caja.width / caja.height;
    if (w / h < proporcion) {
      const ancho = h * proporcion;
      x -= (ancho - w) / 2;
      w = ancho;
    } else {
      const alto = w / proporcion;
      y -= (alto - h) / 2;
      h = alto;
    }
  }
  vistaInicial = { x, y, w, h };
  vista = { ...vistaInicial };
  aplicarVista();
}

// El alto del plano lo da el CSS: en escritorio, el hueco entre el encabezado y el pie
// (la sala se ve completa sin scroll); en pantallas angostas o bajas, el ancho. Aqui solo
// se limpia un alto puesto a mano por una version anterior.
function ajustarAltoDelPlano() {
  if (svg.style.height) svg.style.height = '';
}

// Vuelve a ajustar el alto y el encuadre. Con 'conservarZoom', mantiene el centro y la
// proporcion de zoom de la vista actual (al cambiar el tamaño de la ventana).
function reencuadrar(conservarZoom = false) {
  const anterior = conservarZoom && vista && vistaInicial
    ? { factor: vista.w / vistaInicial.w, cx: vista.x + vista.w / 2, cy: vista.y + vista.h / 2 } : null;
  ajustarAltoDelPlano();
  calcularEncuadre();
  if (anterior && anterior.factor < 0.999) {
    vista.w = vistaInicial.w * anterior.factor;
    vista.h = vistaInicial.h * anterior.factor;
    vista.x = anterior.cx - vista.w / 2;
    vista.y = anterior.cy - vista.h / 2;
    aplicarVista();
  }
}

// ---------------------------------------------------------------------------
// Paneles del encabezado (hojas de informacion) y del pie (detalle de la seleccion).
// En escritorio flotan sobre el plano; en pantallas angostas empujan el contenido y hay
// que reencuadrar. Se cierran con su boton, con Esc o al tocar el plano.
// ---------------------------------------------------------------------------
const hojasInfo = document.getElementById('hojas-info');
const hojas = [...hojasInfo.querySelectorAll('.hoja')];
const puntos = [...hojasInfo.querySelectorAll('.punto')];
let hojaActual = 0;

function abrirPanel(panel, boton, abrir) {
  if (panel.hidden === !abrir) return;
  panel.hidden = !abrir;
  boton.setAttribute('aria-expanded', String(abrir));
  reencuadrar(true);
}

function mostrarHoja(indice) {
  hojaActual = Math.max(0, Math.min(hojas.length - 1, indice));
  hojas.forEach((hoja, i) => { hoja.hidden = i !== hojaActual; });
  puntos.forEach((punto, i) => {
    if (i === hojaActual) punto.setAttribute('aria-current', 'true');
    else punto.removeAttribute('aria-current');
  });
  document.getElementById('hoja-anterior').disabled = hojaActual === 0;
  document.getElementById('hoja-siguiente').disabled = hojaActual === hojas.length - 1;
}

const cerrarPlegables = () => {
  abrirPanel(hojasInfo, document.getElementById('boton-info'), false);
  abrirPanel(document.getElementById('panel-detalle'), document.getElementById('boton-detalle'), false);
};
svg.addEventListener('pointerdown', cerrarPlegables);

document.getElementById('boton-info').addEventListener('click', () => {
  const abrir = hojasInfo.hidden;
  abrirPanel(hojasInfo, document.getElementById('boton-info'), abrir);
  if (abrir) mostrarHoja(hojaActual);
});
document.getElementById('hoja-anterior').addEventListener('click', () => mostrarHoja(hojaActual - 1));
document.getElementById('hoja-siguiente').addEventListener('click', () => mostrarHoja(hojaActual + 1));
for (const punto of puntos) punto.addEventListener('click', () => mostrarHoja(Number(punto.dataset.hoja)));
document.getElementById('cerrar-info').addEventListener('click', () => {
  abrirPanel(hojasInfo, document.getElementById('boton-info'), false);
  document.getElementById('boton-info').focus();
});
// Las flechas del teclado pasan de hoja mientras el foco esta en el panel.
hojasInfo.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    mostrarHoja(hojaActual + (e.key === 'ArrowRight' ? 1 : -1));
  }
});
document.getElementById('boton-detalle').addEventListener('click', () => {
  const panel = document.getElementById('panel-detalle');
  abrirPanel(panel, document.getElementById('boton-detalle'), panel.hidden);
});

let esperaDeTamano = null;
addEventListener('resize', () => {
  clearTimeout(esperaDeTamano);
  esperaDeTamano = setTimeout(() => reencuadrar(true), 120);
});

function aplicarVista() {
  // La vista no puede salir del encuadre inicial: el plano nunca se pierde de
  // vista. Como el zoom minimo ES el encuadre inicial, el rango nunca es vacio.
  const limitar = (v, min, max) => Math.min(Math.max(v, min), max);
  vista.x = limitar(vista.x, vistaInicial.x, vistaInicial.x + vistaInicial.w - vista.w);
  vista.y = limitar(vista.y, vistaInicial.y, vistaInicial.y + vistaInicial.h - vista.h);
  svg.setAttribute('viewBox', [vista.x, vista.y, vista.w, vista.h].join(' '));
}

// Lo mas cerca que se deja llegar. No puede salir del encuadre inicial: ese encuadre se
// estira a la proporcion del hueco del plano, asi que cuanto mas alto es el recinto mas
// ancho es, y «seis veces mas cerca» acerca cada vez menos. En un recinto de 20.000
// butacas el tope dejaba 2,6 px por butaca, ilegible (paso). Topado en celdas, en
// cualquier recinto se llega a ver el ancho de una sala clasica: unos 40 px por butaca.
const VISTA_MINIMA = ANCHO_SALA * PASO;

// Devuelve si la vista cambio, para que la rueda sepa si debe ceder el scroll
// a la pagina.
function escalar(factor, centro) {
  // Si el recinto entero cabe en menos que eso, el tope es el propio encuadre.
  const minimo = Math.min(vistaInicial.w, VISTA_MINIMA);
  const nuevoAncho = Math.min(vistaInicial.w, Math.max(minimo, vista.w * factor));
  const razon = nuevoAncho / vista.w;
  if (Math.abs(razon - 1) < 1e-9) return false;
  const c = centro || { x: vista.x + vista.w / 2, y: vista.y + vista.h / 2 };
  vista.x = c.x - (c.x - vista.x) * razon;
  vista.y = c.y - (c.y - vista.y) * razon;
  vista.w = nuevoAncho;   // exacto, no w *= razon: asi el tope se alcanza sin error de redondeo
  vista.h *= razon;
  aplicarVista();
  return true;
}

function enUnidades(evento) {
  const caja = svg.getBoundingClientRect();
  return {
    x: vista.x + ((evento.clientX - caja.left) / caja.width) * vista.w,
    y: vista.y + ((evento.clientY - caja.top) / caja.height) * vista.h,
  };
}

svg.addEventListener('wheel', (e) => {
  // Proporcional al delta, no un paso fijo por evento: una muesca de rueda
  // (~100 px) da x1.15, y un trackpad, que manda muchos deltas pequenos, avanza
  // suave. El pellizco de trackpad llega como wheel con ctrlKey y deltas cortos.
  const porModo = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 1 : 0.002;
  const factor = Math.pow(2, e.deltaY * porModo * (e.ctrlKey ? 10 : 1));
  // En el tope del zoom la rueda vuelve a desplazar la pagina. Con ctrlKey se
  // bloquea siempre, o el navegador haria zoom de la pagina entera.
  if (escalar(factor, enUnidades(e)) || e.ctrlKey) e.preventDefault();
}, { passive: false });

// Punteros activos (raton, dedos, lapiz) por pointerId. Con uno se arrastra;
// con dos se arrastra y se pellizca a la vez.
const punteros = new Map();
let arrastre = null;
// Con la barra espaciadora pulsada, el arrastre siempre mueve el plano: es la salida
// para desplazarse mientras una herramienta de butacas se queda con el arrastre.
let espacioPulsado = false;
document.addEventListener('keydown', (e) => {
  // En un campo de texto, la barra escribe un espacio: ahi no es para el plano.
  if (e.code === 'Space' && !e.repeat && !e.target.closest('input, select, textarea')) espacioPulsado = true;
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space') espacioPulsado = false;
});
window.addEventListener('blur', () => { espacioPulsado = false; });

function centroDePunteros() {
  const [a, b] = punteros.values();
  if (!b) return { x: a.x, y: a.y, d: 0 };
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
}

svg.addEventListener('pointerdown', (e) => {
  // El boton central siempre mueve el plano, tambien mientras se pinta por area.
  if (e.button !== 0 && e.button !== 1) return;   // el derecho no elige butaca
  const soloMover = e.button === 1 || espacioPulsado;
  if (e.button === 1) e.preventDefault();
  punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
  svg.setPointerCapture(e.pointerId);
  if (punteros.size === 1) {
    // En el editor, agarrar una mesa la mueve; agarrar el fondo mueve el plano.
    if (arrastreMesa) terminarArrastreMesa(false);   // nunca dos arrastres de mesa a la vez
    // Un tirador se lleva el gesto: ni mueve el plano ni selecciona nada hasta soltar.
    const tirador = !soloMover && modo === 'editor' && !conButacas() && e.target.closest('[data-tirador]');
    if (tirador) {
      const { tirador: tipo, banda, vertical } = tirador.dataset;
      arrastreTirador = { tipo, banda: banda || null, vertical: vertical || null, pointerId: e.pointerId };
      dibujarFantasma({});
      return;
    }
    const pieza = modo === 'editor' && e.target.closest('.pieza');
    if (pieza) {
      // Ctrl (o Cmd) mete o saca la pieza de la selección en vez de arrastrarla.
      if (e.ctrlKey || e.metaKey) {
        alternarPiezaActiva(pieza.dataset.pieza);
        return;
      }
      arrastreMesa = iniciarArrastreMesa(pieza, e);
      return;
    }
    arrastre = {
      x: e.clientX, y: e.clientY, movido: 0,
      // Con la herramienta de zona o de bloqueo, arrastrar dibuja un rectangulo en vez
      // de mover el plano; Alt lo deshace (zona de siempre, o desbloquear).
      area: modo === 'editor' && conButacas() && !soloMover ? { desde: celdaBajo(e), alt: e.altKey } : null,
      // Colocando piezas, arrastrar el fondo las selecciona; con Ctrl, se suman a las
      // que ya estaban.
      marco: modo === 'editor' && !conButacas() && !soloMover
        ? { desde: celdaBajo(e), suma: e.ctrlKey || e.metaKey } : null,
      // La butaca se anota AQUI, no en pointerup: setPointerCapture retargetea al
      // <svg> todos los eventos de puntero siguientes, asi que al soltar el boton
      // e.target ya es el <svg> y closest('.butaca') devuelve null.
      butaca: e.target.closest('.butaca'),
      tablero: modo === 'vista' ? e.target.closest('.mueble.completa') : null,
      celda: modo === 'editor' ? celdaBajo(e) : null,
    };
  } else {
    // Un segundo dedo convierte el toque en gesto de plano: si se movia una
    // mesa, se cancela y el pellizco sigue normal.
    if (arrastreMesa) terminarArrastreMesa(false);
    if (arrastre && arrastre.area) {
      arrastre.area = null;
      dibujarArea(null);
    }
    if (arrastre) arrastre.movido = Infinity;
    else arrastre = { x: e.clientX, y: e.clientY, movido: Infinity, butaca: null };
  }
});
svg.addEventListener('pointermove', (e) => {
  if (arrastreTirador) {
    if (e.pointerId === arrastreTirador.pointerId) dibujarFantasma(medidasDeTirador(e));
    return;
  }
  if (arrastreMesa) {
    if (e.pointerId === arrastreMesa.pointerId) moverSombra(e);
    return;
  }
  if (!arrastre || !punteros.has(e.pointerId)) return;
  // Incremental: se compara el centro antes y despues de ESTE movimiento. Asi
  // poner o levantar un dedo no hace saltar el plano.
  const antes = centroDePunteros();
  punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const despues = centroDePunteros();

  if (punteros.size === 1) {
    arrastre.movido = Math.max(arrastre.movido,
      Math.abs(e.clientX - arrastre.x) + Math.abs(e.clientY - arrastre.y));
  }
  if (arrastre.movido > 4) svg.classList.add('arrastrando');
  if (arrastre.area) {
    arrastre.area.hasta = celdaBajo(e);
    dibujarArea(areaDeCeldas(arrastre.area.desde, arrastre.area.hasta), arrastre.area.alt);
    return;   // el plano se queda quieto: el gesto es del rectangulo
  }
  if (arrastre.marco) {
    arrastre.marco.hasta = celdaBajo(e);
    const marco = areaDeCeldas(arrastre.marco.desde, arrastre.marco.hasta);
    dibujarArea(marco, false, plural(piezasEnMarco(piezasDelPlano(), marco).length, 'pieza', 'piezas'));
    return;
  }

  const caja = svg.getBoundingClientRect();
  vista.x -= ((despues.x - antes.x) / caja.width) * vista.w;
  vista.y -= ((despues.y - antes.y) / caja.height) * vista.h;
  aplicarVista();
  if (antes.d && despues.d) {
    escalar(antes.d / despues.d, enUnidades({ clientX: despues.x, clientY: despues.y }));
  }
});
function soltarPuntero(e, cancelado) {
  if (!punteros.delete(e.pointerId)) return;
  if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
  if (arrastreTirador) {
    terminarArrastreTirador(!cancelado, e);
    return;
  }
  if (arrastreMesa) {
    terminarArrastreMesa(!cancelado);
    return;
  }
  if (punteros.size) return;   // queda un dedo: el gesto sigue
  svg.classList.remove('arrastrando');
  // Un rectangulo solo cuenta si hubo arrastre de verdad: un temblor de la mano al
  // hacer clic no puede comerse el clic (que selecciona la banda o toca la butaca).
  const rectangulo = arrastre && arrastre.movido > 4 &&
    ((arrastre.marco && arrastre.marco.hasta && 'marco') || (arrastre.area && arrastre.area.hasta && 'area'));
  if (arrastre && (arrastre.marco || arrastre.area)) dibujarArea(null);
  if (rectangulo) {
    const gesto = arrastre[rectangulo];
    const caja = areaDeCeldas(gesto.desde, gesto.hasta);
    if (!cancelado) {
      if (rectangulo === 'marco') aplicarMarco(caja, gesto.suma);
      else aplicarArea(caja, gesto.alt);
    }
    arrastre = null;
    return;
  }
  // Un arrastre no debe contar como clic sobre la butaca que quedo debajo.
  if (!cancelado && arrastre && arrastre.movido <= 4) {
    // En el editor, un clic en el fondo selecciona la banda de debajo (y otro clic,
    // la que la contiene); con la herramienta de bloqueo, el clic en una butaca la
    // bloquea o desbloquea.
    if (modo === 'editor' && !conButacas()) seleccionarBandaEnPlano(arrastre.celda);
    else if (arrastre.tablero && !arrastre.butaca) alternarMesaPorTablero(arrastre.tablero.dataset.pieza);
    else alternar(arrastre.butaca);
  }
  arrastre = null;
}
svg.addEventListener('pointerup', (e) => soltarPuntero(e, false));

function seleccionarBandaEnPlano(c) {
  const id = c && Number.isFinite(c.x) ? bandaEnCelda(salaActual, c.x, c.y, bandaActiva) : null;
  if (!id) {
    marcarActiva(null);
    marcarBandaActiva(null);
    return;
  }
  marcarBandaActiva(id);
  anunciar(bandaDe(salaActual, id).nombre + ' seleccionada.');
}

// Doble clic en un subtitulo: selecciona su banda y lleva a su nombre en el panel.
svg.addEventListener('dblclick', (e) => {
  if (modo !== 'editor' || conButacas()) return;
  const subtitulo = e.target.closest('[data-subtitulo]');
  if (!subtitulo) return;
  const id = subtitulo.dataset.subtitulo;
  marcarBandaActiva(id);
  const campo = listaBandas.querySelector('input[data-op="nombre"][data-banda="' + id + '"]');
  if (campo) {
    campo.focus();
    campo.select();
  }
});
svg.addEventListener('pointercancel', (e) => soltarPuntero(e, true));

document.getElementById('acercar').addEventListener('click', () => escalar(1 / 1.3));
document.getElementById('alejar').addEventListener('click', () => escalar(1.3));
document.getElementById('ajustar').addEventListener('click', () => {
  vista = { ...vistaInicial };
  aplicarVista();
});

// ---------------------------------------------------------------------------
// Seleccion y teclado
// ---------------------------------------------------------------------------
const porNodo = (elemento) => porId.get(elemento.dataset.id);

function alternar(elemento) {
  if (modo === 'editor') {        // en el editor no se elige: se coloca o se bloquea
    if (herramienta === 'bloquear' && elemento) alternarBloqueo(elemento);
    if (herramienta === 'zona' && elemento) pintarZona(elemento);
    return;
  }
  const b = elemento && porNodo(elemento);
  const elegida = alternarEleccion(elegidas, b, butacas);
  if (elegida === null) return;
  // El DOM refleja el dato; nunca se lee de vuelta. En una mesa completa cambian todos
  // sus lugares y el tablero.
  const afectadas = b.grupo && b.grupo.completa ? lugaresDeMesa(b.grupo.id, butacas).filter((x) => x.estado === 'libre') : [b];
  for (const x of afectadas) {
    // La palomita de una butaca libre no existe hasta que se elige.
    if (elegida) ponerMarca(x);
    x.nodo.classList.toggle('elegida', elegida);
    x.nodo.setAttribute('aria-checked', String(elegida));
  }
  if (b.grupo && b.grupo.completa) marcarTableroElegido(b.grupo.id, elegida);
  actualizarResumen();
}

function marcarTableroElegido(id, elegida) {
  for (const n of capaMuebles.querySelectorAll('.mueble[data-pieza="' + id + '"]')) n.classList.toggle('elegida', elegida);
}

// Clic en el tablero de una mesa completa: la elige como si fuera uno de sus lugares.
function alternarMesaPorTablero(id) {
  const primera = butacas.find((b) => b.grupo && b.grupo.id === id && b.grupo.completa && b.estado === 'libre');
  if (primera) alternar(primera.nodo);
}

function moverFoco(desde, dx, dy) {
  const origen = porNodo(desde);
  if (!origen) return;
  const candidatas = butacas.filter((b) => (dx
    ? Math.sign(b.x - origen.x) === dx && b.y === origen.y
    : Math.sign(b.y - origen.y) === dy));
  if (!candidatas.length) return;
  const destino = candidatas.reduce((mejor, b) => {
    const d = Math.abs(b.x - origen.x) + Math.abs(b.y - origen.y) * 1.5;
    return d < mejor.d ? { b, d } : mejor;
  }, { b: null, d: Infinity }).b;
  if (!destino) return;
  destino.nodo.focus();   // el tabindex y el encuadre los ajusta 'focusin'
}

// Desplaza el viewBox lo justo para que la caja (en celdas) quede dentro, con
// media celda de margen. Sin esto, con zoom, el foco podia irse fuera de vista.
function asegurarVisible({ x: cx, y: cy, w = 1, h = 1 }) {
  const margen = PASO / 2;
  const x = cx * PASO, y = cy * PASO, ancho = w * PASO, alto = h * PASO;
  if (x - margen < vista.x) vista.x = x - margen;
  else if (x + ancho + margen > vista.x + vista.w) vista.x = x + ancho + margen - vista.w;
  if (y - margen < vista.y) vista.y = y - margen;
  else if (y + alto + margen > vista.y + vista.h) vista.y = y + alto + margen - vista.h;
  aplicarVista();
}

// El foco puede llegar por flechas o por clic: en ambos casos el elemento
// enfocado pasa a ser el unico punto de tabulacion de su capa (butacas en la
// previsualizacion, mesas en el editor).
svg.addEventListener('focusin', (e) => {
  const elemento = e.target.closest('.butaca, .pieza');
  if (!elemento) return;
  for (const n of elemento.parentNode.querySelectorAll('[tabindex="0"]')) {
    if (n !== elemento) n.setAttribute('tabindex', '-1');
  }
  elemento.setAttribute('tabindex', '0');
  // Durante un clic no se reencuadra: moveria el plano bajo el puntero y el
  // arrastre, que parte de la vista anterior, lo haria saltar.
  const esPieza = elemento.classList.contains('pieza');
  // Tocar una pieza que ya está en la selección no la deshace: pasa a ser la principal,
  // que es lo que deja arrastrar el grupo desde cualquiera de las suyas.
  if (esPieza && piezasActivas.has(elemento.dataset.pieza)) {
    mesaActiva = elemento.dataset.pieza;
    actualizarControles();
  } else if (esPieza) {
    marcarActiva(elemento.dataset.pieza);
  }
  if (arrastre || arrastreMesa) return;
  const m = esPieza && piezaPorId(elemento.dataset.pieza);
  const caja = m ? { x: m.x, y: m.y, w: m.geo.ancho, h: m.geo.alto } : porNodo(elemento);
  if (caja) asegurarVisible(caja);
});

svg.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && arrastreTirador) {
    e.preventDefault();
    terminarArrastreTirador(false);
    anunciar('Cambio de tamaño cancelado.');
    return;
  }
  if (e.key === 'Escape' && arrastreMesa) {
    e.preventDefault();
    terminarArrastreMesa(false);
    anunciar('Movimiento cancelado.');
    return;
  }
  const pieza = e.target.closest('.pieza');
  if (pieza) {
    const id = pieza.dataset.pieza;
    const flecha = FLECHAS[e.key];
    const accion = ATAJOS[e.key];
    if (flecha) {
      e.preventDefault();
      moverMesaConTeclado(id, flecha);
    } else if (accion) {
      e.preventDefault();
      ejecutarAccion(accion, id);
      // El DOM se rehizo: el foco vuelve a la pieza activa (la copia, al duplicar), o
      // a la primera si se elimino.
      const destino = capaPiezas.querySelector('[data-pieza="' + (mesaActiva || id) + '"]') ||
                      capaPiezas.querySelector('.pieza');
      if (destino) destino.focus();
    }
    return;
  }
  const elemento = e.target.closest('.butaca');
  if (!elemento) return;
  const porArea = modo === 'editor' && conButacas();
  if (e.key === 'Escape' && areaTeclado) {
    e.preventDefault();
    limpiarArea();
    anunciar('Área cancelada.');
    return;
  }
  // Con una herramienta de butacas, la barra mueve el plano mientras se pinta por
  // area: ahi no activa la butaca enfocada, que se aplica con Enter.
  if (e.key === ' ' && porArea) {
    e.preventDefault();
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    // Con un área extendida con Mayús, Enter la aplica (Alt+Enter la deshace).
    if (areaTeclado && areaTeclado.hasta) {
      const area = areaDeCeldas(areaTeclado.desde, areaTeclado.hasta);
      const id = porNodo(elemento).id;
      limpiarArea();
      aplicarArea(area, e.altKey);
      const vuelta = porId.get(id);
      if (vuelta) vuelta.nodo.focus({ preventScroll: true });
      return;
    }
    alternar(elemento);
    return;
  }
  const flecha = FLECHAS[e.key];
  if (flecha && e.shiftKey && porArea) {
    e.preventDefault();
    extenderArea(elemento, flecha);
    return;
  }
  if (flecha) {
    e.preventDefault();
    if (areaTeclado) limpiarArea();
    moverFoco(elemento, flecha.dx, flecha.dy);
  }
});

const FLECHAS = {
  ArrowLeft:  { dx: -1, dy: 0, hacia: 'la izquierda' },
  ArrowRight: { dx: 1,  dy: 0, hacia: 'la derecha' },
  ArrowUp:    { dx: 0, dy: -1, hacia: 'arriba' },
  ArrowDown:  { dx: 0, dy: 1,  hacia: 'abajo' },
};
