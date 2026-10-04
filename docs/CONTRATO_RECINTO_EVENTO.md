# Contrato de recinto, evento y conector

Estado: contrato acordado en fase 1. Las fases 3 y 4 implementan identidad por lugar, numeracion
explicita, revisiones locales, niveles, regiones y bloques rectos o en arco con correcciones.
La fase 5 implementa sectores, entidades de fila y palcos; la conexion de venta sigue pendiente. Los vinculos graficos
de region transforman bloques; no determinan pertenencias fisicas ni modalidades comerciales.
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
solo sobre fila y numero. Desde fase 3 se puede elegir numeracion automatica u oficial explicita.

Una revision publicada es inmutable. El evento conserva su revision, incluso tras cancelaciones.
La correspondencia entre revisiones es una operacion explicita; conservar IDs no autoriza a
migrar un evento con ventas. Cada boleto congela ubicacion completa y precio historicos.

## 3. Herencia y geometria

La herencia de zona ayuda a crear o reasignar: asiento, pieza, banda mas interna, asignacion
explicita de respaldo con aviso. En el futuro movimiento visual conserva pertenencias oficiales;
reasignarlas es otra accion. Solo se avisa de contradicciones con regiones que tengan una relacion
fisica definida. Desde fase 3 se materializa la zona inicial por lugar; mover conserva esa
pertenencia y reasignarla es explicito. Las otras pertenencias se incorporaran con sus entidades.

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
se concretan para el cliente en la [guia de fase 6](INTEGRACION_EVENTOS_SINTAQUILLA.md).
Las rutas concretas y la implementacion transaccional pertenecen a Sin Taquilla.

## 7. Migracion y alcance de fase 2

Nuevo mapa fisico sin precios activos. Importar v1-v4 conserva IDs, coordenadas, etiquetas,
bloqueos y asignaciones; precios y completa se guardan como antecedentes pendientes de revision,
sin activarlos. Guardar y reabrir conserva esos antecedentes, pero el catalogo fisico los omite.
Asignaciones individuales antiguas sin confirmacion siguen requiriendo revision fisica.
No fusionar zonas por compartir tarifa ni adivinar ubicacion desde precios.

Fase 2 separa paneles y retira tarifas. Fase 3 añade etiquetas oficiales, identidad por lugar
y revisiones locales. Fase 4 incorpora niveles y geometria libre; fase 5 incorpora sectores,
filas fisicas y palcos. La venta integrada sigue pendiente. La ocupacion de ejemplo no es estado comercial real.

### Implementacion fisica de fase 5

Mapa v8 y catalogo v5: sectores, filas y palcos tienen IDs y nombres propios dentro de un
nivel y zona. Las referencias se materializan por lugar; filas pueden atravesar sectores.
Mesa conserva su grupo geometrico estable. Palco agrupa lugares existentes sin fila ficticia
y mantiene una etiqueta explicita por integrante. Su contorno visual es una referencia.
Un lugar no pertenece simultaneamente a fila y palco. Reasignar zona desvincula las pertenencias
incompatibles, con aviso; eliminar entidad usada exige desvincular previamente sus integrantes.
Duplicar piezas conserva sector y crea lugares nuevos sin asignarlos a la fila o palco original.
IDs retirados y contadores se conservan al guardar y deshacer. La revision publicada incluye
entidades y pertenencias, sin modalidades comerciales. La migracion no deduce estas entidades
desde letras, coordenadas o bandas. Fase 6 aplica exclusiones y seleccion agrupada en el cliente;
reservar en servidor sigue pendiente.

### Conector de fase 6

Snapshot comercial version 1, separado del mapa v8 y catalogo v5. El cliente recibe revision
publicada, categorias y asignaciones, exclusiones por pertenencia, modalidad de grupos y
correspondencia de IDs opacos de evento. Disponibilidad desconocida nunca se trata como libre.
La union de exclusiones cierra exactamente sus integrantes; tarifas distintas sobre un lugar
se rechazan. Conjuntos requieren todos los lugares fisicamente utilizables de la revision,
sin recorte por exclusiones ni disponibilidad. Actualizar puede soltar selecciones, con aviso.

Se entrega una API de navegador y recursos externos para CSP, con transporte del mismo origen,
CSRF, version de estado e identidades estables. El importe es informativo; el servidor debe
expandir grupos, calcular precios y validar/reservar atomico. No se modifico el servidor en esta
fase. [Ejemplo importable y snapshot](ejemplo-conector-evento.json) con tres niveles ficticios,
mesa, palco y fila compartida entre sectores. El Clavijero se construira aparte.

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
