# Cierre técnico de la auditoría del selector

Base revisada: `ef98cfc`, fusión del PR #67. Los puntos 1–6 se entregaron en los PRs de la
tabla; el punto 7 se entrega en el [PR #68](https://github.com/jonathancr29/selector-asientos/pull/68),
que registra su revisión y estado de fusión. Esta auditoría
abarca el selector, sus entregas, pruebas y documentación; no modifica ni certifica Sin Taquilla
ni el inventario oficial del Clavijero. Los mapas locales no forman parte de estos cambios.

## Correcciones y trazabilidad

| Punto | Hallazgo y resultado | Entrega |
|---|---|---|
| 1 | Validar o actualizar un evento podía sustituir objetos de la escena y perder referencias SVG. La validación conserva objetos, nivel y foco incluso al rechazar datos. | [PR #63](https://github.com/jonathancr29/selector-asientos/pull/63), `72e885d` |
| 2 | Listas masivas podían agotar límites del motor antes de validar. Se limita el dibujo a 22.000 elementos y se comprueba aforo antes de generar; fallos de lectura no interrumpen el visor. | [PR #63](https://github.com/jonathancr29/selector-asientos/pull/63), `72e885d` |
| 3 | Una reserva pendiente bloqueaba una sesión nueva. Operación y respuestas pertenecen a su sesión; una operación anterior no bloquea ni libera otra. Cerrar no cancela reservas del servidor. | [PR #64](https://github.com/jonathancr29/selector-asientos/pull/64), `61f73ec` |
| 4 | Las actualizaciones repetían geometría y barridos de mesas/grupos. El recinto publicado se prepara una vez; cada snapshot vuelve a validar comercio. Los índices se renuevan al dibujar. | [PR #65](https://github.com/jonathancr29/selector-asientos/pull/65), `09bf695` |
| 5 | Utilidades de pruebas y del antiguo editor comercial seguían en la entrega. Se retiran cuatro utilidades y un estilo sin uso, conservando cuatro ayudantes históricos de mesas; zonas y piezas comparten operaciones. | [PR #66](https://github.com/jonathancr29/selector-asientos/pull/66), `80ca772` |
| 6 | Modelo concentrado e historial limitado solo por número de estados. Se separan seis fuentes puras y se añade presupuesto de texto, preservando actual, guardado y compatibilidad. | [PR #67](https://github.com/jonathancr29/selector-asientos/pull/67), `ef98cfc` |
| 7 | Documentación mezclaba datos históricos y actuales; un umbral temporal daba falsos fallos bajo carga. Se concilian los documentos y se acotan accesos de numeración en lugar de milisegundos. | [PR #68](https://github.com/jonathancr29/selector-asientos/pull/68) |

## Evidencia y reproducción

La base del PR #67 pasa 234 pruebas de lógica y 44 de navegador. El PR #68 conserva esas
suites y sustituye la prueba temporal de numeración: comprueba las etiquetas de 104.000 lugares
sintéticos y limita las lecturas de sus datos a 80 por lugar. La medición se hace al volver a
numerar la escena preparada, no cronometrando su generación. El caso no autoriza superar el
límite de producto de 20.000 lugares. Restaurar la búsqueda completa por rótulo debe hacer
fallar la prueba por exceso de accesos, aunque sus etiquetas sigan siendo correctas.

Verificación del PR #68: 234 pruebas de lógica y 44 de navegador aprobadas; se detectaron
tres regresiones deliberadas (búsqueda completa por rótulo, numeración omitida y etiqueta
incorrecta). Se comprobaron 38 enlaces locales y 266 funciones puras sin cambios funcionales;
los cambios del código de aplicación son comentarios, con entregas regeneradas.

```bash
node construir.mjs --check
node --test pruebas.mjs
node --test pruebas-navegador.mjs
```

La lógica se evalúa desde el HTML entregado. El navegador comprueba teclado, mapas, edición,
historial, identidad, varios niveles, mesas y palcos, eventos, acceso general, respuestas tardías
y entrega externa bajo CSP. Los detalles y condiciones de cada cambio quedan en CHANGELOG.
En los refactores se compararon resultados antes y después; las mutaciones comprobaron que
las pruebas detectan reglas rotas. No se concluye ausencia de errores a partir de una suite verde.

Las mediciones son reproducibles y separadas de los requisitos de CI:

- [Conector y grupos](MEDICION_CONECTOR_GRUPOS.md): motor sin red ni pintura SVG. Actualizar
  18.720 lugares pasó de 1.343,8 a 347,3 ms en aquella comparación; no mejoró la carga inicial.
- [Historial](MEDICION_HISTORIAL.md): después de 60 cambios sobre 18.720 lugares retiene
  13,79 MiB de texto frente a 202,88 MiB, con 3 estados frente a 51. No es una medida de heap.
- `node medir-render.mjs`: medición local de primera pintura y redibujados; las cifras de
  septiembre conservadas en README y AGENTS son históricas, no garantías actuales.

## Documentos y contrato vigentes

- [README](../README.md): comportamiento actual, formatos, editor, historial y pruebas.
- [AGENTS](../AGENTS.md): fuentes, reglas, generación y verificación de cambios.
- [Contrato de recinto y evento](CONTRATO_RECINTO_EVENTO.md): separación física/comercial,
  identidades, revisiones, pertenencias y venta agrupada.
- [Guía de integración](INTEGRACION_EVENTOS_SINTAQUILLA.md): API pública v2, snapshots v1/v2,
  solicitudes, transporte y obligaciones del anfitrión.
- [Contrato inicial](CONTRATO_LUGARES_SINTAQUILLA.md): contexto histórico, subordinado a los
  documentos vigentes; su revisión de Sin Taquilla no describe el estado actual del servidor.

El mapa físico es v8 y el catálogo es v5. El JSON conserva inventario por lugar desde v6;
no guarda selección, historial, nodos SVG ni el snapshot del evento. Importar formatos anteriores
conserva los antecedentes comerciales según la migración, sin activarlos como tarifas del mapa.
Las tarifas y modalidades del evento siguen procediendo de Sin Taquilla.

## Pendientes y límites de la revisión

1. **Servidor e instalación:** verificar en Sin Taquilla endpoints, permisos, aislamiento entre
   organizaciones, reservas atómicas, idempotencia, caducidad, pagos y boletos históricos.
   Las pruebas HTTP simuladas del cliente no acreditan esos comportamientos de servidor.
2. **Memoria y escala:** el historial tiene presupuesto por mapa; actual y firma guardada pueden
   excederlo solos. No es un límite global del heap. La comprobación de colisiones con muchas
   piezas y el resto del SVG que aún se rehace siguen siendo candidatos a medición específica.
3. **Accesibilidad y uso real:** completar pruebas en dispositivos táctiles y con lectores de
   pantalla reales, además de los recorridos automáticos de teclado y semántica.
4. **Recinto real:** conciliar aforo y numeración con documentación verificable del teatro,
   independientemente de que su JSON sea válido. No se ha certificado ese inventario aquí.

El cierre registra correcciones del alcance acordado y sus límites. No constituye una prueba
de penetración ni una certificación de seguridad de la plataforma completa. Los pendientes
anteriores quedan separados del trabajo cliente corregido en los siete puntos.
