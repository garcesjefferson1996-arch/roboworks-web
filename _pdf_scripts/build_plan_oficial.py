# -*- coding: utf-8 -*-
"""
Generador de PDF que replica EXACTAMENTE el formato institucional
"Planificación Microcurricular de Destreza" de Virtus Steam
(mismo formato que Planificacion_Tinkercad_6to.pdf, la plantilla oficial).

Copia persistente de este script (fuera de la carpeta temporal de la sesión)
para que sobreviva a reinicios de sandbox: el logo se referencia dentro del
mismo repo (virtus-plataforma/images/virtus/virtus-logo.png), no en la
carpeta temporal.
"""
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    ListFlowable, ListItem, Image as RLImage, KeepTogether
)

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO_PATH = os.path.join(HERE, '..', 'virtus-plataforma', 'images', 'virtus', 'virtus-logo.png')

NAVY = colors.HexColor('#1B2A4A')
TEAL = colors.HexColor('#1D9A8F')
MINT = colors.HexColor('#E6F5F3')
GRID = colors.HexColor('#D7E3E1')
DARK = colors.HexColor('#1e293b')
GRAY = colors.HexColor('#64748b')
WHITE = colors.white

PAGE_W, PAGE_H = letter
L_MARGIN = 1.0 * cm
R_MARGIN = 1.0 * cm
TOP_MARGIN = 3.7 * cm
BOTTOM_MARGIN = 2.1 * cm
USABLE_W = PAGE_W - L_MARGIN - R_MARGIN

styles = getSampleStyleSheet()
styles.add(ParagraphStyle('CellLabel', fontName='Helvetica-Bold', fontSize=8.3, leading=10.5, textColor=WHITE))
styles.add(ParagraphStyle('CellValue', fontName='Helvetica', fontSize=9, leading=12, textColor=DARK))
styles.add(ParagraphStyle('CellValueBold', fontName='Helvetica-Bold', fontSize=9.3, leading=12, textColor=DARK))
styles.add(ParagraphStyle('CellValueItalic', fontName='Helvetica-Oblique', fontSize=8.7, leading=11.5, textColor=GRAY))
styles.add(ParagraphStyle('TableHeadTeal', fontName='Helvetica-Bold', fontSize=8.3, leading=10.3, textColor=WHITE))
styles.add(ParagraphStyle('Body', fontName='Helvetica', fontSize=8.3, leading=11.6, textColor=DARK))
styles.add(ParagraphStyle('BodyBold', fontName='Helvetica-Bold', fontSize=8.3, leading=11.6, textColor=DARK))
styles.add(ParagraphStyle('ERCAHead', fontName='Helvetica-Bold', fontSize=8.6, leading=12, textColor=NAVY, spaceBefore=7, spaceAfter=2))
styles.add(ParagraphStyle('ERCASub', fontName='Helvetica-BoldOblique', fontSize=8.3, leading=11, textColor=DARK, spaceAfter=2))
styles.add(ParagraphStyle('DuaLine', fontName='Helvetica-Bold', fontSize=8.0, leading=10.8, textColor=TEAL, spaceAfter=5))
styles.add(ParagraphStyle('GroupLabel', fontName='Helvetica-Bold', fontSize=8.3, leading=11, textColor=DARK, spaceBefore=5, spaceAfter=1))
styles.add(ParagraphStyle('SectionBar', fontName='Helvetica-Bold', fontSize=11.5, leading=14, textColor=WHITE))
styles.add(ParagraphStyle('MintLabel', fontName='Helvetica-Bold', fontSize=8.6, leading=11.5, textColor=DARK))
styles.add(ParagraphStyle('MintSub', fontName='Helvetica-Oblique', fontSize=8.3, leading=11, textColor=DARK))
styles.add(ParagraphStyle('Footer', fontName='Helvetica-Oblique', fontSize=7.3, leading=9, textColor=GRAY, alignment=TA_CENTER))


