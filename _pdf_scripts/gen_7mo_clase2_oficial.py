# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from build_plan_oficial import build

erca_items = [
    ("1. Experiencia (E)", "Un robot que ya sabe hacer algo nuevo",
     [
        "El docente da la bienvenida al último año del subnivel Media y presenta el reto: mostrar un robot ya armado y programado por él mismo.",
        "Hace una demostración completa del robot en acción, resaltando que se mueve sin cables, controlado por Bluetooth desde un celular.",
        "DUA 1.1/7.1 – Representación e Implicación: observar un modelo ya terminado y funcionando genera expectativa por lo que se construirá durante el año.",
     ]),
    ("2. Reflexión (R)", None,
     [
        "¿Qué notan de diferente en este robot comparado con los de años anteriores?",
        "¿Cómo creen que se está controlando, si no ven ningún cable ni control remoto tradicional?",
     ]),
    ("3. Conceptualización (C)", "Qué es el control por Bluetooth",
     [
        "Se explica de forma sencilla qué es el Bluetooth y cómo permite controlar los 2 motores DC del robot de forma inalámbrica, sin cables, desde un celular.",
        "Analogía: el control por Bluetooth es como manejar un carrito a control remoto, pero usando el celular en lugar de un control tradicional.",
        "DUA 2.3 – Representación: se repite la demostración en distintos ángulos para que los estudiantes vean con claridad cómo se controla el robot por Bluetooth.",
     ]),
    ("4. Aplicación (A)", "Anticipando lo que construiremos",
     [
        "En grupo, los estudiantes proponen ideas de qué podrían hacer con un robot de 2 motores controlado por Bluetooth (un carrito, un robot que sigue órdenes desde el celular, etc.) y las comentan en voz alta.",
        "DUA 8.1 – Implicación: proponer ideas propias antes de construir aumenta la relevancia percibida de la actividad y la motivación por lo que viene.",
        "El docente da espacio amplio para preguntas libres sobre el robot, el control por Bluetooth o lo que construirán este año.",
     ]),
    ("5. Reflexión y consolidación (R)", None,
     [
        "Se reúne al grupo y se anticipa que en las próximas clases empezarán a construir y programar con el kit completo, incluyendo el control por Bluetooth.",
        "DUA 9.3 – Implicación: cierre presentando la virtud de la Caridad — así como el docente compartió su robot y su conocimiento con la clase, la Caridad invita a usar lo aprendido para ayudar a otros, cerrando el ciclo de Fe, Esperanza y Caridad.",
     ]),
]

recursos_grupos = [
    ("Humanos", ["Estudiantes y docente."]),
    ("Materiales", ["Robot armado por el profe, con 2 motores DC controlados por Bluetooth.",
                     "Kit VirtiBit."]),
    ("Recursos tecnológicos", ["Espacio despejado para la demostración frente a la clase."]),
]

evaluacion_items = [
    ("Técnica:", "Observación directa durante la demostración y la conversación grupal."),
    ("Instrumento:", "Registro cualitativo de participación y preguntas."),
    [
        "Observa atentamente la demostración del docente.",
        "Formula preguntas relevantes sobre el control por Bluetooth y el funcionamiento del robot.",
        "Anticipa, con ayuda del docente, qué construirán y programarán este año.",
    ]
]

