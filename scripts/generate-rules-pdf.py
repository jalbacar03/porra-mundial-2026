#!/usr/bin/env python3
"""
Generate Porra Mundial 26 rules PDF with brand look & feel.

Output: public/docs/normas-porra-mundial-2026.pdf

The rules content must match src/pages/Rules.jsx (single source of truth).
Re-run after any change to scoring or rules.
"""

from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
    Table, TableStyle, PageBreak, KeepTogether, FrameBreak
)
from reportlab.pdfgen.canvas import Canvas


# ─── Brand palette (matches src/App.css) ────────────────────────────────
DARK = HexColor("#1a1d26")
DARK_SOFT = HexColor("#22252f")
GOLD = HexColor("#ffcc00")
GREEN = HexColor("#007a45")
GREEN_LIGHT = HexColor("#4ade80")
RED_SOFT = HexColor("#ff8a8a")
INK = HexColor("#1f2330")
MUTED = HexColor("#6b7280")
DIM = HexColor("#9aa1ad")
LINE = HexColor("#e4e6eb")
BG_PANEL = HexColor("#f7f8fa")
BG_HIGHLIGHT = HexColor("#fff8db")
BG_GREEN_SOFT = HexColor("#e6f4ec")


# ─── Page layout ────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4
MARGIN_X = 18 * mm
MARGIN_TOP = 38 * mm     # leaves room for the dark header
MARGIN_BOTTOM = 18 * mm


# ─── Header / footer ────────────────────────────────────────────────────
def draw_header_and_footer(canvas: Canvas, doc):
    canvas.saveState()
    # Dark header bar
    canvas.setFillColor(DARK)
    canvas.rect(0, PAGE_H - 22 * mm, PAGE_W, 22 * mm, fill=1, stroke=0)

    # Logo "PORRA MUNDIAL 26"
    canvas.setFillColor(white)
    canvas.setFont("Helvetica-Bold", 13)
    canvas.drawString(MARGIN_X, PAGE_H - 13.5 * mm, "PORRA MUNDIAL ")
    canvas.setFillColor(GOLD)
    txt_w = canvas.stringWidth("PORRA MUNDIAL ", "Helvetica-Bold", 13)
    canvas.drawString(MARGIN_X + txt_w, PAGE_H - 13.5 * mm, "26")

    # Subtitle on the right
    canvas.setFillColor(HexColor("#cfd3dc"))
    canvas.setFont("Helvetica", 9)
    canvas.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 13.5 * mm, "Normas oficiales del torneo")

    # Thin gold accent line under header
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(0.6)
    canvas.line(MARGIN_X, PAGE_H - 22.4 * mm, PAGE_W - MARGIN_X, PAGE_H - 22.4 * mm)

    # Footer
    canvas.setFillColor(DIM)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(MARGIN_X, 10 * mm, "porra-mundial-2026-omega.vercel.app")
    canvas.drawRightString(PAGE_W - MARGIN_X, 10 * mm, f"Pág. {doc.page}")
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    canvas.line(MARGIN_X, 14 * mm, PAGE_W - MARGIN_X, 14 * mm)

    canvas.restoreState()


# ─── Styles ─────────────────────────────────────────────────────────────
base_styles = getSampleStyleSheet()

S_H1 = ParagraphStyle(
    "H1", parent=base_styles["Heading1"],
    fontName="Helvetica-Bold", fontSize=16, textColor=DARK,
    spaceBefore=8, spaceAfter=4, leading=20
)
S_H2 = ParagraphStyle(
    "H2", parent=base_styles["Heading2"],
    fontName="Helvetica-Bold", fontSize=12, textColor=DARK,
    spaceBefore=10, spaceAfter=3, leading=15
)
S_PHASE = ParagraphStyle(
    "Phase", parent=base_styles["Heading2"],
    fontName="Helvetica-Bold", fontSize=10, textColor=DARK,
    alignment=TA_CENTER, spaceBefore=8, spaceAfter=4, leading=12,
    letterSpace=2,
)
S_P = ParagraphStyle(
    "P", parent=base_styles["BodyText"],
    fontName="Helvetica", fontSize=9.5, textColor=INK,
    leading=14, spaceBefore=0, spaceAfter=4
)
S_SMALL = ParagraphStyle(
    "Small", parent=base_styles["BodyText"],
    fontName="Helvetica", fontSize=8.5, textColor=MUTED,
    leading=12, spaceBefore=0, spaceAfter=2
)
S_BULLET = ParagraphStyle(
    "Bullet", parent=S_P, leftIndent=12, bulletIndent=2
)
S_CAPTION = ParagraphStyle(
    "Caption", parent=S_P, fontSize=8.5, textColor=DIM,
    leading=11, alignment=TA_CENTER, spaceBefore=2, spaceAfter=2
)
S_LEAD = ParagraphStyle(
    "Lead", parent=S_P, fontSize=10, leading=15
)
S_PILL_LABEL = ParagraphStyle(
    "PillLabel", parent=S_SMALL, fontName="Helvetica-Bold",
    textColor=DARK, alignment=TA_LEFT, spaceBefore=0, spaceAfter=0
)


