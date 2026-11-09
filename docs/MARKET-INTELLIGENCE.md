# Demo 02 · Market Intelligence

La [captura pública](../dashboard/data/market.json) proviene de Paperclip. La demo original de WhatsApp conserva MED-6 y MED-7 por separado.

| Tarea | Entrega | Ejecución exitosa | Duración |
|---|---|---|---:|
| MED-8 · Market Intelligence Analyst | Informe y cuatro HTML oficiales adjuntos | `bddcc4d3-7818-4f81-81de-4aa36e1a10e6` | 37,12 s |
| MED-9 · Sales Intelligence | Recibe MED-8; compara compra interna y señales oficiales | `6fd09227-212c-4c52-b416-e5758d83c492` | 35,48 s |
| MED-10 · Campaign Strategist | Recibe MED-8 y MED-9; selecciona canal y documenta alternativas | `0c21971a-39aa-41f6-9ebf-80c76d5be21f` | 35,90 s |

Descarga: 15,95 s. Ejecución activa exitosa: 108,50 s en total. La recuperación de MED-9 y el traspaso hasta finalizar MED-10 ocuparon 71,84 s desde el inicio del reintento. Son tiempos medidos del batch recuperado, no una medición de arranque en frío; el tiempo de pared original incluye la pausa entre sesiones.

El intento `dbc46522-657d-4997-8eb3-93413c32dfe5` devolvió HTTP 500 en `POST /api/issues/{id}/checkout` antes de abrir Codex o escribir el resultado. Paperclip ya había activado y reclamado la tarea al completarse la dependencia. El worker ahora lee la tarea y evita repetir checkout si **su propio run** posee la asignación y no hay otro dueño. La causa interna del 500 no se ve en el log del adaptador. El workaround se verificó recuperando el intento con la API de reconciliación y reintentando MED-9 sobre la misma tarea. Los logs y recibos se guardan en `evidence/market/<batch>/recovery/`, excluidos del repositorio. No se reejecutó MED-8 ni se modificó MED-6.

## Procedencia y alcance

[Portal de Compras de Tierra del Fuego](https://compras.tierradelfuego.gob.ar/). La API WordPress respondió 404; la importación automática usó las páginas oficiales de búsqueda y descargó los primeros dos avisos por término: nitrilo y gasas. Se guardan bytes, URL, fecha UTC, código HTTP y SHA-256. MED-8 adjuntó las cuatro fichas oficiales; MED-9 extrajo el plazo de los mismos archivos sin sobrescribir el informe original. No se procesaron los pliegos técnicos adjuntos.

| Aviso | Publicación | Estado observado en la demo |
|---|---|---|
| [TDF-280370 · nitrilo, HRU](https://compras.tierradelfuego.gob.ar/?p=280370) | 21/07/2026 | Fecha límite publicada: 24/07/2026 12:00 |
| [TDF-270677 · nitrilo, laboratorio público](https://compras.tierradelfuego.gob.ar/?p=270677) | 20/04/2026 | Fecha límite publicada: 23/04/2026 09:59 |
| [TDF-289532 · gasas de quirófano, HRU](https://compras.tierradelfuego.gob.ar/?p=289532) | 06/10/2026 | Fecha límite publicada: 09/10/2026 12:00 |
| [TDF-274729 · gasas tubulares, HRU](https://compras.tierradelfuego.gob.ar/?p=274729) | 28/05/2026 | Rectificación de preadjudicación histórica |

Los avisos son reales. Los compradores del CRM, compras, precios, stock y consentimiento de la distribuidora son ficticios. Un aviso no es una demanda confirmada de un cliente ni demuestra una tendencia. La vinculación externa es por familia de producto; verificar pliego, presentación, disponibilidad real y entrega antes de ofertar. La integración no determina si un nuevo llamado está vigente.

## Qué recomienda

- **Guantes de nitrilo P01 · 90/100:** recompra sintética para C01. WhatsApp individual, previa revisión humana; Instagram no agrega evidencia de audiencia. **Gasas P02 · 80/100:** hipótesis de venta cruzada. Jeringas P03 quedan fuera por stock cero.
- **Gasas de quirófano, Ushuaia · 75/100:** antecedente oficial para investigar esterilización hospitalaria, especificaciones y logística. Canal inmediato: ninguno. Si se verifica compatibilidad y suministro, proponer contenido técnico y cotización a contactos B2B que hayan dado consentimiento. Un futuro llamado abierto se evalúa por el canal de compras oficial.
- El índice suma evidencia (35), encaje de producto (25), actualidad (15), stock (15) y posibilidad de actuar (10). El dashboard muestra cada componente. **No es una probabilidad**. El índice de la demo original tiene otra fórmula y se conserva en su sección histórica.

## Repetir sin tocar la campaña existente

Con Paperclip iniciado y los cuatro agentes base ya configurados, usar desde la raíz:

```powershell
node scripts/import-market-source.mjs
node scripts/start-market.mjs
node scripts/verify-market.mjs --wait
node scripts/export-market.mjs
node scripts/build-dashboard.mjs
```

La importación actual puede devolver avisos distintos. Para reproducir los mismos bytes o si el portal falla, usar `node scripts/import-market-source.mjs --from="evidence/market-source/<batch>/manifest.json"` con los HTML originales en la misma carpeta. Se comprueban sus hashes. Es evidencia fechada, no una nueva consulta. Las tareas nuevas se activan por dependencias sin una secuencia manual; no ejecutar dos demos concurrentes. Si hay bloqueo, conservar el registro e inspeccionar antes de reintentar. `recover-market.mjs` solo recupera el caso observado: Sales bloqueado tras checkout 500 y sin resultado previo.
