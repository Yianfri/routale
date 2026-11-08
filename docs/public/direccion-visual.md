# Dirección visual de Routale

## Punto de partida para retomar

El rediseño está en Angular. Se eligió después de probar un prototipo navegable
con datos ficticios en escritorio y móvil. El recorrido principal es
**Explorar viaje de ejemplo → Ruta → elegir jornada → Anotar este día**.
En la misma jornada se puede usar **Editar jornada** y en **Mi copia** se
pueden exportar o recuperar respaldos. Los pasos de ejecución están en el
[README](../../README.md#ejecutar) y el estado del producto en el [backlog](backlog.md).

## Decisiones y motivos

- **Una acción que se entienda de un vistazo.** La bienvenida usa el paisaje
  ficticio del repositorio, un texto breve y una acción principal para entrar
  a la demo. Importar y recuperar una copia quedan disponibles como acciones
  secundarias. El estado del servidor aparece en Mi copia, donde se puede actuar.
- **Ruta reúne Jornada e Itinerario.** En escritorio conviven la lista y el
  detalle. En móvil se alternan y el acceso de regreso devuelve el foco a la
  jornada elegida. La barra inferior presenta Ruta, Diario y Mi copia con
  texto, icono y estado activo. Ambas presentaciones comparten la navegación.
- **Lo necesario para una parada queda a la vista.** La fecha, el tramo,
  el alojamiento y el abastecimiento aparecen primero. Traslados, superficie,
  dificultad, kilometraje real, plan B, presupuesto y procedencia están en
  **Más detalles**. El paisaje y el hilo de etapas orientan visualmente sin
  representar coordenadas reales.
- **Anotar y editar son acciones distintas.** Anotar abre el diario, conserva
  el borrador y registra la fecha y los kilómetros reales. Editar cambia la
  logística prevista: alojamiento, reserva, abastecimiento y plan B. Ambos
  formularios usan un diálogo nativo lateral en escritorio y a pantalla
  completa en móvil, con foco de regreso y movimiento reducido.
- **Apariencia y componentes compartidos.** Crema, carbón y verde en claro;
  superficies verdes oscuras y texto claro en oscuro. Usar los tokens, separar
  con espacio y líneas, y reservar paneles para interacciones que los necesitan.
  **Sistema / Claro / Oscuro** se guarda por navegador. Mantener controles con
  etiqueta, foco visible y área táctil de al menos 44 px.
- **Mi copia distingue el archivo local de la cuenta.** Exportar, restaurar,
  preparar uso sin conexión e instalar están en el ámbito del dispositivo.
  Las copias de cuenta conservan inicio de sesión, vinculación, guardado explícito
  y revisión antes de recuperar. Iniciar sesión no sube el cuaderno.

## Dónde continuar en el código

- [Composición y navegación](../../frontend/src/app/app.html) y
  [barra y apariencia](../../frontend/src/app/shared/navigation.ts).
- [Tokens](../../frontend/src/tokens.css) y
  [panel compartido](../../frontend/src/app/shared/editor-panel.ts).
- [Formulario de logística](../../frontend/src/app/features/trip/day-editor.ts),
  [operación de dominio](../../frontend/src/app/core/domain/planned-day.ts) y
  [transacción IndexedDB](../../frontend/src/app/core/storage/trip-repository.ts).
  El guardado comprueba la revisión leída al abrir el formulario y conserva IDs,
  fuentes, extensiones y el diario real. El respaldo mantiene el formato v1.

## Próximas decisiones y comprobaciones

- **Organizar viaje** queda como vista aparte. El primer flujo propuesto es
  insertar un descanso, revisar el cambio de fechas y confirmar. Las notas y
  los kilómetros reales se mantienen en su fecha de registro. La edición de
  traslados y presupuesto sigue pendiente.
- Al tocar presentación, recorrer bienvenida, lista, detalle, diálogo y
  Mi copia a 320, 390, 736 y 1024 px, en claro y oscuro, con teclado y
  movimiento reducido. Usar la compilación de producción para comprobar PWA.
- Quedan pendientes la instalación y el teclado en Android físico, además
  del despliegue. El diseño anterior y sus pruebas históricas están en Git.
