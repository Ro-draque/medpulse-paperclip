# Flujo comercial incremental

## Alcance implementado

Cuatro agentes diferenciados en la company MEDPULSE, usando el adaptador process existente y el Codex CLI autenticado. Se conservó el identificador original del Growth Director. No se cambió la instalación de Paperclip.

1. Growth Director produce el brief.
2. Sales Intelligence lee el brief desde un documento de Paperclip, ejecuta cálculos deterministas y usa Codex para interpretar oportunidades.
3. Campaign Strategist lee el informe de Sales desde Paperclip y Codex elige entre WhatsApp, Instagram o ninguno, comparando las tres alternativas.
4. Outreach Operator lee la decisión de Strategy desde Paperclip; Codex redacta y el ejecutor genera un payload WhatsApp dry-run. Si el canal elegido no es WhatsApp, registra que no corresponde preparar esa campaña.

El grafo de tareas es fijo y lo crea start-growth.mjs. El Director genera el brief, no planifica dinámicamente el grafo. Los wrappers hacen checkout, lectura/escritura de documentos, validaciones y transiciones mediante la API con token temporal de agente. Los modelos interpretan y redactan; no poseen el token de Paperclip. Las dependencias blockedByIssueIds disparan las etapas sin intervención manual. No se simula que el modelo llame directamente a herramientas de Paperclip.

## Datos y cálculo

data/distributor.json contiene 6 clientes, 4 productos y 13 compras. Todas las entidades, precios ARS, consentimientos y stock son ficticios. Fecha fija: 2026-11-08. El generador no usa azar ni reloj actual. Cada ejecución guarda su propio snapshot y hash; si cambia una entrada a mitad del flujo, el worker falla.

Recompra: mínimo dos compras por cliente/producto, intervalo igual a mediana de diferencias entre compras. Elegibilidad: días transcurridos mayores al intervalo, consentimiento comercial y stock suficiente para la cantidad de la última compra. Cross-sell: producto complementario explícito en el catálogo no comprado antes, con stock, para un cliente con recompra elegible. No se infiere propensión real de compra.

Score recompra: 40 + 30 × min(días vencidos / intervalo, 1) + 20 por stock + 10 por consentimiento. Cross-sell: 55 fijo para hipótesis. Solo se puntúan candidatos elegibles. No es probabilidad calibrada ni una estimación de ventas. El potencial bruto no representa ingresos obtenidos.

## Revisión humana

La tarea final nace con executionPolicy, etapa approval y participante user/local-board de esta instancia local. Al pedir done, Paperclip la mantiene in_review, con executionState pending y asignación humana. Un segundo intento de cierre usando la identidad del agente recibió 403. El worker comprueba ambos resultados y guarda el recibo; no hay llamada de aprobación desde los scripts.

La aprobación acepta el borrador dry-run. No existe código de envío ni credenciales Meta. El consentimiento sintético es comercial general: falta alcance específico de WhatsApp antes de un uso real. El payload no enviable reconoce que un contacto comercial fuera de la ventana de atención necesitaría una plantilla aprobada y configuración adicional.

## Ejecutar otra prueba

Con Paperclip activo, desde la raíz:

```powershell
node scripts/generate-growth-data.mjs
node --test scripts/growth-core.test.mjs
node scripts/start-growth.mjs
node scripts/check-growth.mjs
```

El último comando consulta el progreso y se puede repetir. Al llegar a revisión humana:

```powershell
node scripts/verify-growth.mjs
node scripts/register-growth-review.mjs
```

verify-growth exige revisión pendiente, cuatro ejecuciones exitosas, sesiones Codex, dependencias, autores y hashes consistentes. Si la persona ya aprobó, falla intencionalmente porque ya no está pendiente. start-growth reutiliza los cuatro agentes y crea otro batch de cuatro tareas. Ejecutar un batch por vez; los modelos pueden cambiar la redacción y la elección según evidencia. No se garantiza WhatsApp con otros datos. La lectura de historial de ejecuciones usa la primera página de API; incorporar paginación antes de una operación extensa.

El Director ahora ejecuta growth-worker en lugar del worker de smoke test. Los archivos de Etapa 2 se conservan como evidencia histórica; el comando vigente para probar la compañía es start-growth.mjs.

## Pendientes del challenge

Market Intelligence con fuente comercial externa verificable; quinto agente; decisión ambos en el alcance general; dashboard Vercel; GitHub; Research de una página; DECISIONS de media página; Loom. No se implementaron para esta etapa. Faltan instrumentación de costes por agente, pruebas de otro entorno y calibración comercial. No hay un resultado real de campaña.
