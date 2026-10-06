# Selector de asientos y conector: guía de integración con Sin Taquilla

Guía del comportamiento implementado hasta el PR #61, fusionado el 6 de octubre de 2026.
Este documento describe el contrato ejecutable del cliente y el procedimiento para conectarlo.
Los ejemplos de rutas son propuestas para el anfitrión, no endpoints existentes del selector.

El proyecto implementa el lado del selector. No modifica Sin Taquilla, su base de datos ni sus
ventas. El anfitrión aún debe implementar administración, endpoints, reservas transaccionales,
caducidad y emisión de boletos. Una selección y su importe en pantalla no son una reserva.
El mapa físico se construye y conserva por separado de la configuración de cada evento.

## Cómo funciona y qué conserva cada sistema

| Componente | Qué hace y qué conserva |
| --- | --- |
| Editor del recinto | Diseña niveles, regiones, escenario, filas, curvas, mesas y palcos. Guarda geometría, inventario, pertenencias e identificación oficial. |
| Visor autónomo | Importa el JSON físico y permite previsualizar lugares. Sin evento no ofrece tarifas ni disponibilidad comercial confirmada. |
| Visor conectado | Usa el mapa publicado y los datos del evento; muestra precios, habilitación y disponibilidad. Permite elegir butacas, conjuntos o cantidades generales y calcula el resumen. |
| Conector del selector | Valida los datos comerciales, notifica la selección y consulta/reserva mediante HTTP del mismo origen. No tiene endpoints propios ni conexión directa a la base de datos. |
| Sin Taquilla | Guarda y sirve mapa y revisión, configura modalidades y precios por evento, mantiene disponibilidad y ejecuta reservas, cobro, caducidad y boletos. |

El dibujo es SVG generado a partir de datos. Un lugar conserva su identidad aunque se mueva,
gire o cambie su etiqueta; nombres y números no son claves de compra. Bandas y regiones ayudan
a editar la distribución, mientras las pertenencias físicas quedan resueltas en el inventario.
El visor permite zoom, desplazamiento, cambio de nivel y exploración de zonas. Explorar resalta
sin comprar; elegir compra según la modalidad del evento. La selección se conserva entre pisos.

El mismo mapa puede usarse en eventos diferentes. Sin Taquilla puede cambiar configuración
comercial sin modificar dimensiones, curvas, iconos, números ni IDs físicos del recinto.
Una zona no se vuelve general por llamarse «General» o «Galería»: lo declara el evento v2.

## Versiones: no confundir archivo, API, revisión y disponibilidad

| Dato | Versión actual / significado |
| --- | --- |
| Mapa físico | `formato: "selector-asientos/mapa"`, versión 8. Contiene todos los niveles del recinto. |
| Catálogo físico | `formato: "selector-asientos/lugares"`, versión 5. Identidad, ubicación y condición por lugar; no tarifas. |
| Snapshot comercial | `formato: "sintaquilla/evento-asientos"`, versión 2 recomendada. Versión 1 sigue admitida para venta por lugares/conjuntos. |
| API pública | `window.SelectorAsientos.version === 2`. No es la versión del mapa. |
| Revisión física | `recintoId`, `numero`, `estado` y `huella`. El evento queda asociado a una revisión publicada concreta. |
| Versión comercial | `evento.versionEstado`. Aumenta al cambiar configuración o disponibilidad del evento; no cambia la revisión física. |

Usar el catálogo de la misma revisión para resolver los IDs. No sustituir el mapa de un evento
publicado por un borrador ni por otra revisión aunque conserve muchos IDs. El servidor conserva
la ubicación y el precio históricos de cada boleto.

## Preparar el mapa e instalar el visor

1. En `index.html`, importar el mapa en el editor. Revisar inventario, zonas físicas y nombres,
   niveles, grupos y numeración oficial cuando corresponda. En general pueden conservarse
   referencias provisionales internas, que no se ofrecerán como asientos asignados.
2. Confirmar las asignaciones físicas heredadas que el editor marque como pendientes. La
   publicación valida identidad, ubicación, etiquetas y geometría; no inventa numeración oficial.
