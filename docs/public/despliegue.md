# GitHub, Docker y acceso privado en Linux

## Estado real

El [procedimiento de respaldo y recuperación](recuperacion.md) tiene un ensayo
local con datos ficticios; su instalación y recorrido entre Linux y Windows
siguen pendientes antes del primer despliegue con datos reales.

CI de PR y main se ejecuta en máquinas de GitHub. Comprueba frontend, pruebas
unitarias .NET, migraciones, API sobre SQLite temporal, contenido publicable y
la imagen Nginx con sus cabeceras reales. Publicar imágenes sigue condicionado
a ENABLE_IMAGE_PUBLISH=true y una versión aprobada de main.

El job `image` se omite en las PR y cuando esa variable no está habilitada.
Es el publicador de imágenes en GHCR; el job `checks` construye y comprueba la
imagen web/Nginx independientemente de publicar. Ni ese job ni publicar en GHCR
despliegan servicios en el Linux. La protección de `main` se configura por separado
en los rulesets de GitHub: el YAML define los checks y la regla exige que pasen.

Las recetas Docker/Compose incluyen frontend, API sin puertos publicados y un
volumen privado para SQLite y claves. El stack local está ensayado; la instalación
Linux existente se revisa por separado, sin desplegar ni cambiar sus servicios.
Los resultados sensibles de inventario permanecen en notas privadas.

Se retira la propuesta de conectar un ejecutor self-hosted de este repositorio
público al Linux personal. La automatización remota se implementará después de
probar el despliegue manual y su recuperación. No activar las antiguas variables
ENABLE_SERVER_DEPLOY ni ENABLE_AUTO_DEPLOY; ya no controlan un workflow remoto.

## Utilidad del servidor para la siguiente iteración

La [decisión de arquitectura](decision-arquitectura.md) define el alcance inicial
personal, el trabajo offline, el servicio de copias y los criterios de evolución.
La topología descrita allí es objetivo, no una stack completa ya desplegada.

La revisión de diseño y distribución mantiene Linux como una opción útil, sin
dependencia para trabajar sin red tras preparar la PWA. Alojar solo el frontend
permite abrir una versión central de la aplicación; las notas siguen siendo
copias independientes de cada navegador/dispositivo. El valor adicional para
PC y móvil se obtiene guardando y recuperando copias autenticadas mediante
la API integrada. Eso tampoco equivale a sincronización automática.

El diseño y las copias se han ensayado con datos ficticios en el PC. También se
identificó el Linux y se hizo un inventario autorizado de solo lectura; no se
activaron servicios ni se ejecutó un despliegue remoto. Los hallazgos y límites
están en [revisión de seguridad](despliegue-seguro.md); la información de acceso
permanece fuera de Git. Falta cerrar HTTPS, permisos, procedencia y recuperación.

