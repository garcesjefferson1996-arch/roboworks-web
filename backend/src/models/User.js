const db = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
    // Buscar usuario por username
    static async findByUsername(username) {
        try {
            const [rows] = await db.pool.query(
                'SELECT * FROM users WHERE username = ?',
                [username]
            );
            return rows[0];
        } catch (error) {
            console.error('Error en findByUsername:', error);
            throw error;
        }
    }

    // Buscar usuario por ID
    static async findById(id, includePassword = false) {
        try {
            let query;
            if (includePassword) {
                query = 'SELECT * FROM users WHERE id = ?';
            } else {
                query = 'SELECT id, username, full_name, role, profile_photo, tenant_id, temporary_password, created_at FROM users WHERE id = ?';
            }
            const [rows] = await db.pool.query(query, [id]);
            return rows[0];
        } catch (error) {
            console.error('Error en findById:', error);
            throw error;
        }
    }

    // Crear nuevo usuario
    static async create(studentData) {
        try {
            const { tenant_id, username, password, full_name, role, invitation_code } = studentData;
            
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);

            const [result] = await db.pool.query(
                'INSERT INTO users (tenant_id, username, password_hash, full_name, role, invitation_code, temporary_password) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [tenant_id, username, password_hash, full_name, role, invitation_code, true]
            );
            
            return result.insertId;
        } catch (error) {
            console.error('Error en create:', error);
            throw error;
        }
    }

    // Validar contraseña
    static async validatePassword(plainPassword, hashedPassword) {
        try {
            return await bcrypt.compare(plainPassword, hashedPassword);
        } catch (error) {
            console.error('Error en validatePassword:', error);
            throw error;
        }
    }

    // Cambiar contraseña
    static async changePassword(userId, newPassword) {
        try {
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(newPassword, salt);
            
            const [result] = await db.pool.query(
                'UPDATE users SET password_hash = ?, temporary_password = FALSE WHERE id = ?',
                [password_hash, userId]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error en changePassword:', error);
            throw error;
        }
    }

    // Obtener estudiantes de una clase
    static async getClassStudents(classId) {
        try {
            const [rows] = await db.pool.query(
                `SELECT u.id, u.full_name, u.profile_photo 
                 FROM users u 
                 JOIN class_students cs ON u.id = cs.student_id 
                 WHERE cs.class_id = ?`,
                [classId]
            );
            return rows;
        } catch (error) {
            console.error('Error en getClassStudents:', error);
            throw error;
        }
    }
}

module.exports = User;