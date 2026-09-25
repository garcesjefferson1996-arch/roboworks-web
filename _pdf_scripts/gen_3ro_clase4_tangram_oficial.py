# -*- coding: utf-8 -*-
# Misma base que la version de 2do EGB (mismo juego real "RoboTangram — Misión
# Selva", virtus-plataforma/tangram.html): 7 piezas de tangram (2 triángulos
# grandes, 1 mediano, 2 pequeños, 1 cuadrado, 1 paralelogramo) impresas en 3D.
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from build_plan_oficial import build

erca_items = [
    ("1. Experiencia (E)", "Misión Selva: Worky necesita ayuda",
     [
        "El docente presenta el juego RoboTangram — Misión Selva y a Worky, la mascota de Virtus, que necesita ayuda para registrar animales en su Diario del Explorador.",
        "Muestra físicamente las 7 piezas del tangram Virtus impresas en 3D (2 triángulos grandes, 1 triángulo mediano, 2 triángulos pequeños, 1 cuadrado y 1 paralelogramo) y deja que los estudiantes las toquen y observen.",
        "Hace una primera demostración armando una figura sencilla (el Gato) comparando la silueta de la pantalla con las piezas de colores.",
        "DUA 1.1/7.1 – Representación e Implicación: combinar el juego digital con las piezas físicas impresas en 3D ofrece dos formas de acercarse al mismo reto.",
     ]),
    ("2. Reflexión (R)", None,
     [
        "¿Cuántos lados tiene cada pieza? ¿Todas las piezas son iguales entre sí?",
        "Si giro o volteo una pieza, ¿sigue siendo la misma figura?",
     ]),
    ("3. Conceptualización (C)", "Atributos de las figuras: lados y forma",
     [
        "Se explica qué es un atributo de una figura: el número de lados, si son rectos, y su tamaño (grande, mediano, pequeño).",
        "Se nombran las piezas en voz alta mientras se muestran físicamente: triángulo grande, triángulo mediano, triángulo pequeño, cuadrado, paralelogramo.",
        "Analogía: las piezas del tangram son como las piezas de un rompecabezas — cada una tiene su propia forma, pero juntas arman algo nuevo.",
        "DUA 2.3 – Representación: se combina la explicación oral con la manipulación directa de las piezas físicas.",
     ]),
    ("4. Aplicación (A)", "Misión Selva: los primeros animales del Diario",
     [
        "Cada estudiante entra a la plataforma Virtus y abre el juego RoboTangram — Misión Selva desde su usuario.",
        "Con sus piezas de tangram impresas en 3D, arma sobre la mesa las primeras figuras del Mundo 1 · Selva (por ejemplo, Gato y Pájaro), guiándose por la silueta y la pista de colores que muestra el juego en pantalla.",
        "Al lograr armar una figura, presiona “¡Lo logré!” en el juego para registrarla en el Diario del Explorador de Worky y ganar sus estrellas.",
        "DUA 5.1/8.1 – Acción y Expresión / Implicación: cada estudiante avanza a su propio ritmo, eligiendo entre las figuras de nivel Fácil disponibles.",
     ]),
    ("5. Reflexión y consolidación (R)", None,
     [
        "Se reúne al grupo y se pregunta qué figura les costó más armar y por qué, y cuántas estrellas consiguieron.",
        "Se anticipa que en las próximas clases seguirán completando el Diario del Explorador de Worky con más misiones y mundos.",
        "DUA 9.3 – Implicación: cierre con una reflexión sobre la Prudencia, virtud de la Unidad 1 — así como hay que observar bien la silueta antes de mover las piezas, la Prudencia enseña a pensar con calma antes de actuar.",
     ]),
]

recursos_grupos = [
    ("Humanos", ["Estudiantes y docente."]),
    ("Materiales", ["Las 7 piezas del tangram Virtus impresas en 3D (una por estudiante o por pareja)."]),
    ("Recursos tecnológicos", ["Computador o tablet con acceso a la plataforma Virtus y al juego RoboTangram — Misión Selva.",
                                "Conexión a internet."]),
]

evaluacion_items = [
    ("Técnica:", "Observación directa durante el juego."),
    ("Instrumento:", "Lista de cotejo."),
    [
        "Identifica y nombra las piezas del tangram por su forma (triángulo, cuadrado, paralelogramo).",
        "Arma correctamente al menos una figura del Mundo 1 · Selva, guiándose por la silueta.",
        "Participa activamente y respeta el turno de sus compañeros al usar el material.",
    ]
]

