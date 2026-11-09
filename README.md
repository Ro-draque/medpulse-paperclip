# MEDPULSE — compañía de Growth B2B con agentes

Cuatro agentes reales coordinados en **Paperclip**, con Codex CLI y adaptador `process`. El flujo cruza compras, stock y consentimiento sintéticos, elige un canal y prepara una campaña WhatsApp dry-run. Una política real bloquea el cierre hasta revisión humana.

**Ejecuciones reales; datos comerciales ficticios. Cero envíos.** El dashboard es una captura de solo lectura: no controla Paperclip ni concede aprobaciones.

## Enlaces de entrega

- [Repositorio de entrega en GitHub](https://github.com/Ro-draque/medpulse-paperclip).
- [Dashboard público de MEDPULSE en Vercel](https://medpulse-paperclip.vercel.app/), con capturas de solo lectura.
- Loom: [guion de 2:20](docs/LOOM-SCRIPT.md); grabación y enlace pendientes.
- [Research, máximo una página MD](docs/RESEARCH.md) · [DECISIONS, media página](DECISIONS.md).

## Recorrido de la demo

Paperclip coordina quién ejecuta cada tarea y qué resultado recibe el siguiente agente. La demo usa clientes, compras, inventario y consentimientos ficticios.

| Tarea en Paperclip | Rol | Resultado |
|---|---|---|
| MED-3 | Growth Director | Define el encargo de recompra. |
| MED-4 | Sales Intelligence | Analiza compras, stock y consentimiento. |
| MED-5 | Campaign Strategist | Elige la oportunidad y el canal. |
| MED-6 | Outreach Operator y revisión humana | Prepara y revisa el borrador de WhatsApp. |
| MED-22 | Outreach Operator | Ejecuta la prueba contra el simulador HTTP local y guarda el recibo vinculado a la revisión de MED-6. |

La [captura del flujo base](dashboard/data/paperclip.json) conserva tareas y ejecuciones. El [recibo de MED-22](dashboard/data/whatsapp-sandbox.json) registra las cuatro solicitudes, sus respuestas y el identificador simulado. El [informe PDF](dashboard/data/medpulse-informe-evidencia.pdf) resume la evidencia. MED-6 estaba en revisión cuando se hizo la prueba y recibió una aprobación humana posterior. El dashboard conserva el estado observado al exportar. Paperclip y el centro privado muestran el estado vigente.

El sandbox funciona por HTTP en la misma computadora. La prueba no contactó a Meta ni envió mensajes reales. La configuración oficial de WhatsApp Business quedó pendiente por el bloqueo al crear el portafolio empresarial de Meta.

## Ver el dashboard sin instalar Paperclip

Requisito: Node >=24.11. No hay dependencias del dashboard.

```powershell
node scripts/build-dashboard.mjs
node scripts/preview-dashboard.mjs
```

Abrí http://127.0.0.1:4173. El build incluye el sitio estático y las capturas públicas permitidas en JSON, JPEG y PDF. El dashboard muestra evidencia exportada de Paperclip con su fecha de corte. Los resultados y las decisiones vigentes se consultan en Paperclip o en el centro privado.

**Segunda demo:** compara recompra y venta cruzada sintéticas con cuatro avisos reales del portal de Compras de Tierra del Fuego. El dashboard muestra fecha, fuente, puntaje desglosado, certeza y recomendación por oportunidad. [Ejecuciones, procedencia, recuperación del HTTP 500 y reproducción](docs/MARKET-INTELLIGENCE.md).

El monitoreo de compras públicas consulta Tierra del Fuego y Santa Fe, conserva versiones por expediente y actualiza el panel local. [Fuentes, horario, límites y reproducción](docs/MARKET-MONITOR.md).

«Campañas sugeridas» incluye dos propuestas de Instagram con imagen, texto, contexto sanitario y revisión humana. [Flujo y reproducción de las campañas](docs/INSTAGRAM-CAMPAIGN.md)

## Reproducir el flujo real en menos de diez minutos con prerrequisitos

**Nueva medición: 108,82 segundos (1 min 48,82 s)** el 9/11/2026. En una compañía nueva de Paperclip terminaron cuatro ejecuciones de Codex. El borrador MEDAA-4 quedó en revisión humana y MEDAA-5 registró el traspaso a WhatsApp en modo de prueba, con cero envíos. Se usaron los datos ficticios originales. La medición anterior fue de 118,78 segundos. [Registro nuevo](docs/reproduction-2026-11-09.json) · [Registro anterior](docs/reproduction.json)

Prerrequisitos: Windows, Node >=24.11, pnpm 11.25.0, Codex CLI disponible en PATH y autenticado (`codex login status`), red al proveedor, Paperclip 2026.1106.0 instalado y activo en http://127.0.0.1:3100, modo local_trusted. No pegar claves en archivos. Si Codex no está en PATH, definir MEDPULSE_CODEX_COMMAND con su ruta local antes de arrancar.

```powershell
node --test scripts/*.test.mjs
node scripts/reproduce.mjs --company=MEDPULSE-Reproduction
```

Ese comando crea compañía y roles si faltan, lanza el grafo y espera sus resultados. Al terminar, abrir Paperclip y revisar la tarea final; **no la aprueba**. El recibo queda en la tarea de handoff y vinculado a la campaña. No ejecutar dos reproducciones al mismo tiempo. El comando conserva los punteros del batch anterior; el resultado nuevo queda en delivery-local/reproduction.json y en Paperclip.

La medición empieza al lanzar el script e incluye crear la compañía, analizar los datos, generar el borrador y registrar el traspaso al adaptador local. Se hizo con **Paperclip instalado y activo, Codex autenticado y acceso al proveedor**. Las pruebas unitarias, la instalación, la autenticación, la revisión humana y la publicación remota se miden por separado. La instalación inicial observada superó diez minutos. El arranque desde cero en diez minutos sigue sin validarse.

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

El centro privado permite aprobar el borrador o solicitar cambios. El comentario visible es opcional. El centro envía a Paperclip una referencia de auditoría junto con la decisión. El ejecutor conserva las versiones del borrador y devuelve la tarea a revisión después de incorporar cambios. [Diagnóstico del ciclo real](docs/REVIEW-INCIDENT.md)

MED-6 estaba en revisión cuando se ejecutó MED-22. La auditoría posterior verificó su aprobación en Paperclip. La captura pública original conserva el estado que se observó al exportarla. En el centro privado, Gerencia puede consultar quién aprobó cada versión confirmada. [Centro privado](docs/APPROVALS.md)

El adaptador local valida correspondencia entre borrador y payload, destinatario ficticio, stock y consentimiento; registra recibo con taskId/runId/revisión/hashes. No contacta a Meta. El payload no es enviable ni una plantilla aprobada. El consentimiento comercial sintético no acredita alcance de WhatsApp. [Arquitectura y reglas](docs/GROWTH-FLOW.md).

## GitHub y Vercel

**Demo principal B2.** MED-22 ejecutó el adaptador de WhatsApp contra un sandbox HTTP local. En el dashboard, **Ver simulación de envío** muestra el mensaje probado y el resultado. **Ver detalles técnicos** abre las cuatro respuestas y el recibo. La revisión humana pendiente corresponde al momento de la prueba. [Reproducir el sandbox y consultar sus límites](docs/WHATSAPP-SANDBOX.md)

```powershell
node scripts/audit-release.mjs
node scripts/build-dashboard.mjs
```

Publicar solo los archivos de release-files.json. Quedan fuera la base, credenciales, sesiones, logs brutos y evidencia local privada; dashboard/data/paperclip.json es una exportación permitida por lista de campos. El escaneo no sustituye una revisión humana de lo que se comparte.

En Vercel: importar el repositorio, usar raíz del proyecto y framework **Other**. vercel.json define buildCommand y outputDirectory=dist/dashboard. No instalar Paperclip en Vercel ni configurar claves del proveedor. El dashboard funciona con la evidencia exportada incluida. La actualización requiere exportar y desplegar una nueva versión.

Para completar la entrega del desafío queda la grabación del Loom. [Pasos de publicación y comprobación](docs/DELIVERY.md)

Las pruebas reales de WhatsApp e Instagram son independientes de la entrega. Los adaptadores de prueba quedaron preparados y probados con respuestas simuladas; requieren cuenta, configuración local y autorización específica antes de contactar Meta. [Configurar pruebas oficiales](docs/META-SETUP.md).

### Revisión privada local

El [centro privado de aprobaciones](docs/APPROVALS.md) funciona únicamente en el equipo donde corre Paperclip. La versión estática de Vercel conserva la vista de auditoría de solo lectura.

### Planillas de demostración

Ingresá al centro privado como Sofía Demo y abrí **Datos de la demo**. Descargá clientes, productos y compras, editá los CSV en Excel y volvé a subir los tres juntos. Usá CSV UTF-8, mantené los encabezados y elegí una fecha de corte. Para varios productos complementarios, separá sus códigos con `|`. Solo se admiten datos ficticios.

Con Paperclip activo, `node scripts/start-growth.mjs --planilla` usa la última carga en una compañía separada, **MEDPULSE Planillas Demo**. Sus resultados se consultan en Paperclip. Guardar las planillas no ejecuta agentes. El dashboard público sigue usando la evidencia exportada de la demo principal.

La prueba aislada verificó carga y descarga de los tres CSV, persistencia después de reiniciar y rechazo de cargas inválidas sin reemplazar los datos guardados. Solo Gerencia puede cargar. Reducir el stock de 120 a 0 excluyó el producto del análisis por falta de stock. El tiempo de 108,82 segundos corresponde al flujo base con datos originales.

## Evolución futura

El [roadmap de MEDPULSE](ROADMAP.md) reúne los pasos previstos para pasar del prototipo a un producto comercial.
