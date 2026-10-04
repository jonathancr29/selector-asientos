# Contrato de recinto, evento y conector

Estado: fase 1, decisiones acordadas. Este documento distingue requisitos futuros de lo
implementado; no anuncia niveles, palcos, numeracion explicita ni conexion de venta disponibles.
Complementa el contrato de lugares para Sin Taquilla y prevalece sobre sus reglas comerciales
anteriores cuando haya diferencias. Los nombres de campos siguientes son un contrato logico,
no tablas SQL ni endpoints definitivos.

## 1. Dos documentos, dos autoridades

El mapa del recinto describe ubicacion y geometria. Sin Taquilla conserva la configuracion de
cada evento: categorias, precios, habilitacion, modalidades y disponibilidad. El conector une
ambos por IDs y revision; no copia tarifas al mapa ni acepta importes del cliente al comprar.

| Entidad fisica | Funcion |
| --- | --- |
| Nivel | Piso, con coordenadas y vista propias. |
| Zona | Ubicacion oficial, nombre y color; independiente de tarifa. |
| Sector | Subdivision fisica; puede compartir zona con otros sectores. |
| Fila | Agrupacion oficial de lugares, aunque atraviese sectores o bloques. |
| Grupo | Mesa o palco con lugares individuales; no determina venta conjunta. |
| Region y banda | Contenedores de dibujo, no claves de ubicacion oficial. |

Las relaciones fisicas no forman un arbol obligatorio. Cada lugar resuelve nivel, zona y,
cuando corresponda, sector, fila y grupo. Un palco no necesita una fila ficticia. Una fila
puede estar en varios sectores; sus lugares tienen pertenencias concretas.

## 2. Identidad, etiquetas y revisiones

Todos los IDs son estables dentro del recinto, sin depender de nombres, orden o coordenadas.
Un ID retirado no se reutiliza, tampoco al aumentar de nuevo una fila. Duplicar crea IDs nuevos
para entidades copiadas y lugares; dividir una fila conserva los lugares existentes y exige
resolver expresamente su pertenencia. Contadores y registro de retirados viajan en el mapa.

Numeracion automatica y oficial explicita son modos distintos. La automatica calcula etiquetas;
la explicita conserva las oficiales, incluidos pares, impares y saltos. El cambio de modo muestra
las etiquetas afectadas y requiere una accion deliberada. Mover, girar, dividir o regenerar no
cambia etiquetas explicitas ni IDs. La unicidad se verifica sobre la ubicacion completa, no
solo sobre fila y numero. La numeracion automatica actual por zona sigue vigente hasta fase 3.

Una revision publicada es inmutable. El evento conserva su revision, incluso tras cancelaciones.
La correspondencia entre revisiones es una operacion explicita; conservar IDs no autoriza a
migrar un evento con ventas. Cada boleto congela ubicacion completa y precio historicos.

## 3. Herencia y geometria

La herencia de zona ayuda a crear o reasignar: asiento, pieza, banda mas interna, asignacion
explicita de respaldo con aviso. En el futuro movimiento visual conserva pertenencias oficiales;
reasignarlas es otra accion. Solo se avisa de contradicciones con regiones que tengan una relacion
fisica definida. En fase 2 se conserva la herencia dinamica existente; congelar pertenencias al
mover requiere la fase 3 y no debe fingirse implementado.

Cada nivel admite regiones independientes. Centro y laterales son accesos rapidos, no limites
del formato. La geometria admite coordenadas fraccionarias, bloques con angulo, filas rectas y
arcos circulares. Orientacion de cada butaca y geometria de fila son independientes: manual o
hacia una referencia. Curvas generales se agregaran si hay casos reales.

Correcciones individuales se guardan en el sistema local de la fila, asociadas al ID: desplazamiento
y desviacion angular. Viajan y giran con ella. Al regenerar se conservan en los IDs supervivientes;
los nuevos empiezan sin correcciones. Antes de retirar lugares se muestran IDs y etiquetas.
Cambiar radio, cantidad o separacion comprueba colisiones y no acepta resultados invalidos.

## 4. Configuracion del evento

Elegir recinto y revision muestra zonas y capacidades en Sin Taquilla, con acceso al editor.
Nombre fisico se administra en el recinto; el evento vincula por ID y muestra ese nombre.
Precio por zona es la configuracion inicial. Categorias pueden aplicarse a sectores, filas,
grupos o lugares, sin cambiar ubicacion. Asignaciones incompatibles son errores de publicacion,
no reglas resueltas por orden de aplicacion. Cada lugar habilitado debe resolver una tarifa.

