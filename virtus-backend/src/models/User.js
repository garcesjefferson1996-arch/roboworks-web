const db = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
    static async findByUsername(username) {
        const [rows] = await db.pool.query(
            'SELECT * FROM users WHERE username = ? AND is_active = 1',
            [username]
        );
        return rows[0];
    }

    static async findById(id, includePassword = false) {
        const query = includePassword
            ? 'SELECT * FROM users WHERE id = ?'
            : `SELECT id, tenant_id, username, full_name, email, role, profile_photo,
                      temporary_password, created_at
               FROM users WHERE id = ?`;
        const [rows] = await db.pool.query(query, [id]);
        return rows[0];
    }

    static async create(userData) {
        const { tenant_id, username, password, full_name, role, email, invitation_code, parent_phone } = userData;

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const [result] = await db.pool.query(
            `INSERT INTO users
                (tenant_id, username, password_hash, full_name, email, role, invitation_code, parent_phone, temporary_password)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
            [tenant_id, username, password_hash, full_name, email || null, role, invitation_code || null, parent_phone || null]
        );

        return result.insertId;
    }

    static async validatePassword(plainPassword, hashedPassword) {
        return bcrypt.compare(plainPassword, hashedPassword);
    }

    static async changePassword(userId, newPassword) {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(newPassword, salt);

        const [result] = await db.pool.query(
            'UPDATE users SET password_hash = ?, temporary_password = FALSE WHERE id = ?',
            [password_hash, userId]
        );
        return result.affectedRows > 0;
    }

    // Edicion directa desde el admin: username/nombre/telefono y,
    // opcionalmente, una contrasena elegida por el admin (no aleatoria).
    // Todos los campos son opcionales; solo se actualiza lo que venga.
    static async findByUsernameAnyTenant(username) {
        const [rows] = await db.pool.query('SELECT id FROM users WHERE username = ?', [username]);
        return rows[0];
    }

    static async updateProfile(userId, { full_name, username, email, parent_phone, password } = {}) {
        const fields = [];
        const values = [];

        if (full_name !== undefined) { fields.push('full_name = ?'); values.push(full_name); }
        if (username !== undefined) { fields.push('username = ?'); values.push(username); }
        if (email !== undefined) { fields.push('email = ?'); values.push(email || null); }
        if (parent_phone !== undefined) { fields.push('parent_phone = ?'); values.push(parent_phone || null); }

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);
            fields.push('password_hash = ?', 'temporary_password = FALSE', 'failed_login_attempts = 0', 'locked_until = NULL');
            values.push(password_hash);
        }

        if (fields.length === 0) return false;

        values.push(userId);
        const [result] = await db.pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    static isLocked(user) {
        return !!user.locked_until && new Date(user.locked_until) > new Date();
    }

    static async registerFailedLogin(userId, currentAttempts) {
        const MAX_ATTEMPTS = 5;
        const LOCK_MINUTES = 15;
        const attempts = (currentAttempts || 0) + 1;

        if (attempts >= MAX_ATTEMPTS) {
            const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
            await db.pool.query(
                'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
                [attempts, lockedUntil, userId]
            );
            return { locked: true, lockedUntil };
        }

        await db.pool.query('UPDATE users SET failed_login_attempts = ? WHERE id = ?', [attempts, userId]);
        return { locked: false, attemptsLeft: MAX_ATTEMPTS - attempts };
    }

    static async resetFailedLogins(userId) {
        await db.pool.query(
            'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
            [userId]
        );
    }

    static async setTotpSecret(userId, secret) {
        await db.pool.query('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?', [secret, userId]);
    }

    static async enableTotp(userId) {
        await db.pool.query('UPDATE users SET totp_enabled = 1 WHERE id = ?', [userId]);
    }

    static async disableTotp(userId) {
        await db.pool.query('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?', [userId]);
    }

    // Un docente ve una clase si se la asignaron directamente
    // (classes.teacher_id) o si le asignaron el grado completo de esa
    // clase (tabla teacher_grades) - ver tambien roles.js:teacherOwnsClass,
    // que aplica la misma regla para autorizar acceso a una clase puntual.
    static async getTeacherClasses(teacherId) {
        const [rows] = await db.pool.query(`
            SELECT c.id, c.name, c.zoom_link, c.schedule_day, c.schedule_time,
                   p.name as program_name,
                   cc.name as course_name,
                   (SELECT COUNT(*) FROM class_students WHERE class_id = c.id) as enrolled
            FROM classes c
            LEFT JOIN programs p ON c.program_id = p.id
            LEFT JOIN codeworks_courses cc ON c.codeworks_course_id = cc.id
            WHERE c.is_active = 1
              AND (
                  c.teacher_id = ?
                  OR (c.grade_id IS NOT NULL AND c.grade_id IN (
                      SELECT grade_id FROM teacher_grades WHERE teacher_id = ?
                  ))
              )
            ORDER BY FIELD(c.schedule_day, 'monday','tuesday','wednesday','thursday','friday','saturday','sunday'),
                     c.schedule_time
        `, [teacherId, teacherId]);
        return rows;
    }

    // Grados asignados a un docente (para mostrar/editar en el admin).
    static async getTeacherGrades(teacherId) {
        const [rows] = await db.pool.query(
            `SELECT g.id, g.name FROM teacher_grades tg
             JOIN grades g ON tg.grade_id = g.id
             WHERE tg.teacher_id = ?
             ORDER BY g.display_order`,
            [teacherId]
        );
        return rows;
    }

    // Vista "grados que da el docente" para la nueva navegacion del panel:
    // cada grado con su total de lecciones del ano y sus paralelos (clases)
    // dentro de ese grado (una clase = un paralelo, puede tener horario/zoom
    // propio y un grupo de estudiantes distinto al de otro paralelo del
    // mismo grado). Un grado puede aparecer sin paralelos todavia si al
    // docente se lo asignaron por grado pero el admin no ha creado clases.
    static async getTeacherGradesOverview(teacherId) {
        const [rows] = await db.pool.query(`
            SELECT g.id as grade_id, g.name as grade_name, g.display_order,
                   (SELECT COUNT(*) FROM grade_lessons WHERE grade_id = g.id AND is_active = 1) as total_lessons,
                   c.id as class_id, c.name as class_name, c.schedule_day, c.schedule_time, c.zoom_link,
                   (SELECT COUNT(*) FROM class_students WHERE class_id = c.id) as enrolled
            FROM grades g
            LEFT JOIN classes c ON c.grade_id = g.id AND c.is_active = 1
                AND (c.teacher_id = ? OR c.grade_id IN (SELECT grade_id FROM teacher_grades WHERE teacher_id = ?))
            WHERE g.id IN (
                SELECT grade_id FROM teacher_grades WHERE teacher_id = ?
                UNION
                SELECT grade_id FROM classes WHERE teacher_id = ? AND grade_id IS NOT NULL AND is_active = 1
            )
            ORDER BY g.display_order, g.name,
                     FIELD(c.schedule_day, 'monday','tuesday','wednesday','thursday','friday','saturday','sunday'),
                     c.schedule_time
        `, [teacherId, teacherId, teacherId, teacherId]);

        const grades = [];
        const byGradeId = {};
        for (const row of rows) {
            let grade = byGradeId[row.grade_id];
            if (!grade) {
                grade = {
                    id: row.grade_id, name: row.grade_name,
                    total_lessons: row.total_lessons, classes: []
                };
                byGradeId[row.grade_id] = grade;
                grades.push(grade);
            }
            if (row.class_id) {
                grade.classes.push({
                    id: row.class_id, name: row.class_name,
                    schedule_day: row.schedule_day, schedule_time: row.schedule_time,
                    zoom_link: row.zoom_link, enrolled: row.enrolled
                });
            }
        }
        return grades;
    }

    // Verifica si un docente esta conectado a un grado (asignado por grado
    // completo, o dueno de al menos un paralelo/clase de ese grado).
    static async teacherHasGrade(teacherId, gradeId) {
        const [rows] = await db.pool.query(`
            SELECT 1 FROM teacher_grades WHERE teacher_id = ? AND grade_id = ?
            UNION
            SELECT 1 FROM classes WHERE teacher_id = ? AND grade_id = ? AND is_active = 1
            LIMIT 1
        `, [teacherId, gradeId, teacherId, gradeId]);
        return rows.length > 0;
    }

    // Reemplaza por completo el conjunto de grados asignados a un docente.
    static async setTeacherGrades(teacherId, tenantId, gradeIds) {
        await db.pool.query('DELETE FROM teacher_grades WHERE teacher_id = ?', [teacherId]);
        const ids = [...new Set((gradeIds || []).filter(Boolean).map(id => parseInt(id, 10)))];
        if (ids.length === 0) return;

        const values = ids.map(gradeId => [tenantId, teacherId, gradeId]);
        await db.pool.query(
            'INSERT INTO teacher_grades (tenant_id, teacher_id, grade_id) VALUES ?',
            [values]
        );
    }

    static async getClassStudents(classId) {
        const [rows] = await db.pool.query(
            `SELECT u.id, u.full_name, u.username, u.profile_photo
             FROM users u
             JOIN class_students cs ON u.id = cs.student_id
             WHERE cs.class_id = ?
             ORDER BY u.full_name`,
            [classId]
        );
        return rows;
    }
}

module.exports = User;
