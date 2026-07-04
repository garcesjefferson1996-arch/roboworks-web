const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { requireRole, assertSameTenant } = require('../middleware/roles');
const { logAction } = require('../utils/audit');
const { Task, TaskSubmission } = require('../models/Task');
const Attendance = require('../models/Attendance');
const User = require('../models/User');

router.use(authMiddleware);
router.use(requireRole('super_admin', 'academy_admin'));

const accountCreationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Demasiadas cuentas creadas en poco tiempo. Espera unos minutos.' }
});

router.get('/programs', async (req, res) => {
    try {
        const [programs] = await db.pool.query(`
            SELECT p.*, (SELECT COUNT(*) FROM classes WHERE program_id = p.id) as total_classes
            FROM programs p ORDER BY p.id
        `);
        res.json(programs);
    } catch (error) {
        console.error('Error al obtener programas:', error.message);
        res.status(500).json({ message: 'Error al obtener programas' });
    }
});

router.post('/programs', requireRole('super_admin'), [body('name').trim().notEmpty()], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { name, description, icon, color } = req.body;
        const [result] = await db.pool.query(
            'INSERT INTO programs (name, description, icon, color) VALUES (?, ?, ?, ?)',
            [name, description || null, icon || null, color || null]
        );
        res.status(201).json({ message: 'Programa creado exitosamente', id: result.insertId });
    } catch (error) {
        console.error('Error al crear programa:', error.message);
        res.status(500).json({ message: 'Error al crear programa' });
    }
});

router.get('/codeworks-courses', async (req, res) => {
    try {
        const [courses] = await db.pool.query(`
            SELECT c.*, p.name as program_name
            FROM codeworks_courses c JOIN programs p ON c.program_id = p.id
            ORDER BY c.name
        `);
        res.json(courses);
    } catch (error) {
        console.error('Error al obtener cursos:', error.message);
        res.status(500).json({ message: 'Error al obtener cursos' });
    }
});

router.post('/codeworks-courses', requireRole('super_admin'), [body('name').trim().notEmpty(), body('program_id').isInt()], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { name, description, icon, program_id } = req.body;
        const [result] = await db.pool.query(
            'INSERT INTO codeworks_courses (name, description, icon, program_id) VALUES (?, ?, ?, ?)',
            [name, description || null, icon || null, program_id]
        );
        res.status(201).json({ message: 'Curso creado exitosamente', id: result.insertId });
    } catch (error) {
        console.error('Error al crear curso:', error.message);
        res.status(500).json({ message: 'Error al crear curso' });
    }
});

router.get('/teachers', async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const [teachers] = await db.pool.query(`
            SELECT u.id, u.username, u.full_name, u.email, u.profile_photo, u.created_at,
                   (SELECT COUNT(*) FROM classes WHERE teacher_id = u.id AND is_active = 1) as total_classes
            FROM users u
            WHERE u.role = 'teacher' AND u.tenant_id = ?
            ORDER BY u.full_name
        `, [tenant_id]);
        res.json(teachers);
    } catch (error) {
        console.error('Error al obtener docentes:', error.message);
        res.status(500).json({ message: 'Error al obtener docentes' });
    }
});

const createTeacherValidation = [
    body('full_name').trim().notEmpty().withMessage('El nombre es requerido'),
    body('username').trim().isLength({ min: 4 }).withMessage('El usuario debe tener al menos 4 caracteres'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email invalido')
];

router.post('/teachers', accountCreationLimiter, createTeacherValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { tenant_id } = req.user;
        const { full_name, username, email } = req.body;

        const tempPassword = generateTempPassword();
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(tempPassword, salt);

        const [result] = await db.pool.query(
            `INSERT INTO users (tenant_id, username, password_hash, full_name, email, role, temporary_password)
             VALUES (?, ?, ?, ?, ?, 'teacher', TRUE)`,
            [tenant_id, username, password_hash, full_name, email || null]
        );

        await logAction({
            tenantId: tenant_id, actorId: req.user.id, actorRole: req.user.role,
            action: 'teacher_created', targetType: 'user', targetId: result.insertId,
            metadata: { username, full_name }, ip: req.ip
        });

        res.status(201).json({
            message: 'Docente creado exitosamente',
            teacher: { id: result.insertId, username, full_name, temp_password: tempPassword }
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Ese nombre de usuario ya existe' });
        }
        console.error('Error al crear docente:', error.message);
        res.status(500).json({ message: 'Error al crear docente' });
    }
});

