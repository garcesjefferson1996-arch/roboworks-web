const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { Grade, GradeLesson, LessonResource } = require('../models/Curriculum');
const { uploadMaterial } = require('../config/cloudinary');
const { logAction } = require('../utils/audit');

router.use(authMiddleware);

// Estructura fija del "paso a paso metodologico" de cada clase (17 puntos).
// El admin llena el contenido de cada paso; las etiquetas son fijas para
// que toda clase de Virtus siga la misma guia pedagogica.
const PASO_A_PASO_STEPS = [
    { key: 'bienvenida', label: 'Bienvenida' },
    { key: 'motivacion', label: 'Motivación' },
    { key: 'preguntas_iniciales', label: 'Preguntas iniciales' },
    { key: 'explicacion_teorica', label: 'Explicación teórica' },
    { key: 'analogias', label: 'Analogías para explicar el concepto' },
    { key: 'construccion_robot', label: 'Construcción del robot' },
    { key: 'conexiones_electronicas', label: 'Conexiones electrónicas' },
    { key: 'programacion', label: 'Programación' },
    { key: 'pruebas', label: 'Pruebas' },
    { key: 'posibles_errores', label: 'Posibles errores' },
    { key: 'como_solucionarlos', label: 'Cómo solucionarlos' },
    { key: 'preguntas_estudiantes', label: 'Preguntas para los estudiantes' },
    { key: 'actividad_practica', label: 'Actividad práctica' },
    { key: 'proyecto_final', label: 'Proyecto final' },
    { key: 'evaluacion_paso', label: 'Evaluación' },
    { key: 'cierre_clase', label: 'Cierre de la clase' },
    { key: 'reflexion', label: 'Reflexión' }
];
const PASO_A_PASO_KEYS = PASO_A_PASO_STEPS.map(s => s.key);

// Campos de planificacion estructurada que deben llegar como array de
// strings (objetivos, competencias, etc). Valida forma sin ser demasiado
// estricto en el contenido (texto libre por item).
const ARRAY_PLAN_FIELDS = [
    'objetivos', 'competencias', 'destrezas', 'indicadores_evaluacion',
    'recursos_necesarios', 'materiales', 'kits', 'software_requerido'
];

function validateStructuredPlanFields(body) {
    for (const field of ARRAY_PLAN_FIELDS) {
        const value = body[field];
        if (value === undefined || value === null) continue;
        if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
            return `El campo "${field}" debe ser una lista de texto`;
        }
    }
    if (body.paso_a_paso !== undefined && body.paso_a_paso !== null) {
        if (typeof body.paso_a_paso !== 'object' || Array.isArray(body.paso_a_paso)) {
            return 'El paso a paso debe ser un objeto con las 17 etapas';
        }
        for (const key of Object.keys(body.paso_a_paso)) {
            if (!PASO_A_PASO_KEYS.includes(key)) {
                return `Etapa de paso a paso desconocida: ${key}`;
            }
            if (typeof body.paso_a_paso[key] !== 'string') {
                return `El contenido de la etapa "${key}" debe ser texto`;
            }
        }
    }
    return null;
}

// Lectura: super_admin y academy_admin (necesitan ver el catálogo para
// escoger el grado al crear una clase). Escritura: solo super_admin - el
// currículo es de Virtus, no de una institución individual (ver misma regla
// que ya aplicamos a "programs").
const readAccess = requireRole('super_admin', 'academy_admin');
const writeAccess = requireRole('super_admin');

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Demasiadas subidas en poco tiempo. Espera unos minutos.' }
});

// ============================================
// GRADOS
// ============================================

router.get('/paso-a-paso-steps', readAccess, (req, res) => {
    res.json({ steps: PASO_A_PASO_STEPS });
});

router.get('/grades', readAccess, async (req, res) => {
    try {
        const grades = await Grade.getAll();
        res.json(grades);
    } catch (error) {
        console.error('Error al obtener grados:', error.message);
        res.status(500).json({ message: 'Error al obtener grados' });
    }
});

router.post('/grades', writeAccess, [body('name').trim().notEmpty()], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { name, display_order, description } = req.body;
        const id = await Grade.create({ name, display_order, description });

        await logAction({
            actorId: req.user.id, actorRole: req.user.role,
            action: 'grade_created', targetType: 'grade', targetId: id, metadata: { name }, ip: req.ip
        });

        res.status(201).json({ message: 'Grado creado exitosamente', id });
    } catch (error) {
        console.error('Error al crear grado:', error.message);
        res.status(500).json({ message: 'Error al crear el grado' });
    }
});

// ============================================
// LECCIONES DEL AÑO (por grado)
// ============================================

