# Decisiones y resultados

Elegimos WhatsApp dry-run (B2): un caso concreto de recompra B2B con historial sintético, stock y consentimiento. Paperclip coordina cuatro agentes diferenciados mediante el adaptador process y Codex CLI. Los cálculos son deterministas; el modelo interpreta, selecciona canal y redacta. El grafo es explícito, no un plan dinámico del Director.

Funcionaron los handoffs por documentos y dependencias, el historial de revisiones y la aprobación humana obligatoria. Un adaptador local ejecutó y registró el dry-run en MED-7, vinculado a MED-6. Cero llamadas a Meta y cero mensajes enviados. El dashboard publica únicamente una exportación permitida de evidencias reales; los datos comerciales están rotulados como sintéticos.

codex_local falló por enlaces simbólicos en Windows; process fue la alternativa. La primera actualización de borrador falló con HTTP 409 por faltar baseRevisionId; se corrigieron control de revisión, lectura del feedback y versionado. Se conservó el fallo y se comprobó HTTP 403 al cierre por el agente. No hay cuenta Meta conectada ni aprobación de plantillas. La instalación inicial superó diez minutos; el tiempo de reproducción con prerrequisitos se documenta por separado.

La semana siguiente incorporaríamos Market Intelligence con fuente comercial verificable, medición de resultados y costes, y una prueba de integración en cuenta autorizada. Primero se completa la publicación GitHub/Vercel y la evidencia del challenge.