El CI prepara ambas imágenes después de las comprobaciones, incluida integración
real de navegador/API/SQLite. Solo puede publicar desde `main` de
`Yianfri/routale` con `ENABLE_IMAGE_PUBLISH=true`. El workflow firma los digests
de web y API y comprueba ambas atestaciones antes de anunciar el par en el
resumen de Actions. El [PR 8](https://github.com/Yianfri/routale/pull/8) integró
este control. Los [checks de main](https://github.com/Yianfri/routale/actions/runs/42492607756)
pasaron. La [primera publicación firmada](https://github.com/Yianfri/routale/actions/runs/42493380176)
publicó y verificó el par del commit `1a4b1c5`. El verificador también se
probó desde Linux con las imágenes por digest.
La guía pública vigente sustituye cualquier plan anterior de ejecutor self-hosted.

### Primer ensayo en Linux

El 8 de noviembre de 2026 se levantaron la web y la API del commit `1a4b1c5`
en un proyecto Compose y volumen exclusivos de ensayo. Se aplicó la migración
antes de arrancar y se creó una cuenta ficticia. Desde el PC se comprobó HTTPS
con un certificado válido de Tailscale, salud, rechazo de peticiones sin
sesión, guardado de un viaje ficticio y lectura con la misma sesión tras
reiniciar los servicios. El [ensayo de recuperación](recuperacion.md#ensayo-y-operación-pendientes)
comprobó un volumen separado.

Al acabar la prueba HTTPS se restauró y comprobó la configuración anterior de
Tailscale Serve. La instancia de ensayo quedó saludable y limitada a loopback.
Se detuvo la instancia restaurada y se conservó su volumen de prueba. El ensayo
de instalación de la PWA en el teléfono sigue en VAL-01.

## Acceso recomendado: Tailscale Serve

Mantener web/proxy en loopback y API/base en la red privada de contenedores.
Tailscale Serve ofrece HTTPS a dispositivos autorizados del tailnet, sin comprar
un dominio propio. Android y PC deben tener Tailscale instalado y conectado,
y las reglas de acceso deben limitar quién llega al servicio.
Al incorporar el celular, concederle únicamente el HTTPS de Routale; mantener
SSH y Cockpit reservados al PC administrativo. Esa ampliación se hará durante
la preparación del acceso y la validación física, sin habilitarla en SEG-03.

El enlace tendrá la forma de ejemplo `https://routale.nombre-del-tailnet.ts.net`.
La dirección real depende del nombre del equipo y el tailnet, y se registra solo
en documentación privada. Revisar los otros servicios Serve del equipo antes de
modificar su configuración. Los nombres usados en certificados HTTPS aparecen
en registros públicos de certificados; elegir nombres genéricos.

Serve comparte dentro del tailnet. Funnel publica hacia Internet y no se habilita
para este uso. Comprobar la configuración existente: habilitar HTTPS no debe
aceptar por accidente una publicación pública. Mantener también login, CSRF,
cookies Secure y autorización de la API.

HTTPS termina en Serve/proxy: antes de conectarlo a producción, definir la cadena
de proxies de confianza y el tratamiento de forwarded headers. No confiar en
cabeceras enviadas directamente por clientes ni habilitar HTTP público. La PWA
requiere HTTPS fuera de localhost. Sin red podrá usar su copia local tras cargarla;
sin el servidor encendido no habrá acceso remoto ni guardado remoto.

Mantener estable el origen HTTPS elegido: cambiar dominio o puerto crea otro
almacenamiento del navegador. Exportar/restaurar antes de trasladar un cuaderno.

Cloudflare Tunnel más Access es otra opción si se desea acceder sin el cliente
Tailscale. Requiere otra configuración e incorpora un intermediario. Con Tailscale
ya instalado, la primera opción recomendada es mantener Linux y acceso privado.

## Flujo de despliegue propuesto

### Desarrollo local y revisión en GitHub

Los cambios pueden escribirse y probarse en el PC. Una rama local conserva los
commits; push los publica en una rama de GitHub y una PR propone integrarlos a la
rama base. Crear un commit o una PR no despliega Routale en el Linux.

1. Revisar estado y diferencias antes de editar, conservando el trabajo existente.
   Para separar tareas, crear una rama o un worktree desde la base acordada;
   no limpiar el árbol ni cambiar de base perdiendo cambios locales.
2. Implementar y comprobar localmente. Revisar el diff y preparar solo los
   archivos de la tarea; excluir acceso SSH, datos, claves y salidas del servidor.
3. Crear commits pequeños y ejecutar la revisión de publicación antes de push.
   Usar una rama del repositorio propio o un fork si se contribuye a otro
   repositorio; comprobar remoto, repositorio destino y rama base de la PR.
4. Abrir la PR y comprobar su CI en ejecutores de GitHub. Los cambios de una PR
   permanecen separados de la instalación del Linux hasta una versión aprobada
   y un procedimiento de despliegue revisado.

El acceso SSH se usa por separado para el [inventario de lectura](inventario-linux.md).
No entregar claves administrativas del servidor a las pruebas de PR ni ejecutar
allí código de forks. La operación con datos reales sigue después de la
validación en dispositivos y la preparación del respaldo definitivo. El
actualizador integrado web/API está pendiente en OPS-05.

### Instalación de una versión aprobada

1. Trabajar en una rama y abrir PR; pruebas y compilación en GitHub.
2. Integrar a main una versión revisada y publicar imágenes por commit/digest.
3. En el primer despliegue, el operador [verifica la procedencia](#verificación-de-procedencia)
   y descarga las dos imágenes aprobadas por digest desde Linux. Usa una copia
   revisada del verificador de la versión aprobada. El actualizador local que
   automatizará este paso sigue pendiente de OPS-05.
4. Detiene la API, respalda base y claves en privado y aplica [migraciones](migraciones.md)
   con el nuevo binario sobre el mismo volumen.
5. Inicia, comprueba salud y lectura/autenticación, y registra la versión instalada.
6. Si falla, conserva el servicio detenido o vuelve a una versión compatible.
   Si el esquema cambió, restaurar el respaldo probado; no ejecutar Down automáticamente.

Un timer local puede comprobar versiones cada minuto: actualización automática
poco después de publicar, sin credenciales de administración del Linux en GitHub.
Es una propuesta pendiente de implementar y ensayar. No se afirma que exista ya
un agente pull ni un ensayo de recuperación de la API en el Linux.

### Verificación de procedencia

Para el primer ensayo, comprobar qué commit aprobado está en `main` y
habilitar temporalmente `ENABLE_IMAGE_PUBLISH=true` en las variables de Actions.
Ejecutar **Comprobar y empaquetar** manualmente sobre `main`. Evitar otros merges
mientras esté habilitada la variable. Comprobar que el resumen de la ejecución
corresponda al commit aprobado y muestre las dos referencias verificadas.
Restablecer el valor anterior de la variable al terminar el ensayo.

El 8 de noviembre de 2026, el ensayo manual verificó en GitHub las
atestaciones de [web](https://github.com/Yianfri/routale/attestations/65067367)
y [API](https://github.com/Yianfri/routale/attestations/65067378). GHCR respondió
a la lectura anónima de los dos manifiestos por digest. Al iniciar el job de
imágenes se restableció el control para ejecuciones futuras retirando la
variable temporal.

Desde Linux se ejecutó el verificador del commit aprobado con GitHub CLI
portable, comprobado contra el SHA-256 de la publicación oficial. Las dos
atestaciones se obtuvieron de la API pública y se pasaron mediante `--bundle`.
La verificación aceptó los dos digests de `1a4b1c5` y rechazó el mismo par al
exigir otro commit. El ensayo no necesitó credenciales ni instaló paquetes en
el sistema. La descarga operativa y el arranque quedan para OPS-03.

Elegir un commit aprobado en `main` de `Yianfri/routale` y copiar las dos
referencias por digest del resumen de su publicación exitosa. Usar GitHub CLI
con `gh attestation verify`, autenticado en GitHub y con acceso de lectura
al registro GHCR. Desde una copia revisada de ese commit, ejecutar:

```sh
bash deploy/verify-images.sh "$approved_commit" "$web_ref" "$api_ref"
```

El primer valor es el SHA completo del commit aprobado. Los otros dos son
`ghcr.io/yianfri/routale@sha256:…` y `ghcr.io/yianfri/routale-api@sha256:…`, en ese
orden. El verificador exige atestaciones de GitHub para `ci.yml`, `main` y ese
mismo commit, emitidas en un ejecutor alojado por GitHub. Comprueba además
que cada nombre firmado corresponde a su digest. Un error de autenticación,
red, firma o política detiene la comprobación.

Solo si pasan las dos imágenes, usar esas referencias exactas en el `.env`
privado. Antes de descargar, comprobar que `docker compose config --images`
muestre exactamente ese par con el entorno elegido. Conservar juntos el SHA
y las dos referencias para repetir la verificación al instalar o recuperar.

Referencias de GitHub sobre [variables de Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables#creating-configuration-variables-for-a-repository),
[ejecución manual](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow),
[atestaciones para imágenes](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations#generating-build-provenance-for-container-images)
y [verificación con GitHub CLI](https://cli.github.com/manual/gh_attestation_verify).

### Dockge, Portainer y despliegue automático

Para el uso actual se eligió administrar Routale mediante Compose por SSH y
mantener Dockge detenido. La administración será ocasional; no se construirá un
panel propio ni se instalará otro solo para montar la aplicación. Una interfaz
de consulta podrá evaluarse después si aparece una necesidad concreta. Las
instrucciones de operación quedan en el apartado siguiente. La receta y su
plantilla de entorno usan una carpeta dedicada, conservando proyecto y volumen.

La pila Compose de este repositorio ya define web/proxy, API y almacenamiento
persistente. Dockge permite visualizar y administrar pilas Compose ubicadas en
su directorio configurado; la aplicación se abre en su propio origen HTTPS, no
en el panel de administración. Al integrar la pila, conservar el mismo proyecto,
volumen y archivos aprobados. No administrar la misma pila simultáneamente con
dos paneles ni editar en el servidor cambios que deban revisarse primero en Git.

Portainer no es un requisito para instalar Routale o automatizar su despliegue.
La decisión sobre el panel corresponde a SEG-03, incluido el aviso de seguridad
pendiente de Dockge. Cambiar de panel no verifica imágenes, migra SQLite ni
restaura copias por sí solo. En una instalación conectada al socket Docker,
Portainer también necesita autoridad sobre ese daemon; no se considera una
solución automática al riesgo administrativo.

GitHub puede automatizar comprobaciones y publicación tras integrar a main.
El objetivo solicitado para OPS-05 es que integrar un cambio aprobado en main
termine en un despliegue automático en el Linux cuando la CI y las verificaciones
de la versión pasen, sin repetir manualmente el procedimiento en cada entrega.
Un push a una rama o una PR no autoriza ejecutar ese código en el servidor.
Después de ensayar instalación y recuperación manuales, OPS-05 puede añadir
un servicio local que consulte una versión aprobada, verifique procedencia,
respalde, migre y actualice web/API juntas. Mantener una única autoridad de
actualización: el panel observa la pila y las intervenciones manuales se coordinan
con ese servicio. No activar webhooks, actualizaciones de etiquetas mutables o
un runner personal como atajo al procedimiento pendiente.

update.sh es un ayudante manual para el frontend aislado y rechaza el stack con API:
descarga una imagen,
conserva .env.previous y comprueba salud. La etiqueta/digest es inmutable, pero
su formato no demuestra procedencia ni aprobación. No usarlo como verificador de
versiones ni como rollback de base de datos.

### Operación de Routale por Compose/SSH

Routale es el nombre de la aplicación. `bitacora` es su identificador de proyecto
Docker heredado, igual que el prefijo de configuración `BITACORA_*`; se conservan
por compatibilidad. Su volumen de datos se llama `routale_private_data`.

La preparación operativa ya se instaló por SSH en `~/routale` de la cuenta
administrativa, sin iniciar servicios. La carpeta tiene permisos 700 y sus tres
archivos, 600; propietario y hashes se comprobaron contra las copias locales.
El Compose real del Linux validó el modelo y aceptó las consultas de estado y
registros del proyecto. Contenedores, tiempos y reinicios, volúmenes y redes de
Valheim y Dockge coinciden antes y después. El resultado y las rutas personales
permanecen como evidencia local privada. El ensayo de OPS-03 usa un proyecto
y volumen separados de esta carpeta de operación.

La carpeta contiene `compose.yaml`, `.env.example` y `OPERACION.md`. Este último
incluye los comandos de consulta que usan la plantilla en esta etapa. El
`.env` de esta carpeta se preparará para la operación habitual con las dos
imágenes por digest tras verificar su procedencia. La plantilla contiene
marcadores para ambos digests. Conservar
loopback, el nombre de proyecto `bitacora` y el volumen `routale_private_data`.
Si se adapta la red privada para evitar una colisión, mantener coherentes subred,
gateway, IP de web, IP de API y proxy de confianza. No cambiar nombres o redes de
otras pilas para acomodar Routale. La carpeta y `.env` deben tener permisos solo
para la administración autorizada; nunca guardar ese `.env` en Git.

Después de preparar el `.env` activo, las imágenes y las migraciones de OPS-03,
entrar por el alias SSH privado habitual y definir esta función en la sesión del
Linux con la misma cuenta propietaria de la carpeta. Mantener la ruta estable.
El proyecto se indica explícitamente para evitar depender de la carpeta actual
o de variables de Compose heredadas:

```sh
routale_compose() {
  docker compose \
    --project-name bitacora \
    --project-directory "$HOME/routale" \
    --env-file "$HOME/routale/.env" \
    --file "$HOME/routale/compose.yaml" "$@"
}
```

Consultar configuración y estado sin crear recursos:

```sh
routale_compose config --quiet
routale_compose ps --all api web
```

Consultar un número acotado de registros, manteniéndolos privados:

```sh
routale_compose logs --no-color --tail 100 api web
```

Una vez instalada y migrada la pila, un reinicio operativo de los contenedores
existentes interrumpe brevemente las solicitudes. No descarga imágenes, aplica
cambios de `.env` ni sustituye una migración o un despliegue:

```sh
routale_compose restart --no-deps --timeout 30 api web
routale_compose ps --all api web
curl --fail --silent --show-error --max-time 5 http://127.0.0.1:8088/api/health
```

Si no existen contenedores, consultar el estado e ir al procedimiento de primera
instalación de OPS-03. No usar `up` para resolver a ciegas un volumen vacío o una
base sin migrar. No ejecutar `down --volumes`, podas globales ni comandos sobre
todas las pilas. Los registros y el modelo completo de Compose pueden contener
información privada: validar con `config --quiet` y no publicar sus salidas.

Cambiar versión requiere el respaldo, la migración y la recuperación descritos
en [recuperación](recuperacion.md) y [migraciones](migraciones.md). El ayudante
`update.sh` sigue limitado al frontend aislado. Estas instrucciones no habilitan
OPS-05 ni requieren reactivar Dockge o iniciar Valheim.

## Ensayo Docker local conjunto

```sh
docker compose -f deploy/compose.local.yaml up --build -d
node frontend/tools/check-http-security.mjs http://localhost:8088
node frontend/tools/prepare-docker-local.mjs
node frontend/tools/check-stack.mjs --restart
```

Sirve la aplicación en http://localhost:8088. Importar y escribir el diario son
operaciones locales; Mi copia permite enviar una copia explícitamente tras el login.
El acceso de prueba aleatorio permanece en .data/docker-local/access.json, fuera de
Git. La API Development está aislada en la red interna; solo el proxy declarado
y loopback pasan su control. La web publica únicamente el puerto loopback.
Detener con compose stop conserva el volumen. Nunca usar down -v para actualizar.
Nginx conserva DENY, nosniff, Referrer-Policy y CSP frame-ancestors con
Cache-Control no-cache en HTML y Service Worker.

Antes de usar compose.yaml en Linux: elegir las dos imágenes integradas revisadas,
preparar un volumen y claves privados, respaldar y ejecutar el comando migrate
como paso independiente. nginx.stack.conf asume un ingreso HTTPS de confianza
hacia el puerto loopback; no usar esa configuración directamente por HTTP público.
Ver [revisión de seguridad](despliegue-seguro.md) y [migraciones](migraciones.md).

Referencias: [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve),
[pilas existentes en Dockge](https://github.com/louislam/dockge#can-i-manage-existing-stacks),
[conexión de Portainer al socket Docker](https://docs.portainer.io/admin/environments/add/docker/socket),
[certificados HTTPS](https://tailscale.com/docs/how-to/set-up-https-certificates),
[Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel),
[seguridad de ejecutores GitHub](https://docs.github.com/en/actions/reference/security/secure-use)
y [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/).
