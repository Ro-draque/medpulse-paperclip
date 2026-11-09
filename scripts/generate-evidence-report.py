"""Create the commercial PDF from the public dashboard snapshots."""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Table, TableStyle

DATA = Path(__file__).resolve().parents[1] / "dashboard" / "data"
TZ = timezone(timedelta(hours=-3))
INK = "#173C36"


def load(name):
    return json.loads((DATA / (name + ".json")).read_text(encoding="utf-8"))


def date(value):
    return datetime.fromisoformat(value).astimezone(TZ).strftime("%d/%m/%Y · %H:%M")


def style(name, size, leading, color=INK, bold=False, before=0, after=0):
    return ParagraphStyle(name, fontName="Helvetica-Bold" if bold else "Helvetica",
                          fontSize=size, leading=leading, textColor=color,
                          spaceBefore=before, spaceAfter=after)


styles = {
    "title": style("title", 28, 32, bold=True, after=12),
    "kicker": style("kicker", 9, 12, "#237661", True, after=10),
    "section": style("section", 14, 18, bold=True, before=12, after=6),
    "body": style("body", 10.5, 15, after=7),
    "small": style("small", 9, 13, "#50655F", after=6),
    "cell": style("cell", 9.5, 13),
    "header": style("header", 9.5, 13, "#FFFFFF", True),
}
story = []


def p(text, kind="body"):
    return Paragraph(escape(str(text)), styles[kind])


def section(title, text=None):
    story.append(p(title, "section"))
    if text:
        story.append(p(text))


def grid(headers, rows, widths):
    cells = [[p(x, "header") for x in headers]]
    cells.extend([p(x, "cell") for x in row] for row in rows)
    table = Table(cells, colWidths=widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(INK)),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#EFF6F2"), colors.white]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(table)


def footer(canvas, doc):
    width, height = A4
    canvas.setFillColor(colors.HexColor(INK))
    canvas.rect(0, height - 12, width, 12, stroke=0, fill=1)
    canvas.setStrokeColor(colors.HexColor("#D4E4DB"))
    canvas.line(48, 50, width - 48, 50)
    canvas.setFont("Helvetica", 8.5)
    canvas.drawString(48, 34, "MEDPULSE   /   Evidencia comercial   /   Horario de Argentina")
    canvas.drawRightString(width - 48, 34, f"{doc.page:02d}")


base, market, monitor, discovery, wa = map(load, [
    "paperclip", "market", "market-monitor", "instagram-discovery", "whatsapp-sandbox"
])
instagram = [load("instagram")] + [
    load("instagram-" + c["campaignKey"][:12]) for c in discovery["campaigns"]
]
cuts = [("Flujo original", base["exportedAt"]), ("Inteligencia comercial", market["exportedAt"]),
        ("Compras públicas", monitor["observedAt"]), ("Consulta sanitaria", discovery["latest"]["observedAt"]),
        ("Recibo HTTP verificado", wa["verifiedAt"])]
cuts += [(c["identifier"], c["exportedAt"]) for c in instagram]
latest = max(value for _, value in cuts)
story.extend([p("MEDPULSE  /  INFORME DE EVIDENCIA", "kicker"),
              p("Investigación y oportunidades", "title"),
              p(f"Generado {date(datetime.now(TZ).isoformat())}  |  Corte máximo {date(latest)}", "small"),
              p("Captura estática de exportaciones de Paperclip. Las fuentes oficiales y las ejecuciones son reales. El catálogo, el stock y los clientes de la demo son sintéticos.")])
section("Compras públicas", f"{monitor['identifier']} registró la consulta del {date(monitor['observedAt'])}. "
        + " ".join(f"{s['name']} registró {s['matches']} coincidencias." for s in monitor["sources"])
        + f" Hubo {monitor['counts']['new']} expedientes nuevos y {monitor['counts']['duplicates']} avisos repetidos.")
section("Investigación sanitaria", f"{discovery['latest']['identifier']} registró {len(discovery['latest']['publications'])} publicaciones en la consulta del "
        f"{date(discovery['latest']['observedAt'])}. El boletín respiratorio y la guía de botiquines aportan contexto editorial. El interés del público está sin medir y no hay evidencia de demanda comercial.")
section("Oportunidades priorizadas")
rows = []
for item in market["opportunities"][:3]:
    note = ("Antecedente oficial vencido. Investigar especificaciones." if item["origin"] == "external"
            else "Recompra simulada. WhatsApp propuesto." if item["type"] == "reorder"
            else "Hipótesis de venta cruzada con datos sintéticos.")
    rows.append((item["product"]["name"], f"{item['score']['total']}/100", note))
grid(("Producto", "Puntaje", "Lectura comercial"), rows, (177, 61, 249))
section("Cómo leer el puntaje", "MED-8, MED-9 y MED-10 registran el análisis y el traspaso. El puntaje suma criterios de prioridad y no estima probabilidad de compra. La muestra oficial es parcial. La coincidencia por familia requiere verificar el pliego y la compatibilidad técnica.")

story.extend([PageBreak(), p("MEDPULSE  /  INFORME DE EVIDENCIA", "kicker"), p("Campañas e integración", "title")])
section("Campañas y revisión humana")
source = next(t for t in base["tasks"] if t["stage"] == "outreach")
def status(value):
    return {"in_review": "Pendiente de aprobación humana", "done": "Completada"}.get(value, value)

rows = [(source["identifier"], "WhatsApp · " + base["campaign"]["product"], status(source["status"]))]
rows.extend((f"{c['sourceTask']} → {c['identifier']}", f"Instagram · {c['headline']}", status(c["review"]["status"])) for c in instagram)
grid(("Paperclip", "Propuesta", "Estado en la captura"), rows, (111, 211, 165))
section("Sandbox HTTP local de WhatsApp",
        f"{wa['sourceIdentifier']} → {wa['taskIdentifier']}. El adaptador ejecutó "
        f"{wa['transport']['localHttpRequests']} solicitudes a 127.0.0.1. "
        f"Estados HTTP: {', '.join(str(c['response']['status']) for c in wa['http']['cases'])}. "
        f"La repetición conservó el ID simulado. Se registró {wa['http']['newSimulatedEffects']} efecto local nuevo, "
        f"{wa['transport']['networkRequestsToMeta']} llamadas a Meta y {wa['transport']['messagesSent']} mensajes enviados.")
story.append(p(f"Run {wa['paperclipRunId']} · revisión {wa['sourceDocumentRevisionId']}", "small"))
section("Límites de la evidencia", "MED-7 acredita validación local del borrador. MED-22 acredita intercambio HTTP con un simulador. Las piezas de Instagram son propuestas para revisión. Las capturas no acreditan entrega, publicación ni una decisión humana posterior.")
section("Cortes de las capturas")
for start in range(0, len(cuts), 2):
    story.append(p("   |   ".join(f"{label}: {date(value)}" for label, value in cuts[start:start + 2]), "small"))
story.append(p("Los JSON originales están disponibles en el dashboard bajo «Descargar evidencia técnica (.json)».", "small"))

doc = SimpleDocTemplate(str(DATA / "medpulse-informe-evidencia.pdf"), pagesize=A4,
                        leftMargin=48, rightMargin=48, topMargin=55, bottomMargin=66,
                        title="MEDPULSE | Informe de evidencia", author="MEDPULSE")
doc.build(story, onFirstPage=footer, onLaterPages=footer)