3. Usar **Congelar y exportar revisión** y obtener el JSON publicado. Exportar también el
   catálogo con **Validar y exportar catálogo de lugares**, a partir de esa misma revisión.
   Un mapa con `revisionFisica.estado: "borrador"` no se puede conectar a una venta.
4. Registrar mapa y catálogo en Sin Taquilla. Generar sus identidades opacas de evento para
   lugares asignados, grupos y zonas generales; no transformar los números visibles en IDs.
5. Ejecutar `node construir.mjs` y `node construir.mjs --check`. Desplegar juntos los tres
   archivos de `integracion/`: `index.html`, `selector-asientos.css` y `selector-asientos.js`.
   Conservar sus rutas relativas; no mezclar JS de una versión con HTML de otra.
6. Servir esa página bajo el mismo origen que los endpoints del evento y la sesión del comprador.
   Añadir el arranque del anfitrión en un JS externo, después del JS del selector, con `defer`.
   Para cambiar esta página desde el proyecto, editar fuentes y regenerar; no editar salidas generadas.

El visor espera el documento completo de `integracion/index.html`; no basta copiar su SVG a
otra página. No hay una API para montar varios selectores ni para configurar un componente
por instancia. Un cambio de despliegue debe mantener el DOM y recursos esperados por el motor.

## Entrega y seguridad

`node construir.mjs` produce el `index.html` autónomo y tres archivos sincronizados en
`integracion/`: HTML, CSS y JavaScript externos. `--check` comprueba las cuatro salidas.
Sin Taquilla puede servir el HTML en una ruta del mismo origen, agregando su arranque desde
otro archivo JavaScript externo, cargado después de `selector-asientos.js` con `defer`.
El documento incluye los controles del editor; al conectar un evento queda en compra con
recinto fijo y editor deshabilitado. No es un componente que se monte varias veces en una página.

No relajar `style-src 'self'` ni `script-src 'self'`. No se necesita `unsafe-inline`, `eval`,
CDN ni dependencias. Usar una página propia. Si el anfitrión aplica `frame-ancestors 'none'` a
esta entrega, no podrá incrustarse en un iframe. Los recursos externos conservan el mismo motor que la entrega
autónoma. El anfitrión protege las rutas administrativas y las operaciones del servidor;
deshabilitar controles en el navegador no sustituye permisos.

El editor conserva precios antiguos solo como antecedentes. No se escriben tarifas, estados,
configuraciones ni credenciales del evento en el mapa o en `localStorage`.

## API pública del navegador

El visor incluye exploración de zonas físicas: navega al nivel, encuadra y resalta sin elegir
lugares. Su resumen por zona y piso deriva habilitación, comprables y tarifas del snapshot vigente;
para venta agrupada muestra el importe y disponibilidad del conjunto completo. Actualizar el
evento o suspender disponibilidad refresca esa información. No requiere campos adicionales del
conector para zonas asignadas ni altera su solicitud de compra. Sin evento conectado no presenta disponibilidad de
venta ni precios supuestos.

`window.SelectorAsientos.version === 2`. Admite snapshots comerciales 1 y 2; el contrato de
peticiones v1 permanece compatible. Los métodos arrojan `Error` al rechazar datos:

| Método | Función |
|---|---|
| `cargarEvento({ mapa, evento, alSeleccionar? })` | Conecta una revisión publicada y una respuesta completa del evento. Devuelve selección vacía y conteos. |
| `evaluarConfiguracion(mapa, evento)` | Valida y devuelve conteos, nombres físicos de zonas y habilitación/categoría por lugar para el formulario anfitrión. No conecta ni guarda. |
| `actualizarEvento(evento)` | Reemplaza un snapshot validado. Conserva solo selecciones todavía comprables. |
| `seleccion()` | Devuelve `{ solicitud, cantidad, totalCentavos, conteos }`, copiados, sin referencias mutables al motor. |
| `cantidadGeneral(zonaId, cantidad)` | Cambia una cantidad entera usando el ID físico de zona. Cero la quita; desconocido, sobrecupo o zona asignada se rechazan. También puede elegirse desde el visor. |
| `refrescar({ url, signal? })` | GET de disponibilidad, con cookies del mismo origen y sin caché. Devuelve una promesa de `{ seleccion }`. |
| `reservar({ url, csrf, requestKey?, signal? })` | POST de IDs seleccionados. Devuelve `{ seleccion, resultado }` tras validar la respuesta de disponibilidad. |
| `cerrarEvento()` | Descarta datos comerciales y restaura el recinto y selección previos de la vista autónoma. |