adaptaciones = [
    ("GRADO 1", "De acceso",
     "Modificaciones en el entorno físico, materiales y estrategias de presentación para garantizar el acceso equitativo, sin alterar los contenidos.",
     ["Ubicar al estudiante cerca del docente y con buena visión de la demostración.",
      "Repetir la demostración del control por Bluetooth las veces que sea necesario.",
      "Apoyar la explicación oral con gestos que imiten el movimiento del robot."]),
    ("GRADO 2", "No significativas",
     "Ajustes metodológicos y de evaluación que no modifican el objetivo esencial, pero sí su forma de presentación o desarrollo.",
     ["Aplicar todas las estrategias del Grado de Acceso.",
      "Permitir que el estudiante participe con una sola pregunta o propuesta, en lugar de varias.",
      "Evaluación diferenciada: valorar la atención y la actitud por sobre la cantidad de aportes."]),
    ("GRADO 3", "Significativas",
     "Modificaciones sustanciales en objetivos, metodología y evaluación, adaptadas al perfil y ritmo del estudiante.",
     ["Aplicar las indicaciones del informe psicopedagógico del estudiante (DECE / UDAI).",
      "Ajustar el objetivo a un nivel funcional (por ejemplo: señalar el robot cuando se le pregunte quién lo está controlando).",
      "Establecer criterios de evaluación alternativos, valorando el progreso individual y la participación."]),
]

horas_acompanamiento = (
    "Los estudiantes que lo necesiten repasarán, en grupos pequeños, qué es el control por Bluetooth y para qué sirve, con apoyo directo del docente y una segunda demostración.",
    ["Modelado paso a paso por el docente, repitiendo la demostración del control por Bluetooth.",
     "Diálogo dirigido con preguntas guía para facilitar la participación.",
     "Retroalimentación inmediata y positiva ante cada pregunta o propuesta."],
    ["Diálogo guiado: identificar qué hace diferente a un robot controlado por Bluetooth de uno con cables o control remoto tradicional.",
     "Registro de al menos una propuesta de uso del control por Bluetooth por estudiante.",
     "Autoevaluación con escala de estrellas (de 1 a 3) sobre su comprensión de la clase."]
)

build(
    output_path=os.path.join(os.path.dirname(__file__), 'Virtus_7EGB_Clase02_ElRetoDelProfe_Planificacion.pdf'),
    codigo='VST-STEAM-7EGB-02',
    fecha='00-00-0000',
    area='CIENCIA, TECNOLOGÍA Y DISEÑO (STEAM)',
    asignatura='ROBÓTICA EDUCATIVA — EL RETO DEL PROFE: EL ROBOT EN ACCIÓN',
    docente='[Nombre del Docente]',
    anio_lectivo='2026 - 2027',
    grado='SÉPTIMO AÑO DE EDUCACIÓN GENERAL BÁSICA',
    semana='2',
    fecha_inicio='[dd-mm-aaaa]',
    fecha_fin='[dd-mm-aaaa]',
    titulo_unidad='El reto del profe: el robot en acción',
    subtitulo_unidad='Unidad 1 — Caridad, servir con lo que sé',
    objetivos_clase=(
        "Observar un reto ya resuelto por el docente con un robot armado y programado por él, con 2 motores DC "
        "controlado por Bluetooth, la novedad de este año; identificar y anticipar, a partir de la observación, "
        "qué piezas y conceptos nuevos construirán y programarán durante 7mo; y presentar la virtud del año, "
        "la Caridad, como cierre del ciclo teologal (Fe, Esperanza, Caridad)."
    ),
    destreza_codigo='M.4.1 (ref., en desarrollo)',
    destreza_texto=(
        "Identificar componentes electromecánicos (2 motores DC y el control por Bluetooth) y su función dentro "
        "de un sistema robótico completo, a partir de la observación de un modelo ya armado y programado."
    ),
    dua_linea='Código DUA (CAST / EDUCADUA): Representación (pautas 2–3) · Implicación (pautas 7–8)',
    erca_items=erca_items,
    recursos_grupos=recursos_grupos,
    aplicacion_texto=(
        "Se busca que los estudiantes, antes de construir nada ellos mismos, comprendan el propósito y el "
        "potencial del control por Bluetooth observando un modelo terminado y funcionando. Esta demostración "
        "genera expectativa y una comprensión conceptual previa que hace más significativa la construcción y "
        "programación que realizarán en las próximas clases."
    ),
    evaluacion_items=evaluacion_items,
    adaptaciones=adaptaciones,
    horas_acompanamiento=horas_acompanamiento,
    footer_materia='El Reto del Profe',
    footer_grado='Séptimo Año EGB',
)
