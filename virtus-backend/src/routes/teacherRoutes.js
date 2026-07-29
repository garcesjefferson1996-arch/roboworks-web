const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { requireRole, requireAdminOrOwningTeacher, teacherOwnsClass } = require('../middleware/roles');
const User = require('../models/User');
const { ClassMaterial, MaterialCategory } = require('../models/ClassMaterial');
const { getLessonsForClass, Grade, GradeLesson, LessonResource } = require('../models/Curriculum');
const { Task, TaskSubmission } = require('../models/Task');
const { uploadMaterial } = require('../config/cloudinary');
const { logAction } = require('../utils/audit');
const Notification = require('../models/Notification');
const Attendance = require('../models/Attendance');
const TeacherSummary = require('../models/TeacherSummary');

router.use(authMiddleware);
router.use(requireRole('teacher'));

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Demasiadas subidas en poco tiempo. Espera unos minutos.' }
});

router.get('/dashboard', async (req, res) => {
    try {
        const [teacher] = await db.pool.query(
            'SELECT id, username, full_name, profile_photo FROM users WHERE id = ? AND role = "teacher"',
            [req.user.id]
        );
        if (teacher.length === 0) {
            return res.status(404).json({ message: 'Docente no encontrado' });
        }

        const classes = await User.getTeacherClasses(req.user.id);
        res.json({ teacher: teacher[0], classes });
    } catch (error) {
        console.error('Error en dashboard de docente:', error.message);
        res.status(500).json({ message: 'Error al obtener el panel del docente' });
    }
});

// ============================================
// RESUMEN (pantalla de inicio: lo urgente de un vistazo)
// ============================================

router.get('/summary', async (req, res) => {
    try {
        const summary = await TeacherSummary.getSummary(req.user.id);
        res.json(summary);
    } catch (error) {
        console.error('Error al obtener el resumen del docente:', error.message);
        res.status(500).json({ message: 'Error al obtener el resumen' });
    }
});

// ============================================
// GRADOS (navegacion principal: el docente entra por grado, ve las
// lecciones del ano completas, y desde ahi elige el paralelo/clase puntual
// para asistencia, calificaciones, roster o tareas de ese grupo).
// ============================================

router.get('/grades', async (req, res) => {
    try {
        const grades = await User.getTeacherGradesOverview(req.user.id);
        res.json(grades);
    } catch (error) {
        console.error('Error al obtener grados del docente:', error.message);
        res.status(500).json({ message: 'Error al obtener tus grados' });
    }
});

router.get('/grades/:gradeId/lessons', async (req, res) => {
    try {
        const gradeId = req.params.gradeId;
        const hasGrade = await User.teacherHasGrade(req.user.id, gradeId);
        if (!hasGrade) {
            return res.status(403).json({ message: 'No tienes acceso a este grado' });
        }

        const grade = await Grade.getById(gradeId);
        if (!grade) return res.status(404).json({ message: 'Grado no encontrado' });

        const lessons = await GradeLesson.getByGrade(gradeId, false);
        for (const lesson of lessons) {
            lesson.resources = await LessonResource.getByLesson(lesson.id);
        }

        res.json({ grade, lessons });
    } catch (error) {
        console.error('Error al obtener lecciones del grado:', error.message);
        res.status(500).json({ message: 'Error al obtener las lecciones' });
    }
});

router.get('/classes/:classId/students', requireAdminOrOwningTeacher('classId'), async (req, res) => {
    try {
        const students = await User.getClassStudents(req.params.classId);
        res.json(students);
    } catch (error) {
        console.error('Error al obtener estudiantes:', error.message);
        res.status(500).json({ message: 'Error al obtener estudiantes' });
    }
});

router.get('/classes/:classId/lessons', requireAdminOrOwningTeacher('classId'), async (req, res) => {
    try {
        const result = await getLessonsForClass(req.params.classId);
        res.json(result);
    } catch (error) {
        console.error('Error al obtener lecciones:', error.message);
        res.status(500).json({ message: 'Error al obtener las lecciones' });
    }
});

