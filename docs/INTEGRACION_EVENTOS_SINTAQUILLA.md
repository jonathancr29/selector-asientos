# Conector de eventos: entrega para Sin Taquilla (fase 6)

Esta fase implementa el lado del selector. No modifica Sin Taquilla, su base de datos ni sus
ventas. El anfitrión aún debe implementar administración, endpoints, reservas transaccionales,
caducidad y emisión de boletos. Una selección y su importe en pantalla no son una reserva.
El mapa físico se construye y conserva por separado de la configuración de cada evento.

## Entrega y seguridad

`node construir.mjs` produce el `index.html` autónomo y tres archivos sincronizados en
`integracion/`: HTML, CSS y JavaScript externos. `--check` comprueba las cuatro salidas.
Sin Taquilla puede servir el HTML en una ruta del mismo origen, agregando su arranque desde
otro archivo JavaScript externo, cargado después de `selector-asientos.js` con `defer`.
El documento incluye los controles del editor; al conectar un evento queda en compra con
recinto fijo y editor deshabilitado. No es un componente que se monte varias veces en una página.

No relajar `style-src 'self'` ni `script-src 'self'`. No se necesita `unsafe-inline`, `eval`,
CDN ni dependencias. Usar una página propia: la política `frame-ancestors 'none'` de Sin Taquilla
impide incrustarla en un iframe. Los recursos externos conservan el mismo motor que la entrega
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
| `refrescar({ url, signal? })` | GET de disponibilidad, con cookies del mismo origen y sin caché. |
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
de parámetros de URL. El anfitrión asigna endpoints y suministra el CSRF de su sesión en la
cabecera `X-CSRF-Token`. El transporte rechaza otro origen, credenciales en URL, fragmentos y
redirecciones; usa `credentials: 'same-origin'`. Permite un POST de reserva en curso a la vez.
Pasar `signal` para cancelar o limitar el tiempo desde el anfitrión. Generar/conservar
`requestKey` para reintentos de la misma operación; si se omite se genera un UUID por llamada.
El servidor debe implementar su idempotencia: el navegador no evita compras duplicadas por sí solo.

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
