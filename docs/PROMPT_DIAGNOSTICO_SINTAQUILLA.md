# Solicitud a la IA que trabaja en Sin Taquilla

Copia el siguiente mensaje completo y envíalo a la IA que tiene acceso al repositorio de **Sin Taquilla**.

---

Necesito preparar la integración del selector de asientos con Sin Taquilla. **Analiza el estado actual de todo el repositorio de Sin Taquilla y entrega un diagnóstico en un solo archivo Markdown** llamado `docs/DIAGNOSTICO_INTEGRACION_SELECTOR_ASIENTOS.md`. Por ahora haz únicamente análisis: no cambies código, base de datos, configuración ni pruebas; no abras un PR de implementación.

El selector es una aplicación visual con conector cliente, sin servidor de ventas. El mapa físico
vigente es v8 y el catálogo validado es v5: conservan IDs locales estables, geometría, niveles,
zonas, sectores, filas, mesas y palcos, **sin precios ni modalidad comercial activa**. Las
etiquetas oficiales pueden conservarse al mover piezas; una revisión publicada congela su
identidad y ubicación. La API cliente `window.SelectorAsientos` es v2 y admite snapshots
comerciales v1/v2 con categorías, tarifas, modalidades, exclusiones y disponibilidad provistas
por el anfitrión. Consulta y solicita reservas con IDs opacos, pero Sin Taquilla aún debe
implementar o verificar su servidor, sus transacciones, cobros y boletos.