router.get('/classes/:classId/materials', requireAdminOrOwningTeacher('classId'), async (req, res) => {
    try {
        const { classId } = req.params;
        const materials = await ClassMaterial.getByClass(classId, true);
        const categories = await MaterialCategory.getByClass(classId);
        res.json({ materials, categories });
    } catch (error) {
        console.error('Error al obtener materiales:', error.message);
        res.status(500).json({ message: 'Error al obtener materiales' });
    }
});

const materialValidation = [
    body('class_id').isInt().withMessage('class_id invalido'),
    body('title').trim().notEmpty().withMessage('El titulo es requerido')
];

router.post(
    '/materials/upload',
    uploadLimiter,
    requireAdminOrOwningTeacher('class_id'),
    uploadMaterial.single('file'),
    materialValidation,
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            if (!req.file) {
                return res.status(400).json({ message: 'No se subio ningun archivo' });
            }

            const { class_id, title, description, is_guide } = req.body;

            let category_id = req.body.category_id || null;
            if (is_guide === 'true' || is_guide === true) {
                category_id = await MaterialCategory.ensureGuideCategory(class_id);
            }

            const materialId = await ClassMaterial.create({
                class_id,
                category_id,
                title,
                description,
                material_type: 'file',
                file_url: req.file.path,
                file_name: req.file.originalname,
                file_size: req.file.size,
                uploaded_by: req.user.id
            });

            const material = await ClassMaterial.getById(materialId);
            res.status(201).json({ message: 'Material subido exitosamente', material });
        } catch (error) {
            console.error('Error al subir material:', error.message);
            res.status(500).json({ message: 'Error al subir el material' });
        }
    }
);

router.post('/materials/link', requireAdminOrOwningTeacher('class_id'), materialValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { class_id, title, description, external_link, category_id } = req.body;
        if (!external_link) {
            return res.status(400).json({ message: 'external_link es requerido' });
        }
        if (!/^https?:\/\//i.test(external_link)) {
            return res.status(400).json({ message: 'El link debe empezar con http:// o https://' });
        }

        const materialId = await ClassMaterial.create({
            class_id,
            category_id: category_id || null,
            title,
            description,
            material_type: 'link',
            external_link,
            uploaded_by: req.user.id
        });

        const material = await ClassMaterial.getById(materialId);
        res.status(201).json({ message: 'Recurso agregado exitosamente', material });
    } catch (error) {
        console.error('Error al agregar recurso:', error.message);
        res.status(500).json({ message: 'Error al agregar el recurso' });
    }
});

// ============================================
// TAREAS
// ============================================

async function assertOwnsClass(req, classId) {
    const [rows] = await db.pool.query('SELECT teacher_id, grade_id FROM classes WHERE id = ?', [classId]);
    if (rows.length === 0) return false;
    return teacherOwnsClass(req.user.id, rows[0]);
}

router.get('/classes/:classId/tasks', requireAdminOrOwningTeacher('classId'), async (req, res) => {
    try {
        const tasks = await Task.getByClass(req.params.classId, true);
        res.json(tasks);
    } catch (error) {
        console.error('Error al obtener tareas:', error.message);
        res.status(500).json({ message: 'Error al obtener tareas' });
    }
});

const taskValidation = [
    body('title').trim().notEmpty().withMessage('El titulo es requerido'),
    body('due_date').optional({ checkFalsy: true }).isISO8601().withMessage('Fecha limite invalida'),
    body('max_score').optional().isFloat({ min: 1, max: 100 })
];

