const db = require('../config/database');

class ClassMaterial {
    static async getByClass(classId, includeInactive = false) {
        let query = `
            SELECT cm.*,
                   u.full_name as uploaded_by_name,
                   mc.name as category_name,
                   mc.color as category_color
            FROM class_materials cm
            LEFT JOIN users u ON cm.uploaded_by = u.id
            LEFT JOIN material_categories mc ON cm.category_id = mc.id
            WHERE cm.class_id = ?
        `;
        if (!includeInactive) {
            query += ' AND cm.is_active = 1';
        }
        query += ' ORDER BY cm.display_order ASC, cm.uploaded_at DESC';

        const [materials] = await db.pool.query(query, [classId]);
        return materials;
    }

    static async getById(id) {
        const [materials] = await db.pool.query('SELECT * FROM class_materials WHERE id = ?', [id]);
        return materials[0];
    }

    static async create(data) {
        const {
            class_id, category_id, title, description, material_type,
            file_url, file_name, file_size, external_link, uploaded_by
        } = data;

        const [result] = await db.pool.query(
            `INSERT INTO class_materials
                (class_id, category_id, title, description, material_type,
                 file_url, file_name, file_size, external_link, uploaded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [class_id, category_id || null, title, description || null, material_type,
             file_url || null, file_name || null, file_size || null,
             external_link || null, uploaded_by]
        );
        return result.insertId;
    }

    static async update(id, data) {
        const { title, description, material_type, external_link, is_active, display_order, category_id } = data;
        const [result] = await db.pool.query(
            `UPDATE class_materials
                SET title = ?, description = ?, material_type = ?,
                    external_link = ?, is_active = ?, display_order = ?, category_id = ?
             WHERE id = ?`,
            [title, description, material_type, external_link, is_active, display_order, category_id, id]
        );
        return result.affectedRows > 0;
    }

    static async delete(id) {
        const [result] = await db.pool.query('DELETE FROM class_materials WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    static async getRecentByStudent(studentId, limit = 5) {
        const [materials] = await db.pool.query(`
            SELECT DISTINCT cm.*, c.name as class_name, p.name as program_name
            FROM class_materials cm
            JOIN classes c ON cm.class_id = c.id
            LEFT JOIN programs p ON c.program_id = p.id
            JOIN class_students cs ON c.id = cs.class_id
            WHERE cs.student_id = ? AND cm.is_active = 1
            ORDER BY cm.uploaded_at DESC
            LIMIT ?
        `, [studentId, limit]);
        return materials;
    }
}

// La categoría "Guía de la clase" se crea automáticamente al crear cada clase
// (ver classRoutes.js) y queda marcada con is_system = 1 para que no se pueda
// borrar por accidente desde la interfaz de administración.
class MaterialCategory {
    static async getByClass(classId) {
        const [categories] = await db.pool.query(
            'SELECT * FROM material_categories WHERE class_id = ? ORDER BY is_system DESC, display_order ASC, name ASC',
            [classId]
        );
        return categories;
    }

    static async create(data) {
        const { class_id, name, description, color, display_order, is_system } = data;
        const [result] = await db.pool.query(
            `INSERT INTO material_categories (class_id, name, description, color, display_order, is_system)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [class_id, name, description || null, color || '#667eea', display_order || 0, is_system ? 1 : 0]
        );
        return result.insertId;
    }

    static async ensureGuideCategory(classId) {
        const [existing] = await db.pool.query(
            'SELECT id FROM material_categories WHERE class_id = ? AND is_system = 1 LIMIT 1',
            [classId]
        );
        if (existing.length > 0) return existing[0].id;

        return MaterialCategory.create({
            class_id: classId,
            name: 'Guía de la clase',
            description: 'Guía oficial de la sesión',
            color: '#4f46e5',
            display_order: 0,
            is_system: true
        });
    }

    static async delete(id) {
        const [category] = await db.pool.query('SELECT is_system FROM material_categories WHERE id = ?', [id]);
        if (category.length === 0) return false;
        if (category[0].is_system) {
            throw new Error('No se puede eliminar la categoría del sistema "Guía de la clase"');
        }

        await db.pool.query('UPDATE class_materials SET category_id = NULL WHERE category_id = ?', [id]);
        const [result] = await db.pool.query('DELETE FROM material_categories WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }
}

module.exports = { ClassMaterial, MaterialCategory };