def body(text):
    return Paragraph(text, styles['Body'])


def bullets(items, style='Body', color=TEAL):
    return ListFlowable(
        [ListItem(Paragraph(it, styles[style]), leftIndent=6, spaceBefore=1.5) for it in items],
        bulletType='bullet', start='•', leftIndent=11, bulletColor=color,
        spaceBefore=1, spaceAfter=3
    )


def section_bar(number, title):
    t = Table([[Paragraph(f'{number}.&nbsp;&nbsp;{title}', styles['SectionBar'])]],
              colWidths=[USABLE_W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]))
    return t


def teal_grid_style(header_rows=1, mint_col0_rows=None):
    cmds = [
        ('BACKGROUND', (0, 0), (-1, header_rows - 1), TEAL),
        ('GRID', (0, 0), (-1, -1), 0.6, GRID),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]
    return cmds


def make_header_footer(materia, grado, codigo, fecha):
    logo = None
    if os.path.exists(LOGO_PATH):
        logo = RLImage(LOGO_PATH, width=2.6 * cm, height=2.6 * cm)

    def _draw(cnv, doc):
        cnv.saveState()
        # línea navy superior
        cnv.setStrokeColor(NAVY)
        cnv.setLineWidth(1.3)
        cnv.line(L_MARGIN, PAGE_H - 0.55 * cm, PAGE_W - R_MARGIN, PAGE_H - 0.55 * cm)

        # logo
        if logo:
            logo.drawOn(cnv, L_MARGIN, PAGE_H - 3.35 * cm)

        # bloque central de título
        center_x = PAGE_W / 2 + 0.6 * cm
        cnv.setFont('Helvetica-Bold', 15)
        cnv.setFillColor(NAVY)
        cnv.drawCentredString(center_x, PAGE_H - 1.35 * cm, 'VIRTUS STEAM')
        cnv.setFont('Helvetica', 9.5)
        cnv.setFillColor(TEAL)
        cnv.drawCentredString(center_x, PAGE_H - 1.75 * cm, 'GESTIÓN ACADÉMICA')
        cnv.setFont('Helvetica-Bold', 9.3)
        cnv.setFillColor(DARK)
        cnv.drawCentredString(center_x, PAGE_H - 2.15 * cm, 'PLANIFICACIÓN MICROCURRICULAR DE DESTREZA')

        # caja código / fecha (arriba a la derecha)
        right_x = PAGE_W - R_MARGIN
        cnv.setFont('Helvetica-Bold', 7.6)
        cnv.setFillColor(TEAL)
        cnv.drawRightString(right_x, PAGE_H - 1.15 * cm, 'CÓDIGO:')
        cnv.setFont('Helvetica-Bold', 8.6)
        cnv.setFillColor(NAVY)
        cnv.drawRightString(right_x, PAGE_H - 1.45 * cm, codigo)
        cnv.setFont('Helvetica-Bold', 7.6)
        cnv.setFillColor(TEAL)
        cnv.drawRightString(right_x, PAGE_H - 1.85 * cm, 'FECHA:')
        cnv.setFont('Helvetica-Bold', 8.6)
        cnv.setFillColor(NAVY)
        cnv.drawRightString(right_x, PAGE_H - 2.15 * cm, fecha)

        # línea inferior del header
        cnv.setStrokeColor(colors.HexColor('#cbd5e1'))
        cnv.setLineWidth(0.6)
        cnv.line(L_MARGIN, PAGE_H - 3.55 * cm, PAGE_W - R_MARGIN, PAGE_H - 3.55 * cm)

        # footer
        cnv.setFont('Helvetica-Oblique', 7.3)
        cnv.setFillColor(GRAY)
        footer_text = f'Virtus Steam · Planificación Microcurricular de Destreza · {materia} · {grado}'
        cnv.drawString(L_MARGIN, 1.0 * cm, footer_text)
        cnv.restoreState()

    return _draw


