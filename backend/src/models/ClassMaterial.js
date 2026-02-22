const db = require('../config/database');

class ClassMaterial {
    // Obtener materiales de una clase específica
    static async getByClass(classId, includeInactive = false) {
        try {
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
        } catch (error) {
            console.error('Error en getByClass:', error);
            throw error;
        }
    }

    // Obtener un material específico
    static async getById(id) {
        try {
            const [materials] = await db.pool.query(
                'SELECT * FROM class_materials WHERE id = ?',
                [id]
            );
            return materials[0];
        } catch (error) {
            console.error('Error en getById:', error);
            throw error;
        }
    }

    // Crear nuevo material
    static async create(data) {
        try {
            const {
                class_id,
                category_id,
                title,
                description,
                material_type,
                file_url,
                file_name,
                file_size,
                external_link,
                uploaded_by
            } = data;

            const [result] = await db.pool.query(
                `INSERT INTO class_materials 
                 (class_id, category_id, title, description, material_type, 
                  file_url, file_name, file_size, external_link, uploaded_by) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [class_id, category_id || null, title, description, material_type,
                 file_url || null, file_name || null, file_size || null, 
                 external_link || null, uploaded_by]
            );

            return result.insertId;
        } catch (error) {
            console.error('Error en create:', error);
            throw error;
        }
    }

    // Actualizar material
    static async update(id, data) {
        try {
            const {
                title,
                description,
                material_type,
                external_link,
                is_active,
                display_order,
                category_id
            } = data;

            const [result] = await db.pool.query(
                `UPDATE class_materials 
                 SET title = ?, description = ?, material_type = ?,
                     external_link = ?, is_active = ?, display_order = ?,
                     category_id = ?
                 WHERE id = ?`,
                [title, description, material_type, external_link, 
                 is_active, display_order, category_id, id]
            );

            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error en update:', error);
            throw error;
        }
    }

    // Eliminar material (borrado físico)
    static async delete(id) {
        try {
            const [result] = await db.pool.query(
                'DELETE FROM class_materials WHERE id = ?',
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error en delete:', error);
            throw error;
        }
    }

    // Ocultar material (borrado lógico)
    static async toggleActive(id, isActive) {
        try {
            const [result] = await db.pool.query(
                'UPDATE class_materials SET is_active = ? WHERE id = ?',
                [isActive, id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error en toggleActive:', error);
            throw error;
        }
    }

    // Obtener materiales recientes de un estudiante (para dashboard)
    static async getRecentByStudent(studentId, limit = 5) {
        try {
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
                LIMIT ?
            `, [studentId, limit]);

            return materials;
        } catch (error) {
            console.error('Error en getRecentByStudent:', error);
            throw error;
        }
    }

    // Buscar materiales
    static async search(term, studentId = null) {
        try {
            let query = `
                SELECT cm.*, c.name as class_name
                FROM class_materials cm
                JOIN classes c ON cm.class_id = c.id
                WHERE cm.is_active = 1 
                  AND (cm.title LIKE ? OR cm.description LIKE ?)
            `;
            
            const params = [`%${term}%`, `%${term}%`];

            // Si es estudiante, filtrar por sus clases
            if (studentId) {
                query += ` AND c.id IN (
                    SELECT class_id FROM class_students WHERE student_id = ?
                )`;
                params.push(studentId);
            }

            query += ' ORDER BY cm.uploaded_at DESC LIMIT 20';

            const [results] = await db.pool.query(query, params);
            return results;
        } catch (error) {
            console.error('Error en search:', error);
            throw error;
        }
    }
}

// Modelo para Categorías
class MaterialCategory {
    static async getByClass(classId) {
        try {
            const [categories] = await db.pool.query(
                `SELECT * FROM material_categories 
                 WHERE class_id = ? 
                 ORDER BY display_order ASC, name ASC`,
                [classId]
            );
            return categories;
        } catch (error) {
            console.error('Error en getByClass:', error);
            throw error;
        }
    }

    static async create(data) {
        try {
            const { class_id, name, description, color, display_order } = data;
            const [result] = await db.pool.query(
                `INSERT INTO material_categories 
                 (class_id, name, description, color, display_order) 
                 VALUES (?, ?, ?, ?, ?)`,
                [class_id, name, description, color || '#667eea', display_order || 0]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error en create category:', error);
            throw error;
        }
    }

    static async delete(id) {
        try {
            // Primero, desasignar materiales de esta categoría
            await db.pool.query(
                'UPDATE class_materials SET category_id = NULL WHERE category_id = ?',
                [id]
            );
            
            // Luego eliminar la categoría
            const [result] = await db.pool.query(
                'DELETE FROM material_categories WHERE id = ?',
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error en delete category:', error);
            throw error;
        }
    }
}

module.exports = { ClassMaterial, MaterialCategory };