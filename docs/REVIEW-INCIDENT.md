# MED-6: revisión humana y corrección del ejecutor

## Diagnóstico comprobado

El comentario humano original 3d05508c-cc98-46c8-a443-972ef579f469 quedó guardado el 2026-11-08T23:01:25.709Z. El run 41bbe239-ae35-411d-bec5-30c40fa1cee5 arrancó desde la interfaz por asignación, inició una sesión real Codex y terminó con exitCode 1. Su log prueba el fallo:

`PUT /api/issues/.../documents/result: 409 — Document update requires baseRevisionId.`

La primera publicación funcionaba porque creaba el documento. La segunda requería leer latestRevisionId y enviarlo como baseRevisionId. El error estaba en nuestro wrapper, no en la persistencia del comentario ni en el acceso a Codex. Las advertencias sobre iconos y PowerShell del log no causaron este fallo.

Además el wrapper no incorporaba comentarios humanos al prompt y reutilizaba archivos locales para cada intento. El modelo del intento fallido repitió MEDPULSE como remitente y la sugerencia de cantidad porque no recibió las correcciones. Ese resultado no llegó a publicarse. Se archivaron sus archivos locales y log separadamente; el documento publicado original y el recibo HTTP 403 se conservaron y cotejaron por hash.

## Mecanismo formal en Paperclip 2026.1106.0

Con una etapa humana pending y tarea in_review, la persona revisora solicita cambios mediante una transición a in_progress incluyendo el motivo en el campo comment de la misma operación PATCH. Un comentario previo separado no sustituye el comentario de decisión. Paperclip registra outcome changes_requested y lastDecisionId, devuelve la tarea al ejecutor y conserva la misma etapa de aprobación. No se debe reasignar manualmente la tarea como sustituto de la decisión formal.

En el estado encontrado la tarea estaba blocked, con política de aprobación conservada pero executionState vacío. Se restauró la revisión pendiente (sin aprobación), y luego se registró el pedido original mediante el mecanismo formal, por instrucción explícita de la usuaria. Decisión: 1114b3b6-d9fa-4d37-a936-f46be9f191b2. El comentario original no se editó ni eliminó.

El fallo de process había dejado dos registros no-replay del mismo run. Retry y resume no bastaron; la API pública recovery-actions/resolve permitió registrar evidencia del proceso terminado, los archivos locales ya escritos y la publicación no realizada. Paperclip verificó la propiedad del proceso antes de aceptar la reconciliación. No se cambió la base directamente, el código instalado de Paperclip, ni la política de aprobación.

## Correcciones

- Actualizaciones optimistas con baseRevisionId: un conflicto real sigue provocando error; no se fuerza la sobrescritura.
- Lectura de comentarios humanos desde Paperclip y del borrador publicado anterior antes de redactar.
- Nuevos intentos guardados en revisions/<runId>; recibos originales conservados. Un archivo outreach-latest.json identifica el intento vigente.
- Instrucciones persistentes en agents/outreach.md, visibles por ruta en la configuración del agente y leídas efectivamente por el wrapper.
- Remitente ficticio explícito en data/sender.json: Distribuidora SaludPro Demo. MEDPULSE queda como herramienta de IA.
- El mensaje inicial no incluye cantidades inferidas ni días de inactividad; ofrece cotización y mantiene baja. Validación automática antes de publicar.

## Evidencia

En evidence/growth/1954772e-c5e0-42af-863e-c29ff2990689/review-fix/: before.json, failed-run-log.json, original-published-document.json, original-403-receipt.json, restored-review.json, formal-changes-requested.json y registros de reconciliación. La publicación original sigue en el historial de revisiones de Paperclip y sus adjuntos no se borraron.

Siete pruebas locales pasaron: cuatro del análisis y tres de feedback, control de revisión y mensaje comercial. La nueva ejecución debe terminar con succeeded y volver a in_review, sin decisión approved. La aprobación solo puede aceptarla la persona revisora; no existe transporte de envío.
