const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { requireRole, requireAdminOrOwningTeacher } = require('../middleware/roles');
const { MaterialCategory } = require('../models/ClassMaterial');
const { getLessonsForClass } = require('../models/Curriculum');

router.use(authMiddleware);

router.get('/', async (req, res) => {
    try {
        const { role, id: userId, tenant_id } = req.user;
        let query = `
            SELECT c.id, c.name, c.description, c.zoom_link, c.schedule_day, c.schedule_time,
                   c.max_students, c.grade_id, p.name as program_name, cc.name as course_name,
                   u.full_name as teacher_name, g.name as grade_name,
                   (SELECT COUNT(*) FROM class_students WHERE class_id = c.id) as enrolled
            FROM classes c
            LEFT JOIN programs p ON c.program_id = p.id
            LEFT JOIN codeworks_courses cc ON c.codeworks_course_id = cc.id
            LEFT JOIN users u ON c.teacher_id = u.id
            LEFT JOIN grades g ON c.grade_id = g.id
        `;
        const params = [];

        if (role === 'teacher') {
            query += ' WHERE c.teacher_id = ? AND c.is_active = 1';
            params.push(userId);
        } else if (role === 'student') {
            query += ` JOIN class_students cs ON cs.class_id = c.id
                       WHERE cs.student_id = ? AND c.is_active = 1`;
            params.push(userId);
        } else {
            query += ' WHERE c.tenant_id = ? AND c.is_active = 1';
            params.push(tenant_id);
        }

        query += ' ORDER BY FIELD(c.schedule_day, "monday","tuesday","wednesday","thursday","friday","saturday","sunday"), c.schedule_time';

        const [classes] = await db.pool.query(query, params);
        res.json(classes);
    } catch (error) {
        console.error('Error al listar clases:', error.message);
        res.status(500).json({ message: 'Error al obtener clases' });
    }
});

router.get('/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        const { role, id: userId, tenant_id } = req.user;

        const [rows] = await db.pool.query(`
            SELECT c.*, p.name as program_name, cc.name as course_name, u.full_name as teacher_name
            FROM classes c
            LEFT JOIN programs p ON c.program_id = p.id
            LEFT JOIN codeworks_courses cc ON c.codeworks_course_id = cc.id
            LEFT JOIN users u ON c.teacher_id = u.id
            WHERE c.id = ?
        `, [classId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Clase no encontrada' });
        }
        const classRow = rows[0];

        if (role === 'academy_admin' && classRow.tenant_id !== tenant_id) {
            return res.status(403).json({ message: 'No tienes acceso a esta clase' });
        }
        if (role === 'teacher' && classRow.teacher_id !== userId) {
            return res.status(403).json({ message: 'No eres el docente de esta clase' });
        }
        if (role === 'student') {
            const [enrolled] = await db.pool.query(
                'SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ?',
                [classId, userId]
            );
            if (enrolled.length === 0) {
                return res.status(403).json({ message: 'No estas inscrito en esta clase' });
            }
        }

        res.json(classRow);
    } catch (error) {
        console.error('Error al obtener clase:', error.message);
        res.status(500).json({ message: 'Error al obtener la clase' });
    }
});

const createClassValidation = [
    body('name').trim().notEmpty().withMessage('El nombre de la clase es requerido'),
    body('program_id').optional({ checkFalsy: true }).isInt().withMessage('program_id invalido'),
    body('max_students').optional().isInt({ min: 1, max: 500 }),
    body('zoom_link').optional({ checkFalsy: true }).trim().matches(/^https?:\/\//i)
        .withMessage('El link de la clase debe empezar con http:// o https://')
];

router.post('/', requireRole('super_admin', 'academy_admin'), createClassValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { tenant_id } = req.user;
        const {
            program_id, codeworks_course_id, grade_id, name, teacher_id,
            zoom_link, schedule_day, schedule_time, description, max_students = 25
        } = req.body;

        const [result] = await db.pool.query(
            `INSERT INTO classes
                (tenant_id, program_id, codeworks_course_id, grade_id, name, teacher_id,
                 zoom_link, schedule_day, schedule_time, description, max_students)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [tenant_id, program_id || null, codeworks_course_id || null, grade_id || null, name, teacher_id || null,
             zoom_link || null, schedule_day || null, schedule_time || null, description || null, max_students]
        );

        const classId = result.insertId;

        await MaterialCategory.ensureGuideCategory(classId);

        res.status(201).json({ message: 'Clase creada exitosamente', id: classId });
    } catch (error) {
        console.error('Error al crear clase:', error.message);
        res.status(500).json({ message: 'Error al crear la clase' });
    }
});

router.put('/:classId', requireAdminOrOwningTeacher('classId'), async (req, res) => {
    try {
        const { classId } = req.params;
        const { name, zoom_link, schedule_day, schedule_time, description, max_students, teacher_id, grade_id } = req.body;

        if (zoom_link && !/^https?:\/\//i.test(zoom_link)) {
            return res.status(400).json({ message: 'El link de la clase debe empezar con http:// o https://' });
        }

        const isTeacher = req.user.role === 'teacher';

        const [result] = await db.pool.query(
            `UPDATE classes SET
                name = COALESCE(?, name),
                zoom_link = COALESCE(?, zoom_link),
                schedule_day = COALESCE(?, schedule_day),
                schedule_time = COALESCE(?, schedule_time),
                description = COALESCE(?, description),
                max_students = COALESCE(?, max_students)
                ${isTeacher ? '' : ', teacher_id = COALESCE(?, teacher_id), grade_id = COALESCE(?, grade_id)'}
             WHERE id = ?`,
            isTeacher
                ? [name, zoom_link, schedule_day, schedule_time, description, max_students, classId]
                : [name, zoom_link, schedule_day, schedule_time, description, max_students, teacher_id, grade_id, classId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Clase no encontrada' });
        }
        res.json({ message: 'Clase actualizada' });
    } catch (error) {
        console.error('Error al actualizar clase:', error.message);
        res.status(500).json({ message: 'Error al actualizar la clase' });
    }
});

router.get('/:classId/lessons', requireAdminOrOwningTeacher('classId'), async (req, res) => {
    try {
        const result = await getLessonsForClass(req.params.classId);
        res.json(result);
    } catch (error) {
        console.error('Error al obtener lecciones de la clase:', error.message);
        res.status(500).json({ message: 'Error al obtener las lecciones' });
    }
});

router.get('/:classId/students', requireAdminOrOwningTeacher('classId'), async (req, res) => {
    try {
        const [students] = await db.pool.query(`
            SELECT u.id, u.full_name, u.username, u.profile_photo
            FROM users u
            JOIN class_students cs ON u.id = cs.student_id
            WHERE cs.class_id = ?
            ORDER BY u.full_name
        `, [req.params.classId]);
        res.json(students);
    } catch (error) {
        console.error('Error al obtener estudiantes de la clase:', error.message);
        res.status(500).json({ message: 'Error al obtener estudiantes' });
    }
});

module.exports = router;
