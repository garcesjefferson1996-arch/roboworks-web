# -*- coding: utf-8 -*-
# Continuación directa de gen_4to_clase3_tangram_oficial.py: mismo set de
# tangram por grupo, pero ahora cada grupo INVENTA su propio patrón de dos
# atributos para que otro grupo lo descubra (RoboTangram — Misión Selva).
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from build_plan_oficial import build

erca_items = [
    ("1. Experiencia (E)", "El reto: ahora el patrón lo inventa cada grupo",
     [
        "El docente recuerda la clase anterior (patrones de dos atributos) y presenta el nuevo reto: cada grupo, con su mismo set de tangram, va a inventar su propio patrón de dos atributos para que otro grupo lo descubra.",
        "Muestra un ejemplo propio inventado en el momento (por ejemplo, cambiando forma y posición) sin decir la regla, y reta a la clase a adivinarla.",
        "DUA 1.1/7.1 – Representación e Implicación: pasar de resolver patrones a inventarlos da a los estudiantes un rol más activo y creativo dentro de su grupo.",
     ]),
    ("2. Reflexión (R)", None,
     [
        "¿Qué fue más difícil, descubrir el patrón del docente o los de la clase anterior? ¿Por qué?",
        "Si un patrón cambiara en tres atributos en lugar de dos, ¿sería más fácil o más difícil de adivinar?",
     ]),
    ("3. Conceptualización (C)", "Cómo diseñar un buen patrón de dos atributos",
     [
        "Se explica que, para crear un patrón claro, el grupo debe elegir DOS atributos (por ejemplo, tamaño y color, o forma y posición) y cambiarlos de manera consistente y predecible en cada figura.",
        "Se recuerda que un patrón demasiado irregular es difícil de adivinar, y uno demasiado obvio no representa un reto — hay que buscar el equilibrio, pensando con calma y sin apurarse.",
        "DUA 2.3 – Representación: se combina la explicación oral con un ejemplo armado físicamente frente a la clase.",
     ]),
    ("4. Aplicación (A)", "Intercambio de patrones entre grupos",
     [
        "Cada grupo diseña, con su set de tangram, una secuencia de 3 a 4 figuras que sigan un patrón oculto de dos atributos, y la registra (dibujada o armada) para mostrarla después.",
        "Los grupos intercambian su secuencia con otro grupo (sin revelar la regla), que debe descubrir el patrón y armar la figura que continúa la secuencia, apoyándose también en el juego RoboTangram — Misión Selva de la plataforma.",
        "DUA 5.1/8.1 – Acción y Expresión / Implicación: cada grupo elige libremente qué dos atributos usar en su patrón, lo que aumenta el sentido de autoría sobre el reto.",
     ]),
    ("5. Reflexión y consolidación (R)", None,
     [
        "Se reúne a la clase y cada grupo cuenta qué patrón le tocó descubrir, si acertó y qué dos atributos identificó.",
        "Se cierra la secuencia de tangram recordando que, así como se armaron patrones pensando con calma y compartiendo el material, la Prudencia enseña a actuar después de pensar bien, no antes.",
        "DUA 9.3 – Implicación: cierre con la reflexión sobre la Prudencia como virtud de la unidad, aplicada tanto al pensar el patrón como al trabajo en equipo.",
     ]),
]

recursos_grupos = [
    ("Humanos", ["Estudiantes organizados en grupos y docente."]),
    ("Materiales", ["Un set de las 7 piezas del tangram Virtus impresas en 3D por grupo (el mismo set usado en la clase anterior; el número de grupos lo define el docente).",
                     "Hojas o cuaderno para registrar el patrón inventado por cada grupo (opcional, si no se deja armado físicamente)."]),
    ("Recursos tecnológicos", ["Un computador o tablet por grupo con acceso a la plataforma Virtus y al juego RoboTangram — Misión Selva.",
                                "Conexión a internet."]),
]

evaluacion_items = [
    ("Técnica:", "Observación directa de la creación e intercambio de patrones entre grupos."),
    ("Instrumento:", "Lista de cotejo grupal."),
    [
        "Diseña, en grupo, un patrón propio que cambia de forma consistente en dos atributos.",
        "Descubre y continúa correctamente el patrón de dos atributos creado por otro grupo.",
        "Participa activamente en la toma de decisiones del grupo y respeta el patrón propuesto por el equipo contrario.",
    ]
]

