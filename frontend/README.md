# Routale

Aplicación Angular/PWA para consultar y editar la logística del viaje y registrar
notas con guardado local.

El [README del proyecto](../README.md) reúne instrucciones para ejecutar,
comprobar y desplegar. Las [reglas de frontend](AGENTS.md) describen convenciones
de componentes, datos, accesibilidad y pruebas.

Desde esta carpeta: `npm ci` y `npm start`. Para comprobar el uso sin conexión:
`npm run build` y `npm run preview`, con un solo servidor en el puerto 4200.

`npm start` y `npm run preview` por sí solos sirven la interfaz; para probar
sesión y copias junto con la API local, usar `npm run local` con el SDK .NET 10
disponible. La indisponibilidad de las copias remotas no impide usar el diario local.
Para retomar el frontend desde otra sesión, leer primero la
[dirección visual](../docs/public/direccion-visual.md) y luego el
[backlog](../docs/public/backlog.md). Desde la demo, probar **Ruta → Editar jornada**,
**Anotar este día** y **Mi copia** en escritorio y móvil.
