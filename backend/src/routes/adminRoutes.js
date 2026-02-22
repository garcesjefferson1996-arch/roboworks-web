const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

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
// ENDPOINTS PARA PROGRAMAS
// ============================================

// Obtener todos los programas
router.get('/programs', async (req, res) => {
    try {
        const [programs] = await db.pool.query(`
            SELECT p.*, 
                   (SELECT COUNT(*) FROM classes WHERE program_id = p.id) as total_classes
            FROM programs p
            ORDER BY p.id
        `);
        res.json(programs);
    } catch (error) {
        console.error('Error al obtener programas:', error);
        res.status(500).json({ message: 'Error al obtener programas' });
    }
});

// Crear nuevo programa
router.post('/programs', async (req, res) => {
    try {
        const { name, description, icon, color } = req.body;
        
        const [result] = await db.pool.query(
            'INSERT INTO programs (name, description, icon, color) VALUES (?, ?, ?, ?)',
            [name, description, icon, color]
        );
        
        res.json({ 
            message: 'Programa creado exitosamente',
            id: result.insertId 
        });
    } catch (error) {
        console.error('Error al crear programa:', error);
        res.status(500).json({ message: 'Error al crear programa' });
    }
});

// ============================================
// ENDPOINTS PARA CURSOS DE CODEWORKS
// ============================================

// Obtener cursos de CodeWorks
router.get('/codeworks-courses', async (req, res) => {
    try {
        const [courses] = await db.pool.query(`
            SELECT c.*, p.name as program_name
            FROM codeworks_courses c
            JOIN programs p ON c.program_id = p.id
            WHERE p.name = 'CodeWorks'
            ORDER BY c.name
        `);
        res.json(courses);
    } catch (error) {
        console.error('Error al obtener cursos:', error);
        res.status(500).json({ message: 'Error al obtener cursos' });
    }
});

// Crear nuevo curso en CodeWorks
router.post('/codeworks-courses', async (req, res) => {
    try {
        const { name, description, icon } = req.body;
        
        // Obtener el ID de CodeWorks
        const [program] = await db.pool.query(
            'SELECT id FROM programs WHERE name = "CodeWorks"'
        );
        
        if (program.length === 0) {
            return res.status(404).json({ message: 'Programa CodeWorks no encontrado' });
        }
        
        const [result] = await db.pool.query(
            'INSERT INTO codeworks_courses (name, description, icon, program_id) VALUES (?, ?, ?, ?)',
            [name, description, icon, program[0].id]
        );
        
        res.json({ 
            message: 'Curso creado exitosamente',
            id: result.insertId 
        });
    } catch (error) {
        console.error('Error al crear curso:', error);
        res.status(500).json({ message: 'Error al crear curso' });
    }
});

// ============================================
// ENDPOINTS PARA CLASES
// ============================================

// Obtener todas las clases (con filtros opcionales)
router.get('/classes', async (req, res) => {
    try {
        const { program_id, course_id } = req.query;
        
        let query = `
            SELECT c.*, 
                   p.name as program_name,
                   cc.name as course_name,
                   COUNT(cs.student_id) as enrolled_students,
                   u.full_name as teacher_name
            FROM classes c
            JOIN programs p ON c.program_id = p.id
            LEFT JOIN codeworks_courses cc ON c.codeworks_course_id = cc.id
            LEFT JOIN class_students cs ON c.id = cs.class_id
            LEFT JOIN users u ON c.teacher_id = u.id
        `;
        
        let whereConditions = [];
        let params = [];
        
        if (program_id) {
            whereConditions.push('c.program_id = ?');
            params.push(program_id);
        }
        
        if (course_id) {
            whereConditions.push('c.codeworks_course_id = ?');
            params.push(course_id);
        }
        
        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }
        
        query += ' GROUP BY c.id ORDER BY c.schedule_day, c.schedule_time';
        
        const [classes] = await db.pool.query(query, params);
        res.json(classes);
    } catch (error) {
        console.error('Error al obtener clases:', error);
        res.status(500).json({ message: 'Error al obtener clases' });
    }
});