El callback `alSeleccionar` y el evento DOM `selector-asientos:seleccion` reciben la selección
después de cargar, elegir o actualizar disponibilidad. Cambiar de nivel conserva el conjunto
global. El anfitrión es quien ofrece el botón de continuar, datos del comprador, cobro y recibo.
Los errores del callback pertenecen al anfitrión; no introducir HTML sin escapar en su interfaz.

Ejemplo de arranque, **dentro de un archivo externo**:

```js
const respuesta = await fetch('/ruta-definida-por-sintaquilla', {
  credentials: 'same-origin', cache: 'no-store',
});
if (!respuesta.ok) throw new Error('No se pudo cargar el evento.');
const datos = await respuesta.json();
SelectorAsientos.cargarEvento({
  mapa: datos.mapa,
  evento: datos.evento,
  alSeleccionar: ({ cantidad, totalCentavos }) => actualizarCompra(cantidad, totalCentavos),
});
```

Las rutas del ejemplo no existen todavía. No hay consulta automática de red ni evento deducido
de parámetros de URL. `actualizarCompra` representa una función del anfitrión, no de la API:
debe implementarse allí u omitirse `alSeleccionar` al cargar. El ejemplo de la sección siguiente
conecta sin depender de esa función.

El anfitrión asigna endpoints y suministra el CSRF de su sesión en la
cabecera `X-CSRF-Token`. El transporte rechaza otro origen, credenciales en URL, fragmentos y
redirecciones; usa `credentials: 'same-origin'`. Permite un POST de reserva en curso a la vez.
Pasar `signal` para cancelar o limitar el tiempo desde el anfitrión. Generar/conservar
`requestKey` para reintentos de la misma operación; si se omite se genera un UUID por llamada.
El servidor debe implementar su idempotencia: el navegador no evita compras duplicadas por sí solo.

## Recorrido de conexión y ejemplos de llamadas

La carga inicial la realiza el anfitrión, con una respuesta `{ mapa, evento }`. El selector no
busca automáticamente un evento ni deduce su identidad desde la URL. Este arranque puede ir
en `arranque-selector.js`, servido después de `selector-asientos.js`:

```js
async function iniciarSelector() {
  const respuesta = await fetch('/api/eventos/evt_ejemplo/selector', {
    credentials: 'same-origin', cache: 'no-store', redirect: 'error',
    headers: { Accept: 'application/json' },
  });
  if (!respuesta.ok) throw new Error('No se pudo cargar el evento.');
  const datos = await respuesta.json();
  return SelectorAsientos.cargarEvento({ mapa: datos.mapa, evento: datos.evento });
}

iniciarSelector().catch(error => {
  document.getElementById('resumen-zona').textContent = error.message;
});
```

Las rutas de estos ejemplos deben implementarse o sustituirse por las reales de Sin Taquilla.
No publicar la página de venta antes de recibir un evento válido: si la carga falla, la vista
autónoma inicial no es una función habilitada para comprar. El botón de continuar pertenece al
anfitrión y debe quedar deshabilitado hasta conectar; validar en servidor sigue siendo obligatorio.

La selección se puede observar sin modificar el selector:

```js
document.addEventListener('selector-asientos:seleccion', ({ detail }) => {
  // detail: { solicitud, cantidad, totalCentavos, conteos }.
  // Aquí Sin Taquilla actualiza su interfaz de compra, sin guardar datos en el mapa.
  console.info('Entradas seleccionadas:', detail.cantidad);
});
```

El evento DOM y el callback pueden dispararse varias veces por una interacción o actualización;
tratarlos como notificaciones de estado, no como instrucciones para crear una orden. Los cambios
de tarifa pueden conservar la selección válida y actualizar el total: antes de cobrar, el
anfitrión debe confirmar el importe calculado por su servidor.

