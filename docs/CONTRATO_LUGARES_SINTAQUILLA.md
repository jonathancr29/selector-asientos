# Contrato de lugares para Sin Taquilla (fase 4)

**Estado:** contrato de diseño; todavía no hay integración ni migración de datos.
**Revisado contra:** este selector en `f9be0cb` y la copia local de Sin Taquilla en
`cac1455a` (rama `docs/variantes-selector-asientos`, 25 de septiembre de 2026).

Este contrato complementa la propuesta vigente de Sin Taquilla en
`php-app/docs/ARQUITECTURA_SELECCION_ASIENTOS.md`. Conserva su decisión de vender por **cupo o por
lugar según la categoría**, con una sola transacción de venta para web y taquilla. Define los datos
que faltaban para conectar este plano: zonas, mesas, identidad estable y boletos históricos.

## 1. Situación comprobada

| Sistema | Dato actual | Consecuencia |
| --- | --- | --- |
| Selector | El JSON versión 4 guarda diseño, zonas, piezas, IDs y coordenadas; los lugares se regeneran al abrirlo. | El JSON no es inventario de un evento ni prueba una venta. |
| Selector | `M1-N1`, `F1-1-3` o `luneta-A1` identifican lugares; `x` e `y` los dibujan. | La etiqueta y la posición pueden cambiar sin cambiar el ID. |
| Selector | Las filas frontales se numeran por zona. Las mesas usan el número global de `M1`, y los bloques girados usan una secuencia local. | Es posible repetir una etiqueta visible dentro de una zona. |
| Selector | `zonasDeAsiento` cambia a la vez el nombre de zona y el precio de un lugar, sin renumerarlo. | No permite distinguir un cambio de ubicación de un cambio de tarifa. |
| Sin Taquilla | `event_ticket_types` guarda categoría, cupo y precio; `resolve_ticket_selection()` vende cantidades. | Aún no recibe lugares concretos. |
| Sin Taquilla | `events.seat_assignation` genera etiquetas `S-1`, `S-2`… sin plano. | No identifica una butaca física. Los eventos existentes deben conservar su historial. |
| Sin Taquilla | `tickets.seat_number` admite hasta 30 caracteres; el PDF y el check-in lo muestran. | No basta para una etiqueta completa con zona, mesa y lugar; faltan referencias al lugar. |
| Sin Taquilla | `order_items.unit_price_cents` conserva el importe aplicado en la orden. | Puede seguir siendo la fuente histórica del importe del boleto. |

Los hechos de Sin Taquilla proceden de `php-app/database/schema.sql`,
`php-app/app/TicketTypes.php`, `php-app/app/Checkout.php`, `php-app/app/Api/Sales.php` y
`php-app/app/TicketDelivery.php` en la revisión citada. Su propuesta de arquitectura aún no está
implementada. Un detalle de esa propuesta quedó desactualizado: el contador `S-…` actual toma el
máximo histórico, incluso de boletos cancelados o reembolsados; ya no retrocede al liberar cupo.

## 2. Identidad: qué se vende y qué se imprime

La **unidad de venta numerada es un lugar**, incluso cuando pertenece a una mesa. Cada lugar tiene:

- `local_place_id`: ID estable dentro de una revisión del mapa. Es el ID que ya genera el selector;
  nunca se sustituye por fila, número, nombre o coordenadas.
- `map_revision_id`: revisión publicada e inmutable del diseño del recinto. Es distinta de
  `version: 4`, que solo describe el formato del JSON. Puede ser el ID de una fila versionada de
  `venue_seat_maps` en la propuesta de Sin Taquilla; el nombre aquí es lógico, no un SQL definitivo.
- `event_place_id`: ID opaco de la instancia de ese lugar en un evento. Es el único ID de lugar que
  envía el comprador a la API. Sin Taquilla resuelve y valida en el servidor su evento, revisión,
  categoría y estado.
- `event_table_id`: ID opaco de una mesa en ese evento. Solo solicita la operación de mesa
  completa; el servidor lo expande a los `event_place_id` de todos sus lugares.

La clave de dominio es **`event_id + map_revision_id + local_place_id`**. En la base, una fila de
`event_seats` representa esa clave y debe ser única para el evento. El boleto apunta a esa fila;
un reembolso puede liberar el lugar y originar después otro boleto histórico para la misma fila.
Por eso `UNIQUE(event_id, seat_id)` en *todos* los boletos impediría una reventa legítima. La
exclusividad de la venta activa se garantiza bloqueando y actualizando la única fila de
`event_seats` dentro de la transacción, con una referencia al boleto/orden vigente.

`x`, `y`, el giro y el orden del DOM solo sirven para dibujar. La zona, la fila y el número son
**etiquetas visibles**; no son claves ni autorizan por sí mismos una reserva.

## 3. Ubicación física y tarifa