# ─── Helpers ────────────────────────────────────────────────────────────
def phase_divider(label: str, subtitle: str, accent: HexColor):
    """Pill-style divider matching the in-app PhaseDivider."""
    tbl = Table(
        [[Paragraph(
            f'<font color="{accent.hexval()}"><b>{label}</b></font><br/>'
            f'<font color="{DIM.hexval()}" size="8">{subtitle}</font>',
            ParagraphStyle("phase_inner", fontName="Helvetica", fontSize=10,
                           textColor=accent, alignment=TA_CENTER, leading=12)
        )]],
        colWidths=[PAGE_W - 2 * MARGIN_X]
    )
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#fafbfc")),
        ("BOX", (0, 0), (-1, -1), 0.6, accent),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return tbl


def section_header(num: str, title: str, badge: str | None = None):
    """
    `num` is a short marker shown in a dark pill before the title — typically
    the section number ("1", "2", "3", "4") or a 1-letter glyph. Emojis are
    avoided on purpose because Helvetica (the built-in font) renders missing
    glyphs as filled squares.
    """
    num_html = (
        f'<font face="Helvetica-Bold" color="{white.hexval()}" backColor="{DARK.hexval()}">'
        f'&nbsp;{num}&nbsp;</font>'
    )
    cells = [[Paragraph(f"{num_html} &nbsp;<b>{title}</b>", S_H2)]]
    widths = [PAGE_W - 2 * MARGIN_X]
    if badge:
        cells = [[
            Paragraph(f"{num_html} &nbsp;<b>{title}</b>", S_H2),
            Paragraph(
                f'<font color="{DIM.hexval()}" size="8">{badge.upper()}</font>',
                ParagraphStyle("badge", parent=S_SMALL, alignment=TA_RIGHT,
                               fontSize=8, letterSpace=1)
            )
        ]]
        widths = [PAGE_W - 2 * MARGIN_X - 100, 100]
    t = Table(cells, colWidths=widths)
    t.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    return t


def info_box(text: str, accent: HexColor = GOLD, bg: HexColor = BG_HIGHLIGHT):
    p = Paragraph(text, ParagraphStyle(
        "infobox", parent=S_P, fontSize=9, leading=13, textColor=INK,
        leftIndent=6, rightIndent=6
    ))
    t = Table([[p]], colWidths=[PAGE_W - 2 * MARGIN_X])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LINEBEFORE", (0, 0), (0, -1), 2.5, accent),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


def scoring_row(label: str, value: str, value_color: HexColor = GREEN):
    p_label = Paragraph(label, S_P)
    p_val = Paragraph(
        f'<font color="{value_color.hexval()}"><b>{value}</b></font>',
        ParagraphStyle("v", parent=S_P, alignment=TA_RIGHT)
    )
    return [p_label, p_val]


