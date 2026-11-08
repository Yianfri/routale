# Propuesta de despliegue seguro en Linux

Estado: revisión SEG-01 y validación del alcance IPv4 de SEG-02 cerradas el
6 de noviembre de 2026, con los límites explícitos descritos abajo. Restricción
de Tailscale aplicada y panel
Dockge detenido temporalmente con autorización del propietario, sin desplegar Routale. Se
confirmaron Ubuntu 24.04 LTS x86_64, Docker Engine 29.7.2 y Docker Compose
5.4.0. El inventario parcial actualizado contiene Dockge y Cockpit; Routale todavía
no está instalada allí. Se revisaron UFW, INPUT/ts-input IPv4/IPv6 y la configuración
general SSH y ausencia de Match en los archivos consultados. El 6 de noviembre se
capturaron completas las tablas filter/nat/mangle/raw de ambas familias mediante
las herramientas compatibles, la configuración SSH efectiva de la conexión y el
filtro recibido por Tailscale. Se confirmó la asignación de la IPv4 pública a la
WAN de Internet probada desde la red móvil, el modo IPv4 de ese perfil y una WAN
privada distinta para la gestión del proveedor. No se certifican su red interna,
el firewall IPv6 global, enlaces de invitación no utilizados ni un tercer nodo
real excluido; el bloqueo de orígenes se respalda con el filtro efectivo y los
tests de política aceptados. No hay IPv6 pública ni ruta IPv6 predeterminada
observadas en el Linux y no se concede IPv6 en Tailscale.
La política completa
se respaldó y sustituyó después por la concesión restringida descrita en SEG-02;
las referencias a todos-a-todos dentro del inventario son evidencia anterior al cambio. Las vistas
administrativas de miembros/dispositivos y el acceso permitido desde Windows
se comprobaron parcialmente según se detalla abajo.
Esta revisión no registra el
hostname, cuenta, dirección privada ni digest del servidor.

Complementa [despliegue](despliegue.md), [decisión de arquitectura](decision-arquitectura.md),
[API](api.md) y [migraciones](migraciones.md).

## Inventario parcial actualizado

Consultas realizadas por SSH desde el PC local, sin desplegar ni modificar
servicios. La clave del host coincidió con la guardada y la autenticación por
clave funcionó con la cuenta confirmada por el propietario. Las salidas originales
se conservan únicamente como evidencia local privada, fuera de Git.

**Actualización del 6 de noviembre de 2026:** se repitieron consultas de lectura
y conexiones desde el PC administrativo. Esta comprobación actualiza los puntos
siguientes; el resto del inventario conserva el alcance de la evidencia anterior.

- SSH por LAN y por Tailscale IPv4 autenticó con la clave de host conocida. Las
  conexiones TCP nuevas a 22/9090 por LAN y a 22/443/9090 por Tailscale IPv4
  funcionaron. Los intentos a 5001/8088/2375 agotaron el tiempo; un timeout no
  demuestra por sí solo qué regla bloquea ni sustituye una prueba desde Internet.
- No había contenedores en ejecución. Dockge seguía detenido y no había listener
  TCP 5001; su publicación loopback anterior es evidencia histórica. Routale
  todavía no está desplegada en el Linux. Serve/Funnel conservaban el proxy
  `tailnet only` hacia ese destino local detenido.
- SSH y Cockpit seguían escuchando; SSH tenía listeners IPv4 e IPv6. El Linux no tenía
  dirección IPv6 pública ni ruta IPv6 predeterminada en la consulta. Conservaba
  IPv6 local y la dirección privada de Tailscale. Esto no garantiza el estado
  futuro del router ni explica por sí solo el fallo de IPv6 dentro del tailnet.
