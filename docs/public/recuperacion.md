# Respaldo operativo y recuperación

El código y las imágenes no contienen los viajes guardados en el servidor. Para
recuperar la instalación se necesitan SQLite, sus archivos WAL si existen y todo
el directorio de claves de Data Protection, tomados sin escritores activos. Una
exportación del navegador tampoco sustituye este respaldo operativo.

## Diseño elegido y estado

Con un disco en el Linux y un PC Windows separado, el destino propuesto es un
repositorio cifrado de **restic en Windows**. La base activa permanece en disco
local del Linux. No usar una carpeta SMB para ejecutar SQLite. El flujo transmite
la copia por SSH y la cifra en el PC; no escribe un archivo de respaldo en texto
claro en Windows. El propio disco del servidor no cuenta como copia independiente.

`deploy/recovery.mjs` implementa el respaldo y la recuperación manuales. Necesita
Node 24.22.1, restic 0.19.1 y Docker CLI local, u OpenSSH para el alias remoto. No
instala servicios, abre puertos, configura SSH ni cambia permisos del servidor.
La rama Docker local se ensayó con datos ficticios. También se comprobó el
transporte Linux → Windows y la restauración por SSH con un juego ficticio de
SQLite y una clave de prueba. Después se repitió el flujo con la API de Routale
en Linux. La configuración definitiva del respaldo sigue pendiente.

Se elige restic para usar cifrado autenticado y comprobación de contenido ya
implementados, sin diseñar un formato criptográfico propio. El repositorio,
contraseña, configuración, claves, registros privados y volúmenes permanecen fuera
de Git y de los contextos Docker. La herramienta no borra snapshots ni aplica
retención automáticamente.

## Preparar el PC

1. Obtener restic de su publicación oficial y comprobar SHA-256 contra la lista
   oficial. Para el ensayo se usó una copia portable, sin instalación global.
2. Elegir una carpeta privada fuera del proyecto para el repositorio. Guardar la
   contraseña larga y aleatoria en un archivo distinto, con acceso solo del
   propietario: permisos 0600 en Linux; revisar ACL NTFS en Windows. Conservar
   otra copia protegida de esa contraseña en un destino independiente. Perderla
   impide descifrar las copias.
3. Crear una configuración privada. Este ejemplo contiene rutas ficticias; no
   guardar una contraseña, IP o configuración real en documentación pública:

```json
{
  "repository": "D:/Routale-copias/repositorio",
  "passwordFile": "D:/Routale-secretos/restic-password.txt",
  "resticBinary": "D:/Herramientas/restic.exe",
  "container": "routale-api-1",
  "sshAlias": "routale-linux"
}
```

El alias se define en la configuración privada de OpenSSH con su usuario y clave.
Debe reconocer previamente la clave de host. El ayudante exige BatchMode y
StrictHostKeyChecking: no acepta claves de host nuevas ni pide contraseñas por
una tubería. La cuenta remota necesita autorización administrativa para los
comandos Docker acordados. Ese acceso no se entrega a GitHub Actions. Omitir
`sshAlias` utiliza exclusivamente Docker local y sirve para ensayos.

## Crear y comprobar una copia

```sh
node deploy/recovery.mjs init RUTA_CONFIG_PRIVADA
node deploy/recovery.mjs backup RUTA_CONFIG_PRIVADA
node deploy/recovery.mjs snapshots RUTA_CONFIG_PRIVADA
node deploy/recovery.mjs check RUTA_CONFIG_PRIVADA
```

`init` es un paso explícito para un repositorio nuevo. `backup` comprueba primero
repositorio y contraseña, identifica el contenedor API y su volumen `/data`, y
rechaza otros contenedores que usen ese volumen. Guarda un registro privado de
recuperación, detiene la API y comprueba su almacenamiento sin migrarlo. Copia
**todo `/data`** mediante Docker y `restic --stdin-from-command`; un productor
fallido no publica un snapshot parcial. Conserva en sus metadatos la identidad
inmutable de la imagen API. Después reanuda la API si estaba encendida y espera
su salud, incluso al fallar o recibir una interrupción controlada.

La indisponibilidad dura la verificación y transferencia de esta copia completa.
Usar la red y puertos estables de la receta Compose. No iniciar otros escritores,
migraciones o tareas administrativas durante el respaldo. El bloqueo del PC
evita dos ejecuciones del ayudante, pero no controla otros administradores Docker.

Si el PC pierde energía, se mata el proceso por la fuerza o se corta SSH, la
limpieza puede no ejecutarse: revisar el archivo privado `repositorio.routale-lock`
y reanudar explícitamente el contenedor indicado si estaba encendido. No borrar
bloqueos sin comprobar antes el estado de los procesos y de restic. Antes de
programar copias desatendidas entre máquinas hace falta ensayar ese fallo y
preparar una reanudación independiente en Linux. No se promete disponibilidad
automática en ese caso.

