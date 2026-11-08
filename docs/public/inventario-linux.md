# SEG-01: revisión del Linux en modo de lectura

Estado: SEG-01 cerrada para el estado observado el 6 de noviembre de 2026,
y SEG-02 comprobada para el alcance IPv4 aprobado. La guía conserva los comandos
para futuras revisiones; no corresponde repetirlos sin cambios o dudas nuevas.

Se capturaron las tablas completas del firewall de ambas familias y SSH efectivo
de la conexión. La política y el filtro recibido limitan PC administrativo al
Linux TCP 22/443/9090 por IPv4; Tailscale SSH está deshabilitado. Se comprobaron
miembros, comparticiones visibles y tablas del router sin mapeos, DMZ o
disparadores y con UPnP desactivado. La WAN de Internet tiene la IPv4 pública
probada desde la red móvil y Protocol Type IPv4; la WAN TR-069 de gestión usa una
dirección privada distinta. TCP 22/80/443/9090 agotaron el tiempo desde el PC con
salida móvil distinta y ruta verificada. El Linux no tenía IPv6 pública ni ruta
IPv6 predeterminada.

La revisión no certifica el firewall IPv6 global o la red interna del proveedor,
los enlaces de invitación no utilizados ni una prueba física desde un tercer
nodo afiliado sin permiso. El filtro efectivo y los tests de política son la
evidencia disponible de restricción de orígenes. No se habilitó IPv6 ni se añadió
un equipo solo para repetir una prueba. Resultados y límites en el
[inventario](despliegue-seguro.md#inventario-parcial-actualizado).

Las salidas completas permanecen privadas. El entorno de desarrollo en la nube
no es el Linux personal: no usar sus procesos, puertos o configuración como
evidencia del servidor. Repetir la revisión si cambian WAN, publicaciones Docker,
reglas de acceso o dispositivos autorizados.

Si existe una terminal enlazada al chat, preferir leer su salida directamente
para evitar transcripciones y capturas manuales. La contraseña de sudo la
introduce el propietario únicamente en la terminal. Si el buffer se trunca,
registrar el límite y consultar solo los bloques ausentes cuando sea necesario;
no pedir de nuevo todo el volcado. Las salidas completas permanecen privadas.

Esta revisión actualiza el inventario anterior de
[despliegue seguro](despliegue-seguro.md). No instala programas, cambia firewall,
reinicia servicios ni despliega Routale. Ejecutar los bloques por etapas y revisar
sus resultados antes de pasar al siguiente. Conservar la sesión administrativa
existente durante toda la revisión.

## 0. Conectar desde el PC sin modificar el servidor

Confirmar destino y usuario con el propietario. Mantener direcciones, alias,
cuentas y rutas de claves en configuración privada, fuera de Git. Revisar las
opciones efectivas del cliente local antes de conectar, incluidos ProxyCommand,
RemoteCommand y LocalCommand si existen. No reutilizar un alias que apunte a otro
equipo ni probar listas de usuarios o claves.

Exigir la clave de host ya conocida. Si falta o cambia, detenerse y comparar su
huella desde una consola confiable del servidor; no desactivar la comprobación
ni reemplazar known_hosts para ocultar un error. Para un intento no interactivo,
sustituir los dos marcadores de este ejemplo únicamente en la terminal local:

```sh
ssh -T -a -x -o BatchMode=yes -o StrictHostKeyChecking=yes -o UpdateHostKeys=no -o ClearAllForwardings=yes -o PermitLocalCommand=no USUARIO@SERVIDOR 'uname -s'
```

No reenviar el agente, X11 ni puertos. Si la clave necesita desbloqueo, hacerlo
en la terminal del propietario con el agente local; no copiar claves privadas
al repositorio, al chat ni al Linux. No crear cuentas, instalar claves ni cambiar
la autenticación como parte de este inventario.

SSH con una cuenta administrativa permite escrituras: estas opciones no crean
una cuenta de solo lectura. El alcance de esta revisión se limita a comandos
de consulta revisados por etapas. No ejecutar scripts importados del parche,
del repositorio o de una PR en el servidor. La conexión puede generar registros
normales de autenticación; no se cambia la configuración de servicios.

## 1. Puertos y servicios publicados

Ejecutar en una terminal del servidor real:

```sh
ss -lntu
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
sudo -n ufw status verbose
tailscale serve status
tailscale funnel status
```

Si falta permiso, una herramienta no existe o `sudo -n` pide contraseña, registrar
la comprobación como pendiente. No instalar ni cambiar permisos para obtenerla.
El propietario puede ejecutar el mismo comando con `sudo` desde su terminal;
la contraseña se introduce únicamente en esa terminal.

Interpretación:

- `127.0.0.1` y `::1` indican escucha local. `0.0.0.0`, `*` y `::` requieren
  revisar interfaces, firewall y acceso externo; por sí solos no demuestran
  exposición a Internet ni una vulnerabilidad.
- Revisar puertos publicados por Docker aunque UFW esté activo. El filtrado de
  tráfico Docker requiere comprobar las reglas efectivas; UFW por sí solo no
  certifica que un puerto publicado esté cerrado.
- Serve y Funnel deben revisarse por servicio. Acceso limitado al tailnet todavía
  requiere comprobar qué identidades tienen permiso en su política efectiva.
- La tabla de Docker identifica las imágenes configuradas; una etiqueta mutable
  no prueba la versión efectiva ni la existencia de un parche de Dockge.

## 2. Acceso administrativo y permisos

Después de revisar la primera etapa:

```sh
id -nG
stat -c '%a %U %G %n' /var/run/docker.sock
docker info --format '{{json .SecurityOptions}}'
sudo -n sshd -T | rg '^(permitrootlogin|passwordauthentication|pubkeyauthentication|kbdinteractiveauthentication|permitemptypasswords|authenticationmethods|allowusers|allowgroups|denyusers|denygroups) '
```

Si `rg` no está instalado, usar `grep -E` con la misma expresión. La pertenencia
al grupo Docker o el control de su socket puede permitir administrar el host;
registrar quién necesita esa autoridad. No agregar usuarios a ese grupo.
La salida de `sshd -T` muestra la configuración general: revisar también las
reglas `Match` aplicables a la conexión administrativa antes de concluir qué
política se aplica. Esta etapa no cambia la autenticación.

Para identificar condiciones `Match` y archivos incluidos sin volcar toda la
configuración, el propietario puede consultar estas directivas en su terminal:

```sh
sudo grep -HniE '^[[:space:]]*(Include|Match)([[:space:]]|=)' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf
```

Si aparecen otros archivos incluidos, revisar esas rutas antes de concluir que no
hay condiciones adicionales. Para evaluar una conexión concreta, usar después
`sshd -T -C` con sus parámetros reales en privado. No reiniciar SSH ni editar su
configuración durante estas consultas.

La primera captura de esta búsqueda mostró únicamente el Include del directorio
de fragmentos, pero era sensible a mayúsculas. La repetición con `-i`, que cubre
la semántica de palabras clave de sshd, volvió a mostrar solo ese Include y ninguna
directiva Match activa en los archivos consultados. No necesita repetirse sin
cambios de configuración o una nueva razón de verificación.

Si las consultas anteriores requieren contraseña, el propietario puede ejecutar
en su terminal del servidor, escribiendo la contraseña únicamente allí:

```sh
sudo ufw status verbose
sudo /usr/sbin/sshd -T | grep -E '^(permitrootlogin|passwordauthentication|pubkeyauthentication|kbdinteractiveauthentication|permitemptypasswords|authenticationmethods|allowusers|allowgroups|denyusers|denygroups) '
```

Ocultar direcciones y cuentas antes de compartir resultados. Estos comandos no
incluyen por sí solos las reglas efectivas de Docker/IPv6, las condiciones `Match`
aplicables ni las comprobaciones de router y tailnet.

## 3. Revisión que requiere contexto adicional

Los bloques de host siguientes documentan el procedimiento ya completado el
6 de noviembre mediante captura privada completa de ambas familias. No repetir
por rutina los comandos: consultar los resultados del inventario y ampliar solo
si hay cambios de configuración o una duda nueva.

Tras revisar la tabla UFW, el siguiente bloque acotado consulta únicamente el
orden de entrada y las cadenas de Tailscale en IPv4 e IPv6. En el host se confirmó
iptables/ip6tables con backend `nf_tables`. Ejecutar en la terminal del propietario:

```sh
sudo iptables -S INPUT
sudo iptables -S ts-input
sudo ip6tables -S INPUT
sudo ip6tables -S ts-input
```

`-S` lista reglas; no las aplica ni las borra. Si una cadena no existe, conservar
el error y revisar el backend utilizado antes de concluir que falta filtrado.
Ocultar direcciones al compartir la salida, conservando interfaces, puertos,
orden y saltos entre cadenas. Este bloque no comprueba FORWARD, NAT de Docker
ni otras tablas nftables; revisarlas después con alcance específico.

### Filtrado Docker: siguiente bloque acotado

Consultar la política FORWARD y las cadenas Docker en filter, y las rutas de
entrada/salida hacia Docker en nat, para IPv4 e IPv6. Los filtros seleccionan
solo las declaraciones y reglas relevantes de la salida; no ejecutan una
restauración de reglas ni modifican el firewall. Listar además los nombres de
tablas nftables para detectar otras tablas que requieran revisión específica.

```sh
sudo iptables-save -t filter | grep -E '(^:|^-A )(FORWARD|DOCKER[^ ]*|ts-forward)[[:space:]]'
sudo iptables-save -t nat | grep -E '(^:|^-A )(PREROUTING|OUTPUT|DOCKER[^ ]*)[[:space:]]'
sudo ip6tables-save -t filter | grep -E '(^:|^-A )(FORWARD|DOCKER[^ ]*|ts-forward)[[:space:]]'
sudo ip6tables-save -t nat | grep -E '(^:|^-A )(PREROUTING|OUTPUT|DOCKER[^ ]*)[[:space:]]'
sudo nft list tables
```

Conservar errores o ausencia de coincidencias; no crear cadenas para corregirlos.
Si una regla salta a otras cadenas, revisarlas antes de concluir que el recorrido
completo está comprobado. Este bloque no muestra sus cuerpos, POSTROUTING ni reglas
raw; tampoco sustituye la revisión de otras tablas nftables que puedan aparecer.

El bloque ya aportado muestra tablas mangle IPv4/IPv6 y raw IPv4, cuyos cuerpos
no aparecían en la selección anterior. Consultar esos cuerpos, POSTROUTING y las
cadenas UFW que completan el recorrido es el siguiente alcance local; no volver
a pedir los bloques ya comprobados sin una razón nueva. Antes de concluir sobre
rutas directas hacia contenedores, revisar especialmente la tabla raw.

Con el listado de tablas ya revisado y el backend nf_tables confirmado, el
propietario puede aportar una única lectura completa del ruleset para comprobar
los cuerpos y saltos restantes sin fragmentar más la evidencia:

```sh
sudo nft list ruleset
```

Esta consulta no carga reglas ni escribe archivos. Mantener la salida en privado;
si se comparte, ocultar direcciones y nombres conservando familias, interfaces,
puertos, prioridades, orden, políticas y saltos. No usar `nft -f`, flush ni
comandos de restauración: este paso es exclusivamente una lectura.

Con el orden de entrada observado, priorizar la revisión de Grants/ACL en la
administración de Tailscale: identificar quién puede alcanzar SSH, Cockpit y el
HTTPS de Dockge. La regla ACCEPT de `tailscale0` precede a UFW; agregar o quitar
una regla UFW no prueba por sí solo que cambie el acceso del tailnet.
Consultar la política sin editarla. Si el propietario comparte su contenido,
anonimizar correos, dominios, dispositivos y direcciones de forma consistente,
conservando los vínculos entre grupos, etiquetas, orígenes, destinos y puertos.
No compartir claves de autenticación ni tokens de la administración.

La vista de política no enumera por sí sola quién está dentro del tailnet. Revisar
Users, roles administrativos e invitaciones, y Machines, propietarios y estado
de compartición. Un resumen de `tailscale status` solo muestra lo visible al nodo;
no certifica la lista administrativa completa. La pestaña Tailscale SSH describe
otra función: comprobar si está habilitada en el host antes de interpretar sus
reglas como acceso SSH efectivo. No habilitarla para completar este inventario.

- Revisar reglas efectivas del firewall, incluidas las de Docker, IPv4 e IPv6,
  con la herramienta disponible en el host. No volcar ni modificar reglas sin
  revisar el alcance y conservar una vía administrativa de recuperación.
- Revisar en el router redirecciones de puertos, UPnP y firewall IPv6. La lectura
  del Linux no comprueba la configuración del router ni del proveedor.
- Revisar en la administración de Tailscale Grants/ACL, miembros, dispositivos y
  permisos de administración. La configuración de Serve no describe esa política.
- Verificar identidad y versión efectiva de Dockge, acceso a su administración y
  montajes/permisos del socket mediante campos seleccionados. No usar un volcado
  completo de `docker inspect`, que puede contener variables con secretos.
- Cuando exista un destino y alcance acordados, verificar conectividad desde
  dispositivos permitidos y no permitidos. No escanear redes ni terceros.

## Evidencia y cierre

Las salidas originales quedan privadas. Antes de compartirlas en el chat, ocultar
direcciones públicas, nombres de personas, cuentas y dominios privados si aparecen;
conservar tipo de interfaz, puertos y relación entre servicios para interpretarlas.
No pegar `.env`, tokens, claves privadas, cookies, contraseñas o respaldos.

En el repositorio registrar únicamente un resumen por área: comprobado, resultado,
qué falta y si requiere una corrección de SEG-02 o SEG-03. No marcar SEG-01 como
completada mientras falten las verificaciones de su alcance; los límites de acceso
deben quedar explícitos. Una señal de exposición requiere analizar alcance e
impacto antes de registrarla como vulnerabilidad.

La revisión del código sigue como SEG-04 en el [backlog](backlog.md). Esta revisión
operativa no certifica la seguridad de Routale ni autoriza por sí sola el despliegue.

Referencias: [opciones del cliente OpenSSH](https://man.openbsd.org/ssh_config),
[configuración de sshd](https://man.openbsd.org/sshd_config),
[filtrado de red de Docker y UFW](https://docs.docker.com/engine/network/packet-filtering-firewalls/)
y [modos netfilter de Tailscale](https://tailscale.com/docs/reference/netfilter-modes).
