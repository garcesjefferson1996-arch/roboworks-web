const db = require('../config/database');

// Tareas asignadas por un docente a una clase.
class Task {
    static async getByClass(classId, includeInactive = false) {
        let query = `
            SELECT t.*, u.full_name as created_by_name,
                   (SELECT COUNT(*) FROM task_submissions WHERE task_id = t.id) as total_submissions
            FROM tasks t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.class_id = ?
        `;
        if (!includeInactive) query += ' AND t.is_active = 1';
        query += ' ORDER BY t.due_date IS NULL, t.due_date ASC, t.created_at DESC';
        const [rows] = await db.pool.query(query, [classId]);
        return rows;
    }

    static async getById(id) {
        const [rows] = await db.pool.query('SELECT * FROM tasks WHERE id = ?', [id]);
        return rows[0];
    }

    static async create({ class_id, title, description, due_date, max_score, created_by }) {
        const [result] = await db.pool.query(
            `INSERT INTO tasks (class_id, title, description, due_date, max_score, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [class_id, title, description || null, due_date || null, max_score || 10, created_by]
        );
        return result.insertId;
    }

    static async delete(id) {
        const [result] = await db.pool.query('DELETE FROM tasks WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    static async getClassId(taskId) {
        const [rows] = await db.pool.query('SELECT class_id FROM tasks WHERE id = ?', [taskId]);
        return rows[0]?.class_id ?? null;
    }
}

// Entregas de los estudiantes para una tarea.
class TaskSubmission {
    static async getByTask(taskId) {
        const [rows] = await db.pool.query(
            `SELECT s.*, u.full_name as student_name, u.profile_photo as student_photo
             FROM task_submissions s
             JOIN users u ON s.student_id = u.id
             WHERE s.task_id = ?
             ORDER BY s.submitted_at DESC`,
            [taskId]
        );
        return rows;
    }

    static async getByTaskAndStudent(taskId, studentId) {
        const [rows] = await db.pool.query(
            'SELECT * FROM task_submissions WHERE task_id = ? AND student_id = ?',
            [taskId, studentId]
        );
        return rows[0] || null;
    }

    // Crea la entrega, o la reemplaza si ya existia y todavia no fue calificada
    // (evita que un estudiante pierda su nota re-entregando por error).
    static async upsert({ task_id, student_id, submission_type, file_url, file_name, external_link, text_content }) {
        const existing = await TaskSubmission.getByTaskAndStudent(task_id, student_id);

        if (existing) {
            if (existing.score !== null) {
                throw Object.assign(new Error('Esta entrega ya fue calificada, no se puede modificar'), { code: 'ALREADY_GRADED' });
            }
            await db.pool.query(
                `UPDATE task_submissions SET
                    submission_type = ?, file_url = ?, file_name = ?, external_link = ?, text_content = ?,
                    submitted_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [submission_type, file_url || null, file_name || null, external_link || null, text_content || null, existing.id]
            );
            return existing.id;
        }

        const [result] = await db.pool.query(
            `INSERT INTO task_submissions (task_id, student_id, submission_type, file_url, file_name, external_link, text_content)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [task_id, student_id, submission_type, file_url || null, file_name || null, external_link || null, text_content || null]
        );
        return result.insertId;
    }

    static async grade(submissionId, { score, teacher_feedback, graded_by }) {
        const [result] = await db.pool.query(
            `UPDATE task_submissions SET
                score = ?, teacher_feedback = ?, graded_by = ?, graded_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [score, teacher_feedback || null, graded_by, submissionId]
        );
        return result.affectedRows > 0;
    }

    static async getOwnerTaskAndClass(submissionId) {
        const [rows] = await db.pool.query(
            `SELECT s.task_id, s.student_id, t.class_id
             FROM task_submissions s JOIN tasks t ON s.task_id = t.id
             WHERE s.id = ?`,
            [submissionId]
        );
        return rows[0] || null;
    }
}

module.exports = { Task, TaskSubmission };