Para actualizar disponibilidad, desde el botón de reconsulta o el mecanismo del anfitrión:

```js
const { seleccion: seleccionActualizada } = await SelectorAsientos.refrescar({
  url: '/api/eventos/evt_ejemplo/disponibilidad',
  signal: AbortSignal.timeout(15000),
});
// El GET debe responder { evento: snapshotCompleto }, sin necesidad de otro mapa.
```

No hay sondeo automático ni intervalos internos. El anfitrión decide cuándo refrescar y cómo
mostrar los errores de la promesa. `signal` es opcional; puede usarse un `AbortController` si
los navegadores del despliegue no admiten `AbortSignal.timeout`.

Si Sin Taquilla recibe datos por otro canal, puede llamar a `actualizarEvento(snapshotCompleto)`
directamente; el mismo motor valida revisión, IDs, versión y selección. Nunca escribir estados
en el SVG ni modificar las variables internas del selector desde el anfitrión.

Para pedir una reserva, desde el flujo de compra del anfitrión:

```js
async function reservarSeleccion(csrf, requestKey) {
  if (!SelectorAsientos.seleccion().cantidad) throw new Error('Elige entradas antes de continuar.');
  const respuesta = await SelectorAsientos.reservar({
    url: '/api/eventos/evt_ejemplo/reservas',
    csrf, requestKey, signal: AbortSignal.timeout(15000),
  });
  // respuesta.seleccion ya refleja el snapshot confirmado.
  // respuesta.resultado lo define Sin Taquilla: por ejemplo, ID de reserva y vencimiento.
  return respuesta.resultado;
}
```

El token CSRF lo obtiene el anfitrión de su sesión; no se incluye en el mapa ni se persiste
mediante el selector. `requestKey` debe tener de 16 a 100 caracteres ASCII alfanuméricos,
guion o guion bajo. Si se omite, el cliente usa `crypto.randomUUID()`, que requiere un contexto
seguro del navegador. Desplegar compra mediante HTTPS. Conservar la clave en el flujo de la orden.

Tras una reserva, Sin Taquilla decide la navegación a pago; el selector no navega ni emite boletos.
Si falla el POST, no asumir que el servidor no reservó: reconsultar el estado de la operación
por su clave antes de crear otra intención de compra. Las selecciones pueden haberse soltado;
el conector no guarda una orden ni reenvía automáticamente la petición anterior.

## Snapshot completo, versión 1

[Ejemplo ejecutable](ejemplo-conector-evento.json): recinto ficticio de tres niveles, fila entre
sectores, mesa y palco. Sus IDs públicos son datos de prueba, no identificadores de producción.
Incluye mapa v8 publicado y esta estructura comercial independiente:

```json
{
  "formato": "sintaquilla/evento-asientos",
  "version": 1,
  "evento": {
    "id": "evt_opaco", "nombre": "Función", "moneda": "MXN", "versionEstado": 1,
    "revision": { "recintoId": "recinto_...", "numero": 1, "huella": "..." }
  },
  "categorias": [
    { "id": "ett_opaca", "nombre": "Preferente", "precioCentavos": 35000, "activa": true }
  ],
  "asignaciones": [{ "tipo": "zona", "id": "luneta", "categoriaId": "ett_opaca" }],
  "exclusiones": { "nivel": [], "zona": [], "sector": [], "fila": [], "grupo": [], "lugar": [] },
  "grupos": [{ "id": "palco1", "event_group_id": "eg_opaco", "modalidad": "completa" }],
  "lugares": [{ "local_place_id": "F1-1-1", "event_place_id": "ep_opaco", "estado": "libre" }]
}
```

Este fragmento ilustra los campos; para funcionar debe contener **todos** los grupos y lugares
del catálogo y tarifas para cada lugar habilitado. El catálogo físico se obtiene con
`exportarLugaresDeMapa` o la publicación del editor. El formulario usa IDs, no nombres, letras,
coordenadas ni índices de dibujo. Nombre de zona viene del recinto; nombre de categoría comercial
y precio vienen del evento. No sobrescribir un nombre físico al cambiar una tarifa.

- Revisión: mismo `recintoId`, número y huella del mapa publicado. La huella comprueba integridad
  local; no es una firma ni autoriza un mapa enviado por un comprador.
