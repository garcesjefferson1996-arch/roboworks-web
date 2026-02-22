const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

class AuthController {
    // Login de usuario
    async login(req, res) {
        try {
            console.log('📝 [LOGIN] Intento de login:', { username: req.body.username });
            
            // Validar entrada
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                console.log('❌ [LOGIN] Errores de validación:', errors.array());
                return res.status(400).json({ errors: errors.array() });
            }

            const { username, password } = req.body;

            // Buscar usuario
            const user = await User.findByUsername(username);
            if (!user) {
                console.log('❌ [LOGIN] Usuario no encontrado:', username);
                return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
            }

            console.log('✅ [LOGIN] Usuario encontrado:', { 
                id: user.id, 
                username: user.username,
                role: user.role 
            });

            // Validar contraseña
            const isValid = await User.validatePassword(password, user.password_hash);
            if (!isValid) {
                console.log('❌ [LOGIN] Contraseña incorrecta para:', username);
                return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
            }

            console.log('✅ [LOGIN] Contraseña válida para:', username);

            // Crear token JWT
            const token = jwt.sign(
                { 
                    id: user.id, 
                    username: user.username,
                    role: user.role,
                    tenant_id: user.tenant_id 
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            console.log('🔑 [LOGIN] Token generado:', token.substring(0, 20) + '...');

            // 🔥 CONFIGURACIÓN DE COOKIE MEJORADA PARA DESARROLLO 🔥
            res.cookie('token', token, {
                httpOnly: true,
                secure: false, // IMPORTANTE: false para desarrollo local (con http)
                sameSite: 'lax', // 'lax' permite la cookie en redirecciones
                maxAge: 24 * 60 * 60 * 1000, // 24 horas
                path: '/', // Disponible en todo el sitio
                domain: 'localhost' // Explícitamente para localhost
            });

            console.log('🍪 [LOGIN] Cookie configurada:', {
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                maxAge: '24h',
                path: '/'
            });

            // Verificar que la cookie se está enviando en los headers
            console.log('📦 [LOGIN] Headers de respuesta:', {
                'set-cookie': res.getHeaders()['set-cookie'] ? '✅ Presente' : '❌ No presente'
            });

            console.log('✅ [LOGIN] Login exitoso para:', username);

            // Responder con datos del usuario (sin datos sensibles)
            res.json({
                message: 'Login exitoso',
                user: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    role: user.role,
                    profile_photo: user.profile_photo,
                    temporary_password: user.temporary_password
                }
            });

        } catch (error) {
            console.error('❌ [LOGIN] Error:', error);
            res.status(500).json({ 
                message: 'Error en el servidor',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Logout
    async logout(req, res) {
        try {
            console.log('📝 [LOGOUT] Cerrando sesión');
            
            // Limpiar cookie
            res.clearCookie('token', {
                path: '/',
                domain: 'localhost',
                httpOnly: true,
                secure: false
            });
            
            console.log('✅ [LOGOUT] Sesión cerrada');
            res.json({ message: 'Logout exitoso' });
        } catch (error) {
            console.error('❌ [LOGOUT] Error:', error);
            res.status(500).json({ message: 'Error en el servidor' });
        }
    }

    // Cambiar contraseña (primer acceso)
    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            const userId = req.user.id;

            console.log('📝 [CHANGE_PASSWORD] Intento de cambio para usuario:', userId);

            // Verificar usuario actual (con password_hash)
            const user = await User.findById(userId, true);
            if (!user) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }

            // Verificar contraseña actual
            const isValid = await User.validatePassword(currentPassword, user.password_hash);
            if (!isValid) {
                return res.status(401).json({ message: 'Contraseña actual incorrecta' });
            }

            // Cambiar contraseña
            const changed = await User.changePassword(userId, newPassword);
            
            if (changed) {
                console.log('✅ [CHANGE_PASSWORD] Contraseña actualizada para usuario:', userId);
                res.json({ message: 'Contraseña actualizada exitosamente' });
            } else {
                res.status(400).json({ message: 'No se pudo cambiar la contraseña' });
            }

        } catch (error) {
            console.error('❌ [CHANGE_PASSWORD] Error:', error);
            res.status(500).json({ message: 'Error en el servidor' });
        }
    }

    // Verificar sesión actual
    async verifySession(req, res) {
        try {
            console.log('📝 [VERIFY] Verificando sesión para usuario:', req.user?.id);
            
            // Verificar que req.user existe (viene del middleware)
            if (!req.user || !req.user.id) {
                console.log('❌ [VERIFY] No hay usuario en la request');
                return res.status(401).json({ message: 'No autorizado' });
            }

            const user = await User.findById(req.user.id);
            if (!user) {
                console.log('❌ [VERIFY] Usuario no encontrado:', req.user.id);
                return res.status(401).json({ message: 'Sesión no válida' });
            }

            console.log('✅ [VERIFY] Sesión válida para:', user.username);
            
            res.json({
                user: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    role: user.role,
                    profile_photo: user.profile_photo
                }
            });
        } catch (error) {
            console.error('❌ [VERIFY] Error:', error);
            res.status(500).json({ message: 'Error en el servidor' });
        }
    }
}

module.exports = new AuthController();