def build(output_path, codigo, fecha, area, asignatura, docente, anio_lectivo,
          grado, semana, fecha_inicio, fecha_fin, titulo_unidad, subtitulo_unidad,
          objetivos_clase, destreza_codigo, destreza_texto,
          dua_linea, erca_items, recursos_grupos, aplicacion_texto, evaluacion_items,
          adaptaciones, horas_acompanamiento, footer_materia, footer_grado):

    doc = SimpleDocTemplate(
        output_path, pagesize=letter,
        topMargin=TOP_MARGIN, bottomMargin=BOTTOM_MARGIN,
        leftMargin=L_MARGIN, rightMargin=R_MARGIN,
        title=f'{codigo} - {titulo_unidad}'
    )

    story = []

    # ---- 1. DATOS INFORMATIVOS ----
    story.append(section_bar('1', 'DATOS INFORMATIVOS'))
    story.append(Spacer(1, 10))

    def lab(t):
        return Paragraph(t, styles['CellLabel'])

    def val(t):
        return Paragraph(t, styles['CellValue'])

    c0, c1, c2, c3 = 2.9 * cm, 7.6 * cm, 2.9 * cm, USABLE_W - 2.9 * cm - 7.6 * cm - 2.9 * cm
    datos_table = Table([
        [lab('ÁREA:'), val(area), lab('DOCENTE:'), val(docente)],
        [lab('ASIGNATURA:'), val(asignatura), lab('AÑO LECTIVO:'), val(anio_lectivo)],
        [lab('AÑO/GRADO:'), val(grado), lab('SEMANA:'), val(semana)],
        [lab('FECHA INICIO:'), val(fecha_inicio), lab('FECHA FIN:'), val(fecha_fin)],
    ], colWidths=[c0, c1, c2, c3])
    datos_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), TEAL),
        ('BACKGROUND', (2, 0), (2, -1), TEAL),
        ('GRID', (0, 0), (-1, -1), 0.6, GRID),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(datos_table)
    story.append(Spacer(1, 10))

    titulo_cell = [Paragraph(titulo_unidad, styles['CellValueBold']),
                   Paragraph(subtitulo_unidad, styles['CellValueItalic'])]
    unidad_table = Table([
        [Paragraph('TÍTULO DE LA UNIDAD', styles['TableHeadTeal']),
         Paragraph('OBJETIVOS ESPECÍFICOS DE LA CLASE', styles['TableHeadTeal'])],
        [titulo_cell, Paragraph(objetivos_clase, styles['Body'])]
    ], colWidths=[5.6 * cm, USABLE_W - 5.6 * cm], splitByRow=1, splitInRow=1)
    unidad_table.setStyle(TableStyle(teal_grid_style(header_rows=1)))
    story.append(unidad_table)
    story.append(Spacer(1, 16))

    # ---- 2. PLANIFICACIÓN ----
    story.append(section_bar('2', 'PLANIFICACIÓN'))
    story.append(Spacer(1, 10))

    destreza_cell = [
        Paragraph(destreza_codigo, styles['MintLabel']),
        Spacer(1, 3),
        Paragraph(destreza_texto, styles['Body']),
    ]

    actividades_flow = [Paragraph(dua_linea, styles['DuaLine'])]
    for head, sub, items in erca_items:
        actividades_flow.append(Paragraph(head, styles['ERCAHead']))
        if sub:
            actividades_flow.append(Paragraph(sub, styles['ERCASub']))
        actividades_flow.append(bullets(items))

    recursos_flow = []
    for grupo, items in recursos_grupos:
        recursos_flow.append(Paragraph(grupo, styles['GroupLabel']))
        recursos_flow.append(bullets(items))

    aplicacion_flow = [Paragraph(aplicacion_texto, styles['Body'])]

    evaluacion_flow = []
    for head, val_txt in evaluacion_items[:2]:
        evaluacion_flow.append(Paragraph(head, styles['GroupLabel']))
        evaluacion_flow.append(Paragraph(val_txt, styles['Body']))
    evaluacion_flow.append(Paragraph('Indicadores:', styles['GroupLabel']))
    evaluacion_flow.append(bullets(evaluacion_items[2]))

    col_w = [3.3 * cm, 5.6 * cm, 3.3 * cm, 3.6 * cm, USABLE_W - 3.3 * cm - 5.6 * cm - 3.3 * cm - 3.6 * cm]
    planif_table = Table([
        [Paragraph('DESTREZA CON CRITERIOS DE DESEMPEÑO', styles['TableHeadTeal']),
         Paragraph('ACTIVIDADES DE APRENDIZAJE', styles['TableHeadTeal']),
         Paragraph('RECURSOS', styles['TableHeadTeal']),
         Paragraph('APLICACIÓN DEL CONTENIDO', styles['TableHeadTeal']),
         Paragraph('EVALUACIÓN', styles['TableHeadTeal'])],
        [destreza_cell, actividades_flow, recursos_flow, aplicacion_flow, evaluacion_flow]
    ], colWidths=col_w, splitByRow=1, splitInRow=1)
    st = teal_grid_style(header_rows=1)
    st.append(('BACKGROUND', (0, 1), (0, 1), MINT))
    planif_table.setStyle(TableStyle(st))
    story.append(planif_table)
    story.append(Spacer(1, 16))

    # ---- 3. ADAPTACIONES CURRICULARES ----
    story.append(section_bar('3', 'ADAPTACIONES CURRICULARES'))
    story.append(Spacer(1, 10))

    ad_rows = [[Paragraph('GRADO DE ADAPTACIÓN', styles['TableHeadTeal']),
                Paragraph('ESPECIFICACIÓN Y SUGERENCIAS DE APLICACIÓN', styles['TableHeadTeal'])]]
    for grado_ad, sub_ad, intro, sugerencias in adaptaciones:
        cell0 = [Paragraph(grado_ad, styles['MintLabel']), Paragraph(sub_ad, styles['MintSub'])]
        cell1 = [Paragraph(intro, styles['Body']), Paragraph('Sugerencias:', styles['GroupLabel']),
                 bullets(sugerencias)]
        ad_rows.append([cell0, cell1])
    ad_table = Table(ad_rows, colWidths=[3.3 * cm, USABLE_W - 3.3 * cm], splitByRow=1, splitInRow=1)
    ad_st = teal_grid_style(header_rows=1)
    for i in range(1, len(ad_rows)):
        ad_st.append(('BACKGROUND', (0, i), (0, i), MINT))
    ad_table.setStyle(TableStyle(ad_st))
    story.append(ad_table)
    story.append(Spacer(1, 16))

    # ---- 4. HORAS DE ACOMPAÑAMIENTO DOCENTE ----
    story.append(section_bar('4', 'HORAS DE ACOMPAÑAMIENTO DOCENTE'))
    story.append(Spacer(1, 10))
    refuerzo_txt, estrategias, evaluativas = horas_acompanamiento
    hd_table = Table([
        [Paragraph('ACTIVIDADES PLANIFICADAS PARA EL REFUERZO', styles['TableHeadTeal']),
         Paragraph('ESTRATEGIAS METODOLÓGICAS ACTIVAS', styles['TableHeadTeal']),
         Paragraph('ACTIVIDADES EVALUATIVAS', styles['TableHeadTeal'])],
        [Paragraph(refuerzo_txt, styles['Body']), bullets(estrategias), bullets(evaluativas)]
    ], colWidths=[USABLE_W / 3.0] * 3, splitByRow=1, splitInRow=1)
    hd_st = teal_grid_style(header_rows=1)
    hd_st.append(('BACKGROUND', (0, 1), (0, 1), MINT))
    hd_table.setStyle(TableStyle(hd_st))
    story.append(hd_table)

    on_page = make_header_footer(footer_materia, footer_grado, codigo, fecha)
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print('OK:', output_path)