- Categorías: hasta 20, como el límite actual leído en `EVENT_TICKET_TYPE_LIMIT` de Sin Taquilla.
  Varias zonas pueden compartir una categoría. Precio entero en centavos, de 0 a 100.000.000;
  `0` es gratuito explícito. Ausencia, `null`, fracciones o categoría inactiva no habilitan venta.
- Asignaciones: tipo `nivel`, `zona`, `sector`, `fila`, `grupo` o `lugar`. Si varias referencias de
  un lugar apuntan a categorías distintas se rechaza, sin prioridad por orden. Para dividir una
  zona entre tarifas, quitar su asignación general y asignar sus subconjuntos sin contradicciones.
- Exclusiones: listas singulares de los mismos seis tipos, completas aunque estén vacías. La unión
  de exclusiones prevalece; no existe una inclusión inferior que reabra un lugar. Cerrar un sector
  de una fila compartida solo afecta a sus miembros. Un lugar bloqueado físicamente no se reabre.
- Grupos: todos los físicos, con ID opaco de evento y modalidad `individual` o `completa`.
  Los requeridos se deducen de **todos los integrantes físicamente utilizables** de esa revisión.
  No se aceptan requeridos enviados para reducir el conjunto. Exclusión, reserva, venta o estado
  desconocido de uno requerido impide comprar el conjunto completo. Los inutilizables físicos
  siguen inventariados, pero no son requeridos. Un grupo sin utilizables no es comprable.
- Lugares: identidad del evento para cada lugar inventariado, incluidos excluidos/inutilizables.
  Estados: `libre`, `reservado`, `vendido`, `desconocido`. Estado omitido equivale a desconocido;
  no se omite la correspondencia de IDs. IDs opacos únicos entre lugares y grupos, estables en
  todas las actualizaciones del mismo evento. No usar IDs internos de base de datos.
- `versionEstado`: entero seguro no negativo. Incrementar cuando cambie cualquier dato observable
  comercial. Una versión igual con datos iguales confirma sin perder selección; una igual con
  datos diferentes se rechaza. Versiones anteriores y respuestas de otra sesión/evento se rechazan.
  Las respuestas son snapshots completos; no se interpretan como parches.

Las identidades opacas de evento/categoría/lugar/grupo/zona general usan entre 3 y 100
caracteres ASCII: empiezan por letra y continúan con letras, números, guion o guion bajo.
No usar etiquetas como «A-1», posiciones o IDs de base de datos como identidad pública de compra.
Todos los precios están en **centavos enteros MXN**; actualmente no se admiten otras monedas.

Conteos: inventariados, utilizables, habilitados, libres, comprables y conjuntos completos
comprables. Un integrante libre puede no ser comprable si falla su conjunto. Reservar y vender
no reducen capacidad física. La exclusión no elimina lugares. Un cambio de modalidad nunca
completa automáticamente una selección parcial: la suelta y exige elegir de nuevo.

## Snapshot completo, versión 2: zonas asignadas y acceso general

[Ejemplo ejecutable de venta mixta](ejemplo-conector-general.json). Conserva categorías,
exclusiones, grupos, revisión y versión de estado de v1 y añade una lista completa de zonas:

```json
"zonas": [
  { "id": "luneta", "modalidad": "asignada" },
  { "id": "mesas", "modalidad": "asignada" },
  { "id": "general", "modalidad": "general", "event_zone_id": "ez_opaca",
    "categoriaId": "ett_general", "cupo": 3, "disponibles": 2 }
]
```

- Una entrada por cada zona del mapa, incluso vacía o cerrada. Nombres físicos vienen del mapa.
  Modalidades: `asignada` y `general`. No se guardan en el JSON físico.
- `event_zone_id` es único entre zonas generales, lugares y grupos del evento. Conservarlo y
  conservar la modalidad durante actualizaciones. Cambiarlos requiere cargar una sesión nueva;
  eso no autoriza al servidor a transformar un evento con ventas o reservas existentes.
