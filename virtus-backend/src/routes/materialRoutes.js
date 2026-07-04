const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { requireRole, assertSameTenant } = require('../middleware/roles');
const { ClassMaterial, MaterialCategory } = require('../models/ClassMaterial');
const { uploadMaterial } = require('../config/cloudinary');
const { logAction } = require('../utils/audit');

router.use(authMiddleware);
router.use(requireRole('super_admin', 'academy_admin'));

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Demasiadas subidas en poco tiempo. Espera unos minutos.' }
});

async function getClassTenant(classId) {
    const [rows] = await db.pool.query('SELECT tenant_id FROM classes WHERE id = ?', [classId]);
    return rows[0]?.tenant_id ?? null;
}

async function getMaterialClassTenant(materialId) {
    const [rows] = await db.pool.query(
        `SELECT c.tenant_id, cm.class_id
         FROM class_materials cm JOIN classes c ON cm.class_id = c.id
         WHERE cm.id = ?`,
        [materialId]
    );
    return rows[0] || null;
}

async function getCategoryClassTenant(categoryId) {
    const [rows] = await db.pool.query(
        `SELECT c.tenant_id, mc.class_id
         FROM material_categories mc JOIN classes c ON mc.class_id = c.id
         WHERE mc.id = ?`,
        [categoryId]
    );
    return rows[0] || null;
}

router.get('/class/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        const { includeInactive } = req.query;

        const [classExists] = await db.pool.query('SELECT id, name, tenant_id FROM classes WHERE id = ?', [classId]);
        if (classExists.length === 0) {
            return res.status(404).json({ message: 'Clase no encontrada' });
        }
        if (!assertSameTenant(req.user, classExists[0].tenant_id)) {
            return res.status(403).json({ message: 'No tienes acceso a esta clase' });
        }

        const materials = await ClassMaterial.getByClass(classId, includeInactive === 'true');
        const categories = await MaterialCategory.getByClass(classId);

        res.json({ class: classExists[0], materials, categories });
    } catch (error) {
        console.error('Error al obtener materiales:', error.message);
        res.status(500).json({ message: 'Error al obtener materiales' });
    }
});

const materialValidation = [
    body('class_id').isInt().withMessage('class_id invalido'),
    body('title').trim().notEmpty().withMessage('El titulo es requerido'),
    body('material_type').isIn(['file', 'link', 'text']).withMessage('material_type invalido')
];

router.post('/', materialValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { class_id, category_id, title, description, material_type, external_link } = req.body;

        const classTenant = await getClassTenant(class_id);
        if (classTenant === null) {
            return res.status(404).json({ message: 'Clase no encontrada' });
        }
        if (!assertSameTenant(req.user, classTenant)) {
            return res.status(403).json({ message: 'No tienes acceso a esta clase' });
        }

        if (material_type === 'link' && !external_link) {
            return res.status(400).json({ message: 'Para tipo "link" se requiere external_link' });
        }
        if (material_type === 'link' && !/^https?:\/\//i.test(external_link)) {
            return res.status(400).json({ message: 'El link debe empezar con http:// o https://' });
        }

        const materialId = await ClassMaterial.create({
            class_id, category_id, title, description, material_type, external_link,
            uploaded_by: req.user.id
        });

        const newMaterial = await ClassMaterial.getById(materialId);
        res.status(201).json({ message: 'Material creado exitosamente', material: newMaterial });
    } catch (error) {
        console.error('Error al crear material:', error.message);
        res.status(500).json({ message: 'Error al crear material' });
    }
});