router.post('/classes/:classId/tasks', requireAdminOrOwningTeacher('classId'), taskValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { classId } = req.params;
        const { title, description, due_date, max_score } = req.body;

        const taskId = await Task.create({
            class_id: classId, title, description, due_date, max_score, created_by: req.user.id
        });

        await logAction({
            actorId: req.user.id, actorRole: 'teacher',
            action: 'task_created', targetType: 'task', targetId: taskId,
            metadata: { class_id: classId, title }, ip: req.ip
        });

        try {
            const [enrolled] = await db.pool.query(
                'SELECT student_id FROM class_students WHERE class_id = ?', [classId]
            );
            await Notification.createMany(enrolled.map(row => ({
                user_id: row.student_id,
                type: 'task_created',
                message: `Nueva tarea: "${title}"`,
                related_type: 'task',
                related_id: taskId
            })));
        } catch (notifyError) {
            console.error('No se pudo notificar la tarea nueva:', notifyError.message);
        }

        res.status(201).json({ message: 'Tarea creada exitosamente', id: taskId });
    } catch (error) {
        console.error('Error al crear tarea:', error.message);
        res.status(500).json({ message: 'Error al crear la tarea' });
    }
});

router.delete('/tasks/:taskId', async (req, res) => {
    try {
        const classId = await Task.getClassId(req.params.taskId);
        if (classId === null) return res.status(404).json({ message: 'Tarea no encontrada' });
        if (!(await assertOwnsClass(req, classId))) {
            return res.status(403).json({ message: 'No eres el docente de esta clase' });
        }

        const deleted = await Task.delete(req.params.taskId);
        if (!deleted) return res.status(404).json({ message: 'Tarea no encontrada' });
        res.json({ message: 'Tarea eliminada' });
    } catch (error) {
        console.error('Error al eliminar tarea:', error.message);
        res.status(500).json({ message: 'Error al eliminar la tarea' });
    }
});

router.get('/tasks/:taskId/submissions', async (req, res) => {
    try {
        const classId = await Task.getClassId(req.params.taskId);
        if (classId === null) return res.status(404).json({ message: 'Tarea no encontrada' });
        if (!(await assertOwnsClass(req, classId))) {
            return res.status(403).json({ message: 'No eres el docente de esta clase' });
        }

        const submissions = await TaskSubmission.getByTask(req.params.taskId);
        res.json(submissions);
    } catch (error) {
        console.error('Error al obtener entregas:', error.message);
        res.status(500).json({ message: 'Error al obtener las entregas' });
    }
});

const gradeValidation = [
    body('score').isFloat({ min: 0 }).withMessage('La nota debe ser un numero valido'),
    body('teacher_feedback').optional({ checkFalsy: true }).trim()
];

router.put('/submissions/:submissionId/grade', gradeValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const owner = await TaskSubmission.getOwnerTaskAndClass(req.params.submissionId);
        if (!owner) return res.status(404).json({ message: 'Entrega no encontrada' });
        if (!(await assertOwnsClass(req, owner.class_id))) {
            return res.status(403).json({ message: 'No eres el docente de esta clase' });
        }

        const { score, teacher_feedback } = req.body;
        await TaskSubmission.grade(req.params.submissionId, { score, teacher_feedback, graded_by: req.user.id });

        await logAction({
            actorId: req.user.id, actorRole: 'teacher',
            action: 'submission_graded', targetType: 'task_submission', targetId: req.params.submissionId,
            metadata: { score }, ip: req.ip
        });

        try {
            const task = await Task.getById(owner.task_id);
            await Notification.create({
                user_id: owner.student_id,
                type: 'submission_graded',
                message: `Tu entrega de "${task ? task.title : 'una tarea'}" fue calificada: ${score}`,
                related_type: 'task_submission',
                related_id: req.params.submissionId
            });
        } catch (notifyError) {
            console.error('No se pudo notificar la calificacion:', notifyError.message);
        }

        res.json({ message: 'Entrega calificada' });
    } catch (error) {
        console.error('Error al calificar entrega:', error.message);
        res.status(500).json({ message: 'Error al calificar la entrega' });
    }
});