- `cupo` es entero entre cero y la cantidad de lugares utilizables no excluidos de esa zona.
  Permite ofrecer menos entradas sin eliminar butacas. Excluir zona/nivel/sector/fila/lugar reduce
  el máximo físico; el servidor debe enviar un cupo coherente. Cerrar toda la zona requiere cupo cero.
- `disponibles` es entero entre cero y cupo, o `null` si no está confirmado. No se calcula contando
  iconos, no se duplica por nivel y nunca reduce cupo. Reservas, ventas y bloqueos comerciales
  reducen disponibilidad en el servidor. El conteo agregado suma disponibilidad confirmada;
  una zona desconocida aporta cero comprables y se indica como sin confirmar.
- Tarifa general: `categoriaId` de la zona, activa para cualquier cupo positivo. Cero centavos
  es gratuito explícito. No enviar asignaciones de tarifa que apliquen a sus butacas, tampoco
  por nivel o fila compartidos: son contradictorias con esta modalidad y se rechazan.
- `lugares` contiene únicamente los lugares de zonas asignadas, incluidos sus excluidos e
  inutilizables; todos requieren ID opaco. Los generales no reciben `event_place_id` ni estado
  de venta individual. Permanecen en el catálogo físico, para capacidad y representación.
- Mesas y palcos usan la política por grupo existente. No se admite convertir una zona con
  grupos físicos a acceso general en esta versión. En zonas asignadas, venta completa/individual
  mantiene sus validaciones anteriores.

En el visor, pulsar una referencia de butaca general abre el control de cantidad, no selecciona
esa butaca. Se ocultan números, etiquetas individuales y marcas de venta por lugar; quedan
geometría, nombre físico y contorno de la zona. Las etiquetas del inventario se conservan para
una futura función asignada; las provisionales deben verificarse antes de usarlas como oficiales.
Seleccionar cantidades no cambia la revisión, no se guarda en localStorage y comparte resumen
con lugares asignados. Una reducción que invalida la cantidad la suelta entera, sin recortarla.

## Peticiones y respuesta de transporte

GET devuelve `{ "evento": <snapshot> }`. POST envía únicamente:

```json
{
  "event_id": "evt_opaco",
  "revision": { "recintoId": "recinto_...", "numero": 1, "estado": "publicada", "huella": "..." },
  "state_version": 1,
  "event_place_ids": ["ep_opaco"],
  "event_group_ids": ["eg_opaco"],
  "request_key": "clave_idempotente_..."
}
```

En v2 añade `"accesos_generales": [{ "event_zone_id": "ez_opaca", "cantidad": 2 }]`, o una lista
vacía si no hay cantidades. No envía IDs de butacas generales, filas, números ni precios.
`cantidad` es la intención de compra, no una autorización de cupo: el servidor la verifica.
V1 conserva exactamente sus campos anteriores, sin `accesos_generales`.

No envía precios como autoridad ni IDs físicos para resolver una compra. El importe
de pantalla suma los lugares elegidos, incluso conjuntos con distintas categorías si no hay
contradicciones por lugar. Un POST satisfactorio debe devolver
`{ "evento": <snapshot confirmado>, "resultado": <respuesta del anfitrión> }`.
El conector devuelve `resultado` al anfitrión, sin interpretarlo como pago o boleto emitido.
El servidor debería marcar los lugares retenidos como reservados; el selector los suelta y avisa.
Para general, debe descontar las entradas retenidas del saldo y devolver el snapshot completo
con versión de estado actualizada. El cliente suelta las cantidades enviadas tras éxito, incluso
si el saldo aún permite repetirlas. No elimina una cantidad posterior diferente a la enviada.

HTTP 409, error de red, cancelación, JSON/snapshot inválido o error HTTP suspenden la disponibilidad
actual y sueltan selecciones cuando la consulta sigue siendo la vigente. El plano no inventa libres.
Una consulta posterior válida puede recuperar la misma versión después de perder disponibilidad.
Una respuesta tardía de una sesión cerrada no modifica otra sesión. El anfitrión muestra el error
de la promesa y ofrece reconsultar; no reintenta compras automáticamente. No devolver errores SQL,
secretos o datos personales como mensajes públicos.

## Trabajo del lado de Sin Taquilla