- Las conexiones TCP explícitas por Tailscale IPv6 a 22/443/9090 agotaron el
  tiempo. El filtro recibido por el Linux contiene una sola regla TCP: origen y
  destino IPv4 del PC y del Linux, con esos tres puertos. No concede IPv6; esto
  explica que esa ruta no esté autorizada, sin demostrar que no haya otros
  problemas de conectividad. Las [concesiones de Tailscale](https://tailscale.com/docs/reference/syntax/grants)
  deniegan por defecto lo que no se autoriza. No se amplió la política.
  `RunSSH` continuaba en `false` y no se anunciaban rutas en las preferencias
  consultadas. Se mantuvieron los permisos observados del directorio SSH y del
  archivo de claves autorizadas, sin leer su contenido.
- Tras la autenticación interactiva del propietario, las ocho consultas de
  filter/nat/mangle/raw de IPv4 e IPv6 terminaron con código cero y sin truncar.
  INPUT y FORWARD tienen política DROP. El salto a `ts-input` sigue antes de UFW
  y acepta `tailscale0`; la restricción de ese tráfico depende del filtro de
  Tailscale comprobado, no de los puertos de las reglas UFW posteriores.
- No hay DNAT ni aceptación de puertos de contenedores en las cadenas Docker
  actuales; DOCKER-USER está vacía. Las tablas raw consultadas están vacías y
  mangle conserva las marcas. La lectura compatible de NAT IPv6 muestra
  MASQUERADE en `ts-postrouting` para tráfico marcado: se resuelve la advertencia
  anterior de traducción xt, sin indicio de un NAT roto en esta lectura.
- `sshd -T -C` para la conexión LAN administrativa confirma root, contraseñas,
  interacción por teclado y contraseñas vacías deshabilitados, y claves públicas
  habilitadas. X11 y reenvío TCP/agente siguen permitidos; son opciones de
  endurecimiento por evaluar según uso, no una vulnerabilidad demostrada.
  La búsqueda de Include/Match solo devuelve el Include esperado. UFW aplica
  IPv6; reenvío IPv4 está habilitado y reenvío IPv6 deshabilitado. No se cambiaron
  esos valores. No se cambiaron servicios, firewall, SSH ni router.
- Con las sesiones iniciadas por el propietario, se volvieron a revisar las
  tablas del router: DMZ, mapeos IPv4/IPv6 y disparadores vacíos; UPnP desactivado
  y sin entradas. El control preciso de acceso sigue habilitado, con gestión LAN,
  gestión en el perfil WAN del proveedor e ICMP en las WAN. Son reglas del propio
  router. La comprobación WAN final y sus límites se describen a continuación.
- Users/Machines de Tailscale muestran una cuenta Owner y dos equipos propios.
  El filtro `status:invited` devuelve cero usuarios; los diálogos de compartición
  de ambos equipos indican que ningún usuario externo tiene acceso. Ambos
  carecen de rutas expuestas y tienen Exit Node en Not Allowed. No se generaron
  ni revocaron invitaciones; estas vistas no certifican la inexistencia de
  enlaces no utilizados ni la seguridad de las sesiones de la cuenta propietaria.

Prueba exterior parcial aportada por el propietario: al abrir HTTPS en TCP 9090
de la dirección IPv4 pública de la conexión, informa que no conecta desde el
celular siguiendo el procedimiento indicado con datos móviles. No se capturó el
error exacto ni se verificaron independientemente las condiciones de red. Este
resultado no demuestra qué dispositivo o filtro impide el acceso ni cubre otros
puertos, IPv6 o un origen excluido dentro del tailnet.

Después el propietario informó que HTTP/HTTPS en los puertos predeterminados
tampoco conectaban. Se repitió la comprobación desde el PC conectado temporalmente
al punto de acceso móvil: salida IPv4 pública distinta a la observada para la
casa y ruta seleccionada por Wi-Fi verificadas. Los cuatro intentos TCP a la
IPv4 pública de la conexión de casa, en 22/80/443/9090, agotaron cinco segundos
cada uno sin conectar. Solo se intentó establecer TCP, sin login, credenciales
ni carga de aplicación. Es una prueba exterior directa de esos cuatro destinos,
no una certificación de otros puertos, IPv6 o el perfil WAN de gestión del proveedor.
La asignación de esa dirección a la WAN de Internet se comprobó después. No identifica
qué equipo o filtro impide la conexión. La prueba y el origen se guardaron en
evidencia local privada. El propietario puede volver a su red normal; no hubo
cambios en el servidor.

**Cierre de la comprobación WAN:** System Information > WAN muestra el perfil
de Internet conectado con la misma IPv4 pública consultada y probada desde la
red móvil. Advanced > WAN muestra ese perfil con Protocol Type IPv4. La WAN
TR-069 de gestión está conectada con una dirección privada distinta; los permisos
de gestión observados para ese perfil no equivalen a permisos de administración
en la interfaz pública de Internet. La revisión no prueba la segmentación interna
del proveedor ni su firmware. No se editaron los perfiles ni se guardaron cambios.

Con esta evidencia se cierra el inventario actual y la validación de la política
IPv4 aprobada. El firewall IPv6 global no está certificado: la WAN de Internet
activa es IPv4 y el Linux no tiene IPv6 pública observada; ampliar IPv6 requeriría
una revisión específica. La prueba física de un tercer nodo afiliado sin permiso
no se realizó; el filtro efectivo y los tests de política constituyen la evidencia
disponible. Se repite la revisión si cambian WAN, publicaciones Docker, reglas de
acceso o dispositivos autorizados. Este cierre no habilita el despliegue ni
certifica ausencia de intrusiones previas.

**Evidencia anterior y límites complementarios:**

- **Sistema y Docker:** Ubuntu 24.04.4 LTS x86_64, Engine 29.7.2 y Compose 5.4.0.
  La única publicación de contenedor observada es Dockge en loopback, TCP 5001.
  Una conexión TCP desde este PC a ese puerto directo no tuvo éxito; esa prueba
  no comprueba otras rutas, dispositivos ni reglas del router.
- **Otros listeners:** SSH escucha en IPv4 e IPv6 en TCP 22. Cockpit tiene
  `cockpit.socket` activo en TCP 9090 y aceptó una conexión desde este PC por LAN.
  `cockpit.service` estaba inactivo al consultar; el socket activo sigue aceptando
  conexiones. Esto requiere revisar su acceso en SEG-02, pero no demuestra
  exposición a Internet. También se observaron listeners de DNS y Tailscale.
- **Serve/Funnel:** ambas consultas muestran el proxy HTTPS de Dockge como
  `tailnet only`. No se observó Funnel público en esas salidas. La vista visual de
  política aportada después muestra acceso general amplio; Users/Machines muestran
  una sola cuenta propietaria para los dos equipos. Falta revisar invitaciones y
  comparticiones en detalle.
- **Permisos:** la cuenta administrativa pertenece a grupos `sudo`, `docker` y
  `lxd`. El socket Docker es `660 root docker`; Dockge lo monta con escritura y
  sus procesos observados ejecutan UID 0. No se usó esa autoridad para suplir
  las consultas de `sudo` pendientes. El directorio SSH y authorized_keys tienen
  permisos 700 y 600; el directorio personal, 750. No se leyó el contenido de claves.
- **UFW aportado por el propietario:** la captura de `ufw status verbose` muestra
  estado activo, logging bajo y políticas predeterminadas deny incoming, allow
  outgoing y deny routed. Autoriza TCP 22/9090 desde la subred LAN y TCP 22/9090/443
  por `tailscale0`, con reglas de esa interfaz para IPv4 e IPv6. `Anywhere` en
  esas filas está condicionado a la interfaz; no es una autorización para todas
  las interfaces ni identifica qué usuarios permite el tailnet. No aparece una
  regla UFW para 5001. La tabla UFW por sí sola no demuestra el filtrado completo;
  el orden de entrada y las cadenas Docker observadas se describen a continuación.
  La consulta no privilegiada de herramientas confirmó iptables e ip6tables
  1.8.10 con backend `nf_tables`, y disponibilidad de `nft`.
- **INPUT/Tailscale aportado por el propietario:** la segunda captura muestra
  política INPUT DROP en IPv4 e IPv6, con el salto a `ts-input` antes de las
  cadenas UFW. Ambas cadenas `ts-input` contienen aceptación de la interfaz
  `tailscale0`, sin condición de puerto en esa regla. El tráfico aceptado allí
  no llega a las reglas posteriores de UFW en esas cadenas. Por tanto, no se
  pueden tratar las reglas UFW de 22/9090/443 como un límite de puertos para el
  tráfico que ya ingresa por Tailscale. La vista visual de política general se
  describe a continuación; se verificó acceso desde Windows, pero falta probar
  orígenes excluidos y completar el detalle administrativo de comparticiones.
  Se observa también aceptación del transporte UDP
  de Tailscale; las direcciones ocultas de otras reglas no se reconstruyen.
  Las cadenas FORWARD/Docker se revisaron después con el alcance descrito abajo;
  todavía no se ha probado el acceso desde identidades excluidas.
- **FORWARD/Docker aportado por el propietario:** las capturas del bloque filtrado
  muestran FORWARD DROP en IPv4 e IPv6. El recorrido empieza por DOCKER-USER y
  DOCKER-FORWARD, seguido de ts-forward y UFW. DOCKER-USER no contiene reglas en
  ninguna familia: no hay una restricción adicional en esa cadena. Las cadenas
  Docker visibles incluyen seguimiento de conexiones, selección por bridge y
  descarte hacia bridges para tráfico que no tiene una aceptación previa. La
  regla IPv4 de aceptación específica observada corresponde a TCP 5001 del
  contenedor de Dockge. La publicación NAT de ese puerto requiere destino loopback
  del host; no se ve un DNAT 5001 sobre direcciones generales ni una publicación
  equivalente en la cadena Docker IPv6 aportada. Esto concuerda con la publicación
  declarada y las pruebas negativas desde Windows, pero no certifica todas las
  rutas directas hacia direcciones de contenedores.
  `ts-forward` marca el ingreso por tailscale0 y acepta la marca y la salida por
  esa interfaz. No se deduce de esas reglas que el nodo tenga rutas anunciadas o
  aprobadas en el tailnet. El listado nft muestra tablas filter/nat para IPv4/IPv6,
  mangle para ambas familias y raw para IPv4. Los cuerpos raw/mangle, POSTROUTING
  y las cadenas UFW referenciadas no estaban incluidos en los filtros aportados;
  se revisaron después en la porción disponible de la terminal enlazada.
- **Lectura desde terminal enlazada:** el propietario ejecutó `nft list ruleset`
  y el agente leyó directamente la salida, sin transcripción ni nuevas capturas.
  El snapshot se conserva solo como evidencia local privada. La herramienta
  informa truncamiento: no se considera una captura completa del ruleset.
  La tabla raw IPv4 visible descarta ingreso directamente dirigido al contenedor
  de Dockge desde fuera de su bridge y paquetes hacia loopback TCP 5001 que
  ingresan fuera de lo. Esto añade protección observada frente a esas rutas,
  además de la publicación loopback y las pruebas de conectividad.
  Las tablas mangle visibles guardan/restauran bits de marca de conexión/paquete;
  no muestran aperturas de puertos en esas reglas. POSTROUTING IPv4 muestra
  masquerade para egreso de redes Docker y tráfico marcado de Tailscale.
  En IPv6 se ve POSTROUTING hacia ts-postrouting, pero nft representa MASQUERADE
  mediante compatibilidad xt y emite una advertencia de traducción. No se concluye
  que el NAT esté roto: falta consultarlo mediante ip6tables para interpretarlo
  completamente en aquel momento; la captura compatible del 6 de noviembre
  descrita arriba resuelve ese punto. Las sentencias xt requieren las herramientas compatibles y no
  se restaurará esta salida mediante nft. Las cadenas UFW IPv6 visibles incluyen
  control de estado/ICMPv6 y reglas de usuario Tailscale ya reportadas. Los cuerpos
  IPv4 fuera del buffer siguen sin una comprobación completa.
- **Política visual aportada por el propietario:** General access rules muestra
  una regla con todos los usuarios y dispositivos como origen y destino, en todos
  los puertos y protocolos. Autoriza conectividad de red amplia dentro del
  tailnet; la autenticación propia de SSH, Cockpit y Dockge sigue siendo una
  comprobación separada. No se ha leído el archivo completo de política ni
  revisado el detalle de invitaciones y accesos compartidos. La membresía visible
  en consola se comprobó posteriormente, según el apartado siguiente.
- **Tailscale SSH:** la vista visual muestra `autogroup:member` hacia
  `autogroup:self`, como `autogroup:nonroot` o `root`, con modo `check`. El destino
  self corresponde a dispositivos propios del miembro, no a todos los servidores.
  Una consulta remota limitada al campo `RunSSH` devolvió `false`: el servidor
  Tailscale SSH está deshabilitado en este Linux. Esa regla no habilita hoy acceso
  root mediante Tailscale SSH en el host; esta revisión usa OpenSSH por LAN y
  comprobó también OpenSSH por Tailscale. No se habilitó la función.
- **Auto approvers y visibilidad local:** no se observan aprobadores automáticos
  de rutas, servicios o nodos de salida en las vistas aportadas. Esto no certifica
  ausencia de rutas o comparticiones aprobadas manualmente. El resumen local de
  `tailscale status` no mostró dispositivos visibles con un propietario distinto
  al del servidor; esa vista no sustituye Users/Machines, invitaciones y permisos
  de administración de la consola. No se publican nombres, correos ni direcciones.
- **Users/Machines aportado por el propietario:** las capturas muestran una
  cuenta con rol Owner y dos máquinas conectadas, Windows y Linux, asignadas a
  esa misma cuenta. La pantalla Users indica que los invitados necesitan
  aprobación administrativa. No aparecen otros usuarios ni propietarios en las
  vistas aportadas. No se inspeccionó el detalle de invitaciones o comparticiones,
  ni se certifica la seguridad de la cuenta o la ausencia de sesiones ajenas.
- **Conectividad permitida comprobada:** desde el PC Windows se estableció SSH
  hacia la dirección Tailscale del Linux usando `HostKeyAlias` para exigir la
  misma clave de host ya conocida por LAN. Se autenticó la cuenta administrativa
  sin agregar claves ni cambiar configuración. Las pruebas TCP por esa ruta
  conectaron a 22, 9090 y 443; no conectaron al 5001 directo. Son pruebas desde
  un único origen permitido, sin intento de login en Cockpit/Dockge, y no prueban
  bloqueo desde otros dispositivos, IPv6 o Internet.
- **SSH general aportado por el propietario:** la captura de `sshd -T` muestra
  `permitrootlogin no`, `pubkeyauthentication yes`, `passwordauthentication no`,
  `kbdinteractiveauthentication no` y `authenticationmethods any`. Este último
  valor acepta uno de los métodos habilitados, sin exigir una combinación; no
  reactiva las contraseñas deshabilitadas. El filtro empleado no comprueba todos
  los métodos posibles ni aplica condiciones `Match` de una conexión concreta.
  El archivo principal legible declara X11Forwarding habilitado. Un fragmento de
  cloud-init no era legible para la cuenta sin privilegios; la salida general
  posterior de `sudo sshd -T` procede de la terminal del propietario.
- **Include/Match comprobado en archivos:** tras corregir la búsqueda con `grep -i`,
  la nueva captura muestra solo el Include del directorio de fragmentos. No se
  observan directivas Match activas ni otros Includes en el archivo principal y
  los fragmentos consultados. La salida inicial sensible a mayúsculas queda
  superada por esta comprobación. La conclusión se limita a esos archivos y a la
  configuración en disco; no es una prueba de todas las vías de autenticación.
- **Router revisado en sesión del propietario:** se localizó la puerta de enlace
  desde el PC y el propietario inició sesión en el panel. Las tablas visibles de
  DMZ, IPv4 Port Mapping, IPv6 Port Mapping y Port Trigger no contienen entradas.
  UPnP muestra estado desactivado y su tabla dinámica está vacía. No se pulsaron
  Apply, New, Delete o Reset, ni se editaron campos. Proveedor, modelo, direcciones
  y detalles del panel se conservan únicamente como evidencia local privada.
  El filtro opcional IPv4 Address Filtering figura desactivado y sin reglas;
  esto no determina el estado del firewall global o del seguimiento de conexiones.
  Precise Device Access Control está habilitado y muestra permisos de gestión del
  propio router desde LAN, permisos HTTP/HTTPS/SSH en un perfil WAN cuya etiqueta
  indica gestión TR069 y permiso ICMP en todas las WAN. No son redirecciones hacia
  el Linux. El alcance de esa WAN de gestión no se probó y no se considera por
  ello administración públicamente accesible.
  Los menús disponibles no mostraron un control global de firewall IPv6. Una
  consulta SSH complementaria contó cero direcciones IPv6 globalmente enrutables
  en el Linux en ese momento; no garantiza que el estado futuro sea el mismo.
  Account Management mostró un aviso visible sobre contraseña predeterminada;
  no se confirmó que la clave actual sea predeterminada ni se leyeron, escribieron
  o cambiaron contraseñas. Registrar la comprobación de ese aviso para SEG-02.
  Estas observaciones no equivalen a una prueba de exposición desde Internet ni
  certifican opciones del proveedor que esta cuenta no muestra.
- **Límites de la revisión cerrada:** red interna de gestión del proveedor,
  firewall IPv6 global, enlaces de invitación no utilizados y prueba física desde
  un tercer nodo afiliado sin permiso. Estos límites no se presentan como pruebas
  realizadas. La lista visible de miembros/dispositivos y el acceso desde
  Windows sí se comprobaron con los límites anteriores.
  Tampoco se releyó la configuración de autenticación interna de Dockge; su
  observación anterior sigue siendo histórica.

SEG-01 queda completada para el estado observado, con los límites anteriores.
Conservar la [guía de inventario](inventario-linux.md) para futuras revisiones y
registrar las correcciones en el [backlog](backlog.md). Las consultas iniciales
no cambiaron configuración. Después se aplicó únicamente la política Tailscale
aprobada en SEG-02 y se detuvo únicamente el panel Dockge en SEG-03. No se instaló
software ni se modificaron router, cuentas, sshd o firewall del host. Docker y
Cockpit siguen activos; no se detuvieron ni reiniciaron otros servicios.

## Estado comprobado

- La CI usa ejecutores alojados por GitHub también para `pull_request`; no hay
  un runner propio en el Linux. Las acciones externas del workflow están fijadas
  por SHA completo. El job de publicación solo corre en `main` de
  `Yianfri/routale` cuando
  `ENABLE_IMAGE_PUBLISH` vale `true`; el valor configurado en GitHub no se
  inspeccionó.
- Ese job publica dos imágenes, la web integrada con el proxy HTTPS y la API.
  Devuelve sus digests y etiqueta las imágenes con versión y revisión OCI. El
  workflow declara `contents: read` global y reserva la escritura de paquetes,
  atestaciones y el token OIDC para el job de publicación. La receta incorpora
  atestaciones por digest y un [verificador de procedencia](despliegue.md#verificación-de-procedencia)
  para el par. La prueba con atestaciones reales pasó en GitHub y Linux. El
  verificador rechazó el par al exigir un commit distinto. Los metadatos de
  BuildKit por sí solos no autorizan una instalación.
- `deploy/compose.yaml` configura API y web separadas, API sin puerto del host,
  red interna y un volumen persistente. El bind web es loopback por defecto,
  pero el `.env` privado puede cambiarlo.
- `deploy/update.sh` rechaza el stack integrado con API. En modo frontend aislado
  solo reemplaza `BITACORA_IMAGE`. Acepta una etiqueta de
  commit o digest, descarga la web y restaura `.env` si falla `compose up`; no
  actualiza `BITACORA_API_IMAGE`, verifica atestaciones, respalda SQLite/claves
  ni ejecuta la migración separada. Todavía no es un procedimiento de producción.
- El smoke local reportado para la pila completa verificó la API real con
  SQLite y datos de demostración: escritura con ETag, conflicto 412 y
  persistencia de cookie/CSRF, base y claves al reiniciar la API. Esto no prueba
  una instalación, respaldo o restauración en el Linux.
- El inventario inicial del Linux se hizo antes de instalar Routale. Después
  se comprobó la restauración en el [ensayo con datos ficticios](recuperacion.md#ensayo-y-operación-pendientes).
  Siguen pendientes el cifrado de disco y el respaldo de datos reales.

## Acceso de red actual

El contenedor Dockge quedó detenido temporalmente tras aprobación expresa.
Conserva la versión 1.5.0, la etiqueta mutable `louislam/dockge:1` y sus montajes.
No se borraron el contenedor, las pilas, los archivos ni los volúmenes. Su
configuración de publicación conserva loopback; Tailscale Serve conserva el proxy
HTTPS y ahora responde 502 porque el panel está detenido. No se alteró Serve.
Las salidas textuales del inventario de
`tailscale serve status` y `tailscale funnel status` indican `tailnet only`;
los JSON consultados en el inventario anterior no contenían `AllowFunnel`.
No hay evidencia de Funnel
público activo en esta configuración.

La regla general anterior de todos a todos fue sustituida, con autorización,
por el acceso del PC administrativo actual al Linux en TCP 22/443/9090. El panel
confirma una única concesión con esos alias y puertos. Se conservaron la regla
Tailscale SSH existente y los demás campos activos. Las conexiones nuevas
comprobadas y los límites, incluidos IPv6 y orígenes excluidos, se detallan en SEG-02.
Los equipos futuros requieren revisar expresamente la política; no se añadió Android.
Mantener Funnel apagado. Ya se revisaron la tabla UFW
y las cadenas INPUT/ts-input de ambas familias: Tailscale acepta el tráfico de
su interfaz antes de UFW. Se revisaron también FORWARD y las cadenas Docker de
filter/nat y, el 6 de noviembre, las tablas completas filter/nat/mangle/raw de ambas
familias y el filtro recibido por Tailscale. Sigue pendiente comprobar la
exposición externa de los listeners del servidor y el alcance WAN del router.

## Dockge requiere una corrección upstream verificable

La inspección confirmó que el contenedor de Dockge corre como UID 0 y monta el
socket Docker con escritura; las opciones reportadas por Docker no muestran
daemon rootless. Docker advierte que controlar el socket del daemon puede dar
autoridad equivalente a root sobre el host.

La nueva consulta SQLite con `OPEN_READONLY` confirmó que la base de Dockge
no tiene guardado `disableAuth`; en la versión inspeccionada, ese valor ausente
conserva la autenticación requerida. Otra consulta exclusivamente agregada mostró
una cuenta activa y ninguna cuenta activa con 2FA habilitado. No se leyeron
identidades, hashes, contraseñas ni secretos 2FA. La visita posterior a Seguridad
en la sesión existente solo mostró cambio de contraseña y desactivación de
autenticación, sin opción de enrolar 2FA. La presencia del campo en la base no
demuestra que la función esté disponible en esta versión; no se ofrece como
mitigación comprobada. Mantener autenticación habilitada tampoco elimina el
problema para usuarios autenticados.

La GitHub Advisory Database publicó
[GHSA-r5ph-2fqc-qvf3 / CVE-2026-73040](https://github.com/advisories/ghsa-r5ph-2fqc-qvf3):
un usuario autenticado puede usar nombres de stack con traversal para leer
archivos `.env`/Compose y borrar directorios fuera de la carpeta administrada.
La descripción del aviso enlaza las líneas vulnerables de Dockge 1.5.0, la
misma versión que corre en este equipo, pero el aviso todavía marca las
versiones afectadas y corregidas como `Unknown`; el [reporte upstream #994](https://github.com/louislam/dockge/issues/994)
sigue abierto. No se puede afirmar que la imagen observada esté corregida.

La nueva consulta de la versión instalada volvió a informar 1.5.0. La lectura
de su `getStack` muestra que comienza construyendo la ruta con el nombre recibido,
sin la validación de nombre señalada por el aviso en ese método. No se ejecutó
una explotación ni se trató esta lectura parcial como una auditoría completa.
El aviso sigue marcado `Unreviewed`, con versiones afectadas/corregidas desconocidas;
la [PR upstream #997](https://github.com/louislam/dockge/pull/997), que propone
rechazar nombres que escapan del directorio, permanece abierta. La lista oficial
de releases sigue mostrando 1.5.0 como última versión. No se acreditó un parche
publicado verificable ni se instaló código de esa PR.

La inspección seleccionada confirma publicación loopback, socket Docker escribible
y ausencia de `DOCKGE_ENABLE_CONSOLE=true` en el entorno del contenedor; esto último
no se presenta como una comprobación de todos los posibles argumentos de arranque.
El propietario autorizó detener únicamente el contenedor del panel. Se comprobó
su identidad antes de ejecutar la detención; quedó `exited` con código 0 y política
`unless-stopped`, conservando sus tres montajes. La lista de otros contenedores
en ejecución no cambió. Después funcionó una conexión SSH nueva por Tailscale;
Cockpit y Docker permanecen activos y TCP 22/9090 siguen accesibles desde el PC.
El 502 del proxy de Dockge es el resultado previsto de esta contención.

SEG-03 cierra la preparación de una vía de operación sin el panel, que permanece
retirado del servicio. La vulnerabilidad no se corrigió: antes de volver a iniciarlo se debe verificar una
corrección o alternativa. La recuperación manual del contenedor está registrada
en privado y no requiere borrar datos o volúmenes. No se migró a Portainer.
Para el uso actual se eligió operar Routale por Compose/SSH, con instrucciones
explícitas y manteniendo Dockge detenido. La [operación](despliegue.md#operación-de-routale-por-composessh)
quedó preparada localmente y aplicada por SSH: se instalaron Compose, plantilla
de entorno y guía privada en la carpeta de usuario, con permisos 700/600 y hashes
verificados. Se validaron el modelo Compose y las consultas de estado/registros
con la versión real del Linux. No existe un `.env` activo; las referencias de la
plantilla siguen sin completar. No se descargaron imágenes ni iniciaron contenedores.
Se conservaron proyecto y volumen, API sin publicación, web en loopback y ausencia
de acceso al socket Docker desde la aplicación. La comparación antes y después
confirma los mismos contenedores, tiempos/reinicios, volúmenes y redes de las pilas
existentes. No se reinició Routale porque todavía no tiene contenedores; el primer
despliegue, la migración y la prueba de reinicio corresponden a OPS-03 y siguen
sujetos a los demás requisitos. Un panel
propio o una migración a Portainer no forman parte de esta etapa.

Hasta que exista una corrección verificable y se revise su reactivación,
mantener Dockge detenido y conservar su configuración y datos.
No usarlo como plano de administración automatizado de Routale ni desactivar
su autenticación. La exposición tailnet-only reduce alcance, pero la combinación
de esta vulnerabilidad, UID 0 y socket escribible hace necesario cerrar primero
la revisión de ACL y esperar una corrección verificable.

## Ruta segura para Routale

### SEG-02: restricción Tailscale aplicada y comprobada parcialmente

Se conserva el alcance IPv4 ya aprobado. La ausencia de una concesión IPv6 es
una restricción efectiva de la política, no un fallo que deba resolverse
habilitando esa familia. El filtro recibido y los tests aceptados respaldan la
restricción de orígenes y puertos. No se realizó la prueba física desde un tercer
nodo afiliado sin permiso; se registra ese límite sin exigir registrar un equipo
adicional únicamente para repetir la comprobación.

El propietario aprobó el diff completo y su aplicación. Se guardó la política
restrictiva en Tailscale; la consola confirmó el guardado y conserva los tres
casos de tests, que el servicio exige aceptar antes de guardar. Se respaldó el
texto efectivo y su parseo coincide semánticamente con la propuesta aprobada,
incluidos tests y regla SSH. La vista visual confirma una única concesión desde
el PC actual al Linux en TCP 22, 443 y 9090. Los archivos reales y capturas quedan
en privado, fuera de Git. El comentario del borrador conservado en el archivo no
es su estado operativo: la política sí está aplicada.

Antes de guardar se mantuvo una sesión SSH LAN y se comprobó una segunda conexión
nueva por esa vía. Después funcionó una autenticación SSH nueva por Tailscale
IPv4 con la clave de host conocida. TCP 22, 443 y 9090 aceptaron conexiones nuevas;
el HTTPS de Serve respondió 200 con validación normal del certificado. Los puertos
5001, 8088 y 2375 no conectaron, pero un puerto sin servicio no demuestra por sí
solo bloqueo de ACL. No se inició sesión en las interfaces de Cockpit/Dockge.

Los tests aceptados cubren los puertos TCP permitidos, otros puertos denegados,
los correspondientes UDP sin conceder y conexiones iniciadas desde Linux hacia
los puertos administrativos del PC. No sustituyen una prueba desde un tercer
nodo excluido, que no está disponible en el inventario actual. La vista previa
por usuario no mostró coincidencias para el origen definido por IP/alias; no se
usó ese resultado para ampliar permisos. Las pruebas reales IPv4 sí funcionaron.

La prueba del nombre HTTPS con IPv6 no obtuvo resolución; al usar la dirección
Tailscale IPv6 conocida explícitamente, SSH/HTTPS agotaron el tiempo de conexión.
Windows tiene una ruta ULA de Tailscale. El 6 de noviembre se leyó el filtro
recibido por el Linux: autoriza únicamente los dos extremos IPv4 en TCP
22/443/9090. No incluye IPv6, de modo que su timeout concuerda con una ruta sin
concesión. Esta evidencia no certifica el resto de la conectividad IPv6 ni se
ampliaron reglas para forzarla. La navegación normal por IPv4 y el acceso administrativo
comprobado permanecen operativos. SEG-02 se cierra para el alcance IPv4 aprobado,
sin certificar una prueba física desde otros nodos ni habilitar otras familias.
La comprobación WAN final vincula la prueba exterior con el perfil público de
Internet; la red privada de gestión del proveedor queda fuera de esa prueba.

La revisión administrativa del 6 de noviembre confirmó que ambos equipos
indican ausencia de usuarios externos con acceso, rutas expuestas y permiso de
nodo de salida. El filtro de usuarios invitados devuelve cero. Esto no certifica
enlaces de invitación no utilizados ni la seguridad de las sesiones de la cuenta
propietaria. Tailscale SSH continúa deshabilitado
en el host. No se añadió Android, Funnel ni equipos futuros. Funciones especiales
como Taildrop tienen reglas propias y no se certifican mediante estos tests.

### Trabajo que puede avanzar sin cambiar el Linux

1. Mantener los PR y sus pruebas en ejecutores alojados por GitHub. No ejecutar
   código de PR en el Linux personal, no registrar allí runners self-hosted y
   no entregar a Actions claves SSH, Docker remoto ni secretos administrativos.
2. Mantener permisos mínimos por job y revisar los cambios de `.github/workflows/`.
   Antes de publicar versiones para instalar, emitir atestaciones para ambas
   imágenes y verificarlas por repositorio, workflow y referencia `main`.
   Digest identifica contenido; una etiqueta de commit por sí sola no sustituye
   esa comprobación.
3. Completar un actualizador que trate web y API como una sola versión: exigir
   digests, verificar procedencia, respaldar base y claves juntas, ejecutar la
   migración como paso único y tener un rollback que restaure imágenes, base y
   claves compatibles. Probar el flujo completo con datos ficticios y una copia
   aislada.
4. Mantener SQLite en disco local persistente. Cifrar `/data` y las copias de
   seguridad con controles del sistema; las claves persistidas de Data
   Protection no se cifran automáticamente solo por elegir una carpeta.
   Ensayar restauración con `PRAGMA integrity_check` y
   `PRAGMA foreign_key_check`.

La implementación de backend guarda `bitacora.db` y las claves de Data
Protection bajo `Storage__Directory`. El arranque no ejecuta migraciones de
producción: deben completarse con la imagen de API aprobada antes de iniciar la
nueva web. Una copia en caliente debe usar la Online Backup API de SQLite o
detener el escritor y copiar base y claves como una sola operación. Evitar
NFS/SMB para la base SQLite.

### Alertas de acceso y cambios administrativos

El propietario eligió correo electrónico para OPS-06. Se preparó un diseño local,
sin instalar recolector ni enviar mensajes. Una consulta de lectura encontró SSH,
journald y rsyslog activos, un directorio de journal persistente y auth.log legible
para la cuenta de revisión. No se comprobaron todavía retención ni cobertura
completa. No se observaron unidades cargadas de auditd, fail2ban o postfix, ni
los comandos habituales de envío consultados; no se descartan otras herramientas.

El alcance inicial propuesto incluye autenticaciones SSH aceptadas, intentos
fallidos repetidos agrupados y cambios en archivos administrativos acordados.
Se necesitan deduplicación, límites de frecuencia, cursor y cola persistentes,
reintentos acotados y prueba de recepción real. El transporte será saliente con
TLS validado, sin depender del correo para permitir un login. Proveedor,
remitente, destinatario y secretos permanecen privados y pendientes de confirmar.
El mensaje propuesto usa solo fecha, alias genérico, tipo, resultado y cantidad;
los detalles se consultan localmente. No enviar líneas de log o comandos completos.

Un login SSH no registra todo lo que se hizo después; los registros sudo tampoco
cubren toda una shell privilegiada ni operaciones directas de Docker/Dockge.
La auditoría de cambios requiere fuentes y reglas específicas. Cockpit y Dockge
necesitan comprobar sus eventos por separado. El registro de configuración de
Tailscale permite revisar cambios del tailnet y no equivale al registro de
autenticación OpenSSH. La monitorización del propio servidor tampoco puede
avisar por sí sola cuando ese equipo está apagado: requeriría un observador externo.

Antes de habilitar, probar con datos ficticios fallos, duplicados, reinicios,
rotación, cola llena y caída/recuperación del relay; después realizar una prueba
de correo autorizada y un ingreso propio nuevo. No provocar ataques al servicio.
La aprobación de la política Tailscale no instala ni autoriza por sí sola un
transporte de correo; OPS-06 continúa en preparación, sin instalación ni
validación de extremo a extremo.

### Trabajo que necesita una decisión del propietario

1. Confirmar y restringir la política Grants/ACL efectiva para Serve; identificar
   los servicios/listeners que siguen fuera del inventario y revisar el firewall.
2. Definir si se mantiene Dockge mientras no exista un parche verificable. Si se
   conserva, permitir acceso solo a la identidad administrativa necesaria y
   comprobar de nuevo que Funnel siga mostrando `tailnet only`.
3. Revisar cifrado del volumen y destino/frecuencia de copias de seguridad.
   Hacer la primera restauración en un volumen aislado antes de almacenar
   itinerarios reales.
4. Cuando lo anterior esté aprobado, desplegar manualmente web y API por digest,
   ejecutar la migración una sola vez y verificar salud, autenticación,
   cookies seguras, persistencia y restauración. Operar manualmente hasta que
   estas comprobaciones sean repetibles; después decidir si hace falta un
   actualizador pull local separado de la stack.

No se establecen RPO/RTO ni frecuencia de actualización sin conocer la pérdida
de datos tolerable. Este documento no afirma que Routale esté desplegada en el
servidor ni que se haya ejecutado allí una migración.

## Fuentes primarias

- [Registros de configuración de Tailscale](https://tailscale.com/docs/features/logging/audit-logging),
  [registros de flujo y disponibilidad por plan](https://tailscale.com/docs/features/logging/network-flow-logs),
  [journalctl](https://www.freedesktop.org/software/systemd/man/latest/journalctl.html)
  y [configuración de OpenSSH en Ubuntu](https://manpages.ubuntu.com/manpages/noble/man5/sshd_config.5.html).
- [Uso seguro de GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use),
  [ejecutores self-hosted](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners),
  [atestaciones](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
  y [gh attestation verify](https://cli.github.com/manual/gh_attestation_verify).
- [Socket de Docker](https://docs.docker.com/engine/security/protect-access/),
  [seguridad del Engine](https://docs.docker.com/engine/security/),
  [daemon rootless](https://docs.docker.com/engine/security/rootless/)
  y [referencias por digest](https://docs.docker.com/reference/cli/docker/image/pull/).
- [Dockge README](https://github.com/louislam/dockge/blob/master/README.md),
  [Compose oficial](https://github.com/louislam/dockge/blob/master/compose.yaml),
  [GHSA/CVE](https://github.com/advisories/ghsa-r5ph-2fqc-qvf3),
  [issue upstream #994](https://github.com/louislam/dockge/issues/994) y
  [releases](https://github.com/louislam/dockge/releases).
- [Tailscale Serve CLI](https://tailscale.com/docs/reference/tailscale-cli/serve),
  [Funnel CLI](https://tailscale.com/docs/reference/tailscale-cli/funnel),
  [Grants](https://tailscale.com/docs/features/access-control/grants) y
  [Serve](https://tailscale.com/docs/features/tailscale-serve).
- [Modos netfilter de Tailscale](https://tailscale.com/docs/reference/netfilter-modes),
  para interpretar el orden de sus cadenas respecto al firewall del host.
- [Manual nft y compatibilidad xt](https://www.netfilter.org/projects/nftables/manpage.html),
  para interpretar la representación de reglas creadas por iptables-nft.
- [Persistencia de claves de Data Protection](https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/configuration/overview?view=aspnetcore-10.0),
  [SQLite Online Backup API](https://sqlite.org/backup.html),
  [uso de SQLite en red](https://www.sqlite.org/useovernet.html) y
  [comprobaciones de integridad](https://sqlite.org/pragma.html).