router.put('/classes/:classId/teacher', [body('teacher_id').isInt()], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { classId } = req.params;
        const { teacher_id } = req.body;
        const { role, tenant_id } = req.user;

        const [classRows] = await db.pool.query('SELECT tenant_id FROM classes WHERE id = ?', [classId]);
        if (classRows.length === 0) {
            return res.status(404).json({ message: 'Clase no encontrada' });
        }
        if (role !== 'super_admin' && classRows[0].tenant_id !== tenant_id) {
            return res.status(403).json({ message: 'No tienes acceso a esta clase' });
        }

        const [teacher] = await db.pool.query(
            'SELECT id, tenant_id FROM users WHERE id = ? AND role = "teacher"',
            [teacher_id]
        );
        if (teacher.length === 0) {
            return res.status(404).json({ message: 'Docente no encontrado' });
        }
        if (role !== 'super_admin' && teacher[0].tenant_id !== tenant_id) {
            return res.status(403).json({ message: 'El docente no pertenece a tu institucion' });
        }

        await db.pool.query('UPDATE classes SET teacher_id = ? WHERE id = ?', [teacher_id, classId]);

        await logAction({
            tenantId: tenant_id, actorId: req.user.id, actorRole: role,
            action: 'teacher_assigned', targetType: 'class', targetId: classId,
            metadata: { teacher_id }, ip: req.ip
        });

        res.json({ message: 'Docente asignado a la clase' });
    } catch (error) {
        console.error('Error al asignar docente:', error.message);
        res.status(500).json({ message: 'Error al asignar docente' });
    }
});

router.get('/students', async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const [students] = await db.pool.query(`
            SELECT u.id, u.username, u.full_name, u.profile_photo, u.temporary_password,
                   u.invitation_code, u.created_at, u.parent_phone,
                   COUNT(DISTINCT cs.class_id) as total_classes
            FROM users u
            LEFT JOIN class_students cs ON u.id = cs.student_id
            WHERE u.role = 'student' AND u.tenant_id = ?
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `, [tenant_id]);
        res.json(students);
    } catch (error) {
        console.error('Error al obtener estudiantes:', error.message);
        res.status(500).json({ message: 'Error al obtener estudiantes' });
    }
});

const createStudentValidation = [
    body('full_name').trim().notEmpty().withMessage('El nombre es requerido'),
    body('parent_phone').optional({ checkFalsy: true }).trim()
];

