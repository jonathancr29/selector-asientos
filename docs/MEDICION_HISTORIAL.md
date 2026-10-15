# Texto retenido por el historial

Comparación del 14 de octubre de 2026 en Windows, Node v24.19.0. Antes: `80ca772` (PR #66).
Después: `claude/modelo-historial`. Ambos casos registran 60 cambios de nombre en el mismo
diseño, manteniendo planos y firmas completos. No se modifican archivos de mapas.

```bash
node medir-historial.mjs 80ca772
node medir-historial.mjs
```

| Inventario | Estados antes | Estados después | Texto antes | Texto después |
|---|---:|---:|---:|---:|
| Ejemplo de 15 lugares | 51 | 51 | 844.600 bytes (0,81 MiB) | 844.600 bytes (0,81 MiB) |
| Filas de 18.720 lugares | 51 | 3 | 212.739.908 bytes (202,88 MiB) | 14.458.052 bytes (13,79 MiB) |

Son conteos deterministas de texto: dos bytes por unidad UTF-16 de plano y firma de cada
estado retenido, más la referencia de guardado. No es una medición del heap: el motor puede
compartir cadenas, comprimirlas o añadir estructuras. No se atribuye una reducción igual al
proceso completo del navegador, ni se mide tiempo de renderizado. Los ejemplos son sintéticos;
el número de pasos real depende del tamaño del diseño. No hay umbrales temporales en CI.

El límite sigue siendo 51 estados (hasta 50 pasos), ahora con un presupuesto adicional de
16 MiB por mapa. Registrar después de deshacer descarta la rama de rehacer. Si hace falta
recortar, se retira primero el pasado más antiguo; al actualizar un estado intermedio, después
se retira el futuro más lejano. Las versiones restantes siempre son contiguas.

El estado actual y la referencia exacta de guardado nunca se descartan para satisfacer el
presupuesto. Si ellos solos lo exceden, se conserva un estado y se informa el exceso mediante
las medidas internas. Al guardar, la referencia se actualiza y vuelve a aplicarse el límite.
Esto conserva la restauración, la indicación de cambios pendientes y las identidades retiradas.
El límite es por mapa, no un límite global de memoria de toda la sesión.
