const db = require('../config/database');

// Asistencia: una fila por estudiante + clase + fecha. Se usa UPSERT
// (ON DUPLICATE KEY UPDATE) para que el docente pueda corregir la
// asistencia de un dia sin generar filas duplicadas (la llave unica es
// class_id + student_id + attendance_date).
class Attendance {
    static async upsertMany(records) {
        if (!records || records.length === 0) return;
        const values = records.map(r => [
            r.class_id, r.student_id, r.attendance_date, r.status, r.notes || null, r.recorded_by
        ]);
        await db.pool.query(
            `INSERT INTO attendance (class_id, student_id, attendance_date, status, notes, recorded_by)
             VALUES ?
             ON DUPLICATE KEY UPDATE status = VALUES(status), notes = VALUES(notes),
                recorded_by = VALUES(recorded_by), updated_at = CURRENT_TIMESTAMP`,
            [values]
        );
    }

    // Asistencia de una clase en una fecha especifica (para que el docente
    // vea/edite lo que ya marco ese dia).
    static async getByClassAndDate(classId, date) {
        const [rows] = await db.pool.query(
            `SELECT a.*, u.full_name as student_name
             FROM attendance a JOIN users u ON a.student_id = u.id
             WHERE a.class_id = ? AND a.attendance_date = ?
             ORDER BY u.full_name`,
            [classId, date]
        );
        return rows;
    }

    // Historial completo de una clase, agrupable en el frontend por fecha.
    static async getByClass(classId, limit = 500) {
        const safeLimit = Math.min(Math.max(parseInt(limit) || 500, 1), 2000);
        const [rows] = await db.pool.query(
            `SELECT a.*, u.full_name as student_name
             FROM attendance a JOIN users u ON a.student_id = u.id
             WHERE a.class_id = ?
             ORDER BY a.attendance_date DESC, u.full_name
             LIMIT ${safeLimit}`,
            [classId]
        );
        return rows;
    }

    // Historial de un estudiante en una clase (para su propia vista).
    static async getByClassAndStudent(classId, studentId) {
        const [rows] = await db.pool.query(
            `SELECT attendance_date, status, notes
             FROM attendance
             WHERE class_id = ? AND student_id = ?
             ORDER BY attendance_date DESC`,
            [classId, studentId]
        );
        return rows;
    }

    // Resumen (conteos por estado) de un estudiante en una clase - util
    // para mostrar "18/20 presentes" sin tener que traer todas las filas.
    static async getSummaryForStudent(classId, studentId) {
        const [rows] = await db.pool.query(
            `SELECT status, COUNT(*) as total
             FROM attendance
             WHERE class_id = ? AND student_id = ?
             GROUP BY status`,
            [classId, studentId]
        );
        const summary = { present: 0, absent: 0, late: 0, excused: 0 };
        rows.forEach(r => { summary[r.status] = r.total; });
        return summary;
    }
}

module.exports = Attendance;