// ============================================
// ASISTENCIA
// ============================================

const attendanceValidation = [
    body('date').isISO8601().withMessage('Fecha invalida'),
    body('records').isArray({ min: 1 }).withMessage('Se requiere al menos un registro')
];

router.get('/classes/:classId/attendance', requireAdminOrOwningTeacher('classId'), async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ message: 'Se requiere el parametro date (YYYY-MM-DD)' });
        }

        const students = await User.getClassStudents(req.params.classId);
        const existing = await Attendance.getByClassAndDate(req.params.classId, date);
        const byStudent = {};
        existing.forEach(row => { byStudent[row.student_id] = row; });

        const roster = students.map(s => ({
            student_id: s.id,
            full_name: s.full_name,
            status: byStudent[s.id]?.status || null,
            notes: byStudent[s.id]?.notes || null
        }));

        res.json({ date, roster });
    } catch (error) {
        console.error('Error al obtener asistencia:', error.message);
        res.status(500).json({ message: 'Error al obtener la asistencia' });
    }
});

router.post('/classes/:classId/attendance', requireAdminOrOwningTeacher('classId'), attendanceValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { classId } = req.params;
        const { date, records } = req.body;

        const validStatuses = ['present', 'absent', 'late', 'excused'];
        const clean = records
            .filter(r => r && r.student_id && validStatuses.includes(r.status))
            .map(r => ({
                class_id: classId,
                student_id: r.student_id,
                attendance_date: date,
                status: r.status,
                notes: (r.notes || '').slice(0, 255) || null,
                recorded_by: req.user.id
            }));

        if (clean.length === 0) {
            return res.status(400).json({ message: 'No hay registros validos para guardar' });
        }

        await Attendance.upsertMany(clean);

        await logAction({
            actorId: req.user.id, actorRole: 'teacher',
            action: 'attendance_recorded', targetType: 'class', targetId: classId,
            metadata: { date, count: clean.length }, ip: req.ip
        });

        res.json({ message: 'Asistencia guardada exitosamente', count: clean.length });
    } catch (error) {
        console.error('Error al guardar asistencia:', error.message);
        res.status(500).json({ message: 'Error al guardar la asistencia' });
    }
});

router.get('/classes/:classId/attendance/history', requireAdminOrOwningTeacher('classId'), async (req, res) => {
    try {
        const history = await Attendance.getByClass(req.params.classId);
        res.json(history);
    } catch (error) {
        console.error('Error al obtener historial de asistencia:', error.message);
        res.status(500).json({ message: 'Error al obtener el historial de asistencia' });
    }
});

// ============================================
// CALIFICACIONES CONSOLIDADAS (gradebook: estudiantes x tareas)
// ============================================

router.get('/classes/:classId/gradebook', requireAdminOrOwningTeacher('classId'), async (req, res) => {
    try {
        const { classId } = req.params;
        const students = await User.getClassStudents(classId);
        const tasks = await Task.getByClass(classId, false);

        let scoreMap = {};
        if (tasks.length > 0) {
            const taskIds = tasks.map(t => t.id);
            const [rows] = await db.pool.query(
                `SELECT task_id, student_id, score FROM task_submissions WHERE task_id IN (?)`,
                [taskIds]
            );
            rows.forEach(r => { scoreMap[`${r.task_id}_${r.student_id}`] = r.score; });
        }

        const grid = students.map(s => ({
            student_id: s.id,
            full_name: s.full_name,
            scores: tasks.map(t => ({
                task_id: t.id,
                score: scoreMap[`${t.id}_${s.id}`] ?? null
            }))
        }));

        res.json({
            tasks: tasks.map(t => ({ id: t.id, title: t.title, max_score: t.max_score })),
            grid
        });
    } catch (error) {
        console.error('Error al obtener calificaciones:', error.message);
        res.status(500).json({ message: 'Error al obtener las calificaciones' });
    }
});

module.exports = router;
