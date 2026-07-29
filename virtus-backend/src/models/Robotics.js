const db = require('../config/database');

// Robótica de Competencia: repositorio del admin con robots propios
// (nombre, descripción, categoría) y sus archivos (STL, código, diagramas
// de conexión). Aislado por tenant_id; los docentes solo leen.
class CompetitionRobot {
    static async getByTenant(tenantId, includeInactive = false) {
        let query = `
            SELECT cr.*, u.full_name as created_by_name,
                   COUNT(crf.id) as file_count
            FROM competition_robots cr
            LEFT JOIN users u ON cr.created_by = u.id
            LEFT JOIN competition_robot_files crf ON crf.robot_id = cr.id
            WHERE cr.tenant_id = ?
        `;
        if (!includeInactive) {
            query += ' AND cr.is_active = 1';
        }
        query += ' GROUP BY cr.id ORDER BY cr.created_at DESC';

        const [robots] = await db.pool.query(query, [tenantId]);
        return robots;
    }

    static async getById(id) {
        const [robots] = await db.pool.query(
            `SELECT cr.*, u.full_name as created_by_name
             FROM competition_robots cr
             LEFT JOIN users u ON cr.created_by = u.id
             WHERE cr.id = ?`,
            [id]
        );
        return robots[0];
    }

    static async create(data) {
        const { tenant_id, name, description, category, created_by } = data;
        const [result] = await db.pool.query(
            `INSERT INTO competition_robots (tenant_id, name, description, category, created_by)
             VALUES (?, ?, ?, ?, ?)`,
            [tenant_id, name, description || null, category || null, created_by]
        );
        return result.insertId;
    }

    static async update(id, data) {
        const { name, description, category, is_active } = data;
        const [result] = await db.pool.query(
            `UPDATE competition_robots
                SET name = ?, description = ?, category = ?, is_active = ?
             WHERE id = ?`,
            [name, description || null, category || null, is_active === undefined ? 1 : is_active, id]
        );
        return result.affectedRows > 0;
    }

    static async delete(id) {
        const [result] = await db.pool.query('DELETE FROM competition_robots WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }
}

class CompetitionRobotFile {
    static async getByRobot(robotId) {
        const [files] = await db.pool.query(
            `SELECT crf.*, u.full_name as uploaded_by_name
             FROM competition_robot_files crf
             LEFT JOIN users u ON crf.uploaded_by = u.id
             WHERE crf.robot_id = ?
             ORDER BY crf.file_category ASC, crf.uploaded_at DESC`,
            [robotId]
        );
        return files;
    }

    static async create(data) {
        const { robot_id, file_category, file_url, file_name, file_size, uploaded_by } = data;
        const [result] = await db.pool.query(
            `INSERT INTO competition_robot_files
                (robot_id, file_category, file_url, file_name, file_size, uploaded_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [robot_id, file_category, file_url, file_name, file_size || null, uploaded_by]
        );
        return result.insertId;
    }

    static async getRobotOwner(fileId) {
        const [rows] = await db.pool.query(
            `SELECT crf.robot_id, cr.tenant_id
             FROM competition_robot_files crf
             JOIN competition_robots cr ON crf.robot_id = cr.id
             WHERE crf.id = ?`,
            [fileId]
        );
        return rows[0] || null;
    }

    static async delete(id) {
        const [result] = await db.pool.query('DELETE FROM competition_robot_files WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }
}

module.exports = { CompetitionRobot, CompetitionRobotFile };
