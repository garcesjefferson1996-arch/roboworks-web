# -*- coding: utf-8 -*-
# Mismo juego real "RoboTangram — Misión Selva" (virtus-plataforma/tangram.html):
# 7 piezas de tangram (2 triángulos grandes, 1 mediano, 2 pequeños, 1 cuadrado,
# 1 paralelogramo) impresas en 3D. A diferencia de 2do/3ro (un set por
# estudiante/pareja), en 4to los estudiantes trabajan en GRUPOS: el docente
# define cuántos grupos según el tamaño de la clase, y cada grupo comparte UN
# solo set de tangram.
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from build_plan_oficial import build

erca_items = [
    ("1. Experiencia (E)", "Misión Selva en equipo: un tangram, un grupo",
     [
        "El docente organiza a la clase en grupos (define el número de grupos y de integrantes por grupo según el tamaño de la clase) y entrega a cada grupo un único set de las 7 piezas del tangram Virtus impreso en 3D para compartir.",
        "Presenta el reto de esta clase: ya no basta con armar una figura, ahora hay que descubrir el patrón que sigue una secuencia de figuras que cambian en DOS atributos a la vez (por ejemplo, el tamaño y la orientación de las piezas).",
        "Muestra en pantalla una secuencia de ejemplo del juego RoboTangram — Misión Selva donde las figuras crecen de tamaño y además rotan, y pregunta qué dos cosas están cambiando.",
        "DUA 1.1/7.1 – Representación e Implicación: trabajar en grupo con un solo set de piezas obliga a coordinarse y turnarse, reforzando la Prudencia al compartir el material.",
     ]),
    ("2. Reflexión (R)", None,
     [
        "En la secuencia de ejemplo, ¿qué cambia de una figura a la siguiente? ¿Cambia solo una cosa o más de una?",
        "Si en mi grupo cada integrante mueve una pieza distinta, ¿cómo nos organizamos para no armar la figura equivocada?",
     ]),
    ("3. Conceptualización (C)", "Patrones con dos atributos a la vez",
     [
        "Se explica qué es un patrón de dos atributos: una secuencia donde dos características cambian juntas y de forma predecible (por ejemplo, tamaño Y orientación, o forma Y color).",
        "Se diferencia de los patrones de un solo atributo vistos en Segundo y Tercer año, donde solo cambiaba una característica a la vez.",
        "Analogía: es como seguir dos instrucciones a la vez — por ejemplo, “cada figura es más grande Y está más girada que la anterior” — hay que fijarse en las dos pistas al mismo tiempo.",
        "DUA 2.3 – Representación: se combina la explicación oral con la manipulación directa de las piezas compartidas del grupo.",
     ]),
    ("4. Aplicación (A)", "Misión Selva en grupo: el Diario compartido",
     [
        "Cada grupo entra a la plataforma Virtus y abre el juego RoboTangram — Misión Selva, turnándose el control del computador o tablet asignado al grupo.",
        "Con el set de tangram del grupo, arman sobre la mesa las figuras del Mundo 1 · Selva de nivel Medio, identificando qué dos atributos cambian entre una figura y la siguiente antes de mover las piezas.",
        "Al lograr armar una figura, el grupo presiona “¡Lo logré!” en el juego para registrarla en el Diario del Explorador de Worky y sumar estrellas para el equipo.",
        "DUA 5.1/8.1 – Acción y Expresión / Implicación: cada grupo decide su propia forma de organizarse (turnos, roles) para avanzar, respetando su propio ritmo como equipo.",
     ]),
    ("5. Reflexión y consolidación (R)", None,
     [
        "Se reúne a la clase y cada grupo comparte qué dos atributos identificó en su patrón favorito y cuántas estrellas consiguió como equipo.",
        "Se anticipa que en la próxima clase seguirán con el tangram, ahora creando ellos mismos un patrón de dos atributos para que otro grupo lo descubra.",
        "DUA 9.3 – Implicación: cierre con una reflexión sobre la Prudencia — así como hay que fijarse bien en las dos pistas del patrón antes de mover una pieza compartida, la Prudencia enseña a pensar con calma antes de actuar, sobre todo cuando el material es de todo el equipo.",
     ]),
]

recursos_grupos = [
    ("Humanos", ["Estudiantes organizados en grupos y docente."]),
    ("Materiales", ["Un set de las 7 piezas del tangram Virtus impresas en 3D por grupo (el número de grupos y de integrantes por grupo lo define el docente según el tamaño de la clase)."]),
    ("Recursos tecnológicos", ["Un computador o tablet por grupo con acceso a la plataforma Virtus y al juego RoboTangram — Misión Selva.",
                                "Conexión a internet."]),
]

evaluacion_items = [
    ("Técnica:", "Observación directa del trabajo en equipo durante el juego."),
    ("Instrumento:", "Lista de cotejo grupal."),
    [
        "Identifica los dos atributos que cambian en una secuencia de figuras (por ejemplo, tamaño y orientación).",
        "El grupo arma correctamente al menos una figura de nivel Medio, guiándose por el patrón de dos atributos.",
        "Se turna el uso de las piezas compartidas y respeta las ideas de sus compañeros de grupo.",
    ]
]

