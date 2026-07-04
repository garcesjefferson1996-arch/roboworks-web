const db = require('../config/database');

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Acceso no autorizado para tu rol' });
        }
        next();
    };
}

function requireAdminOrOwningTeacher(classIdParam = 'classId') {
    return async (req, res, next) => {
        const { role, id: userId, tenant_id } = req.user || {};
        const classId = req.params[classIdParam] || req.body.class_id;

        if (!classId) {
            return res.status(400).json({ message: 'Falta el identificador de la clase' });
        }

        try {
            const [rows] = await db.pool.query(
                'SELECT id, tenant_id, teacher_id, grade_id FROM classes WHERE id = ?',
                [classId]
            );

            if (rows.length === 0) {
                return res.status(404).json({ message: 'Clase no encontrada' });
            }

            const classRow = rows[0];
            req.classData = classRow;

            if (role === 'super_admin') {
                return next();
            }

            if (role === 'academy_admin') {
                if (classRow.tenant_id !== tenant_id) {
                    return res.status(403).json({ message: 'No tienes acceso a esta clase' });
                }
                return next();
            }

            if (role === 'teacher') {
                if (await teacherOwnsClass(userId, classRow)) {
                    return next();
                }
                return res.status(403).json({ message: 'No eres el docente de esta clase' });
            }

            return res.status(403).json({ message: 'Acceso no autorizado para tu rol' });
        } catch (error) {
            console.error('Error verificando acceso a la clase:', error.message);
            return res.status(500).json({ message: 'Error del servidor' });
        }
    };
}

// Un docente "posee" una clase si se la asignaron directamente
// (classes.teacher_id) o si le asignaron el grado completo de esa clase
// (tabla teacher_grades). Se usa tanto en el middleware de arriba como en
// los pocos endpoints de teacherRoutes.js que verifican la propiedad a mano.
async function teacherOwnsClass(userId, classRow) {
    if (!classRow) return false;
    if (classRow.teacher_id === userId) return true;
    if (!classRow.grade_id) return false;

    const [rows] = await db.pool.query(
        'SELECT 1 FROM teacher_grades WHERE teacher_id = ? AND grade_id = ? LIMIT 1',
        [userId, classRow.grade_id]
    );
    return rows.length > 0;
}

function assertSameTenant(reqUser, resourceTenantId) {
    if (reqUser.role === 'super_admin') return true;
    return resourceTenantId === reqUser.tenant_id;
}

module.exports = { requireRole, requireAdminOrOwningTeacher, assertSameTenant, teacherOwnsClass };
