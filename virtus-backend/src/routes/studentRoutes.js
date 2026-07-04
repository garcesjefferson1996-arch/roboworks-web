const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { ClassMaterial, MaterialCategory } = require('../models/ClassMaterial');
const { getLessonsForClass } = require('../models/Curriculum');
const { Task, TaskSubmission } = require('../models/Task');
const { uploadMaterial } = require('../config/cloudinary');
const { logAction } = require('../utils/audit');
const Notification = require('../models/Notification');
const Attendance = require('../models/Attendance');

router.use(authMiddleware);
router.use(requireRole('student'));

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Demasiadas subidas en poco tiempo. Espera unos minutos.' }
});

router.get('/profile', async (req, res) => {
    try {
        const [rows] = await db.pool.query(
            `SELECT id, username, full_name, profile_photo, created_at
             FROM users WHERE id = ? AND role = 'student'`,
            [req.user.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error al obtener perfil:', error.message);
        res.status(500).json({ message: 'Error al obtener el perfil' });
    }
});

router.get('/next-class', async (req, res) => {
    try {
        const [rows] = await db.pool.query(`
            SELECT c.id, c.name, c.zoom_link, c.description,
                   p.name as program_name, cc.name as course_name,
                   c.schedule_day, c.schedule_time
            FROM classes c
            JOIN class_students cs ON c.id = cs.class_id
            LEFT JOIN programs p ON c.program_id = p.id
            LEFT JOIN codeworks_courses cc ON c.codeworks_course_id = cc.id
            WHERE cs.student_id = ? AND c.is_active = 1
            ORDER BY FIELD(c.schedule_day, 'monday','tuesday','wednesday','thursday','friday','saturday','sunday'),
                     c.schedule_time
            LIMIT 1
        `, [req.user.id]);

        res.json(rows[0] || null);
    } catch (error) {
        console.error('Error al obtener proxima clase:', error.message);
        res.status(500).json({ message: 'Error al obtener la proxima clase' });
    }
});

router.get('/history', async (req, res) => {
    try {
        const [classes] = await db.pool.query(`
            SELECT c.id, c.name, p.name as program_name, cs.enrolled_at
            FROM classes c
            JOIN class_students cs ON c.id = cs.class_id
            LEFT JOIN programs p ON c.program_id = p.id
            WHERE cs.student_id = ?
            ORDER BY cs.enrolled_at DESC
        `, [req.user.id]);

        const recentMaterials = await ClassMaterial.getRecentByStudent(req.user.id, 10);

        res.json({ classes, recentMaterials });
    } catch (error) {
        console.error('Error al obtener historial:', error.message);
        res.status(500).json({ message: 'Error al obtener el historial' });
    }
});

router.get('/classes', async (req, res) => {
    try {
        const [rows] = await db.pool.query(`
            SELECT c.id, c.name, c.description, c.zoom_link, c.schedule_day, c.schedule_time,
                   p.name as program_name, cc.name as course_name
            FROM classes c
            JOIN class_students cs ON c.id = cs.class_id
            LEFT JOIN programs p ON c.program_id = p.id
            LEFT JOIN codeworks_courses cc ON c.codeworks_course_id = cc.id
            WHERE cs.student_id = ? AND c.is_active = 1
            ORDER BY FIELD(c.schedule_day, 'monday','tuesday','wednesday','thursday','friday','saturday','sunday'),
                     c.schedule_time
        `, [req.user.id]);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener clases del estudiante:', error.message);
        res.status(500).json({ message: 'Error al obtener tus clases' });
    }
});

router.get('/classes/:classId/materials', async (req, res) => {
    try {
        const { classId } = req.params;

        const [enrolled] = await db.pool.query(
            'SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ?',
            [classId, req.user.id]
        );
        if (enrolled.length === 0) {
            return res.status(403).json({ message: 'No estas inscrito en esta clase' });
        }

        const materials = await ClassMaterial.getByClass(classId, false);
        const categories = await MaterialCategory.getByClass(classId);
        res.json({ materials, categories });
    } catch (error) {
        console.error('Error al obtener materiales de la clase:', error.message);
        res.status(500).json({ message: 'Error al obtener los materiales' });
    }
});

router.get('/classes/:classId/lessons', async (req, res) => {
    try {
        const { classId } = req.params;

        const [enrolled] = await db.pool.query(
            'SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ?',
            [classId, req.user.id]
        );
        if (enrolled.length === 0) {
            return res.status(403).json({ message: 'No estas inscrito en esta clase' });
        }

        const result = await getLessonsForClass(classId);
        // La planificacion completa (texto paso a paso + PDF) es material de
        // preparacion para el docente, no contenido del estudiante - se
        // quita explicitamente antes de responder.
        const lessons = (result.lessons || []).map(({ lesson_plan, lesson_plan_file_url, lesson_plan_file_name, ...rest }) => rest);
        res.json({ grade: result.grade, lessons });
    } catch (error) {
        console.error('Error al obtener lecciones de la clase:', error.message);
        res.status(500).json({ message: 'Error al obtener las lecciones' });
    }
});

// ============================================
// TAREAS
// ============================================

async function assertEnrolled(studentId, classId) {
    const [rows] = await db.pool.query(
        'SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ?',
        [classId, studentId]
    );
    return rows.length > 0;
}

// Tareas de una clase, con la entrega propia (si existe) incluida
router.get('/classes/:classId/tasks', async (req, res) => {
    try {
        const { classId } = req.params;
        if (!(await assertEnrolled(req.user.id, classId))) {
            return res.status(403).json({ message: 'No estas inscrito en esta clase' });
        }

        const tasks = await Task.getByClass(classId, false);
        for (const task of tasks) {
            task.my_submission = await TaskSubmission.getByTaskAndStudent(task.id, req.user.id);
        }
        res.json(tasks);
    } catch (error) {
        console.error('Error al obtener tareas:', error.message);
        res.status(500).json({ message: 'Error al obtener tareas' });
    }
});

async function assertCanSubmit(req, res, taskId) {
    const task = await Task.getById(taskId);
    if (!task || !task.is_active) {
        res.status(404).json({ message: 'Tarea no encontrada' });
        return null;
    }
    if (!(await assertEnrolled(req.user.id, task.class_id))) {
        res.status(403).json({ message: 'No estas inscrito en esta clase' });
        return null;
    }
    return task;
}

async function notifyTeacherOfSubmission(task, studentUserId) {
    try {
        const [[classInfo]] = await db.pool.query('SELECT teacher_id FROM classes WHERE id = ?', [task.class_id]);
        if (!classInfo || !classInfo.teacher_id) return;

        const [[student]] = await db.pool.query('SELECT full_name FROM users WHERE id = ?', [studentUserId]);
        const studentName = student ? student.full_name : 'Un estudiante';

        await Notification.create({
            user_id: classInfo.teacher_id,
            type: 'task_submitted',
            message: `${studentName} entrego la tarea "${task.title}"`,
            related_type: 'task',
            related_id: task.id
        });
    } catch (notifyError) {
        console.error('No se pudo notificar la entrega:', notifyError.message);
    }
}

router.post('/tasks/:taskId/submit/upload', uploadLimiter, uploadMaterial.single('file'), async (req, res) => {
    try {
        const task = await assertCanSubmit(req, res, req.params.taskId);
        if (!task) return;
        if (!req.file) {
            return res.status(400).json({ message: 'No se subio ningun archivo' });
        }

        const submissionId = await TaskSubmission.upsert({
            task_id: req.params.taskId,
            student_id: req.user.id,
            submission_type: 'file',
            file_url: req.file.path,
            file_name: req.file.originalname
        });

        await logAction({
            actorId: req.user.id, actorRole: 'student',
            action: 'task_submitted', targetType: 'task_submission', targetId: submissionId,
            metadata: { task_id: req.params.taskId }, ip: req.ip
        });

        await notifyTeacherOfSubmission(task, req.user.id);

        res.status(201).json({ message: 'Entrega subida exitosamente', id: submissionId });
    } catch (error) {
        if (error.code === 'ALREADY_GRADED') {
            return res.status(409).json({ message: error.message });
        }
        console.error('Error al entregar tarea:', error.message);
        res.status(500).json({ message: 'Error al entregar la tarea' });
    }
});

const submitValidation = [
    body('submission_type').isIn(['link', 'text']).withMessage('Tipo de entrega invalido'),
    body('external_link').optional({ checkFalsy: true }).trim().matches(/^https?:\/\//i)
        .withMessage('El link debe empezar con http:// o https://'),
    body('text_content').optional({ checkFalsy: true }).trim()
];

router.post('/tasks/:taskId/submit', submitValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const task = await assertCanSubmit(req, res, req.params.taskId);
        if (!task) return;

        const { submission_type, external_link, text_content } = req.body;
        if (submission_type === 'link' && !external_link) {
            return res.status(400).json({ message: 'external_link es requerido' });
        }
        if (submission_type === 'text' && !text_content) {
            return res.status(400).json({ message: 'text_content es requerido' });
        }

        const submissionId = await TaskSubmission.upsert({
            task_id: req.params.taskId,
            student_id: req.user.id,
            submission_type,
            external_link,
            text_content
        });

        await logAction({
            actorId: req.user.id, actorRole: 'student',
            action: 'task_submitted', targetType: 'task_submission', targetId: submissionId,
            metadata: { task_id: req.params.taskId }, ip: req.ip
        });

        await notifyTeacherOfSubmission(task, req.user.id);

        res.status(201).json({ message: 'Entrega guardada exitosamente', id: submissionId });
    } catch (error) {
        if (error.code === 'ALREADY_GRADED') {
            return res.status(409).json({ message: error.message });
        }
        console.error('Error al entregar tarea:', error.message);
        res.status(500).json({ message: 'Error al entregar la tarea' });
    }
});

// ============================================
// ASISTENCIA (solo lectura, de mi propia clase)
// ============================================

router.get('/classes/:classId/attendance', async (req, res) => {
    try {
        const { classId } = req.params;
        if (!(await assertEnrolled(req.user.id, classId))) {
            return res.status(403).json({ message: 'No estas inscrito en esta clase' });
        }

        const history = await Attendance.getByClassAndStudent(classId, req.user.id);
        const summary = await Attendance.getSummaryForStudent(classId, req.user.id);
        res.json({ history, summary });
    } catch (error) {
        console.error('Error al obtener asistencia:', error.message);
        res.status(500).json({ message: 'Error al obtener la asistencia' });
    }
});

// ============================================
// CALIFICACIONES CONSOLIDADAS (mis notas en esta clase)
// ============================================

router.get('/classes/:classId/grades', async (req, res) => {
    try {
        const { classId } = req.params;
        if (!(await assertEnrolled(req.user.id, classId))) {
            return res.status(403).json({ message: 'No estas inscrito en esta clase' });
        }

        const tasks = await Task.getByClass(classId, false);
        const grades = [];
        for (const t of tasks) {
            const sub = await TaskSubmission.getByTaskAndStudent(t.id, req.user.id);
            grades.push({
                task_id: t.id,
                title: t.title,
                max_score: t.max_score,
                score: sub && sub.score !== null ? sub.score : null,
                graded_at: sub ? sub.graded_at : null
            });
        }

        const graded = grades.filter(g => g.score !== null);
        const average = graded.length > 0
            ? graded.reduce((sum, g) => sum + parseFloat(g.score), 0) / graded.length
            : null;

        res.json({ grades, average, total_tasks: tasks.length, total_graded: graded.length });
    } catch (error) {
        console.error('Error al obtener calificaciones:', error.message);
        res.status(500).json({ message: 'Error al obtener las calificaciones' });
    }
});

module.exports = router;
