const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { ClassMaterial, MaterialCategory } = require('../models/ClassMaterial');
const { upload } = require('../config/cloudinary'); // Para subir archivos

// Middleware para verificar que es admin
const adminMiddleware = (req, res, next) => {
    if (req.user.role !== 'super_admin' && req.user.role !== 'academy_admin') {
        return res.status(403).json({ message: 'Acceso no autorizado' });
    }
    next();
};

// Aplicar middlewares
router.use(authMiddleware);
router.use(adminMiddleware);

// ============================================
// ENDPOINTS PARA MATERIALES
// ============================================

// Obtener materiales de una clase específica
router.get('/class/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        const { includeInactive } = req.query;
        
        console.log(`📥 Obteniendo materiales de clase ${classId}`);
        
        // Verificar que la clase existe
        const [classExists] = await db.pool.query(
            'SELECT id, name FROM classes WHERE id = ?',
            [classId]
        );
        
        if (classExists.length === 0) {
            return res.status(404).json({ message: 'Clase no encontrada' });
        }
        
        // Obtener materiales
        const materials = await ClassMaterial.getByClass(classId, includeInactive === 'true');
        
        // Obtener categorías de esta clase
        const categories = await MaterialCategory.getByClass(classId);
        
        res.json({
            class: classExists[0],
            materials,
            categories
        });
        
    } catch (error) {
        console.error('Error al obtener materiales:', error);
        res.status(500).json({ message: 'Error al obtener materiales' });
    }
});

// Crear nuevo material (link o texto)
router.post('/', async (req, res) => {
    try {
        const {
            class_id,
            category_id,
            title,
            description,
            material_type,
            external_link
        } = req.body;
        
        // Validaciones básicas
        if (!class_id || !title || !material_type) {
            return res.status(400).json({ 
                message: 'Faltan campos requeridos: class_id, title, material_type' 
            });
        }
        
        if (material_type === 'link' && !external_link) {
            return res.status(400).json({ 
                message: 'Para tipo "link" se requiere external_link' 
            });
        }
        
        const materialId = await ClassMaterial.create({
            class_id,
            category_id,
            title,
            description,
            material_type,
            external_link,
            uploaded_by: req.user.id
        });
        
        // Obtener el material creado
        const newMaterial = await ClassMaterial.getById(materialId);
        
        res.json({
            message: 'Material creado exitosamente',
            material: newMaterial
        });
        
    } catch (error) {
        console.error('Error al crear material:', error);
        res.status(500).json({ message: 'Error al crear material' });
    }
});

// Subir archivo como material
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se subió ningún archivo' });
        }
        
        const {
            class_id,
            category_id,
            title,
            description
        } = req.body;
        
        if (!class_id || !title) {
            return res.status(400).json({ 
                message: 'Faltan campos requeridos: class_id, title' 
            });
        }
        
        // Crear material con la información del archivo
        const materialId = await ClassMaterial.create({
            class_id,
            category_id,
            title,
            description,
            material_type: 'file',
            file_url: req.file.path,
            file_name: req.file.originalname,
            file_size: req.file.size,
            uploaded_by: req.user.id
        });
        
        const newMaterial = await ClassMaterial.getById(materialId);
        
        res.json({
            message: 'Archivo subido exitosamente',
            material: newMaterial
        });
        
    } catch (error) {
        console.error('Error al subir archivo:', error);
        res.status(500).json({ message: 'Error al subir archivo' });
    }
});

// Actualizar material
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            description,
            material_type,
            external_link,
            is_active,
            display_order,
            category_id
        } = req.body;
        
        const updated = await ClassMaterial.update(id, {
            title,
            description,
            material_type,
            external_link,
            is_active: is_active ? 1 : 0,
            display_order,
            category_id
        });
        
        if (updated) {
            const material = await ClassMaterial.getById(id);
            res.json({ message: 'Material actualizado', material });
        } else {
            res.status(404).json({ message: 'Material no encontrado' });
        }
        
    } catch (error) {
        console.error('Error al actualizar material:', error);
        res.status(500).json({ message: 'Error al actualizar material' });
    }
});

// Eliminar material
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const deleted = await ClassMaterial.delete(id);
        
        if (deleted) {
            res.json({ message: 'Material eliminado' });
        } else {
            res.status(404).json({ message: 'Material no encontrado' });
        }
        
    } catch (error) {
        console.error('Error al eliminar material:', error);
        res.status(500).json({ message: 'Error al eliminar material' });
    }
});

// ============================================
// ENDPOINTS PARA CATEGORÍAS
// ============================================

// Crear categoría
router.post('/categories', async (req, res) => {
    try {
        const { class_id, name, description, color } = req.body;
        
        if (!class_id || !name) {
            return res.status(400).json({ message: 'class_id y name son requeridos' });
        }
        
        const categoryId = await MaterialCategory.create({
            class_id,
            name,
            description,
            color
        });
        
        res.json({
            message: 'Categoría creada',
            id: categoryId
        });
        
    } catch (error) {
        console.error('Error al crear categoría:', error);
        res.status(500).json({ message: 'Error al crear categoría' });
    }
});

// Eliminar categoría
router.delete('/categories/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const deleted = await MaterialCategory.delete(id);
        
        if (deleted) {
            res.json({ message: 'Categoría eliminada' });
        } else {
            res.status(404).json({ message: 'Categoría no encontrada' });
        }
        
    } catch (error) {
        console.error('Error al eliminar categoría:', error);
        res.status(500).json({ message: 'Error al eliminar categoría' });
    }
});

module.exports = router;