// Crear nueva clase (con cupo máximo 4)
router.post('/classes', async (req, res) => {
    try {
        const { 
            program_id, 
            codeworks_course_id,
            name, 
            teacher_id, 
            zoom_link,
            schedule_day, 
            schedule_time,
            description,
            max_students = 4 
        } = req.body;
        
        // Validar que si es CodeWorks, tenga course_id
        const [program] = await db.pool.query(
            'SELECT name FROM programs WHERE id = ?',
            [program_id]
        );
        
        if (program.length === 0) {
            return res.status(404).json({ message: 'Programa no encontrado' });
        }
        
        if (program[0].name === 'CodeWorks' && !codeworks_course_id) {
            return res.status(400).json({ 
                message: 'Para clases de CodeWorks debes especificar el curso' 
            });
        }
        
        const [result] = await db.pool.query(
            `INSERT INTO classes 
             (tenant_id, program_id, codeworks_course_id, name, teacher_id, 
              zoom_link, schedule_day, schedule_time, description, max_students) 
             VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [program_id, codeworks_course_id, name, teacher_id, 
             zoom_link, schedule_day, schedule_time, description, max_students]
        );
        
        res.json({ 
            message: 'Clase creada exitosamente',
            id: result.insertId 
        });
    } catch (error) {
        console.error('Error al crear clase:', error);
        res.status(500).json({ message: 'Error al crear clase' });
    }
});

// Obtener estudiantes de una clase
router.get('/classes/:classId/students', async (req, res) => {
    try {
        const [students] = await db.pool.query(`
            SELECT u.id, u.full_name, u.username, u.profile_photo
            FROM users u
            JOIN class_students cs ON u.id = cs.student_id
            WHERE cs.class_id = ?
            ORDER BY u.full_name
        `, [req.params.classId]);
        
        res.json(students);
    } catch (error) {
        console.error('Error al obtener estudiantes:', error);
        res.status(500).json({ message: 'Error al obtener estudiantes' });
    }
});

// Asignar estudiante a clase (con control de cupo)
router.post('/classes/:classId/students/:studentId', async (req, res) => {
    try {
        const { classId, studentId } = req.params;
        
        // Verificar cupo disponible
        const [classInfo] = await db.pool.query(`
            SELECT c.max_students, COUNT(cs.student_id) as enrolled
            FROM classes c
            LEFT JOIN class_students cs ON c.id = cs.class_id AND cs.class_id = ?
            WHERE c.id = ?
            GROUP BY c.id
        `, [classId, classId]);
        
        if (classInfo.length === 0) {
            return res.status(404).json({ message: 'Clase no encontrada' });
        }
        
        const { max_students, enrolled } = classInfo[0];
        
        if (enrolled >= max_students) {
            return res.status(400).json({ 
                message: `La clase ya tiene el cupo completo (máximo ${max_students} estudiantes)` 
            });
        }
        
        // Verificar que el estudiante existe y es estudiante
        const [student] = await db.pool.query(
            'SELECT id FROM users WHERE id = ? AND role = "student"',
            [studentId]
        );
        
        if (student.length === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado' });
        }
        
        // Asignar estudiante
        await db.pool.query(
            'INSERT INTO class_students (class_id, student_id) VALUES (?, ?)',
            [classId, studentId]
        );
        
        res.json({ message: 'Estudiante asignado exitosamente' });
    } catch (error) {
        console.error('Error al asignar estudiante:', error);
        res.status(500).json({ message: 'Error al asignar estudiante' });
    }
});

// Eliminar estudiante de clase
router.delete('/classes/:classId/students/:studentId', async (req, res) => {
    try {
        await db.pool.query(
            'DELETE FROM class_students WHERE class_id = ? AND student_id = ?',
            [req.params.classId, req.params.studentId]
        );
        
        res.json({ message: 'Estudiante removido exitosamente' });
    } catch (error) {
        console.error('Error al remover estudiante:', error);
        res.status(500).json({ message: 'Error al remover estudiante' });
    }
});

// ============================================
// ENDPOINTS PARA ESTUDIANTES (CON WHATSAPP)
// ============================================

// Obtener todos los estudiantes
router.get('/students', async (req, res) => {
    try {
        console.log('📥 GET /admin/students - Obteniendo estudiantes');
        const [students] = await db.pool.query(`
            SELECT u.id, u.username, u.full_name, u.profile_photo, 
                   u.temporary_password, u.invitation_code, u.created_at,
                   u.parent_phone,
                   COUNT(DISTINCT cs.class_id) as total_classes
            FROM users u
            LEFT JOIN class_students cs ON u.id = cs.student_id
            WHERE u.role = 'student'
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);
        console.log(`✅ Encontrados ${students.length} estudiantes`);
        res.json(students);
    } catch (error) {
        console.error('❌ Error al obtener estudiantes:', error);
        res.status(500).json({ message: 'Error al obtener estudiantes', error: error.message });
    }
});

