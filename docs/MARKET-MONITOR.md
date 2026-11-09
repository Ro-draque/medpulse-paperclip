# Monitoreo periódico de compras públicas

La rutina **MEDPULSE · Monitoreo de compras públicas** usa el agente Market Intelligence Analyst. Cada consulta genera una tarea de auditoría con un documento `result` en Paperclip. Los resultados se comparan con el historial local y actualizan el panel. La rutina no crea tareas adicionales de análisis, no usa el modelo y no tiene acceso a los adaptadores de Meta.

## Fuentes y cobertura

| Fuente | Identidad y método | Cobertura |
|---|---|---|
| [Compras de Tierra del Fuego](https://compras.tierradelfuego.gob.ar/) | Portal provincial. GET de la búsqueda pública, seguido de la publicación encontrada en el mismo dominio oficial. | Hasta dos avisos por familia del catálogo. |
| [Boletín Oficial de Santa Fe](https://www.santafe.gob.ar/boletinoficial/) | Publicación de la provincia respaldada por su [portal institucional de transparencia](https://www.santafe.gob.ar/index.php/web/content/view/full/236974/%28subtema%29/236970). GET del índice, su sección Licitaciones y días anteriores. | Última edición del índice y tres días calendario anteriores. Puede contener avisos provinciales y municipales. |

Las URLs de avisos se descubren en cada consulta. Se guardan los filtros, términos y equivalencias por producto. El catálogo de prueba incluye guantes, gasas, jeringas y barbijos. El monitoreo busca coincidencias, no equivalencia técnica. Una consulta satisfactoria con cero coincidencias se diferencia de una fuente parcial o no disponible.

El importador consulta robots.txt, usa acceso público sin cuenta y limita solicitudes, tiempo, tamaño de respuesta y PDFs. Cada redirección y su destino deben permanecer en el origen HTTPS configurado. Un enlace a otro dominio puede quedar como referencia documental sin verificarse. Se conservan URL solicitada y final, fecha de consulta y hash de los bytes. Se descarga un máximo de dos PDFs por fuente y consulta. La descarga confirma que se obtuvo un PDF, sin validar sus firmas ni sus renglones. No hay corroboración independiente.

## Historial y decisiones

El historial vive en `evidence/market-monitor/history.json`. Guarda la primera y última observación, versiones y recibos por tarea. Los HTML y PDFs se archivan por SHA-256 en `evidence/market-monitor/files/`. La identidad combina fuente y expediente. Cuando falta el expediente usa organismo, modalidad y número si se pueden extraer. El último recurso es el identificador del aviso. No se unifican expedientes de fuentes distintas sin evidencia.

La clasificación distingue antecedentes vencidos, adjudicaciones, cancelaciones, plazo publicado pendiente de confirmación y estado sin verificar. Un plazo futuro publicado requiere consultar el estado del expediente y sus posibles prórrogas. La coincidencia comercial habilita investigación, con controles separados de procedencia y vigencia. El sistema no propone contacto ni inversión automáticamente.

## Prueba y operación

En esta instalación, la primera consulta quedó en MED-11 y registró 7 expedientes, 1 actualización y 1 rectificación identificada. MED-12 encontró los mismos 8 avisos y registró 0 nuevos, 0 actualizaciones y 8 duplicados. Santa Fe respondió correctamente en ambas, sin coincidencias en la ventana consultada. La prueba unitaria controlada cambia el plazo de un expediente y comprueba que queda una versión adicional y que una repetición no la duplica.

El disparo automático de prueba generó MED-13 y volvió a registrar ocho avisos repetidos sin cambios. Después se aplicó el horario normal en el mismo disparador de Paperclip.

```powershell
node --test scripts/market-monitor.test.mjs
node scripts/manage-market-monitor.mjs status
node scripts/manage-market-monitor.mjs run una-clave-nueva
node scripts/manage-market-monitor.mjs schedule
node scripts/build-dashboard.mjs
```

La programación normal es de lunes a viernes a las 09:00 de Argentina. Requiere el Paperclip local en ejecución con la computadora disponible y acceso a Internet. Paperclip omite ejecuciones perdidas y evita superposiciones. El historial utiliza un bloqueo de escritura y un recibo por tarea. Si un cierre forzado deja el bloqueo, comprobar primero en Paperclip que el proceso terminó antes de retirar `evidence/market-monitor/scan.lock`.

El dashboard local lee el resultado más reciente al cargar. Si el directorio de vista previa ya existe, la rutina actualiza su copia también. Para un sitio estático remoto se necesita publicar la nueva captura por separado.