router.get('/grades/:gradeId/lessons', readAccess, async (req, res) => {
    try {
        const grade = await Grade.getById(req.params.gradeId);
        if (!grade) return res.status(404).json({ message: 'Grado no encontrado' });

        const lessons = await GradeLesson.getByGrade(req.params.gradeId, true);
        for (const lesson of lessons) {
            lesson.resources = await LessonResource.getByLesson(lesson.id);
        }
        res.json({ grade, lessons });
    } catch (error) {
        console.error('Error al obtener lecciones:', error.message);
        res.status(500).json({ message: 'Error al obtener las lecciones' });
    }
});

const lessonValidation = [
    body('lesson_number').isInt({ min: 1 }).withMessage('El número de lección debe ser un entero positivo'),
    body('title').trim().notEmpty().withMessage('El título es requerido'),
    body('trimester').optional({ checkFalsy: true }).isInt({ min: 1, max: 3 }).withMessage('La unidad debe ser 1, 2 o 3'),
    body('video_link').optional({ checkFalsy: true }).trim().matches(/^https?:\/\//i)
        .withMessage('El link de video debe empezar con http:// o https://')
];

router.post('/grades/:gradeId/lessons', writeAccess, lessonValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const grade = await Grade.getById(req.params.gradeId);
        if (!grade) return res.status(404).json({ message: 'Grado no encontrado' });

        const planError = validateStructuredPlanFields(req.body);
        if (planError) return res.status(400).json({ message: planError });

        const {
            lesson_number, trimester, title, description, lesson_plan, video_link,
            objetivos, competencias, destrezas, indicadores_evaluacion, tiempo_estimado,
            recursos_necesarios, materiales, kits, software_requerido,
            actividades, proyecto_descripcion, evaluacion_descripcion, tarea_descripcion, paso_a_paso
        } = req.body;
        const id = await GradeLesson.create({
            grade_id: req.params.gradeId, lesson_number, trimester, title, description, lesson_plan, video_link,
            objetivos, competencias, destrezas, indicadores_evaluacion, tiempo_estimado,
            recursos_necesarios, materiales, kits, software_requerido,
            actividades, proyecto_descripcion, evaluacion_descripcion, tarea_descripcion, paso_a_paso
        });

        await logAction({
            actorId: req.user.id, actorRole: req.user.role,
            action: 'lesson_created', targetType: 'grade_lesson', targetId: id,
            metadata: { grade_id: req.params.gradeId, title }, ip: req.ip
        });

        res.status(201).json({ message: 'Lección creada exitosamente', id });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Ya existe una lección con ese número en este grado' });
        }
        console.error('Error al crear lección:', error.message);
        res.status(500).json({ message: 'Error al crear la lección' });
    }
});

router.put('/lessons/:lessonId', writeAccess, async (req, res) => {
    try {
        const {
            title, description, lesson_plan, video_link, lesson_number, trimester, is_active,
            objetivos, competencias, destrezas, indicadores_evaluacion, tiempo_estimado,
            recursos_necesarios, materiales, kits, software_requerido,
            actividades, proyecto_descripcion, evaluacion_descripcion, tarea_descripcion, paso_a_paso
        } = req.body;
        if (video_link && !/^https?:\/\//i.test(video_link)) {
            return res.status(400).json({ message: 'El link de video debe empezar con http:// o https://' });
        }
        if (trimester !== undefined && trimester !== null && trimester !== '' && ![1, 2, 3].includes(parseInt(trimester))) {
            return res.status(400).json({ message: 'La unidad debe ser 1, 2 o 3' });
        }
        const planError = validateStructuredPlanFields(req.body);
        if (planError) return res.status(400).json({ message: planError });

        const updated = await GradeLesson.update(req.params.lessonId, {
            title, description, lesson_plan, video_link, lesson_number, trimester, is_active,
            objetivos, competencias, destrezas, indicadores_evaluacion, tiempo_estimado,
            recursos_necesarios, materiales, kits, software_requerido,
            actividades, proyecto_descripcion, evaluacion_descripcion, tarea_descripcion, paso_a_paso
        });
        if (!updated) return res.status(404).json({ message: 'Lección no encontrada' });
        res.json({ message: 'Lección actualizada' });
    } catch (error) {
        console.error('Error al actualizar lección:', error.message);
        res.status(500).json({ message: 'Error al actualizar la lección' });
    }
});

// ============================================
// PDF DE PLANIFICACION (archivo aparte del texto de lesson_plan y de los
// recursos sueltos; pensado para que el docente lo descargue directo).
// ============================================

router.post('/lessons/:lessonId/plan-file', writeAccess, uploadLimiter, uploadMaterial.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No se subió ningún archivo' });

        const lesson = await GradeLesson.getById(req.params.lessonId);
        if (!lesson) return res.status(404).json({ message: 'Lección no encontrada' });

        await GradeLesson.setPlanFile(req.params.lessonId, {
            file_url: req.file.path,
            file_name: req.file.originalname
        });

        await logAction({
            actorId: req.user.id, actorRole: req.user.role,
            action: 'lesson_plan_file_uploaded', targetType: 'grade_lesson', targetId: req.params.lessonId,
            metadata: { file_name: req.file.originalname }, ip: req.ip
        });

        res.status(201).json({
            message: 'Planificación subida exitosamente',
            file_url: req.file.path,
            file_name: req.file.originalname
        });
    } catch (error) {
        console.error('Error al subir la planificación:', error.message);
        res.status(500).json({ message: 'Error al subir la planificación' });
    }
});

