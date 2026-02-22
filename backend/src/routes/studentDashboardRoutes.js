const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

// Middleware para verificar que es estudiante
const studentMiddleware = (req, res, next) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ message: 'Acceso solo para estudiantes' });
    }
    next();
};

// Aplicar middlewares
router.use(authMiddleware);
router.use(studentMiddleware);

// ============================================
// OBTENER DASHBOARD DEL ESTUDIANTE
// ============================================
router.get('/dashboard', async (req, res) => {
    try {
        const studentId = req.user.id;
        console.log(`📥 Estudiante ${studentId} solicitando dashboard`);

        // Obtener información del estudiante
        const [student] = await db.pool.query(`
            SELECT id, username, full_name, profile_photo, created_at
            FROM users 
            WHERE id = ? AND role = 'student'
        `, [studentId]);

        if (student.length === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado' });
        }

        // Obtener próxima clase
        const [nextClass] = await db.pool.query(`
            SELECT c.id, c.name, c.zoom_link, c.description,
                   p.name as program_name,
                   cc.name as course_name,
                   c.schedule_day, c.schedule_time,
                   (SELECT COUNT(*) FROM class_students WHERE class_id = c.id) as enrolled
            FROM classes c
            JOIN class_students cs ON c.id = cs.class_id
            JOIN programs p ON c.program_id = p.id
            LEFT JOIN codeworks_courses cc ON c.codeworks_course_id = cc.id
            WHERE cs.student_id = ?
            ORDER BY 
                CASE c.schedule_day
                    WHEN 'monday' THEN 1
                    WHEN 'tuesday' THEN 2
                    WHEN 'wednesday' THEN 3
                    WHEN 'thursday' THEN 4
                    WHEN 'friday' THEN 5
                    WHEN 'saturday' THEN 6
                END,
                c.schedule_time
            LIMIT 1
        `, [studentId]);

        // Obtener historial de clases (últimas 10)
        const [history] = await db.pool.query(`
            SELECT a.attendance_date, a.attended, a.notes,
                   c.name as class_name, c.schedule_time
            FROM attendance a
            JOIN classes c ON a.class_id = c.id
            WHERE a.student_id = ?
            ORDER BY a.attendance_date DESC
            LIMIT 10
        `, [studentId]);

        // Obtener todas las clases del estudiante
        const [classes] = await db.pool.query(`
            SELECT c.id, c.name, c.zoom_link,
                   p.name as program_name,
                   c.schedule_day, c.schedule_time,
                   (SELECT COUNT(*) FROM class_students WHERE class_id = c.id) as enrolled
            FROM classes c
            JOIN class_students cs ON c.id = cs.class_id
            JOIN programs p ON c.program_id = p.id
            WHERE cs.student_id = ?
            ORDER BY 
                CASE c.schedule_day
                    WHEN 'monday' THEN 1
                    WHEN 'tuesday' THEN 2
                    WHEN 'wednesday' THEN 3
                    WHEN 'thursday' THEN 4
                    WHEN 'friday' THEN 5
                    WHEN 'saturday' THEN 6
                END,
                c.schedule_time
        `, [studentId]);

        // Calcular estadísticas
        const [stats] = await db.pool.query(`
            SELECT 
                COUNT(DISTINCT c.id) as total_classes,
                SUM(CASE WHEN a.attended = 1 THEN 1 ELSE 0 END) as attended_classes,
                MAX(a.attendance_date) as last_class
            FROM classes c
            LEFT JOIN class_students cs ON c.id = cs.class_id
            LEFT JOIN attendance a ON c.id = a.class_id AND a.student_id = ?
            WHERE cs.student_id = ?
        `, [studentId, studentId]);

        res.json({
            student: student[0],
            nextClass: nextClass[0] || null,
            history,
            classes,
            stats: {
                total: stats[0]?.total_classes || 0,
                attended: stats[0]?.attended_classes || 0,
                attendanceRate: stats[0]?.total_classes > 0 
                    ? Math.round((stats[0]?.attended_classes / stats[0]?.total_classes) * 100) 
                    : 0
            }
        });

    } catch (error) {
        console.error('Error al obtener dashboard:', error);
        res.status(500).json({ message: 'Error al obtener dashboard' });
    }
});