adaptaciones = [
    ("GRADO 1", "De acceso",
     "Modificaciones en el entorno físico, materiales y estrategias de presentación para garantizar el acceso equitativo, sin alterar los contenidos.",
     ["Ubicar al grupo cerca del docente para apoyo inmediato al diseñar su patrón.",
      "Permitir que el grupo use solo un atributo en su patrón si lo necesita, antes de intentar con dos.",
      "Asignar al estudiante un rol concreto dentro del grupo (por ejemplo, guardar el orden de las piezas)."]),
    ("GRADO 2", "No significativas",
     "Ajustes metodológicos y de evaluación que no modifican el objetivo esencial, pero sí su forma de presentación o desarrollo.",
     ["Aplicar todas las estrategias del Grado de Acceso.",
      "Permitir que el grupo reciba un patrón ya simplificado (con pistas adicionales) para descubrir, en lugar de uno completo.",
      "Evaluación diferenciada: valorar el intento y la participación por sobre la exactitud del patrón inventado."]),
    ("GRADO 3", "Significativas",
     "Modificaciones sustanciales en objetivos, metodología y evaluación, adaptadas al perfil y ritmo del estudiante.",
     ["Aplicar las indicaciones del informe psicopedagógico del estudiante (DECE / UDAI).",
      "Ajustar el objetivo a un nivel funcional (por ejemplo: identificar, dentro de un patrón ya armado por el grupo, qué pieza cambia).",
      "Establecer criterios de evaluación alternativos, valorando el progreso individual dentro de la dinámica grupal."]),
]

horas_acompanamiento = (
    "Los estudiantes que lo necesiten repasarán, en grupos pequeños, cómo identificar y describir un patrón de dos atributos ya armado, antes de intentar crear uno propio, con apoyo directo del docente.",
    ["Modelado paso a paso por el docente, inventando un patrón sencillo junto al grupo.",
     "Trabajo cooperativo en parejas dentro del grupo para proponer ideas de patrón antes de decidir en equipo.",
     "Retroalimentación inmediata y positiva durante el diseño del patrón."],
    ["Observación del patrón diseñado por el grupo.",
     "Diálogo guiado: explicar los dos atributos elegidos para el patrón propio.",
     "Autoevaluación grupal con escala de estrellas (de 1 a 3) sobre qué tan claro quedó su patrón para el otro grupo."]
)

build(
    output_path=os.path.join(os.path.dirname(__file__), 'Virtus_4EGB_Clase05_TangramVirtusContinuacion_Planificacion.pdf'),
    codigo='VST-STEAM-4EGB-05',
    fecha='00-00-0000',
    area='CIENCIA, TECNOLOGÍA Y DISEÑO (STEAM)',
    asignatura='ROBÓTICA EDUCATIVA — TANGRAM VIRTUS: CREAMOS NUESTRO PROPIO PATRÓN',
    docente='[Nombre del Docente]',
    anio_lectivo='2026 - 2027',
    grado='CUARTO AÑO DE EDUCACIÓN GENERAL BÁSICA',
    semana='5',
    fecha_inicio='[dd-mm-aaaa]',
    fecha_fin='[dd-mm-aaaa]',
    titulo_unidad='Tangram: patrones con dos atributos (continuación)',
    subtitulo_unidad='Unidad 1 — Prudencia',
    objetivos_clase=(
        "Crear, en grupo, un patrón propio de figuras que cambie en dos atributos a la vez usando las piezas del "
        "tangram Virtus impresas en 3D, e intercambiarlo con otro grupo para que lo descubra y lo continúe, tanto "
        "de forma física como en el juego RoboTangram — Misión Selva de la plataforma."
    ),
    destreza_codigo='M.4.1.5 (en desarrollo)',
    destreza_texto=(
        "Crear y proponer patrones propios de figuras basados en dos atributos simultáneos, y descubrir y continuar "
        "el patrón creado por otro grupo, utilizando las 7 piezas del tangram Virtus impresas en 3D y el juego "
        "RoboTangram — Misión Selva de la plataforma."
    ),
    dua_linea='Código DUA (CAST / EDUCADUA): Representación (pautas 1–3) · Acción y Expresión (pauta 5) · Implicación (pautas 7–9)',
    erca_items=erca_items,
    recursos_grupos=recursos_grupos,
    aplicacion_texto=(
        "Se busca que los estudiantes pasen de descubrir patrones de dos atributos a crearlos ellos mismos, "
        "profundizando su comprensión al tener que pensar el patrón desde el punto de vista de quien lo diseña. El "
        "intercambio entre grupos con el juego RoboTangram — Misión Selva convierte el reto en una experiencia "
        "social y colaborativa, cerrando la secuencia de dos clases dedicada al tangram."
    ),
    evaluacion_items=evaluacion_items,
    adaptaciones=adaptaciones,
    horas_acompanamiento=horas_acompanamiento,
    footer_materia='Tangram Virtus',
    footer_grado='Cuarto Año EGB',
)
