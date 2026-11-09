# Sandbox HTTP de WhatsApp

Paperclip asigna MED-22 a Outreach Operator. El adaptador existente lee la revisión de MED-6 y valida el payload ficticio. En modo sandbox abre un servidor temporal en `127.0.0.1` y ejecuta HTTP real contra `POST /v1/sandbox-phone/messages`. El simulador exige JSON, producto WhatsApp, tipo texto, cuerpo y destinatario ficticio. El resultado queda en el documento `receipt` y en un JSON adjunto a MED-22. El recibo lleva fecha, ID de ejecución, revisión fuente y cada solicitud y respuesta.

| Caso ejecutado | Resultado |
|---|---|
| Texto ausente | HTTP 400 |
| Fallo inyectado | HTTP 503 |
| Solicitud válida | HTTP 200, ID `simulated.whatsapp.a5ec1819802b337b9c1d24d2` |
| Repetición con la misma clave | HTTP 200, mismo ID y `replayed: true` |

La ejecución `73c0e9e2-84ab-4574-9791-4f83674c4b1d` creó un solo efecto simulado. La clave deriva de la revisión y del payload. El registro persistente en `evidence/whatsapp-http-sandbox/ledger` permite repetir la consulta incluso tras reiniciar el simulador. Una clave con otro payload devuelve HTTP 409. La evidencia registra cuatro solicitudes locales, cero llamadas a Meta y cero mensajes enviados. MED-6 estaba pendiente de aprobación al momento de la prueba. La aprobación posterior se verifica en Paperclip y no corresponde a un envío.

## Reproducción

Con Paperclip iniciado y la campaña del flujo base preparada en revisión:

```powershell
node scripts/start-handoff.mjs --http-sandbox
# Esperar que la tarea nueva aparezca como completada en Paperclip.
node scripts/export-whatsapp-sandbox.mjs
node scripts/build-dashboard.mjs
node scripts/preview-dashboard.mjs
```

Abrir `http://127.0.0.1:4173/#whatsapp-sandbox`. El exportador coteja el estado de la tarea, el run y el hash de la campaña con Paperclip. Una repetición para la misma revisión conserva el mismo ID y registra cero efectos nuevos. MED-7 conserva su recibo original de validación local sin HTTP.

## Proveedor real

Cuando Meta habilite la configuración, seguir [las instrucciones de prueba oficial](META-SETUP.md). Preparar el número de prueba, destinatario verificado, token, versión y plantilla. Revisar el plan y solicitar autorización explícita antes de un intento real. El ejecutor manual de Meta usa un destino fijo oficial y su propio control de aprobación del plan. El marcador ficticio del sandbox nunca se usa como destinatario de Meta.

Una futura conexión desde Paperclip al proveedor real requiere un transporte separado que compruebe la decisión humana de la revisión exacta y sus permisos antes de efectuar el envío. El recibo de sandbox acredita la interconexión local por HTTP. Para acreditar aceptación por Meta se necesita una respuesta autenticada del proveedor y para acreditar entrega se necesita confirmación adicional.
