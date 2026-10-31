# Contrato inicial de lugares: referencia histórica

Este documento se redactó antes del mapa v8, el catálogo físico v5 y el conector de eventos.
**No es el contrato vigente** ni describe el estado actual de Sin Taquilla. La versión original
se conserva en el historial del [PR #44](https://github.com/jonathancr29/selector-asientos/pull/44).
Se mantiene esta ruta para que los enlaces antiguos indiquen dónde están las reglas actuales.

| Consulta | Documento vigente |
| --- | --- |
| Identidad local, ubicación física, numeración, revisiones, grupos y separación de tarifas | [Contrato de recinto y evento](CONTRATO_RECINTO_EVENTO.md) |
| API del selector, snapshots comerciales v1/v2, disponibilidad, selección y transporte | [Guía de integración](INTEGRACION_EVENTOS_SINTAQUILLA.md) |
| Uso y comportamiento del editor y visor | [README](../README.md) |
| Trabajo de servidor, validación conjunta y mejoras del selector | [Estado y pendientes](PENDIENTES.md) |

En particular, las reglas iniciales de mesas completas y los ejemplos de mapa v4 de aquel
contrato fueron sustituidos por el modelo físico y comercial posterior. Una mesa o palco
completo requiere todos sus lugares **físicamente utilizables** de la revisión publicada;
la exclusión o falta de disponibilidad de cualquiera de ellos impide vender el conjunto.
Las categorías, importes, reservas y boletos pertenecen a Sin Taquilla y deben verificarse
en ese proyecto antes de usar la integración en producción.