## Recuperar sin reemplazar la instalación

```sh
node deploy/recovery.mjs restore RUTA_CONFIG_PRIVADA ID_COMPLETO_SNAPSHOT VOLUMEN_NUEVO
```

El ID debe ser completo; no se elige `latest` implícitamente. El volumen destino
debe ser inexistente. La imagen API exacta del snapshot debe estar disponible en
el Docker destino; descargarla previamente desde una versión aprobada por digest
y procedencia, conservando también la referencia de la web correspondiente.

La recuperación descifra directamente hacia un contenedor auxiliar sin red,
con raíz de solo lectura, sin capacidades y con escritura solo en el volumen
nuevo. Se aceptan únicamente snapshots de este procedimiento, de un repositorio
propio confiable. El comando API `verify-storage` comprueba archivos de claves,
rechaza enlaces, ejecuta `PRAGMA integrity_check` y `PRAGMA foreign_key_check`, y
comprueba el esquema sin crearlo ni migrarlo. La presencia de XML no demuestra por
sí sola que las claves descifren una cookie: eso se comprueba al iniciar la copia
aislada y recuperar una sesión ya emitida.

Si algo falla, el volumen nuevo queda aislado para revisión; la instalación de
origen no se reemplaza. Antes de usarlo, arrancar la versión correspondiente en
una stack separada, sin ingreso público ni escrituras de usuarios reales, y
comprobar salud, inicio de sesión, lectura del viaje, campos desconocidos, claves
y sesión anterior. Nunca ejecutar migraciones de una versión posterior para
ocultar un error de recuperación. Cambiar el volumen de producción solo después
de revisar este ensayo y conservar intacta la instalación anterior.

## Ensayo y operación pendientes

El ensayo local real usa SQLite, claves, restic y dos volúmenes ficticios. Cubre
contraseña incorrecta, fallo del productor, interrupción, otro contenedor que
monte el origen, rechazo de un destino existente y recuperación de contenido y
sesión en un volumen nuevo. Las pruebas .NET verifican ausencia de base/claves,
base corrupta, relaciones inválidas y esquema incompatible. Pasan 22 pruebas
.NET, 17 HTTP/SQLite existentes y ocho del ensayo de recuperación, además de
compilación sin advertencias, formato y comprobación de migraciones pendientes.
CI tiene preparado
el mismo ensayo en un ejecutor de GitHub; no se afirma que ya se haya ejecutado.

El 7 de noviembre de 2026 se creó una base SQLite de prueba con una fila
pendiente de consolidar desde el WAL. Restic en Windows cifró el archivo
transmitido por SSH, rechazó una contraseña incorrecta y verificó todos los
datos del repositorio. Al cortar el cliente SSH después de recibir parte del
archivo, restic conservó el único snapshot válido. La restauración transmitió
ese snapshot hacia un directorio nuevo en Linux. Coincidieron los hashes de la
base, el WAL y la clave ficticia. SQLite pasó las comprobaciones de integridad y
referencias y leyó la fila del WAL. El ensayo usó herramientas del sistema y
restic, sin instalar la API para ese ensayo de transporte.

Un segundo ensayo usó la API aprobada en Linux con una cuenta y un viaje
ficticios. El ayudante de respaldo cifró la copia en Windows y restic verificó
todos sus datos. Se restauró en un volumen nuevo y una segunda instancia leyó
el viaje con la sesión emitida antes del respaldo. Al cortar el proceso SSH
productor después de recibir bytes, el ayudante rechazó la copia parcial y
reanudó la API por otra conexión SSH. Queda pendiente la recuperación
independiente si se pierde el PC que ejecuta el ayudante.

Propuesta inicial para revisar tras el ensayo físico: copiar diariamente cuando
ambos equipos estén disponibles y antes de cada actualización, comprobar el
repositorio y ensayar recuperación periódicamente. Sin un PC encendido no hay
garantía de copia diaria. Frecuencia, retención, pérdida de datos tolerable y
protección del disco deben concretarse antes de datos reales. Mantener todas las
copias durante los primeros ensayos; no se ha habilitado borrado ni una agenda.

Referencias: [restic: preparación y claves](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html),
[backup y productor por comando](https://restic.readthedocs.io/en/stable/040_backup.html),
[recuperación](https://restic.readthedocs.io/en/stable/050_restore.html),
[WAL de SQLite](https://sqlite.org/wal.html) y
[copias consistentes de SQLite](https://sqlite.org/howtocorrupt.html).