def scoring_table(rows):
    data = [scoring_row(*r) for r in rows]
    col_w = [(PAGE_W - 2 * MARGIN_X) * 0.65, (PAGE_W - 2 * MARGIN_X) * 0.35]
    t = Table(data, colWidths=col_w)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BG_PANEL),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [BG_PANEL, white]),
        ("BOX", (0, 0), (-1, -1), 0.3, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return t


def bets_block_table(title: str, rows):
    """A single block of pre-tournament bets (Jugadores / Selecciones / SíNo)."""
    title_cell = [[Paragraph(
        f'<font color="{DARK.hexval()}"><b>{title.upper()}</b></font>',
        ParagraphStyle("blockTitle", parent=S_SMALL, fontSize=8.5,
                       letterSpace=1.4, textColor=DARK)
    )]]
    title_t = Table(title_cell, colWidths=[PAGE_W - 2 * MARGIN_X])
    title_t.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    return [title_t, scoring_table(rows)]


def gold_text(s: str) -> str:
    return f'<font color="{GOLD.hexval()}"><b>{s}</b></font>'


def green_text(s: str) -> str:
    return f'<font color="{GREEN.hexval()}"><b>{s}</b></font>'


def red_text(s: str) -> str:
    return f'<font color="{HexColor("#c2362b").hexval()}"><b>{s}</b></font>'


# ─── Build the document ─────────────────────────────────────────────────
def build():
    out_path = Path(__file__).resolve().parents[1] / "public" / "docs" / "normas-porra-mundial-2026.pdf"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    doc = BaseDocTemplate(
        str(out_path),
        pagesize=A4,
        leftMargin=MARGIN_X, rightMargin=MARGIN_X,
        topMargin=MARGIN_TOP, bottomMargin=MARGIN_BOTTOM,
        title="Normas — Porra Mundial 26",
        author="Porra Mundial 26",
        subject="Reglas oficiales del torneo de predicciones",
    )
    frame = Frame(
        doc.leftMargin, doc.bottomMargin,
        doc.width, doc.height, id="main",
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
    )
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame],
                                       onPage=draw_header_and_footer)])

    story = []

    # ── INTRO ──────────────────────────────────────────────────────────
    story.append(Paragraph("Normas del torneo", S_H1))
    story.append(Paragraph(
        "Todo lo que necesitas saber para participar en la Porra Mundial 26.",
        S_LEAD
    ))
    story.append(Spacer(1, 8))

    story.append(info_box(
        "<b>¿Qué es la Porra Mundial 26?</b><br/>"
        "Una porra amistosa de predicciones entre amigos para el Mundial 2026. "
        "El que más puntos acumule al final del torneo, gana.",
        accent=GREEN, bg=BG_GREEN_SOFT
    ))
    story.append(Spacer(1, 10))

    # ── RESUMEN ────────────────────────────────────────────────────────
    story.append(Paragraph("Resumen rápido — ¿Cómo se puntúa?", S_H2))
    summary_rows = [
        ["1. Fase de grupos", "72 partidos", "Exacto +3 · Signo +1 · Fallo 0", "ANTES"],
        ["2. Cuadro ciego", "Quién avanza cada ronda", "Hasta +20 pts (cadena campeón)", "ANTES"],
        ["3. Predicciones especiales", "14 apuestas en 3 bloques", "Hasta +29 pts", "ANTES"],
        ["4. Cuadro real", "31 partidos eliminatorias", "Exacto +3 · Signo +1 · Fallo 0", "DURANTE"],
    ]
    data = [[
        Paragraph(f"<b>{r[0]}</b><br/>"
                  f'<font color="{DIM.hexval()}" size="8">{r[1]}</font>', S_P),
        Paragraph(f'<font color="{GREEN.hexval()}"><b>{r[2]}</b></font>',
                  ParagraphStyle("c", parent=S_P, fontSize=8.5, alignment=TA_RIGHT)),
        Paragraph(
            f'<font color="{GOLD.hexval() if r[3]=="DURANTE" else HexColor("#c2362b").hexval()}" size="7"><b>{r[3]}</b></font>',
            ParagraphStyle("d", parent=S_P, fontSize=7, alignment=TA_CENTER, letterSpace=1)
        ),
    ] for r in summary_rows]
    col_w = [(PAGE_W - 2 * MARGIN_X) * 0.42,
             (PAGE_W - 2 * MARGIN_X) * 0.42,
             (PAGE_W - 2 * MARGIN_X) * 0.16]
    summary_tbl = Table(data, colWidths=col_w)
    summary_tbl.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [BG_PANEL, white]),
        ("BOX", (0, 0), (-1, -1), 0.3, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(summary_tbl)
    story.append(Spacer(1, 12))

    # ── PHASE: ANTES ───────────────────────────────────────────────────
    story.append(phase_divider(
        "ANTES DEL MUNDIAL",
        "Deadline: 9 de junio de 2026 — 48 h antes del inicio",
        accent=HexColor("#c2362b")
    ))
    story.append(Spacer(1, 6))

    # 1. Fase de grupos
    story.append(KeepTogether([
        section_header("1", "Fase de grupos", "72 partidos"),
        Paragraph(
            "Predices el resultado exacto (goles de cada equipo) de los 72 partidos de la fase de grupos.",
            S_P
        ),
        info_box(
            f"Ejemplo: predices España 2-1 Croacia.<br/>"
            f"• Si el resultado real es 2-1 → {green_text('+3 puntos (exacto)')}.<br/>"
            f"• Si es 1-0 → {green_text('+1 punto (acertaste el signo)')}.<br/>"
            f"• Si es 0-0 → 0 puntos (fallaste).",
            accent=GOLD
        ),
        scoring_table([
            ("Resultado exacto", "+3 puntos"),
            ("Signo correcto (1X2)", "+1 punto"),
            ("Fallo", "0 puntos"),
        ]),
    ]))
    story.append(Spacer(1, 10))

    # 2. Cuadro ciego — keep title + table + highlight together
    story.append(KeepTogether([
        section_header("2", "Cuadro ciego", "Pre-torneo"),
        Paragraph(
            "Antes del Mundial, montas tu cuadro eliminatorio completo: desde dieciseisavos hasta el campeón.",
            S_P
        ),
        Paragraph(
            "Los dieciseisavos se auto-rellenan desde tus predicciones de grupo "
            "(1º y 2º de cada grupo + 8 mejores terceros). A partir de ahí, eliges quién gana cada eliminatoria. "
            "Aquí no predices marcadores, solo quién pasa de ronda.",
            S_P
        ),
        scoring_table([
            ("Dieciseisavos (R32)", "0 pts (auto)"),
            ("Octavos de final (×8)", "+1 pt por acierto"),
            ("Cuartos de final (×4)", "+2 pts por acierto"),
            ("Semifinales (×2)", "+4 pts por acierto"),
            ("Final (×1)", "+5 pts por acierto"),
            ("Campeón", "+8 pts"),
        ]),
        info_box(
            f"Si aciertas toda la cadena de tu campeón (desde octavos hasta ganar la final), "
            f"sumas hasta {gold_text('+20 puntos')}.",
            accent=GOLD
        ),
    ]))
    story.append(Spacer(1, 10))

    # 3. Predicciones especiales — header + intro stick together
    story.append(KeepTogether([
        section_header("3", "Predicciones especiales", "14 apuestas · hasta 29 pts"),
        Paragraph(
            "Predicciones extra sobre el torneo, en tres bloques. Se rellenan antes del inicio del Mundial.",
            S_P
        ),
        Spacer(1, 4),
    ]))

    # Cada bloque (Jugadores / Selecciones / Sí o no) no se debe partir
    story.append(KeepTogether(bets_block_table("Jugadores", [
        ("MVP del torneo", "+5 pts"),
        ("Bota de Oro (máximo goleador)", "+3 pts"),
        ("Máximo Asistente", "+3 pts"),
        ("Guante de Oro (mejor portero)", "+3 pts"),
    ])))
    story.append(Spacer(1, 8))

    story.append(KeepTogether(bets_block_table("Selecciones", [
        ("Selección revelación (llega a cuartos)", "+3 pts"),
        ("Selección decepción (cae en grupos)", "+3 pts"),
        ("Selección más goleadora en grupos", "+2 pts"),
        ("Selección menos goleada en grupos", "+2 pts"),
    ])))
    story.append(Spacer(1, 8))

    story.append(KeepTogether(bets_block_table("¿Sí o no?", [
        ("¿Habrá hat-trick en el torneo?", "+1 pt"),
        ("¿Goleada por 5+ goles de diferencia?", "+1 pt"),
        ("¿La final se decidirá en penaltis?", "+1 pt"),
        ("¿El país campeón será europeo?", "+1 pt"),
        ("¿Ambos equipos verán roja en un mismo partido?", "+1 pt"),
    ])))
    story.append(Spacer(1, 8))

    story.append(info_box(
        "<b>Nota</b> — MVP y Guante de Oro los anuncia FIFA al final del torneo y los resuelve el organizador. "
        "El resto se calcula automáticamente con los datos oficiales del Mundial.",
        accent=GOLD, bg=BG_HIGHLIGHT
    ))
    story.append(Spacer(1, 14))

    # ── PHASE: DURANTE ─────────────────────────────────────────────────
    story.append(phase_divider(
        "DURANTE EL MUNDIAL",
        "Nuevas oportunidades de sumar puntos",
        accent=GOLD
    ))
    story.append(Spacer(1, 6))

    # 4. Cuadro real
    story.append(KeepTogether([
        section_header("4", "Cuadro real", "31 partidos"),
        Paragraph(
            "Cuando termine la fase de grupos y se conozca el cuadro real, se abre una nueva ronda de predicciones. "
            "Ahora predices el resultado exacto a 90 minutos de cada partido eliminatorio (igual que en grupos).",
            S_P
        ),
        info_box(
            "<b>Importante</b> — predices el resultado a los 90 minutos, no quién pasa de ronda. "
            "Puedes predecir un empate (ej: 1-1) aunque sea eliminatoria; el partido se resolverá en prórroga "
            "o penaltis, pero tú predices el marcador de los 90'.",
            accent=GOLD
        ),
        scoring_table([
            ("Resultado exacto", "+3 puntos"),
            ("Signo correcto (1X2)", "+1 punto"),
            ("Fallo", "0 puntos"),
        ]),
        Paragraph(
            "El deadline es antes de que empiece cada ronda (ej.: debes predecir los octavos antes de que se juegue "
            "el primer octavo).",
            S_P
        ),
    ]))
    story.append(Spacer(1, 10))

    # ── CLASIFICACIÓN ──────────────────────────────────────────────────
    story.append(KeepTogether([
        section_header("★", "Clasificación y desempate"),
        Paragraph(
            "La clasificación se actualiza automáticamente conforme se juegan los partidos.",
            S_P
        ),
        Paragraph(
            "En caso de empate a puntos en la clasificación general, desempatará el mayor número de "
            "<b>resultados exactos</b> conseguidos durante todo el torneo (grupos + eliminatorias).",
            S_P
        ),
    ]))
    story.append(Spacer(1, 10))

    # ── FECHAS ─────────────────────────────────────────────────────────
    story.append(KeepTogether([
        section_header("◷", "Fechas clave"),
        scoring_table([
            ("Deadline predicciones pre-torneo", "9 de junio de 2026"),
            ("Inicio del Mundial", "11 de junio de 2026"),
            ("Final del Mundial", "19 de julio de 2026"),
        ]),
    ]))
    story.append(Spacer(1, 12))

    # ── REGLAS GENERALES ───────────────────────────────────────────────
    rules_paras = [section_header("§", "Reglas generales")]
    rules = [
        "No se pueden modificar predicciones una vez cerrado el plazo (9 de junio de 2026).",
        "Las predicciones de otros participantes no son visibles hasta que cierre el plazo.",
        "La inscripción debe estar confirmada antes del inicio del Mundial para que tus predicciones cuenten.",
        "En el registro debes indicar tu <b>nombre y apellido reales</b>. Si no se puede identificar al "
        "ganador de forma inequívoca, no recibirá premio. El nickname es opcional y sólo se usa para mostrar.",
        "El organizador se reserva el derecho de resolver disputas y resolver manualmente "
        "las apuestas que no estén disponibles vía datos oficiales (MVP, Guante de Oro).",
    ]
    for r in rules:
        rules_paras.append(Paragraph(
            f'<font color="{GREEN.hexval()}"><b>•</b></font> &nbsp;{r}',
            S_BULLET
        ))
    story.append(KeepTogether(rules_paras))
    story.append(Spacer(1, 14))

    # ── FOOTER NOTE ────────────────────────────────────────────────────
    story.append(info_box(
        f"Versión actualizada: mayo 2026 · "
        f"Plataforma: <b>porra-mundial-2026-omega.vercel.app</b><br/>"
        f"Para cualquier duda, escribe al organizador desde el foro de la app.",
        accent=DARK, bg=HexColor("#f0f2f5")
    ))

    doc.build(story)
    print(f"PDF generated: {out_path}")
    return out_path


if __name__ == "__main__":
    build()
