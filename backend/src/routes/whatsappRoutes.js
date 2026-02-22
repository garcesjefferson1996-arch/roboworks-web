const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');
const authMiddleware = require('../middleware/auth');
const db = require('../config/database');

// Solo admins pueden controlar WhatsApp
router.use(authMiddleware);
router.use((req, res, next) => {
    if (req.user.role !== 'super_admin' && req.user.role !== 'academy_admin') {
        return res.status(403).json({ message: 'Acceso no autorizado' });
    }
    next();
});

// Inicializar WhatsApp
router.post('/initialize', async (req, res) => {
    try {
        const result = await whatsappService.initialize();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener estado
router.get('/status', async (req, res) => {
    try {
        const status = await whatsappService.getStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Enviar mensaje de prueba
router.post('/test', async (req, res) => {
    try {
        const { phone, message } = req.body;
        
        if (!phone || !message) {
            return res.status(400).json({ error: 'Teléfono y mensaje requeridos' });
        }
        
        const result = await whatsappService.sendMessage(phone, message);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Enviar recordatorio a una clase específica
router.post('/remind-class/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        
        // Obtener información de la clase
        const [classInfo] = await db.pool.query(`
            SELECT c.*, u.full_name as teacher_name
            FROM classes c
            LEFT JOIN users u ON c.teacher_id = u.id
            WHERE c.id = ?
        `, [classId]);
        
        if (classInfo.length === 0) {
            return res.status(404).json({ error: 'Clase no encontrada' });
        }
        
        const cls = classInfo[0];
        
        // Obtener estudiantes de la clase con teléfono
        const [students] = await db.pool.query(`
            SELECT u.id, u.full_name, u.parent_phone
            FROM users u
            JOIN class_students cs ON u.id = cs.student_id
            WHERE cs.class_id = ? AND u.parent_phone IS NOT NULL
        `, [classId]);
        
        if (students.length === 0) {
            return res.json({ 
                message: 'No hay estudiantes con teléfono registrado en esta clase' 
            });
        }
        
        // Preparar variables para la plantilla
        const variables = {
            nombre: '', // Se reemplazará por cada estudiante
            clase: cls.name,
            fecha: new Date().toLocaleDateString('es-ES'),
            hora: cls.schedule_time || 'Por definir',
            profesor: cls.teacher_name || 'Profesor',
            zoom_link: cls.zoom_link || 'Disponible en la plataforma',
            descripcion: cls.description || ''
        };
        
        // Enviar mensajes
        const phones = students.map(s => s.parent_phone);
        const results = [];
        
        for (const student of students) {
            const result = await whatsappService.sendTemplate(
                student.parent_phone,
                'class_reminder',
                {
                    ...variables,
                    nombre: student.full_name.split(' ')[0] // Primer nombre
                }
            );
            
            results.push({
                student_id: student.id,
                student_name: student.full_name,
                phone: student.parent_phone,
                success: result.success
            });
            
            // Esperar entre mensajes
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        res.json({
            message: `Recordatorios enviados a ${students.length} estudiantes`,
            results
        });
        
    } catch (error) {
        console.error('Error enviando recordatorios:', error);
        res.status(500).json({ error: error.message });
    }
});

// Enviir credenciales a estudiante específico
router.post('/send-credentials/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        
        // Obtener información del estudiante
        const [student] = await db.pool.query(`
            SELECT id, full_name, username, invitation_code, parent_phone,
                   (SELECT password_hash FROM users WHERE id = ?) as password_hash
            FROM users 
            WHERE id = ? AND role = 'student'
        `, [studentId, studentId]);
        
        if (student.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado' });
        }
        
        const s = student[0];
        
        if (!s.parent_phone) {
            return res.status(400).json({ 
                error: 'El estudiante no tiene teléfono registrado' 
            });
        }
        
        // Generar contraseña temporal (no podemos obtener la original)
        const tempPassword = 'Robo' + Math.floor(Math.random() * 10000);
        
        // Cambiar contraseña en la base de datos
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(tempPassword, salt);
        
        await db.pool.query(
            'UPDATE users SET password_hash = ?, temporary_password = true WHERE id = ?',
            [password_hash, studentId]
        );
        
        // Enviar WhatsApp
        const result = await whatsappService.sendTemplate(
            s.parent_phone,
            'welcome',
            {
                nombre: s.full_name.split(' ')[0],
                usuario: s.username,
                password: tempPassword,
                codigo: s.invitation_code
            }
        );
        
        res.json({
            message: result.success ? 'Credenciales enviadas' : 'Error enviando credenciales',
            result,
            temp_password: tempPassword // Solo para mostrar al admin
        });
        
    } catch (error) {
        console.error('Error enviando credenciales:', error);
        res.status(500).json({ error: error.message });
    }
});

// Cerrar sesión de WhatsApp
router.post('/logout', async (req, res) => {
    try {
        const result = await whatsappService.logout();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;