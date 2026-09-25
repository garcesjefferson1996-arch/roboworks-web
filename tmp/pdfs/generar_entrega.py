import json, sys, html, shutil
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '_pdf_scripts'))
import build_plan_oficial as layout
from reportlab.platypus import CondPageBreak
source=(ROOT/'_pdf_scripts/build_plan_oficial.py').read_text(encoding='utf-8')
source=source.replace("story.append(section_bar('3',", "story.append(CondPageBreak(180))\n    story.append(section_bar('3',")
source=source.replace("story.append(section_bar('4',", "story.append(CondPageBreak(170))\n    story.append(section_bar('4',")
layout.CondPageBreak=CondPageBreak
exec(compile(source,str(ROOT/'_pdf_scripts/build_plan_oficial.py'),'exec'),layout.__dict__)
class Table(layout.Table):
    def split(self,availWidth,availHeight):
        if self._nrows==2 and self._ncols==3:
            return []
        return super().split(availWidth,availHeight)
layout.Table=Table
build=layout.build
plans = json.loads((ROOT/'tmp/pdfs/clases04_contenido.json').read_text(encoding='utf-8'))
OUT = ROOT/'planificaciones/Entrega_Clase04_2026-09-20'
OUT.mkdir(parents=True, exist_ok=True)
grades = {2:'SEGUNDO',3:'TERCER',4:'CUARTO',5:'QUINTO',6:'SEXTO',7:'SÉPTIMO',8:'OCTAVO',9:'NOVENO',10:'DÉCIMO'}
payload=[]
for p in plans:
    esc=lambda s: html.escape(s).replace('\n','<br/>')
    steps=dict(bienvenida=p['welcome'],motivacion=p['motivation'],preguntas_iniciales=p['questions'],explicacion_teorica=p['theory'],analogias=p['analogy'],construccion_robot=p.get('construction','No corresponde construir un robot en esta sesión. '+p['product']),conexiones_electronicas=p.get('electronics','No se realizan conexiones electrónicas en esta sesión.'),programacion=p.get('program','No se requiere escribir un programa en esta sesión. Se representa y explica la solución antes de avanzar.'),pruebas=p['tests'],posibles_errores=p['errors'],como_solucionarlos=p['fixes'],preguntas_estudiantes=p['inquiry'],actividad_practica=p['practice'],proyecto_final=p['product'],evaluacion_paso='Lista de cotejo formativa: logrado, en proceso o requiere apoyo. Observar: '+' '.join(p['indicators'])+' Registrar la evidencia y una mejora; no calificar por rapidez.',cierre_clase=p['close'],reflexion=p['reflection'])
    erca=[('1. Experiencia (E) - 5 min','Inicio y motivación',[p['welcome'],p['motivation']]),('2. Reflexión (R)','Recuperar saberes',[p['questions'],p['analogy']]),('3. Conceptualización (C) - 8 min','Explicación y modelado',[p['theory']]+([p['program']] if p.get('program') else [])+([p['electronics']] if p.get('electronics') else [])),('4. Aplicación (A) - 22 min','Reto, pruebas y ajuste',[p['practice'],'Pruebas: '+p['tests'],'Errores frecuentes: '+p['errors'],'Apoyo para corregir: '+p['fixes']]),('5. Reflexión y consolidación - 10 min','Cierre y transferencia',[p['close'],p['reflection'],'Tarea: '+p['home']])]
    adapt=[('GRADO 1','De acceso','Facilitar el acceso al mismo objetivo.',[p['support'],'Ofrecer instrucciones orales, visuales y demostración; comprobar la comprensión.']),('GRADO 2','No significativas','Ajustar la metodología y la forma de evidenciar el aprendizaje.', ['Dividir la actividad en pasos breves y ofrecer tiempo adicional.','Reducir la cantidad de ejercicios, conservando el objetivo central; aceptar evidencia oral, gráfica o práctica.']),('GRADO 3','Significativas','Aplicar solo cuando corresponda al plan individual definido por el equipo educativo.', ['Seguir las recomendaciones del informe y la coordinación con DECE/UDAI.','Priorizar una acción funcional relacionada con el reto y valorar el progreso individual con acompañamiento.'])]
    filename=f"Virtus_{p['g']}EGB_Clase04_{p['slug']}_Planificacion.pdf"
    path=OUT/filename
    build(output_path=str(path),codigo=f"VST-STEAM-{p['g']}EGB-04",fecha='Por definir',area='CIENCIA, TECNOLOGÍA Y DISEÑO (STEAM)',asignatura='ROBÓTICA EDUCATIVA - '+esc(p['short'].upper()),docente='Por asignar',anio_lectivo='2026 - 2027',grado=grades[p['g']]+' AÑO DE EDUCACIÓN GENERAL BÁSICA',semana='Clase 4',fecha_inicio='Por definir',fecha_fin='Por definir',titulo_unidad=esc(p['title']),subtitulo_unidad='Unidad 1 - '+p['virtue'],objetivos_clase=esc(' '.join(p['objectives'])),destreza_codigo='Destreza de la sesión (Virtus)',destreza_texto=esc(p['skill']),dua_linea='DUA: representación visual y oral; distintas formas de respuesta; participación y apoyo gradual.',erca_items=[(h,s,[esc(i) for i in items]) for h,s,items in erca],recursos_grupos=[('Humanos',['Docente y estudiantes; roles alternados.']),('Materiales',[esc(x) for x in p['materials']]),('Recursos tecnológicos',[esc(x) for x in p['software']])],aplicacion_texto=esc('Producto: '+p['product']+' Duración sugerida: 45 minutos, ajustable al horario del paralelo. '+p['reflection']),evaluacion_items=[('Técnica:','Observación y diálogo sobre el producto.'),('Instrumento:','Lista de cotejo formativa: logrado, en proceso o requiere apoyo. Registrar una evidencia y una mejora.'),[esc(x) for x in p['indicators']]],adaptaciones=adapt,horas_acompanamiento=(esc(p['support']),['Modelado breve y práctica acompañada.','Retroalimentación sobre un paso cada vez.','Alternar roles de explicación y ejecución.'],['Repetir una parte del reto con apoyo.','Explicar una decisión y mostrar una evidencia.','Comparar el avance con el primer intento.']),footer_materia=p['short'],footer_grado=grades[p['g']].title()+' Año EGB')
    notes='## Orientaciones para el docente\n\n- Duración sugerida: 45 minutos; ajustar al horario del paralelo.\n- '+p['support']+'\n- Fechas y docente: completar según el paralelo.\n- La destreza está formulada para esta sesión de Virtus; no se asigna un código ministerial no verificado.\n- Evaluación formativa con evidencia, sin calificar por rapidez.\n'
    if p['g']==6: notes+='\nReferencia técnica: https://makecode.microbit.org/reference/input/button-is-pressed\n'
    if p['g']==9: notes+='\nReferencia técnica: https://docs.arduino.cc/built-in-examples/basics/Blink/\n'
    row=dict(g=p['g'],id=p['id'],title=p['title'],pdf=str(path),fields={'l-tiempo':'45 minutos (sugeridos)','l-actividades':'\n\n'.join([p['welcome'],p['theory'],p['practice'],p['close']]),'l-proyecto':p['product'],'l-evaluacion':steps['evaluacion_paso'],'l-tarea':p['home'],'l-plan':notes},chips={'objetivos':p['objectives'],'competencias':['Pensamiento lógico y resolución de problemas','Comunicación de decisiones y trabajo colaborativo'],'destrezas':[p['skill']],'indicadores_evaluacion':p['indicators'],'recursos_necesarios':['Tiempo sugerido: 45 minutos','Espacio de trabajo organizado y apoyos visuales'],'materiales':p['materials'],'kits':p['kits'],'software_requerido':p['software']},steps=steps)
    payload.append(row)
    md='# '+p['title']+'\n\nGrado: '+str(p['g'])+' EGB | Clase 4 | 45 minutos sugeridos\n\n'
    for key,values in row['chips'].items(): md+='## '+key.replace('_',' ').title()+'\n\n'+'\n'.join('- '+s for s in values)+'\n\n'
    for i,(key,value) in enumerate(steps.items(),1): md+=f'## {i}. '+key.replace('_',' ').title()+'\n\n'+value+'\n\n'
    md+='## Tarea\n\n'+p['home']+'\n\n'+notes
    (OUT/filename.replace('.pdf','.md')).write_text(md,encoding='utf-8')
(OUT/'contenido_plataforma.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
serve=ROOT/'tmp/pdfs/transferencia'
serve.mkdir(exist_ok=True)
(serve/'index.html').write_text('<!doctype html><html lang="es"><meta charset="utf-8"><title>Contenido preparado para Virtus</title><body><h1>Contenido preparado para Virtus</h1><pre id="payload">'+html.escape(json.dumps(payload,ensure_ascii=False))+'</pre></body></html>',encoding='utf-8')
shutil.copy2(ROOT/'tmp/pdfs/referencia_5EGB_Scratch.pdf',OUT/'Referencia_Virtus_5EGB_Clase03_Scratch.pdf')
print('PAYLOAD',OUT/'contenido_plataforma.json')
