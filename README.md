# MEDPULSE — compañía de Growth B2B con agentes

Cuatro agentes reales coordinados en **Paperclip**, con Codex CLI y adaptador `process`. El flujo cruza compras, stock y consentimiento sintéticos, elige un canal y prepara una campaña WhatsApp dry-run. Una política real bloquea el cierre hasta revisión humana.

**Ejecuciones reales; datos comerciales ficticios. Cero envíos.** El dashboard es una captura de solo lectura: no controla Paperclip ni concede aprobaciones.

## Enlaces de entrega

- GitHub: pendiente de crear/publicar el repositorio remoto.
- Vercel: configuración y build preparados; publicación pendiente de acceso a la cuenta.
- Loom: [guion de 2:20](docs/LOOM-SCRIPT.md); grabación y enlace pendientes.
- [Research, máximo una página MD](docs/RESEARCH.md) · [DECISIONS, media página](DECISIONS.md).

## Ver el dashboard sin instalar Paperclip

Requisito: Node >=24.11. No hay dependencias del dashboard.

```powershell
node scripts/build-dashboard.mjs
node scripts/preview-dashboard.mjs
```

Abrir http://127.0.0.1:4173. El build copia únicamente HTML, CSS, JS y el JSON público permitido. Ese JSON proviene de la API real; incluye IDs de tareas/ejecuciones, recibo de handoff y ciclo de revisión. No hay métricas inventadas ni conexiones del navegador al Paperclip local.

## Reproducir el flujo real en menos de diez minutos con prerrequisitos

**Medición real: 118,78 segundos**, el 8/11/2026, creando una compañía nueva MEDPULSE-Reproduction: cuatro ejecuciones Codex exitosas, revisión humana pendiente y ejecución del adaptador WhatsApp local. [Registro de tiempos e IDs](docs/reproduction.json). Es una medición de este equipo y proveedor, no una garantía universal.

Prerrequisitos: Windows, Node >=24.11, pnpm 11.25.0, Codex CLI disponible en PATH y autenticado (`codex login status`), red al proveedor, Paperclip 2026.1106.0 instalado y activo en http://127.0.0.1:3100, modo local_trusted. No pegar claves en archivos. Si Codex no está en PATH, definir MEDPULSE_CODEX_COMMAND con su ruta local antes de arrancar.

```powershell
node --test scripts/growth-core.test.mjs scripts/review-support.test.mjs scripts/delivery.test.mjs
node scripts/reproduce.mjs --company=MEDPULSE-Reproduction
```

Ese comando crea compañía y roles si faltan, lanza el grafo y espera sus resultados. Al terminar, abrir Paperclip y revisar la tarea final; **no la aprueba**. El recibo queda en la tarea de handoff y vinculado a la campaña. No ejecutar dos reproducciones al mismo tiempo. El comando conserva los punteros del batch anterior; el resultado nuevo queda en delivery-local/reproduction.json y en Paperclip.

La medición incluye bootstrap, análisis, generación y handoff. **Excluye descarga/instalación de Paperclip, login de Codex, tiempo de revisión humana y publicación remota.** La instalación inicial observada superó diez minutos. No se declara validado un arranque completamente frío en diez minutos.

## Instalar Paperclip por primera vez

```powershell
./scripts/install-paperclip.ps1
./scripts/paperclip.ps1 onboard
```

La descarga es grande y necesita internet. Onboard crea la base local e inicia el servidor; mantener la terminal abierta. Después ejecutar la reproducción en otra terminal. Para arrancar una instalación existente:

```powershell
./scripts/paperclip.ps1 run
```

Los datos y secretos de Paperclip se guardan bajo .runtime/, excluida de Git. La instalación usa un lockfile y permite scripts de preparación solo a Paperclip y PostgreSQL.

## Ejecución incremental y actualización de evidencia

```powershell
node scripts/generate-growth-data.mjs
node scripts/start-growth.mjs
node scripts/check-growth.mjs
```

start-growth conserva el Growth Director existente y crea los agentes faltantes. Las dependencias activan Sales → Strategy → Outreach automáticamente. Repetir check-growth hasta que la campaña quede in_review. Luego:

```powershell
node scripts/verify-growth.mjs
node scripts/register-growth-review.mjs
node scripts/start-handoff.mjs
```

Esperar que la tarea de handoff termine en Paperclip. Después:

```powershell
node scripts/link-handoff.mjs
node scripts/export-dashboard.mjs
node scripts/build-dashboard.mjs
```

La exportación lee el estado actual; puede reflejar una aprobación humana posterior. Conserva por separado la captura histórica pendiente. Si la campaña cambia después del handoff, la exportación rechaza el hash antiguo: ejecutar un nuevo handoff. El exportador del historial consulta la página inicial de ejecuciones; antes de un uso extenso debe agregarse paginación.

## Revisión humana y límites

En revisión, solicitar cambios requiere transición a in_progress **con comentario en la misma operación**; Paperclip registra changes_requested y devuelve la tarea al agente. El wrapper lee los comentarios, actualiza con baseRevisionId y guarda cada intento por separado. Al reenviar, vuelve a la misma aprobación humana. [Diagnóstico del ciclo real](docs/REVIEW-INCIDENT.md).

El adaptador local valida correspondencia entre borrador y payload, destinatario ficticio, stock y consentimiento; registra recibo con taskId/runId/revisión/hashes. No contacta a Meta. El payload no es enviable ni una plantilla aprobada. El consentimiento comercial sintético no acredita alcance de WhatsApp. [Arquitectura y reglas](docs/GROWTH-FLOW.md).

## GitHub y Vercel

```powershell
node scripts/audit-release.mjs
node scripts/build-dashboard.mjs
```

Publicar solo los archivos de release-files.json. Quedan fuera la base, credenciales, sesiones, logs brutos y evidencia local privada; dashboard/data/paperclip.json es una exportación permitida por lista de campos. El escaneo no sustituye una revisión humana de lo que se comparte.

En Vercel: importar el repositorio, usar raíz del proyecto y framework **Other**. vercel.json define buildCommand y outputDirectory=dist/dashboard. No instalar Paperclip en Vercel ni configurar claves del proveedor. El dashboard funciona con la evidencia exportada incluida. La actualización requiere exportar y desplegar una nueva versión.

Pendientes para completar la entrega del challenge: repositorio remoto, URL Vercel y Loom. Market Intelligence y fuentes externas se incorporan después; no hay tendencias externas ficticias ni resultados de ventas simulados como reales.