Las referencias a archivos y funciones de aquel servidor en esta sección son antecedentes de
una lectura histórica, no una API que este repositorio provea ni una garantía de su estado actual.
La lectura local fue de `docs/variantes-selector-asientos`, HEAD `cac1455a`, con cambios sin commit
en eventos, ventas y esquema. No se tocaron esos archivos. Revisar su estado actual antes de aplicar
esta guía; la propuesta anterior de filas/columnas no representa por sí sola los niveles y grupos v5.

1. En administración de eventos, seleccionar recinto y **revisión publicada**, recuperar catálogo
   y mostrar sus zonas/niveles/sectores/filas/grupos. Registrar el mapa y su catálogo en el servidor;
   validar la organización propietaria y permisos. Materializar IDs opacos del evento.
2. Administrar categorías usando el modelo existente de `event_ticket_types`; vincularlas al
   inventario habilitado. Mostrar cupos derivados, no un aforo manual contradictorio. Añadir
   exclusiones y modalidad por grupo. `evaluarConfiguracion` ayuda a previsualizar; el servidor
   repite la validación. Si se requieren más de 20 categorías, ampliar y versionar ambos lados.
3. Persistir revisión congelada, configuración, habilitación y estados. Con reservas/ventas, impedir
   excluir lugares comprometidos, retirar su grupo o cambiar modalidad incompatible sin un flujo
   explícito que resuelva las operaciones existentes. Conservar ubicación y precio históricos.
4. Registrar endpoints en `app/Api/Routes.php` con métodos, roles y CSRF; filtrar organización desde
   sesión, no desde petición. La lectura pública entrega solo inventario comercial necesario, sin
   comprador, reserva ajena ni IDs internos. Web y POS comparten reglas.
5. En la transacción de venta, expandir grupos desde el servidor, rechazar duplicados e intersecciones
   lugar/grupo, comprobar evento/revisión/habilitación/categorías/condición física, bloquear todos
   los lugares requeridos en orden estable con `FOR UPDATE`, y rechazar toda la operación si uno falla.
   Comprobar también cupos, bolsa/plan, canales, máximos y estado del evento. No recortar conjuntos.
6. Usar `resolve_ticket_selection()` y `insert_order_with_tickets()` como puntos comunes existentes;
   no crear un segundo flujo de órdenes. Precio, cantidades, comisiones y asistentes se calculan
   en servidor. Registrar una referencia y ubicación histórica por boleto; conjunto suma sus
   lugares y emite un boleto/QR por lugar según el contrato vigente.
7. Integrar caducidad, cancelación, reembolso y lectura de disponibilidad con los mismos estados
   transaccionales. Mantener el modo heredado `seat_assignation` y boletos históricos separados
   de eventos con mapa; no regenerar etiquetas `S-...` para nuevas butacas físicas.
8. Probar con MySQL/MariaDB: compras concurrentes del mismo lugar/conjunto, expiración y reintentos
   idempotentes, aislamiento entre organizaciones, evento parcial, cupos generales junto con
   numerados, historial y accesos. No ejecutar migraciones en producción sin su procedimiento.

Para acceso general v2, Sin Taquilla debe resolver el ID opaco de zona, validar cantidad positiva
y reservar cupo atómicamente junto con cualquier lugar/grupo de la misma orden. Emitir entradas
con zona y modalidad general, sin fila/butaca asignadas. Caducidad/cancelación libera cantidades;
los reintentos idempotentes no deben volver a descontarlas. La configuración del evento habilita
modalidad, tarifa y cupo sin editar geometría, IDs ni revisión del recinto. Estas funciones son
trabajo del otro proyecto; aquí se implementa únicamente su contrato y comportamiento cliente.

Las pruebas de este repositorio verifican el cliente con respuestas HTTP de ejemplo y CSP.
**No demuestran atomicidad, autenticación ni venta real del servidor.** Esas pruebas pertenecen
al proyecto Sin Taquilla y son necesarias antes de poner la integración en servicio.

## Diagnóstico de problemas comunes