Cada lugar publicable resuelve dos datos independientes:

| Dato | Función | Ejemplo |
| --- | --- | --- |
| Zona física | Dice dónde sentarse y gobierna la numeración. Su ID y nombre viajan al boleto. | `Luneta`, fila `A`, butaca `3`. |
| Categoría o tarifa del evento | Determina el precio autorizado, cupo y reglas de venta. | `VIP`, `75000` centavos, `MXN`. |

Una zona puede tener varias tarifas y una tarifa puede aplicarse a lugares de distintas zonas. Al
publicar un evento, **cada lugar numerado debe quedar asignado a una categoría activa**. La
categoría y el precio los resuelve Sin Taquilla; el precio del JSON del selector es una referencia
para diseñar y previsualizar, nunca el importe que acepta la API de compra.

Una categoría de **acceso general** sigue vendiéndose por cupo, sin `event_place_id`. Un mismo
evento puede combinarla con categorías de lugares numerados. No se crean asientos ficticios para
ella y su boleto no promete fila, mesa ni butaca.
En una categoría por asiento, el cupo se deriva de los lugares asignados a ella al publicar el
evento; no se escribe otro número independiente.

## 4. Etiqueta visible y reglas de numeración

La publicación exige una etiqueta única para cada lugar dentro del evento y la zona física. Se
conserva el ID local aunque cambie la etiqueta durante la edición de un borrador.

| Tipo | Etiqueta física que se congela al publicar | Regla |
| --- | --- | --- |
| Butaca de fila, bloque o suelta | Zona + fila + número de butaca | Cada zona inicia en `A` y `1`; los bloques girados deben participar en una secuencia inequívoca de su zona. |
| Lugar de mesa | Zona + número de mesa + número de lugar | Las mesas visibles inician en `1` **por zona**. `M…` sigue siendo solo su ID interno. |
| Acceso general | Nombre de categoría, sin lugar | Cantidad y cupo, sin numeración física. |

La propuesta previa de Sin Taquilla sugiere `UNIQUE(map_id, fila, numero)` en el catálogo de
butacas. Esa clave debe incluir la **zona física**: Luneta A1 y Balcón A1 son dos lugares válidos.
Las mesas requieren su propia unicidad por `zona + número de mesa + número de lugar`.

Los números de lugar de mesa se conservan en orden estable dentro de cada mesa. Un nombre propio
de bloque puede mostrarse como orientación adicional, pero no sustituye zona, fila y número ni
permite dos etiquetas idénticas. La validación de publicación normaliza espacios y mayúsculas al
buscar duplicados. Rechaza también zonas vendibles sin nombre significativo; las franjas y los
espacios decorativos pueden seguir sin zona. `Zona`, `Zona 2` y nombres automáticos equivalentes
son provisionales y deben revisarse antes de publicar. Precio `0` es válido para un evento gratuito,
pero debe confirmarse expresamente.

El selector hoy incumple parte de estas reglas en mesas, bloques girados y asignaciones
individuales de zona. La **fase 6** hará la numeración y validación, sin renombrar IDs ni mover
piezas por el mero hecho de cambiar una etiqueta.

## 5. Contrato de lectura y compra

Sin Taquilla publica para el selector una revisión fija del mapa y el estado de sus lugares. Cada
entrada numérica incluye, como mínimo:

```json
{
  "event_place_id": "ep_...",
  "local_place_id": "M2-N1",
  "map_revision_id": "mr_...",
  "physical_zone": { "id": "mesas", "name": "Terraza" },
  "ticket_type_public_id": "ett_...",
  "kind": "table_place",
  "row": null,
  "seat_number": null,
  "table_number": 1,
  "table_place_number": 1,
  "label": "Terraza, mesa 1, lugar 1",
  "unit_price_cents": 75000,
  "currency": "MXN",
  "availability": "free"
}
```

Para butacas, `kind` es `row_seat`, `row` y `seat_number` llevan la fila y el número visibles,
y los campos de mesa son nulos. El mapa aporta las coordenadas para dibujar; la respuesta del
servidor aporta disponibilidad y precio actualizados. La API nunca toma del navegador el precio,
la etiqueta, la zona o las coordenadas como autoridad.

La petición de compra conserva `event_public_id` y la estructura de categorías de Sin Taquilla:

- Categoría por cupo: `ticket_type_public_id` y `quantity`, como hoy.
- Categoría por lugar: `ticket_type_public_id` y lista de `event_place_id`, con un nombre de
  asistente asociado a **cada ID** cuando el evento lo exige. La cantidad se deriva de la lista y
  el servidor rechaza una categoría que no corresponda al lugar.
- Mesa completa: `event_table_id` en lugar de una lista parcial. El servidor expande la mesa y
  agrupa sus lugares por categoría; puede haber diferentes tarifas dentro de ella.