// ============================================
// MARCAR ASISTENCIA (para futura integración)
// ============================================
router.post('/attendance/:classId', async (req, res) => {
    try {
        const studentId = req.user.id;
        const { classId } = req.params;
        
        // Verificar que el estudiante está inscrito en esta clase
        const [enrolled] = await db.pool.query(
            'SELECT * FROM class_students WHERE class_id = ? AND student_id = ?',
            [classId, studentId]
        );
        
        if (enrolled.length === 0) {
            return res.status(403).json({ message: 'No estás inscrito en esta clase' });
        }
        
        // Registrar asistencia (fecha actual)
        const today = new Date().toISOString().split('T')[0];
        
        await db.pool.query(
            `INSERT INTO attendance (class_id, student_id, attendance_date, attended)
             VALUES (?, ?, ?, true)
             ON DUPLICATE KEY UPDATE attended = true`,
            [classId, studentId, today]
        );
        
        res.json({ message: 'Asistencia registrada' });
        
    } catch (error) {
        console.error('Error al registrar asistencia:', error);
        res.status(500).json({ message: 'Error al registrar asistencia' });
    }
});

// ============================================
// OBTENER MATERIALES DE UNA CLASE (ESTUDIANTE)
// ============================================
router.get('/class/:classId/materials', async (req, res) => {
    try {
        const studentId = req.user.id;
        const { classId } = req.params;
        
        console.log(`📥 Estudiante ${studentId} solicitando materiales de clase ${classId}`);
        
        // Verificar que el estudiante está inscrito en esta clase
        const [enrolled] = await db.pool.query(
            'SELECT * FROM class_students WHERE class_id = ? AND student_id = ?',
            [classId, studentId]
        );
        
        if (enrolled.length === 0) {
            return res.status(403).json({ 
                message: 'No tienes acceso a los materiales de esta clase' 
            });
        }
        
        // Obtener materiales de la clase (solo activos)
        const [materials] = await db.pool.query(`
            SELECT cm.*, 
                   mc.name as category_name,
                   mc.color as category_color,
                   u.full_name as uploaded_by_name
            FROM class_materials cm
            LEFT JOIN material_categories mc ON cm.category_id = mc.id
            LEFT JOIN users u ON cm.uploaded_by = u.id
            WHERE cm.class_id = ? AND cm.is_active = 1
            ORDER BY mc.display_order ASC, cm.display_order ASC, cm.uploaded_at DESC
        `, [classId]);
        
        // Obtener información de la clase
        const [classInfo] = await db.pool.query(`
            SELECT c.*, p.name as program_name
            FROM classes c
            JOIN programs p ON c.program_id = p.id
            WHERE c.id = ?
        `, [classId]);
        
        res.json({
            class: classInfo[0],
            materials
        });
        
    } catch (error) {
        console.error('Error al obtener materiales:', error);
        res.status(500).json({ message: 'Error al obtener materiales' });
    }
});

// ============================================
// OBTENER TODOS LOS MATERIALES DEL ESTUDIANTE (para dashboard)
// ============================================
router.get('/materials/recent', async (req, res) => {
    try {
        const studentId = req.user.id;
        
        const [materials] = await db.pool.query(`
            SELECT DISTINCT cm.*, 
                   c.name as class_name,
                   p.name as program_name
            FROM class_materials cm
            JOIN classes c ON cm.class_id = c.id
            JOIN programs p ON c.program_id = p.id
            JOIN class_students cs ON c.id = cs.class_id
            WHERE cs.student_id = ? 
              AND cm.is_active = 1
            ORDER BY cm.uploaded_at DESC
            LIMIT 10
        `, [studentId]);
        
        res.json(materials);
        
    } catch (error) {
        console.error('Error al obtener materiales recientes:', error);
        res.status(500).json({ message: 'Error al obtener materiales' });
    }
});

// ============================================
// MARCAR MATERIAL COMO VISTO (opcional, para seguimiento)
// ============================================
router.post('/materials/:materialId/view', async (req, res) => {
    try {
        const studentId = req.user.id;
        const { materialId } = req.params;
        
        // Registrar vista (podrías crear una tabla material_views si quieres trackear)
        console.log(`👁️ Estudiante ${studentId} vio material ${materialId}`);
        
        // Por ahora solo respondemos OK
        res.json({ message: 'Vista registrada' });
        
    } catch (error) {
        console.error('Error al registrar vista:', error);
        res.status(500).json({ message: 'Error al registrar vista' });
    }
});

module.exports = router;