router.post('/upload', uploadLimiter, uploadMaterial.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se subio ningun archivo' });
        }
        const { class_id, category_id, title, description } = req.body;
        if (!class_id || !title) {
            return res.status(400).json({ message: 'Faltan campos requeridos: class_id, title' });
        }

        const classTenant = await getClassTenant(class_id);
        if (classTenant === null) {
            return res.status(404).json({ message: 'Clase no encontrada' });
        }
        if (!assertSameTenant(req.user, classTenant)) {
            return res.status(403).json({ message: 'No tienes acceso a esta clase' });
        }

        const materialId = await ClassMaterial.create({
            class_id, category_id, title, description,
            material_type: 'file',
            file_url: req.file.path,
            file_name: req.file.originalname,
            file_size: req.file.size,
            uploaded_by: req.user.id
        });

        const newMaterial = await ClassMaterial.getById(materialId);
        res.status(201).json({ message: 'Archivo subido exitosamente', material: newMaterial });
    } catch (error) {
        console.error('Error al subir archivo:', error.message);
        res.status(500).json({ message: 'Error al subir archivo' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, material_type, external_link, is_active, display_order, category_id } = req.body;

        if (external_link && !/^https?:\/\//i.test(external_link)) {
            return res.status(400).json({ message: 'El link debe empezar con http:// o https://' });
        }

        const owner = await getMaterialClassTenant(id);
        if (!owner) {
            return res.status(404).json({ message: 'Material no encontrado' });
        }
        if (!assertSameTenant(req.user, owner.tenant_id)) {
            return res.status(403).json({ message: 'No tienes acceso a este material' });
        }

        const updated = await ClassMaterial.update(id, {
            title, description, material_type, external_link,
            is_active: is_active ? 1 : 0, display_order, category_id
        });

        if (!updated) {
            return res.status(404).json({ message: 'Material no encontrado' });
        }
        const material = await ClassMaterial.getById(id);
        res.json({ message: 'Material actualizado', material });
    } catch (error) {
        console.error('Error al actualizar material:', error.message);
        res.status(500).json({ message: 'Error al actualizar material' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const owner = await getMaterialClassTenant(req.params.id);
        if (!owner) {
            return res.status(404).json({ message: 'Material no encontrado' });
        }
        if (!assertSameTenant(req.user, owner.tenant_id)) {
            return res.status(403).json({ message: 'No tienes acceso a este material' });
        }

        const deleted = await ClassMaterial.delete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ message: 'Material no encontrado' });
        }

        await logAction({
            tenantId: owner.tenant_id, actorId: req.user.id, actorRole: req.user.role,
            action: 'material_deleted', targetType: 'class_material', targetId: req.params.id,
            metadata: { class_id: owner.class_id }, ip: req.ip
        });

        res.json({ message: 'Material eliminado' });
    } catch (error) {
        console.error('Error al eliminar material:', error.message);
        res.status(500).json({ message: 'Error al eliminar material' });
    }
});

router.post('/categories', [body('class_id').isInt(), body('name').trim().notEmpty()], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { class_id, name, description, color } = req.body;

        const classTenant = await getClassTenant(class_id);
        if (classTenant === null) {
            return res.status(404).json({ message: 'Clase no encontrada' });
        }
        if (!assertSameTenant(req.user, classTenant)) {
            return res.status(403).json({ message: 'No tienes acceso a esta clase' });
        }

        const categoryId = await MaterialCategory.create({ class_id, name, description, color });
        res.status(201).json({ message: 'Categoria creada', id: categoryId });
    } catch (error) {
        console.error('Error al crear categoria:', error.message);
        res.status(500).json({ message: 'Error al crear categoria' });
    }
});

router.delete('/categories/:id', async (req, res) => {
    try {
        const owner = await getCategoryClassTenant(req.params.id);
        if (!owner) {
            return res.status(404).json({ message: 'Categoria no encontrada' });
        }
        if (!assertSameTenant(req.user, owner.tenant_id)) {
            return res.status(403).json({ message: 'No tienes acceso a esta categoria' });
        }

        const deleted = await MaterialCategory.delete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ message: 'Categoria no encontrada' });
        }

        await logAction({
            tenantId: owner.tenant_id, actorId: req.user.id, actorRole: req.user.role,
            action: 'category_deleted', targetType: 'material_category', targetId: req.params.id,
            metadata: { class_id: owner.class_id }, ip: req.ip
        });

        res.json({ message: 'Categoria eliminada' });
    } catch (error) {
        console.error('Error al eliminar categoria:', error.message);
        res.status(400).json({ message: error.message || 'Error al eliminar categoria' });
    }
});

module.exports = router;
