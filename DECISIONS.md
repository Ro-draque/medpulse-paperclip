# Decisiones y resultados

**Alcance de la demo.** Elegimos B2 para probar un flujo de recompra con datos sintéticos y evidencia verificable. B3 lo complementa con borradores de Instagram listos para revisión. Paperclip coordina las tareas y conserva su historial.

**Ejecución local.** Usamos Codex CLI para que Paperclip pudiera ejecutar trabajo asistido por un modelo en la computadora de la demo. Tras un fallo de enlaces simbólicos en Windows con `codex_local`, usamos el adaptador `process`. Codex CLI es una elección de esta implementación. El diseño de MEDPULSE permite sustituirlo por otros ejecutores.

**Prueba de WhatsApp.** Usamos un sandbox HTTP para comprobar el intercambio entre Paperclip y el adaptador sin enviar mensajes. MED-22 registró cuatro respuestas HTTP y un solo efecto simulado pese a la repetición. Su recibo vincula la ejecución con la revisión de MED-6. [Evidencia de la prueba](docs/WHATSAPP-SANDBOX.md)

**Reproducción.** Una compañía nueva completó el flujo base en 108,82 segundos con Paperclip y Codex listos. El arranque desde cero dentro de diez minutos sigue sin validarse. [Registro de la prueba](docs/reproduction-2026-11-09.json)

**Límite y próximo paso.** Creamos la app MEDPULSE en Meta for Developers. Un bloqueo al crear el portafolio empresarial impidió completar la configuración de WhatsApp Business. Las pruebas de los adaptadores de Meta usaron respuestas simuladas. No hubo llamadas autenticadas a Meta, envíos reales ni publicaciones reales. El siguiente paso es resolver el portafolio y verificar el acceso al número de prueba antes de solicitar autorización para un envío. [Evolución futura](ROADMAP.md)