router.post('/students', accountCreationLimiter, createStudentValidation, async (req, res) => {
    const connection = await db.pool.getConnection();
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            connection.release();
            return res.status(400).json({ errors: errors.array() });
        }

        const { tenant_id } = req.user;
        const { full_name, class_ids, parent_phone } = req.body;

        const timestamp = Date.now().toString().slice(-6);
        const username = 'est_' + timestamp + Math.floor(Math.random() * 100);
        const tempPassword = generateTempPassword();
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(tempPassword, salt);
        const invitation_code = 'VIRTUS-' + Math.random().toString(36).substring(2, 8).toUpperCase();

        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO users (tenant_id, username, password_hash, full_name, role, temporary_password, invitation_code, parent_phone)
             VALUES (?, ?, ?, ?, 'student', TRUE, ?, ?)`,
            [tenant_id, username, password_hash, full_name, invitation_code, parent_phone || null]
        );
        const studentId = result.insertId;

        const assignedClasses = [];
        if (Array.isArray(class_ids)) {
            for (const classId of class_ids) {
                const [[classInfo]] = await connection.query(`
                    SELECT c.tenant_id, c.max_students, COUNT(cs.student_id) as enrolled
                    FROM classes c
                    LEFT JOIN class_students cs ON c.id = cs.class_id
                    WHERE c.id = ?
                    GROUP BY c.id
                `, [classId]);

                const belongsToSameTenant = classInfo && assertSameTenant(req.user, classInfo.tenant_id);

                if (belongsToSameTenant && classInfo.enrolled < classInfo.max_students) {
                    await connection.query(
                        'INSERT INTO class_students (class_id, student_id) VALUES (?, ?)',
                        [classId, studentId]
                    );
                    assignedClasses.push(classId);
                }
            }
        }

        await connection.commit();

        await logAction({
            tenantId: tenant_id, actorId: req.user.id, actorRole: req.user.role,
            action: 'student_created', targetType: 'user', targetId: studentId,
            metadata: { username, full_name, assigned_classes: assignedClasses }, ip: req.ip
        });

        res.status(201).json({
            message: 'Estudiante creado exitosamente',
            student: {
                id: studentId, username, full_name, invitation_code,
                temp_password: tempPassword,
                parent_phone: parent_phone || null,
                assigned_classes: assignedClasses.length
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al crear estudiante:', error.message);
        res.status(500).json({ message: 'Error al crear estudiante' });
    } finally {
        connection.release();
    }
});

const bulkStudentsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Demasiadas importaciones en poco tiempo. Espera unos minutos.' }
});

// Alta masiva de estudiantes (ej. desde un CSV que el frontend ya parseo a
// un arreglo). Cada fila se procesa igual que POST /students, dentro de una
// sola transaccion - si algo falla a mitad de camino, no queda ningun
// estudiante a medio crear.
router.post('/students/bulk', bulkStudentsLimiter, async (req, res) => {
    const { students } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
        return res.status(400).json({ message: 'Se requiere un arreglo "students" con al menos un estudiante' });
    }
    if (students.length > 300) {
        return res.status(400).json({ message: 'Maximo 300 estudiantes por importacion' });
    }

    const { tenant_id } = req.user;
    const connection = await db.pool.getConnection();
    const results = [];

    try {
        await connection.beginTransaction();

        for (const row of students) {
            const full_name = String(row.full_name || '').trim();
            const parent_phone = String(row.parent_phone || '').trim() || null;
            const class_ids = Array.isArray(row.class_ids) ? row.class_ids : [];

            if (!full_name) {
                results.push({ full_name: row.full_name || '(vacio)', success: false, message: 'El nombre es requerido' });
                continue;
            }
            if (full_name.length > 150) {
                results.push({ full_name, success: false, message: 'Nombre demasiado largo' });
                continue;
            }

            const timestamp = Date.now().toString().slice(-6);
            const username = 'est_' + timestamp + Math.floor(Math.random() * 1000) + results.length;
            const tempPassword = generateTempPassword();
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(tempPassword, salt);
            const invitation_code = 'VIRTUS-' + Math.random().toString(36).substring(2, 8).toUpperCase();

            const [result] = await connection.query(
                `INSERT INTO users (tenant_id, username, password_hash, full_name, role, temporary_password, invitation_code, parent_phone)
                 VALUES (?, ?, ?, ?, 'student', TRUE, ?, ?)`,
                [tenant_id, username, password_hash, full_name, invitation_code, parent_phone]
            );
            const studentId = result.insertId;

            let assignedCount = 0;
            for (const classId of class_ids) {
                const [[classInfo]] = await connection.query(`
                    SELECT c.tenant_id, c.max_students, COUNT(cs.student_id) as enrolled
                    FROM classes c
                    LEFT JOIN class_students cs ON c.id = cs.class_id
                    WHERE c.id = ?
                    GROUP BY c.id
                `, [classId]);

                const belongsToSameTenant = classInfo && assertSameTenant(req.user, classInfo.tenant_id);
                if (belongsToSameTenant && classInfo.enrolled < classInfo.max_students) {
                    await connection.query(
                        'INSERT INTO class_students (class_id, student_id) VALUES (?, ?)',
                        [classId, studentId]
                    );
                    assignedCount++;
                }
            }

            results.push({
                full_name, success: true, username, temp_password: tempPassword,
                invitation_code, assigned_classes: assignedCount
            });
        }

        await connection.commit();

        await logAction({
            tenantId: tenant_id, actorId: req.user.id, actorRole: req.user.role,
            action: 'students_bulk_created', targetType: 'user', targetId: null,
            metadata: { count: results.filter(r => r.success).length, total: students.length }, ip: req.ip
        });

        res.status(201).json({ message: 'Importacion completada', results });
    } catch (error) {
        await connection.rollback();
        console.error('Error en importacion masiva de estudiantes:', error.message);
        res.status(500).json({ message: 'Error al importar estudiantes' });
    } finally {
        connection.release();
    }
});

router.get('/students/:studentId', async (req, res) => {
    try {
        const [student] = await db.pool.query(`
            SELECT id, tenant_id, username, full_name, profile_photo, temporary_password,
                   invitation_code, created_at, parent_phone
            FROM users WHERE id = ? AND role = 'student'
        `, [req.params.studentId]);

        if (student.length === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado' });
        }
        if (!assertSameTenant(req.user, student[0].tenant_id)) {
            return res.status(403).json({ message: 'No tienes acceso a este estudiante' });
        }

        const [classes] = await db.pool.query(`
            SELECT c.id, c.name, p.name as program_name, c.schedule_day, c.schedule_time, c.zoom_link
            FROM classes c
            JOIN class_students cs ON c.id = cs.class_id
            LEFT JOIN programs p ON c.program_id = p.id
            WHERE cs.student_id = ?
            ORDER BY c.schedule_day, c.schedule_time
        `, [req.params.studentId]);

        res.json({ ...student[0], classes });
    } catch (error) {
        console.error('Error al obtener estudiante:', error.message);
        res.status(500).json({ message: 'Error al obtener estudiante' });
    }
});

router.post('/students/:studentId/classes/:classId', async (req, res) => {
    try {
        const { studentId, classId } = req.params;

        const [[classInfo]] = await db.pool.query(`
            SELECT c.tenant_id, c.max_students, COUNT(cs.student_id) as enrolled
            FROM classes c
            LEFT JOIN class_students cs ON c.id = cs.class_id
            WHERE c.id = ?
            GROUP BY c.id
        `, [classId]);

        if (!classInfo) {
            return res.status(404).json({ message: 'Clase no encontrada' });
        }
        if (!assertSameTenant(req.user, classInfo.tenant_id)) {
            return res.status(403).json({ message: 'No tienes acceso a esta clase' });
        }
        if (classInfo.enrolled >= classInfo.max_students) {
            return res.status(400).json({ message: `Cupo completo (maximo ${classInfo.max_students})` });
        }

        const [student] = await db.pool.query(
            'SELECT id, tenant_id FROM users WHERE id = ? AND role = "student"',
            [studentId]
        );
        if (student.length === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado' });
        }
        if (!assertSameTenant(req.user, student[0].tenant_id)) {
            return res.status(403).json({ message: 'El estudiante no pertenece a tu institucion' });
        }

        const [existing] = await db.pool.query(
            'SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ?',
            [classId, studentId]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: 'El estudiante ya esta en esta clase' });
        }

        await db.pool.query('INSERT INTO class_students (class_id, student_id) VALUES (?, ?)', [classId, studentId]);

        await logAction({
            tenantId: req.user.tenant_id, actorId: req.user.id, actorRole: req.user.role,
            action: 'student_enrolled', targetType: 'class', targetId: classId,
            metadata: { studentId }, ip: req.ip
        });

        res.json({ message: 'Estudiante asignado exitosamente' });
    } catch (error) {
        console.error('Error al asignar estudiante:', error.message);
        res.status(500).json({ message: 'Error al asignar estudiante' });
    }
});

router.delete('/students/:studentId/classes/:classId', async (req, res) => {
    try {
        const { studentId, classId } = req.params;

        const [[classInfo]] = await db.pool.query('SELECT tenant_id FROM classes WHERE id = ?', [classId]);
        if (!classInfo) {
            return res.status(404).json({ message: 'Clase no encontrada' });
        }
        if (!assertSameTenant(req.user, classInfo.tenant_id)) {
            return res.status(403).json({ message: 'No tienes acceso a esta clase' });
        }

        await db.pool.query(
            'DELETE FROM class_students WHERE class_id = ? AND student_id = ?',
            [classId, studentId]
        );

        await logAction({
            tenantId: req.user.tenant_id, actorId: req.user.id, actorRole: req.user.role,
            action: 'student_unenrolled', targetType: 'class', targetId: classId,
            metadata: { studentId }, ip: req.ip
        });

        res.json({ message: 'Estudiante removido de la clase' });
    } catch (error) {
        console.error('Error al remover estudiante:', error.message);
        res.status(500).json({ message: 'Error al remover estudiante' });
    }
});

// ============================================
// RESETEO DE CONTRASEÑA (sin infraestructura de correo todavia, el admin
// genera una nueva contrasena temporal y se la comunica manualmente al
// estudiante/docente, igual que al crear la cuenta).
// ============================================

router.post('/students/:studentId/reset-password', accountCreationLimiter, async (req, res) => {
    try {
        const [student] = await db.pool.query(
            'SELECT id, tenant_id, username, full_name FROM users WHERE id = ? AND role = "student"',
            [req.params.studentId]
        );
        if (student.length === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado' });
        }
        if (!assertSameTenant(req.user, student[0].tenant_id)) {
            return res.status(403).json({ message: 'No tienes acceso a este estudiante' });
        }

        const tempPassword = generateTempPassword();
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(tempPassword, salt);

        await db.pool.query(
            `UPDATE users SET password_hash = ?, temporary_password = TRUE,
                failed_login_attempts = 0, locked_until = NULL
             WHERE id = ?`,
            [password_hash, req.params.studentId]
        );

        await logAction({
            tenantId: student[0].tenant_id, actorId: req.user.id, actorRole: req.user.role,
            action: 'password_reset_by_admin', targetType: 'user', targetId: student[0].id,
            metadata: { username: student[0].username }, ip: req.ip
        });

        res.json({
            message: 'Contrasena reseteada exitosamente',
            username: student[0].username,
            temp_password: tempPassword
        });
    } catch (error) {
        console.error('Error al resetear contrasena de estudiante:', error.message);
        res.status(500).json({ message: 'Error al resetear la contrasena' });
    }
});

// ============================================
// EDICION DIRECTA (username, nombre, telefono y opcionalmente una
// contrasena elegida por el admin - distinto del reset a temporal).
// ============================================

const editUserValidation = [
    body('full_name').optional({ checkFalsy: true }).trim().isLength({ min: 2 }).withMessage('Nombre invalido'),
    body('username').optional({ checkFalsy: true }).trim().isLength({ min: 3 }).matches(/^[a-zA-Z0-9._-]+$/)
        .withMessage('Usuario invalido (solo letras, numeros, punto, guion y guion bajo)'),
    body('password').optional({ checkFalsy: true }).isLength({ min: 8 }).withMessage('La contrasena debe tener al menos 8 caracteres'),
    body('parent_phone').optional({ checkFalsy: true }).trim()
];

router.put('/students/:studentId', editUserValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const [student] = await db.pool.query(
            'SELECT id, tenant_id, username FROM users WHERE id = ? AND role = "student"',
            [req.params.studentId]
        );
        if (student.length === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado' });
        }
        if (!assertSameTenant(req.user, student[0].tenant_id)) {
            return res.status(403).json({ message: 'No tienes acceso a este estudiante' });
        }

        const { full_name, username, password, parent_phone } = req.body;

        if (username && username !== student[0].username) {
            const existing = await User.findByUsernameAnyTenant(username);
            if (existing) {
                return res.status(409).json({ message: 'Ese nombre de usuario ya esta en uso' });
            }
        }

        const updated = await User.updateProfile(req.params.studentId, { full_name, username, parent_phone, password });
        if (!updated) {
            return res.status(400).json({ message: 'No se envio ningun campo para actualizar' });
        }

        await logAction({
            tenantId: student[0].tenant_id, actorId: req.user.id, actorRole: req.user.role,
            action: 'student_profile_edited', targetType: 'user', targetId: student[0].id,
            metadata: { username_changed: !!username, password_changed: !!password }, ip: req.ip
        });

        res.json({ message: 'Estudiante actualizado exitosamente', username: username || student[0].username });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Ese nombre de usuario ya esta en uso' });
        }
        console.error('Error al editar estudiante:', error.message);
        res.status(500).json({ message: 'Error al editar el estudiante' });
    }
});

// ============================================
// GRADOS ASIGNADOS A UN DOCENTE (asignacion masiva: el docente ve
// automaticamente todas las clases de esos grados en su institucion).
// ============================================

router.get('/teachers/:teacherId/grades', async (req, res) => {
    try {
        const [teacher] = await db.pool.query(
            'SELECT id, tenant_id FROM users WHERE id = ? AND role = "teacher"',
            [req.params.teacherId]
        );
        if (teacher.length === 0) {
            return res.status(404).json({ message: 'Docente no encontrado' });
        }
        if (!assertSameTenant(req.user, teacher[0].tenant_id)) {
            return res.status(403).json({ message: 'No tienes acceso a este docente' });
        }

        const grades = await User.getTeacherGrades(req.params.teacherId);
        res.json(grades);
    } catch (error) {
        console.error('Error al obtener grados del docente:', error.message);
        res.status(500).json({ message: 'Error al obtener los grados del docente' });
    }
});

router.put('/teachers/:teacherId/grades', [body('grade_ids').isArray().withMessage('grade_ids debe ser un arreglo')], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const [teacher] = await db.pool.query(
            'SELECT id, tenant_id, full_name FROM users WHERE id = ? AND role = "teacher"',
            [req.params.teacherId]
        );
        if (teacher.length === 0) {
            return res.status(404).json({ message: 'Docente no encontrado' });
        }
        if (!assertSameTenant(req.user, teacher[0].tenant_id)) {
            return res.status(403).json({ message: 'No tienes acceso a este docente' });
        }

        await User.setTeacherGrades(req.params.teacherId, teacher[0].tenant_id, req.body.grade_ids);

        await logAction({
            tenantId: teacher[0].tenant_id, actorId: req.user.id, actorRole: req.user.role,
            action: 'teacher_grades_updated', targetType: 'user', targetId: teacher[0].id,
            metadata: { grade_ids: req.body.grade_ids }, ip: req.ip
        });

        const grades = await User.getTeacherGrades(req.params.teacherId);
        res.json({ message: 'Grados actualizados exitosamente', grades });
    } catch (error) {
        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW') {
            return res.status(400).json({ message: 'Uno de los grados enviados no existe' });
        }
        console.error('Error al actualizar grados del docente:', error.message);
        res.status(500).json({ message: 'Error al actualizar los grados del docente' });
    }
});

router.put('/teachers/:teacherId', editUserValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const [teacher] = await db.pool.query(
            'SELECT id, tenant_id, username FROM users WHERE id = ? AND role = "teacher"',
            [req.params.teacherId]
        );
        if (teacher.length === 0) {
            return res.status(404).json({ message: 'Docente no encontrado' });
        }
        if (!assertSameTenant(req.user, teacher[0].tenant_id)) {
            return res.status(403).json({ message: 'No tienes acceso a este docente' });
        }

        const { full_name, username, password } = req.body;

        if (username && username !== teacher[0].username) {
            const existing = await User.findByUsernameAnyTenant(username);
            if (existing) {
                return res.status(409).json({ message: 'Ese nombre de usuario ya esta en uso' });
            }
        }

        const updated = await User.updateProfile(req.params.teacherId, { full_name, username, password });
        if (!updated) {
            return res.status(400).json({ message: 'No se envio ningun campo para actualizar' });
        }

        await logAction({
            tenantId: teacher[0].tenant_id, actorId: req.user.id, actorRole: req.user.role,
            action: 'teacher_profile_edited', targetType: 'user', targetId: teacher[0].id,
            metadata: { username_changed: !!username, password_changed: !!password }, ip: req.ip
        });

        res.json({ message: 'Docente actualizado exitosamente', username: username || teacher[0].username });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Ese nombre de usuario ya esta en uso' });
        }
        console.error('Error al editar docente:', error.message);
        res.status(500).json({ message: 'Error al editar el docente' });
    }
});

router.post('/teachers/:teacherId/reset-password', accountCreationLimiter, async (req, res) => {
    try {
        const [teacher] = await db.pool.query(
            'SELECT id, tenant_id, username, full_name FROM users WHERE id = ? AND role = "teacher"',
            [req.params.teacherId]
        );
        if (teacher.length === 0) {
            return res.status(404).json({ message: 'Docente no encontrado' });
        }
        if (!assertSameTenant(req.user, teacher[0].tenant_id)) {
            return res.status(403).json({ message: 'No tienes acceso a este docente' });
        }

        const tempPassword = generateTempPassword();
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(tempPassword, salt);

        await db.pool.query(
            `UPDATE users SET password_hash = ?, temporary_password = TRUE,
                failed_login_attempts = 0, locked_until = NULL
             WHERE id = ?`,
            [password_hash, req.params.teacherId]
        );

        await logAction({
            tenantId: teacher[0].tenant_id, actorId: req.user.id, actorRole: req.user.role,
            action: 'password_reset_by_admin', targetType: 'user', targetId: teacher[0].id,
            metadata: { username: teacher[0].username }, ip: req.ip
        });

        res.json({
            message: 'Contrasena reseteada exitosamente',
            username: teacher[0].username,
            temp_password: tempPassword
        });
    } catch (error) {
        console.error('Error al resetear contrasena de docente:', error.message);
        res.status(500).json({ message: 'Error al resetear la contrasena' });
    }
});

// ============================================
// VISIBILIDAD DE TAREAS (solo lectura para el admin - crear/calificar sigue
// siendo exclusivo del docente de la clase).
// ============================================

router.get('/classes/:classId/tasks', async (req, res) => {
    try {
        const [[classInfo]] = await db.pool.query('SELECT tenant_id FROM classes WHERE id = ?', [req.params.classId]);
        if (!classInfo) {
            return res.status(404).json({ message: 'Clase no encontrada' });
        }
        if (!assertSameTenant(req.user, classInfo.tenant_id)) {
            return res.status(403).json({ message: 'No tienes acceso a esta clase' });
        }

        const tasks = await Task.getByClass(req.params.classId, true);
        res.json(tasks);
    } catch (error) {
        console.error('Error al obtener tareas (admin):', error.message);
        res.status(500).json({ message: 'Error al obtener tareas' });
    }
});

router.get('/tasks/:taskId/submissions', async (req, res) => {
    try {
        const classId = await Task.getClassId(req.params.taskId);
        if (classId === null) {
            return res.status(404).json({ message: 'Tarea no encontrada' });
        }

        const [[classInfo]] = await db.pool.query('SELECT tenant_id FROM classes WHERE id = ?', [classId]);
        if (!classInfo || !assertSameTenant(req.user, classInfo.tenant_id)) {
            return res.status(403).json({ message: 'No tienes acceso a esta tarea' });
        }

        const submissions = await TaskSubmission.getByTask(req.params.taskId);
        res.json(submissions);
    } catch (error) {
        console.error('Error al obtener entregas (admin):', error.message);
        res.status(500).json({ message: 'Error al obtener las entregas' });
    }
});

// ============================================
// VISIBILIDAD DE ASISTENCIA (solo lectura para el admin)
// ============================================

router.get('/classes/:classId/attendance/history', async (req, res) => {
    try {
        const [[classInfo]] = await db.pool.query('SELECT tenant_id FROM classes WHERE id = ?', [req.params.classId]);
        if (!classInfo) {
            return res.status(404).json({ message: 'Clase no encontrada' });
        }
        if (!assertSameTenant(req.user, classInfo.tenant_id)) {
            return res.status(403).json({ message: 'No tienes acceso a esta clase' });
        }

        const history = await Attendance.getByClass(req.params.classId);
        res.json(history);
    } catch (error) {
        console.error('Error al obtener asistencia (admin):', error.message);
        res.status(500).json({ message: 'Error al obtener la asistencia' });
    }
});

// ============================================
// CALIFICACIONES CONSOLIDADAS (solo lectura para el admin)
// ============================================

router.get('/classes/:classId/gradebook', async (req, res) => {
    try {
        const [[classInfo]] = await db.pool.query('SELECT tenant_id FROM classes WHERE id = ?', [req.params.classId]);
        if (!classInfo) {
            return res.status(404).json({ message: 'Clase no encontrada' });
        }
        if (!assertSameTenant(req.user, classInfo.tenant_id)) {
            return res.status(403).json({ message: 'No tienes acceso a esta clase' });
        }

        const students = await User.getClassStudents(req.params.classId);
        const tasks = await Task.getByClass(req.params.classId, false);

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
            scores: tasks.map(t => ({ task_id: t.id, score: scoreMap[`${t.id}_${s.id}`] ?? null }))
        }));

        res.json({ tasks: tasks.map(t => ({ id: t.id, title: t.title, max_score: t.max_score })), grid });
    } catch (error) {
        console.error('Error al obtener calificaciones (admin):', error.message);
        res.status(500).json({ message: 'Error al obtener las calificaciones' });
    }
});

function generateTempPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pass = '';
    for (let i = 0; i < 10; i++) {
        pass += chars[Math.floor(Math.random() * chars.length)];
    }
    return pass;
}

module.exports = router;
