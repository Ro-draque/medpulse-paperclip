# Etapa 2 - instalación y primera ejecución

## Resultado observado
Paperclip 2026.1106.0 instalado nativamente en Windows. API responde status=ok; interfaz oficial servida en http://127.0.0.1:3100. PostgreSQL embebido inicializado y migraciones aplicadas. Company MEDPULSE y un solo agente Growth Director.

## Decisiones
- Node 24.22.1, pnpm 11.25.0 y Codex CLI 0.167.0-alpha.3.2 ya disponibles. Codex autenticado con ChatGPT; no se agregó una API key.
- Se fijó Paperclip y se preservó el lockfile. Rutas absolutas para caché/store y node-linker hoisted después de un intento dlx que dejó de mostrar progreso. La causa exacta del bloqueo no está confirmada.
- pnpm requirió seleccionar scripts de preparación; se permitieron Paperclip y PostgreSQL, no los de runtimes no usados.
- codex_local falló con EPERM al crear un enlace simbólico de auth.json. Se conservaron los intentos fallidos en Paperclip. No se modificaron políticas de Windows ni el código de Paperclip.
- Alternativa funcional: adaptador oficial process que ejecuta Codex CLI mediante un wrapper propio. La autenticación usa el inicio de sesión existente sin copiarlo al repositorio. El wrapper recibe el token de Paperclip, pero lo retira del entorno que entrega a Codex.
- Codex recibe la entrada y devuelve una respuesta estructurada, sin herramientas y con sandbox read-only. El wrapper valida, guarda el recibo, comenta y cierra la tarea. Es ejecución real de Codex; no equivale a tener codex_local funcionando.

## Alcance y límites
No se creó dashboard propio, cinco agentes, campañas, envío externo ni revisión humana obligatoria. Esta etapa demuestra únicamente servidor, ejecución y trazabilidad. El adaptador process no proporciona por sí solo la misma visualización de tokens/costes que codex_local; falta instrumentar uso y presupuestos para la compañía final. La prueba mide coherencia con una regla, no capacidad comercial.

La instalación inicial tardó más de diez minutos. La ruta de instalación nueva con lockfile está preparada, pero falta validarla desde cero en otro entorno. Las respuestas libres pueden variar entre ejecuciones; identificadores, hashes y decisión esperada permiten auditarlas. No lanzar múltiples smoke tests simultáneamente: el worker selecciona una tarea pendiente asignada, adecuado para esta prueba serial.

El doctor emitió una advertencia de permisos POSIX del archivo local de claves en Windows; no se interpreta como una verificación de las ACL de Windows. El servicio de arranque automático no está soportado en este entorno: hay que mantener la terminal abierta. Los datos locales están en una carpeta bajo OneDrive; evaluar moverlos a un directorio no sincronizado antes de usar datos reales.