// Crear nuevo estudiante (CON WHATSAPP)
router.post('/students', async (req, res) => {
    try {
        console.log('📥 POST /admin/students - Creando estudiante:', req.body);
        const { full_name, program_id, class_ids, parent_phone } = req.body;
        
        // Validar datos
        if (!full_name) {
            return res.status(400).json({ message: 'El nombre es requerido' });
        }
        
        // Generar username único
        const timestamp = Date.now().toString().slice(-6);
        const username = 'est_' + timestamp + Math.floor(Math.random() * 100);
        
        // Generar contraseña temporal
        const tempPassword = 'Robo' + Math.floor(Math.random() * 10000);
        
        // Hashear contraseña
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(tempPassword, salt);
        
        // Generar código de invitación
        const invitation_code = 'ROBO-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Insertar estudiante (AHORA INCLUYE parent_phone)
        const [result] = await db.pool.query(
            `INSERT INTO users 
             (tenant_id, username, password_hash, full_name, role, temporary_password, invitation_code, parent_phone) 
             VALUES (1, ?, ?, ?, 'student', true, ?, ?)`,
            [username, password_hash, full_name, invitation_code, parent_phone || null]
        );
        
        const studentId = result.insertId;
        console.log(`✅ Estudiante creado con ID: ${studentId}, usuario: ${username}`);
        
        // Asignar a clases si se especificaron
        let assignedClasses = [];
        if (class_ids && class_ids.length > 0) {
            console.log(`📥 Asignando a ${class_ids.length} clases`);
            for (const classId of class_ids) {
                // Verificar cupo
                const [classInfo] = await db.pool.query(`
                    SELECT c.max_students, COUNT(cs.student_id) as enrolled
                    FROM classes c
                    LEFT JOIN class_students cs ON c.id = cs.class_id AND cs.class_id = ?
                    WHERE c.id = ?
                    GROUP BY c.id
                `, [classId, classId]);
                
                if (classInfo.length > 0) {
                    const { max_students, enrolled } = classInfo[0];
                    if (enrolled < max_students) {
                        await db.pool.query(
                            'INSERT INTO class_students (class_id, student_id) VALUES (?, ?)',
                            [classId, studentId]
                        );
                        console.log(`  ✅ Asignado a clase ${classId}`);
                        assignedClasses.push(classId);
                    } else {
                        console.log(`  ⚠️ Clase ${classId} sin cupo (${enrolled}/${max_students})`);
                    }
                }
            }
        }
        
        // ENVIAR WHATSAPP SI HAY TELÉFONO DE PADRE
        let whatsappSent = false;
        if (parent_phone) {
            try {
                console.log(`📱 Intentando enviar WhatsApp a ${parent_phone}...`);
                
                // Formatear número (eliminar espacios, guiones, etc)
                const formattedPhone = parent_phone.replace(/[\s\-\(\)]/g, '');
                
                const whatsappService = require('../services/whatsappService');
                const result = await whatsappService.sendTemplate('welcome', formattedPhone, {
                    nombre: full_name.split(' ')[0], // Primer nombre
                    usuario: username,
                    password: tempPassword,
                    codigo: invitation_code,
                    clases: assignedClasses.length
                });
                
                if (result.success) {
                    whatsappSent = true;
                    console.log(`✅ WhatsApp enviado exitosamente a ${parent_phone}`);
                } else {
                    console.log(`⚠️ No se pudo enviar WhatsApp: ${result.error}`);
                }
                
            } catch (whatsappError) {
                console.error('❌ Error enviando WhatsApp:', whatsappError.message);
                // No falla la creación si WhatsApp falla
            }
        }
        
        // Preparar respuesta
        const response = {
            message: 'Estudiante creado exitosamente',
            student: {
                id: studentId,
                username,
                full_name,
                invitation_code,
                temp_password: tempPassword,
                parent_phone: parent_phone || null,
                assigned_classes: assignedClasses.length
            }
        };
        
        // Agregar info de WhatsApp si aplica
        if (parent_phone) {
            response.whatsapp = {
                sent: whatsappSent,
                message: whatsappSent 
                    ? 'Credenciales enviadas por WhatsApp' 
                    : 'No se pudo enviar WhatsApp (el número será notificado más tarde)'
            };
        }
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ Error al crear estudiante:', error);
        res.status(500).json({ message: 'Error al crear estudiante', error: error.message });
    }
});

