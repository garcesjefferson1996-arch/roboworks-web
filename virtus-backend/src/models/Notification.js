const db = require('../config/database');

// Notificaciones in-app (campanita). No hay envio de correo todavia - esto
// es solo para que el usuario vea, dentro de la plataforma, que paso algo
// relevante (tarea nueva, entrega calificada, entrega recibida).
class Notification {
    static async create({ user_id, type, message, related_type, related_id }) {
        const [result] = await db.pool.query(
            `INSERT INTO notifications (user_id, type, message, related_type, related_id)
             VALUES (?, ?, ?, ?, ?)`,
            [user_id, type, message, related_type || null, related_id || null]
        );
        return result.insertId;
    }

    // Crea varias notificaciones de una vez (ej. avisar a todos los
    // estudiantes de una clase que hay una tarea nueva). No lanza si la
    // lista viene vacia.
    static async createMany(notifications) {
        if (!notifications || notifications.length === 0) return;
        const values = notifications.map(n => [
            n.user_id, n.type, n.message, n.related_type || null, n.related_id || null
        ]);
        await db.pool.query(
            'INSERT INTO notifications (user_id, type, message, related_type, related_id) VALUES ?',
            [values]
        );
    }

    static async getForUser(userId, limit = 30) {
        const safeLimit = Math.min(Math.max(parseInt(limit) || 30, 1), 100);
        const [rows] = await db.pool.query(
            `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ${safeLimit}`,
            [userId]
        );
        return rows;
    }

    static async getUnreadCount(userId) {
        const [[row]] = await db.pool.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
            [userId]
        );
        return row.count;
    }

    static async markRead(id, userId) {
        const [result] = await db.pool.query(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        return result.affectedRows > 0;
    }

    static async markAllRead(userId) {
        await db.pool.query(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
            [userId]
        );
    }
}

module.exports = Notification;