Habilitar o excluir grupos se expande a sus lugares por pertenencia. Cualquier exclusion
aplicable prevalece; habilitar una fila no reabre una zona cerrada. Cerrar un sector de una fila
compartida excluye solo los lugares de ese sector. Publicar materializa el conjunto habilitado.

| Conteo | Regla |
| --- | --- |
| Inventariados | Todos los lugares fisicos registrados. |
| Utilizables | Inventariados cuya condicion fisica permite uso. |
| Habilitados | Utilizables admitidos por la configuracion del evento. |
| Disponibles | Habilitados sin bloqueo comercial, reserva o venta. |
| Comprables | Disponibles que cumplen tambien la politica de su grupo. |

Cada lugar se cuenta una vez; grupos no se suman al aforo. Reservas y ventas no reducen capacidad
fisica ni cupo habilitado. Mostrar conjuntos comprables aparte: un lugar libre puede pertenecer
a un conjunto no comprable. Condicion fisica, exclusion del evento y disponibilidad son campos
distintos. Un cambio de configuracion no invalida reservas ni ventas existentes silenciosamente.

## 5. Venta agrupada comun

Mesa y palco comparten mecanismo de seleccion, reserva y compra, pero tienen geometria y
etiquetas propias. El mapa guarda integrantes; Sin Taquilla fija modalidad por evento.

Individual: cada lugar habilitado se ofrece por separado. Completa: el conjunto requerido son
todos los lugares fisicamente utilizables del grupo en la revision publicada. Si alguno esta
excluido, bloqueado, reservado o vendido, no se ofrece el conjunto. No se recorta automaticamente.
Precio es suma de tarifas autorizadas de integrantes requeridos; un boleto y QR por lugar.
Servidor expande un ID opaco de grupo de evento y reserva atomica: falla uno, falla todo.
Seleccion parcial se rechaza. Composiciones reducidas requieren otra politica explicita futura.

## 6. Conector

Lectura: evento, recinto, revision, catalogo fisico, configuracion por zona/grupo y estado por
lugar, con IDs opacos del evento. Nombre y costo se entregan desde Sin Taquilla; el nombre
procede del catalogo del recinto y el costo de su configuracion de evento. Precio ausente no
es cero: mostrar sin precio disponible. Cero confirmado es gratuito. La pagina autonoma sigue
permitiendo editar y seleccionar sin servidor, sin simular una compra o una tarifa.

Compra: IDs de lugares o grupos del evento, nunca precio como autoridad. Servidor valida revision,
habilitacion, categoria, modalidad y disponibilidad en una transaccion. El conector no es un
plugin de Codex: es la interfaz entre aplicaciones. Autenticacion, endpoints, errores y refresco
se concretaran durante la integracion, respetando este contrato.

## 7. Migracion y alcance de fase 2

Nuevo mapa fisico sin precios activos. Importar v1-v4 conserva IDs, coordenadas, etiquetas,
bloqueos y asignaciones; precios y completa se guardan como antecedentes pendientes de revision,
sin activarlos. Guardar y reabrir conserva esos antecedentes, pero el catalogo fisico los omite.
Asignaciones individuales antiguas sin confirmacion siguen requiriendo revision fisica.
No fusionar zonas por compartir tarifa ni adivinar ubicacion desde precios.

Fase 2 separa paneles y retira tarifas. Niveles, sectores, filas oficiales, palcos, geometria y
venta integrada son fases posteriores. La ocupacion de ejemplo no es estado comercial real.

## 8. Casos de aceptacion

El ejemplo JSON adjunto es una muestra de contrato futuro, no un mapa importable por el editor.
Contiene tres niveles ficticios, fila compartida y palco. No prueba niveles reales del Clavijero.
Comprobar referencias e IDs unicos, etiquetas por ubicacion y que excluir un sector elimina
exactamente sus lugares. Un grupo con integrante excluido no es comprable completo.

En las fases siguientes: mover conserva identidad y etiquetas oficiales; regenerar conserva
correcciones; cambiar nivel conserva seleccion; guardar y abrir conserva diseno; reservas no
cambian inventario; venta conjunta nunca omite integrantes fallidos. Probar tambien sala
rectangular, regiones asimetricas, arcos y mesas en ambas modalidades. Aforo del Clavijero y
distribucion se concilian con evidencia; 635 es un total reportado, pendiente de confirmar.