// Obtener detalles de un estudiante
router.get('/students/:studentId', async (req, res) => {
    try {
        console.log(`📥 GET /admin/students/${req.params.studentId}`);
        
        const [student] = await db.pool.query(`
            SELECT u.id, u.username, u.full_name, u.profile_photo, 
                   u.temporary_password, u.invitation_code, u.created_at,
                   u.parent_phone
            FROM users u
            WHERE u.id = ? AND u.role = 'student'
        `, [req.params.studentId]);
        
        if (student.length === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado' });
        }
        
        // Obtener clases del estudiante
        const [classes] = await db.pool.query(`
            SELECT c.id, c.name, p.name as program_name,
                   c.schedule_day, c.schedule_time,
                   c.zoom_link
            FROM classes c
            JOIN class_students cs ON c.id = cs.class_id
            JOIN programs p ON c.program_id = p.id
            WHERE cs.student_id = ?
            ORDER BY c.schedule_day, c.schedule_time
        `, [req.params.studentId]);
        
        res.json({
            ...student[0],
            classes
        });
        
    } catch (error) {
        console.error('❌ Error al obtener estudiante:', error);
        res.status(500).json({ message: 'Error al obtener estudiante' });
    }
});

// Asignar estudiante a clase
router.post('/students/:studentId/classes/:classId', async (req, res) => {
    try {
        const { studentId, classId } = req.params;
        
        // Verificar cupo
        const [classInfo] = await db.pool.query(`
            SELECT c.max_students, COUNT(cs.student_id) as enrolled
            FROM classes c
            LEFT JOIN class_students cs ON c.id = cs.class_id AND cs.class_id = ?
            WHERE c.id = ?
            GROUP BY c.id
        `, [classId, classId]);
        
        if (classInfo.length === 0) {
            return res.status(404).json({ message: 'Clase no encontrada' });
        }
        
        const { max_students, enrolled } = classInfo[0];
        
        if (enrolled >= max_students) {
            return res.status(400).json({ 
                message: `La clase ya tiene el cupo completo (máximo ${max_students} estudiantes)` 
            });
        }
        
        // Verificar que el estudiante existe
        const [student] = await db.pool.query(
            'SELECT id FROM users WHERE id = ? AND role = "student"',
            [studentId]
        );
        
        if (student.length === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado' });
        }
        
        // Verificar que no esté ya asignado
        const [existing] = await db.pool.query(
            'SELECT * FROM class_students WHERE class_id = ? AND student_id = ?',
            [classId, studentId]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ message: 'El estudiante ya está en esta clase' });
        }
        
        // Asignar
        await db.pool.query(
            'INSERT INTO class_students (class_id, student_id) VALUES (?, ?)',
            [classId, studentId]
        );
        
        res.json({ message: 'Estudiante asignado exitosamente' });
        
    } catch (error) {
        console.error('Error al asignar estudiante:', error);
        res.status(500).json({ message: 'Error al asignar estudiante' });
    }
});

// Quitar estudiante de clase
router.delete('/students/:studentId/classes/:classId', async (req, res) => {
    try {
        await db.pool.query(
            'DELETE FROM class_students WHERE class_id = ? AND student_id = ?',
            [req.params.classId, req.params.studentId]
        );
        
        res.json({ message: 'Estudiante removido de la clase' });
    } catch (error) {
        console.error('Error al remover estudiante:', error);
        res.status(500).json({ message: 'Error al remover estudiante' });
    }
});

module.exports = router;