# Estado y pendientes

Este es el **único inventario vigente de trabajo pendiente** de `selector-asientos` y de su
integración prevista. El [README](../README.md) describe lo que se puede usar hoy; el
[contrato de recinto y evento](CONTRATO_RECINTO_EVENTO.md) fija las reglas de dominio; la
[guía de integración](INTEGRACION_EVENTOS_SINTAQUILLA.md) especifica el conector entregado y
las obligaciones del anfitrión. El [cierre de auditoría](CIERRE_AUDITORIA.md) conserva la
evidencia de la revisión de octubre de 2026, no es una lista de tareas viva.

**Estado verificado en este repositorio:** mapa v8, catálogo físico v5, API cliente v2,
snapshots comerciales v1/v2 y entrega externa para CSP. El conector consulta disponibilidad
y solicita reservas, pero este repositorio no implementa servidor, pagos ni boletos. El estado
actual de Sin Taquilla no se ha verificado aquí. Las pruebas HTTP simuladas del selector no
certifican una venta real.

## Para poner la integración en servicio

| Pendiente | Responsable principal | Criterio para darlo por terminado |
| --- | --- | --- |
| Acordar el contrato compartido y revisar el estado real de Sin Taquilla | Ambos proyectos | Versiones, IDs, modalidades, estados, errores y compatibilidad aprobados por ambos; diferencias con el servidor identificadas. |
| Publicar revisiones e inventario del recinto | Sin Taquilla | Administración con permisos y aislamiento por organización; revisión inmutable, catálogo validado e IDs opacos de evento persistidos. |
| Configurar categorías, precios, exclusiones, grupos y acceso general por evento | Sin Taquilla | Cada lugar habilitado resuelve una tarifa; cupos generales no fabrican asientos; el servidor repite las validaciones del cliente. |
| Consultar disponibilidad y reservar | Sin Taquilla | Endpoints del mismo origen, CSRF, versión de estado e idempotencia; una transacción reserva lugares, grupos completos y cantidades generales, o rechaza todo. Pruebas de concurrencia y caducidad. |
| Cobrar, emitir y liberar | Sin Taquilla | Pago tardío, cancelación, reembolso y vencimiento no causan sobreventa; un boleto/QR por lugar vendido, ubicación y precio históricos; boletos antiguos conservados. Web y taquilla comparten reglas. |
| Verificar la instalación conjunta | Ambos proyectos | CSP, autenticación, aislamiento entre organizaciones, selección, refresco, compra mixta, errores, accesibilidad y rendimiento probados contra el servidor real. |

La [guía del conector](INTEGRACION_EVENTOS_SINTAQUILLA.md#responsabilidades-y-verificacion-en-sin-taquilla)
detalla los datos y casos de aceptación del servidor. Ninguna selección ni importe mostrado
por el navegador autoriza un cobro.

## Producto y datos por decidir

- **Recinto real:** conciliar aforo, zonas, filas, mesas, palcos y etiquetas con documentación
  verificable del recinto antes de publicar. Los JSON de ejemplo no certifican el Clavijero.
- **Mapas antiguos:** revisar antecedentes de precios y venta completa de v1–v4 y asignaciones
  individuales de zona física antes de usarlos en un evento. La importación no los activa como
  política comercial.
- **Edición con lugares ocupados:** decidir la política de mover, acortar o eliminar una mesa
  ocupada en el editor autónomo; hoy se permite con aviso. En un evento publicado la revisión
  permanece fija y los cambios de inventario requieren una operación explícita del anfitrión.
- **Geometría adicional:** imágenes de fondo, curvas generales y más formas solo cuando exista
  un caso real con criterios de interacción y accesibilidad.

## Mejoras del selector sin bloquear la integración

- Medir memoria y primera pintura con el modelo actual. El historial limita texto por mapa,
  pero el estado actual y la firma guardada pueden exceder el presupuesto por sí solos; no
  hay límite global del heap. Medir el resto del SVG que se rehace y las colisiones con muchas
  piezas antes de optimizar.
- Probar pellizco y lectura de pantalla en dispositivos reales; las pruebas automáticas de
  teclado y semántica no los sustituyen.
- Evaluar guardado de mapas en servidor, desplazamiento al arrastrar una mesa hacia el borde
  con zoom y nuevas formas según necesidades de uso.
- Si aumenta el aforo máximo, sustituir los cuatro `Math.min(...lista)` de `calcularEncuadre`
  por un recorrido sin expansión de argumentos. Con el límite actual de 20.000 lugares no
  se considera un bloqueo.

Las cifras y condiciones de las mediciones históricas están en el
[cierre de auditoría](CIERRE_AUDITORIA.md#evidencia-y-reproduccion) y en los documentos de
medición; no son objetivos de rendimiento ni umbrales de CI.
