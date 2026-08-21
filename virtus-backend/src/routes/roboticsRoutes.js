const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { requireRole, assertSameTenant } = require('../middleware/roles');
const { CompetitionRobot, CompetitionRobotFile } = require('../models/Robotics');
const { uploadRobotFile } = require('../config/cloudinary');
const { logAction } = require('../utils/audit');

router.use(authMiddleware);

// Robótica de Competencia: repositorio del admin (robots propios con
// archivos STL/código/conexiones). Lectura: super_admin, academy_admin
// y teacher (los docentes solo consultan y descargan). Escritura
// (crear/editar/subir/borrar): solo super_admin y academy_admin.
const readAccess = requireRole('super_admin', 'academy_admin', 'teacher');
const writeAccess = requireRole('super_admin', 'academy_admin');

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Demasiadas subidas en poco tiempo. Espera unos minutos.' }
});

const FILE_CATEGORIES = ['stl', 'code', 'connection', 'other'];

async function getRobotTenant(robotId) {
    const [rows] = await db.pool.query('SELECT tenant_id FROM competition_robots WHERE id = ?', [robotId]);
    return rows[0]?.tenant_id ?? null;
}

// ============================================
// ROBOTS
// ============================================

router.get('/robots', readAccess, async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const { includeInactive } = req.query;
        const robots = await CompetitionRobot.getByTenant(tenantId, includeInactive === 'true');
        res.json({ robots });
    } catch (error) {
        console.error('Error al obtener robots:', error.message);
        res.status(500).json({ message: 'Error al obtener robots', debug_code: error.code, debug_msg: error.sqlMessage || error.message });
    }
});

router.get('/robots/:id', readAccess, async (req, res) => {
    try {
        const robot = await CompetitionRobot.getById(req.params.id);
        if (!robot) {
            return res.status(404).json({ message: 'Robot no encontrado' });
        }
        if (!assertSameTenant(req.user, robot.tenant_id)) {
            return res.status(403).json({ message: 'No tienes acceso a este robot' });
        }
        const files = await CompetitionRobotFile.getByRobot(robot.id);
        res.json({ robot, files });
    } catch (error) {
        console.error('Error al obtener robot:', error.message);
        res.status(500).json({ message: 'Error al obtener robot' });
    }
});

const robotValidation = [
    body('name').trim().notEmpty().withMessage('El nombre es requerido')
];

router.post('/robots', writeAccess, robotValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, description, category } = req.body;
        const robotId = await CompetitionRobot.create({
            tenant_id: req.user.tenant_id,
            name, description, category,
            created_by: req.user.id
        });

        const newRobot = await CompetitionRobot.getById(robotId);
        res.status(201).json({ message: 'Robot creado exitosamente', robot: newRobot });
    } catch (error) {
        console.error('Error al crear robot:', error.message);
        res.status(500).json({ message: 'Error al crear robot', debug_code: error.code, debug_msg: error.sqlMessage || error.message });
    }
});

router.put('/robots/:id', writeAccess, robotValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const robotTenant = await getRobotTenant(req.params.id);
        if (robotTenant === null) {
            return res.status(404).json({ message: 'Robot no encontrado' });
        }
        if (!assertSameTenant(req.user, robotTenant)) {
            return res.status(403).json({ message: 'No tienes acceso a este robot' });
        }

        const { name, description, category, is_active } = req.body;
        const updated = await CompetitionRobot.update(req.params.id, {
            name, description, category,
            is_active: is_active === undefined ? 1 : (is_active ? 1 : 0)
        });
        if (!updated) {
            return res.status(404).json({ message: 'Robot no encontrado' });
        }

        const robot = await CompetitionRobot.getById(req.params.id);
        res.json({ message: 'Robot actualizado', robot });
    } catch (error) {
        console.error('Error al actualizar robot:', error.message);
        res.status(500).json({ message: 'Error al actualizar robot' });
    }
});

router.delete('/robots/:id', writeAccess, async (req, res) => {
    try {
        const robotTenant = await getRobotTenant(req.params.id);
        if (robotTenant === null) {
            return res.status(404).json({ message: 'Robot no encontrado' });
        }
        if (!assertSameTenant(req.user, robotTenant)) {
            return res.status(403).json({ message: 'No tienes acceso a este robot' });
        }

        const deleted = await CompetitionRobot.delete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ message: 'Robot no encontrado' });
        }

        await logAction({
            tenantId: robotTenant, actorId: req.user.id, actorRole: req.user.role,
            action: 'competition_robot_deleted', targetType: 'competition_robot', targetId: req.params.id,
            metadata: {}, ip: req.ip
        });

        res.json({ message: 'Robot eliminado' });
    } catch (error) {
        console.error('Error al eliminar robot:', error.message);
        res.status(500).json({ message: 'Error al eliminar robot' });
    }
});

// ============================================
// ARCHIVOS DEL ROBOT (STL, código, conexiones)
// ============================================

router.post('/robots/:id/files', writeAccess, uploadLimiter, uploadRobotFile.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se subió ningún archivo' });
        }
        const { file_category } = req.body;
        if (!FILE_CATEGORIES.includes(file_category)) {
            return res.status(400).json({ message: 'file_category inválido (usa stl, code, connection u other)' });
        }

        const robotTenant = await getRobotTenant(req.params.id);
        if (robotTenant === null) {
            return res.status(404).json({ message: 'Robot no encontrado' });
        }
        if (!assertSameTenant(req.user, robotTenant)) {
            return res.status(403).json({ message: 'No tienes acceso a este robot' });
        }

        const fileId = await CompetitionRobotFile.create({
            robot_id: req.params.id,
            file_category,
            file_url: req.file.path,
            file_name: req.file.originalname,
            file_size: req.file.size,
            uploaded_by: req.user.id
        });

        const files = await CompetitionRobotFile.getByRobot(req.params.id);
        const newFile = files.find(f => f.id === fileId);
        res.status(201).json({ message: 'Archivo subido exitosamente', file: newFile });
    } catch (error) {
        console.error('Error al subir archivo del robot:', error.message);
        res.status(500).json({ message: 'Error al subir archivo' });
    }
});

router.delete('/files/:id', writeAccess, async (req, res) => {
    try {
        const owner = await CompetitionRobotFile.getRobotOwner(req.params.id);
        if (!owner) {
            return res.status(404).json({ message: 'Archivo no encontrado' });
        }
        if (!assertSameTenant(req.user, owner.tenant_id)) {
            return res.status(403).json({ message: 'No tienes acceso a este archivo' });
        }

        const deleted = await CompetitionRobotFile.delete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ message: 'Archivo no encontrado' });
        }

        await logAction({
            tenantId: owner.tenant_id, actorId: req.user.id, actorRole: req.user.role,
            action: 'competition_robot_file_deleted', targetType: 'competition_robot_file', targetId: req.params.id,
            metadata: { robot_id: owner.robot_id }, ip: req.ip
        });

        res.json({ message: 'Archivo eliminado' });
    } catch (error) {
        console.error('Error al eliminar archivo:', error.message);
        res.status(500).json({ message: 'Error al eliminar archivo' });
    }
});

module.exports = router;