| Síntoma o rechazo | Qué revisar |
| --- | --- |
| No existe `window.SelectorAsientos` | Ruta del JS, carga con `defer`, orden del arranque, CSP y que los tres recursos correspondan a la misma versión. |
| Evento requiere revisión publicada | Se entregó un borrador; publicar en el editor y asociar el evento a ese JSON y catálogo. |
| Evento corresponde a otra revisión | Comparar `recintoId`, `numero` y `huella` del mapa publicado con `evento.revision`; no recalcular la huella en el cliente de compra. |
| Faltan modalidades de zonas | V2 necesita una entrada para cada zona física, incluso vacía o cerrada. |
| Faltan identidades de lugares | Falta un lugar asignado, incluido excluido/inutilizable. Los generales se omiten de `lugares` v2. |
| Tarifa general por zona, sin tarifas por butaca | Quitar las asignaciones que alcanzan butacas generales, incluso las de nivel/fila compartidos; usar su `categoriaId` de zona. |
| Tarifas contradictorias | Dos referencias del mismo lugar asignan categorías distintas. El orden de asignación no resuelve el conflicto. |
| Cupo general superior a capacidad | Recontar utilizables no excluidos; el cupo ofrecido no puede excederlos y el saldo no puede exceder el cupo. |
| Misma versión contiene datos diferentes | Incrementar `versionEstado` cuando cambie precio, habilitación, modalidad de grupo o disponibilidad; no reutilizar versiones para snapshots distintos. |
| Cambió modalidad o identidad de zona | Mantenerlas estables durante actualizaciones; para otra configuración cargar explícitamente una nueva sesión, con las restricciones del servidor sobre ventas previas. |
| URL rechazada o falta CSRF | Endpoint HTTP(S) del mismo origen, sin credenciales/fragmento; token válido del anfitrión para POST. No redirigir a login: responder el error HTTP apropiado. |
| Galería muestra datos de butaca | Se abrió solo el mapa, se envió v1 o se declaró la zona como asignada. Para general usar snapshot v2 y modalidad de zona `general`. |
| Entrada gratuita no seleccionable | Precio cero no abre la zona: revisar cupo, saldo confirmado, exclusiones, condición física y categoría activa. |

## Comprobación de la integración

Antes de conectar un recinto real, usar [el ejemplo v1](ejemplo-conector-evento.json) y
[el ejemplo v2 mixto](ejemplo-conector-general.json). Cada archivo contiene `mapa`, `evento`
y `esperado`; los dos primeros se pasan a `cargarEvento` y el tercero describe los conteos
iniciales. Son datos ficticios de prueba, no tarifas ni configuración del Clavijero.

1. Cargar mapa publicado y snapshot íntegro; comprobar editor cerrado y conteos iniciales.
2. Elegir una butaca asignada, un palco completo y entradas generales; verificar resumen,
   total en centavos, IDs opacos y ausencia de números de butaca para general.
3. Cambiar de nivel y explorar otra zona; la compra debe conservarse sin duplicar cupos.
4. Cerrar una zona o reservar un integrante del grupo; el cliente debe soltar selección inválida
   sin completar conjuntos ni reducir silenciosamente cantidades generales.
5. Probar gratis, agotado y desconocido por separado; desconocido no permite comprar.
6. Reservar mediante POST con CSRF y clave; responder un snapshot completo más reciente y el
   resultado de reserva. General suelta lo enviado aunque aún quede saldo; el mapa no cambia.
7. Simular 409, fallo de consulta y respuesta atrasada; recuperar mediante reconsulta válida.
8. Comprobar que no se escriben evento, precios, token ni cantidades en JSON físico/localStorage.
9. En Sin Taquilla, probar competencia por el último asiento/cupo, caducidad, cancelación,
   idempotencia y compra mixta dentro de una transacción. El servidor calcula el precio final.
10. Abrir la entrega con la CSP de producción, en escritorio y móvil, sin recursos inline ni
    violaciones de política; verificar teclado, etiquetas accesibles y selección entre niveles.

Verificación reproducible de este proyecto:

```bash
node construir.mjs --check
node --test pruebas.mjs
node --test pruebas-navegador.mjs
```

Estas comprobaciones validan el selector y sus ejemplos de transporte. Conectar el sistema
real requiere los endpoints y la lógica transaccional del anfitrión descritos arriba.