// Imagen suelta para insertar dentro del texto de "planificacion completa"
// (lesson_plan) como markdown ![](url) - no se guarda nada en la BD aqui,
// el admin la inserta en el textarea y se persiste junto con el resto del
// texto cuando guarda la leccion (PUT /lessons/:lessonId).
router.post('/lessons/:lessonId/plan-image', writeAccess, uploadLimiter, uploadMaterial.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No se subió ninguna imagen' });
        if (!req.file.mimetype?.startsWith('image/')) {
            return res.status(400).json({ message: 'El archivo debe ser una imagen' });
        }

        const lesson = await GradeLesson.getById(req.params.lessonId);
        if (!lesson) return res.status(404).json({ message: 'Lección no encontrada' });

        res.status(201).json({
            message: 'Imagen subida exitosamente',
            url: req.file.path,
            name: req.file.originalname
        });
    } catch (error) {
        console.error('Error al subir imagen de planificación:', error.message);
        res.status(500).json({ message: 'Error al subir la imagen' });
    }
});

router.delete('/lessons/:lessonId/plan-file', writeAccess, async (req, res) => {
    try {
        const lesson = await GradeLesson.getById(req.params.lessonId);
        if (!lesson) return res.status(404).json({ message: 'Lección no encontrada' });

        await GradeLesson.removePlanFile(req.params.lessonId);
        res.json({ message: 'Planificación en PDF eliminada' });
    } catch (error) {
        console.error('Error al eliminar la planificación:', error.message);
        res.status(500).json({ message: 'Error al eliminar la planificación' });
    }
});

router.delete('/lessons/:lessonId', writeAccess, async (req, res) => {
    try {
        const deleted = await GradeLesson.delete(req.params.lessonId);
        if (!deleted) return res.status(404).json({ message: 'Lección no encontrada' });

        await logAction({
            actorId: req.user.id, actorRole: req.user.role,
            action: 'lesson_deleted', targetType: 'grade_lesson', targetId: req.params.lessonId, ip: req.ip
        });

        res.json({ message: 'Lección eliminada' });
    } catch (error) {
        console.error('Error al eliminar lección:', error.message);
        res.status(500).json({ message: 'Error al eliminar la lección' });
    }
});

// ============================================
// RECURSOS DE UNA LECCIÓN (imágenes, archivos, links)
// ============================================

router.post('/lessons/:lessonId/resources/upload', writeAccess, uploadLimiter, uploadMaterial.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No se subió ningún archivo' });

        const { title } = req.body;
        if (!title) return res.status(400).json({ message: 'El título es requerido' });

        const lesson = await GradeLesson.getById(req.params.lessonId);
        if (!lesson) return res.status(404).json({ message: 'Lección no encontrada' });

        const isImage = req.file.mimetype?.startsWith('image/');
        const id = await LessonResource.create({
            lesson_id: req.params.lessonId,
            title,
            resource_type: isImage ? 'image' : 'file',
            file_url: req.file.path,
            file_name: req.file.originalname
        });

        res.status(201).json({ message: 'Recurso subido exitosamente', id });
    } catch (error) {
        console.error('Error al subir recurso:', error.message);
        res.status(500).json({ message: 'Error al subir el recurso' });
    }
});

router.post('/lessons/:lessonId/resources', writeAccess, [
    body('title').trim().notEmpty(),
    body('external_link').trim().notEmpty().matches(/^https?:\/\//i)
        .withMessage('El link debe empezar con http:// o https://')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const lesson = await GradeLesson.getById(req.params.lessonId);
        if (!lesson) return res.status(404).json({ message: 'Lección no encontrada' });

        const { title, external_link } = req.body;
        const id = await LessonResource.create({
            lesson_id: req.params.lessonId, title, resource_type: 'link', external_link
        });

        res.status(201).json({ message: 'Recurso agregado exitosamente', id });
    } catch (error) {
        console.error('Error al agregar recurso:', error.message);
        res.status(500).json({ message: 'Error al agregar el recurso' });
    }
});

router.delete('/resources/:resourceId', writeAccess, async (req, res) => {
    try {
        const deleted = await LessonResource.delete(req.params.resourceId);
        if (!deleted) return res.status(404).json({ message: 'Recurso no encontrado' });
        res.json({ message: 'Recurso eliminado' });
    } catch (error) {
        console.error('Error al eliminar recurso:', error.message);
        res.status(500).json({ message: 'Error al eliminar el recurso' });
    }
});

module.exports = router;