adaptaciones = [
    ("GRADO 1", "De acceso",
     "Modificaciones en el entorno físico, materiales y estrategias de presentación para garantizar el acceso equitativo, sin alterar los contenidos.",
     ["Ubicar al estudiante en un espacio con buena visión de la pantalla y las piezas.",
      "Permitir manipular las piezas libremente antes de empezar el reto, sin límite de tiempo.",
      "Usar piezas de tangram de mayor tamaño si el estudiante tiene dificultad motriz fina."]),
    ("GRADO 2", "No significativas",
     "Ajustes metodológicos y de evaluación que no modifican el objetivo esencial, pero sí su forma de presentación o desarrollo.",
     ["Aplicar todas las estrategias del Grado de Acceso.",
      "Reducir la meta a una sola figura del nivel Fácil, en lugar de varias.",
      "Evaluación diferenciada: valorar el intento y la actitud por sobre la cantidad de figuras logradas."]),
    ("GRADO 3", "Significativas",
     "Modificaciones sustanciales en objetivos, metodología y evaluación, adaptadas al perfil y ritmo del estudiante.",
     ["Aplicar las indicaciones del informe psicopedagógico del estudiante (DECE / UDAI).",
      "Ajustar el objetivo a un nivel funcional (por ejemplo: identificar y nombrar una pieza cuando se le muestre).",
      "Establecer criterios de evaluación alternativos, valorando el progreso individual y la participación."]),
]

horas_acompanamiento = (
    "Los estudiantes que lo necesiten repasarán, en grupos pequeños, el nombre y la forma de cada pieza del tangram, con apoyo directo del docente.",
    ["Modelado paso a paso por el docente, armando la figura junto al estudiante.",
     "Trabajo cooperativo en parejas para practicar antes de intentarlo solos.",
     "Retroalimentación inmediata y positiva durante cada intento."],
    ["Observación de la figura armada por el estudiante.",
     "Diálogo guiado: nombrar cada pieza usada y cuántos lados tiene.",
     "Autoevaluación con escala de estrellas (de 1 a 3) sobre su manejo del reto."]
)

build(
    output_path=os.path.join(os.path.dirname(__file__), 'Virtus_3EGB_Clase04_TangramVirtus_Planificacion.pdf'),
    codigo='VST-STEAM-3EGB-04',
    fecha='00-00-0000',
    area='CIENCIA, TECNOLOGÍA Y DISEÑO (STEAM)',
    asignatura='ROBÓTICA EDUCATIVA — TANGRAM: PATRONES CON ROTACIÓN Y REFLEJO',
    docente='[Nombre del Docente]',
    anio_lectivo='2026 - 2027',
    grado='TERCER AÑO DE EDUCACIÓN GENERAL BÁSICA',
    semana='4',
    fecha_inicio='[dd-mm-aaaa]',
    fecha_fin='[dd-mm-aaaa]',
    titulo_unidad='Tangram: patrones con rotación y reflejo',
    subtitulo_unidad='Unidad 1 — Prudencia',
    objetivos_clase=(
        "Identificar los atributos de las figuras geométricas (número de lados y forma) manipulando las 7 piezas "
        "del tangram Virtus impresas en 3D; armar figuras guiándose por una silueta, tanto de forma física como en "
        "el juego RoboTangram — Misión Selva de la plataforma; y registrar el avance en el Diario del Explorador "
        "de Worky."
    ),
    destreza_codigo='M.2.1.2 (en desarrollo)',
    destreza_texto=(
        "Describir y reproducir patrones de objetos y figuras basándose en sus atributos, armando figuras con las "
        "7 piezas del tangram Virtus impresas en 3D y en el juego RoboTangram — Misión Selva de la plataforma."
    ),
    dua_linea='Código DUA (CAST / EDUCADUA): Representación (pautas 1–2) · Acción y Expresión (pauta 5) · Implicación (pautas 7–9)',
    erca_items=erca_items,
    recursos_grupos=recursos_grupos,
    aplicacion_texto=(
        "Se busca que los estudiantes reconozcan, de forma concreta y manipulativa, que toda figura se puede "
        "describir por sus atributos (número de lados, forma y tamaño) y que combinando piezas simples se pueden "
        "construir figuras nuevas. El juego RoboTangram — Misión Selva refuerza este aprendizaje dándole un "
        "propósito narrativo: ayudar a Worky a completar su Diario del Explorador."
    ),
    evaluacion_items=evaluacion_items,
    adaptaciones=adaptaciones,
    horas_acompanamiento=horas_acompanamiento,
    footer_materia='Tangram Virtus',
    footer_grado='Tercer Año EGB',
)