adaptaciones = [
    ("GRADO 1", "De acceso",
     "Modificaciones en el entorno físico, materiales y estrategias de presentación para garantizar el acceso equitativo, sin alterar los contenidos.",
     ["Ubicar al grupo con buena visión de la pantalla y del set de piezas.",
      "Permitir manipular las piezas libremente antes de empezar el reto, sin límite de tiempo.",
      "Asignar al estudiante un rol claro dentro del grupo (por ejemplo, sostener la pieza que se está usando)."]),
    ("GRADO 2", "No significativas",
     "Ajustes metodológicos y de evaluación que no modifican el objetivo esencial, pero sí su forma de presentación o desarrollo.",
     ["Aplicar todas las estrategias del Grado de Acceso.",
      "Reducir el reto a identificar solo uno de los dos atributos que cambia, en lugar de los dos.",
      "Evaluación diferenciada: valorar el intento y la participación en el grupo por sobre la cantidad de figuras logradas."]),
    ("GRADO 3", "Significativas",
     "Modificaciones sustanciales en objetivos, metodología y evaluación, adaptadas al perfil y ritmo del estudiante.",
     ["Aplicar las indicaciones del informe psicopedagógico del estudiante (DECE / UDAI).",
      "Ajustar el objetivo a un nivel funcional (por ejemplo: identificar y nombrar una pieza cuando se le muestre, dentro del trabajo de grupo).",
      "Establecer criterios de evaluación alternativos, valorando el progreso individual dentro de la dinámica grupal."]),
]

horas_acompanamiento = (
    "Los estudiantes que lo necesiten repasarán, en grupos pequeños, cómo identificar un atributo a la vez antes de combinar dos, con apoyo directo del docente.",
    ["Modelado paso a paso por el docente, señalando primero un atributo y luego el segundo.",
     "Trabajo cooperativo en parejas dentro del grupo para practicar antes de intentarlo con todo el equipo.",
     "Retroalimentación inmediata y positiva durante cada intento."],
    ["Observación de la figura armada por el grupo.",
     "Diálogo guiado: nombrar los dos atributos que cambiaron en la figura.",
     "Autoevaluación grupal con escala de estrellas (de 1 a 3) sobre su manejo del reto en equipo."]
)

build(
    output_path=os.path.join(os.path.dirname(__file__), 'Virtus_4EGB_Clase04_TangramVirtus_Planificacion.pdf'),
    codigo='VST-STEAM-4EGB-04',
    fecha='00-00-0000',
    area='CIENCIA, TECNOLOGÍA Y DISEÑO (STEAM)',
    asignatura='ROBÓTICA EDUCATIVA — TANGRAM VIRTUS: PATRONES CON DOS ATRIBUTOS',
    docente='[Nombre del Docente]',
    anio_lectivo='2026 - 2027',
    grado='CUARTO AÑO DE EDUCACIÓN GENERAL BÁSICA',
    semana='4',
    fecha_inicio='[dd-mm-aaaa]',
    fecha_fin='[dd-mm-aaaa]',
    titulo_unidad='Tangram: patrones con dos atributos',
    subtitulo_unidad='Unidad 1 — Prudencia',
    objetivos_clase=(
        "Identificar y continuar patrones de figuras que cambian en dos atributos a la vez (por ejemplo, tamaño y "
        "orientación), trabajando en grupos con un set compartido de piezas del tangram Virtus impresas en 3D, "
        "tanto de forma física como en el juego RoboTangram — Misión Selva de la plataforma."
    ),
    destreza_codigo='M.4.1.4 (en desarrollo)',
    destreza_texto=(
        "Describir, reproducir y continuar patrones de figuras basándose en dos atributos simultáneos (por ejemplo, "
        "tamaño y orientación), armando figuras en grupo con las 7 piezas del tangram Virtus impresas en 3D y en el "
        "juego RoboTangram — Misión Selva de la plataforma."
    ),
    dua_linea='Código DUA (CAST / EDUCADUA): Representación (pautas 1–3) · Acción y Expresión (pauta 5) · Implicación (pautas 7–9)',
    erca_items=erca_items,
    recursos_grupos=recursos_grupos,
    aplicacion_texto=(
        "Se busca que los estudiantes, trabajando en grupos con un set compartido de tangram, reconozcan que un "
        "patrón puede depender de dos atributos a la vez (por ejemplo, tamaño y orientación) y no solo de uno, "
        "como en años anteriores. El juego RoboTangram — Misión Selva refuerza este aprendizaje dándole un "
        "propósito narrativo compartido: ayudar en equipo a Worky a completar su Diario del Explorador."
    ),
    evaluacion_items=evaluacion_items,
    adaptaciones=adaptaciones,
    horas_acompanamiento=horas_acompanamiento,
    footer_materia='Tangram Virtus',
    footer_grado='Cuarto Año EGB',
)
