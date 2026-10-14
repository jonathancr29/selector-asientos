# Medición del conector y grupos

Comparación del 14 de octubre de 2026 en el mismo equipo Windows, Node v24.19.0.
Antes: `61f73ec` (PR #64). Después: fuentes de `claude/rendimiento-conector`.
Mediana de cinco ejecuciones por operación, antes y después en secuencia. No hay umbrales de CI.

Reproducir desde el repositorio, sin paquetes:

```bash
node medir-conector.mjs 61f73ec
node medir-conector.mjs
```

El guion instrumenta copias en memoria: no modifica fuentes ni mapas. Publica recintos ficticios
de 18.720 lugares en filas y de 300 mesas redondas con ocho lugares cada una (2.400 lugares).
Valida el resultado del motor; no mide red, creación de SVG ni pintura. Para los tableros ejecuta
la función real del visor con un receptor de clases mínimo e incluye crear los índices nuevos.

| Operación | Antes | Después |
|---|---:|---:|
| Actualización comercial, 18.720 lugares | 1.343,8 ms | 347,3 ms |
| Actualización comercial, 300 mesas | 1.618,0 ms | 41,6 ms |
| Generaciones de plano por actualización | 3 | 0 |
| Regenerar y completar 300 mesas | 92,0 ms | 18,8 ms |
| Marcar tableros sin pintura SVG | 31,5 ms | 1,8 ms |

La carga fría del motor conserva la validación completa: filas 1.280,5 → 1.406,5 ms;
mesas 1.583,2 → 1.755,9 ms. La mejora medida corresponde a consultas posteriores y recorridos
de grupos; no se afirma una mejora de carga inicial. Los milisegundos dependen del equipo y la carga.

Conteos deterministas de los recorridos sustituidos:

- Regenerar y completar mesas: 1.440.000 visitas a la lista completa por mesa → ninguna;
  los índices nuevos recorren 4.800 lugares en esas dos operaciones.
- Marcar tableros: 45.150 consultas a elementos de la lista de mesas y 720.000 a la lista de
  butacas → ninguna búsqueda completa por tablero; consulta por ID y recorrido del grupo.
- Solicitud de un conjunto de 2.000 lugares: cada requerido se comprueba una sola vez,
  en vez de repetir la comprobación por cada lugar seleccionado.

La revisión física y sus índices viven en un contexto privado por carga del evento. Se congelan
los datos físicos y se descarta el token al cerrar. Los estados, tarifas, exclusiones y modalidad
se resuelven nuevamente en cada snapshot; no se conserva una disponibilidad anterior como caché.