- Ambos tipos pueden ir en una orden. La suma respeta el límite de boletos por orden y las reglas
  de cuota de la organización.

Sin Taquilla comprueba dentro de **una transacción** que todos los lugares pertenecen al evento y
a la revisión publicada, corresponden a la categoría solicitada y están disponibles. Bloquea las
filas de `event_seats` en orden estable, calcula el subtotal con precios de la base, crea la orden y
los boletos y marca los lugares retenidos o emitidos. Web y taquilla usan la misma resolución. Si
falta uno, falla toda la selección y se refresca la disponibilidad. Las retenciones vencidas,
cancelaciones y reembolsos liberan explícitamente sus filas; los boletos antiguos permanecen como
historial. Un boleto usado o disputado no se libera por una lectura o refresco de pantalla.

**Mesa completa:** el servidor expande la mesa a *todos* sus lugares vendibles de esa revisión y
los reserva de forma atómica. Se emite **un boleto y un QR por lugar**; el total es la suma de sus
precios autorizados. No se vende como un boleto único para la mesa. Si un lugar está retenido,
vendido o bloqueado, la mesa completa no está disponible. Una solicitud parcial para una mesa
marcada como completa se rechaza también en la API, aunque el cliente la haya permitido.

## 6. Boletos e historial

`tickets.seat_number` se conserva para boletos existentes y compatibilidad, pero su límite de 30
caracteres no alcanza para la ubicación completa. La integración deberá añadir una referencia
nullable a `event_seats` y una **copia histórica** de `physical_zone_name`, `row`,
`seat_number_visible`, `table_number`, `table_place_number` y `place_label` (o una estructura
equivalente con columnas consultables). El importe histórico sigue en `order_items.unit_price_cents`;
si distintos lugares de una categoría tienen precios distintos, se crean partidas de precio
homogéneo y se conserva la relación de cada boleto con su partida.

El PDF, la vista del boleto, el padrón, el check-in y la respuesta de taquilla leen esa copia para
mostrar **zona, fila/butaca o mesa/lugar**. Los boletos antiguos con `S-…` siguen mostrando su
texto actual; no se reinterpretan como lugares del mapa. Cambiar después un nombre, una tarifa o
un plano nunca reescribe la ubicación ni el precio de una venta anterior.

## 7. Publicación, edición y migración

El editor puede modificar libremente un borrador. Publicar crea una **revisión inmutable** y
materializa las filas de `event_seats` de cada evento que la use. Desde la publicación, el evento
conserva esa revisión de forma permanente, incluso si las retenciones vencen o los boletos se
cancelan o reembolsan. Bloquear o desbloquear lugares cambia disponibilidad, no diseño ni identidad.

Una corrección del recinto crea otra revisión para eventos futuros. Un cambio excepcional en un
evento con ventas requiere una operación de migración explícita que preserve cada lugar vendido y
su etiqueta histórica; queda fuera de esta integración inicial y no debe suceder al guardar un
JSON. Un evento en borrador sin retenciones ni boletos puede sustituir su revisión y reconstruir
sus lugares antes de publicar.

Los mapas JSON v1–v4 siguen importándose en el selector. Para publicarlos, se conservan sus IDs y
posiciones y se ejecuta la nueva validación. `zonasDeAsiento` de mapas antiguos es ambiguo:
pudo significar cambio de ubicación **o** solo de precio. La migración no lo adivina; presenta
esos lugares para que el administrador confirme zona física y tarifa antes de publicar.

El modo heredado `events.seat_assignation` queda separado de los eventos con mapa: no se generan
`S-…` para ellos. Los eventos históricos conservan su comportamiento y sus boletos. Retirar el
interruptor heredado para eventos nuevos se hará junto con la integración, después de ofrecer una
ruta clara para los eventos existentes.

## 8. Condiciones para las fases siguientes

1. **Fase 5:** separar fuentes y estilos sin alterar IDs, JSON ni este contrato. Mantener el HTML
   autónomo como artefacto. La separación se hizo; queda resolver la política de estilos de Sin
   Taquilla al integrarlo.
2. **Fase 6:** exportar lugares desde un mapa validado; exigir zona física y etiqueta únicas;
   numerar mesas por zona; resolver bloques girados y `zonasDeAsiento`; adaptar mapas antiguos sin
   pérdida de IDs.
3. **Fase 7:** migrar esquema y APIs de Sin Taquilla, reservar atómicamente, liberar retenciones y
   actualizar boletos, PDFs, check-in y taquilla. Probar compra mixta, mesa completa, dos compras
   simultáneas del mismo lugar, vencimiento, confirmación de pago tardía tras vencer, reembolso y
   revisión congelada.

Nada de lo anterior sustituye la autorización de Sin Taquilla en cada compra: el selector muestra
una propuesta visual y Sin Taquilla decide la disponibilidad, el importe y el boleto emitido.