El [contrato de recinto y evento](https://github.com/jonathancr29/selector-asientos/blob/main/docs/CONTRATO_RECINTO_EVENTO.md)
define las reglas de dominio; la [guía de integración](https://github.com/jonathancr29/selector-asientos/blob/main/docs/INTEGRACION_EVENTOS_SINTAQUILLA.md)
describe la API cliente y los ejemplos. El contrato inicial de lugares es histórico. Verifica
la rama y el commit de ambos proyectos antes de atribuir una función a `main`. Contrasta los
documentos con el código de Sin Taquilla: no tomes como existente una ruta o tabla propuesta.

## Qué necesito que investigues

1. **Punto de partida reproducible.** Indica URL del repositorio, rama, SHA del commit revisado, lenguajes y versiones, estructura de aplicaciones, comandos para ejecutar pruebas y migraciones, y qué partes no pudiste verificar. Distingue en todo el documento entre **implementado**, **documentado pero no implementado** e **inferencia**. Para cada afirmación técnica importante, cita archivo y línea o rango corto de líneas.

2. **Modelo de eventos y categorías.** Localiza el esquema real y sus migraciones para recintos, eventos, categorías/tipos de boleto, cupos, precios, órdenes, partidas, boletos, reservas/retenciones y pagos. Indica claves primarias, claves públicas, relaciones, índices y restricciones únicas relevantes. Explica qué significa hoy `events.seat_assignation`, cómo se generan los `S-…` y qué compatibilidad necesitan los eventos y boletos existentes. Confirma si ya existe algún mapa versionado, asiento físico o categoría por lugar.

3. **Flujos de venta existentes.** Traza con funciones, rutas y archivos el recorrido desde la selección pública hasta la confirmación de pago, tanto en web como en taquilla. Incluye lectura de categorías/precios, carrito, validación de cantidades, cálculo del importe, retención si existe, creación de orden y boletos, callbacks o webhooks de pago, cancelación, vencimiento y reembolso. Para cada transición indica quién inicia la acción, estado anterior/siguiente, transacción de base de datos y cualquier bloqueo o comprobación que evita sobreventa. Señala diferencias entre web y taquilla.

4. **Identidad y disponibilidad de lugares.** Investiga si hay IDs opacos públicos para evento, categoría, boleto y lugar; qué API podría publicar una revisión inmutable del mapa y disponibilidad actual; y dónde se podría materializar la relación `event_id + map_revision_id + local_place_id`. Identifica si la base de datos y su motor permiten bloquear filas en orden estable dentro de una transacción. Explica cómo se evitaría que dos compras concurrentes obtengan el mismo lugar, cómo se haría idempotente una confirmación de pago repetida y qué pasaría con una confirmación tardía después de vencer una retención. Distingue capacidad actual de cambios necesarios.

5. **Tarifa frente a ubicación física.** Muestra dónde se determina el precio autorizado y cómo se asocia una categoría a un evento. Confirma si una zona física puede tener distintas tarifas y si una tarifa puede cubrir varias zonas sin romper el modelo actual. Explica cómo se venderían en una misma orden acceso general por cantidad y lugares numerados. Para una mesa o palco completo, considera que el servidor debe expandir los lugares físicamente utilizables de la revisión y reservarlos atómicamente: si un lugar requerido está excluido o no disponible, falla todo el conjunto. Se emite **un boleto y un QR por lugar vendido**, aunque tengan tarifas diferentes. Identifica límites por orden y reglas que lo afectarían.

6. **Boletos, historial y acceso.** Localiza dónde se generan y muestran la vista del boleto, PDF, correo, padrón/listado, check-in, QR y respuesta de taquilla. Indica cómo guardan ahora la ubicación y el importe histórico (`tickets.seat_number`, `order_items.unit_price_cents` u otros campos reales). Evalúa dónde añadir una referencia al lugar del evento y una copia inmutable de zona, fila/butaca o mesa/lugar para que cambios posteriores del mapa o tarifa no reescriban boletos vendidos. Explica cómo conservar los boletos `S-…` existentes.

7. **Interfaz, despliegue y seguridad.** Indica el lugar concreto para incrustar el selector en la vista pública y en el editor administrativo, rutas y mecanismos para servir CSS y JavaScript externos, y la CSP efectiva en esas páginas. Confirma si se admiten scripts con nonce, `fetch` a rutas propias, módulos JS, estilos en línea o archivos estáticos con hash. Identifica autenticación, autorización, CSRF, permisos de administrador y validaciones necesarias para importar/publicar un mapa y consultar o reservar lugares. No incluyas secretos, credenciales, tokens reales ni datos personales en el informe.

8. **Operación y pruebas.** Identifica migraciones y datos heredados que podrían complicar el despliegue, reglas de rollback, cachés, trabajos en segundo plano y eventos que liberan cupo o lugares. Enumera pruebas existentes útiles y los huecos para cubrir: dos compradores concurrentes del mismo lugar; compra mixta; mesa completa; pago repetido o tardío; expiración; cancelación y reembolso; revisión del mapa congelada; boleto histórico; web y taquilla. Di cuáles pueden ejecutarse en el entorno disponible y aporta resultados, sin modificar pruebas.

## Formato obligatorio del archivo de respuesta

- **Resumen ejecutivo:** qué partes ya existen, brechas principales y decisiones que requiere el responsable del producto.
- **Matriz de evidencia:** tema, comportamiento actual, ruta y líneas verificadas, estado (implementado/propuesta/inferencia), brecha con el contrato.
- **Diagrama o lista del flujo actual de venta** con estados, transacciones y puntos de concurrencia.
- **Inventario de esquema y APIs** relevantes, incluidos ejemplos de petición/respuesta existentes. Si propones campos o endpoints futuros, márcalos claramente como propuesta y sepáralos de los actuales.
- **Plan de implementación del servidor:** archivos y módulos que habría que tocar, orden de implementación, migración de datos y pruebas de aceptación. Señala dependencias y riesgos concretos; no presupongas que las fases antiguas siguen abiertas.
- **Preguntas pendientes**, solo las que no puedas resolver leyendo el repositorio, ordenadas por impacto.

Evita respuestas genéricas. Si algo no existe, dilo explícitamente y muestra cómo lo comprobaste. Si un documento contradice al código, manda el código actual y registra la discrepancia. Al terminar, entrégame la ruta del archivo Markdown y su contenido completo o un enlace accesible al archivo para compartirlo con la IA del selector.
