# Campañas sugeridas de Instagram

El flujo de Instagram se inicia por separado desde la raíz del proyecto, con Paperclip local en ejecución y PowerShell 7 disponible.

```powershell
node scripts/run-instagram.mjs
node scripts/build-dashboard.mjs
node scripts/preview-dashboard.mjs
```

Market Intelligence descubre la edición más reciente en el índice anual de Argentina.gob.ar. Conserva el índice, el PDF de la edición y el resumen ministerial de la misma semana. Valida el dominio HTTPS, la correspondencia de semana y año y la cabecera de formato del archivo PDF. El flujo usa el resumen oficial para la interpretación y conserva el PDF original como evidencia. Si una fuente falta o cambia de formato, la investigación se detiene. El primer caso usa BEN 832, semana 42. [Índice de boletines](https://www.argentina.gob.ar/salud/boletin-epidemiologico-nacional/boletines-2026) · [Resumen del 4 de noviembre de 2026](https://www.argentina.gob.ar/noticias/actualizacion-del-boletin-epidemiologico-nacional-de-la-semana-ndeg-42)

Campaign Strategist recibe el informe mediante una dependencia real. La primera política editorial reconoce el descenso respiratorio posinvernal como contexto para revisar la reposición de barbijos tricapa P04. El hallazgo carece de evidencia de demanda. Se comprueba el stock sintético y se utiliza copy editorial acotado con CTA de cotización. La pieza JPEG es una ilustración propia, identificada como propuesta de revisión de una distribuidora ficticia. Otros contextos requieren una decisión editorial antes de generar otra propuesta.

La campaña se deduplica por tema, SKU, público y canal, con bloqueo local durante la consulta. Una edición posterior puede producir una investigación nueva sin abrir otra campaña con el mismo enfoque. El flujo verifica la dependencia y los hashes antes de exportar el JPEG y el borrador al dashboard. La vista es una captura. El resultado en Paperclip conserva el control de aprobación humana y la integración Meta queda fuera del recorrido.

| Paperclip | Evidencia |
|---|---|
| MED-14 | Investigación oficial y archivos adjuntos. |
| MED-15 | Propuesta y JPEG 1080 × 1350. Revisión humana pendiente. |
| MED-16 | Reconsulta que reutilizó MED-15 y su imagen. |

## Consulta recurrente

La rutina **MEDPULSE · Tendencias sanitarias para Instagram** corre los lunes, miércoles y viernes a las 09:30 en America/Argentina/Buenos_Aires. Usa el programador de Paperclip local y necesita que Paperclip siga en ejecución. Omite los horarios perdidos y las consultas superpuestas. El flujo a demanda original sigue disponible para reproducir el primer caso.

El escáner descubre el último BEN en el índice anual, el recurso de botiquín desde el índice de primeros auxilios y la primera noticia del índice de Salud. Todos son del Ministerio de Salud de la Nación. Rechaza destinos fuera del dominio HTTPS permitido, incluso durante redirecciones. Guarda URL original y final, emisor, fecha de publicación cuando está disponible, fecha de consulta y SHA-256 de cada archivo. El historial compara el PDF del BEN, el contenido principal de la noticia y los fragmentos pertinentes de la guía. Los HTML completos pueden variar por elementos del sitio ajenos a la publicación. [Índice de boletines](https://www.argentina.gob.ar/salud/boletin-epidemiologico-nacional) · [Primeros auxilios](https://www.argentina.gob.ar/salud/primerosauxilios) · [Noticias de Salud](https://www.argentina.gob.ar/salud/noticias)

Una publicación nueva en el historial puede ser histórica. La observación epidemiológica o la guía se registran como información sanitaria. El interés del público queda sin medir y la demanda comercial queda sin evidencia. Los enfoques aprobados para borradores cubren barbijos y reposición de gasas. Una señal relevante fuera de esos enfoques queda pendiente de evaluación. Las claves de campaña son estables por tema, SKU, público y canal. Cada observación conserva por separado la identidad y la huella de la publicación.

Los límites son 12 solicitudes por consulta, ocho segundos por solicitud, 8 MB por archivo, 150 segundos para el escáner y una campaña como máximo por consulta. El JPEG tiene un límite de 30 segundos de generación. La consulta, el análisis y el copy de los enfoques soportados usan reglas y consumen cero tokens de modelo. Si el JPEG falla, el borrador se conserva para revisión con la pieza pendiente.

Para ver la programación y sus ejecuciones, usar `node scripts/manage-instagram-routine.mjs status`. Los recibos y el historial se guardan en Paperclip y en `evidence/instagram-discovery/`. El dashboard local carga la última captura y las propuestas. El historial visible está limitado a 30 consultas. La fecha del dashboard corresponde a su última exportación.

| Prueba en Paperclip | Resultado |
|---|---|
| MED-17 · 9 de noviembre de 2026, 00:28 de Argentina · disparo programado | Noticia oficial nueva para el historial y descartada por relevancia. BEN 832 vinculado al enfoque existente. Ninguna tarea de análisis. El primer lector tomó el encabezado institucional como título de la guía. El error quedó auditado y se corrigió el lector. |
| MED-18 · 00:30 · disparo programado | Guía DINESA recién incorporada al historial. Abrió MED-19 y la propuesta dependiente MED-20, «Tu botiquín, al día», con JPEG adjunto y aprobación humana pendiente. |
| MED-21 · reconsulta manual de verificación | Tres publicaciones repetidas. Ninguna tarea de análisis nueva y una sola propuesta de botiquín. |
